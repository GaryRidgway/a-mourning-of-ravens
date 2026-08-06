// Headless-Chrome benchmark for a-mourning-of-ravens.
//
// Drives the real page over CDP, throttles the CPU to stand in for weaker show
// hardware, and reports what the sim itself is doing (internal frame ms, the
// adaptive quality level it had to settle at) rather than the vsync-paced rAF
// rate, which just reports the display.
//
// Usage: node --experimental-websocket bench.mjs [--throttle=1,4,6] [--label=x]

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
const PORT = 8791;
const DEBUG_PORT = 9333;

const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const eq = s.indexOf('=');
  return eq < 0 ? [s, 'true'] : [s.slice(0, eq), s.slice(eq + 1)];
}));
const RATES = (argv.throttle || '1,4,6').split(',').map(Number);
const LABEL = argv.label || 'run';
const WARMUP_MS = Number(argv.warmup || 12000);
const SAMPLE_MS = Number(argv.sample || 20000);
const PAGE = argv.page || '/index.html?debug';
const DPR = Number(argv.dpr || 2);

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

const profileDir = mkdtempSync(join(tmpdir(), 'mourn-bench-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profileDir}`,
  '--window-size=1600,900',
  '--no-first-run',
  '--disable-extensions',
  '--hide-scrollbars',
  // Real GPU compositing matters here: the piece is fill-rate heavy and a
  // software rasteriser would measure the wrong thing entirely.
  '--enable-gpu-rasterization',
  '--use-angle=metal',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTargets() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome never came up');
}

const target = await cdpTargets();
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

// The in-page probe. Frame deltas are vsync-paced, so on a machine with
// headroom they report the display and say nothing about cost. What actually
// decides how much of the piece a weak machine gets to see is CPU time spent
// inside draw(), so wrap draw and its phases and time them directly.
const PROBE = `
(() => {
  const B = window.__bench = { draw: [], levels: [], rafs: [], phase: {} };
  const PHASES = ['fadeCanvas', 'eraseInkUnderBoxes', 'updateBoxes',
                  'updateParticles', 'renderParticles', 'renderBoxes'];
  for (const name of PHASES) {
    const orig = window[name];
    if (typeof orig !== 'function') continue;
    B.phase[name] = [];
    window[name] = function (...a) {
      const t0 = performance.now();
      const r = orig.apply(this, a);
      B.phase[name].push(performance.now() - t0);
      return r;
    };
  }
  const origDraw = window.draw;
  window.draw = function (...a) {
    const t0 = performance.now();
    const r = origDraw.apply(this, a);
    B.draw.push(performance.now() - t0);
    const q = window.__mournQuality;
    if (q) B.levels.push(q.level);
    return r;
  };
  let last = performance.now();
  const tick = (t) => { B.rafs.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  return true;
})()`;

const stats = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: xs.length, mean, p50: q(0.5), p95: q(0.95), max: s[s.length - 1] };
};

const results = [];
for (const rate of RATES) {
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(400);
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1600, height: 900, deviceScaleFactor: DPR, mobile: false,
  });
  await send('Emulation.setCPUThrottlingRate', { rate });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${PAGE}` });
  await sleep(2000);
  // Auto-scroll is the load case that matters: colliders move every frame, so
  // the box grid rebuilds and the ink-erase pass has work to do.
  await evaluate(`
    (async () => {
      for (let i = 0; i < 80; i++) {
        if (typeof startAutoScroll === 'function' && window.__mournQuality) {
          startAutoScroll(0.3);
          return 'started';
        }
        await new Promise(r => setTimeout(r, 250));
      }
      return 'timeout';
    })()`);
  await sleep(WARMUP_MS);
  await evaluate(PROBE, false);
  await sleep(SAMPLE_MS);

  const raw = await evaluate(`JSON.stringify({
    draw: window.__bench.draw,
    phase: window.__bench.phase,
    level: window.__bench.levels,
    raf: window.__bench.rafs,
    particles: (typeof particles !== 'undefined') ? particles.length : -1,
    scale: (typeof currentRenderScale !== 'undefined') ? currentRenderScale : -1,
    density: (typeof pixelDensity === 'function') ? pixelDensity() : -1,
    canvas: (typeof width !== 'undefined') ? [width, height] : [-1, -1],
    dpr: window.devicePixelRatio,
    heap: performance.memory ? performance.memory.usedJSHeapSize : -1,
  })`);
  const d = JSON.parse(raw);
  const draw = stats(d.draw);
  const level = stats(d.level);
  const raf = stats(d.raf);
  const phase = {};
  for (const [k, v] of Object.entries(d.phase)) phase[k] = stats(v);
  results.push({ rate, draw, phase, level, raf, particles: d.particles,
                 scale: d.scale, density: d.density, canvas: d.canvas, heap: d.heap });
  console.log(
    `[${LABEL}] cpu=${rate}x  draw p50=${draw.p50.toFixed(2)}ms ` +
    `mean=${draw.mean.toFixed(2)}ms p95=${draw.p95.toFixed(2)}ms  ` +
    `quality=${level.mean.toFixed(3)}  rafMean=${raf.mean.toFixed(1)}ms  ` +
    `n=${d.particles} density=${d.density} canvas=${d.canvas.join('x')} ` +
    `heap=${(d.heap / 1048576).toFixed(1)}MB`
  );
  const parts = Object.entries(phase)
    .sort((a, b) => b[1].mean - a[1].mean)
    .map(([k, s]) => `${k} ${s.mean.toFixed(2)}`)
    .join('  ');
  console.log(`         phases(mean ms): ${parts}`);
}

console.log('\nJSON:' + JSON.stringify({ label: LABEL, page: PAGE, results }));

ws.close();
chrome.kill();
server.close();
try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
process.exit(0);
