// Mass-revival test. Cull hard, let the culled particles sit while the flow
// moves on, then bring them all back at once and check the very next frames for
// streaks — the failure mode where a revived particle draws a line from wherever
// it was frozen to wherever it is now.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8796, DEBUG_PORT = 9340;
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
const dir = mkdtempSync(join(tmpdir(), 'revive-'));
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
  { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?debug&lockQualityLevel=1` });
await sleep(4000);

// Hard cull, held long enough for the survivors to travel a long way.
await ev(`(() => { const q = window.__mournQuality;
  q.effective.particleSimFraction = 0.05; q.target.particleSimFraction = 0.05;
  q.effective.particleRenderFraction = 0.05; q.target.particleRenderFraction = 0.05;
  return true; })()`);
await sleep(6000);

// Measure the distance each culled particle has drifted from its display point,
// then revive everything and instrument the segments actually drawn.
const before = await ev(`(() => {
  let culled = 0, maxGap = 0;
  for (const p of particles) {
    if (!p.simCulled) continue;
    culled++;
    const d = Math.hypot(p.pos.x - p.displayX, p.pos.y - p.displayY);
    if (d > maxGap) maxGap = d;
  }
  return { culled, maxGap };
})()`);

const result = await ev(`(async () => {
  // Wrap the raw context to catch every segment drawn on the next few frames.
  let maxSeg = 0, count = 0;
  const ctxs = [drawingContext, fgGraphics.drawingContext, inkBGraphics.drawingContext];
  const saved = ctxs.map((c) => ({ c, moveTo: c.moveTo, lineTo: c.lineTo }));
  let lx = 0, ly = 0;
  for (const s of saved) {
    s.c.moveTo = function (x, y) { lx = x; ly = y; return s.moveTo.call(this, x, y); };
    s.c.lineTo = function (x, y) {
      const d = Math.hypot(x - lx, y - ly);
      if (d > maxSeg) maxSeg = d;
      count++;
      return s.lineTo.call(this, x, y);
    };
  }
  const q = window.__mournQuality;
  q.effective.particleSimFraction = 1; q.target.particleSimFraction = 1;
  q.effective.particleRenderFraction = 1; q.target.particleRenderFraction = 1;
  await new Promise((r) => setTimeout(r, 500));
  for (const s of saved) { s.c.moveTo = s.moveTo; s.c.lineTo = s.lineTo; }
  return { maxSeg, count };
})()`);

console.log(`culled particles: ${before.culled}, max drift from display point while culled: ${before.maxGap.toFixed(1)} px`);
console.log(`after mass revive: ${result.count} segments drawn, longest ${result.maxSeg.toFixed(2)} px`);
console.log(`MAX_RENDER_SEGMENT_LENGTH_PX is 12; anything near the drift figure would be a streak`);
console.log(result.maxSeg <= 40 ? 'PASS — no streaks' : 'FAIL — streaking on revive');

ws.close(); chrome.kill(); server.close();
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
