## Potential future upgrades

1. Pre-compute the full auto-scroll path — the scroll path is deterministic after ring seeding (fixed stanza order, fixed slopes, fixed widths). You could pre-compute a lookup: given a total scroll distance, return the active offsets, current stanza, and slope. The per-frame auto-scroll tick becomes "advance distance, look up position" instead of running the stanza-transition state machine.
2. Pre-compute a coarse dune-band grid — the dune multiplier depends on spatial position + slow drift. A 32x32 grid updated every ~100ms could replace the two per-particle fastSin calls with a single grid lookup + bilinear lerp (same pattern as the noise texture).

