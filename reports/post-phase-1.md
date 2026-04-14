## Phase 1 vs Baseline — 30-Second Frame-Time Comparison

_Phase 1: removed `p5.get()` pixel readback + `console.log`/`console.table` debug block from draw loop_

### Frame Time

| Metric | Baseline | Phase 1 | Δ |
|---|---|---|---|
| Avg frame time | 33.33 ms | 33.33 ms | 0.00 ms |
| Min frame time (best frame) | 32.20 ms | 32.30 ms | +0.10 ms |
| Max frame time (worst frame) | 34.40 ms | 34.40 ms | 0.00 ms |
| Std deviation | 0.42 ms | **0.24 ms** | **−0.18 ms** |

### FPS

| Metric | Baseline | Phase 1 | Δ |
|---|---|---|---|
| Avg FPS | 30.0 | 30.0 | 0.0 |
| Best FPS | 31.1 | 31.0 | −0.1 |
| Worst FPS | 29.1 | 29.1 | 0.0 |

### Frame Distribution

| Bucket | Baseline | Phase 1 |
|---|---|---|
| Under 16ms | 0 | 0 |
| 16–33ms | 229 (25.4%) | **379 (42.1%)** |
| 33–50ms | 671 (74.6%) | **522 (57.9%)** |
| 50–100ms | 0 | 0 |
| Over 100ms | 0 | 0 |
| Jank frames (>50ms) | 0 | 0 |

### JS Heap (end of 30s)

| | Baseline | Phase 1 |
|---|---|---|
| Used | 45.8 MB | 32.1 MB |
| Allocated | 82.7 MB | 82.7 MB |

---

### Notes

The FPS and worst-frame numbers are statistically identical — both runs are locked tightly
to the 30 FPS target cap, so the debug removal doesn't show up as a raw FPS gain here.
The meaningful changes are:

- **Std deviation dropped from 0.42ms → 0.24ms** — frame times are noticeably more
  consistent, meaning the periodic `p5.get()` GPU→CPU readback stalls and `console.table`
  serialisation bursts are gone. The sim is smoother frame-to-frame even if the average
  is the same.
- **More frames in the 16–33ms bucket** (25% → 42%) and fewer in the 33–50ms bucket —
  the draw loop is completing faster more often, with the headroom previously eaten by
  the debug block now available.
- **Heap used dropped from 45.8 MB → 32.1 MB** — removing the `debugFadeLog` array
  that was accumulating per-frame data across the lifetime of the session reduced
  retained memory.
- **No change to worst frame (34.40ms)** — the frame time ceiling is now set by the sim
  physics, not the debug instrumentation.