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

## Phase 2 — Chugging Fix (hours)

5. **Span culling with IntersectionObserver** — `scroll.js`
   - 1,189 `<span>` elements all triggering layout reflow every frame
   - 495 of them are at `-9999px` (permanently off-screen) and still being computed
   - Most likely cause of FPS degradation over time

6. **Convert font to WOFF2** — `index.html`
   - TTF is uncompressed; WOFF2 (Brotli) is typically 30–50% smaller
   - Load-time only, no runtime impact

### Measurements for Phase 2
- 5-minute degradation test before starting
- Same test after item 5 — does chugging still occur?

---

## Phase 3 — Larger Investment (future)

7. **Bundle + minify with Vite or esbuild**
   - ~792 KB of unminified JS across 13 files → likely under 200 KB bundled
   - Load-time improvement, no runtime FPS impact
   - Do this after runtime issues are resolved so you can measure cleanly

8. **Web Worker + OffscreenCanvas**
   - Move physics + rendering off the main thread entirely
   - Biggest possible performance unlock, but significant architectural work given p5.js coupling
   - Revisit after Phase 1 & 2 — may not be necessary once noise is removed

---

## What's Already Good (don't touch)

- Adaptive quality system — tiered quality with cooldowns is the right approach
- Map-based spatial grids — separation, boid, and box grids avoid O(n²) pair checks
- JS heap usage — ~18 MB used / ~88 MB allocated is healthy for a live particle system
- Separation pair budget — 70,000-pair cap prevents runaway CPU cost
