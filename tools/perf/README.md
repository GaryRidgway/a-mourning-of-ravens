# Performance harness

Five scratch tools that drive real Chrome over the DevTools protocol. They exist
so a performance claim about this piece can be checked rather than argued about,
and so the show machine can be measured the same way the tuning machine was.

Node 21 needs `--experimental-websocket`; Node 22+ does not. Chrome is expected at
`/Applications/Google Chrome.app`. Each script serves the repo itself over
localhost, so nothing needs to be running first.

## bench.mjs — what a frame costs

Wraps `draw()` and each of its phases and times them directly. Frame *deltas* are
vsync-paced and tell you about the display; time inside `draw()` tells you about
the work, which is the thing that decides how much of the piece a weak machine
gets to see.

```
node --experimental-websocket tools/perf/bench.mjs --throttle=1,4,6,8 --dpr=2
```

- `--throttle` — comma-separated CPU throttle multipliers, standing in for slower
  hardware. 6x is roughly where this piece started to struggle before the show pass.
- `--dpr` — emulated device pixel ratio. Use 2 to reproduce a Retina panel.
- `--page` — defaults to `/index.html?debug`. Quote it if it has an `&`:
  `"--page=/index.html?debug&particleCount=2500"`
- `--warmup` / `--sample` — milliseconds, default 12000 / 20000.

Reports p50/mean/p95 of `draw()`, the adaptive quality level the controller
settled at, and a per-phase breakdown. The quality level is an integrator and
wanders run to run when it is near its break-even; trust the draw times.

## profile.mjs — where the time goes

V8 CPU profile aggregated by function self-time. This is what to run before
optimising anything, and again afterwards to check the thing you fixed actually
left the profile.

```
node --experimental-websocket tools/perf/profile.mjs --throttle=6 --dpr=2
```

`(program)` is native work — rasterisation, compositing, style — and is not
attributable to any one function here.

## shot.mjs + imgdiff.mjs — did the look change

`shot.mjs` takes a deterministic screenshot: seeds the RNG and calls `noLoop()`
*inside* `setup()` (p5 starts looping the moment setup returns, so anything later
has already let an unpredictable number of frames run against the wall clock),
pins the random stanza, freezes the clock, then steps `draw()` by hand.

```
node --experimental-websocket tools/perf/shot.mjs --out=before.png --frames=240
node --experimental-websocket tools/perf/imgdiff.mjs before.png after.png diff.png
```

Two runs of unchanged code must produce a bit-identical image. If they do not,
the harness is measuring its own noise and any A/B through it is worthless —
fix that before believing a diff. `imgdiff.mjs` prints max and mean channel
deviation and writes a 16x-amplified difference image.

## settle.mjs — does the quality controller converge

The adaptive controller is an integrator, and `particleSimFraction` gives it a
slow, expensive-to-reverse plant to act on. That combination hunts unless it is
gated, and a hunting controller reads as the particle field breathing in and out
over tens of seconds. This samples the level, both fractions and the frame time
over a long window and reports the peak-to-peak swing once settled.

```
node --experimental-websocket tools/perf/settle.mjs --throttle=8 --secs=100
node --experimental-websocket tools/perf/settle.mjs --throttle=8 --secs=120 --release
```

What good looks like: `simFrac peak-to-peak` at or near 0.000, and mean frame
time within a millisecond of the budget. The level itself is allowed to wobble —
that only moves the render fraction, which is the cheap reversible knob.

`--release` lifts the throttle to 1x halfway through, which checks the other
failure mode: the sim fraction latching at its low-water mark and never giving
the particles back. Expect full recovery within about 25 seconds.

## revive.mjs / frozendot.mjs — the two ways particle culling breaks

Both are pass/fail regression tests for `particleSimFraction`. Run them after
touching anything in the cull path.

```
node --experimental-websocket tools/perf/revive.mjs
node --experimental-websocket tools/perf/frozendot.mjs
```

**revive** — culls almost everything, holds it while the flow moves on, then
brings the whole population back at once and instruments every segment drawn on
the following frames. A revived particle whose display position was not resynced
draws a line from wherever it froze to wherever it is now. Passes if no segment
exceeds the render clamp.

**frozendot** — forces the effective sim fraction below the effective render
fraction, which is the state every recovery passes through, and counts draws
attributable to particles the sim has frozen. Must be zero: a frozen particle
that draws stamps a zero-length segment — a dot under the round cap — in the
same place every frame, and burns it into the accumulated ink.

That second one is a real bug this harness caught. The two fractions are clamped
so sim never trails render, but only on the *target*; the effective values run
through separate smoothing filters at different rates, and on an 8x-throttled
recovery the sim fraction sat at 0.38 while render had already climbed to 0.73.
Do not re-derive "is it drawn" from the fractions — test the particle's flag.

## smoke.mjs — does it still load

Loads a page, runs it 8 seconds, reports console errors, uncaught exceptions and
404s, plus a snapshot of the state worth checking after a render change.

```
node --experimental-websocket tools/perf/smoke.mjs "/index.html?debug" 2
```

Second argument is the device pixel ratio. Worth running against `/index.html`,
`/index.html?debug` and `/show/index.html` — the show build strips the panel, so
it exercises a different path.
