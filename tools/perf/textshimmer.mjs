// Do the letters change appearance as the poem scrolls, or only position?
//
// judder.mjs answers "is the poem in the right place each frame". It can say
// yes and the words can still look wrong, because a glyph that arrives on time
// can still arrive rendered differently — and text that changes weight frame to
// frame reads as a strobe even when its motion is perfect.
//
// #anchor carries will-change: transform, so the poem is its own compositor
// layer. A composited layer is rasterised once and then TRANSFORMED, and a
// transform by a fractional number of pixels is resolved by resampling that
// raster, not by re-rasterising the text at the new position. Resampling a
// glyph 0.3px sideways softens it; resampling it 1.0px sideways does not move
// a single sample. So as the offset walks through 0.0, 0.2, 0.4 ... the letters
// walk through sharp, soft, softer, soft, sharp — a brightness and weight
// oscillation locked to the fractional part of the offset, with no
// corresponding change in position. That is the thing to detect.
//
// Method: freeze the sketch so nothing but the poem can change, hide the ink
// canvases so nothing but the poem is in frame, then step the offset by hand
// and photograph each step. Two numbers per frame:
//
//   ink   mean luminance of the crop — how much light the words put out.
//   edge  mean |difference between horizontally adjacent pixels| — sharpness.
//         Resampling blurs edges, and this is what notices.
//
// Neither should move at all when the only thing that changed is position. The
// headline is their spread across frames, as a percentage. An integer-step arm
// is included as the control: if THAT one shows spread, the rig is at fault and
// nothing else in the run means anything.
//
// --live answers the neighbouring question by a different method. Instead of
// stepping a frozen page by hand, it lets the whole piece run and screencasts
// real consecutive composited frames, then splits each frame-to-frame
// difference three ways: pixels inside the letters, pixels in a ring just
// outside them, and pixels far from any word. Text that is merely being carried
// past a busy background puts all its change in the outer two. Text that is
// itself strobing puts change inside the glyphs, where nothing should be moving
// but the position.
//
//   node --experimental-websocket tools/perf/textshimmer.mjs --nogpu
//   node --experimental-websocket tools/perf/textshimmer.mjs --frames=40
//   node --experimental-websocket tools/perf/textshimmer.mjs --live --throttle=4

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Unique across tools/perf so two of them can run concurrently.
const PORT = 8804;
const DEBUG_PORT = 9349;

const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const eq = s.indexOf('=');
  return eq < 0 ? [s, 'true'] : [s.slice(0, eq), s.slice(eq + 1)];
}));
const DPR = Number(argv.dpr || 2);
const FRAMES = Number(argv.frames || 24);
const RATE = Number(argv.throttle || 1);
const LIVE = !!argv.live;

// Step sizes in CSS px. 1.0 is the control — a whole-pixel translation cannot
// resample. 0.66 is what judder.mjs measured the poem actually doing on a
// 4x-throttled software rasteriser. 0.1 is the grid snapOffset rounds to, and
// 0.22 is the step at the shipped speed and 60 fps.
const ARMS = [
  ['integer 1.0', 1.0],
  ['0.5', 0.5],
  ['0.22 (60fps)', 0.22],
  ['0.66 (weak)', 0.66],
  ['0.1 (grid)', 0.1],
];

// --- minimal PNG reader ----------------------------------------------------
// Chrome's captureScreenshot gives 8-bit non-interlaced RGB or RGBA, which is
// the only case handled here. Anything else is a hard error rather than a
// quietly wrong number.
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let pos = 8;
  let w = 0, h = 0, depth = 0, color = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; color = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += len + 12;
  }
  if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) {
    throw new Error(`unsupported png: depth ${depth} color ${color} interlace ${interlace}`);
  }
  const bpp = color === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride); rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prior ? prior[x] : 0;
      const c = (prior && x >= bpp) ? prior[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, bpp, data: out };
}

// ink = how much light is in the crop. edge = how sharp it is. A pure
// translation changes neither; a resample changes both.
function measure({ w, h, bpp, data }) {
  const lum = new Float64Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += bpp) {
    lum[i] = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
  }
  let ink = 0;
  for (let i = 0; i < lum.length; i++) ink += lum[i];
  ink /= lum.length;
  let edge = 0, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w; x++) {
      edge += Math.abs(lum[y * w + x] - lum[y * w + x - 1]); n++;
    }
  }
  return { ink, edge: edge / n };
}

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
  } catch { res.writeHead(404).end('nope'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const profileDir = mkdtempSync(join(tmpdir(), 'mourn-shimmer-'));
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
let target;
for (let i = 0; i < 60 && !target; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {}
  if (!target) await sleep(250);
}
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
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
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
await send('Page.navigate', {
  url: `http://127.0.0.1:${PORT}/index.html?debug&enableAdaptiveQuality=0&enableAutoPixelDensity=0`,
});
await sleep(6000);

const setup = await evaluate(`
  (() => {
    if (typeof mourn === 'undefined' || !mourn.trackers.anchorStyle) {
      return { ok: false, why: 'never booted' };
    }
    // Stepped mode freezes everything that is not the poem: the particle
    // canvases repaint every frame by design and would swamp the signal.
    // Live mode wants exactly the opposite — the whole piece, running.
    const live = ${LIVE};
    if (live) {
      startAutoScroll(CONFIG.autoScrollSpeed);
    } else {
      noLoop();
      for (const c of document.querySelectorAll('#poem-bg canvas')) {
        c.style.visibility = 'hidden';
      }
    }
    const style = mourn.trackers.anchorStyle;
    window.__setOffset = (v) => {
      style.setProperty('--left-active-offset', v);
      return true;
    };
    const base = parseFloat(style.getPropertyValue('--left-active-offset')) || 0;

    // Crop to real words. A crop that is mostly background dilutes the metric
    // with pixels that were never going to change.
    const vw = innerWidth, vh = innerHeight;
    const spans = Array.from(document.querySelectorAll('#poem-container .stanza span'))
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.width > 4 && b.height > 4 &&
                     b.top > vh * 0.2 && b.bottom < vh * 0.8 &&
                     b.left > vw * 0.2 && b.right < vw * 0.8);
    if (!spans.length) return { ok: false, why: 'no words in the middle of the screen' };
    const x0 = Math.min(...spans.map((b) => b.left));
    const y0 = Math.min(...spans.map((b) => b.top));
    const x1 = Math.max(...spans.map((b) => b.right));
    const y1 = Math.max(...spans.map((b) => b.bottom));
    const clip = { x: Math.floor(x0) - 8, y: Math.floor(y0) - 8,
                   width: Math.ceil(x1 - x0) + 16, height: Math.ceil(y1 - y0) + 16 };
    return {
      ok: true, base, words: spans.length, clip,
      // Word rectangles in crop-local CSS px, so the analyser can tell an
      // in-glyph change from a change in the ink beside it.
      rects: spans.map((b) => ({
        x: b.left - clip.x, y: b.top - clip.y, w: b.width, h: b.height,
      })),
      shadow: getComputedStyle(document.documentElement).getPropertyValue('--word-shadow').trim(),
      willChange: getComputedStyle(mourn.trackers.anchor).willChange,
    };
  })()`);

if (!setup.ok) throw new Error('shimmer setup failed: ' + setup.why);
console.log(`crop ${setup.clip.width}x${setup.clip.height} css px over ${setup.words} words, ` +
            `dpr ${DPR}, gpu ${argv.nogpu ? 'software' : 'hardware'}`);
console.log(`#anchor will-change: ${setup.willChange}`);
console.log(`word shadow: ${setup.shadow || 'none'}\n`);

if (LIVE) {
  // Screencast, not captureScreenshot: a screenshot round trip takes longer
  // than a frame on a throttled machine, so consecutive screenshots are not
  // consecutive frames and any frame-to-frame number from them is a fiction.
  // Screencast pushes each composited frame as the compositor produces it.
  const frames = [];
  const stamps = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method !== 'Page.screencastFrame') return;
    frames.push(m.params.data);
    stamps.push(m.params.metadata.timestamp);     // seconds, compositor clock
    send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
  });
  await sleep(4000);                              // let the ink field fill in
  await send('Page.startScreencast', {
    format: 'png', everyNthFrame: 1, maxWidth: 1600 * DPR, maxHeight: 900 * DPR,
  });
  while (frames.length < FRAMES + 1) await sleep(200);
  await send('Page.stopScreencast');

  // Three masks over the crop, in device px. "glyph" is the word rectangles,
  // "halo" is a 10px ring around them — where the drop shadow and the ink erase
  // both live — and "far" is everything else, which is pure particle field and
  // acts as the reference for how much the background alone is moving.
  const s = DPR;
  const cw = Math.round(setup.clip.width * s);
  const ch = Math.round(setup.clip.height * s);
  const RING = Math.round(10 * s);
  const mask = new Uint8Array(cw * ch);           // 0 far, 1 halo, 2 glyph
  for (const r of setup.rects) {
    const x0 = Math.round(r.x * s), y0 = Math.round(r.y * s);
    const x1 = Math.round((r.x + r.w) * s), y1 = Math.round((r.y + r.h) * s);
    for (let y = Math.max(0, y0 - RING); y < Math.min(ch, y1 + RING); y++) {
      for (let x = Math.max(0, x0 - RING); x < Math.min(cw, x1 + RING); x++) {
        mask[y * cw + x] = Math.max(mask[y * cw + x], 1);
      }
    }
    for (let y = Math.max(0, y0); y < Math.min(ch, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(cw, x1); x++) mask[y * cw + x] = 2;
    }
  }
  const counts = [0, 0, 0];
  for (let i = 0; i < mask.length; i++) counts[mask[i]]++;

  const lumOf = (png) => {
    const { w, h, bpp, data } = decodePng(png);
    const out = new Float32Array(cw * ch);
    // Screencast frames are the whole viewport; take the crop out of them.
    const ox = Math.round(setup.clip.x * s), oy = Math.round(setup.clip.y * s);
    for (let y = 0; y < ch; y++) {
      const sy = y + oy;
      if (sy < 0 || sy >= h) continue;
      for (let x = 0; x < cw; x++) {
        const sx = x + ox;
        if (sx < 0 || sx >= w) continue;
        const p = (sy * w + sx) * bpp;
        out[y * cw + x] = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
      }
    }
    return out;
  };

  console.log(`live: ${frames.length} composited frames, cpu ${RATE}x`);
  console.log(`crop pixels — glyph ${counts[2]}, halo ${counts[1]}, far ${counts[0]}\n`);

  let prev = lumOf(Buffer.from(frames[0], 'base64'));
  const acc = [[], [], []];
  const gaps = [];
  for (let i = 1; i < frames.length; i++) {
    const cur = lumOf(Buffer.from(frames[i], 'base64'));
    const sum = [0, 0, 0];
    for (let p = 0; p < cur.length; p++) sum[mask[p]] += Math.abs(cur[p] - prev[p]);
    for (let k = 0; k < 3; k++) if (counts[k]) acc[k].push(sum[k] / counts[k]);
    gaps.push((stamps[i] - stamps[i - 1]) * 1000);
    prev = cur;
  }
  const m = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const mx = (xs) => Math.max(...xs);
  const gap = m(gaps);
  const label = ['far background', 'halo around words', 'inside the letters'];
  console.log(`presented at ${(1000 / gap).toFixed(1)} fps (${gap.toFixed(1)} ms/frame)\n`);
  // Per-frame is what the eye is shown in one go; per-second is how much the
  // piece actually moved. If per-second holds steady across frame rates while
  // per-frame grows, nothing got worse — the same change is just being
  // delivered in fewer, larger instalments, which is what a strobe is.
  for (let k = 2; k >= 0; k--) {
    if (!acc[k].length) continue;
    console.log(`${label[k].padEnd(20)} per frame ${m(acc[k]).toFixed(3)}  ` +
                `worst ${mx(acc[k]).toFixed(3)}  ` +
                `per second ${(m(acc[k]) * 1000 / gap).toFixed(2)}`);
  }
  const ratio = m(acc[2]) / Math.max(m(acc[0]), 1e-6);
  console.log(`\nletters vs far background: ${ratio.toFixed(2)}x`);
  console.log(ratio > 1.2
    ? 'The glyph interiors change MORE than the open field does — the letters are\n' +
      'the source, not a victim of what is behind them.'
    : 'The glyph interiors change no more than the open field does, so whatever is\n' +
      'flickering is the ink around the words rather than the words themselves.');

  ws.close(); chrome.kill(); server.close();
  try { rmSync(profileDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch {}
  process.exit(0);
}

const spread = (xs) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
  return { mean, sd, pct: sd / mean * 100, min: Math.min(...xs), max: Math.max(...xs) };
};

const rows = [];
for (const [name, step] of ARMS) {
  const inks = [], edges = [];
  for (let i = 0; i < FRAMES; i++) {
    await evaluate(`window.__setOffset(${setup.base + i * step})`);
    const { data } = await send('Page.captureScreenshot', {
      format: 'png', clip: { ...setup.clip, scale: 1 },
    });
    const m = measure(decodePng(Buffer.from(data, 'base64')));
    inks.push(m.ink); edges.push(m.edge);
  }
  const ink = spread(inks), edge = spread(edges);
  rows.push({ name, step, ink, edge });
  console.log(
    `${name.padEnd(14)} step=${String(step).padStart(4)}px  ` +
    `ink ${ink.mean.toFixed(2)} +-${ink.pct.toFixed(2)}%  ` +
    `edge ${edge.mean.toFixed(3)} +-${edge.pct.toFixed(2)}%  ` +
    `(edge range ${edge.min.toFixed(3)}..${edge.max.toFixed(3)})`
  );
}

const control = rows[0];
console.log(`\ncontrol is the integer arm: whole-pixel motion cannot resample, so its`);
console.log(`spread is the rig's own noise. Anything at or below it is not a finding.`);
for (const r of rows.slice(1)) {
  const ratio = r.edge.pct / Math.max(control.edge.pct, 1e-6);
  const verdict = ratio < 2 ? 'no worse than whole-pixel'
    : `${ratio.toFixed(0)}x the control — letters change shape as they move`;
  console.log(`  ${r.name.padEnd(14)} edge spread ${r.edge.pct.toFixed(2)}%  ${verdict}`);
}

ws.close();
chrome.kill();
server.close();
try {
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
} catch {}
process.exit(0);
