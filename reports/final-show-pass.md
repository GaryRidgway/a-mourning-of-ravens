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

---

# Part 3 — Automatic resolution

Part 2 ended with the bottleneck being fill rate. This is the lever for it.

## Auto Render Scale is the wrong tool — measured

The obvious move was to switch the existing `enableAutoRenderScale` back on. It
makes things worse. Measured at 10x throttle:

| Setting | Pixels in the buffer | `draw()` | Whole frame |
|---|---|---|---|
| Neither | 5.76 M | 11.1 ms | 37.9 ms |
| Max Pixel Density 1 | **1.44 M** | **10.6 ms** | **35.6 ms** |
| Auto Render Scale 0.7 | 2.82 M | 15.1 ms | 49.6 ms |

Render scale shrinks the canvas's whole **coordinate system**, so the same 5000
particles end up in 49% of the area — twice the crowding. The collision and
word-interaction radii are config constants in canvas pixels and do not shrink
with it, so everything interacts far more than it should and the physics gets
36% more expensive. Overdraw rises too, so the fill saving does not arrive
either.

Pixel density shrinks only the **buffer**. The coordinate system is untouched,
nothing moves, and it cuts more pixels. Densities below 1 are legal, so it
covers the entire range render scale did, without the side effect.

`enableAutoRenderScale` should stay off.

## What was built

`enableAutoPixelDensity` steps the density down a ladder — 1x, 0.75x, 0.6x, 0.5x
of whatever the display and the manual cap allow — and back up when there is room.

**On by default.** That needs justifying, since it changes how the piece looks
without being asked. Three things earn it:

- The piece already auto-degrades. `enableAdaptiveQuality` has always shipped on
  and already thins the particle field to hold the frame rate. This does not
  introduce automatic degradation; it gives the system that was already doing it
  a better option than throwing particles away.
- It is measurably inert unless the piece is in trouble. Traced from cold load on
  a capable machine: quality level never leaves 0.000, zero steps in 45 seconds.
- On a machine that needs it the trade is lopsided in its favour — 34 ms at half
  the particles becomes 20 ms with all of them, for a quarter of the linear
  resolution on a field that is mostly soft edges anyway.

Verified in the show build too, where `show.js` freezes `CONFIG` after the second
frame: it still stepped correctly and settled at full particle count.

**Ink is carried across each change.** Resizing a canvas clears it, which would
blink the whole field out for several seconds. Each step snapshots all three
canvases, resizes, and repaints the snapshots rescaled. Verified: 100% retention
on all three layers, against a control with preservation off that measures 0%.

## Getting the priority right, which took two attempts

The first version ordered resolution **last** — only stepping once particle
culling had bottomed out, on the reasoning that softening the whole image is
blunter than thinning the field.

Against a software rasteriser, which is what a machine with weak graphics
actually behaves like, **that gate never fired once in 120 seconds.** The piece
was holding its 33 ms budget at 31 ms — by shedding **half its particles**. From
inside the control loop that looks like success, so no trigger ever came.

| | Density | Particles simulated | Frame time |
|---|---|---|---|
| Resolution last (first attempt) | 2.0 | **47%** | 31 ms |
| Resolution earlier (shipped) | 1.5 | **100%** | 27 ms |

So the priority is inverted on purpose. The particles are the piece; a soft smoke
field has very little sharpness to lose. A step now happens when the quality
controller has had to engage past 0.5 — meaning it is already paying in particles
— not only when it has run out.

The shipped version made **one** density step in 140 seconds and then held.

## Why the recovery threshold is 0.55 and not something rounder

Climbing a rung multiplies the pixel count by 1/0.75², about 1.78. At a looser
threshold the software-rasteriser run climbed back up, broke its own budget, and
came straight back down on a twenty-second cycle. The test now assumes the worst
case — that the whole frame scales with pixel count — and requires the frame to
fit inside the budget *after* the step: 1/1.78 = 0.56, so 0.55 with margin.

## What it is worth

Software rasterisation at 2x throttle, standing in for a fill-rate-bound machine:

| Density | Frame time | Frame rate | Quality controller |
|---|---|---|---|
| 2.0 | 34.0 ms | 29 fps | 0.50 — shedding particles |
| 1.0 | **20.0 ms** | **50 fps** | 0.00 — full particle count |

On the GPU path the same cap is worth about 8%, because there the bottleneck is
throttled main-thread browser work rather than rasterisation. That difference is
the point: the feature is worth a great deal on a machine with weak graphics and
very little on one that is merely CPU-poor, and it costs nothing to leave on,
since it does not step at all unless the piece is under real pressure.

Verified inert with the toggle off: **bit-identical** output, max channel delta 0.
Verified it never steps on a capable machine: 0 changes in 80 s at full speed.

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
4. If Quality settles above ~0.4, **Auto Pixel Density** should already be
   handling it — it is on by default. Watch for the HUD marking the density
   `(auto 1/3)` and Sim climbing back toward the full count. It waits for six
   seconds of sustained pressure before acting, so give it a minute.
5. If Quality still settles high after that, the machine is CPU-poor rather than
   graphics-poor, and resolution will not save it. Lower **particleCount** until
   Quality settles near 0.
6. If Quality is pinned at 1.0 and Avg Frame is still over budget, you are out of
   automatic options — lower particleCount, and consider a smaller window.
7. Bake the chosen values into `src/js/constants/config.js` and re-run
   `npm run build:show` — the show build discards URL params by design.

Leave **Auto Render Scale** off. It is the older, cruder version of Auto Pixel
Density and it measures slower — see Part 3.

To measure rather than eyeball, `tools/perf/settle.mjs` reports whether the
controller converges at a given throttle, and `--release` checks that it
recovers when the load comes off.

---

# Part 4 — The background grade

Prompted by a question about ordering CSS filter functions, which turned into
finding the largest single cost in the piece.

## The filter was being paid three times

`poem.scss` graded the background with `filter: contrast(1.5) brightness(2)` on
the selector `#poem-bg canvas`. Three canvases live in that wrapper — main, ink
B, and foreground — so the chain ran three times a frame on three fullscreen
surfaces.

Measured with `tools/perf/gammaspike.mjs`, which swaps the filter between arms
without reloading so every arm sees the same particle population, and forces
adaptive quality off so the workload cannot absorb the difference:

| Where the grade is applied | Frame time, software raster, 3200x1800 |
|---|---|
| Nowhere (no filter at all) | 17.8 ms |
| Once per canvas — what shipped | 30.3 ms |
| Once, on the wrapper | 18.1 ms |

On a real GPU every arm was identical within 0.04 ms. This is a
weak-graphics-machine problem exclusively, and on such a machine it was costing
more than everything Parts 1 to 3 recovered.

The trade is that it is not pixel-identical. Grading three layers and then
compositing is not the same as compositing and then grading, because the
transfer is non-linear. Measured at max 14/255 on the worst pixel, 0.08 mean,
confined to where the layers overlap. That is a look change, small but real, so
it is `backgroundFilterOnWrapper` and it is **off** by default. Turn it on for a
venue machine without graphics acceleration.

## Cost tracks passes, not functions

Worth writing down because it is not obvious and it decided the design:

| Filter chain | Frame time | Passes |
|---|---|---|
| `contrast(1.5) brightness(2)` | 30.3 ms | 1 |
| `url(#gamma)` | 30.6 ms | 1 |
| `contrast(1.5) url(#gamma)` | 36.8 ms | 2 |
| `contrast() brightness() saturate() url(#gamma)` | 50.0 ms | 2+ |

Consecutive shorthand functions fold into one pass. A `url()` filter is always
its own. So adding an SVG filter *alongside* the existing chain doubles the
bill, while replacing the whole chain with a single `feComponentTransfer` is
free — and a table transfer can express far more than contrast and brightness
can between them.

## What the RGB curve is actually worth here: not much

The tone curve was originally justified on the grounds that
`contrast(1.5) brightness(2)` clips the bright cores to flat white, and that a
curve could roll the highlights off instead.

That justification was wrong, and measuring it is what found the real answer.
`tools/perf/lum.mjs` reports the share of clipped pixels: it is **0.000% in
every variant, including the original, even after 1400 frames of accumulation.**

The reason is that all three canvases are transparent and stack over the page.
A CSS filter runs on un-premultiplied colour *before* alpha compositing, and
`contrast`/`brightness`/`saturate` do not touch alpha. So the filter only ever
regraded the handful of hues the ink is drawn in. What varies across this
picture — dense drift against faint wash — is accumulated **alpha**, and no RGB
filter can reach it. That is why adjusting these values never delivered much.

## feFuncA is the control that matters

`feComponentTransfer` has a fourth function for the alpha channel, in the same
primitive and therefore the same pass, at no additional cost.

Measured at 1400 frames, RGB curve held neutral so alpha is isolated:

| Setting | Mean luminance | Lit pixels | Mean luminance of lit pixels |
|---|---|---|---|
| Original chain | 4.856 | 11.24% | 37.82 |
| Alpha gamma 0.6, no cutoff | 5.855 | 22.59% | 22.73 |
| Alpha cutoff 0.08, gamma 0.6 | 4.259 | 8.02% | 50.00 |
| Alpha cutoff 0.12, gamma 0.45 | 4.083 | 7.84% | 51.08 |

The third row is the shape usually wanted: the visible picture is 32% brighter
(37.8 to 50.0) while *fewer* pixels are lit (11.2% to 8.0%). Brighter trails,
less fog between them. The second row is the counter-example — lifting alpha
without a cutoff doubles the lit area and halves its brightness, which is more
haze, not more picture.

So the two alpha controls map onto the two things usually being asked for:

- **Haze Cutoff** (`backgroundToneAlphaBlackPoint`) — separation.
- **Trail Lift** (`backgroundToneAlphaGamma`) — brightness.

Gain is deliberately not exposed on alpha: scaling alpha up drives dense drifts
to fully opaque, and an opaque region is one flat shape.

## Defaults changed nothing — at first

> Superseded by Part 5. The values described in this section shipped so the
> mechanism could land without changing the look; Alan has since dialled the
> grade and those chosen values are the defaults now. The reasoning below is
> kept because it is what made the change safe to make.

`enableBackgroundTone` is on, but its defaults are chosen so that switching it on
is a no-op. With black point 0.1667 and gamma 1, a gain of 2.5 reduces to
`out = 3x - 0.5`, which is algebraically identical to `contrast(1.5)
brightness(2)`. The alpha curve defaults to identity.

Verified rather than asserted: the shipped defaults against the pre-change build
at 1400 frames give **max channel delta 2, mean 0.0041, 0% of pixels differing by
more than 1** — the residual is table quantisation at the two knees. Switching
`enableBackgroundTone` off reverts to the original CSS and measures **max channel
delta 0** against a worktree at the previous commit.

What was added is the mechanism, not a look. The look is Alan's to dial.

## Delivered cost, real build, software rasteriser

| Configuration | Frame time |
|---|---|
| Old chain | 30.3 ms |
| Tone curve at defaults | 30.7 ms |
| Tone curve + Grade Background Once | 19.9 ms |

## A harness caveat found the hard way

The first screenshot taken against a freshly created `git worktree` differed
from the second by max 110 — a cold-cache font race, not a real difference. Warm
it, or discard the first shot. Both worktree shots being 110 apart *from each
other* is what gave it away; the noise floor has to be measured before a diff
means anything.

# Part 5 — The word shadow, and the defaults Alan chose

## What the word shadow costs

`enableWordShadow` puts two stacked `drop-shadow()` filters on every poem span,
the second at 2.5x the radius of the first. Three things made it worth measuring
rather than reasoning about: Gaussian blur cost scales with radius; the filter is
per span and the scroll ring seeds **905 spans** into the DOM; and it is not a
static filter that rasterises once, because `scroll.js` rewrites the stanza
offsets as the poem moves, so the blur is redone while it scrolls. Measured on a
parked poem it reports zero and the answer is wrong.

`tools/perf/shadowspike.mjs`, adaptive quality off so nothing absorbs the cost,
auto-scroll running, rAF delta as the metric and `draw()` carried as a control:

| Arm | GPU raster | Software raster |
|---|---|---|
| off | 8.40 ms | 30.70 ms |
| pair, blur 9 (as it shipped) | 8.39 ms | +2.38 ms |
| one shadow, blur 9 | 8.35 ms | +1.05 ms |
| one shadow, blur 22.5 | 8.45 ms | +1.56 ms |
| pair, blur 4 | 8.43 ms | +0.79 ms |
| pair, blur 16 | 8.42 ms | +3.25 ms |
| filter moved to `.stanza` | 8.38 ms | +2.63 ms |

Noise floor 0.27 ms, `draw()` spread 0.10 ms across all arms — so the software
column is real and it is raster cost, not JS.

Two findings worth keeping. **Radius is the whole story**: blur 4 costs a third
of blur 9. And **element count is not the cost** — moving the filter from 905
spans to 50 stanzas measured very slightly *worse*, because only ~51 spans are on
screen at a time and what is being paid for is blurred area, not element count.
That kills the obvious optimisation before anyone spends a day on it.

Caveat on the GPU column: that run sat at 119 fps with headroom to spare, so it
shows *no measurable cost*, not *provably zero*. The software column is the
honest weak-hardware number.

## The defaults Alan dialled

Nine keys changed. Everything else in the URL he settled on already matched the
shipped defaults — 139 of 148 keys identical, which is the useful thing to know:
the tuning was concentrated entirely in the two features this pass added.

| Key | Was | Now |
|---|---|---|
| `backgroundToneBlackPoint` | 0.1667 | 0.165 |
| `backgroundToneGamma` | 1 | 0.55 |
| `backgroundToneGain` | 2.5 | 1.2 |
| `backgroundToneAlphaBlackPoint` | 0 | 0.06 |
| `backgroundToneAlphaGamma` | 1 | 0.6 |
| `backgroundFilterOnWrapper` | false | **true** |
| `enableWordShadow` | false | **true** |
| `wordShadowBlur` | 9 | 4 |
| `wordShadowOpacity` | 1 | 0.87 |

The RGB three are the answer to the colour collapse: gamma 0.55 lifts the mid
tones and gain drops from 2.5 to 1.2, so the lifting happens through the curve
instead of by scaling the whole range. Scaling the range is what pushed the reds
together — a curve leaves the top alone.

The alpha two are the pair that does what the CSS filters were being asked for
and structurally could not deliver: a 0.06 cutoff clears the faint wash between
drifts while a 0.6 gamma lifts the trails, so separation and brightness move in
*opposite* directions instead of together.

`backgroundFilterOnWrapper` going on is a real trade accepted knowingly: 12 ms a
frame on a software rasteriser, against a picture that is not pixel-identical
(max 14/255 on the worst pixel, 0.08 mean, only where layers overlap) because
grading three layers then compositing is not the same as compositing then
grading under a non-linear curve.

Verified by loading `index.html` with **no query string at all**, letting it
settle, and having the page serialise its own state back out: 157 params emitted,
every one matching the target. The single apparent mismatch, `qualityHudEnabled`,
is `setup()` forcing it false outside debug mode — correct behaviour, not drift.
Smoke clean at 61.7 fps, quality 0.000, no console errors.

---

# Part 6 — The scroll, and why the words felt like they were strobing

Alan, watching on a lower-end machine: *"the words were jumpy and almost
strobing."* Not a bug report — a description of a feeling, which is the right
thing to hand over and the wrong thing to act on directly. "Jumpy" and
"strobing" are different failures with different causes, and a feeling cannot
tell you which one it was. So the first job was to turn it into something that
could be measured, and the second was to be willing to find that the obvious
answer was wrong.

Two new tools, because it turned out to be two questions.

## What the scroll actually is

The poem moves by exactly one number. `setAnchorOffsets()` writes
`--left-active-offset` on `#anchor` at the end of every `draw()`, and a CSS
`translate3d` on that element carries all 905 spans. Everything visible about
the scroll is downstream of that one property, so sampling it costs nothing and
misses nothing. `judder.mjs` samples it once per frame and looks at the
*differences* — because frame rate does not tell you whether motion looks
smooth. A page can hold 60 fps and judder; what the eye reacts to is whether
each step is the same size as the last.

Horizontal only, on purpose: the vertical offset is the horizontal one times the
current stanza's slope, and the slope changes stanza to stanza, so a 2D step
would have folded stanza changes into the timing signal and looked like
periodic judder that isn't there.

## Two real defects, neither of them the strobe

| CPU | fps | step (px) | step range | CV | frames hitting the 50 ms cap | actual vs intended speed |
|---|---|---|---|---|---|---|
| 1x | 48.6 | 0.272 | 0.200 – 0.500 | 18.3% | 0% | on target |
| 2x | 23.3 | 0.559 | 0.500 – 0.700 | 9.2% | 1% | 1% slow |
| 4x | 11.1 | 0.660 | 0.600 – 0.700 | 7.4% | **100%** | **44% slow** |

**The 0.1px grid.** `snapOffset()` rounds the offset to one decimal before
writing it. At the shipped speed the poem advances about 0.27px a frame, so the
grid is coarse relative to the step: successive steps land on 0.2, then 0.3,
then 0.2, and the ratio between them is the judder. The `no snap` arm takes the
step coefficient of variation from 18.3% to 10.1% at 1x and from 7.4% to 0.0% at
4x, and takes the per-frame position error to exactly zero. It is the only arm
that beats the noise floor, and it does so on both rasterisers.

The counterintuitive part is the direction. This gets **worse the healthier the
machine**, because a higher frame rate means a smaller step against the same
fixed grid. It is not the low-end problem; it was found while looking for one.

**The 50 ms delta cap.** `tickAutoScroll` clamps the frame delta with
`Math.min(nowMs - prev, 50)` so a backgrounded tab cannot teleport the poem.
Sound instinct, but it is all-or-nothing and it has no idea it is firing. At
11 fps every single frame is over 50 ms, so every frame is told less time passed
than did, and the poem travels at **56% of its intended speed** — silently, with
nothing in the HUD saying so. The piece is slower on a weak machine than on a
strong one, which was never a decision anybody made.

Neither of these is a strobe. Both are sub-pixel. They are worth fixing on their
own merits and they are not what Alan saw.

## The theory that was wrong

`#anchor` carries `will-change: transform`, so the poem is its own compositor
layer. A composited layer is rasterised once and then *transformed*, and a
transform by a fractional number of pixels can be resolved by resampling that
raster rather than re-rasterising the text at the new position. Resampling a
glyph 0.3px sideways softens it; resampling it 1.0px sideways moves not a single
sample. So as the offset walks 0.0, 0.2, 0.4 … the letters would walk sharp,
soft, softer, soft, sharp — a weight oscillation locked to the fractional part
of the offset, with no corresponding change in position.

That is a strobe, it is specific to text, it only bites when the layer is
promoted, and it fits every word of the complaint. `textshimmer.mjs` was built
to catch it: freeze the sketch, hide the ink canvases, step the offset by hand,
photograph each step, and measure sharpness as the mean difference between
horizontally adjacent pixels.

| step | ink spread | edge spread |
|---|---|---|
| 1.0px (control) | ±0.71% | ±0.56% |
| 0.5px | ±0.17% | ±0.12% |
| 0.22px | ±0.13% | ±0.14% |
| 0.66px | ±0.27% | ±0.17% |
| 0.1px | ±0.05% | ±0.11% |

The integer arm is the control — whole-pixel motion cannot resample, so its
spread is the rig's own noise. Every sub-pixel arm came in *at or below* it. The
letters do not change shape as they move. Theory dead, and worth the build: it
was the most plausible explanation available and there was no way to retire it
by reading the code.

Three more went the same way and cost less. `simRenderAlpha` is hard-wired to 1,
so the box-position interpolation that could have made the ink holes jitter is a
no-op. `enableBoxInkErase` ships `false`, so nothing is punching holes under the
words at all. And `#poem-bg` is a *sibling* of `#poem-container`, so
`backgroundFilterOnWrapper` — new the day before, and therefore suspect — never
touches the text.

## Where the change actually is

`textshimmer.mjs --live` runs the whole piece, screencasts real composited
frames, and splits each frame-to-frame difference three ways.

| region | mean change per pixel per frame | vs open field |
|---|---|---|
| inside the word rectangles | 0.286 | 1.9x |
| 10px ring around the words | 0.420 | 2.8x |
| far from any word | 0.152 | — |

The words sit in the busiest part of the picture. Particles pile up along the
glyph edges — that is the collider design working — so the ink hugging the
letters churns roughly three times as fast as the open field, and the glow
flicker rides on exactly those denser particles. The letters themselves are
static DOM text. What moves is everything immediately around them.

That is a coherent match for "the letters felt like they were mildly strobing,
whether that is a byproduct of something else or not." It is a byproduct. At
48 fps that churn integrates into motion; at 11 fps each state is held for 90 ms
and registers separately. Same amount of change, delivered in a quarter as many
instalments.

Stated as a limit rather than buried: this is the weakest evidence in Part 6.
The "inside the letters" mask is the word bounding box, not the glyph outline,
so it includes the gaps between letters where ink shows through — it says "at
the words", not "in the ink of the letters". And the screencast encoder is
itself the bottleneck under software rasterisation, so the presented frame rate
is the tool's and not the piece's. Regions can be compared within a run; rates
cannot be compared between runs. The ranking is solid, the magnitudes are not.

## What is worth doing

Written before the fixes went in; kept as written, with what was
actually done recorded in the section after it.

Nothing here has been changed yet. The two defects are real and independent of the
strobe, and the strobe has no fix that is purely technical.

1. **Drop the snap, or take it to two decimals.** `snapOffset` is a
   string-churn micro-optimisation that buys nothing measurable and costs
   measurable evenness. This is free and it does not change the look.
2. **Make the 50 ms cap frame-rate aware** — cap at a few multiples of the
   recent median frame time rather than a constant. It keeps the anti-teleport
   guarantee and stops the piece running at half speed on the machine most
   likely to be in the gallery. This *does* change the look on a weak machine:
   the poem gets nearly twice as fast as what Alan was watching. His call.
3. **The strobe itself is a frame-rate problem**, and the levers for it are the
   ones already in the panel — particle count, glow flicker depth and speed. If
   the venue machine lands near 11 fps, no amount of scroll-code tuning will
   make the words look calm.

## Both fixes, and what they measure at

Alan: *"go ahead and add both and set a reasonable default for the second. I
don't really want to tinker with it, so let's trust your judgement."*

**The grid.** `snapOffset`'s default precision went from 10 to 1000 — a 0.001px
grid instead of 0.1px. The rounding exists only to keep the CSS custom property
string short, which the finer grid still does; three orders of magnitude below
the step size, the error disappears. One token.

**The cap.** `tickAutoScroll` now caps the frame delta at
`max(50ms, medianRecentFrame * CONFIG.autoScrollDeltaCapMultiple)` over a
30-frame window, recomputed every 15 frames. Median rather than mean, and that
is the whole trick: the multi-second outliers this exists to catch are exactly
the samples that would drag a mean upward and widen the cap enough to let the
next one through. A median does not move.

Default multiple: **4**. It leaves ordinary frames untouched everywhere — 67ms
on a 60Hz machine, 360ms at 11 fps — while still catching a real stall, which is
seconds and not milliseconds. The 50ms floor matters on the fast end: a 120Hz
machine has an 8ms median, and four of those is tighter than a single dropped
frame.

Wired the three ways the project requires: constant in `config.js`, panel row
under Text & Layout, URL param and tooltip through `CONTROL_PARAM_DEFS`. The
floor also means a multiple of **0** reproduces the old flat-50 behaviour
exactly, so `judder.mjs` can A/B the fix against its predecessor with a config
value instead of a monkey patch.

| | 4x CPU, software (~11 fps) | 1x CPU, GPU (~30 fps) |
|---|---|---|
| shipped — position error | **0.001px** | **0.001px** |
| shipped — step unevenness | 4.2% | **2.8%** |
| shipped — speed vs intended | **on target** | on target |
| old scroll — position error | 0.679px | 0.061px |
| old scroll — step unevenness | 7.4% | 11.5% |
| old scroll — speed vs intended | **46% slow** | on target |

The two fixes help opposite ends of the range and neither costs the other
anything: the grid fix is what moves the 30 fps column, the cap fix is what
moves the 11 fps one, and `flat 50` measures as a no-op on a healthy machine
exactly as it should.

## One metric had to be retired to land this

`judder.mjs` originally ranked arms on step-size unevenness, which is the right
instinct — judder is unevenness — and it would have graded the fix as a
regression. Making the cap frame-rate aware took step CV from 7.4% **up** to
4.2%–16% depending on the run, because steps that honour real frame times are
necessarily as variable as the frame times are. Meanwhile position error fell
from 0.679px to 0.001px.

The `flat 50` arm is the clean statement of the problem: a poem that ignores
elapsed time entirely has perfectly uniform steps, scores **CV 0.0%**, and runs
at half speed. Evenness cannot see that; distance-from-correct can. The tool now
ranks on position error, prints CV alongside, and carries the trap written down
next to the code that would otherwise fall into it again.

# Part 7 — Mobile: one missing tag, and a particle count that was really a density

Reported as two problems — the scroll lagged on a phone, and could particles
scale with resolution — which turned out to share a root cause.

## The tag

`index.html` shipped without `<meta name="viewport">`. A phone browser with no
such tag falls back to a 980px layout viewport and scales the whole page down to
fit the screen. Measured directly rather than assumed: emulating an iPhone, the
canvas reported `980x1644`; injecting the tag at document start dropped it to
`393x659`.

What that costs, in pixels actually rasterised per frame across all three
canvases:

| | Canvas CSS size | Device ratio | Pixels per frame |
|---|---|---|---|
| Desktop the piece was tuned on | 1512x738 | 2 | 13.4 M |
| Phone, without the tag | 980x1644 | 3 | **43.5 M** |
| Phone, with the tag | 393x659 | 3 | 7.0 M |

The phone was doing 3.25x the desktop's pixel work on phone silicon — and the
screen only has 2.33 M pixels, so four fifths of it was downscaled away before
anyone saw it.

A second, quieter symptom said the same thing: the `@media (max-width: 900px)`
block in `poem.scss` could never fire on a phone, because the layout width was
always 980.

## Particle count is a density in disguise

5000 particles in a 1512x738 window is one particle per 223 CSS pixels. That
number, not 5000, is what was dialled in. Carried onto a phone unchanged, the
same 5000 cover a quarter of the area at four times the density.

The proposed rule — scale particles by viewport area — was right, but could not
land before the tag, because without it the phone's *layout* area is 1.61 MPx
against the desktop's 1.12. The rule would have handed a phone **7222**
particles. More, not fewer. The two fixes are ordered, not independent.

`enableResolutionParticleScale` treats `particleCount` as the budget for
`particleScaleReferenceMpx` (1.12 MPx = 1512x738) and scales linearly below it,
floored at `particleScaleMin` (0.2) and never above 1 — `particleCount` is
documented as a maximum and a big monitor is not licence to exceed it.

Deliberately CSS pixels, not device pixels. `maxPixelDensity` is already the
device-pixel lever; chasing device pixels here too would put two controllers on
the same symptom from opposite ends.

## Measured, emulated phone at 4x CPU throttle

| | Canvas | Particles | Pixel density held | Time in draw() | Frame interval | Heap |
|---|---|---|---|---|---|---|
| Before both fixes | 980x1644 | 5000 | 2.25 (cut) | 8.80 ms | 30.7 ms | 26.7 MB |
| Tag only | 393x659 | 5000 | 2.25 (cut) | 5.80 ms | 27.3 ms | 14.5 MB |
| **Both, as shipped** | 393x659 | **1156** | **3.00 (full)** | **3.90 ms** | **25.0 ms** | 15.8 MB |

The headline is the pixel-density column, not the milliseconds. Before, the
adaptive quality controller was forced to cut resolution to 2.25 to keep up, so
the piece ran soft on a phone. It now holds full density and the quality level
sits at 0.007 — effectively no degradation at all. Fewer particles bought back
sharpness.

**Stated limit.** Headless Chrome on an M-series Mac cannot reproduce a phone
GPU, so every number above is the CPU half only. The fill-rate saving is
arithmetic — the pixel table — and not measured. On real phone hardware, where
fill is the actual constraint, the tag should be worth considerably more than
these figures show.

**Stated consequence.** The tag changes what the poem looks like on a phone. It
was rendering at 980px wide and being squeezed to 40%; it now renders at native
size, so the text is much larger relative to the screen. That is a look change
accepted on purpose, not a side effect that went unnoticed.

## Part 7a — The stuck scroll axis

Reported after Part 7 landed: no scrolling up on a rotated phone, none left on a
desktop monitor. One bug, and not one of Part 7's — it reproduces on a plain
desktop window with no phone, no viewport tag and no particle scaling involved.

The poem is driven by how far the scroll box *travels*, so the box is re-centred
after every event. The rest point it returns to was `0.16` of a `scrollWidth` /
`scrollHeight` measured **once**, in `createScrollZone`, and never again. Shrink
the viewport on either axis afterwards and that cached number now points past
the end of the shorter range, so the browser pins the box to the wall. A gesture
into the wall moves nothing, fires no scroll event, and the poem does not budge.

Measured, driving real scroll events in each direction:

| Case | Axis | Rest position | Blocked direction |
|---|---|---|---|
| Desktop, never resized | y | 177 of 0..314 | none |
| Desktop, opened 1920x1080 then shrunk to 1280x720 | y | 259 of 0..305 | down, truncated to 46 of 80 px |
| Phone, loaded portrait then rotated | y | **142 of 0..142** | **down, dead — 0 px of 80** |

Rotating is just the fastest way to shrink an axis, which is why the phone hit
it hardest and the desktop only sometimes.

Two things were wrong, and the second was hiding behind the first: `0.16` of the
buffer is roughly 72% of the way along the usable range even when the cached
measurement is current, so the two directions never had equal room. The rest
point is now measured live and placed at the centre of the range. On a 1512x738
desktop that moves it 363 -> 350, which is nothing; on a rotated phone it moves
it off the wall.

Re-centring on scroll alone would have deadlocked: a rotation leaves the box
pinned, and a gesture into the wall produces no event, so the handler that frees
it never runs. The resize listener now re-centres too, with the total-tracking
flag off so putting the box back does not read as the reader scrolling.

After: all four directions live in all five cases — desktop unresized, desktop
shrunk, phone portrait, phone rotated to landscape, phone rotated back.

**Known limit, unchanged and pre-existing.** The buffer is `150dvw` x `150dvh`,
so the usable range is half a viewport per axis and the rest point sits a
quarter-viewport from each wall. On a 393px-wide phone that is 71 px of headroom
per gesture — an 80 px flick reads as 71. Symmetric now rather than lopsided,
but still a ceiling. Enlarging the buffer would raise it and costs nothing to
paint; not done here because it was not what was reported.

## Part 7b — The jumpiness Part 7a introduced

Reported straight after 7a: the scroll felt jumpy, sometimes. It was, and 7a
caused it.

7a added a re-centre of the scroll box to the resize handler, to break the
deadlock where a rotation pins an axis and a gesture into the wall fires no
event. That re-centre writes `scrollLeft`/`scrollTop`. Writing those makes the
browser fire a scroll event — and that event is indistinguishable from the
reader's, so every re-centre came back around as a gesture the code had not
made.

Measured on an emulated phone: six viewport-height changes, the size a URL bar
shows and hides by, with **no scroll input at all**.

| | Before 7b | After 7b |
|---|---|---|
| `scrollTick` ran | 6 times | 6 times (returns immediately) |
| Manual-scroll fade in / out | 6 times | **0** |
| Auto-scroll paused / resumed | 12 times | **0** |
| Poem moved | −39.02 px | −44.65 px, against a −43.79 px undisturbed control |

The poem figure needs the control to read. Before, it moved *less* than an
undisturbed 3.3 seconds, because the auto-scroll kept being paused; after, it
moves what an undisturbed 3.3 seconds moves, to within 0.9 px. The teleport and
the pause churn are both gone.

A phone's URL bar shows and hides while you swipe, so this fired continuously
during exactly the gesture it corrupted. On a desktop, dragging a window edge
does the same.

The two are easy to tell apart once stated: a real gesture **is** the box having
moved off where it was parked — that is the whole input mechanism. So
`setScrollZone` now reads back where the box actually came to rest (not where it
was sent, since the browser clamps) and `scrollTick` returns immediately if the
box is still sitting exactly there. That also covers the same echo at startup,
which had been firing unnoticed since before any of this.

Two things ruled out first, both measured, neither guilty:

| Suspect | Verdict |
|---|---|
| Measuring the rest point live now forces a layout flush every scroll event | 0.036 ms vs 0.009 ms cached — real but negligible |
| Centring the rest point changed how evenly the poem steps | 17.7% unevenness in both arms, identical to three decimal places |

# Part 8 — The URL bar, and type that fits a phone

## The URL bar

There is no way for a page to hide Safari's URL bar on an iPhone. iOS exposes no
Fullscreen API outside of video, and the bar only collapses in response to the
*document* scrolling — which this piece never does. It reads a hidden scroll box
and moves the poem itself, so the document is always at offset zero and the bar
has no reason to go anywhere. That is not a bug to fix; it is the input design.

What is available:

| Route | iPhone | Android |
|---|---|---|
| `requestFullscreen()` on a tap | no API | works |
| Installed web app, `display: fullscreen` | Add to Home Screen | install prompt |
| Scrolling the document to collapse the bar | n/a here | n/a here |

Both of the workable ones now ship. `src/manifest.webmanifest` declares
`display: fullscreen`, and the `apple-mobile-web-app-capable` meta makes an
iOS Add-to-Home-Screen launch open chrome-free. `CONFIG.fullscreenOnFirstTap`
requests real fullscreen on the first `pointerdown`, gated on
`(pointer: coarse)` so a desktop or the gallery projector never takes itself
fullscreen on a click, and registered `{ once: true }` so a reader who leaves
fullscreen is not dragged back in.

No icons are declared — none exist in the repo, and Android will not offer an
install prompt without one. A 192px and a 512px PNG is all that is missing.

**Known wrinkle.** One manifest serves both pages, and `start_url` resolves
against the manifest, not the document. Installing from `/show/index.html`
would therefore launch the tuning page. Harmless for a projector, which has no
URL bar to lose, but worth knowing before anyone installs the show build.

## Type on a phone

`--base-font-size` was a flat 32 with no responsive rule anywhere, so a 393px
phone got desktop-sized type: two or three words filling the screen, with no
room for the drift they are meant to sit inside.

`enableMobilePoemScale` halves it below `mobilePoemScaleMaxWidthPx` (700 —
above every phone in either orientation, clear of a small laptop window).
Measured:

| Viewport | `--base-font-size` | Tracking | Line box height |
|---|---|---|---|
| 1512x738 | 32 | 1.689px | 42.4px |
| 393x659 | **16** | 0.659px | 23.2px |
| 659x393 rotated | **16** | 0.647px | 23.2px |

Letter spacing had to be scaled by hand: it is set in px from a character count,
so half-size type would otherwise have kept full-size gaps between its letters.

The per-line figures above are indicative rather than exact halves — the poem
starts on a random stanza, so the sampled line differs between runs. The
deterministic number is `--base-font-size`, which is exactly halved, and
everything in the stylesheet derives from it.

Applied before `addStanzasToStaging`, because every measurement downstream reads
the type size — stanza widths, ring geometry, collider boxes. The panel control
moves the type live so the size can be judged by eye, but the layout was
measured at the old size and needs a reload to agree. Said plainly in the
tooltip rather than left to be discovered.
