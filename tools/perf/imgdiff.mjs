// Pixel-diff two PNGs using Chrome's own decoder. Prints max/mean channel
// deviation and writes an amplified diff image.
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, } from 'node:os';
import { join } from 'node:path';

const [aPath, bPath, outPath = 'diff.png'] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9336;

const a = (await readFile(aPath)).toString('base64');
const b = (await readFile(bPath)).toString('base64');

const dir = mkdtempSync(join(tmpdir(), 'imgdiff-'));
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

const r = await send('Runtime.evaluate', {
  awaitPromise: true, returnByValue: true,
  expression: `(async () => {
    const load = (b64) => new Promise((ok, no) => {
      const im = new Image(); im.onload = () => ok(im); im.onerror = no;
      im.src = 'data:image/png;base64,' + b64;
    });
    const A = await load(${JSON.stringify(a)});
    const B = await load(${JSON.stringify(b)});
    if (A.width !== B.width || A.height !== B.height) {
      return { error: 'size mismatch ' + A.width + 'x' + A.height + ' vs ' + B.width + 'x' + B.height };
    }
    const w = A.width, h = A.height;
    const mk = (im) => { const c = new OffscreenCanvas(w, h); const x = c.getContext('2d');
                         x.drawImage(im, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = mk(A), db = mk(B);
    let maxd = 0, sum = 0, differing = 0, n = 0;
    const out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < da.length; i += 4) {
      let px = 0;
      for (let k = 0; k < 3; k++) {
        const d = Math.abs(da[i + k] - db[i + k]);
        if (d > px) px = d;
        sum += d; n++;
      }
      if (px > maxd) maxd = px;
      if (px > 1) differing++;
      const amp = Math.min(255, px * 16);
      out[i] = amp; out[i + 1] = amp; out[i + 2] = amp; out[i + 3] = 255;
    }
    const c = new OffscreenCanvas(w, h); c.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
    const blob = await c.convertToBlob({ type: 'image/png' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
    return { w, h, maxd, mean: sum / n, differingPct: (differing / (w * h)) * 100, png: btoa(s) };
  })()`,
});
const v = r.result.value;
if (v.error) { console.log(v.error); }
else {
  console.log(`${v.w}x${v.h}  max channel delta ${v.maxd}  mean ${v.mean.toFixed(4)}  pixels differing by >1: ${v.differingPct.toFixed(3)}%`);
  await writeFile(outPath, Buffer.from(v.png, 'base64'));
  console.log(`diff (16x amplified) -> ${outPath}`);
}
ws.close(); chrome.kill();
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
