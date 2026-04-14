# Browser Extension Claude — Capabilities Reference

What the browser extension version of Claude can and cannot measure/observe in this project.
Useful for delegating performance measurement tasks.

---

## Can Do Fully

| Task | How |
|---|---|
| Min/avg/max/stddev FPS over any duration | `requestAnimationFrame` loop collecting frame timestamps |
| Worst single frame time | Same RAF measurement — max of all frame deltas |
| JS heap used vs allocated | `performance.memory` (Chromium only) — can poll over time to spot growth trends |
| Long-running degradation watch (~5 min) | Polls the sim's live HUD DOM element at regular intervals and logs readings |
| Frame time histogram (spike detection) | Buckets frames into `<16ms / 16–33ms / 33–50ms / 50–100ms / >100ms` — can detect statistically whether spikes flatten after a change |

---

## Can Do With Caveats

| Task | Caveat |
|---|---|
| DOMContentLoaded / load time | Can read `performance.getEntriesByType('navigation')` — but can't disable the cache via DevTools. Workaround: append a cache-busting query string to simulate a cold load. Directionally accurate, not identical to a true hard reload with cache disabled. |
| Blank screen / time-to-first-content | Can measure via `performance.getEntriesByType('paint')` (First Contentful Paint) or a `MutationObserver` watching for the canvas appearing. Reasonable proxy, not exact. |
| Total Blocking Time | Can use `PerformanceObserver` for `longtask` entries to approximate long task duration. Won't match Lighthouse's TBT exactly — Lighthouse controls throttling and network conditions. |

---

## Cannot Do — Requires Manual DevTools

| Task | Why | Where to check manually |
|---|---|---|
| GPU compositor layer confirmation | Requires `chrome://layers` or the DevTools Layers panel — not accessible from page-level JS | DevTools → Rendering tab → Layer borders, or the Layers panel |
| Layout/Reflow timeline entries | Full reflow timing (`Recalculate Style` / `Layout` blocks) is not exposed to page-level JS | DevTools → Performance panel → record a session, look for purple blocks |
| Flame chart / call stack detail | Performance timeline call stacks require DevTools recording | DevTools → Performance panel |

---

## Notes

- All JS-accessible measurements assume **Chromium** (Chrome / Edge). `performance.memory` is not available in Firefox or Safari.
- For load-time comparisons, cache-busting (`?v=2` etc.) is the best available substitute for a true cache-disabled reload.
- The sim's on-screen HUD is a reliable data source — browser Claude can read it directly from the DOM without needing to inject its own instrumentation.
