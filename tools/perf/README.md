# Performance harness

Fourteen tools that drive real Chrome over the DevTools protocol. They exist
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
node --experimental-websocket tools/perf/settle.mjs --throttle=2 --nogpu "--page=/index.html?debug&enableAutoPixelDensity=1"
```

`--nogpu` forces software rasterisation. Headless Chrome hides fill cost off the
main thread, so a resolution change looks free even when it is the only thing
that would help; software rasterisation puts that cost somewhere measurable and
stands in for a venue machine with weak graphics. `bench.mjs` takes the same
flag. The trace includes the density step, so you can see the auto controller
work.

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

## inkcarry.mjs — does the ink survive a resolution change

Changing pixel density resizes all three canvases, and resizing a canvas clears
it. `applyPixelDensity(true)` snapshots, resizes and repaints. This checks it
worked, against a control with preservation switched off.

```
node --experimental-websocket tools/perf/inkcarry.mjs
```

Both measurements happen inside a single evaluation with no frames in between —
the foreground layer fades at 36/255 per frame and is empty inside a second, so
anything that lets the loop run measures that fade instead of the resize. For
the same reason a layer with no ink in it to begin with is skipped rather than
counted as a failure.

## gammaspike.mjs — what a CSS filter on the background costs

Swaps the filter on the background canvases between arms without reloading, so
every arm sees the same page and the same particle population. Adaptive quality
is forced off, because it exists to absorb exactly the cost being measured and
would otherwise hide it behind a smaller particle field.

```
node --experimental-websocket tools/perf/gammaspike.mjs --nogpu --dpr=2
node --experimental-websocket tools/perf/gammaspike.mjs --nogpu --shots=/tmp/arms
```

The metric is rAF delta, not time inside `draw()`. Filter cost lands in raster
and compositing; `draw()` is carried as a control and must stay flat across arms
or the run is void. The baseline arm runs first and last, and the gap between
those two readings is printed as the noise floor — differences smaller than it
are not real.

`--shots=DIR` stops the sketch and captures one screenshot per arm, so the look
can be compared on an identical frame. A filter that is free and wrong is not a
win.

Two findings worth not rediscovering. Cost tracks the number of *passes*, not
the number of functions: consecutive shorthand functions fold into one pass, and
a `url()` filter is always its own, so bolting `url(#x)` onto an existing
`contrast()` doubles the bill while replacing the whole chain with one
`feComponentTransfer` is roughly free. And the stylesheet selector matches three
canvases, so the chain is paid three times a frame — 12 ms of a 30 ms budget
against a software rasteriser.

## shadowspike.mjs — what the word shadow costs

Same shape as `gammaspike.mjs`, pointed at `--word-shadow` instead. Swaps the
drop-shadow chain on the poem spans between arms — off, the shipped pair, one
shadow instead of two, several blur radii, and one arm that moves the filter
from the spans to their parent stanza.

```
node --experimental-websocket tools/perf/shadowspike.mjs --nogpu
node --experimental-websocket tools/perf/shadowspike.mjs --shots=/tmp/ws
```

Three things make this need measuring rather than reasoning. Gaussian blur cost
scales with radius, and the shipped chain stacks two shadows where the second is
2.5x the radius of the first. The filter is per span, and the scroll ring seeds
several cycles of stanzas into the DOM — 905 spans, of which about 51 are on
screen, so the bill is set by what is visible, not by the length of the poem.
And it is not a static filter that rasterises once: `scroll.js` rewrites the
stanza offsets while the poem moves, so the blur is redone as it scrolls.
Measuring it on a parked poem reports zero and is wrong, which is why the tool
starts the auto-scroll before sampling.

The answer, measured: free on a GPU rasteriser, ~2.4 ms/frame on a software one
against a 0.27 ms noise floor. Radius is the whole story — halving the blur to 4
drops it to 0.8 ms, raising it to 16 pushes it to 3.3 ms. Moving the filter to
the stanza saves nothing (it measured very slightly worse), so the per-element
count is not what costs; the blurred area is.

## judder.mjs — is the poem in the right place each frame

Frame rate does not tell you whether motion looks smooth. A page can hold 60 fps
and judder, and it can run at 30 and look perfect: what the eye reacts to is
whether each step is the same size as the last. This samples the one number the
whole scroll is downstream of — `--left-active-offset` on `#anchor`, written by
`setAnchorOffsets()` at the end of every `draw()` — and looks at the steps.

```
node --experimental-websocket tools/perf/judder.mjs --nogpu --throttle=4
node --experimental-websocket tools/perf/judder.mjs --arms='base,no snap' --throttle=1
```

Horizontal only, deliberately: the vertical offset is the horizontal one times
the current stanza's slope, so a 2D step would fold stanza changes into the
timing signal. Columns: `err` is how far the poem is from where a constant
velocity says it should be and is the headline; `CV` is the spread of step size;
`slow` is how far under the nominal px/s it actually travelled; `clamped` is the
share of frames long enough for the delta cap to bite; `slipswing` is how much
the canvas-side collider boxes slide against the DOM text, since the two are
moved by different rAF callbacks.

**Rank on `err`, never on `CV` alone.** The `flat 50` arm is the standing
demonstration of why: it pins the delta cap at a constant, so every frame gets
an identical step and its `CV` is a perfect 0.0% — while the poem travels at
half the speed it was asked for. Step evenness scores that as the best arm in
the run. Distance from where the poem should be catches it.

`coarse snap`, `flat 50` and `old scroll` put back behaviour the scroll used to
have, so a run doubles as a regression test on the two fixes below rather than
only a hunt for the next problem. The rest strip the shadow, the text texture
and the `will-change` promotion. `base` runs first and last and the gap is the
noise floor.

This is the tool that found the two scroll defects, both now fixed, and the arms
still price them. `snapOffset` used to round the offset to 0.1px against a step
of about 0.27px, so successive frames landed on 0.2, 0.3, 0.2 — `coarse snap`
restores it and costs 11.5% step unevenness against 2.8% shipped. That one got
*worse* the healthier the machine, because a faster frame rate means a smaller
step against the same fixed grid. And the delta cap used to be a flat 50 ms,
which cannot tell a hidden tab from a slow machine — `flat 50` restores it and
the poem drops to 54% of its intended speed at 11 fps while measuring, wrongly,
as the smoothest thing in the run.

`will-change` is worth leaving alone: `no willchange` costs about 10 fps at 1x.

## textshimmer.mjs — do the letters change, or only move

`judder.mjs` can report perfect motion while the words still look wrong, because
a glyph that arrives on time can still arrive rendered differently. Two modes,
answering that from opposite ends.

```
node --experimental-websocket tools/perf/textshimmer.mjs --nogpu
node --experimental-websocket tools/perf/textshimmer.mjs --live --throttle=4
```

Default mode freezes the sketch, hides the ink canvases and steps the offset by
hand, photographing each step. It reports `ink` (mean luminance of the crop) and
`edge` (mean difference between horizontally adjacent pixels — sharpness).
Neither should move when the only thing that changed is position. The integer
1.0px arm is the control: whole-pixel motion cannot resample, so its spread is
the rig's own noise. This is how the composited-layer resampling theory was
killed — `#anchor` carries `will-change: transform`, so fractional offsets could
in principle be resolved by resampling the raster rather than re-rasterising the
text, which would make the letters breathe in sharpness at the offset's
fractional frequency. They do not: every sub-pixel arm measured at or below the
integer control.

`--live` lets the whole piece run, screencasts real composited frames, and
splits each frame-to-frame difference three ways — inside the word rectangles,
in a 10px ring around them, and far from any word. The words sit in the busiest
part of the picture: both word regions change three to four times as fast as the
open field, because particles pile up along the glyph edges by design.

Two limits to respect. The "inside the letters" mask is the word bounding box,
not the glyph outline, so it includes the gaps between letters where ink shows
through — read it as "at the words", not "in the ink of the letters". And the
screencast encoder is itself the bottleneck under software rasterisation, so the
presented frame rate is the tool's, not the piece's: compare regions *within* a
run, never absolute rates *between* runs.

## lum.mjs — is that actually brighter

Mean luminance, share of non-black pixels, mean luminance of just those pixels,
and share of clipped pixels, for one or more PNGs.

```
node --experimental-websocket tools/perf/lum.mjs before.png after.png
```

This piece is almost entirely black, and dark images are precisely where judging
"brighter?" by eye fails: a field with a few bright filaments and a field with
many dim ones look alike at a glance and are nothing alike. `lit mean` rising
while `lit%` falls is the signature of the thing usually wanted here — fewer,
more distinct trails rather than more fog.

Note `clipped%` measures the *composited* frame. On this piece it is always
zero, which is itself the finding: the canvases are transparent, so the filter
grades un-premultiplied ink colour before alpha compositing, and nothing ever
reaches white. That is why RGB filters move this piece so little, and why the
alpha transfer function is the control that matters.

## smoke.mjs — does it still load

Loads a page, runs it 8 seconds, reports console errors, uncaught exceptions and
404s, plus a snapshot of the state worth checking after a render change.

```
node --experimental-websocket tools/perf/smoke.mjs "/index.html?debug" 2
```

Second argument is the device pixel ratio. Worth running against `/index.html`,
`/index.html?debug` and `/show/index.html` — the show build strips the panel, so
it exercises a different path.
