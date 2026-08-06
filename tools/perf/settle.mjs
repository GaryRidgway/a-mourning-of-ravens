// Does the quality controller converge, or does it hunt?
//
// Adding particle count to the quality curve puts a slow, expensive-to-reverse
// plant inside an integrating control loop, which is the classic recipe for
// oscillation. This samples the level over a long window and reports whether it
// settles: drift over the second half, and peak-to-peak swing once settled.
//
// Usage: node --experimental-websocket settle.mjs [--throttle=8] [--secs=90]

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
const PORT = 8795, DEBUG_PORT = 9338;
const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, ''); const eq = s.indexOf('=');
  return eq < 0 ? [s, 'true'] : [s.slice(0, eq), s.slice(eq + 1)];
}));
const RATE = Number(argv.throttle || 8);
const SECS = Number(argv.secs || 90);
const PAGE = argv.page || '/index.html?debug';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0]));
  try {
    const buf = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-store' }); res.end(buf);
  } catch { res.writeHead(404).end('nope'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'mourn-settle-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${dir}`, '--window-size=1600,900', '--no-first-run', '--hide-scrollbars',
  '--enable-gpu-rasterization', '--use-angle=metal', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page;
for (let i = 0; i < 60 && !page; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
        page = l.find((t) => t.type === 'page'); } catch {}
  if (!page) await sleep(250);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
  return r.result.value; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: 1600, height: 900, deviceScaleFactor: 2, mobile: false });
await send('Emulation.setCPUThrottlingRate', { rate: RATE });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${PAGE}` });
await sleep(2500);
await evaluate(`(async () => {
  for (let i = 0; i < 80; i++) {
    if (typeof startAutoScroll === 'function' && window.__mournQuality) { startAutoScroll(0.3); return 'ok'; }
    await new Promise(r => setTimeout(r, 250));
  } return 'timeout'; })()`);

await evaluate(`(() => {
  window.__trace = [];
  setInterval(() => {
    const q = window.__mournQuality;
    if (!q) return;
    window.__trace.push([performance.now(), q.level, q.effective.particleSimFraction,
                         q.effective.particleRenderFraction, q.avgFrameMs]);
  }, 250);
  return true; })()`);
// --release: run throttled for the first half, then lift the throttle. Checks
// that the sim fraction climbs back rather than latching at its low-water mark.
if (argv.release) {
  await sleep((SECS / 2) * 1000);
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`(throttle released to 1x at t=${SECS / 2}s)`);
  await sleep((SECS / 2) * 1000);
} else {
  await sleep(SECS * 1000);
}

const trace = JSON.parse(await evaluate('JSON.stringify(window.__trace)'));
const t0 = trace[0][0];
const rel = trace.map(([t, lvl, sf, rf, ms]) => ({ t: (t - t0) / 1000, lvl, sf, rf, ms }));
const half = rel.filter((r) => r.t > SECS / 2);
const lvls = half.map((r) => r.lvl);
const sfs = half.map((r) => r.sf);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const firstQ = lvls.slice(0, Math.floor(lvls.length / 2));
const lastQ = lvls.slice(Math.floor(lvls.length / 2));

console.log(`\nthrottle ${RATE}x, ${SECS}s\n`);
console.log('  t(s)   level   simFrac  rendFrac  avgFrameMs');
for (let i = 0; i < rel.length; i += Math.max(1, Math.floor(rel.length / 18))) {
  const r = rel[i];
  console.log(`  ${r.t.toFixed(0).padStart(4)}   ${r.lvl.toFixed(3)}   ${r.sf.toFixed(3)}    ${r.rf.toFixed(3)}     ${r.ms.toFixed(1)}`);
}
console.log(`\nsecond half:  level mean ${mean(lvls).toFixed(3)}  min ${Math.min(...lvls).toFixed(3)}  max ${Math.max(...lvls).toFixed(3)}  peak-to-peak ${(Math.max(...lvls) - Math.min(...lvls)).toFixed(3)}`);
console.log(`              simFrac mean ${mean(sfs).toFixed(3)}  peak-to-peak ${(Math.max(...sfs) - Math.min(...sfs)).toFixed(3)}`);
console.log(`              drift (last quarter mean - third quarter mean): ${(mean(lastQ) - mean(firstQ)).toFixed(4)}`);
console.log(`              avg frame ms mean ${mean(half.map((r) => r.ms)).toFixed(2)} (target ${(1000 / 30).toFixed(2)})`);

ws.close(); chrome.kill(); server.close();
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
