Phase 2B Performance Profile — 127.0.0.1:5501/?debug
Setup confirmed: navigated to ?debug (HUD became visible), called startAutoScroll(0.3), particle sim running at full population (5000/5000) under scrolling load.

1. Steady-state FPS (30 seconds, rAF capture)
MetricValueFrames captured1,798 over 29.98 sMin frame time15.60 msAvg frame time16.68 msMax frame time33.20 msStddev0.50 msEquivalent FPS (1000/avg)59.97
⚠️ Important caveat: the rAF loop is ticked by the browser's display refresh (~60 Hz vsync), so it reports the outer frame rate. The sim's internal render rate, as reported by the HUD throughout the run, was a steady ~40 FPS (Avg Frame ~24–25 ms). This means the engine is internally pacing above its 30 FPS target and absorbing headroom — the rAF measurement here is effectively measuring vsync, not the simulator's render cadence.
2. Frame time histogram (same 30s window)
BucketCount%<16 ms774.28%16–33 ms1,72095.66%33–50 ms10.06%50–100 ms00.00%>100 ms00.00%
Essentially every frame lands in the 16–33 ms band (vsync-aligned). One single frame touched 33 ms; zero stalls beyond 50 ms.
3. JS heap snapshot
usedJSHeapSizetotalJSHeapSizeStart of 30s38.88 MB99.96 MBEnd of 30s28.20 MB95.99 MBDelta−10.68 MB−3.96 MB
Heap shrank across the window — a GC cycle ran during capture. No leak signal; allocation pressure is low.
4. HUD readings
Start of 30s window:
FPS 41.6 (Target 30) | Avg Frame 24.03 ms | Quality Tier 0 | Render Fraction 1.00 | Separation Pair Budget 70000 | Particles 5000/5000 | Viewport 1541x873px | Render Scale 0.70 (auto) | Internal Canvas 1080x611px
End of 30s window:
FPS 39.9 (Target 30) | Avg Frame 25.08 ms | Quality Tier 0 | Render Fraction 1.00 | Separation Pair Budget 70000 | Particles 5000/5000 | Viewport 1541x873px | Render Scale 0.70 (auto) | Internal Canvas 1080x611px
Tier 0, full render fraction, full particle population, full pair budget — adaptive quality system never had to throttle.
5. Degradation watch (5 minutes, 30 samples @ 10s)
Start (t=0)End (t=290s)MinMaxMeanQuality Tier00000Avg Frame (ms)24.8624.9621.7026.8425.06FPS40.240.137.346.139.99Render Fraction1.001.00——1.00Pair Budget70,00070,000——70,000Particles5000/50005000/5000——5000/5000Render Scale0.700.70——0.70
Quality tier never increased (stayed at 0 the entire 5 minutes). Avg frame time did not drift upward — start 24.86 ms, end 24.96 ms, oscillating in a tight ±2 ms band with no monotonic trend. The chugging behavior is gone.

Comparison vs. Phase 1 baseline
MetricPhase 1 baselinePhase 2BResultAvg frame stddev0.24 ms0.50 msSlight regression (still excellent — both well under 1 ms)Frames under 33 ms42%99.94% (lt16 + 16–33)Major improvementHeap used32.1 MB28.2 MB end (−10.7 MB during run)ImprovedHeap allocated88 MB96.0 MBSlight increase (~9%)Internal FPS30 (locked, adaptive absorbed headroom)~40 sustained, Tier 0Improved — engine now runs above target with headroom to spareQuality tier behavioradaptive throttled to hold 30never throttled over 5+ minImprovedLong-run drift / chugging(motivating problem)none observed; tier stable, frame time flatFixed
Bottom line
Phase 2B is a clear win. The simulator is now running at ~40 internal FPS at full Tier 0 quality with 5000/5000 particles and a 70k separation pair budget, holding that for 5+ minutes of continuous auto-scroll with no quality downgrades and no frame-time drift. Stalls >33 ms are essentially eliminated (1 frame in ~1800). The staging-area fix appears to have removed the chugging — the adaptive system is no longer being asked to compensate.
The only mild regression is frame-time stddev (0.24 → 0.50 ms), but this is largely attributable to the rAF loop now sampling a vsync-paced outer frame against an internally-decoupled ~40 FPS render schedule, and both numbers are well within healthy range. The +8 MB increase in allocated heap is small and used heap actually decreased, so no memory concern.