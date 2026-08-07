// Does accumulated ink survive a pixel-density change?
//
// Resizing a canvas element clears it. applyPixelDensity(true) is supposed to
// snapshot, resize, and paint back. This measures how much of the field is
// still there one frame after a step — a wipe reads as near-zero.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8798, DEBUG_PORT = 9342;
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
const dir = mkdtempSync(join(tmpdir(), 'inkcarry-'));
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
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description);
  return r.result.value; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: 1600, height: 900, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?debug` });
await sleep(12000); // let a real field of ink build up

// Mean alpha of the three canvases, which is the ink actually deposited.
const measure = `(() => {
  const els = [mainCanvasElt, fgGraphics.canvas, inkBGraphics.canvas];
  const out = [];
  for (const el of els) {
    const t = document.createElement('canvas');
    t.width = Math.min(800, el.width); t.height = Math.min(450, el.height);
    const c = t.getContext('2d');
    c.drawImage(el, 0, 0, t.width, t.height);
    const d = c.getImageData(0, 0, t.width, t.height).data;
    let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i];
    out.push(a / (d.length / 4));
  }
  return out;
})()`;

// All in one evaluation, with no await between the measurements. The foreground
// layer fades at 36/255 per frame and is empty inside a second, so anything that
// lets frames run between the before and after reading measures that fade rather
// than the resize.
const MEASURE = measure.slice('(() => {'.length, -'})()'.length);
const r = await ev(`(() => {
  const measure = () => { ${MEASURE} };
  const before = measure();
  autoPixelDensityStep = 1;
  const changed = applyPixelDensity(true);
  const after = measure();
  // Control: the same step with preservation off must wipe all three.
  autoPixelDensityStep = 2;
  applyPixelDensity(false);
  const wiped = measure();
  autoPixelDensityStep = 0;
  applyPixelDensity(false);
  return { before, after, wiped, changed, density: pixelDensity() };
})()`);
const { before, after, wiped, changed, density } = r;

// A channel with no ink in it to begin with cannot demonstrate anything either
// way. The foreground layer fades at 36/255 a frame and is routinely empty, so
// asserting on it measures the fade, not the resize.
const EMPTY = 0.05;
const pct = (b, a) => b.map((v, i) => (v <= EMPTY ? 'n/a' : ((a[i] / v) * 100).toFixed(1) + '%'));
console.log(`canvases resized: ${changed}`);
console.log(`mean alpha before          [main, fg, inkB] = ${before.map((v) => v.toFixed(2)).join(', ')}`);
console.log(`ink retained WITH preservation:               ${pct(before, after).join(', ')}`);
console.log(`ink retained WITHOUT (control):               ${pct(before, wiped).join(', ')}`);
const tested = before.map((v, i) => [v, i]).filter(([v]) => v > EMPTY);
const ok = tested.length > 0 && tested.every(([v, i]) => (after[i] / v) * 100 > 70);
console.log(`(channels with no ink to begin with are skipped: ${before.filter((v) => v <= EMPTY).length} of 3)`);
console.log(ok ? 'PASS — ink carried across the resize' : 'FAIL — ink lost');
ws.close(); chrome.kill(); server.close();
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
