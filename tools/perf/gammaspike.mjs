// Does an SVG gamma filter on the background canvas cost anything?
//
// The shorthand filters already on #poem-bg canvas (contrast/brightness) compile
// to a colour matrix that Chrome fuses into compositing it is doing anyway. A
// url(#...) filter goes down a different path in Skia, and the risk is not the
// gamma primitive itself — it is that referencing one makes Chrome abandon the
// fused fast path for the whole chain. That is a step change, not a small extra
// cost, so it has to be measured rather than reasoned about.
//
// Method: one page, one particle population, filter swapped between arms. The
// adaptive quality controller is switched OFF so the workload is identical in
// every arm — otherwise the piece absorbs the cost by shedding particles and
// the frame time comes out flat no matter what the answer is.
//
// The metric is NOT time inside draw(). Filter cost lands in raster and
// compositing, not in JS, so draw() is carried here as a control: it should be
// flat across arms, and if it is not, something else is drifting and the run is
// void. The real signal is rAF delta — when the compositor cannot finish inside
// a vsync interval, frames are dropped and the deltas grow.
//
//   node --experimental-websocket tools/perf/gammaspike.mjs --nogpu
//   node --experimental-websocket tools/perf/gammaspike.mjs --throttle=6

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Unique across tools/perf so two of them can run concurrently.
const PORT = 8800;
const DEBUG_PORT = 9344;

const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const eq = s.indexOf('=');
  return eq < 0 ? [s, 'true'] : [s.slice(0, eq), s.slice(eq + 1)];
}));
const RATE = Number(argv.throttle || 1);
const DPR = Number(argv.dpr || 2);
const WARMUP_MS = Number(argv.warmup || 12000);
const SAMPLE_MS = Number(argv.sample || 12000);
const GAMMA = argv.gamma || '0.7';
const BLACK_POINT = Number(argv.black || 0.1667);
const TONE_GAMMA = Number(argv.tone || 0.55);

// A type="table" transfer is an arbitrary per-channel tone curve, linearly
// interpolated between the entries. That matters more than it sounds: the black
// point, the mid lift and the highlight roll-off can all live in ONE primitive,
// where the shorthand chain needs a separate pass per function. Same look,
// fewer passes — and unlike brightness() it can approach white asymptotically
// instead of clipping to it.
// 33 entries, not 17. The table is linearly interpolated between entries, so a
// coarse table approximates the curve with straight segments — and straight
// segments joined at angles are exactly what the eye picks up as banding on the
// smooth dark gradients this piece is mostly made of. 33 is cheap insurance.
function toneTable(blackPoint, gamma, n = 33) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const u = Math.max(0, (x - blackPoint) / (1 - blackPoint));
    out.push(Math.pow(u, gamma).toFixed(4));
  }
  return out.join(' ');
}
const TABLE = toneTable(BLACK_POINT, TONE_GAMMA);

// Filter region defaults to -10%,-10%,120%,120%, which on a fullscreen canvas
// asks Chrome for a surface 44% larger in pixels than the thing being filtered.
// Pinning it to the element's own box is free and removes that.
const SVG_DEFS = `
<svg id="bg-filters" aria-hidden="true"
     style="position:absolute;width:0;height:0;overflow:hidden">
  <filter id="bg-gamma" color-interpolation-filters="sRGB"
          x="0%" y="0%" width="100%" height="100%">
    <feComponentTransfer>
      <feFuncR type="gamma" amplitude="1" exponent="${GAMMA}" offset="0"/>
      <feFuncG type="gamma" amplitude="1" exponent="${GAMMA}" offset="0"/>
      <feFuncB type="gamma" amplitude="1" exponent="${GAMMA}" offset="0"/>
    </feComponentTransfer>
  </filter>

  <filter id="bg-tone" color-interpolation-filters="sRGB"
          x="0%" y="0%" width="100%" height="100%">
    <feComponentTransfer>
      <feFuncR type="table" tableValues="${TABLE}"/>
      <feFuncG type="table" tableValues="${TABLE}"/>
      <feFuncB type="table" tableValues="${TABLE}"/>
    </feComponentTransfer>
  </filter>
</svg>`;

// Ordered so the baseline is measured twice, first and last. Any difference
// between those two readings is drift, and bounds how much of the spread
// between the middle arms is real.
const ARMS = [
  ['baseline',   'contrast(1.5) brightness(2)'],
  ['no filter',  'none'],
  ['gamma only', 'url(#bg-gamma)'],
  ['proposal',   'contrast(1.5) url(#bg-gamma)'],
  ['everything', 'contrast(1.5) brightness(1.3) saturate(1.1) url(#bg-gamma)'],
  ['tone curve', 'url(#bg-tone)'],
  ['tone+sat',   'saturate(1.1) url(#bg-tone)'],
  // The selector in poem.scss is `#poem-bg canvas`, and three canvases live in
  // there — main, ink B and foreground. So the chain is not paid once a frame,
  // it is paid three times. Filtering the wrapper instead pays it once. That is
  // not a free swap: filter-then-composite and composite-then-filter are
  // different pictures when the transfer is non-linear, so it has to be looked
  // at as well as measured. Arms prefixed "wrap:" put the filter on #poem-bg
  // and clear it from the canvases.
  ['wrap:tone',  '@wrap url(#bg-tone)'],
  ['wrap:now',   '@wrap contrast(1.5) brightness(2)'],
  ['baseline#2', 'contrast(1.5) brightness(2)'],
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0]));
  try {
    const buf = await readFile(join(ROOT, path));
    res.writeHead(200, {
      'Content-Type': MIME[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  } catch {
    res.writeHead(404).end('nope');
  }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const profileDir = mkdtempSync(join(tmpdir(), 'mourn-gamma-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profileDir}`,
  '--window-size=1600,900',
  '--no-first-run', '--disable-extensions', '--hide-scrollbars',
  ...(argv.nogpu ? ['--disable-gpu'] : ['--enable-gpu-rasterization', '--use-angle=metal']),
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome never came up');
}

const target = await cdpTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expr, awaitPromise = true) => {
  const r = await send('Runtime.evaluate', {
    expression: expr, awaitPromise, returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || 'eval threw');
  }
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1600, height: 900, deviceScaleFactor: DPR, mobile: false,
});
await send('Emulation.setCPUThrottlingRate', { rate: RATE });

// Adaptive quality and auto density both OFF: they exist to absorb exactly the
// kind of cost this is trying to detect, and would hide it behind a smaller
// particle field instead of a longer frame.
const PAGE = '/index.html?debug&enableAdaptiveQuality=0&enableAutoPixelDensity=0';
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${PAGE}` });
await sleep(2500);

await evaluate(`
  (async () => {
    for (let i = 0; i < 80; i++) {
      if (typeof startAutoScroll === 'function' && window.__mournQuality) {
        startAutoScroll(0.3); return 'started';
      }
      await new Promise(r => setTimeout(r, 250));
    }
    return 'timeout';
  })()`);

const canvasSel = '#poem-bg canvas';
const setup = await evaluate(`
  (() => {
    document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(SVG_DEFS)});
    const wrap = document.getElementById('poem-bg');
    const canvases = () => Array.from(document.querySelectorAll(${JSON.stringify(canvasSel)}));
    if (!canvases().length) return { ok: false, why: 'no canvas' };
    window.__armSet = (v) => {
      const onWrap = v.startsWith('@wrap ');
      const value = onWrap ? v.slice(6) : v;
      // 'none' on the canvases is not the same as removing the inline style:
      // clearing it would let the stylesheet's own chain apply again, which is
      // the very thing a wrap arm is trying to take out of the picture.
      canvases().forEach((c) => { c.style.filter = onWrap ? 'none' : value; });
      wrap.style.filter = onWrap ? value : 'none';
      return { wrap: getComputedStyle(wrap).filter, canvas: getComputedStyle(canvases()[0]).filter };
    };

    const B = window.__g = { draw: [], raf: [] };
    const origDraw = window.draw;
    window.draw = function (...a) {
      const t0 = performance.now();
      const r = origDraw.apply(this, a);
      B.draw.push(performance.now() - t0);
      return r;
    };
    let last = performance.now();
    const tick = (t) => { B.raf.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__gReset = () => { B.draw.length = 0; B.raf.length = 0; };
    const first = canvases()[0];
    return {
      ok: true,
      cssFilter: getComputedStyle(first).filter,
      canvasCount: canvases().length,
      defFound: !!document.getElementById('bg-gamma'),
      density: pixelDensity(),
      backing: [first.width, first.height],
    };
  })()`);

if (!setup.ok) throw new Error('spike setup failed: ' + setup.why);
console.log(`page ready — css filter "${setup.cssFilter}" on ${setup.canvasCount} canvas(es) ` +
            `inside #poem-bg, gamma def present: ${setup.defFound}`);
console.log(`backing store ${setup.backing.join('x')} @ density ${setup.density}, dpr ${DPR}, ` +
            `cpu ${RATE}x, gpu ${argv.nogpu ? 'software' : 'hardware'}, gamma ${GAMMA}`);

await sleep(WARMUP_MS);

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: xs.length, mean, p50: q(0.5), p95: q(0.95) };
};

const rows = [];
for (const [name, value] of ARMS) {
  const applied = await evaluate(`window.__armSet(${JSON.stringify(value)})`);
  await sleep(1500);                       // let the compositor re-settle
  await evaluate('window.__gReset()');
  await sleep(SAMPLE_MS);
  const raw = await evaluate(`JSON.stringify({
    draw: window.__g.draw, raf: window.__g.raf,
    n: (typeof particles !== 'undefined') ? particles.length : -1,
  })`);
  const d = JSON.parse(raw);
  const draw = stats(d.draw);
  const raf = stats(d.raf);
  // A dropped frame shows up as a delta near a multiple of the vsync interval.
  const longFrames = d.raf.filter((x) => x > 20).length / d.raf.length * 100;
  const fps = 1000 / raf.mean;
  rows.push({ name, value, applied, draw, raf, longFrames, fps, n: d.n });
  console.log(
    `${name.padEnd(11)} fps=${fps.toFixed(1).padStart(5)}  ` +
    `raf mean=${raf.mean.toFixed(2)} p95=${raf.p95.toFixed(2)}  ` +
    `long=${longFrames.toFixed(1)}%  draw p50=${draw.p50.toFixed(2)}  n=${d.n}`
  );
}

const base = rows.find((r) => r.name === 'baseline');
const base2 = rows.find((r) => r.name === 'baseline#2');
const drift = Math.abs(base2.raf.mean - base.raf.mean);
console.log(`\nbaseline drift across the run: ${drift.toFixed(2)} ms ` +
            `(differences smaller than this are not real)`);
for (const r of rows) {
  if (r.name.startsWith('baseline')) continue;
  const delta = r.raf.mean - base.raf.mean;
  const verdict = Math.abs(delta) <= drift ? 'within noise' : (delta > 0 ? 'SLOWER' : 'faster');
  console.log(`  ${r.name.padEnd(11)} ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} ms/frame  ${verdict}`);
}
const drawSpread = Math.max(...rows.map((r) => r.draw.p50)) - Math.min(...rows.map((r) => r.draw.p50));
console.log(`\ndraw() spread across arms: ${drawSpread.toFixed(2)} ms ` +
            `(control — should be flat; JS work is identical in every arm)`);

// A timing answer with no picture attached is half an answer — a filter that is
// free and wrong is not a win. Stop the sketch first so every arm is the same
// frame with only the filter changed; capturing a live animation would differ
// between arms for reasons that have nothing to do with the filter.
if (argv.shots) {
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(argv.shots, { recursive: true });
  await evaluate('noLoop(); true');
  await sleep(500);
  for (const [name, value] of ARMS) {
    if (name === 'baseline#2') continue;
    await evaluate(`window.__armSet(${JSON.stringify(value)})`);
    await sleep(350);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(argv.shots, name.replace(/[^a-z0-9]+/gi, '-') + '.png');
    await writeFile(file, Buffer.from(data, 'base64'));
    console.log(`shot: ${file}`);
  }
}

console.log('\nJSON:' + JSON.stringify({ rate: RATE, dpr: DPR, nogpu: !!argv.nogpu, rows }));

ws.close();
chrome.kill();
server.close();
try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
process.exit(0);
