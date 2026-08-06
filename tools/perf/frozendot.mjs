// Regression test for the inverted-fraction bug: force the effective fractions
// into the state a recovery produces (sim well below render) and count how many
// frozen particles get drawn. Must be zero.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8797, DEBUG_PORT = 9341;
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
const dir = mkdtempSync(join(tmpdir(), 'frozendot-'));
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
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?debug&lockQualityLevel=1` });
await sleep(4000);

// Cull hard so the flags get set, then re-open render while sim stays low —
// exactly the state a recovery passes through.
await ev(`(() => { const q = window.__mournQuality;
  q.effective.particleSimFraction = q.target.particleSimFraction = 0.38;
  q.effective.particleRenderFraction = q.target.particleRenderFraction = 0.34;
  return true; })()`);
await sleep(1500);
const r = await ev(`(async () => {
  const q = window.__mournQuality;
  q.effective.particleRenderFraction = q.target.particleRenderFraction = 0.95;
  // Count draws attributable to particles the sim has frozen.
  let frozenDrawn = 0, totalDrawn = 0;
  const orig = window.strokeSegment;
  let current = null;
  const origRender = window.renderParticles;
  window.strokeSegment = function (...a) { totalDrawn++; if (current && current.simCulled) frozenDrawn++; return orig.apply(this, a); };
  const origGetInterp = window.getInterpolatedParticlePosition;
  window.getInterpolatedParticlePosition = function (p) { current = p; return origGetInterp.call(this, p); };
  await new Promise((r) => setTimeout(r, 600));
  window.strokeSegment = orig; window.getInterpolatedParticlePosition = origGetInterp;
  let culled = 0; for (const p of particles) if (p.simCulled) culled++;
  return { frozenDrawn, totalDrawn, culled,
           sim: q.effective.particleSimFraction, rend: q.effective.particleRenderFraction };
})()`);
console.log(`effective simFrac ${r.sim.toFixed(2)} < rendFrac ${r.rend.toFixed(2)}  (the inverted state)`);
console.log(`frozen particles: ${r.culled};  segments drawn: ${r.totalDrawn};  drawn BY frozen particles: ${r.frozenDrawn}`);
console.log(r.frozenDrawn === 0 ? 'PASS — no frozen particle drew' : `FAIL — ${r.frozenDrawn} stationary dots`);
ws.close(); chrome.kill(); server.close();
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
