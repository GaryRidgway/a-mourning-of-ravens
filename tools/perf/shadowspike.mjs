// What does the word shadow actually cost?
//
// enableWordShadow puts TWO stacked drop-shadow() filters on every .stanza span:
//
//   drop-shadow(0 0 {blur}px c) drop-shadow(0 0 {blur*2.5}px c)
//
// Three things make that worth measuring rather than guessing:
//
//   1. Gaussian blur is the most expensive filter primitive there is, and the
//      cost scales with the blur radius, not with how much ink is in the glyph.
//      The second shadow is 2.5x the radius of the first.
//   2. It is per SPAN, not per stanza. The ring seeds several cycles of stanzas
//      into the DOM, so the number of filtered elements is not the number of
//      words in the poem — the tool reports the live count.
//   3. A filter on a static element is rasterised once and reused. This one is
//      not static: scroll.js rewrites --left-offset/--top-offset on the stanzas
//      as the poem moves, so the spans are repainted while the piece is running
//      and the blur has to be redone. Measuring it on a parked poem would
//      report zero and be wrong, so the auto-scroll is started first.
//
// The metric is rAF delta, not draw(). Blur lands in raster, not in JS, so
// draw() is carried as a control: it should be flat across every arm, and if it
// is not then something other than the filter is drifting and the run is void.
//
//   node --experimental-websocket tools/perf/shadowspike.mjs --nogpu
//   node --experimental-websocket tools/perf/shadowspike.mjs --throttle=6

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
const PORT = 8801;
const DEBUG_PORT = 9346;

const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const eq = s.indexOf('=');
  return eq < 0 ? [s, 'true'] : [s.slice(0, eq), s.slice(eq + 1)];
}));
const RATE = Number(argv.throttle || 1);
const DPR = Number(argv.dpr || 2);
const WARMUP_MS = Number(argv.warmup || 10000);
const SAMPLE_MS = Number(argv.sample || 10000);

// The fade colour the real thing uses. Exact value does not affect cost, but
// keeping it honest means the screenshots are comparable to the real build.
const C = 'rgba(12, 10, 14, 1)';
const shadow = (blur) => `drop-shadow(0 0 ${blur}px ${C})`;
const pair = (blur) => `${shadow(blur)} ${shadow(blur * 2.5)}`;

// "@stanza " arms move the filter off the spans and onto their parent .stanza:
// one filtered element per stanza instead of one per word. Not a free swap —
// per-word shadows overlap each other where words are close, a per-stanza
// shadow is cast by the union of the glyphs — so it needs looking at as well as
// timing. --shots exists for that.
const ARMS = [
  ['off',          'none'],
  ['default (9)',  pair(9)],
  ['single 9',     shadow(9)],
  ['single 22.5',  shadow(22.5)],
  ['pair blur 4',  pair(4)],
  ['pair blur 16', pair(16)],
  ['@stanza 9',    '@stanza ' + pair(9)],
  ['off#2',        'none'],
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

const profileDir = mkdtempSync(join(tmpdir(), 'mourn-shadow-'));
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

const setup = await evaluate(`
  (() => {
    const spans   = () => Array.from(document.querySelectorAll('#poem-container .stanza span'));
    const stanzas = () => Array.from(document.querySelectorAll('#poem-container .stanza'));
    if (!spans().length) return { ok: false, why: 'no spans' };

    // The real thing drives this through the --word-shadow custom property, so
    // the arms drive the same property. Setting inline styles on 800 spans
    // would measure the cost of touching 800 elements, not the cost of a blur.
    const root = document.documentElement.style;
    window.__armSet = (v) => {
      const onStanza = v.startsWith('@stanza ');
      const value = onStanza ? v.slice(8) : v;
      root.setProperty('--word-shadow', onStanza ? 'none' : value);
      root.setProperty('--stanza-shadow', onStanza ? value : 'none');
      // The stylesheet only knows about --word-shadow on spans, so the stanza
      // arm needs a rule of its own. Injected once, harmless when set to none.
      if (!document.getElementById('__stanzaShadowRule')) {
        const s = document.createElement('style');
        s.id = '__stanzaShadowRule';
        s.textContent = '#poem-container .stanza { filter: var(--stanza-shadow, none); }';
        document.head.appendChild(s);
      }
      const first = spans()[0];
      return {
        span: getComputedStyle(first).filter,
        stanza: getComputedStyle(first.closest('.stanza')).filter,
      };
    };

    const B = window.__s = { draw: [], raf: [] };
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
    window.__sReset = () => { B.draw.length = 0; B.raf.length = 0; };

    // How many of those spans are actually on screen matters more than the raw
    // DOM count: an offscreen stanza is not rasterised, so it is not paying for
    // its blur. Both are reported.
    const vw = innerWidth, vh = innerHeight;
    const onScreen = spans().filter((el) => {
      const b = el.getBoundingClientRect();
      return b.bottom > 0 && b.top < vh && b.right > 0 && b.left < vw;
    }).length;

    return {
      ok: true,
      spans: spans().length,
      stanzas: stanzas().length,
      onScreen,
      configured: (typeof CONFIG !== 'undefined')
        ? { on: CONFIG.enableWordShadow, blur: CONFIG.wordShadowBlur, op: CONFIG.wordShadowOpacity }
        : null,
      density: pixelDensity(),
    };
  })()`);

if (!setup.ok) throw new Error('spike setup failed: ' + setup.why);
console.log(`page ready — ${setup.spans} spans in ${setup.stanzas} stanzas, ` +
            `${setup.onScreen} spans on screen`);
console.log(`shipped default: enableWordShadow=${setup.configured?.on} ` +
            `blur=${setup.configured?.blur} opacity=${setup.configured?.op}`);
console.log(`density ${setup.density}, dpr ${DPR}, cpu ${RATE}x, ` +
            `gpu ${argv.nogpu ? 'software' : 'hardware'}`);

await sleep(WARMUP_MS);

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: xs.length, mean, p50: q(0.5), p95: q(0.95) };
};

const rows = [];
for (const [name, value] of ARMS) {
  await evaluate(`window.__armSet(${JSON.stringify(value)})`);
  await sleep(1500);                       // let the compositor re-settle
  await evaluate('window.__sReset()');
  await sleep(SAMPLE_MS);
  const raw = await evaluate(`JSON.stringify({
    draw: window.__s.draw, raf: window.__s.raf,
    n: (typeof particles !== 'undefined') ? particles.length : -1,
  })`);
  const d = JSON.parse(raw);
  const draw = stats(d.draw);
  const raf = stats(d.raf);
  // A dropped frame shows up as a delta near a multiple of the vsync interval.
  const longFrames = d.raf.filter((x) => x > 20).length / d.raf.length * 100;
  const fps = 1000 / raf.mean;
  rows.push({ name, value, draw, raf, longFrames, fps, n: d.n });
  console.log(
    `${name.padEnd(13)} fps=${fps.toFixed(1).padStart(5)}  ` +
    `raf mean=${raf.mean.toFixed(2)} p95=${raf.p95.toFixed(2)}  ` +
    `long=${longFrames.toFixed(1)}%  draw p50=${draw.p50.toFixed(2)}  n=${d.n}`
  );
}

const base = rows.find((r) => r.name === 'off');
const base2 = rows.find((r) => r.name === 'off#2');
const drift = Math.abs(base2.raf.mean - base.raf.mean);
console.log(`\nnoise floor (off measured twice): ${drift.toFixed(2)} ms ` +
            `— differences smaller than this are not real`);
for (const r of rows) {
  if (r.name.startsWith('off')) continue;
  const delta = r.raf.mean - base.raf.mean;
  const verdict = Math.abs(delta) <= drift ? 'within noise' : (delta > 0 ? 'SLOWER' : 'faster');
  console.log(`  ${r.name.padEnd(13)} ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} ms/frame  ${verdict}`);
}
const drawSpread = Math.max(...rows.map((r) => r.draw.p50)) - Math.min(...rows.map((r) => r.draw.p50));
console.log(`\ndraw() spread across arms: ${drawSpread.toFixed(2)} ms ` +
            `(control — should be flat; JS work is identical in every arm)`);

if (argv.shots) {
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(argv.shots, { recursive: true });
  await evaluate('noLoop(); true');
  await sleep(500);
  for (const [name, value] of ARMS) {
    if (name === 'off#2') continue;
    await evaluate(`window.__armSet(${JSON.stringify(value)})`);
    await sleep(350);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(argv.shots, name.replace(/[^a-z0-9]+/gi, '-') + '.png');
    await writeFile(file, Buffer.from(data, 'base64'));
    console.log('shot ' + file);
  }
}

ws.close();
chrome.kill();
server.close();
// Chrome is still flushing its profile when kill() returns, so a plain rmSync
// races it and throws ENOTEMPTY after a run that otherwise succeeded.
rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
process.exit(0);
