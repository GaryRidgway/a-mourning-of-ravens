// Deterministic screenshot of the piece, for A/B-ing that an optimisation did
// not change what it looks like.
//
// Determinism comes from seeding p5's RNG and noise before setup runs, freezing
// the clock the sketch reads, and stepping draw() by hand a fixed number of
// times. Usage:
//   node --experimental-websocket shot.mjs --out=before.png [--frames=240]

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// Repo root, derived from this file's location (tools/perf/x.mjs).
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8793;
const DEBUG_PORT = 9335;

const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const s = a.replace(/^--/, '');
  const eq = s.indexOf('=');
  return eq < 0 ? [s, 'true'] : [s.slice(0, eq), s.slice(eq + 1)];
}));
const OUT = argv.out || 'shot.png';
const FRAMES = Number(argv.frames || 240);
const PAGE = argv.page || '/index.html';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0]));
  try {
    const buf = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-store' });
    res.end(buf);
  } catch { res.writeHead(404).end('nope'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const profileDir = mkdtempSync(join(tmpdir(), 'mourn-shot-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profileDir}`, '--window-size=1600,900', '--no-first-run',
  '--disable-extensions', '--hide-scrollbars', '--enable-gpu-rasterization',
  '--use-angle=metal', 'about:blank'], { stdio: 'ignore' });

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
let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression, awaitPromise = true) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });

// Seed before any app script runs. randomSeed/noiseSeed need p5 loaded, so this
// installs a hook that fires the moment setup is about to run.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    Math.random = (function () {
      let s = 123456789;
      return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    })();
    // The starting stanza is drawn from Math.random inside a rAF chain that
    // races p5's setup(), so a seeded PRNG alone does not pin it — how many
    // draws setup consumed first depends on load timing, and any change to how
    // much script the page parses shifts it. Pin the stanza itself.
    //
    // It has to be assigned on 'load', not here: helpers.js declares
    // randomStanzaIndex as a top-level function, and that declaration clobbers
    // any property defined before the script runs. main.js does its work from
    // its own 'load' listener, and listeners fire in registration order, so
    // this one — registered before any page script exists — always wins.
    window.addEventListener('load', () => {
      window.randomStanzaIndex = () => 0;
      // p5 starts looping the instant setup() returns, so by the time an
      // outside caller can reach noLoop() an unpredictable number of frames
      // have already advanced the sim against the wall clock. Seeding and
      // stopping from inside setup is the only point where the frame count is
      // still zero. Everything after this runs on a frozen clock, stepped by
      // hand.
      const origSetup = window.setup;
      window.setup = function () {
        randomSeed(42);
        noiseSeed(42);
        const r = origSetup.apply(this, arguments);
        noLoop();
        window.__t = 0;
        const inst = window._renderer && window._renderer._pInst;
        if (inst) inst.millis = () => window.__t;
        window.millis = () => window.__t;
        return r;
      };
    });
    window.__shotErrors = [];
    window.addEventListener('error', (e) => window.__shotErrors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => window.__shotErrors.push('rejection: ' + e.reason));
    const origConsoleError = console.error;
    console.error = function (...a) { window.__shotErrors.push('console.error: ' + a.join(' ')); return origConsoleError.apply(this, a); };
  `,
});

await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${PAGE}` });
await sleep(3000);

// Freeze the clock and take manual control of the frame loop, so both runs see
// exactly the same time series regardless of how fast they actually render.
const setup = await evaluate(`
  (async () => {
    for (let i = 0; i < 80; i++) {
      if (typeof draw === 'function' && typeof particles !== 'undefined' && particles.length
          && typeof frameCount === 'number') break;
      await new Promise(r => setTimeout(r, 250));
    }
    return { particles: particles.length, frameCount, t: window.__t };
  })()`);

await evaluate(`
  (() => {
    for (let f = 0; f < ${FRAMES}; f++) { window.__t += 1000 / 60; draw(); }
    return true;
  })()`);

const errors = await evaluate('JSON.stringify(window.__shotErrors)');
const { data } = await send('Page.captureScreenshot', { format: 'png' });
await writeFile(OUT, Buffer.from(data, 'base64'));
console.log(`wrote ${OUT}  (particles ${setup.particles}, preFrames ${setup.frameCount}, stepped ${FRAMES})`);
console.log('page errors:', errors);

ws.close(); chrome.kill(); server.close();
try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
process.exit(0);
