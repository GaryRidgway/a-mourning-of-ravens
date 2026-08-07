# Performance Improvement Plan

---

## Phase 1 — Quick Wins ✅ Complete

1. ✅ **Remove `p5.get()` + console debug block** — `flowField.js`
   - GPU→CPU readback firing every frame; dead instrumentation code
   - Highest runtime impact of any change

2. ✅ **Remove `p5.sound.min.js`** — `index.html`
   - 143 KB unused library with an audio context running for no reason

3. ✅ **Add `defer` to all script tags** — `index.html`
   - 12 script tags now defer, unblocking HTML parsing

4. ✅ **Add `will-change: contents` to canvas CSS** — `index.html`
   - Hints to the browser to keep the canvas on a dedicated GPU compositor layer

### Measurements for Phase 1
- ✅ Baseline captured — see `reports/pre-phase-1.md`
- ✅ Post-phase-1 results — see `reports/post-phase-1.md`

**Outcome:** FPS locked at 30 as expected (adaptive quality system absorbs headroom). Real gains: stddev 0.42ms → 0.24ms (smoother frames), frames under 33ms 25% → 42%, heap used 45.8 MB → 32.1 MB. Frame time ceiling now set by sim physics alone.

---

## Phase 2 — Chugging Fix ✅ Complete

5. ✅ **Hide staging area after ring seeding** — `scroll.js`
   - `#poem-staging` positioned at `-9999px` with all its `<span>` elements still in layout
   - After `seedFixedCycleRing()`, all measurements are captured in data attributes and `_ringData`
   - `fetchStagedStanza` only needs `cloneNode(true)` which works on `display: none` elements
   - Fix: set `mourn.config.poemStaging.style.display = 'none'` after ring seeding

6. ✅ **Convert font to WOFF2** — `index.html`
   - TTF: 124,700 bytes → WOFF2: 47,768 bytes (62% smaller)
   - `@font-face` updated with WOFF2 as primary source, TTF as fallback

---

## Phase 2B — Simulation Hot Path ✅ Complete

These target the per-particle, per-frame work in `flowField.js`. Unlike Phase 2 which fixes degradation-over-time, these reduce steady-state CPU cost.

7. ✅ **Replace per-particle `noise()` with a pre-baked texture lookup** — `flowField.js`
   - 256×256 `Float32Array` noise texture baked once at `setup()` using p5's `noise()`
   - `sampleNoiseTexture()` does bilinear interpolation with bitmask wrapping — no branching
   - Tile covers 4.0 noise-space units → repeats every ~2384px at default `microNoiseScale`
   - Eliminates ~300,000 JS Perlin noise evaluations/sec

8. ✅ **Replace per-particle `sin()` in dune warp with `fastSin()` LUT** — `flowField.js`
   - 4096-entry `Float32Array` sin table, initialized at load time via IIFE
   - `fastSin()` maps input to table index with modular wrapping — single array read
   - Applied to both `sin(along / duneAlongWarpScale)` and `sin(warpedAcross)` in `sampleDuneWindForceXY`

9. ✅ **Pool separation and boid grid buckets** — `flowField.js`
   - Shared `acquireBucket()` / `releaseBuckets()` pool reuses arrays across frames
   - `separationGrid` and `boidGrid` both use pooled buckets instead of allocating fresh `[]`
   - Pool pointer reset at grid rebuild; bucket `.length = 0` clears without deallocation

### Measurements for Phase 2 + 2B
- ✅ Post-phase-2B results — see `reports/post-2b.md`

**Outcome:** Internal FPS 30 → ~40 sustained at Tier 0. Frames under 33ms 42% → 99.94%. Heap used 32.1 → 28.2 MB. Quality tier never throttled over a 5-minute degradation watch — chugging is eliminated. Frame time stddev rose 0.24 → 0.50ms but this is a vsync/sim cadence measurement artifact, not real instability.

---

## Phase 3 — Show Pass ✅ Complete

Full write-up in `reports/final-show-pass.md`. Measured against CPU-throttled
Chrome rather than the tuning machine, and by CPU time inside `draw()` rather
than by frame deltas, which are vsync-paced and report the display.

13. ✅ **Bypass p5's `stroke()` in the particle loop** — `flowField.js`
    - `p5.Renderer2D.stroke()` allocates a `p5.Color` and parses a CSS colour string per call; ~14% of all JS at 5000 particles
    - Colour now on `strokeStyle` (assigned twice a frame), alpha on `globalAlpha`
    - `renderParticles` at 6x throttle: 9.21 ms → 2.98 ms

14. ✅ **Cache the box-grid cell size and add a bounds early-out** — `flowField.js`
    - Was 9–10%, entirely from re-deriving a constant through p5's variadic `max()` 15,000 times a frame
    - Now absent from the profile

15. ✅ **Lookup tables for the dune sampler's `Math.pow` calls** — `flowField.js`

16. ✅ **Skip the flow-box overlay and separation zone when their alpha is 0** — `flowField.js`
    - Both ship at alpha 0 and were drawing nothing at full price, ~3.5%

17. ✅ **Drop `p5.dom.min.js`** — 21 KB, used only for two `canvas.style()` calls

18. ✅ **New `maxPixelDensity` control** — the fill-rate lever; default 0 (uncapped) so nothing changes without an explicit choice

**Outcome:** ~40% less CPU per frame at every throttle level, worth roughly 1.7x
the machine. At 6x throttle the adaptive controller went from pinned at maximum
degradation and still missing target, to sitting mid-range. Verified pixel-identical
by deterministic screenshot (max channel delta 5/255 on 0.09% of pixels, from
lookup-table float drift).

---

## Phase 3B — Giving the controller something to cut ✅ Complete

Phase 3 ended on a caveat: the adaptive quality system had almost no authority
over `updateParticles`, so a pinned quality level meant "out of ideas" rather
than "protecting the piece". Fixed.

19. ✅ **Render Fraction culls particles instead of dimming them** — `flowField.js`
    - The tail ramp it used to drive *was* the control, and at fraction 1 it was a pure identity
    - Measured: the old control at 0.4 produced the same field luminance as at 1.0 — it did nothing
    - Ramp removed rather than stacked; keeping both applied the same control twice and drained the wind

20. ✅ **New `particleSimFraction`, on the quality curve** — reaches `updateParticles`
    - Particles are deactivated, not deleted — the array length never changes, so layer assignment and indices stay put
    - Cull order is index x golden ratio conjugate: stable (no strobing dashed trails) and monotone (no reshuffling as the fraction drifts)
    - Held at or above Render Fraction: a frozen particle must never draw

21. ✅ **Two gates to stop the controller hunting** — `flowField.js`
    - Particles return only when frames run 12% under budget, and only after that has held 4 seconds
    - Without them the level swung 0.82–1.00 and the particle count 15% on a ~30s cycle — the density pulsing the continuous curve exists to prevent
    - Measured after: particle count peak-to-peak 0.000, frame time dead on budget, full recovery ~25 s after load lifts

**Outcome:** the throttle at which the piece holds 30 fps moved from ~5x to ~8x.
At 8x, `draw()` fell 19.35 ms → 9.58 ms. At maximum degradation the field keeps
81% of its brightness for 34% of the strokes.

**The wall is no longer JavaScript.** At 10x throttle `draw()` is 11 ms of a
38 ms frame; 63% of profiled time is native rasterisation and compositing of
three full-screen canvases. Further particle cuts will not help. See the report.

---

## Phase 3C — Automatic resolution ✅ Complete

22. ✅ **`enableAutoPixelDensity`** — steps the pixel buffer down 1x / 0.75x / 0.6x / 0.5x and back, **on by default**
    - Defaulted on because the piece already auto-degrades via enableAdaptiveQuality; this gives that system a better option than shedding particles. Traced from cold load: zero steps and quality 0.000 on a capable machine
    - Accumulated ink is snapshotted, resized and repainted, so a step does not blink the field out — 100% retention verified against a 0% control
    - Priority deliberately inverted after measurement: resolution goes *before* heavy particle culling, because the particles are the piece
    - First attempt ordered resolution last and the gate never fired — the piece held its budget by shedding half its particles, which looks like success from inside the loop
    - Recovery threshold 0.55 of budget, derived from the 1.78x pixel increase a step up costs; looser values oscillated on a 20s cycle

23. ✅ **Measured that `enableAutoRenderScale` is the wrong lever — leave it off**
    - It shrinks the coordinate system, not just the buffer, so particles crowd 2x and the fixed interaction radii make the physics 36% more expensive
    - At 10x throttle: render scale 0.7 → 49.6 ms/frame; max pixel density 1 → 35.6 ms, and draws half as many pixels

**Outcome:** on a fill-rate-bound machine (software rasteriser, 2x throttle) the
density cap takes the frame from 34.0 ms at 47% particles to 20.0 ms at full
particle count. On the GPU path it is worth ~8%, which is the honest range.

---

## Phase 4 — Larger Investment (future, lower priority)

10. **Bundle + minify with Vite or esbuild**
    - ~792 KB of unminified JS across 13 files → likely under 200 KB bundled
    - Load-time improvement, no runtime FPS impact
    - Still worthwhile for load-time cleanliness — the only Phase 3 item worth doing near-term

11. **Structure of Arrays (SoA) particle layout** — *deferred, likely unnecessary*
    - Would improve CPU cache coherence but runtime is no longer the bottleneck
    - High effort (touches every particle read/write site) — only revisit if particle count needs to exceed ~8,000+

12. **Web Worker + OffscreenCanvas** — *deferred, likely unnecessary*
    - Would move physics + rendering off main thread
    - Major architectural work given p5.js coupling — only revisit if main-thread contention becomes a problem (e.g. heavy DOM interaction layered on top of the sim)

---

## What's Already Good (don't touch)

- Adaptive quality system — now genuinely load-bearing. As of Phase 3B it can
  reach the physics via `particleSimFraction`, and it settles rather than hunting.
  A pinned quality level with frame time still over budget now means fill rate,
  not JavaScript.
- Map-based spatial grids — separation, boid, and box grids avoid O(n²) pair checks
- JS heap usage — ~28 MB used / ~96 MB allocated is healthy for a live particle system
- Separation pair budget — 70,000-pair cap prevents runaway CPU cost
- Pre-allocated scratch objects — `_duneWindResult`, `_boxInfluenceResult`, etc. eliminate per-frame GC from inner loops
- Frame cache — trig (wind/dune angles) computed once per frame, not per particle
- Stroke state deduplication in `renderParticles` — skips redundant canvas state changes
- Auto render scale — canvas downscaled on large viewports, keeps GPU fill rate in check
- Fixed-timestep sim loop — decoupled from render, prevents physics instability on slow frames
