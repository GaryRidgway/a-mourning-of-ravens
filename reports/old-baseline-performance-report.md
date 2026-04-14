# Performance Report: A Mourning of Ravens

_Generated: 14 April 2026_

---

## Runtime Snapshot

| Metric | Value |
|---|---|
| FPS (measured) | 44–68 fps (target: 30) |
| Avg frame time | ~14–33ms (variable) |
| JS heap (used) | ~18–24 MB |
| JS heap (allocated) | ~88 MB |
| Canvas internal size | 2266 × 1364 px (DPR = 2) |
| Canvas logical size | 1133 × 682 px |
| Total DOM elements | 1,928 |
| Word `<span>` elements | 1,189 |

---

## Issues Found

### 1. `p5.get()` Called Inside the Draw Loop

**Severity:** 🔴 High  
**File:** `flowField.js`, line 1055

`p5.get(x, y)` reads a pixel's colour from the canvas. Under the hood this calls
`getImageData()`, which forces a full GPU → CPU memory readback — one of the most
expensive operations possible in a canvas pipeline. It fires every frame as part of
a "fade debug" logging system that collects per-particle fade timing data.

**Fix:** The entire debug block (lines ~1055–1072) is instrumentation and should be
removed or gated behind a compile-time flag before any production build.

---

### 2. `console.log` / `console.table` Inside the Render Loop

**Severity:** 🔴 High  
**File:** `flowField.js`, lines 1069–1070

Two console calls exist inside `draw()`, triggered when a particle's fade cycle
completes. `console.table` is particularly expensive as it serialises an array on
every trigger and causes DevTools overhead. With 5,000 particles this fires
frequently.

**Fix:** Strip all debug logging from the draw path. A simple `if (DEBUG)` guard or
removing the block entirely is the right approach.

---

### 3. No Script Bundling or Minification

**Severity:** 🟠 Medium  
**Files:** `index.html` (all 13 `<script>` tags)

13 separate JavaScript files are loaded via individual `<script src>` tags, with
**no `defer` or `async` attribute on any of them**. This means:

- 13 sequential HTTP requests block HTML parsing
- The browser cannot parallelise downloads
- `flowField.js` (116 KB) and `scroll.js` (39.6 KB) are completely unminified

**Total unminified JS payload: ~792 KB** across 13 files.

**Fix:** Bundle with Vite, Rollup, or esbuild. A single bundled + minified output
would likely shrink below 200 KB. At minimum, add `defer` to every script tag:

```html
<script src="src/js/flowField.js" defer></script>
```

---

### 4. `p5.sound.min.js` Loaded Without Being Used

**Severity:** 🟠 Medium  
**File:** `index.html`

`p5.sound.min.js` is **143.3 KB** — the second-largest dependency. An `AudioContext`
is open and actively running, but the simulation is purely visual with no audio
playback detected.

**Fix:** Remove this library entirely if audio is not used. That eliminates 143 KB
of parse/compile time and a constantly-running audio context.

---

### 5. 1,189 `<span>` Elements With No Off-Screen Culling

**Severity:** 🟠 Medium  
**File:** `scroll.js` (9 × `getBoundingClientRect` calls)

The poem words are rendered as DOM `<span>` elements used as particle collision
boxes. Of 1,189 spans measured:

| State | Count |
|---|---|
| Far off-screen (≤ −9999 px) | 495 |
| Partially off-screen | 620 |
| Visible in viewport | 74 |

The browser still computes styles and layout for all 1,928 DOM elements every
frame. The `getBoundingClientRect` calls in `scroll.js` can trigger forced
synchronous layout reflow.

**Fix:** Use `IntersectionObserver` to deactivate collision boxes for spans outside
the viewport. Alternatively, only inject spans for the currently-visible stanza
rather than the entire poem. `content-visibility: auto` on the poem container is
also worth exploring.

---

### 6. Font Served as TTF Instead of WOFF2

**Severity:** 🟡 Low–Medium  
**File:** `index.html` (`@font-face` declaration)

The Cinzel variable font is loaded as a `.ttf` file. TTF files are uncompressed;
WOFF2 uses Brotli compression and is typically 30–50% smaller with full support in
all modern browsers.

**Fix:**

```css
@font-face {
    font-family: "Cinzel";
    src: url("./src/fonts/Cinzel/Cinzel-VariableFont_wght.woff2") format("woff2");
}
```

---

### 7. Canvas Missing `will-change` Hint

**Severity:** 🟡 Low  
**Element:** `#defaultCanvas0`

The p5 canvas has `position: absolute` but no compositor hint. Without
`will-change`, the browser may re-composite the canvas layer together with DOM
elements on every frame rather than keeping it on a dedicated GPU layer.

**Fix:**

```css
#defaultCanvas0 {
    will-change: contents;
}
```

---

### 8. Entire Simulation Runs on the Main Thread

**Severity:** 🔵 Architectural (Future Work)

The full particle simulation — 5,000 particles, separation grid, boid flocking,
dune field — runs on the main JavaScript thread, competing with layout, style
recalc, and event handling. Real frame times during testing ranged from
**66–133 ms**, well above the 16.7 ms budget for 60 fps.

The browser supports both **Web Workers** and **`OffscreenCanvas`**
(`transferControlToOffscreen` is available), meaning the physics and rendering
pipeline could be moved entirely off the main thread. This would require significant
architectural changes to the p5.js-based setup but would be the single largest
performance unlock available.

---

## What's Already Working Well

- **Adaptive quality system** — tiered quality with configurable decision windows
  and cooldowns is the right approach for a simulation of this complexity.
- **Map-based spatial grids** — separation, boid, and box grids all use `Map` with
  cell-key hashing, avoiding O(n²) pair checks for 5,000 particles.
- **JS heap usage** — ~18 MB used out of ~88 MB allocated is very reasonable for
  a live particle system.
- **Separation pair budget** — the 70,000-pair cap prevents runaway CPU cost on
  dense particle clusters.

---

## Priority Summary

| # | Issue | Effort | Impact |
|---|---|---|---|
| 1 | Remove `p5.get()` + console logs from draw loop | Minutes | 🔴 High |
| 2 | Add `defer` to all script tags | Minutes | 🟠 Medium |
| 3 | Remove `p5.sound.min.js` if unused | Minutes | 🟠 Medium |
| 4 | Bundle + minify JS with Vite / Rollup | Hours | 🟠 Medium |
| 5 | Convert font to WOFF2 | Minutes | 🟡 Low–Medium |
| 6 | Add `will-change: contents` to canvas | Minutes | 🟡 Low |
| 7 | `IntersectionObserver` for word span culling | Hours | 🟠 Medium |
| 8 | Web Worker + OffscreenCanvas for physics | Days | 🔴 High (future) |

---

_The quickest wins are **items 1 and 3**: removing the `p5.get()` debug readback
eliminates an expensive GPU→CPU stall every frame, and dropping `p5.sound.min.js`
sheds 143 KB of unused library weight — both are one-line changes._