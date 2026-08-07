// Why do the words look jumpy on a weak machine?
//
// "Jumpy" is a property of POSITION OVER TIME, not of frame time, and the two
// come apart. A page can hold 60 fps and still judder if the per-frame step is
// uneven, and it can drop to 30 fps and look perfectly smooth if every step is
// the same size. So this samples the poem's own offset once per frame and looks
// at the steps, with frame time carried alongside.
//
// The poem moves by exactly one number: --left-active-offset on #anchor, set by
// setAnchorOffsets() at the end of every draw(). Everything visible about the
// scroll is downstream of it, so sampling it costs nothing and misses nothing.
//
// Three separable causes, and the arms are chosen to tell them apart:
//
//   1. QUANTISATION. snapOffset() rounds the offset to 0.1px before writing it.
//      At the shipped speed the poem advances ~0.2px/frame, so a 0.1px grid is
//      a coarse grid — steps land on 0.2 or 0.3 and the ratio between them is
//      the judder. This gets WORSE the smoother the machine, not better.
//   2. PACING. If step size tracks frame delta, motion is time-correct and the
//      unevenness is the frame times themselves. residual% separates these:
//      it is the part of the step that frame delta does not explain.
//   3. REPAINT. The poem is a promoted layer full of blurred, texture-clipped
//      text. If raster cannot keep up with the scroll the words strobe rather
//      than stutter. The no-shadow and no-texture arms price that.
//
//   node --experimental-websocket tools/perf/judder.mjs --nogpu --throttle=4
//   node --experimental-websocket tools/perf/judder.mjs --throttle=6 --speed=0.1

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
const PORT = 8803;
const DEBUG_PORT = 9348;

const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const eq = s.indexOf('=');
  return eq < 0 ? [s, 'true'] : [s.slice(0, eq), s.slice(eq + 1)];
}));
const RATE = Number(argv.throttle || 1);
const DPR = Number(argv.dpr || 2);
const SPEED = argv.speed === undefined ? null : Number(argv.speed);
const WARMUP_MS = Number(argv.warmup || 8000);
const SAMPLE_MS = Number(argv.sample || 12000);

// Each arm removes exactly one suspect and leaves everything else alone.
// 'base' runs first and last: the gap between the two readings is the noise
// floor, and any arm that moves less than that has not moved.
// Two of these put back behaviour the scroll used to have, so a run doubles as
// a regression test on the fixes rather than only a hunt for the next problem.
const ALL_ARMS = [
  'base',
  'no snap',      // snapOffset -> identity. Should now be indistinguishable.
  'coarse snap',  // the old 0.1px rounding grid.
  'flat 50',      // the old constant delta cap.
  'old scroll',   // both of the above — the before picture, in one arm.
  'no shadow',    // --word-shadow: none. Isolates blur raster cost.
  'no texture',   // background-clip:text off. Isolates the text raster path.
  'no willchange',// drops the promoted layer. Isolates compositing choice.
  'base#2',
];
// --arms=base,no snap  keeps a throttle sweep short.
const ARMS = argv.arms ? argv.arms.split(',') : ALL_ARMS;

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

const profileDir = mkdtempSync(join(tmpdir(), 'mourn-judder-'));
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

// Adaptive quality off: it reacts to frame time by shrinking the particle
// field, which would quietly change the plant underneath the arms.
const PAGE = '/index.html?debug&enableAdaptiveQuality=0&enableAutoPixelDensity=0';
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${PAGE}` });
await sleep(2500);

const setup = await evaluate(`
  (async () => {
    for (let i = 0; i < 80; i++) {
      if (typeof startAutoScroll === 'function' && window.__mournQuality) break;
      await new Promise(r => setTimeout(r, 250));
    }
    if (typeof startAutoScroll !== 'function') return { ok: false, why: 'never booted' };

    const speed = ${SPEED === null ? 'CONFIG.autoScrollSpeed' : SPEED};
    startAutoScroll(speed);

    const anchorStyle = mourn.trackers.anchorStyle;
    const readL = () => parseFloat(anchorStyle.getPropertyValue('--left-active-offset')) || 0;
    const readT = () => parseFloat(anchorStyle.getPropertyValue('--top-active-offset')) || 0;

    // The words exist twice: as DOM text moved by a CSS transform, and as
    // canvas-side collider boxes that punch the ink out from under them and
    // carry the box glow. Those two are driven by DIFFERENT rAF callbacks —
    // draw() moves the text, a separate queued rAF calls setFlowBoxes — so they
    // can slide against each other. A constant lag is invisible. A lag that
    // changes size frame to frame makes the hole in the ink breathe around the
    // letter, which is a thing you would call strobing and not stuttering.
    // slip = how far the text has moved since the boxes last agreed with it.
    let lastSyncLeft = readL();
    const origSetFlowBoxes = window.setFlowBoxes;
    window.setFlowBoxes = function (...a) {
      lastSyncLeft = readL();
      return origSetFlowBoxes.apply(this, a);
    };

    // Sample at the END of draw(): setAnchorOffsets() has run by then, so the
    // number read is the one this frame will actually be composited with.
    const B = window.__j = { t: [], l: [], tp: [], draw: [], slip: [] };
    const origDraw = window.draw;
    window.draw = function (...a) {
      const t0 = performance.now();
      const r = origDraw.apply(this, a);
      B.draw.push(performance.now() - t0);
      B.t.push(t0);
      const l = readL();
      B.l.push(l);
      B.tp.push(readT());
      B.slip.push(l - lastSyncLeft);
      return r;
    };
    window.__jReset = () => {
      for (const k of Object.keys(B)) B[k].length = 0;
    };

    // --- arm switches -------------------------------------------------------
    // snapOffset is a top-level function in a classic script, so it lives on
    // window and can be swapped without touching the source.
    const realSnap = window.snapOffset;
    const rootStyle = document.documentElement.style;
    const container = document.getElementById('poem-container');
    const anchor = mourn.trackers.anchor;
    const realWordShadow = getComputedStyle(document.documentElement)
      .getPropertyValue('--word-shadow');

    // tickAutoScroll caps the frame delta so a stalled tab cannot teleport the
    // poem. The cap is max(50ms, median frame x multiple), so a multiple of 0
    // pins it at the 50ms floor — which is exactly the flat cap this used to
    // have. No patching needed: the old behaviour is a value of the new knob.
    const realCapMultiple = CONFIG.autoScrollDeltaCapMultiple;

    window.__armSet = (name) => {
      const old = name === 'old scroll';
      window.snapOffset =
        name === 'no snap' ? ((v) => v)
        : (old || name === 'coarse snap') ? ((v) => realSnap(v, 10))
        : realSnap;
      CONFIG.autoScrollDeltaCapMultiple =
        (old || name === 'flat 50') ? 0 : realCapMultiple;
      rootStyle.setProperty('--word-shadow',
        name === 'no shadow' ? 'none' : realWordShadow);
      container.classList.toggle('text-texture-off', name === 'no texture');
      anchor.style.willChange = name === 'no willchange' ? 'auto' : '';
      return true;
    };

    const spans = document.querySelectorAll('#poem-container .stanza span').length;
    return {
      ok: true, spans, speed,
      pxPerSec: speed * 120 * mourn.trackers.scrollSpeedMultiplier,
      shadow: realWordShadow.trim() || 'none',
      density: pixelDensity(),
    };
  })()`);

if (!setup.ok) throw new Error('judder setup failed: ' + setup.why);
console.log(`page ready — ${setup.spans} spans, scroll speed ${setup.speed} ` +
            `= ${setup.pxPerSec.toFixed(1)} px/s`);
console.log(`word shadow: ${setup.shadow}`);
console.log(`density ${setup.density}, dpr ${DPR}, cpu ${RATE}x, ` +
            `gpu ${argv.nogpu ? 'software' : 'hardware'}`);

await sleep(WARMUP_MS);

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: xs.length, mean, p50: q(0.5), p95: q(0.95), min: s[0], max: s[s.length - 1] };
};

const rows = [];
for (const name of ARMS) {
  await evaluate(`window.__armSet(${JSON.stringify(name)})`);
  await sleep(1500);                      // let raster and the compositor settle
  await evaluate('window.__jReset()');
  await sleep(SAMPLE_MS);
  const raw = await evaluate('JSON.stringify(window.__j)');
  const d = JSON.parse(raw);

  // Horizontal only, on purpose. The vertical offset is the horizontal one
  // times the current stanza's slope, and the slope changes from stanza to
  // stanza — so a 2D step would fold stanza changes into the timing signal.
  // d(--left-active-offset) is the scroll delta itself, with nothing added.
  const steps = [];      // px the poem moved this frame
  const deltas = [];     // ms this frame took
  for (let i = 1; i < d.t.length; i++) {
    const dt = d.t[i] - d.t[i - 1];
    if (dt <= 0) continue;
    steps.push(Math.abs(d.l[i] - d.l[i - 1]));
    deltas.push(dt);
  }

  const st = stats(steps);
  const dt = stats(deltas);
  // Judder is unevenness of the STEP, so the coefficient of variation is the
  // headline: 0% is a metronome, and the eye starts noticing well before 30%.
  const sd = Math.sqrt(steps.reduce((a, x) => a + (x - st.mean) ** 2, 0) / steps.length);
  const cv = sd / st.mean * 100;
  // A frame the poem did not move on at all. Two of these in a row next to a
  // double-size step is what reads as a strobe rather than a stutter.
  const frozen = steps.filter((x) => x < 1e-9).length / steps.length * 100;

  // The poem is meant to travel at a constant NOMINAL px/s in wall-clock time.
  // Everything below is measured against that intent rather than against the
  // run's own average, because a run that is uniformly 46% slow has a real
  // problem that a self-referential metric would score as perfect.
  const nominal = setup.pxPerSec;
  const wantStep = deltas.map((ms) => nominal * ms / 1000);
  const errPx = steps.map((s, i) => s - wantStep[i]);
  const lossPct = (1 - st.mean / (nominal * dt.mean / 1000)) * 100;
  // Frames long enough for tickAutoScroll's 50ms cap to bite. On those the poem
  // is told less time passed than did, so it under-travels exactly when a
  // smooth-pursuing eye expects it to travel furthest.
  const clampedPct = deltas.filter((ms) => ms > 50).length / deltas.length * 100;
  const errAbs = stats(errPx.map(Math.abs));
  const dr = stats(d.draw);
  // Only the SWING in slip matters. A steady one-frame lag between the text and
  // its ink hole is a fixed sub-pixel offset nobody can see; a swing is the hole
  // moving relative to the letter while the letter is still.
  const sl = stats(d.slip.slice(1));
  const slipSwing = sl.max - sl.min;

  rows.push({ name, st, dt, cv, frozen, lossPct, clampedPct, errAbs, slipSwing, dr,
              fps: 1000 / dt.mean });
  console.log(
    `${name.padEnd(13)} fps=${(1000 / dt.mean).toFixed(1).padStart(5)}  ` +
    `step mean=${st.mean.toFixed(3)} [${st.min.toFixed(3)}..${st.max.toFixed(3)}]  ` +
    `CV=${cv.toFixed(1).padStart(5)}%  frozen=${frozen.toFixed(1)}%  ` +
    `slow=${lossPct.toFixed(1).padStart(5)}%  clamped=${clampedPct.toFixed(0).padStart(3)}%  ` +
    `err p95=${errAbs.p95.toFixed(3)}px  slipswing=${slipSwing.toFixed(2)}px  ` +
    `draw p50=${dr.p50.toFixed(2)}`
  );
}

// --arms can drop the repeat baseline, in which case there is no noise floor to
// compare against and the per-arm verdicts are not earned. Print the rows and
// stop rather than dressing up a single reading as a comparison.
const base = rows.find((r) => r.name === 'base');
const base2 = rows.find((r) => r.name === 'base#2');
if (!base || !base2) {
  console.log('\n(no baseline pair in this run — rows above only, no verdicts)');
  ws.close(); chrome.kill(); server.close();
  try { rmSync(profileDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch {}
  process.exit(0);
}
// Rank on POSITION ERROR, not on step evenness, and the 'flat 50' arm is why.
// It pins the delta cap at a constant, so every frame gets an identical step
// and its CV is a perfect 0.0% — while the poem travels at half the speed it
// was asked for. Step evenness alone scores that as the best arm in the run.
// Distance from where the poem should be catches it; evenness never will.
// CV is still worth printing: once the position is right it is the only thing
// left that separates smooth motion from correct-but-lumpy motion.
const floor = Math.abs(base2.errAbs.p95 - base.errAbs.p95);
console.log(`\nnoise floor (base measured twice): ${floor.toFixed(3)} px of position ` +
            `error — arms that move less than this have not moved`);
for (const r of rows) {
  if (r.name.startsWith('base')) continue;
  const d = r.errAbs.p95 - base.errAbs.p95;
  const verdict = Math.abs(d) <= floor ? 'within noise'
    : (d > 0 ? 'WORSE — falls behind where it should be' : 'closer to time-correct');
  console.log(`  ${r.name.padEnd(13)} err ${d >= 0 ? '+' : ''}${d.toFixed(3)}px  ` +
              `slow ${r.lossPct.toFixed(1)}%  CV ${r.cv.toFixed(1)}%  ` +
              `fps ${(r.fps - base.fps >= 0 ? '+' : '')}${(r.fps - base.fps).toFixed(1)}  ${verdict}`);
}

ws.close();
chrome.kill();
server.close();
// Chrome is still flushing its profile when kill() returns, so rmSync races it
// and throws ENOTEMPTY. Retries usually win; a leftover temp dir is not worth
// failing a run that already printed its results.
try {
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
} catch {}
process.exit(0);
