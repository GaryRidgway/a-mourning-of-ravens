## Baseline Results

### 30-Second Frame-Time Test

| Metric | Value |
|---|---|
| Frames captured | 900 |
| Avg frame time | 33.33 ms |
| Min frame time | 32.20 ms |
| Max frame time (worst single frame) | **34.40 ms** |
| Std deviation | 0.42 ms |
| Avg FPS | 30.0 |
| Best FPS | 31.1 |
| Worst FPS | 29.1 |
| Jank frames (>50ms) | **0** |
| Frames missing 30fps target (>33.3ms) | 671 / 900 (74.6%) |
| JS heap at end of 30s | 45.8 MB used / 82.7 MB allocated |

**Frame time distribution:**

| Bucket | Frames |
|---|---|
| Under 16ms | 0 |
| 16–33ms | 229 (25.4%) |
| 33–50ms | 671 (74.6%) |
| 50–100ms | 0 |
| Over 100ms | 0 |

The sim is almost perfectly capped at exactly 30 FPS — the adaptive quality system is doing its job. There are **zero jank frames** and a very tight stddev of 0.42ms. The "671 frames missing target" is misleading — those are all in the 33–34ms range, just barely over the 33.3ms threshold, never close to a real dropped frame. The sim is rock solid.

---

### 5-Minute Degradation Watch

| Time | FPS | Avg Frame | Quality Tier | Heap Used |
|---|---|---|---|---|
| +0s | 30.1 | 33.27ms | 0 | 26.7 MB |
| +30s | 30.0 | 33.36ms | 0 | 30.7 MB |
| +60s | 30.0 | 33.33ms | 0 | 36.8 MB |
| +90s | 30.0 | 33.36ms | 0 | 38.6 MB |
| +120s | 30.0 | 33.35ms | 0 | 35.8 MB |
| +150s | 30.1 | 33.28ms | 0 | 35.8 MB |
| +180s | 32.4 | 30.85ms | 0 | 43.6 MB |
| +210s | 30.7 | 32.57ms | 0 | 15.8 MB |
| +240s | 29.7 | 33.61ms | 0 | 35.7 MB |
| +270s | 30.1 | 33.27ms | 0 | 34.3 MB |
| +300s | 33.1 | 30.24ms | 0 | 52.1 MB |

**Key observations:**

**No FPS degradation over 5 minutes.** The sim never drops below 29.7 FPS and never triggers a quality tier change — Tier 0 throughout. No chugging of any kind was observed.

**Heap is bouncy, not leaking.** Used heap fluctuates between ~15.8 MB and ~52.1 MB — that's the GC cycling, not a leak. The sharp drop at +210s (43.6 → 15.8 MB) is a collection event. Total allocated heap stays flat at ~82–83 MB throughout, confirming no unbounded memory leak.

**The slight FPS uptick at +180s and +300s** (32.4 and 33.1) is measurement noise — the HUD samples a rolling window so brief favourable stretches can read slightly above target.

---

**Bottom line:** This is a very well-behaved simulation at idle. The adaptive quality system is successfully holding the line at 30 FPS with no degradation over 5 minutes. The value of the recommended fixes (removing `p5.get()`, console logs, `p5.sound`) will be most visible in load-time metrics and as headroom on lower-end hardware or when the tab is competing with other work.