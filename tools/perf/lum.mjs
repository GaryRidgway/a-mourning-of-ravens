// Mean luminance and tone distribution for one or more PNGs, via Chrome's
// decoder.
//
// This piece is almost entirely dark, and dark images are exactly where judging
// "is that brighter?" by eye stops working: a black field with a few bright
// filaments and a black field with many dim ones read the same at a glance and
// are nothing alike. Grading decisions here need a number.
//
// Reported per image:
//   mean lum   average luminance over every pixel, including the black
//   lit%       share of pixels above the "this is not background" floor
//   lit mean   average luminance of only those pixels — the brightness of the
//              picture as opposed to the brightness of the canvas
//   clipped%   share of pixels with any channel pegged at 255. Always 0 on this
//              piece, and that IS the finding: the canvases are transparent, so
//              the filter grades ink colour before alpha compositing and the
//              composited frame never reaches white. Do not read a 0 here as
//              "nothing is being clamped" — the clamp happens upstream, where
//              this cannot see it.
//   hues       distinct colour ratios among lit pixels, brightness normalised
//              out. Blind on purpose to how bright a colour is, which also
//              makes it blind to reds converging as brightness() is raised —
//              the failure mode that motivated the tone curve. Use it for hue
//              variety, not as evidence that a grade preserved colour.
//
//   node --experimental-websocket tools/perf/lum.mjs a.png b.png ...

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

const paths = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!paths.length) {
  console.error('usage: lum.mjs <image.png> [more.png ...]');
  process.exit(1);
}
const floorArg = process.argv.find((a) => a.startsWith('--floor='));
const FLOOR = floorArg ? Number(floorArg.slice(8)) : 4;   // 0-255

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9345;

const dir = mkdtempSync(join(tmpdir(), 'lum-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
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
let id = 0; const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
});

const rows = [];
for (const p of paths) {
  const b64 = (await readFile(p)).toString('base64');
  const r = await send('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `(async () => {
      const im = await new Promise((ok, no) => {
        const i = new Image(); i.onload = () => ok(i); i.onerror = no;
        i.src = 'data:image/png;base64,' + ${JSON.stringify(b64)};
      });
      const c = new OffscreenCanvas(im.width, im.height);
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, im.width, im.height).data;
      let sum = 0, lit = 0, litSum = 0, clipped = 0;
      // Hue spread among lit pixels. The composited frame never clips, so
      // clipped% cannot see the failure that matters here: the filter clamps the
      // INK colour before compositing, so every ink hue past the clamp comes out
      // as the same hue and only alpha tells them apart afterwards. Distinct
      // hues survive that or they do not, and counting them shows it.
      const hues = new Set();
      const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sum += L;
        if (L > ${FLOOR}) {
          lit++; litSum += L;
          // Normalise out brightness so only the colour ratio is compared.
          const m = Math.max(r, g, b) || 1;
          hues.add(((r / m * 31) | 0) * 1024 + ((g / m * 31) | 0) * 32 + ((b / m * 31) | 0));
        }
        if (r === 255 || g === 255 || b === 255) clipped++;
      }
      return { mean: sum / n, litPct: lit / n * 100,
               litMean: lit ? litSum / lit : 0, clippedPct: clipped / n * 100,
               hues: hues.size };
    })()`,
  });
  const v = r.result.value;
  rows.push({ name: basename(p), ...v });
}

const pad = Math.max(...rows.map((r) => r.name.length));
console.log(`${'image'.padEnd(pad)}   mean lum   lit%     lit mean   clipped%   hues`);
for (const r of rows) {
  console.log(
    `${r.name.padEnd(pad)}   ${r.mean.toFixed(3).padStart(8)}   ` +
    `${r.litPct.toFixed(2).padStart(6)}   ${r.litMean.toFixed(2).padStart(8)}   ` +
    `${r.clippedPct.toFixed(3).padStart(8)}   ${String(r.hues).padStart(5)}`
  );
}

ws.close();
chrome.kill();
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
