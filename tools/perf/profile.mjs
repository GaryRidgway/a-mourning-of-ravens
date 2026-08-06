// V8 CPU profile of the running piece, aggregated by function self-time.
// Usage: node --experimental-websocket profile.mjs [--throttle=6] [--dpr=2] [--page=...]

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Repo root, derived from this file's location (tools/perf/x.mjs).
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8792;
const DEBUG_PORT = 9334;

const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const eq = s.indexOf('=');
  return eq < 0 ? [s, 'true'] : [s.slice(0, eq), s.slice(eq + 1)];
}));
const RATE = Number(argv.throttle || 6);
const DPR = Number(argv.dpr || 2);
const PAGE = argv.page || '/index.html?debug';
const WARMUP_MS = Number(argv.warmup || 10000);
const SAMPLE_MS = Number(argv.sample || 12000);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0]));
  try {
    const buf = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-store' });
    res.end(buf);
  } catch { res.writeHead(404).end('nope'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const profileDir = mkdtempSync(join(tmpdir(), 'mourn-prof-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profileDir}`, '--window-size=1600,900', '--no-first-run',
  '--disable-extensions', '--hide-scrollbars', '--enable-gpu-rasterization',
  '--use-angle=metal', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page;
for (let i = 0; i < 60 && !page; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    page = list.find((t) => t.type === 'page');
  } catch {}
  if (!page) await sleep(250);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression, awaitPromise = true) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Profiler.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: 1600, height: 900, deviceScaleFactor: DPR, mobile: false });
await send('Emulation.setCPUThrottlingRate', { rate: RATE });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${PAGE}` });
await sleep(2500);
await evaluate(`(async () => {
  for (let i = 0; i < 80; i++) {
    if (typeof startAutoScroll === 'function' && window.__mournQuality) { startAutoScroll(0.3); return 'ok'; }
    await new Promise(r => setTimeout(r, 250));
  }
  return 'timeout';
})()`);
await sleep(WARMUP_MS);

await send('Profiler.setSamplingInterval', { interval: 200 });
await send('Profiler.start');
await sleep(SAMPLE_MS);
const { profile } = await send('Profiler.stop');

// Aggregate self time per node, then roll up by function name.
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const selfTicks = new Map();
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i];
  const dt = profile.timeDeltas[i] || 0;
  selfTicks.set(id, (selfTicks.get(id) || 0) + dt);
}
const byFn = new Map();
let total = 0;
for (const [id, us] of selfTicks) {
  const n = byId.get(id);
  if (!n) continue;
  const cf = n.callFrame;
  const file = (cf.url || '').split('/').pop() || '(native)';
  const key = `${cf.functionName || '(anonymous)'}  [${file}:${cf.lineNumber + 1}]`;
  byFn.set(key, (byFn.get(key) || 0) + us);
  total += us;
}
const sorted = [...byFn].sort((a, b) => b[1] - a[1]);
console.log(`\nCPU profile — throttle ${RATE}x, dpr ${DPR}, ${(total / 1000).toFixed(0)} ms sampled\n`);
console.log('  self%     self ms   function');
for (const [k, us] of sorted.slice(0, 30)) {
  console.log(`  ${((us / total) * 100).toFixed(2).padStart(6)}%  ${(us / 1000).toFixed(1).padStart(9)}   ${k}`);
}
const q = await evaluate('window.__mournQuality ? window.__mournQuality.level : -1');
console.log(`\nquality level at end: ${q}`);

ws.close(); chrome.kill(); server.close();
try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
process.exit(0);
