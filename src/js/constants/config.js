const CONFIG = {
  particleCount: 5000,
  enableAutoRenderScale: false,
  autoRenderScaleThresholdPx: 1080,
  particleSize: 0.25,
  particleSizeRandomNegative: 0,
  particleSizeRandomPositive: 0.42,
  boxCollisionParticipantRatio: 0.33,
  enableForegroundLayer: true,
  showBackgroundCanvas: true,
  showBackgroundCanvasB: true,
  showForegroundCanvas: true,
  enableDualInkLayers: true,
  inkLayerPhaseOffset: 0.5,
  foregroundTrailAlpha: 36,
  foregroundParticleAlpha: 138,
  // Scales the whole flow force on foreground-layer particles — the word
  // colliders — so the two layers can drift at different speeds. Multiplies the
  // same sampled vector windBoostMultiplier does, so direction is untouched and
  // curl, turbulence and ridge pull scale with the wind. Gated on
  // enableForegroundLayer: with the layer off there is no foreground to single
  // out, and those particles fall through to the ink canvases. 1 = off.
  foregroundWindMultiplier: 0.08,
  particleRenderMinSpeed: 0,
  particleSpeedAlphaBoost: 0,
  particleDuneAlphaBoost: 0.09,
  particleDuneSizeBoost: 2,
  particleSpeedWidthBoost: 0.5,
  // Hold each particle's ink deposit constant as the size boosts widen it:
  // alpha is divided by (rendered width / base width) ^ constantInkExponent, so
  // a fat stroke spreads the same ink thinner instead of laying proportionally
  // more. Works both ways — strokes narrower than the base get brighter.
  enableConstantInk: true,
  // 2 treats a particle as a disc, which is the strict reading of "same ink":
  // area goes as r², so alpha goes as 1/r². 1 matches the capsule a stroked
  // segment actually paints, where area is width × length and alpha goes as
  // 1/w. Use 2 for the literal answer, 1 for the one the canvas draws.
  constantInkExponent: 2,
  particleRenderFraction: 1,
  enableAmbientMotion: true,
  enableDuneBands: true,
  // Greyscale picture of the dune signal over the whole scene, for finding the
  // ridges by eye when the particles alone are too sparse to read.
  showDuneDebugLayer: false,
  // Kept below 1 by default so the particles stay visible through the field —
  // reading the two together is the point of drawing it on top.
  duneDebugOpacity: 0.15,
  // Quiver plot of the total flow field, coloured by wind alignment. Reads the
  // curl's eddy size and any upwind pockets straight off the screen.
  showFlowArrows: false,
  flowArrowSpacing: 32,
  flowArrowOpacity: 0.85,
  ambientWindDirectionDeg: 30,
  ambientWindStrength: 0.112,
  duneBandRotationDeg: 30,
  duneBandScale: 76,
  duneBandOffsetPx: -103,
  duneAlongWarpScale: 306,
  duneWarpStrength: 3.12,
  duneContrast: 1,
  duneDriftSpeed: 0.05,
  microNoiseScale: 403,
  microTurbulenceStrength: 0.068,
  flowFieldMix: 0.68,
  curlStrength: 0.04,
  curlNoiseScale: 151,
  curlAngleRangeDeg: 93,
  curlDriftSpeed: 0,
  curlDuneModulation: 0.8,
  equalizeNoiseTexture: true,
  curlDivergenceFree: false,
  // Size the divergence-free curl so the flow can never bend further off the
  // wind than curlAngleRangeDeg, giving that control the same meaning it has in
  // the legacy curl mode. Replaces curlStrength and flowFieldMix while on.
  // Off by default: it rescales the field, so URLs tuned before it existed keep
  // the look they were saved with.
  curlAngleCalibrated: false,
  curlCompressibility: 0,
  curlDuneRibbon: 0,
  // Pull across the bands toward dune ridges, as a fraction of wind strength.
  // 1-D convergence, so it forms ribbons instead of the point sinks that
  // curlCompressibility creates.
  duneRidgeAttraction: 0.235,
  // Exponent on (1 - dune signal) applied to the ridge pull, fading it out as
  // the field approaches white. 0 = the raw gradient.
  duneRidgeFalloff: 4,
  respawnRandomizeVelocity: 2,
  perParticleForceMultMax: 1.29,
  perParticleVelMultMax: 3,
  windBoostParticleRatio: 0,
  windBoostSizeMultiplier: 0.42,
  windBoostAlphaMultiplier: 0,
  windBoostMinMultiplier: 17.4,
  windBoostMaxMultiplier: 30,
  windBoostTurbulenceMinMultiplier: 20,
  windBoostTurbulenceMaxMultiplier: 30,
  enableBoidFlocking: true,
  boidNeighborRadius: 15,
  boidSeparationRadius: 7,
  boidSeparationStrength: 1.95,
  boidAlignmentStrength: 2.73,
  boidCohesionStrength: 0.4,
  boidMaxSteerForce: 0.116,
  boidWindBlend: 0.45,
  boidMaxGroupSize: 4,
  boidDispersalStrength: 2.13,
  enableWordShadow: false,
  wordShadowBlur: 9,
  wordShadowOpacity: 1,
  enableBoxInkErase: false,
  boxInkEraseAlpha: 50,
  boxInkErasePadding: 0,
  boxInkEraseSoftness: 0,
  enableBoxGlow: true,
  boxGlowRadius: 2,
  boxGlowHaloSize: 1,
  boxGlowHaloAlpha: 44,
  boxGlowCoreWhite: 0.91,
  boxGlowCoreDiameter: 1.9,
  boxGlowFadeDelayMs: 500,
  boxGlowFadeDurationMs: 990,
  // Ember flicker: modulates the glow with per-particle 1D Perlin so lit
  // particles breathe independently instead of holding a flat value. It drives
  // halo alpha, core alpha and core width — brightness and size — but never the
  // color blend, so an ember dims and narrows without drifting back toward the
  // base particle color mid-flicker. Purely subtractive, so depth 0 is a
  // bit-exact no-op and it can never overshoot the un-flickered look.
  enableGlowFlicker: true,
  // Fraction of the glow the flicker is allowed to take away at its lowest.
  // 1 lets embers wink fully out at the trough; mean brightness drops as this
  // rises, so expect to raise Core Alpha to compensate.
  glowFlickerDepth: 0.63,
  // Noise units traversed per second. Perlin features run about one unit wide,
  // so ~1 is a slow breath and ~10 reads as sparks. Deposited ink beads at the
  // high end, since a flickering particle lays a dashed trail, not a smooth one.
  glowFlickerSpeed: 2.9,
  glowBlendOklch: true,
  glowBlendChromaFloor: 0.404,
  glowBlendHueShift: 0,
  edgeRespawnWeightBase: 0.05,
  edgeRespawnWeightStrength: 0.45,
  edgeRespawnWeightExponent: 2,
  useWeightedEdgeRespawn: false,
  edgeRespawnWeightedMixPercent: 22,
  enableParticleSeparation: true,
  particleCollisionRadius: 0.65,
  particleCollisionStrength: 0.64,
  particleCollisionVelocityDamp: 0.22,
  separationEveryNFrames: 4,
  maxSeparationPairsPerTick: 70000,
  maxSeparationCandidatesPerCell: 24,
  separationNearBoxRadius: 20,
  separationMinSpeed: 1,
  staticInfluenceForwardDotMin: 0.22,
  backsideDragStrength: 0.22,
  boxForceMaxRadius: 1.3,
  surfaceSlideBand: 2,
  surfaceInwardDamp: 0.7,
  surfacePosRelaxation: 0.4,
  surfaceMaxCorrection: 0.35,
  showSeparationZone: true,
  separationZoneAlpha: 0,
  damping: 0.86,
  maxSpeed: 1.7,
  trailAlpha: 1,
  autoScrollSpeed: 0.1,
  wordOffsetX: -2,
  wordOffsetY: 0,
  scrollFreezeDebounceMs: 50,
  scrollFreezeFadeInMs: 1960,
  backgroundPulsePeriodSec: 30.7,
  // Phase→strength keyframes 'x,y|x,y|…' (both 0..1), monotone-cubic sampled.
  // y maps directly to fade alpha: 1.0 = full 255 wipe.
  backgroundPulseCurve:
    '0.000,0.000|0.200,0.000|0.390,0.130|0.500,0.174|0.598,0.060|0.800,0.000|1.000,0.000',
  // Editor-only vertical zoom: alpha value at the top of the curve canvas.
  // Stored keyframes keep their real 0..1 alpha meaning — this just spreads
  // the useful low range across the full canvas height for finer dragging.
  backgroundPulseCurveMaxY: 0.3,
  // Control rows lifted into the panel's Pinned section, in pin order.
  // Dot-separated ids of the form <ns>-<name>, where ns is k (data-key),
  // c (data-color-key), a (data-color-alpha-key) or i (element id). Dot and
  // dash are the only punctuation URLSearchParams leaves unescaped, which is
  // why the ids read cleanly in a shared URL.
  pinnedControls:
    'k-boxCollisionParticipantRatio.c-boxGlowCore.a-boxGlowCore.k-boxGlowCoreDiameter.' +
    'k-boxGlowFadeDelayMs.k-boxGlowFadeDurationMs.k-foregroundParticleAlpha.' +
    'k-foregroundTrailAlpha.k-foregroundWindMultiplier.k-enableGlowFlicker.' +
    'k-glowFlickerDepth.k-glowFlickerSpeed.k-boxGlowHaloAlpha.k-boxGlowCoreWhite',
  collisionEjectPadding: 0.02,
  turbulenceStrength: 0.5,
  wakeDragStrength: 0.5,
  wakeSwirlLength: 350,
  wakeSwirlWidth: 95,
  wakeSwirlStrength: 10,
  wakeSwirlFrequency: 0.06,
  recentInteractionMs: 3000,
  edgePadding: 0,
  boxVelocityDecay: 0.86,
  boxStationarySpeedThreshold: 0.12,
  showBoxes: true,
  enableAdaptiveQuality: true,
  lockQualityLevel: false,
  qualityTargetFps: 30,
  // How fast the quality level falls when frames overrun the budget, in level
  // units per second per unit of fractional error — so at 1.2, frames taking
  // twice their budget (error 1.0) sweep the whole 0..1 range in under a
  // second, while frames a few percent over barely move at all. The rate being
  // proportional to the error is what keeps the controller from overshooting
  // near equilibrium: as it approaches the budget, it slows to a stop.
  qualityDegradeRate: 1.2,
  // The same, for climbing back toward full quality. Deliberately several times
  // slower than the degrade rate — recovery is the direction that re-triggers
  // the stutter, so it should creep rather than snap back and pump.
  qualityRecoverRate: 0.2,
  // Fractional overshoot tolerated before quality starts dropping: 0.06 means
  // frames may run 6% over budget without provoking a response. Applies to the
  // degrade direction only. Recovery has no deadband on purpose — a display
  // pinned by vsync can sit a hair under target forever, and a symmetric
  // deadband would strand the piece at reduced quality on a machine that has
  // headroom to spare. Proportional rate already stops recovery at zero error.
  qualityDeadband: 0.06,
  // Jitter filter on the effective values, not the source of the motion — the
  // level itself now moves continuously. Kept short because this is a second
  // lag inside the control loop, and stacking lags is how a controller starts
  // to oscillate.
  qualityTransitionMs: 150,
  qualityHudEnabled: true,
  pauseSimulation: false,
};

const CONFIG_DEFAULTS = Object.assign({}, CONFIG);
