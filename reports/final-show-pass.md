# Final Show Pass — Performance

Goal: make the piece survive weaker hardware than the machine it was tuned on.
Everything here is measured, and nothing here changes what it looks like.

## How it was measured

Previous rounds measured frame deltas, which are vsync-paced: on a machine with
headroom they report the display, not the work. This round measures **CPU time
inside `draw()`**, which is what actually decides how much of the piece a weak
machine gets to see.

Harness: real Chrome over CDP, page served locally, `startAutoScroll(0.3)`
running (colliders move every frame, so the box grid rebuilds and the erase pass
has work), 1600x900 at device pixel ratio 2, 5000 particles. Lower-power hardware
is stood in for with `Emulation.setCPUThrottlingRate`. 6x throttle is roughly
where the piece stopped coping before this pass, so it is the reference point.

Three tools, in `reports/` history only as numbers — the scripts were scratch:

- **bench** — wraps `draw()` and each phase, reports p50/mean/p95 and the
  adaptive quality level the controller settled at.
- **profile** — V8 CPU profile aggregated by function self-time.
- **shot** — deterministic screenshot. Seeds the RNG and stops the loop *inside*
  `setup()`, freezes the clock, then steps `draw()` 240 times by hand. Verified
  bit-identical across two runs of unchanged code before being trusted.

## Result

`draw()` CPU time, mean, at device pixel ratio 2:

| CPU throttle | Before | After | Change |
|---|---|---|---|
| 1x  |  4.93 ms |  3.32 ms | −33% |
| 4x  | 17.71 ms | 10.90 ms | −38% |
| 6x  | 25.16 ms | 14.75 ms | −41% |
| 8x  | 32.68 ms | 19.35 ms | −41% |
| 10x |    —     | 23.40 ms |  —   |

About 40% less CPU per frame, which is worth roughly 1.7x the machine. Concretely:
8x-throttled hardware now costs less per frame than 6x-throttled hardware did
before, and at 6x the adaptive controller went from **pinned at maximum
degradation and still missing target** to sitting mid-range with the piece at
something close to full quality.

Per phase, at 6x throttle (mean ms):

| Phase | Before | After |
|---|---|---|
| `updateParticles`    | 14.36 | 11.09 |
| `renderParticles`    |  9.21 |  2.98 |
| `renderBoxes`        |  0.77 |  0.02 |
| `fadeCanvas`         |  0.14 |  0.10 |
| `eraseInkUnderBoxes` |  0.00 |  0.00 |

## What was changed

Ordered by what the profiler said, not by what looked slow.

### 1. renderParticles no longer goes through p5's stroke() — was ~14% of all JS

`p5.Renderer2D.stroke()` builds a fresh `p5.Color` and a fresh `rgba(...)`
string on every call and assigns it to `strokeStyle`, which makes the browser
parse a CSS colour. At 5000 particles that is 5000 allocations and 5000 colour
parses per frame. In the profile it appeared as `_setStroke` (6.7%),
`Color.toString` (2.0%), `Renderer2D.line` (1.4%), `Color._parseInputs`,
`_calculateLevels` and friends.

The fix splits colour from opacity. The RGB triple takes one of two values
across the whole non-glow pass, so `strokeStyle` is now assigned about twice a
frame instead of 5000 times, and per-particle alpha rides on `globalAlpha` — a
float with nothing to parse. Canvas composites source alpha as
strokeStyle-alpha × globalAlpha, so with an opaque strokeStyle the result is
identical to the string p5 was building.

Two details that keep it pixel-faithful: `p5.Color` rounds channels on the way
in, so the OkLCh glow path rounds explicitly; and p5's `line()` nudges the path
half a pixel on odd stroke widths, which at these quarter-pixel-quantized
weights happens often and is part of the tuned look — replicated by offsetting
the coordinates rather than by two `translate()` calls.

`renderParticles` at 6x: 9.21 ms → 2.98 ms.

### 2. getNearbyBoxesForPoint — was 9-10%, now absent from the profile

Two problems. It re-derived the grid cell size on every call through p5's
`max()`, which is not `Math.max` — it is a wrapper that does
`Math.max.apply(null, arguments)`, measured at 5.9x slower. That ran two to
three times per particle per frame, about 15,000 times a frame, and computed a
value that only changes when a control moves. It is now resolved once per grid
rebuild.

Second, it always ran the nine-cell scan even for particles nowhere near the
text. The grid rebuild now also tracks the bounding box of all active boxes,
inflated by the broadphase pad and one cell, so most particles are rejected on
one compare.

### 3. Per-particle Math.pow in the dune sampler → lookup tables

`sampleDuneWindForceXY` asked for two powers of its ridge value per particle per
frame: the contrast curve and the crest falloff. `Math.pow` measured at ~14 ns
against ~3 ns for a linearly interpolated 1024-entry table. Both curves are
functions of `ridge01` alone in 0..1, so one index serves both, and the tables
rebuild only when an exponent changes.

Linear interpolation, not nearest-neighbour: this feeds a force field, and a
quantized table would step the force visibly across each band.

### 4. Invisible rendering that still cost — ~3.5%

Two things were drawing nothing, every frame, at full price:

- **The flow-box overlay.** `boxStrokeIdle` ships with alpha 0, so the overlay's
  only visible output is a fully transparent border. It was still rebuilding a
  colour string and writing five inline styles per visible word — several
  hundred nodes during a scroll — dirtying style on each. 2.5% of JS plus the
  style recalc. It now short-circuits on the alpha and drops its nodes, and when
  it *is* visible it only writes the properties that changed.
- **The separation zone.** `separationZoneAlpha` ships at 0, and the loop was
  filling a rounded rect per active box per frame in a colour with no opacity.

Both come straight back the moment the corresponding alpha leaves zero.

### 5. p5.dom dropped — 21 KB

Nothing in the project used it except two `canvas.style()` calls in `setup()`;
every other piece of DOM is built with plain `document.createElement`. Written
straight onto the element instead, and the script tag is gone from both
`index.html` and the show build.

### 6. New control: Max Pixel Density

The one lever this harness *cannot* measure, added because it is the largest one
available on a weak GPU. p5 defaults the canvas backing store to the display's
device pixel ratio, so on a Retina panel every canvas has four times the pixels
of its CSS box — and there are three of them, each fully cleared and repainted
every frame. Capping at 1 quarters that.

Default is 0, meaning uncapped, so nothing changes without an explicit choice.
Wired in all three places: control panel row, `maxPixelDensity` URL param, and
the constants entry. The perf HUD now also reports the effective density and the
actual buffer size, so an operator can see what the GPU is being asked to fill.

Note that `draw()` CPU time does *not* move when you change it — the cost is
rasterisation, not JavaScript. That is also the test: if capping density does
not improve frame rate on the show machine, fill rate was never the bottleneck
and it should go back to 0.

## Verification that the look is unchanged

Deterministic screenshot, 240 stepped frames, before vs after:

```
1600x900   max channel delta 5/255   mean 0.0083   pixels differing by >1: 0.093%
```

The residual is float drift from the lookup-table approximation accumulating over
240 frames of particle motion, not a rendering difference. For reference, the
same harness produces a bit-identical image (max delta 0) across two runs of
unchanged code, so this is measuring the change and nothing else.

Smoke-tested `/index.html`, `/index.html?debug`, `/show/index.html` and
`?maxPixelDensity=1` at device pixel ratios 1 and 2: no console errors, no
exceptions, all three canvases agree on density, `globalAlpha` correctly restored
to 1 after the particle pass, and zero leftover overlay nodes. `npm run
check:show` is clean.

---

# Part 2 — Giving the quality controller something to cut

Part 1 ended on a finding: `updateParticles` was 75% of frame time and the
adaptive controller could not touch it. At 8x throttle it pinned at quality 1.0
— maximum degradation — and `updateParticles` still cost 1.97x what it cost at
4x, against a 2.0x throttle. Running the controller to its limit bought nothing.
A pinned quality reading meant the system was out of ideas, not protecting the
piece.

Two changes fix that. Both are inert at full quality: verified by the same
deterministic screenshot A/B, which still reports max channel delta 5/255 on
0.09% of pixels — identical to Part 1, so the culling machinery adds no visual
change of its own.

## Render Fraction now removes particles

It used to feed a tail ramp: particles toward the high-index end of each layer
faded and narrowed, to a depth of exactly `renderFraction`. At `renderFraction`
1 that evaluates to `lerp(1, 1, t)` — a pure identity — so the ramp only ever
existed as the mechanism of the control. Every stroke was still issued, just
fainter. That is most of the cost with none of the relief.

Measured, the old control barely did anything visually either: at 0.4 the mean
luminance of the wind field was **0.847, identical to the field at 1.0.**

Now the fraction culls, and the ramp is gone rather than stacked on top — an
early version kept both and applied the same control twice, which measured at
0.629 luminance and drained the wind out of the piece. Final state at maximum
degradation: **0.684 luminance, 81% of the full-quality field, for 34% of the
strokes.**

## Sim Fraction: a new control that reaches the physics

`particleSimFraction` drops particles out of `updateParticles` entirely. It is
held at or above Render Fraction at every point on the curve, because a particle
that has stopped moving must not keep drawing — it would burn a stationary dot
into the ink rather than lay a trail.

The two cuts are deliberately different instruments:

- **Render cut** — still simulates, just does not draw. About a fifth of the
  frame. Free to undo: the particle is where it should be, so it resumes
  mid-flight with nothing to resynchronise.
- **Sim cut** — does not move either. Three quarters of the frame, which is the
  only place left with real money in it. Expensive to undo: it comes back
  somewhere stale, so it resyncs its display position, checks whether a word
  collider has scrolled on top of it while it sat out, and fades back in on the
  scroll-freeze timer.

The controller spends the cheap reversible cut first and reaches for the physics
last.

### Particles are deactivated, not deleted

The array length never changes. Truncating it would reshuffle
`ignoresBoxCollision` — which is assigned by index — and flip particles between
render layers mid-flight, and re-adding would spawn them at random positions
with no history. Deactivation avoids all of it and makes recovery a flag flip.

### Which particles get cut

Index times the golden ratio conjugate, fractional part. Two properties matter
and the obvious schemes get neither:

- **Stable** — the same particle makes the same decision frame after frame, or
  particles strobe, and since this piece deposits persistent ink a strobing
  particle lays a dashed trail instead of a smooth one.
- **Monotone** — the set kept at 0.7 contains the set kept at 0.6, so a drifting
  fraction switches particles one at a time instead of reshuffling which are
  lit. A plain hash flips an arbitrary subset in both directions at once.

It is also a low-discrepancy sequence, so every render layer keeps its
proportional share without the cull knowing anything about how the array is
divided.

The rank is stamped on the particle at creation rather than recomputed: called
inline at three sites it was 15,000 float modulos a frame and profiled at 2.7%
of all JS. Caching it took maximum-cull frame time from 9.48 ms to 8.01 ms.

## Stopping the controller from hunting

Putting a slow, expensive-to-reverse plant inside an integrating loop is the
classic recipe for oscillation, and it duly oscillated. At 8x throttle the first
working version swung the level between 0.82 and 1.00 and the particle count by
**15% on a roughly thirty-second cycle** — precisely the density pulsing the
continuous quality curve was introduced to eliminate.

The cause is saturation: at maximum degradation frame time lands exactly on
budget, the error crosses zero, so the controller recovers, which puts it back
over budget. Zero error is not evidence of headroom; it is evidence of sitting
on the limit.

Two gates, scoped to the sim fraction alone so the level keeps its
deadband-free recovery:

1. Particles only come back when frames are running **12% under budget**, not
   merely at it.
2. And only when that margin has **held for 4 seconds** — `avgFrameMs` is a
   short EMA that dips on transients, and an instantaneous test let those dips
   put particles back that the next second took away.

Measured over 100 s at 8x throttle:

| | level swing | simFrac swing | mean frame ms |
|---|---|---|---|
| no gate | 0.182 | 0.155 | 35.02 |
| headroom gate | 0.328 | 0.088 | 33.19 |
| + sustained gate | 0.218 | **0.000** | **33.36** |

The particle count does not move at all once settled, frame time sits dead on
the 33.33 ms budget, and what still wobbles is the render fraction — the cheap,
instantly reversible knob that only touches the faintest particles.

Recovery still works: throttle lifted at t=60 s, sim fraction back to 0.96 by
t=72 s and 1.00 by t=85 s. No latching at the low-water mark.

## Result

`draw()` mean, and the frame rate actually achieved:

| CPU throttle | Original | After Part 1 | After Part 2 | Quality settled at |
|---|---|---|---|---|
| 6x  | 25.16 ms | 14.75 ms | 13.20 ms | 0.36 |
| 8x  | 32.68 ms | 19.35 ms |  9.58 ms | 0.96 |
| 10x |    —     | 23.40 ms | 11.13 ms | 1.00 |

The throttle at which the piece still holds its 30 fps target moved from about
**5x to about 8x**. At 8x it now delivers 30.9 fps where Part 1 managed 24.7.

## Where the wall is now, and it is not JavaScript

At 10x throttle `draw()` costs 11.13 ms and the frame takes 37.9 ms. **Twenty-
seven of those milliseconds are not JavaScript at all.** With the cull engaged,
the CPU profile puts 63% of time in `(program)` — native rasterisation,
compositing and style.

That is the answer to how far this goes. Culling particles has done its job so
thoroughly that the piece is no longer CPU-bound at any throttle level tested;
it is bound by filling three full-screen canvases every frame. On a Retina panel
at 1600x900 that is 3200x1800 pixels, three times over, cleared and repainted
sixty times a second.

`maxPixelDensity` is the lever for that, and it is the one this harness cannot
measure honestly — headless Chrome's compositing path is not representative of a
real GPU. At 10x throttle capping density to 1 moved the frame from 38.7 ms to
35.6 ms, an 8% gain. On an integrated GPU, or a machine falling back to software
rasterisation, expect substantially more. On a machine that is purely CPU-poor
but has a competent GPU, expect nothing — and that is the test.

## Still deferred, still probably unnecessary

Structure-of-arrays particle layout and Web Worker + OffscreenCanvas, both
carried over from `performance-plan.md`. Neither addresses fill rate, which is
now the binding constraint, so both are further from worthwhile than before.

The one thing that *would* address it is drawing fewer than three full-screen
canvases — collapsing the two ink layers, or shrinking the foreground layer to
the text band rather than the whole viewport. That is a change to how the piece
is composed, not an optimisation, so it is not something to do without deciding
it is wanted.

## Recommended procedure on the show machine

1. Open `?debug` and read the HUD. The line that matters is `Sim n (x.xx) |
   Drawn n (x.xx)` alongside Avg Frame and Quality.
2. **Let it run for a minute before judging.** The controller now settles rather
   than hunting, but settling takes a while by design — the sim fraction will
   not move until frames have been comfortably under budget for four seconds.
3. If Quality settles near 0, there is nothing to do.
4. If Quality settles high but Avg Frame is at target, the piece is doing its
   job: it has traded density for smoothness and will hold there. Check that the
   thinner field still looks right to you — that is an aesthetic call, not a
   technical one.
5. If Quality is pinned at 1.0 **and** Avg Frame is still over budget, the
   controller is out of room. Compare `draw` time against the frame time: if
   most of the frame is not `draw`, you are fill-rate bound, so try **Max Pixel
   Density 1**. If it is mostly `draw`, lower **particleCount**.
6. Bake the chosen values into `src/js/constants/config.js` and re-run
   `npm run build:show` — the show build discards URL params by design.

To measure rather than eyeball, `tools/perf/settle.mjs` reports whether the
controller converges at a given throttle, and `--release` checks that it
recovers when the load comes off.
