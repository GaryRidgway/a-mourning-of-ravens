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

## Phase 3 — Larger Investment (future, lower priority)

Post-2B profiling shows ~40 FPS at full Tier 0 quality with 33% headroom above the 30 FPS target. Items 11 and 12 are unlikely to be needed unless particle count or feature complexity increases significantly.

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

- Adaptive quality system — tiered quality with cooldowns is the right approach
- Map-based spatial grids — separation, boid, and box grids avoid O(n²) pair checks
- JS heap usage — ~28 MB used / ~96 MB allocated is healthy for a live particle system
- Separation pair budget — 70,000-pair cap prevents runaway CPU cost
- Pre-allocated scratch objects — `_duneWindResult`, `_boxInfluenceResult`, etc. eliminate per-frame GC from inner loops
- Frame cache — trig (wind/dune angles) computed once per frame, not per particle
- Stroke state deduplication in `renderParticles` — skips redundant canvas state changes
- Auto render scale — canvas downscaled on large viewports, keeps GPU fill rate in check
- Fixed-timestep sim loop — decoupled from render, prevents physics instability on slow frames
