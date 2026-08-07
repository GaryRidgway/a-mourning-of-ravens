// Watch the auto-density controller from the instant the page loads, not after a
// warmup. Startup is the noisiest window the piece ever has — fonts, staging,
// the noise bake and 5000 particle constructions all land there — and a step
// taken then would be a visible resolution change in the first half-minute of a
// show, on a machine that did not need it.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8799, DEBUG_PORT = 9343;
const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, ''); const eq = s.indexOf('=');
  return eq < 0 ? [s, 'true'] : [s.slice(0, eq), s.slice(eq + 1)];
}));
const RATE = Number(argv.throttle || 1);
const SECS = Number(argv.secs || 45);
const PAGE = argv.page || '/index.html?debug';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0]));
  try { const b = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-store' }); res.end(b);
  } catch { res.writeHead(404).end('x'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'cold-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${dir}`, '--window-size=1600,900', '--no-first-run', '--hide-scrollbars',
  ...(argv.nogpu ? ['--disable-gpu'] : ['--enable-gpu-rasterization', '--use-angle=metal']),
  'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page;
for (let i = 0; i < 60 && !page; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    page = l.find((t) => t.type === 'page'); } catch {}
  if (!page) await sleep(250);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: 1600, height: 900, deviceScaleFactor: 2, mobile: false });
await send('Emulation.setCPUThrottlingRate', { rate: RATE });
// Trace installed before any page script, so sampling starts at the true origin.
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__cold = [];
  const t0 = performance.now();
  setInterval(() => {
    const q = window.__mournQuality;
    if (!q) return;
    window.__cold.push([(performance.now() - t0) / 1000, q.level,
      typeof autoPixelDensityStep === 'number' ? autoPixelDensityStep : -1,
      q.avgFrameMs]);
  }, 300);
`});
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${PAGE}` });
await sleep(SECS * 1000);
const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__cold)', returnByValue: true });
const trace = JSON.parse(r.result.value);
console.log(`\nthrottle ${RATE}x${argv.nogpu ? ' (software raster)' : ''}, from page load\n`);
console.log('  t(s)   level   densStep   avgFrameMs');
for (let i = 0; i < trace.length; i += Math.max(1, Math.floor(trace.length / 16))) {
  const [t, lvl, step, ms] = trace[i];
  console.log(`  ${t.toFixed(1).padStart(5)}   ${lvl.toFixed(3)}      ${step}        ${ms.toFixed(1)}`);
}
const steps = trace.filter((x, i) => i > 0 && x[2] !== trace[i-1][2]);
console.log(`\ndensity changes: ${steps.length}${steps.length ? ' at t=' + steps.map((s) => s[0].toFixed(1)).join(', ') : ''}`);
console.log(`peak quality level: ${Math.max(...trace.map((x) => x[1])).toFixed(3)}`);
ws.close(); chrome.kill(); server.close();
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
