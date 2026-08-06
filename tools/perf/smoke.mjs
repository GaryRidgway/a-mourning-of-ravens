// Smoke test: load a page, run it for a while, report any console error,
// uncaught exception or failed request. Usage:
//   node --experimental-websocket smoke.mjs "/index.html?debug"
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
const PORT = 8794, DEBUG_PORT = 9337;
const PAGE = process.argv[2] || '/index.html?debug';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const missing = [];
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0]));
  try {
    const buf = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-store' });
    res.end(buf);
  } catch { missing.push(path); res.writeHead(404).end('nope'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'mourn-smoke-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${dir}`, '--window-size=1600,900', '--no-first-run',
  '--hide-scrollbars', '--enable-gpu-rasterization', '--use-angle=metal',
  'about:blank'], { stdio: 'ignore' });
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
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description
      || m.params.exceptionDetails.text));
  }
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
  return r.result.value;
};

await send('Page.enable'); await send('Runtime.enable');
const DPR = Number(process.argv[3] || 1);
await send('Emulation.setDeviceMetricsOverride',
  { width: 1600, height: 900, deviceScaleFactor: DPR, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${PAGE}` });
await sleep(8000);

const state = await evaluate(`JSON.stringify({
  frameCount: typeof frameCount === 'number' ? frameCount : -1,
  particles: typeof particles !== 'undefined' ? particles.length : -1,
  density: typeof pixelDensity === 'function' ? pixelDensity() : -1,
  fgDensity: typeof fgGraphics !== 'undefined' && fgGraphics ? fgGraphics._pixelDensity : -1,
  inkBDensity: typeof inkBGraphics !== 'undefined' && inkBGraphics ? inkBGraphics._pixelDensity : -1,
  maxPixelDensity: typeof CONFIG === 'object' ? CONFIG.maxPixelDensity : null,
  panelRow: !!document.querySelector('[data-key="maxPixelDensity"]'),
  panelValue: (document.querySelector('[data-key="maxPixelDensity"]') || {}).value ?? null,
  hud: (document.getElementById('perf-hud') || {}).textContent || null,
  overlayNodes: document.querySelectorAll('.flow-box-overlay__box').length,
  mainAlpha: drawingContext.globalAlpha,
})`);
console.log(`PAGE ${PAGE}`);
console.log(JSON.parse(state));
console.log('missing files:', missing);
console.log('console errors/warnings:', logs.length ? logs : 'none');

ws.close(); chrome.kill(); server.close();
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
