// https://www.openprocessing.org/sketch/157576

const CONFIG = {
  particleCount: 5000,
  enableAutoRenderScale: false,
  autoRenderScaleThresholdPx: 1080,
  particleSize: 0.25,
  particleSizeRandomNegative: 0,
  particleSizeRandomPositive: 0,
  boxCollisionParticipantRatio: 1,
  particleRenderMinSpeed: 0,
  particleSpeedAlphaBoost: 4.28,
  particleDuneAlphaBoost: 0,
  particleDuneSizeBoost: 0,
  particleSpeedWidthBoost: 1.3,
  particleRenderFraction: 1,
  enableAmbientMotion: true,
  enableDuneBands: true,
  ambientWindDirectionDeg: 135,
  ambientWindStrength: 0.281,
  duneBandRotationDeg: 135,
  duneBandScale: 100,
  duneBandOffsetPx: 0,
  duneAlongWarpScale: 316,
  duneWarpStrength: 1.5,
  duneContrast: 1,
  duneDriftSpeed: 0.1,
  microNoiseScale: 596,
  microTurbulenceStrength: 0.014,
  windBoostParticleRatio: 0.02,
  windBoostSizeMultiplier: 0.5,
  windBoostAlphaMultiplier: 206,
  windBoostMinMultiplier: 5,
  windBoostMaxMultiplier: 10,
  windBoostTurbulenceMinMultiplier: 4,
  windBoostTurbulenceMaxMultiplier: 8,
  enableBoidFlocking: true,
  boidNeighborRadius: 25,
  boidSeparationRadius: 18,
  boidSeparationStrength: 3.0,
  boidAlignmentStrength: 1.2,
  boidCohesionStrength: 0.4,
  boidMaxSteerForce: 0.4,
  boidWindBlend: 0.45,
  boidMaxGroupSize: 4,
  boidDispersalStrength: 2.5,
  enableBoxGlow: true,
  boxGlowRadius: 3,
  boxGlowHaloSize: 4.8,
  boxGlowHaloAlpha: 43,
  boxGlowCoreWhite: 1,
  boxGlowCoreDiameter: 1.4,
  boxGlowFadeDelayMs: 1000,
  boxGlowFadeDurationMs: 1000,
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
  enableAdaptiveSeparationCadence: false,
  adaptiveTargetFrameMs: 16.7,
  adaptiveCadenceMax: 8,
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
  trailAlpha: 3,
  trailAlphaSecondary: 62,
  scrollFreezeDebounceMs: 50,
  scrollFreezeFadeInMs: 1960,
  backgroundFadeOscillationPeriodSec: 0,
  particleAlphaSecondary: 67,
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
  lockQualityTier: false,
  qualityTargetFps: 30,
  qualityDecisionWindowMs: 1200,
  qualityCooldownMs: 900,
  qualityTransitionMs: 700,
  qualityHudEnabled: true,
  pauseSimulation: false,
};

const CONFIG_DEFAULTS = Object.assign({}, CONFIG);

const MAX_EFFECTIVE_DT_FRAMES = 1.75;
const MAX_RENDER_SEGMENT_LENGTH_PX = 12;

const RENDER_COLORS = {
  fade: [0, 0, 0],
  particles: [56, 159, 255, 15],
  windBoostColor: [255, 221, 0],
  separationZone: [130, 175, 235],
  boxStrokeIdle: [200, 200, 180, 0],
  boxStrokeDragged: [250, 230, 190, 0],
  boxGlowCore: [255, 204, 0, 255],
};

const RENDER_COLORS_DEFAULTS = {};
for (const k in RENDER_COLORS) {
  RENDER_COLORS_DEFAULTS[k] = RENDER_COLORS[k].slice();
}

const CONTROL_PARAM_DEFS = [
  { key: 'particleCount', type: 'number', digits: 0 },
  { key: 'enableAutoRenderScale', type: 'bool' },
  { key: 'autoRenderScaleThresholdPx', type: 'number', digits: 0 },
  { key: 'particleSize', type: 'number', digits: 2 },
  { key: 'particleSizeRandomNegative', type: 'number', digits: 2 },
  { key: 'particleSizeRandomPositive', type: 'number', digits: 2 },
  { key: 'boxCollisionParticipantRatio', type: 'number', digits: 2 },
  { key: 'particleRenderMinSpeed', type: 'number', digits: 2 },
  { key: 'particleSpeedAlphaBoost', type: 'number', digits: 2 },
  { key: 'particleDuneAlphaBoost', type: 'number', digits: 2 },
  { key: 'particleDuneSizeBoost', type: 'number', digits: 2 },
  { key: 'particleSpeedWidthBoost', type: 'number', digits: 2 },
  { key: 'particleRenderFraction', type: 'number', digits: 2 },
  { key: 'enableAdaptiveQuality', type: 'bool' },
  { key: 'lockQualityTier', type: 'bool' },
  { key: 'qualityTargetFps', type: 'number', digits: 0 },
  { key: 'qualityDecisionWindowMs', type: 'number', digits: 0 },
  { key: 'qualityCooldownMs', type: 'number', digits: 0 },
  { key: 'qualityTransitionMs', type: 'number', digits: 0 },
  { key: 'qualityHudEnabled', type: 'bool' },
  { key: 'pauseSimulation', type: 'bool' },
  { key: 'enableAmbientMotion', type: 'bool' },
  { key: 'enableDuneBands', type: 'bool' },
  { key: 'ambientWindDirectionDeg', type: 'number', digits: 0 },
  { key: 'ambientWindStrength', type: 'number', digits: 3 },
  { key: 'duneBandRotationDeg', type: 'number', digits: 0 },
  { key: 'duneBandScale', type: 'number', digits: 0 },
  { key: 'duneBandOffsetPx', type: 'number', digits: 0 },
  { key: 'duneAlongWarpScale', type: 'number', digits: 0 },
  { key: 'duneWarpStrength', type: 'number', digits: 2 },
  { key: 'duneContrast', type: 'number', digits: 2 },
  { key: 'duneDriftSpeed', type: 'number', digits: 2 },
  { key: 'microNoiseScale', type: 'number', digits: 0 },
  { key: 'microTurbulenceStrength', type: 'number', digits: 3 },
  { key: 'windBoostParticleRatio', type: 'number', digits: 3 },
  { key: 'windBoostSizeMultiplier', type: 'number', digits: 2 },
  { key: 'windBoostAlphaMultiplier', type: 'number', digits: 2 },
  { key: 'windBoostMinMultiplier', type: 'number', digits: 2 },
  { key: 'windBoostMaxMultiplier', type: 'number', digits: 2 },
  { key: 'windBoostTurbulenceMinMultiplier', type: 'number', digits: 2 },
  { key: 'windBoostTurbulenceMaxMultiplier', type: 'number', digits: 2 },
  { key: 'enableBoidFlocking', type: 'bool' },
  { key: 'boidNeighborRadius', type: 'number', digits: 0 },
  { key: 'boidSeparationRadius', type: 'number', digits: 0 },
  { key: 'boidSeparationStrength', type: 'number', digits: 2 },
  { key: 'boidAlignmentStrength', type: 'number', digits: 2 },
  { key: 'boidCohesionStrength', type: 'number', digits: 2 },
  { key: 'boidMaxSteerForce', type: 'number', digits: 3 },
  { key: 'boidWindBlend', type: 'number', digits: 2 },
  { key: 'boidMaxGroupSize', type: 'number', digits: 0 },
  { key: 'boidDispersalStrength', type: 'number', digits: 2 },
  { key: 'enableBoxGlow', type: 'bool' },
  { key: 'boxGlowRadius', type: 'number', digits: 0 },
  { key: 'boxGlowHaloSize', type: 'number', digits: 1 },
  { key: 'boxGlowHaloAlpha', type: 'number', digits: 0 },
  { key: 'boxGlowCoreWhite', type: 'number', digits: 2 },
  { key: 'boxGlowCoreDiameter', type: 'number', digits: 1 },
  { key: 'boxGlowFadeDelayMs', type: 'number', digits: 0 },
  { key: 'boxGlowFadeDurationMs', type: 'number', digits: 0 },
  { key: 'glowBlendOklch', type: 'bool' },
  { key: 'glowBlendChromaFloor', type: 'number', digits: 3 },
  { key: 'glowBlendHueShift', type: 'number', digits: 1 },
  { key: 'edgeRespawnWeightBase', type: 'number', digits: 2 },
  { key: 'edgeRespawnWeightStrength', type: 'number', digits: 2 },
  { key: 'edgeRespawnWeightExponent', type: 'number', digits: 2 },
  { key: 'useWeightedEdgeRespawn', type: 'bool' },
  { key: 'edgeRespawnWeightedMixPercent', type: 'number', digits: 0 },
  { key: 'enableParticleSeparation', type: 'bool' },
  { key: 'particleCollisionRadius', type: 'number', digits: 2 },
  { key: 'particleCollisionStrength', type: 'number', digits: 2 },
  { key: 'particleCollisionVelocityDamp', type: 'number', digits: 2 },
  { key: 'separationEveryNFrames', type: 'number', digits: 0 },
  { key: 'separationNearBoxRadius', type: 'number', digits: 0 },
  { key: 'separationMinSpeed', type: 'number', digits: 2 },
  { key: 'boxForceMaxRadius', type: 'number', digits: 1 },
  { key: 'surfaceSlideBand', type: 'number', digits: 2 },
  { key: 'staticInfluenceForwardDotMin', type: 'number', digits: 2 },
  { key: 'backsideDragStrength', type: 'number', digits: 2 },
  { key: 'scrollFreezeDebounceMs', type: 'number', digits: 0 },
  { key: 'scrollFreezeFadeInMs', type: 'number', digits: 0 },
  { key: 'backgroundFadeOscillationPeriodSec', type: 'number', digits: 1 },
];

const COLOR_PARAM_DEFS = [
  { key: 'fade', param: 'colorFade' },
  { key: 'particles', param: 'colorParticles' },
  { key: 'windBoostColor', param: 'colorWindBoost' },
  { key: 'separationZone', param: 'colorSeparationZone' },
  { key: 'boxStrokeIdle', param: 'colorBoxStrokeIdle' },
  { key: 'boxStrokeDragged', param: 'colorBoxStrokeDragged' },
  { key: 'boxGlowCore', param: 'colorBoxGlowCore' },
];

const COLOR_ALPHA_PARAM_DEFS = [
  { key: 'fade', param: 'colorFadeAlpha', source: 'config', configKey: 'trailAlpha', digits: 0 },
  { key: 'fadeSecondary', param: 'colorFadeAlphaSecondary', source: 'config', configKey: 'trailAlphaSecondary', digits: 0 },
  { key: 'particles', param: 'colorParticlesAlpha', source: 'render', digits: 0 },
  { key: 'particlesSecondary', param: 'colorParticlesAlphaSecondary', source: 'config', configKey: 'particleAlphaSecondary', digits: 0 },
  { key: 'separationZone', param: 'colorSeparationZoneAlpha', source: 'config', configKey: 'separationZoneAlpha', digits: 0 },
  { key: 'boxStrokeIdle', param: 'colorBoxStrokeIdleAlpha', source: 'render', digits: 0 },
  { key: 'boxStrokeDragged', param: 'colorBoxStrokeDraggedAlpha', source: 'render', digits: 0 },
  { key: 'boxGlowCore', param: 'colorBoxGlowCoreAlpha', source: 'render', digits: 0 },
];

const CONTROL_TOOLTIPS = {
  particleSize: 'Base thickness of particle strokes before random size variation and speed-based width boosts.',
  particleSizeRandomNegative: 'Maximum negative random size offset applied when a particle is spawned.',
  particleSizeRandomPositive: 'Maximum positive random size offset applied when a particle is spawned.',
  particleRenderMinSpeed: 'Particles below this speed are hidden. Just above this threshold, alpha ramps in smoothly.',
  particleSpeedAlphaBoost: 'How strongly faster particles become brighter. Higher values emphasize fast streaks.',
  particleDuneAlphaBoost: 'How strongly dune bands boost particle alpha. Higher values make particles inside dune ridges brighter.',
  particleDuneSizeBoost: 'How strongly dune bands boost particle stroke size. Higher values make particles inside dune ridges thicker.',
  particleSpeedWidthBoost: 'How strongly faster particles get thicker strokes.',
  particleRenderFraction: 'Global streak density scaler. Lower values reduce accumulated ink while preserving continuity.',
  particleCount: 'Maximum particle budget used by the simulation and adaptive particle count system.',
  boxCollisionParticipantRatio: 'Fraction of particles that participate in poem collider box interactions.',
  enableAutoRenderScale: 'Automatically caps the internal canvas size on very large screens, then CSS stretches it to fill the viewport.',
  autoRenderScaleThresholdPx: 'Maximum internal canvas size before auto render scaling caps it.',
  edgeRespawnWeightBase: 'Base chance weight for edge respawn bins before dune influence is applied.',
  edgeRespawnWeightStrength: 'How strongly dune sampling biases random edge respawn locations.',
  edgeRespawnWeightExponent: 'Contrast of edge respawn weighting. Higher values favor high-weight bins more aggressively.',
  useWeightedEdgeRespawn: 'When enabled, all wrapped particles respawn using weighted edge distribution.',
  edgeRespawnWeightedMixPercent: 'Used only when weighted edge respawn is OFF. Percentage of wraps that still use weighted placement.',
  enableParticleSeparation: 'Enables particle-particle collision solving to prevent heavy overlap and clumping.',
  particleCollisionRadius: 'Distance at which particles begin separating from each other.',
  particleCollisionStrength: 'How strongly overlapping particles are pushed apart.',
  particleCollisionVelocityDamp: 'Velocity damping applied during separation impulses to reduce jitter and rebound.',
  separationEveryNFrames: 'Base interval for separation solves. Higher values reduce CPU cost but allow more temporary overlap.',
  separationNearBoxRadius: 'Activates separation for particles near collider boxes.',
  separationMinSpeed: 'Particles moving slower than this may skip separation unless near a box or recently interacted.',
  maxSeparationPairsPerTick: 'Hard cap on pair solves per update tick to bound worst-case CPU load.',
  maxSeparationCandidatesPerCell: 'Limits neighbor candidates checked per cell in dense regions for performance stability.',
  qualityTargetFps: 'Adaptive-quality target. The system throttles up/down to stay near this framerate.',
  enableAdaptiveQuality: 'Automatically changes quality tier based on sustained frame time.',
  lockQualityTier: 'Freezes the current quality tier so adaptive quality can measure performance without changing budgets.',
  qualityDecisionWindowMs: 'How long performance must stay bad/good before changing quality tier.',
  qualityCooldownMs: 'Minimum delay between tier changes to avoid oscillation.',
  qualityTransitionMs: 'How quickly effective quality values blend to a new tier (higher is smoother/slower).',
  qualityHudEnabled: 'Shows a live on-screen performance HUD with FPS, quality tier, and active budgets.',
  pauseSimulation: 'Pauses the flow simulation loop. The simulation also auto-pauses when the tab is hidden.',
  enableDuneBands: 'Turns dune band modulation on or off while leaving ambient wind and turbulence active.',
  enableAmbientMotion: 'Enables the ambient wind field and all motion forces. Disabling freezes particle movement.',
  ambientWindDirectionDeg: 'Sets the direction the ambient wind force pushes particles, in degrees.',
  ambientWindStrength: 'Overall strength of the ambient wind field.',
  duneBandRotationDeg: 'Rotates the dune band pattern independently from the wind direction, in degrees.',
  duneBandScale: 'Controls the spacing between large dune bands. Lower values create tighter banding.',
  duneBandOffsetPx: 'Shifts the dune band pattern across its own axis without changing angle or scale.',
  duneAlongWarpScale: 'Sets the length scale of the along-wind warp that bends the dune bands.',
  duneWarpStrength: 'How strongly the dune bands are warped and bent.',
  duneContrast: 'Increases or softens contrast between high-wind and low-wind dune bands.',
  duneDriftSpeed: 'How quickly the dune field drifts over time.',
  microNoiseScale: 'Spatial scale of the fine turbulence noise field. Larger values make broader, smoother noise.',
  microTurbulenceStrength: 'Strength of the fine-scale turbulent motion layered on top of the main wind.',
  windBoostParticleRatio: 'Fraction of particles assigned to the boosted subgroup.',
  windBoostSizeMultiplier: 'Size multiplier applied to boosted particles before other width boosts.',
  windBoostAlphaMultiplier: 'Additive alpha applied only to boosted particles.',
  windBoostMinMultiplier: 'Minimum wind-force multiplier for boosted particles.',
  windBoostMaxMultiplier: 'Maximum wind-force multiplier for boosted particles.',
  windBoostTurbulenceMinMultiplier: 'Minimum turbulence multiplier for boosted particles.',
  windBoostTurbulenceMaxMultiplier: 'Maximum turbulence multiplier for boosted particles.',
  enableBoidFlocking: 'Enables boid flocking (separation, alignment, cohesion) for boosted particles.',
  boidNeighborRadius: 'Perception radius for alignment and cohesion. Boosted particles within this distance are flock neighbors.',
  boidSeparationRadius: 'Distance below which boosted particles repel each other to avoid crowding.',
  boidSeparationStrength: 'How strongly boosted particles push apart when closer than the separation radius.',
  boidAlignmentStrength: 'How strongly boosted particles steer to match the average heading of nearby flock members.',
  boidCohesionStrength: 'How strongly boosted particles steer toward the center of mass of nearby flock members.',
  boidMaxSteerForce: 'Caps the magnitude of each individual boid steering vector before combining them.',
  boidWindBlend: 'Blends between boid forces (0) and wind/dune forces (1). 0.5 uses both equally.',
  boidMaxGroupSize: 'Preferred max neighbors. When a boid has more neighbors than this, cohesion flips to dispersal.',
  boidDispersalStrength: 'How strongly boids steer away from overcrowded groups.',
  enableBoxGlow: 'Gives particles near collision boxes a glow — halo in base color, white-hot center.',
  boxGlowRadius: 'How far from a box surface a particle can be and still glow. Intensity fades with distance.',
  boxGlowHaloSize: 'Multiplier for the halo stroke width relative to the normal particle stroke.',
  boxGlowHaloAlpha: 'Peak alpha of the halo glow at full intensity.',
  boxGlowCoreWhite: 'How much the particle core shifts toward the core color at full glow. 0 = no shift, 1 = full core color.',
  boxGlowCoreDiameter: 'Stroke diameter of the glowing core in pixels. Larger values make the core color more visible.',
  boxGlowFadeDelayMs: 'How long a particle holds full glow after leaving the box surface, in milliseconds.',
  boxGlowFadeDurationMs: 'How long the glow takes to fade out after the delay, in milliseconds.',
  glowBlendOklch: 'Uses OkLCh perceptual colour space for the glow blend instead of a plain RGB lerp. Keeps colours vivid and avoids passing through grey or white at the midpoint.',
  glowBlendChromaFloor: 'Minimum chroma (colour vividness) held during the OkLCh glow blend. Higher values prevent the transition from desaturating toward grey at the midpoint.',
  glowBlendHueShift: 'Rotates the glow core hue before blending, in degrees. Shifts which arc of the colour wheel the transition travels along.',
  boxForceMaxRadius: 'Maximum distance from a collider where box influence is allowed to affect particles.',
  surfaceSlideBand: 'Thickness of the near-surface band where particles are encouraged to slide along collider faces.',
  staticInfluenceForwardDotMin: 'Minimum forward alignment required before a moving box starts affecting nearby particles.',
  backsideDragStrength: 'How strongly particles are slowed on the lee side of a moving collider.',
  scrollFreezeDebounceMs: 'Delay in milliseconds before particle movement freezes during manual scroll. Higher values make the freeze less hair-trigger.',
  scrollFreezeFadeInMs: 'Duration in milliseconds for particles to fade back in after scroll interaction ends. 0 makes them reappear instantly.',
  backgroundFadeOscillationPeriodSec: 'How many seconds it takes to complete one full ease-in-out background alpha cycle. Set to 0 to disable.',
};

const COLOR_CONTROL_TOOLTIPS = {
  fade: 'Background clear or fade color used behind the particles.',
  particles: 'Base particle trail color.',
  windBoostColor: 'Color used for boosted particles instead of the base particle color.',
  separationZone: 'Debug color used for separation-zone visualization.',
  boxStrokeIdle: 'Outline color for collider boxes when idle.',
  boxStrokeDragged: 'Outline color for collider boxes while dragged.',
  boxGlowCore: 'Color that particle cores blend toward when glowing near collision boxes.',
};

const COLOR_ALPHA_CONTROL_TOOLTIPS = {
  fade: 'Alpha used for the background fade pass. Ignored when transparent trails are enabled.',
  fadeSecondary: 'Secondary background fade alpha used as the other end of the oscillation range.',
  particles: 'Base particle alpha before speed and trail fade adjustments.',
  particlesSecondary: 'Secondary particle alpha used as the other end of the oscillation range.',
  separationZone: 'Opacity of the separation-zone debug overlay.',
  boxStrokeIdle: 'Opacity of idle collider box outlines.',
  boxStrokeDragged: 'Opacity of dragged collider box outlines.',
  boxGlowCore: 'Opacity of the glow core color applied to particles near collision boxes.',
};

const particles = [];
const boxes = [];
let activeBoxes = [];
let sourceFlowBoxes = [];
let flowBoxOverlayEl = null;
let flowBoxOverlayNodes = [];
let externalBoxSyncEnabled = false;
const BOX_ACTIVE_MARGIN = 280;
const boxSpatialGrid = new Map();
const nearbyBoxesScratch = [];
let nearbyBoxesQueryId = 0;
const SIM_FIXED_STEP_MS = 1000 / 60;
const SIM_MAX_FRAME_DELTA_MS = 250;
const RENDER_TARGET_FRAME_MS = 1000 / 60;
let _lastRenderMs = 0;
const SIM_MAX_STEPS_PER_FRAME = 8;

// Pre-allocated scratch objects to avoid per-particle-per-frame GC pressure.
const _duneWindResult = { x: 0, y: 0, duneSignal: 0 };
const _boxInfluenceResult = { x: 0, y: 0 };
const _wakeSwirlResult = { x: 0, y: 0 };
const _interpolatedPos = { x: 0, y: 0 };
const _segmentResult = { fromX: 0, fromY: 0, toX: 0, toY: 0 };
const _frameCacheScratch = {
  nowMs: 0, windDirX: 0, windDirY: 0, windPerpX: 0, windPerpY: 0,
  duneDirX: 0, duneDirY: 0, dunePerpX: 0, dunePerpY: 0,
  duneBandOffsetPx: 0, driftPixels: 0,
};
const _interpolatedBoxPos = { x: 0, y: 0 };

// Boid flocking spatial grid and scratch data for boosted particles.
const boidGrid = new Map();
const boidActiveIndices = [];
const boidCellXs = [];
const boidCellYs = [];
const _boidSteer = { x: 0, y: 0 };

let draggedBoxIndex = -1;
let dragOffsetX = 0;
let dragOffsetY = 0;
let controlsBound = false;
let dynamicSeparationEveryNFrames = CONFIG.separationEveryNFrames;
let lastDrawTimeMs = 0;
let manualScrollActive = false;
let scrollJustEnded = false;
let debugFadeParticleIndex = -1;
let debugFadeLog = [];
const separationActiveIndices = [];
const separationCellXs = [];
const separationCellYs = [];
const separationGrid = new Map();
const CELL_KEY_OFFSET = 32768;
const CELL_KEY_STRIDE = 65536;
const QUALITY_BASELINE_KEYS = [
  'particleRenderFraction',
  'particleRenderMinSpeed',
  'maxSeparationPairsPerTick',
  'maxSeparationCandidatesPerCell',
  'separationEveryNFrames',
];
const QUALITY_TIER_SETTINGS = [
  { renderFractionMul: 1, minSpeedAdd: 0, pairMul: 1, candidateMul: 1, sepEveryAdd: 0 },
  { renderFractionMul: 0.86, minSpeedAdd: 0.03, pairMul: 0.85, candidateMul: 0.9, sepEveryAdd: 0 },
  { renderFractionMul: 0.7, minSpeedAdd: 0.08, pairMul: 0.68, candidateMul: 0.75, sepEveryAdd: 1 },
  { renderFractionMul: 0.55, minSpeedAdd: 0.13, pairMul: 0.52, candidateMul: 0.6, sepEveryAdd: 2 },
  { renderFractionMul: 0.4, minSpeedAdd: 0.18, pairMul: 0.38, candidateMul: 0.48, sepEveryAdd: 3 },
];
const qualityState = {
  tier: 0,
  avgFrameMs: 16.7,
  lastFrameMs: null,
  badMsAccum: 0,
  goodMsAccum: 0,
  lastTierChangeMs: 0,
  baseline: {},
  target: {},
  effective: {},
  hudEl: null,
  lastHudPaintMs: 0,
};
let detectedRefreshRateFps = null;
let currentRenderScale = 1;
let simulationLoopRunning = true;
let simulationVisibilityListenerBound = false;
let pauseToggleBound = false;
let resetControlsBound = false;
let simAccumulatorMs = 0;
let simLastFrameMs = null;
let simTimeMs = 0;
let simStepCount = 0;
let simRenderAlpha = 1;
let lastSeparationCadenceAdjustMs = 0;

applyConfigFromUrlParams();

function getQualityValue(key) {
  if (Object.prototype.hasOwnProperty.call(qualityState.effective, key)) {
    return qualityState.effective[key];
  }
  return CONFIG[key];
}

function initQualityManager() {
  for (let i = 0; i < QUALITY_BASELINE_KEYS.length; i++) {
    const key = QUALITY_BASELINE_KEYS[i];
    qualityState.baseline[key] = CONFIG[key];
  }
  applyQualityTier(0, true);
  window.__mournQuality = qualityState;
}

function ensureFlowBoxOverlay() {
  if (flowBoxOverlayEl && document.body.contains(flowBoxOverlayEl)) {
    return flowBoxOverlayEl;
  }
  flowBoxOverlayEl = document.getElementById('flow-box-overlay');
  return flowBoxOverlayEl;
}

function colorToCssRgba(color) {
  const r = clampColorByte(color?.[0] ?? 255);
  const g = clampColorByte(color?.[1] ?? 255);
  const b = clampColorByte(color?.[2] ?? 255);
  const a = clampColorByte(color?.[3] ?? 255) / 255;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(4)})`;
}

function syncFlowBoxOverlay() {
  const overlay = ensureFlowBoxOverlay();
  if (!overlay) {
    return;
  }

  const shouldShow = CONFIG.showBoxes && sourceFlowBoxes.length > 0;
  overlay.style.display = shouldShow ? 'block' : 'none';
  if (!shouldShow) {
    return;
  }

  while (flowBoxOverlayNodes.length < sourceFlowBoxes.length) {
    const node = document.createElement('div');
    node.className = 'flow-box-overlay__box';
    overlay.appendChild(node);
    flowBoxOverlayNodes.push(node);
  }
  while (flowBoxOverlayNodes.length > sourceFlowBoxes.length) {
    const node = flowBoxOverlayNodes.pop();
    node.remove();
  }

  const idleBorderColor = colorToCssRgba(RENDER_COLORS.boxStrokeIdle);
  for (let i = 0; i < sourceFlowBoxes.length; i++) {
    const box = sourceFlowBoxes[i];
    const node = flowBoxOverlayNodes[i];
    node.style.transform = `translate(${box.x}px, ${box.y}px)`;
    node.style.width = `${box.w}px`;
    node.style.height = `${box.h}px`;
    node.style.borderWidth = '1.5px';
    node.style.borderColor = idleBorderColor;
  }
}

function getActiveRenderScale() {
  if (!CONFIG.enableAutoRenderScale) {
    return 1;
  }
  const thresholdPx = max(320, CONFIG.autoRenderScaleThresholdPx);
  const viewportW = max(1, window.innerWidth);
  const viewportH = max(1, window.innerHeight);
  const maxInternalDim = max(viewportW, viewportH);
  if (maxInternalDim <= thresholdPx) {
    return 1;
  }
  return constrain(thresholdPx / maxInternalDim, 0.3, 1);
}

function applyRenderScale(nextScale) {
  const safeScale = constrain(nextScale, 0.3, 1);
  const nextW = max(1, floor(window.innerWidth * safeScale));
  const nextH = max(1, floor(window.innerHeight * safeScale));
  const prevW = width || nextW;
  const prevH = height || nextH;
  const scaleX = prevW > 0 ? nextW / prevW : 1;
  const scaleY = prevH > 0 ? nextH / prevH : 1;

  resizeCanvas(nextW, nextH);
  currentRenderScale = safeScale;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.pos.x *= scaleX;
    p.pos.y *= scaleY;
    p.prevX *= scaleX;
    p.prevY *= scaleY;
    p.displayX *= scaleX;
    p.displayY *= scaleY;
    p.vel.x *= scaleX;
    p.vel.y *= scaleY;
  }

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    b.prevX *= scaleX;
    b.prevY *= scaleY;
    b.x *= scaleX;
    b.y *= scaleY;
    b.w *= scaleX;
    b.h *= scaleY;
  }
}

function updateQualityBaseline(key, value) {
  if (!Object.prototype.hasOwnProperty.call(qualityState.baseline, key)) {
    return;
  }
  qualityState.baseline[key] = value;
  applyQualityTier(qualityState.tier);
}

function applyQualityTier(tier, snap = false) {
  const clampedTier = constrain(tier, 0, QUALITY_TIER_SETTINGS.length - 1);
  const settings = QUALITY_TIER_SETTINGS[clampedTier];
  const b = qualityState.baseline;
  qualityState.tier = clampedTier;
  qualityState.target.particleRenderFraction = constrain(
    b.particleRenderFraction * settings.renderFractionMul,
    0.01,
    1
  );
  qualityState.target.particleRenderMinSpeed = max(
    0,
    b.particleRenderMinSpeed + settings.minSpeedAdd
  );
  qualityState.target.maxSeparationPairsPerTick = max(
    1,
    floor(b.maxSeparationPairsPerTick * settings.pairMul)
  );
  qualityState.target.maxSeparationCandidatesPerCell = max(
    1,
    floor(b.maxSeparationCandidatesPerCell * settings.candidateMul)
  );
  qualityState.target.separationEveryNFrames = max(
    1,
    floor(b.separationEveryNFrames + settings.sepEveryAdd)
  );
  if (snap) {
    qualityState.effective.particleRenderFraction = qualityState.target.particleRenderFraction;
    qualityState.effective.particleRenderMinSpeed = qualityState.target.particleRenderMinSpeed;
    qualityState.effective.maxSeparationPairsPerTick = qualityState.target.maxSeparationPairsPerTick;
    qualityState.effective.maxSeparationCandidatesPerCell = qualityState.target.maxSeparationCandidatesPerCell;
    qualityState.effective.separationEveryNFrames = qualityState.target.separationEveryNFrames;
  }
}

function smoothQualityEffective(dt) {
  const transitionMs = max(80, CONFIG.qualityTransitionMs);
  const alpha = 1 - Math.exp(-dt / transitionMs);
  const lerpNum = (current, target) => {
    const c = Number.isFinite(current) ? current : target;
    return c + (target - c) * alpha;
  };

  qualityState.effective.particleRenderFraction = lerpNum(
    qualityState.effective.particleRenderFraction,
    qualityState.target.particleRenderFraction
  );
  qualityState.effective.particleRenderMinSpeed = lerpNum(
    qualityState.effective.particleRenderMinSpeed,
    qualityState.target.particleRenderMinSpeed
  );
  qualityState.effective.maxSeparationPairsPerTick = lerpNum(
    qualityState.effective.maxSeparationPairsPerTick,
    qualityState.target.maxSeparationPairsPerTick
  );
  qualityState.effective.maxSeparationCandidatesPerCell = lerpNum(
    qualityState.effective.maxSeparationCandidatesPerCell,
    qualityState.target.maxSeparationCandidatesPerCell
  );
  qualityState.effective.separationEveryNFrames = lerpNum(
    qualityState.effective.separationEveryNFrames,
    qualityState.target.separationEveryNFrames
  );
}

function ensureQualityHud() {
  if (!CONFIG.qualityHudEnabled) {
    if (qualityState.hudEl) {
      qualityState.hudEl.style.display = 'none';
    }
    return;
  }
  if (!qualityState.hudEl) {
    const el = document.createElement('div');
    el.id = 'perf-hud';
    el.style.position = 'fixed';
    el.style.left = '10px';
    el.style.bottom = '10px';
    el.style.zIndex = '20000';
    el.style.padding = '6px 8px';
    el.style.borderRadius = '6px';
    el.style.background = 'rgba(0, 0, 0, 0.65)';
    el.style.color = '#f4efe2';
    el.style.font = '12px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
    qualityState.hudEl = el;
  }
  qualityState.hudEl.style.display = 'block';
}

function applyQualityTargetFpsBounds(panel) {
  if (!panel) return;
  const targetInput = panel.querySelector('[data-key="qualityTargetFps"]');
  if (!targetInput) return;
  const maxFps = detectedRefreshRateFps || 120;
  targetInput.max = String(maxFps);
  if (CONFIG.qualityTargetFps > maxFps) {
    CONFIG.qualityTargetFps = maxFps;
    targetInput.value = String(maxFps);
    updateControlOutput('qualityTargetFps', maxFps, 0);
    syncUrlParamsFromConfig();
  }
}

function applySimulationPauseState() {
  const shouldPause = Boolean(CONFIG.pauseSimulation || document.hidden);
  if (typeof window.__mournSetAutoScrollPaused === 'function') {
    window.__mournSetAutoScrollPaused(shouldPause);
  }
  if (shouldPause && simulationLoopRunning) {
    noLoop();
    simulationLoopRunning = false;
    syncPauseToggleButton();
    return;
  }
  if (!shouldPause && !simulationLoopRunning) {
    loop();
    simulationLoopRunning = true;
    qualityState.lastFrameMs = null;
    simLastFrameMs = null;
    simAccumulatorMs = 0;
    lastDrawTimeMs = 0;
    lastSeparationCadenceAdjustMs = millis();
  }
  syncPauseToggleButton();
}

function paintQualityHud(nowMs) {
  if (!CONFIG.qualityHudEnabled) return;
  ensureQualityHud();
  if (!qualityState.hudEl) return;
  if (nowMs - qualityState.lastHudPaintMs < 180) return;
  qualityState.lastHudPaintMs = nowMs;
  const fps = qualityState.avgFrameMs > 0.01 ? 1000 / qualityState.avgFrameMs : 0;
  const targetFps = max(1, CONFIG.qualityTargetFps);
  const rf = getQualityValue('particleRenderFraction');
  const pairs = getQualityValue('maxSeparationPairsPerTick');
  const maxParticles = max(1, floor(CONFIG.particleCount));
  const viewportW = max(1, window.innerWidth || 0);
  const viewportH = max(1, window.innerHeight || 0);
  const internalW = max(1, width || 0);
  const internalH = max(1, height || 0);
  const autoScaleActive = CONFIG.enableAutoRenderScale && currentRenderScale < 0.999;
  const oscillation = getOscillationState();
  const currentFadeAlpha = getCurrentBackgroundFadeAlpha();
  const currentParticleAlpha = getCurrentParticleAlpha();
  const oscSlots = 9;
  const oscIndex = oscillation.enabled
    ? constrain(Math.round(oscillation.eased * (oscSlots - 1)), 0, oscSlots - 1)
    : 0;
  let oscTrack = '';
  for (let i = 0; i < oscSlots; i++) {
    oscTrack += i === oscIndex ? '●' : '·';
  }
  qualityState.hudEl.innerHTML =
    `<div>FPS ${fps.toFixed(1)} (Target ${targetFps.toFixed(0)}) | Avg Frame ${qualityState.avgFrameMs.toFixed(2)} ms | Quality Tier ${qualityState.tier}` +
    `${CONFIG.lockQualityTier ? ' (locked)' : ''}` +
    ` | Render Fraction ${rf.toFixed(2)} | Separation Pair Budget ${pairs} | Particles ${particles.length}/${maxParticles}</div>` +
    `<div>Viewport ${viewportW}x${viewportH}px | Render Scale ${currentRenderScale.toFixed(2)}${autoScaleActive ? ' (auto)' : ''} | Internal Canvas ${internalW}x${internalH}px</div>` +
    `<div>Osc A ${oscTrack} B${oscillation.enabled ? ` | ${CONFIG.backgroundFadeOscillationPeriodSec.toFixed(1)}s` : ' | off'} | Bg ${currentFadeAlpha.toFixed(2)} | P ${currentParticleAlpha.toFixed(2)}</div>`;
}

function getAdaptiveQualityThresholdsMs() {
  const targetFps = max(1, CONFIG.qualityTargetFps);
  const targetFrameMs = 1000 / targetFps;
  return {
    degrade: targetFrameMs * 1.08,
    recover: targetFrameMs * 1.01,
  };
}

function tickAdaptiveQuality(nowMs) {
  if (!CONFIG.enableAdaptiveQuality) {
    if (qualityState.tier !== 0) {
      applyQualityTier(0);
    }
    smoothQualityEffective(16.7);
    paintQualityHud(nowMs);
    qualityState.lastFrameMs = nowMs;
    return;
  }

  if (qualityState.lastFrameMs === null) {
    qualityState.lastFrameMs = nowMs;
    paintQualityHud(nowMs);
    return;
  }

  const dt = constrain(nowMs - qualityState.lastFrameMs, 1, 120);
  qualityState.lastFrameMs = nowMs;
  qualityState.avgFrameMs += (dt - qualityState.avgFrameMs) * 0.08;
  smoothQualityEffective(dt);

  const thresholds = getAdaptiveQualityThresholdsMs();
  const degradeThresholdMs = thresholds.degrade;
  const recoverThresholdMs = thresholds.recover;

  if (qualityState.avgFrameMs > degradeThresholdMs) {
    qualityState.badMsAccum += dt;
    qualityState.goodMsAccum = max(0, qualityState.goodMsAccum - dt * 0.5);
  } else if (qualityState.avgFrameMs < recoverThresholdMs) {
    qualityState.goodMsAccum += dt;
    qualityState.badMsAccum = max(0, qualityState.badMsAccum - dt * 0.5);
  } else {
    qualityState.badMsAccum = max(0, qualityState.badMsAccum - dt * 0.2);
    qualityState.goodMsAccum = max(0, qualityState.goodMsAccum - dt * 0.2);
  }

  const cooldownElapsed = nowMs - qualityState.lastTierChangeMs >= CONFIG.qualityCooldownMs;
  if (CONFIG.lockQualityTier) {
    paintQualityHud(nowMs);
    return;
  }

  if (cooldownElapsed && qualityState.badMsAccum >= CONFIG.qualityDecisionWindowMs) {
    if (qualityState.tier < QUALITY_TIER_SETTINGS.length - 1) {
      applyQualityTier(qualityState.tier + 1);
      qualityState.lastTierChangeMs = nowMs;
    }
    qualityState.badMsAccum = 0;
    qualityState.goodMsAccum = 0;
  } else if (cooldownElapsed && qualityState.goodMsAccum >= CONFIG.qualityDecisionWindowMs) {
    if (qualityState.tier > 0) {
      applyQualityTier(qualityState.tier - 1);
      qualityState.lastTierChangeMs = nowMs;
    }
    qualityState.badMsAccum = 0;
    qualityState.goodMsAccum = 0;
  }

  paintQualityHud(nowMs);
}

function addParticles(count) {
  const n = max(0, floor(count));
  for (let i = 0; i < n; i++) {
    const ignoresBoxCollision = random() >= CONFIG.boxCollisionParticipantRatio;
    particles.push(createParticle(random(width), random(height), ignoresBoxCollision));
  }
}

function removeParticles(count) {
  const n = max(0, floor(count));
  if (n <= 0) return;
  if (n >= particles.length) {
    particles.length = 0;
    return;
  }
  particles.length = particles.length - n;
}

function syncParticleBoxCollisionParticipation() {
  const ratio = constrain(CONFIG.boxCollisionParticipantRatio, 0, 1);
  const count = particles.length;
  for (let i = 0; i < count; i++) {
    particles[i].ignoresBoxCollision = !particles[i].isBoosted && (i / max(1, count)) >= ratio;
  }
}

class FlowBox {
  constructor(x, y, w, h) {
    this.prevX = x;
    this.prevY = y;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
  }

  setPosition(x, y) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x = x;
    this.y = y;
  }
}

function setup() {
  frameRate(60);
  detectedRefreshRateFps = 60;
  currentRenderScale = getActiveRenderScale();
  const canvas = createCanvas(
    max(1, floor(windowWidth * currentRenderScale)),
    max(1, floor(windowHeight * currentRenderScale))
  );
  const mount = document.getElementById('poem-bg');
  if (mount) {
    canvas.parent(mount);
  }
  canvas.style('width', '100%');
  canvas.style('height', '100%');
  noStroke();
  const showDebugUI = new URLSearchParams(window.location.search).has('debug');
  if (showDebugUI) {
    setupDuneControls();
  } else {
    const panel = document.getElementById('dune-controls');
    if (panel) panel.style.display = 'none';
    const pauseBtn = document.getElementById('simulation-pause-toggle');
    if (pauseBtn) pauseBtn.style.display = 'none';
    CONFIG.qualityHudEnabled = false;
  }
  initQualityManager();
  ensureQualityHud();
  ensureFlowBoxOverlay();
  if (!simulationVisibilityListenerBound) {
    document.addEventListener('visibilitychange', applySimulationPauseState);
    simulationVisibilityListenerBound = true;
  }
  applySimulationPauseState();

  fill(...RENDER_COLORS.fade);
  rect(0, 0, width, height);
  simTimeMs = millis();
  simLastFrameMs = null;
  simAccumulatorMs = 0;
  simStepCount = 0;
  simRenderAlpha = 1;
  lastSeparationCadenceAdjustMs = simTimeMs;

  for (let i = 0; i < CONFIG.particleCount; i++) {
    const ignoresBoxCollision = i / CONFIG.particleCount >= CONFIG.boxCollisionParticipantRatio;
    particles.push(createParticle(random(width), random(height), ignoresBoxCollision));
  }

  // Expose API for external apps (poem) to drive box positions.
  window.setFlowBoxes = function setFlowBoxes(nextBoxes = []) {
    externalBoxSyncEnabled = true;
    draggedBoxIndex = -1;
    sourceFlowBoxes = nextBoxes.map((box) => ({
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
    }));
    syncFlowBoxOverlay();

    while (boxes.length < nextBoxes.length) {
      boxes.push(new FlowBox(0, 0, 1, 1));
    }
    while (boxes.length > nextBoxes.length) {
      boxes.pop();
    }

    for (let i = 0; i < nextBoxes.length; i++) {
      const src = nextBoxes[i];
      const box = boxes[i];
      const simScale = currentRenderScale;
      box.prevX = box.x;
      box.prevY = box.y;
      box.x = src.x * simScale;
      box.y = src.y * simScale;
      box.w = src.w * simScale;
      box.h = src.h * simScale;
      box.vx = 0;
      box.vy = 0;
    }
  };

  // Runtime helper for quickly spawning additional rectangles during experimentation.
  window.addBox = function addBox(x, y, w = 180, h = 110) {
    externalBoxSyncEnabled = false;
    const nx = Number.isFinite(x) ? x : width * 0.5 - w * 0.5;
    const ny = Number.isFinite(y) ? y : height * 0.5 - h * 0.5;
    boxes.push(new FlowBox(nx, ny, w, h));
  };

  // Manual-scroll freeze: snapshot particles near boxes and freeze them in place.
  window.onManualScrollStart = function onManualScrollStart() {
    manualScrollActive = true;
    const band = CONFIG.surfaceSlideBand;
    debugFadeParticleIndex = -1;
    debugFadeLog = [];
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      // Clear collision-disabled state — boxes have moved so previous penetration
      // state is no longer meaningful.
      particle.scrollFrozen = false;
      particle.scrollCollisionDisabled = false;
      // Do NOT reset scrollUnfrozeAtMs here. Particles mid-fade from a previous
      // scroll should continue their fade uninterrupted. Resetting to 0 would set
      // scrollFadeFactor=1 (full alpha) causing a visible pop.
      if (particle.ignoresBoxCollision) continue;
      const nearbyBoxes = getNearbyBoxesForPoint(particle.pos.x, particle.pos.y);
      for (let j = 0; j < nearbyBoxes.length; j++) {
        if (isNearBox(particle.pos.x, particle.pos.y, nearbyBoxes[j], band)) {
          // Save fade progress so it can resume after this freeze cycle ends,
          // rather than restarting the fade from 0 each time the user re-scrolls.
          if (particle.scrollUnfrozeAtMs > 0) {
            const fadeInMs = max(1, CONFIG.scrollFreezeFadeInMs);
            particle.scrollFadeProgress = constrain((millis() - particle.scrollUnfrozeAtMs) / fadeInMs, 0, 1);
          } else if (particle.scrollUnfrozeAtMs === -1) {
            particle.scrollFadeProgress = 0;
          }
          // else scrollUnfrozeAtMs === 0 → not fading, scrollFadeProgress unchanged (stays 0)
          particle.scrollFrozen = true;
          particle.scrollUnfrozeAtMs = 0;
          if (debugFadeParticleIndex === -1) {
            debugFadeParticleIndex = i;
          }
          break;
        }
      }
    }
  };

  // Move frozen particles by the screen-space scroll delta.
  window.applyManualScrollDelta = function applyManualScrollDelta(screenDx, screenDy) {
    if (!manualScrollActive) return;
    const simDx = screenDx * currentRenderScale;
    const simDy = screenDy * currentRenderScale;
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      if (!particle.scrollFrozen) continue;
      particle.pos.x += simDx;
      particle.pos.y += simDy;
      particle.prevX = particle.pos.x;
      particle.prevY = particle.pos.y;
      particle.displayX = particle.pos.x;
      particle.displayY = particle.pos.y;
    }
  };

  // Release all frozen particles when manual scroll ends.
  window.onManualScrollEnd = function onManualScrollEnd() {
    manualScrollActive = false;
    let frozenCount = 0;
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      if (particle.scrollFrozen) {
        frozenCount++;
        particle.vel.x = 0;
        particle.vel.y = 0;
        particle.scrollFrozen = false;
        // Resume fade from saved progress rather than always restarting from 0.
        // scrollFadeProgress > 0 means we interrupted a previous fade mid-way.
        if (particle.scrollFadeProgress > 0) {
          const fadeInMs = max(1, CONFIG.scrollFreezeFadeInMs);
          particle.scrollUnfrozeAtMs = millis() - particle.scrollFadeProgress * fadeInMs;
          particle.scrollFadeProgress = 0;
        } else {
          particle.scrollUnfrozeAtMs = -1;
        }
        syncParticleDisplayState(particle);
        continue;
      }
      // Particles that drifted inside boxes during scroll: disable their
      // collision so they pass through naturally instead of being ejected.
      // Collision is re-enabled when they wrap at the screen edge.
      if (particle.ignoresBoxCollision || particle.scrollCollisionDisabled) continue;
      const nearbyBoxes = getNearbyBoxesForPoint(particle.pos.x, particle.pos.y);
      for (let j = 0; j < nearbyBoxes.length; j++) {
        if (isParticleInsideBox(particle.pos.x, particle.pos.y, nearbyBoxes[j])) {
          particle.scrollCollisionDisabled = true;
          break;
        }
      }
    }
    console.log(`[scroll-fade] onManualScrollEnd: ${frozenCount} frozen particles released, fadeInMs=${CONFIG.scrollFreezeFadeInMs}`);
  };

  window.getScrollFreezeDebounceMs = function getScrollFreezeDebounceMs() {
    return CONFIG.scrollFreezeDebounceMs;
  };
}

function draw() {
  const nowMs = millis();
  if (nowMs - _lastRenderMs < RENDER_TARGET_FRAME_MS) return;
  _lastRenderMs = nowMs;
  tickAdaptiveQuality(nowMs);
  if (simLastFrameMs === null) {
    simLastFrameMs = nowMs;
  }
  let frameDeltaMs = nowMs - simLastFrameMs;
  simLastFrameMs = nowMs;
  frameDeltaMs = constrain(frameDeltaMs, 0, SIM_MAX_FRAME_DELTA_MS);
  const dtFrames = constrain(frameDeltaMs / SIM_FIXED_STEP_MS, 0, MAX_EFFECTIVE_DT_FRAMES);
  simTimeMs = nowMs;
  simStepCount += 1;
  fadeCanvas();
  updateBoxes(dtFrames);
  updateActiveBoxes();
  simRenderAlpha = 1;
  updateParticles(nowMs, simStepCount, true, dtFrames);
  updateAdaptiveSeparationCadence(nowMs);
  renderParticles(dtFrames);
  renderBoxes();
}

function windowResized() {
  applyRenderScale(getActiveRenderScale());
}

function fadeCanvas() {
  fill(...RENDER_COLORS.fade, getCurrentBackgroundFadeAlpha());
  rect(0, 0, width, height);
}

function getCurrentBackgroundFadeAlpha() {
  const alphaA = clampColorByte(CONFIG.trailAlpha);
  const alphaB = clampColorByte(CONFIG.trailAlphaSecondary);
  return getOscillatingAlpha(alphaA, alphaB);
}

function getCurrentParticleAlpha() {
  const alphaA = clampColorByte(RENDER_COLORS.particles.length > 3 ? RENDER_COLORS.particles[3] : 255);
  const alphaB = clampColorByte(CONFIG.particleAlphaSecondary);
  return getOscillatingAlpha(alphaA, alphaB);
}

function getOscillationState() {
  const periodSec = max(0, CONFIG.backgroundFadeOscillationPeriodSec);
  if (periodSec <= 0) {
    return { enabled: false, phase: 0, eased: 0 };
  }
  const phase = (millis() * 0.001 / periodSec) % 1;
  const eased = 0.5 - 0.5 * cos(phase * TWO_PI);
  return { enabled: true, phase, eased };
}

function getOscillatingAlpha(alphaA, alphaB) {
  const state = getOscillationState();
  if (!state.enabled || alphaA === alphaB) {
    return alphaA;
  }
  return lerp(alphaA, alphaB, state.eased);
}

function setupDuneControls() {
  if (controlsBound) return;

  const panel = document.getElementById('dune-controls');
  if (!panel) return;

  controlsBound = true;
  applyControlTooltips(panel);
  const edgeRespawnMixInput = panel.querySelector('[data-key="edgeRespawnWeightedMixPercent"]');
  const BOOSTED_CONTROL_KEYS = new Set([
    'windBoostParticleRatio',
    'windBoostSizeMultiplier',
    'windBoostMinMultiplier',
    'windBoostMaxMultiplier',
    'windBoostTurbulenceMinMultiplier',
    'windBoostTurbulenceMaxMultiplier',
  ]);
  const syncEdgeRespawnMixDisabledState = () => {
    if (!edgeRespawnMixInput) return;
    edgeRespawnMixInput.disabled = Boolean(CONFIG.useWeightedEdgeRespawn);
  };

  for (let i = 0; i < CONTROL_PARAM_DEFS.length; i++) {
    const def = CONTROL_PARAM_DEFS[i];
    const input = panel.querySelector(`[data-key="${def.key}"]`);
    if (!input) continue;

    if (def.type === 'bool') {
      input.checked = Boolean(CONFIG[def.key]);
    } else {
      input.value = String(CONFIG[def.key]);
      updateControlOutput(def.key, CONFIG[def.key], def.digits);
    }

    input.addEventListener('dblclick', () => {
      const defaultVal = CONFIG_DEFAULTS[def.key];
      if (def.type === 'bool') {
        input.checked = Boolean(defaultVal);
      } else {
        input.value = String(defaultVal);
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    input.addEventListener('input', () => {
      if (def.type === 'bool') {
        CONFIG[def.key] = input.checked;
      } else {
        const parsed = Number(input.value);
        if (!Number.isFinite(parsed)) return;
        let nextValue = parsed;
        if (def.key === 'particleCount') {
          nextValue = max(1, floor(parsed));
          input.value = String(nextValue);
        }
        if (def.key === 'boxCollisionParticipantRatio') {
          nextValue = constrain(parsed, 0, 1);
          input.value = String(nextValue);
        }
        if (def.key === 'autoRenderScaleThresholdPx') {
          nextValue = max(320, floor(parsed));
          input.value = String(nextValue);
        }
        if (def.key === 'qualityTargetFps' && detectedRefreshRateFps !== null) {
          nextValue = constrain(parsed, 20, detectedRefreshRateFps);
          input.value = String(nextValue);
        }
        CONFIG[def.key] = nextValue;
        updateControlOutput(def.key, nextValue, def.digits);
        if (def.key === 'particleCount') {
          const target = max(1, floor(CONFIG.particleCount));
          if (particles.length < target) {
            addParticles(target - particles.length);
          } else if (particles.length > target) {
            removeParticles(particles.length - target);
          }
          syncParticleBoxCollisionParticipation();
        }
        if (def.key === 'boxCollisionParticipantRatio') {
          syncParticleBoxCollisionParticipation();
        }
      }
      if (
        def.key === 'enableAutoRenderScale' ||
        def.key === 'autoRenderScaleThresholdPx'
      ) {
        applyRenderScale(getActiveRenderScale());
      }
      if (def.key === 'pauseSimulation') {
        applySimulationPauseState();
      }
      updateQualityBaseline(def.key, CONFIG[def.key]);
      if (def.key === 'useWeightedEdgeRespawn') {
        syncEdgeRespawnMixDisabledState();
      }
      if (BOOSTED_CONTROL_KEYS.has(def.key)) {
        syncBoostedParticleConfig(def.key === 'windBoostParticleRatio');
      }
      syncColorAlphaInputsForConfigKey(def.key);
      syncUrlParamsFromConfig();
    });
  }
  syncEdgeRespawnMixDisabledState();

  bindColorControls(panel);
  bindColorAlphaControls(panel);
  bindAngleControls(panel);
  bindPauseToggleButton();
  bindResetControlsButton();
  bindWordColliderControls(panel);
  setupDetailsPersistence(panel);
  applyQualityTargetFpsBounds(panel);
}

function bindAngleControls(panel) {
  const angleControls = panel.querySelectorAll('[data-angle-key]');
  for (let i = 0; i < angleControls.length; i++) {
    const control = angleControls[i];
    const key = control.getAttribute('data-angle-key');
    if (!key) continue;
    const input = panel.querySelector(`[data-key="${key}"]`);
    if (!input) continue;
    let pointerAngleOffsetDeg = 0;

    const getDisplayAngleDeg = (valueDeg) => {
      if (key === 'ambientWindDirectionDeg') {
        return valueDeg + 90;
      }
      return valueDeg;
    };

    const normalizeAngleDeg = (valueDeg) => {
      let next = valueDeg;
      while (next > 180) next -= 360;
      while (next < -180) next += 360;
      return next;
    };

    const syncVisual = () => {
      const value = Number(input.value);
      const safeValue = Number.isFinite(value) ? value : 0;
      control.style.setProperty('--angle-deg', `${getDisplayAngleDeg(safeValue)}deg`);
      control.setAttribute('aria-valuemin', String(input.min || -180));
      control.setAttribute('aria-valuemax', String(input.max || 180));
      control.setAttribute('aria-valuenow', String(safeValue));
      control.setAttribute('aria-valuetext', `${safeValue} degrees`);
      control.setAttribute('role', 'slider');
      control.tabIndex = 0;
    };

    const getPointerAngleDeg = (clientX, clientY) => {
      const rect = control.getBoundingClientRect();
      const centerX = rect.left + rect.width * 0.5;
      const centerY = rect.top + rect.height * 0.5;
      return Math.round(Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI));
    };

    const displayAngleToValueAngle = (displayAngleDeg) => normalizeAngleDeg(
      key === 'ambientWindDirectionDeg'
        ? displayAngleDeg - 90
        : displayAngleDeg
    );

    const setFromPointer = (clientX, clientY) => {
      const pointerAngleDeg = getPointerAngleDeg(clientX, clientY);
      const displayAngleDeg = normalizeAngleDeg(pointerAngleDeg - pointerAngleOffsetDeg);
      const valueAngleDeg = normalizeAngleDeg(
        displayAngleToValueAngle(displayAngleDeg)
      );
      input.value = String(constrain(valueAngleDeg, -180, 180));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const onPointerMove = (event) => {
      setFromPointer(event.clientX, event.clientY);
    };

    control.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      control.setPointerCapture(event.pointerId);
      const current = Number(input.value);
      const safeCurrent = Number.isFinite(current) ? current : 0;
      const pointerAngleDeg = getPointerAngleDeg(event.clientX, event.clientY);
      pointerAngleOffsetDeg = normalizeAngleDeg(pointerAngleDeg - getDisplayAngleDeg(safeCurrent));
    });
    control.addEventListener('pointermove', (event) => {
      if ((event.buttons & 1) !== 1) return;
      onPointerMove(event);
    });
    control.addEventListener('keydown', (event) => {
      const current = Number(input.value);
      const safeCurrent = Number.isFinite(current) ? current : 0;
      let next = null;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        next = safeCurrent - 1;
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        next = safeCurrent + 1;
      }
      if (next === null) return;
      event.preventDefault();
      input.value = String(constrain(next, -180, 180));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    input.addEventListener('input', syncVisual);
    syncVisual();
  }
}

function syncPauseToggleButton() {
  const button = document.getElementById('simulation-pause-toggle');
  if (!button) return;
  const label = button.querySelector('.pause-label');
  const isPaused = Boolean(CONFIG.pauseSimulation);
  button.classList.toggle('is-paused', isPaused);
  button.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
  button.setAttribute('title', isPaused ? 'Resume simulation' : 'Pause simulation');
  if (label) {
    label.textContent = isPaused ? 'Play' : 'Pause';
  }
}

function bindPauseToggleButton() {
  if (pauseToggleBound) return;
  const button = document.getElementById('simulation-pause-toggle');
  if (!button) return;
  pauseToggleBound = true;
  syncPauseToggleButton();
  button.addEventListener('click', () => {
    CONFIG.pauseSimulation = !CONFIG.pauseSimulation;
    syncStandardControlInput('pauseSimulation');
    applySimulationPauseState();
    syncUrlParamsFromConfig();
  });
}

function bindWordColliderControls(panel) {
  const enabledInput = panel.querySelector('#word-collider-enabled');
  const wordBoxesInput = panel.querySelector('#word-boxes-enabled');
  const insetXInput = panel.querySelector('#word-inset-x');
  const insetYInput = panel.querySelector('#word-inset-y');
  const offsetXInput = panel.querySelector('#word-offset-x');
  const offsetYInput = panel.querySelector('#word-offset-y');
  const insetXOut = panel.querySelector('#word-inset-x-out');
  const insetYOut = panel.querySelector('#word-inset-y-out');
  const offsetXOut = panel.querySelector('#word-offset-x-out');
  const offsetYOut = panel.querySelector('#word-offset-y-out');

  if (enabledInput) {
    enabledInput.addEventListener('change', () => {
      if (typeof window.__mournSetWordCollidersEnabled === 'function') {
        window.__mournSetWordCollidersEnabled(enabledInput.checked);
      }
    });
  }
  if (wordBoxesInput) {
    wordBoxesInput.addEventListener('change', () => {
      if (typeof window.__mournSetWordBoxes === 'function') {
        window.__mournSetWordBoxes(wordBoxesInput.checked);
      }
    });
  }
  const wordColliderDefaults = { insetX: 0, insetY: 0, offsetX: 0, offsetY: 0 };
  const resetWordSlider = (input, output, defaultVal) => {
    input.value = String(defaultVal);
    if (output) output.textContent = String(defaultVal);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  if (insetXInput) {
    insetXInput.addEventListener('dblclick', () => resetWordSlider(insetXInput, insetXOut, wordColliderDefaults.insetX));
    insetXInput.addEventListener('input', () => {
      if (insetXOut) insetXOut.textContent = insetXInput.value;
      if (typeof window.__mournSetWordInsetXPx === 'function') {
        window.__mournSetWordInsetXPx(-Number(insetXInput.value));
      }
    });
  }
  if (insetYInput) {
    insetYInput.addEventListener('dblclick', () => resetWordSlider(insetYInput, insetYOut, wordColliderDefaults.insetY));
    insetYInput.addEventListener('input', () => {
      if (insetYOut) insetYOut.textContent = insetYInput.value;
      if (typeof window.__mournSetWordInsetYPx === 'function') {
        window.__mournSetWordInsetYPx(-Number(insetYInput.value));
      }
    });
  }
  if (offsetXInput) {
    offsetXInput.addEventListener('dblclick', () => resetWordSlider(offsetXInput, offsetXOut, wordColliderDefaults.offsetX));
    offsetXInput.addEventListener('input', () => {
      if (offsetXOut) offsetXOut.textContent = offsetXInput.value;
      if (typeof window.__mournSetWordOffsetX === 'function') {
        window.__mournSetWordOffsetX(offsetXInput.value);
      }
    });
  }
  if (offsetYInput) {
    offsetYInput.addEventListener('dblclick', () => resetWordSlider(offsetYInput, offsetYOut, wordColliderDefaults.offsetY));
    offsetYInput.addEventListener('input', () => {
      if (offsetYOut) offsetYOut.textContent = offsetYInput.value;
      if (typeof window.__mournSetWordOffsetY === 'function') {
        window.__mournSetWordOffsetY(offsetYInput.value);
      }
    });
  }
}

function bindResetControlsButton() {
  if (resetControlsBound) return;
  const button = document.getElementById('reset-controls-button');
  if (!button) return;
  resetControlsBound = true;
  button.addEventListener('click', () => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('dune-controls:')) {
          keysToRemove.push(key);
        }
      }
      for (let i = 0; i < keysToRemove.length; i++) {
        window.localStorage.removeItem(keysToRemove[i]);
      }
    } catch (error) {
      // Ignore storage failures.
    }
    window.location.href = window.location.pathname;
  });
}

function applyControlTooltips(panel) {
  const applyTitle = (target, text) => {
    if (!target || !text) return;
    target.title = text;
    const row = target.closest('label');
    if (row) {
      row.title = text;
    }
  };

  const keys = Object.keys(CONTROL_TOOLTIPS);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const input = panel.querySelector(`[data-key="${key}"]`);
    applyTitle(input, CONTROL_TOOLTIPS[key]);
    const angleButton = panel.querySelector(`[data-angle-key="${key}"]`);
    applyTitle(angleButton, CONTROL_TOOLTIPS[key]);
  }

  const colorKeys = Object.keys(COLOR_CONTROL_TOOLTIPS);
  for (let i = 0; i < colorKeys.length; i++) {
    const key = colorKeys[i];
    const input = panel.querySelector(`[data-color-key="${key}"]`);
    applyTitle(input, COLOR_CONTROL_TOOLTIPS[key]);
  }

  const colorAlphaKeys = Object.keys(COLOR_ALPHA_CONTROL_TOOLTIPS);
  for (let i = 0; i < colorAlphaKeys.length; i++) {
    const key = colorAlphaKeys[i];
    const input = panel.querySelector(`[data-color-alpha-key="${key}"]`);
    applyTitle(input, COLOR_ALPHA_CONTROL_TOOLTIPS[key]);
  }
}

function bindColorControls(panel) {
  for (let i = 0; i < COLOR_PARAM_DEFS.length; i++) {
    const def = COLOR_PARAM_DEFS[i];
    const input = panel.querySelector(`[data-color-key="${def.key}"]`);
    if (!input) continue;

    input.value = rgbArrayToHex(RENDER_COLORS[def.key]);
    updateColorControlOutput(def.key);

    input.addEventListener('dblclick', () => {
      const defaultArr = RENDER_COLORS_DEFAULTS[def.key];
      if (defaultArr) {
        input.value = rgbArrayToHex(defaultArr);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    input.addEventListener('input', () => {
      applyHexToColorKey(def.key, input.value);
      updateColorControlOutput(def.key);
      syncUrlParamsFromConfig();
    });
  }
}

function bindColorAlphaControls(panel) {
  for (let i = 0; i < COLOR_ALPHA_PARAM_DEFS.length; i++) {
    const def = COLOR_ALPHA_PARAM_DEFS[i];
    const input = panel.querySelector(`[data-color-alpha-key="${def.key}"]`);
    if (!input) continue;

    const initial = getColorAlpha(def);
    input.value = String(initial);
    updateColorAlphaControlOutput(def, initial);

    input.addEventListener('dblclick', () => {
      let defaultAlpha = 255;
      if (def.source === 'config') {
        defaultAlpha = CONFIG_DEFAULTS[def.configKey] ?? 255;
      } else {
        const arr = RENDER_COLORS_DEFAULTS[def.key];
        defaultAlpha = (arr && arr.length > 3) ? arr[3] : 255;
      }
      input.value = String(defaultAlpha);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    input.addEventListener('input', () => {
      const parsed = Number(input.value);
      if (!Number.isFinite(parsed)) return;
      const clamped = constrain(parsed, 0, 255);
      setColorAlpha(def, clamped);
      updateColorAlphaControlOutput(def, clamped);
      syncUrlParamsFromConfig();
    });
  }
}

function setupDetailsPersistence(panel) {
  const detailsEls = panel.querySelectorAll('details');
  for (let i = 0; i < detailsEls.length; i++) {
    const detailsEl = detailsEls[i];
    const storageKey = getDetailsStorageKey(detailsEl, i);

    const saved = window.localStorage.getItem(storageKey);
    if (saved === '1') {
      detailsEl.open = true;
    } else if (saved === '0') {
      detailsEl.open = false;
    }

    detailsEl.addEventListener('toggle', () => {
      window.localStorage.setItem(storageKey, detailsEl.open ? '1' : '0');
    });
  }
}

function getDetailsStorageKey(detailsEl, index) {
  const summary = detailsEl.querySelector('summary');
  const label = summary ? summary.textContent.trim().toLowerCase() : `group-${index}`;
  return `dune-controls:details:${label}`;
}

function updateControlOutput(key, value, digits) {
  const output = document.querySelector(`[data-value-for="${key}"]`);
  if (!output) return;

  if (key === 'ambientWindDirectionDeg' || key === 'duneBandRotationDeg') {
    output.textContent = `${Math.round(Number(value))}deg`;
    return;
  }

  if (typeof digits === 'number') {
    output.textContent = Number(value).toFixed(digits);
  } else {
    output.textContent = String(value);
  }
}

function applyConfigFromUrlParams() {
  const params = new URLSearchParams(window.location.search);
  for (let i = 0; i < CONTROL_PARAM_DEFS.length; i++) {
    const def = CONTROL_PARAM_DEFS[i];
    const raw = params.get(def.key);
    if (raw === null) continue;

    if (def.type === 'bool') {
      CONFIG[def.key] = raw === '1' || raw === 'true';
    } else {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        CONFIG[def.key] = parsed;
      }
    }
  }

  for (let i = 0; i < COLOR_PARAM_DEFS.length; i++) {
    const def = COLOR_PARAM_DEFS[i];
    const raw = params.get(def.param);
    if (!raw) continue;
    applyHexToColorKey(def.key, raw);
  }

  for (let i = 0; i < COLOR_ALPHA_PARAM_DEFS.length; i++) {
    const def = COLOR_ALPHA_PARAM_DEFS[i];
    const raw = params.get(def.param);
    if (raw === null) continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    setColorAlpha(def, parsed);
  }
}

function syncUrlParamsFromConfig() {
  const params = new URLSearchParams(window.location.search);
  params.delete('renderScale');
  params.delete('autoRenderScaleMin');
  params.delete('enableTransparentTrails');
  params.delete('particleTrailHistoryLength');
  params.delete('particleTrailRenderPoints');
  params.delete('particleTrailCurved');
  params.delete('particleTrailFadeStrength');
  params.delete('enableWindShadow');
  params.delete('windShadowLength');
  params.delete('windShadowWidthGrowth');
  params.delete('windShadowStrength');
  params.delete('windShadowRotationDeg');
  params.delete('windShadowOffsetAlong');
  params.delete('windShadowOffsetLateral');
  params.delete('showWindShadowZone');
  params.delete('windShadowZoneAlpha');
  params.delete('colorWindShadowZone');
  params.delete('colorWindShadowZoneAlpha');
  params.delete('windBoostLightnessShift');
  params.delete('hillshadeSunAngleDeg');
  params.delete('hillshadeSunElevationDeg');
  params.delete('hillshadeAmbient');
  params.delete('hillshadeNormalStrength');
  params.delete('hillshadeResolutionDivisor');
  params.delete('usePolyShade');
  params.delete('polyGridCols');
  params.delete('polyGridRows');
  params.delete('polyJitter');
  params.delete('polyEdgeAlpha');
  params.delete('polySlopeContrast');
  for (let i = 0; i < CONTROL_PARAM_DEFS.length; i++) {
    const def = CONTROL_PARAM_DEFS[i];
    const val = CONFIG[def.key];
    if (def.type === 'bool') {
      params.set(def.key, val ? '1' : '0');
    } else if (typeof def.digits === 'number') {
      params.set(def.key, Number(val).toFixed(def.digits));
    } else {
      params.set(def.key, String(val));
    }
  }

  for (let i = 0; i < COLOR_PARAM_DEFS.length; i++) {
    const def = COLOR_PARAM_DEFS[i];
    params.set(def.param, rgbArrayToHex(RENDER_COLORS[def.key]).slice(1));
  }
  for (let i = 0; i < COLOR_ALPHA_PARAM_DEFS.length; i++) {
    const def = COLOR_ALPHA_PARAM_DEFS[i];
    params.set(def.param, String(getColorAlpha(def)));
  }

  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', next);
}

function applyHexToColorKey(colorKey, rawHex) {
  const rgb = hexToRgb(rawHex);
  if (!rgb) return;

  const target = RENDER_COLORS[colorKey];
  if (!target || target.length < 3) return;
  target[0] = rgb.r;
  target[1] = rgb.g;
  target[2] = rgb.b;
}

function updateColorControlOutput(colorKey) {
  const output = document.querySelector(`[data-color-value-for="${colorKey}"]`);
  if (!output) return;
  output.textContent = rgbArrayToHex(RENDER_COLORS[colorKey]).toUpperCase();
}

function updateColorAlphaControlOutput(def, value) {
  const output = document.querySelector(`[data-color-alpha-value-for="${def.key}"]`);
  if (!output) return;
  if (typeof def.digits === 'number') {
    output.textContent = Number(value).toFixed(def.digits);
  } else {
    output.textContent = String(value);
  }
}

function getColorAlpha(def) {
  if (def.source === 'config') {
    return clampColorByte(CONFIG[def.configKey]);
  }

  const arr = RENDER_COLORS[def.key];
  if (!arr || arr.length < 4) return 255;
  return clampColorByte(arr[3]);
}

function setColorAlpha(def, value) {
  const a = clampColorByte(value);
  if (def.source === 'config') {
    CONFIG[def.configKey] = a;
    syncStandardControlInput(def.configKey);
    return;
  }

  const arr = RENDER_COLORS[def.key];
  if (!arr) return;
  if (arr.length < 4) {
    arr.push(a);
  } else {
    arr[3] = a;
  }
}

function syncColorAlphaInputsForConfigKey(configKey) {
  for (let i = 0; i < COLOR_ALPHA_PARAM_DEFS.length; i++) {
    const def = COLOR_ALPHA_PARAM_DEFS[i];
    if (def.source !== 'config' || def.configKey !== configKey) continue;
    const input = document.querySelector(`[data-color-alpha-key="${def.key}"]`);
    const current = getColorAlpha(def);
    if (input) {
      input.value = String(current);
    }
    updateColorAlphaControlOutput(def, current);
  }
}

function syncStandardControlInput(configKey) {
  const def = CONTROL_PARAM_DEFS.find((entry) => entry.key === configKey);
  if (!def) return;
  const input = document.querySelector(`[data-key="${configKey}"]`);
  if (!input) return;

  if (def.type === 'bool') {
    input.checked = Boolean(CONFIG[configKey]);
  } else {
    input.value = String(CONFIG[configKey]);
    updateControlOutput(configKey, CONFIG[configKey], def.digits);
  }
}

function rgbArrayToHex(rgb) {
  const r = clampColorByte(rgb && rgb.length > 0 ? rgb[0] : 0);
  const g = clampColorByte(rgb && rgb.length > 1 ? rgb[1] : 0);
  const b = clampColorByte(rgb && rgb.length > 2 ? rgb[2] : 0);
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

function toHexByte(n) {
  return clampColorByte(n).toString(16).padStart(2, '0');
}

function clampColorByte(n) {
  return Math.max(0, Math.min(255, Math.floor(n)));
}

function hexToRgb(rawHex) {
  if (typeof rawHex !== 'string') return null;
  const clean = rawHex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;

  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

// ── Oklab / OkLCh color conversion ───────────────────────────────────────────
// LUT for sRGB gamma encoding: maps quantised linear-light [0,1] → sRGB byte.
// 4096 steps keeps the rounding error well under 1 output byte.
const _SRGB_LUT_SIZE = 4096;
const _SRGB_LUT = new Uint8Array(_SRGB_LUT_SIZE + 1);
for (let i = 0; i <= _SRGB_LUT_SIZE; i++) {
  const c = i / _SRGB_LUT_SIZE;
  _SRGB_LUT[i] = Math.round(
    (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255
  );
}
function _linearToSrgbByte(c) {
  if (c <= 0) return 0;
  if (c >= 1) return 255;
  return _SRGB_LUT[(c * _SRGB_LUT_SIZE + 0.5) | 0];
}

// sRGB (0–255) → Oklab. Returns { L, a, b }.
function srgbToOklab(r, g, b) {
  // Remove sRGB gamma (linearise)
  const toLinear = c => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  // Linear RGB → LMS (Oklab M1)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  // LMS → Lab (Oklab M2)
  return {
    L:  0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a:  1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b:  0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

// Oklab → sRGB (0–255). Returns { r, g, b } as integers.
function oklabToSrgb(L, a, b) {
  // Lab → LMS
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  // LMS → linear RGB
  const lr =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  // Apply sRGB gamma via LUT — avoids Math.pow per channel per particle.
  return { r: _linearToSrgbByte(lr), g: _linearToSrgbByte(lg), b: _linearToSrgbByte(lb) };
}

// sRGB (0–255) → OkLCh. Returns { L, C, h } where h is in radians.
function srgbToOklch(r, g, b) {
  const { L, a, b: bk } = srgbToOklab(r, g, b);
  return { L, C: Math.sqrt(a * a + bk * bk), h: Math.atan2(bk, a) };
}

// OkLCh → sRGB (0–255). Returns { r, g, b } as integers.
function oklchToSrgb(L, C, h) {
  return oklabToSrgb(L, C * Math.cos(h), C * Math.sin(h));
}

function applyBoostedConfigToParticle(particle, reseedBoosted = false) {
  if (reseedBoosted) {
    particle.isBoosted = random() < CONFIG.windBoostParticleRatio;
  }

  const baseSizeMultiplier =
    particle.baseRandomSizeMultiplier ??
    max(
      0.05,
      particle.sizeMultiplier / (particle.isBoosted ? max(CONFIG.windBoostSizeMultiplier, 0.0001) : 1)
    );
  particle.baseRandomSizeMultiplier = baseSizeMultiplier;

  if (particle.isBoosted) {
    particle.windBoostMultiplier = random(
      CONFIG.windBoostMinMultiplier,
      CONFIG.windBoostMaxMultiplier + Number.EPSILON
    );
    particle.turbulenceBoostMultiplier = random(
      CONFIG.windBoostTurbulenceMinMultiplier,
      CONFIG.windBoostTurbulenceMaxMultiplier + Number.EPSILON
    );
    particle.sizeMultiplier = CONFIG.windBoostSizeMultiplier * baseSizeMultiplier;
    particle.ignoresBoxCollision = false;
  } else {
    particle.windBoostMultiplier = 1;
    particle.turbulenceBoostMultiplier = 1;
    particle.sizeMultiplier = baseSizeMultiplier;
  }
}

function syncBoostedParticleConfig(reseedBoosted = false) {
  for (let i = 0; i < particles.length; i++) {
    applyBoostedConfigToParticle(particles[i], reseedBoosted);
  }
}

function createParticle(x, y, ignoresBoxCollision = false) {
  const boosted = random() < CONFIG.windBoostParticleRatio;
  const randomSizeModifier = random(
    -Math.abs(CONFIG.particleSizeRandomNegative),
    Math.abs(CONFIG.particleSizeRandomPositive) + Number.EPSILON
  );
  const randomSizeMultiplier = max(0.05, 1 + randomSizeModifier);
  const windBoostMultiplier = boosted
    ? random(
      CONFIG.windBoostMinMultiplier,
      CONFIG.windBoostMaxMultiplier + Number.EPSILON
    )
    : 1;
  const turbulenceBoostMultiplier = boosted
    ? random(
      CONFIG.windBoostTurbulenceMinMultiplier,
      CONFIG.windBoostTurbulenceMaxMultiplier + Number.EPSILON
    )
    : 1;

  return {
    pos: createVector(x, y),
    vel: createVector(0, 0),
    prevX: x,
    prevY: y,
    displayX: x,
    displayY: y,
    ignoresBoxCollision: boosted ? false : ignoresBoxCollision,
    isBoosted: boosted,
    windBoostMultiplier,
    turbulenceBoostMultiplier,
    baseRandomSizeMultiplier: randomSizeMultiplier,
    sizeMultiplier: (boosted ? CONFIG.windBoostSizeMultiplier : 1) * randomSizeMultiplier,
    duneAlphaSignal: 0,
    interactedUntilMs: 0,
    interactionDirX: 0,
    interactionDirY: 0,
    interactionAnchorX: x,
    interactionAnchorY: y,
    interactionSpeed: 0,
    boidAccX: 0,
    boidAccY: 0,
    boxGlowIntensity: 0,
    boxGlowPeakIntensity: 0,
    boxGlowPeakMs: 0,
    scrollFrozen: false,
    scrollUnfrozeAtMs: 0,
    scrollFadeProgress: 0,
    scrollCollisionDisabled: false,
  };
}

function syncParticleDisplayState(particle, x = particle.pos.x, y = particle.pos.y) {
  particle.prevX = x;
  particle.prevY = y;
  particle.displayX = x;
  particle.displayY = y;
}

function getInterpolatedParticlePosition(particle) {
  _interpolatedPos.x = lerp(particle.prevX, particle.pos.x, simRenderAlpha);
  _interpolatedPos.y = lerp(particle.prevY, particle.pos.y, simRenderAlpha);
  return _interpolatedPos;
}

function getInterpolatedBoxPosition(box) {
  _interpolatedBoxPos.x = lerp(box.prevX, box.x, simRenderAlpha);
  _interpolatedBoxPos.y = lerp(box.prevY, box.y, simRenderAlpha);
  return _interpolatedBoxPos;
}

function clampRenderedSegment(fromX, fromY, toX, toY, maxLen = MAX_RENDER_SEGMENT_LENGTH_PX) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const lenSq = dx * dx + dy * dy;
  const maxLenSq = maxLen * maxLen;
  _segmentResult.fromX = fromX;
  _segmentResult.fromY = fromY;
  if (lenSq <= maxLenSq || lenSq <= 1e-9) {
    _segmentResult.toX = toX;
    _segmentResult.toY = toY;
  } else {
    const scale = maxLen / sqrt(lenSq);
    _segmentResult.toX = fromX + dx * scale;
    _segmentResult.toY = fromY + dy * scale;
  }
  return _segmentResult;
}

function updateBoxes(dtFrames = 1) {
  if (externalBoxSyncEnabled) {
    return;
  }

  const decay = pow(CONFIG.boxVelocityDecay, max(0, dtFrames));
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    box.prevX = box.x;
    box.prevY = box.y;
    if (i !== draggedBoxIndex) {
      box.vx *= decay;
      box.vy *= decay;
    }

    if (box.vx * box.vx + box.vy * box.vy < CONFIG.boxStationarySpeedThreshold * CONFIG.boxStationarySpeedThreshold) {
      box.vx = 0;
      box.vy = 0;
    }
  }
}

function updateActiveBoxes() {
  const minX = -BOX_ACTIVE_MARGIN;
  const minY = -BOX_ACTIVE_MARGIN;
  const maxX = width + BOX_ACTIVE_MARGIN;
  const maxY = height + BOX_ACTIVE_MARGIN;

  activeBoxes.length = 0;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (
      box.x + box.w < minX ||
      box.x > maxX ||
      box.y + box.h < minY ||
      box.y > maxY
    ) {
      continue;
    }
    activeBoxes.push(box);
  }

  rebuildActiveBoxSpatialGrid();
}

function getBoxSpatialCellSize() {
  return max(
    24,
    ceil(max(
      CONFIG.separationNearBoxRadius,
      CONFIG.boxForceMaxRadius,
      CONFIG.surfaceSlideBand * CONFIG.particleSize * 2
    ) * 2)
  );
}

function rebuildActiveBoxSpatialGrid() {
  boxSpatialGrid.clear();
  const cellSize = getBoxSpatialCellSize();
  const inverseCellSize = 1 / cellSize;
  const broadphasePad = max(
    CONFIG.separationNearBoxRadius,
    CONFIG.boxForceMaxRadius,
    CONFIG.surfaceSlideBand * CONFIG.particleSize
  );

  for (let i = 0; i < activeBoxes.length; i++) {
    const box = activeBoxes[i];
    const minCellX = floor((box.x - broadphasePad) * inverseCellSize);
    const maxCellX = floor((box.x + box.w + broadphasePad) * inverseCellSize);
    const minCellY = floor((box.y - broadphasePad) * inverseCellSize);
    const maxCellY = floor((box.y + box.h + broadphasePad) * inverseCellSize);

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const key = getCellKey(cx, cy);
        let bucket = boxSpatialGrid.get(key);
        if (!bucket) {
          bucket = [];
          boxSpatialGrid.set(key, bucket);
        }
        bucket.push(box);
      }
    }
  }
}

function getNearbyBoxesForPoint(px, py) {
  nearbyBoxesScratch.length = 0;
  if (activeBoxes.length === 0) {
    return nearbyBoxesScratch;
  }

  const cellSize = getBoxSpatialCellSize();
  const inverseCellSize = 1 / cellSize;
  const cx = floor(px * inverseCellSize);
  const cy = floor(py * inverseCellSize);
  nearbyBoxesQueryId += 1;

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const bucket = boxSpatialGrid.get(getCellKey(cx + ox, cy + oy));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const box = bucket[i];
        if (box._nearbyQueryId === nearbyBoxesQueryId) continue;
        box._nearbyQueryId = nearbyBoxesQueryId;
        nearbyBoxesScratch.push(box);
      }
    }
  }

  return nearbyBoxesScratch;
}

function updateParticles(nowMs = millis(), tickIndex = simStepCount, allowSeparation = true, dtFrames = 1) {
  const frameCache = buildFrameCache(nowMs);
  const useAmbient = CONFIG.enableAmbientMotion;
  const safeDtFrames = max(0, dtFrames);
  const damping = pow(CONFIG.damping, safeDtFrames);
  const boidEnabled = CONFIG.enableBoidFlocking;
  if (boidEnabled) {
    buildBoidGrid();
    applyBoidAccelerations();
  }
  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    if (particle.scrollFrozen) continue;
    particle.prevX = particle.pos.x;
    particle.prevY = particle.pos.y;
    let accX = 0;
    let accY = 0;

    if (useAmbient) {
      const ambient = sampleDuneWindForceXY(
        particle.pos.x,
        particle.pos.y,
        frameCache,
        particle.turbulenceBoostMultiplier
      );
      accX += ambient.x * particle.windBoostMultiplier;
      accY += ambient.y * particle.windBoostMultiplier;
      particle.duneAlphaSignal = ambient.duneSignal;
    } else {
      particle.duneAlphaSignal = 0;
    }

    if (boidEnabled && particle.isBoosted) {
      const wb = constrain(CONFIG.boidWindBlend, 0, 1);
      accX = accX * wb + particle.boidAccX * (1 - wb);
      accY = accY * wb + particle.boidAccY * (1 - wb);
    }

    const skipBoxCollision = particle.ignoresBoxCollision || particle.scrollCollisionDisabled || manualScrollActive;
    if (!skipBoxCollision) {
      const nearbyBoxes = getNearbyBoxesForPoint(particle.pos.x, particle.pos.y);
      for (let j = 0; j < nearbyBoxes.length; j++) {
        const boxForce = applyBoxInfluence(particle, nearbyBoxes[j], nowMs);
        accX += boxForce.x;
        accY += boxForce.y;
      }
    }

    particle.vel.x += accX * safeDtFrames;
    particle.vel.y += accY * safeDtFrames;
    particle.vel.x *= damping;
    particle.vel.y *= damping;
    const spdSq = particle.vel.x * particle.vel.x + particle.vel.y * particle.vel.y;
    const maxSpdSq = CONFIG.maxSpeed * CONFIG.maxSpeed;
    if (spdSq > maxSpdSq) {
      const scale = CONFIG.maxSpeed / sqrt(spdSq);
      particle.vel.x *= scale;
      particle.vel.y *= scale;
    }
    particle.pos.x += particle.vel.x * safeDtFrames;
    particle.pos.y += particle.vel.y * safeDtFrames;

    // Strict occupancy: particles are not allowed to remain inside boxes.
    if (!skipBoxCollision) {
      const nearbyBoxes = getNearbyBoxesForPoint(particle.pos.x, particle.pos.y);
      for (let j = 0; j < nearbyBoxes.length; j++) {
        resolveParticleBoxContainment(particle, nearbyBoxes[j]);
        resolveParticleSurfaceSlide(particle, nearbyBoxes[j]);
      }
      // Proximity stamping: only when box collision is active so that glow
      // peaks are earned by actually being near a box surface.
      if (CONFIG.enableBoxGlow && nearbyBoxes.length > 0) {
        const glowRad = CONFIG.boxGlowRadius;
        let minDist = glowRad;
        for (let j = 0; j < nearbyBoxes.length; j++) {
          const box = nearbyBoxes[j];
          const nearX = constrain(particle.pos.x, box.x, box.x + box.w);
          const nearY = constrain(particle.pos.y, box.y, box.y + box.h);
          const dx = particle.pos.x - nearX;
          const dy = particle.pos.y - nearY;
          const d = sqrt(dx * dx + dy * dy);
          if (d < minDist) minDist = d;
        }
        const proximityGlow = max(0, 1 - minDist / glowRad);
        if (proximityGlow > 0) {
          const elapsed = nowMs - particle.boxGlowPeakMs;
          const delay = CONFIG.boxGlowFadeDelayMs;
          const duration = CONFIG.boxGlowFadeDurationMs;
          let currentFade = 0;
          if (particle.boxGlowPeakMs > 0) {
            if (elapsed < delay) {
              currentFade = particle.boxGlowPeakIntensity;
            } else if (duration > 0 && elapsed < delay + duration) {
              currentFade = particle.boxGlowPeakIntensity * (1 - (elapsed - delay) / duration);
            }
          }
          if (proximityGlow > currentFade) {
            particle.boxGlowPeakIntensity = proximityGlow;
            particle.boxGlowPeakMs = nowMs;
          }
        }
      }
    }
    // Glow fade timer runs regardless of skipBoxCollision so that particles
    // retain their glow color during manual scroll (when box collision is
    // suspended). Without this, boxGlowIntensity would be zeroed every frame
    // during scroll, stripping the core color from particles near the text.
    if (CONFIG.enableBoxGlow && !particle.ignoresBoxCollision) {
      if (particle.boxGlowPeakMs > 0) {
        const elapsed = nowMs - particle.boxGlowPeakMs;
        const delay = CONFIG.boxGlowFadeDelayMs;
        const duration = CONFIG.boxGlowFadeDurationMs;
        if (elapsed < delay) {
          particle.boxGlowIntensity = particle.boxGlowPeakIntensity;
        } else if (duration > 0 && elapsed < delay + duration) {
          particle.boxGlowIntensity = particle.boxGlowPeakIntensity * (1 - (elapsed - delay) / duration);
        } else {
          particle.boxGlowIntensity = 0;
          particle.boxGlowPeakMs = 0;
        }
      } else {
        particle.boxGlowIntensity = 0;
      }
    } else {
      particle.boxGlowIntensity = 0;
    }

    resolveParticleBounds(particle, nowMs);
    settleParticleState(particle);
  }

  if (
    allowSeparation &&
    CONFIG.enableParticleSeparation &&
    tickIndex % getCurrentSeparationCadence() === 0
  ) {
    resolveParticleSeparation(nowMs, tickIndex);
    // Separation can nudge particles into colliders; clamp them back out immediately.
    enforceAllParticleBoxContainment();
  }
}

function updateAdaptiveSeparationCadence(nowMs) {
  const baseCadence = max(1, floor(getQualityValue('separationEveryNFrames')));
  if (!CONFIG.enableAdaptiveSeparationCadence) {
    dynamicSeparationEveryNFrames = baseCadence;
    lastDrawTimeMs = nowMs;
    lastSeparationCadenceAdjustMs = nowMs;
    return;
  }

  if (lastDrawTimeMs <= 0) {
    dynamicSeparationEveryNFrames = baseCadence;
    lastDrawTimeMs = nowMs;
    lastSeparationCadenceAdjustMs = nowMs;
    return;
  }

  lastDrawTimeMs = nowMs;
  const maxCadence = max(baseCadence, floor(CONFIG.adaptiveCadenceMax));

  if (nowMs - lastSeparationCadenceAdjustMs < 240) {
    return;
  }
  lastSeparationCadenceAdjustMs = nowMs;

  const target = max(1, CONFIG.adaptiveTargetFrameMs);
  const avgFrameMs = qualityState.avgFrameMs;
  const currentCadence = max(1, Math.round(dynamicSeparationEveryNFrames));
  let nextCadence = currentCadence;

  if (avgFrameMs > target * 1.1) {
    nextCadence = min(maxCadence, currentCadence + 1);
  } else if (avgFrameMs < target * 0.9) {
    nextCadence = max(baseCadence, currentCadence - 1);
  }
  dynamicSeparationEveryNFrames = nextCadence;
}

function getCurrentSeparationCadence() {
  if (!CONFIG.enableAdaptiveSeparationCadence) {
    return max(1, floor(getQualityValue('separationEveryNFrames')));
  }
  return max(1, floor(dynamicSeparationEveryNFrames));
}

function getCellKey(cx, cy) {
  return (cx + CELL_KEY_OFFSET) * CELL_KEY_STRIDE + (cy + CELL_KEY_OFFSET);
}

function resolveParticleSeparation(nowMs, tickIndex = simStepCount) {
  const cellSize = CONFIG.particleCollisionRadius * 2;
  if (cellSize <= 0) return;
  const invCellSize = 1 / cellSize;

  separationActiveIndices.length = 0;
  separationCellXs.length = 0;
  separationCellYs.length = 0;
  for (let i = 0; i < particles.length; i++) {
    if (isParticleSeparationActive(particles[i], nowMs)) {
      const p = particles[i].pos;
      separationActiveIndices.push(i);
      separationCellXs.push(floor(p.x * invCellSize));
      separationCellYs.push(floor(p.y * invCellSize));
    }
  }
  if (separationActiveIndices.length < 2) return;

  separationGrid.clear();
  for (let a = 0; a < separationActiveIndices.length; a++) {
    const i = separationActiveIndices[a];
    const key = getCellKey(separationCellXs[a], separationCellYs[a]);
    let bucket = separationGrid.get(key);
    if (!bucket) {
      bucket = [];
      separationGrid.set(key, bucket);
    }
    bucket.push(i);
  }

  const minDist = CONFIG.particleCollisionRadius * 2;
  const minDistSq = minDist * minDist;
  const velDamp = CONFIG.particleCollisionVelocityDamp;
  const maxPairs = max(1, floor(getQualityValue('maxSeparationPairsPerTick')));
  const maxCandidatesPerCell = max(1, floor(getQualityValue('maxSeparationCandidatesPerCell')));
  let solvedPairs = 0;
  let budgetReached = false;

  for (let ia = 0; ia < separationActiveIndices.length; ia++) {
    const i = separationActiveIndices[ia];
    const a = particles[i];
    const cx = separationCellXs[ia];
    const cy = separationCellYs[ia];

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const key = getCellKey(cx + ox, cy + oy);
        const bucket = separationGrid.get(key);
        if (!bucket) continue;
        const bucketLen = bucket.length;
        if (bucketLen === 0) continue;
        const scanCount = min(bucketLen, maxCandidatesPerCell);
        let k = 0;
        if (bucketLen > scanCount) {
          const hash =
            i * 1315423911 +
            (cx + ox) * 92821 +
            (cy + oy) * 68917 +
            tickIndex;
          k = ((hash % bucketLen) + bucketLen) % bucketLen;
        }

        for (let s = 0; s < scanCount; s++) {
          if (budgetReached) break;
          const j = bucket[k];
          k++;
          if (k >= bucketLen) k = 0;
          if (j <= i) continue;

          const b = particles[j];
          let dx = b.pos.x - a.pos.x;
          let dy = b.pos.y - a.pos.y;
          let distSq = dx * dx + dy * dy;
          if (distSq >= minDistSq) continue;

          if (distSq < 1e-12) {
            const randomAngle = random(TWO_PI);
            dx = cos(randomAngle) * 1e-3;
            dy = sin(randomAngle) * 1e-3;
            distSq = dx * dx + dy * dy;
          }

          const dist = sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          const correction = overlap * 0.5 * CONFIG.particleCollisionStrength;

          a.pos.x -= nx * correction;
          a.pos.y -= ny * correction;
          b.pos.x += nx * correction;
          b.pos.y += ny * correction;

          const relVx = b.vel.x - a.vel.x;
          const relVy = b.vel.y - a.vel.y;
          const closing = relVx * nx + relVy * ny;
          if (closing < 0) {
            const impulse = -closing * velDamp;
            a.vel.x -= nx * impulse;
            a.vel.y -= ny * impulse;
            b.vel.x += nx * impulse;
            b.vel.y += ny * impulse;
          }

          solvedPairs++;
          if (solvedPairs >= maxPairs) {
            budgetReached = true;
            break;
          }
        }
        if (budgetReached) break;
      }
      if (budgetReached) break;
    }
    if (budgetReached) break;
  }

  for (let a = 0; a < separationActiveIndices.length; a++) {
    resolveParticleBounds(particles[separationActiveIndices[a]], nowMs);
  }
}

function isParticleSeparationActive(particle, nowMs) {
  if (particle.scrollFrozen) return false;
  if (particle.ignoresBoxCollision) return false;
  if (isParticleRecentlyInteracted(particle, nowMs)) return true;
  const speedSq = particle.vel.x * particle.vel.x + particle.vel.y * particle.vel.y;
  if (speedSq > CONFIG.separationMinSpeed * CONFIG.separationMinSpeed) {
    return true;
  }

  const nearbyBoxes = getNearbyBoxesForPoint(particle.pos.x, particle.pos.y);
  for (let i = 0; i < nearbyBoxes.length; i++) {
    if (isNearBox(particle.pos.x, particle.pos.y, nearbyBoxes[i], CONFIG.separationNearBoxRadius)) {
      return true;
    }
  }
  return false;
}

function isNearBox(px, py, box, radius) {
  const nearX = constrain(px, box.x, box.x + box.w);
  const nearY = constrain(py, box.y, box.y + box.h);
  const dx = px - nearX;
  const dy = py - nearY;
  return dx * dx + dy * dy <= radius * radius;
}

// ── Boid flocking for boosted particles ──────────────────────────────

function buildBoidGrid() {
  boidGrid.clear();
  boidActiveIndices.length = 0;
  boidCellXs.length = 0;
  boidCellYs.length = 0;
  const cellSize = max(1, CONFIG.boidNeighborRadius);
  const inv = 1 / cellSize;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.isBoosted) continue;
    const cx = floor(p.pos.x * inv);
    const cy = floor(p.pos.y * inv);
    boidActiveIndices.push(i);
    boidCellXs.push(cx);
    boidCellYs.push(cy);
    const key = getCellKey(cx, cy);
    let bucket = boidGrid.get(key);
    if (!bucket) { bucket = []; boidGrid.set(key, bucket); }
    bucket.push(i);
  }
}

function computeBoidForces(particleIndex, boidIdx) {
  const a = particles[particleIndex];
  const neighborRadSq = CONFIG.boidNeighborRadius * CONFIG.boidNeighborRadius;
  const sepRadSq = CONFIG.boidSeparationRadius * CONFIG.boidSeparationRadius;
  const maxSteer = CONFIG.boidMaxSteerForce;
  const cx = boidCellXs[boidIdx];
  const cy = boidCellYs[boidIdx];

  let sepX = 0, sepY = 0, sepCount = 0;
  let alignVx = 0, alignVy = 0, alignCount = 0;
  let cohX = 0, cohY = 0, cohCount = 0;

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const bucket = boidGrid.get(getCellKey(cx + ox, cy + oy));
      if (!bucket) continue;
      for (let b = 0; b < bucket.length; b++) {
        const j = bucket[b];
        if (j === particleIndex) continue;
        const other = particles[j];
        const dx = other.pos.x - a.pos.x;
        const dy = other.pos.y - a.pos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq >= neighborRadSq || distSq < 1e-12) continue;

        // Alignment: accumulate neighbor velocities.
        alignVx += other.vel.x;
        alignVy += other.vel.y;
        alignCount++;

        // Cohesion: accumulate neighbor positions.
        cohX += other.pos.x;
        cohY += other.pos.y;
        cohCount++;

        // Separation: push away from very close neighbors.
        if (distSq < sepRadSq) {
          const dist = sqrt(distSq);
          const weight = 1 - dist / CONFIG.boidSeparationRadius;
          sepX -= (dx / dist) * weight;
          sepY -= (dy / dist) * weight;
          sepCount++;
        }
      }
    }
  }

  let steerX = 0, steerY = 0;

  // Separation.
  if (sepCount > 0) {
    let sx = sepX * CONFIG.boidSeparationStrength;
    let sy = sepY * CONFIG.boidSeparationStrength;
    const sMag = sx * sx + sy * sy;
    if (sMag > maxSteer * maxSteer) {
      const s = maxSteer / sqrt(sMag);
      sx *= s; sy *= s;
    }
    steerX += sx;
    steerY += sy;
  }

  // Alignment: steer toward average heading.
  if (alignCount > 0) {
    let ax = (alignVx / alignCount - a.vel.x) * CONFIG.boidAlignmentStrength;
    let ay = (alignVy / alignCount - a.vel.y) * CONFIG.boidAlignmentStrength;
    const aMag = ax * ax + ay * ay;
    if (aMag > maxSteer * maxSteer) {
      const s = maxSteer / sqrt(aMag);
      ax *= s; ay *= s;
    }
    steerX += ax;
    steerY += ay;
  }

  // Cohesion or dispersal based on group size.
  if (cohCount > 0) {
    const overcrowded = cohCount > CONFIG.boidMaxGroupSize;
    // Direction toward center of mass.
    let cx2 = cohX / cohCount - a.pos.x;
    let cy2 = cohY / cohCount - a.pos.y;
    if (overcrowded) {
      // Flip: steer away from the group center.
      cx2 *= -CONFIG.boidDispersalStrength;
      cy2 *= -CONFIG.boidDispersalStrength;
    } else {
      cx2 *= CONFIG.boidCohesionStrength;
      cy2 *= CONFIG.boidCohesionStrength;
    }
    const cMag = cx2 * cx2 + cy2 * cy2;
    if (cMag > maxSteer * maxSteer) {
      const s = maxSteer / sqrt(cMag);
      cx2 *= s; cy2 *= s;
    }
    steerX += cx2;
    steerY += cy2;
  }

  _boidSteer.x = steerX;
  _boidSteer.y = steerY;
  return _boidSteer;
}

function applyBoidAccelerations() {
  for (let b = 0; b < boidActiveIndices.length; b++) {
    const i = boidActiveIndices[b];
    const force = computeBoidForces(i, b);
    particles[i].boidAccX = force.x;
    particles[i].boidAccY = force.y;
  }
}

// ── End boid flocking ────────────────────────────────────────────────

function buildFrameCache(nowMs) {
  const windAngle = radians(CONFIG.ambientWindDirectionDeg);
  const windDirX = cos(windAngle);
  const windDirY = sin(windAngle);
  const duneBandAngle = radians(CONFIG.duneBandRotationDeg);
  const duneDirX = cos(duneBandAngle);
  const duneDirY = sin(duneBandAngle);
  const fc = _frameCacheScratch;
  fc.nowMs = nowMs;
  fc.windDirX = windDirX;
  fc.windDirY = windDirY;
  fc.windPerpX = -windDirY;
  fc.windPerpY = windDirX;
  fc.duneDirX = duneDirX;
  fc.duneDirY = duneDirY;
  fc.dunePerpX = -duneDirY;
  fc.dunePerpY = duneDirX;
  fc.duneBandOffsetPx = CONFIG.duneBandOffsetPx;
  fc.driftPixels = nowMs * 0.001 * CONFIG.duneDriftSpeed * 240;
  return fc;
}

function sampleDuneWindForceXY(px, py, frameCache, turbulenceMultiplier = 1) {
  const sampleX = px - frameCache.windDirX * frameCache.driftPixels;
  const sampleY = py - frameCache.windDirY * frameCache.driftPixels;
  const along = sampleX * frameCache.duneDirX + sampleY * frameCache.duneDirY;
  const across =
    sampleX * frameCache.dunePerpX +
    sampleY * frameCache.dunePerpY +
    frameCache.duneBandOffsetPx;

  const warpedAcross =
    across / CONFIG.duneBandScale +
    sin(along / CONFIG.duneAlongWarpScale) * CONFIG.duneWarpStrength;
  const ridge01 = (sin(warpedAcross) + 1) * 0.5;
  const duneMultiplier = CONFIG.enableDuneBands
    ? 0.25 + 0.95 * pow(ridge01, CONFIG.duneContrast)
    : 1;
  const windAmp = CONFIG.ambientWindStrength * duneMultiplier;

  const n = noise(
    sampleX / CONFIG.microNoiseScale,
    sampleY / CONFIG.microNoiseScale
  ) * 2 - 1;
  const microAmp = n * CONFIG.microTurbulenceStrength * turbulenceMultiplier;

  _duneWindResult.x = frameCache.windDirX * windAmp + frameCache.windPerpX * microAmp;
  _duneWindResult.y = frameCache.windDirY * windAmp + frameCache.windPerpY * microAmp;
  _duneWindResult.duneSignal = constrain((duneMultiplier - 0.25) / 0.95, 0, 1);
  return _duneWindResult;
}

function sampleDuneMultiplierAt(x, y, nowMs) {
  if (!CONFIG.enableAmbientMotion) return 1;

  const windAngle = radians(CONFIG.ambientWindDirectionDeg);
  const dirX = cos(windAngle);
  const dirY = sin(windAngle);
  const duneBandAngle = radians(CONFIG.duneBandRotationDeg);
  const duneDirX = cos(duneBandAngle);
  const duneDirY = sin(duneBandAngle);
  const dunePerpX = -duneDirY;
  const dunePerpY = duneDirX;

  const t = nowMs * 0.001;
  const driftPixels = t * CONFIG.duneDriftSpeed * 240;
  const sampleX = x - dirX * driftPixels;
  const sampleY = y - dirY * driftPixels;
  const along = sampleX * duneDirX + sampleY * duneDirY;
  const across = sampleX * dunePerpX + sampleY * dunePerpY + CONFIG.duneBandOffsetPx;

  const warpedAcross =
    across / CONFIG.duneBandScale +
    sin(along / CONFIG.duneAlongWarpScale) * CONFIG.duneWarpStrength;
  const ridgeWave = sin(warpedAcross);
  const ridge01 = (ridgeWave + 1) * 0.5;
  if (!CONFIG.enableDuneBands) {
    return 1;
  }

  return 0.25 + 0.95 * pow(ridge01, CONFIG.duneContrast);
}

const _respawnWeights = new Float64Array(24);

function pickWeightedRespawnCoordinate(isVerticalEdge, fixedCoord, minCoord, maxCoord, nowMs) {
  const bins = 24;
  const span = maxCoord - minCoord;
  if (span <= 0) return minCoord;

  const weights = _respawnWeights;
  let totalWeight = 0;

  for (let i = 0; i < bins; i++) {
    const t = (i + 0.5) / bins;
    const varyingCoord = minCoord + t * span;
    const x = isVerticalEdge ? fixedCoord : varyingCoord;
    const y = isVerticalEdge ? varyingCoord : fixedCoord;
    const dune = sampleDuneMultiplierAt(x, y, nowMs);
    const w =
      CONFIG.edgeRespawnWeightBase +
      CONFIG.edgeRespawnWeightStrength *
        pow(dune, CONFIG.edgeRespawnWeightExponent);
    weights[i] = w;
    totalWeight += w;
  }

  if (totalWeight <= 0) return random(minCoord, maxCoord);

  let r = random(totalWeight);
  let selected = bins - 1;
  for (let i = 0; i < bins; i++) {
    r -= weights[i];
    if (r <= 0) {
      selected = i;
      break;
    }
  }

  const binMin = minCoord + (selected / bins) * span;
  const binMax = minCoord + ((selected + 1) / bins) * span;
  return random(binMin, binMax);
}

function applyBoxInfluence(particle, box, nowMs) {
  const boxVelX = box.vx;
  const boxVelY = box.vy;
  const boxSpeed = sqrt(boxVelX * boxVelX + boxVelY * boxVelY);
  if (boxSpeed < CONFIG.boxStationarySpeedThreshold) {
    _boxInfluenceResult.x = 0; _boxInfluenceResult.y = 0; return _boxInfluenceResult;
  }
  const boxDirX = boxVelX / boxSpeed;
  const boxDirY = boxVelY / boxSpeed;

  const isInside = isParticleInsideBox(particle.pos.x, particle.pos.y, box);
  if (!isInside) {
    const nearX = constrain(particle.pos.x, box.x, box.x + box.w);
    const nearY = constrain(particle.pos.y, box.y, box.y + box.h);
    const toParticleX = particle.pos.x - nearX;
    const toParticleY = particle.pos.y - nearY;
    const dist = sqrt(toParticleX * toParticleX + toParticleY * toParticleY);
    let boundaryForceX = 0;
    let boundaryForceY = 0;

    const influenceRadius = max(
      1,
      min(CONFIG.separationNearBoxRadius, CONFIG.boxForceMaxRadius)
    );
    if (dist <= influenceRadius) {
      let radialX = 0;
      let radialY = 0;
      if (dist > 0.0001) {
        radialX = toParticleX / dist;
        radialY = toParticleY / dist;
      } else {
        const a = random(TWO_PI);
        radialX = cos(a);
        radialY = sin(a);
      }
      const falloff = 1 - constrain(dist / influenceRadius, 0, 1);
      const tangentX = -radialY;
      const tangentY = radialX;
      const dotMove = radialX * boxDirX + radialY * boxDirY;
      const backsideAmount = max(0, -dotMove);

      // Forward-side only influence to avoid side/back "suction" artifacts.
      const directionalness = max(0, dotMove - CONFIG.staticInfluenceForwardDotMin);

      if (directionalness > 0) {
        // Align spin with box motion so wake rolls behind, not against movement.
        const spinSign = boxDirX >= 0 ? 1 : -1;
        const turbulenceScale =
          CONFIG.turbulenceStrength * boxSpeed * falloff * directionalness * spinSign;
        const wakeScale = CONFIG.wakeDragStrength * boxSpeed * falloff * directionalness;
        boundaryForceX = tangentX * turbulenceScale + boxDirX * wakeScale;
        boundaryForceY = tangentY * turbulenceScale + boxDirY * wakeScale;
      }

      if (backsideAmount > 0) {
        const dragAmt =
          CONFIG.backsideDragStrength * falloff * backsideAmount;
        const damp = max(0, 1 - dragAmt);
        particle.vel.x *= damp;
        particle.vel.y *= damp;
      }
    }

    const wakeSwirl = computeWakeSwirlForce(particle, box, boxSpeed, nowMs);
    // Read wake values before writing to _boxInfluenceResult (wake uses its own scratch)
    _boxInfluenceResult.x = boundaryForceX + wakeSwirl.x;
    _boxInfluenceResult.y = boundaryForceY + wakeSwirl.y;
    return _boxInfluenceResult;
  }
  // Inside particles are handled only by containment projection (no force push).
  _boxInfluenceResult.x = 0; _boxInfluenceResult.y = 0; return _boxInfluenceResult;
}

function computeWakeSwirlForce(particle, box, boxSpeed, nowMs) {
  if (!isParticleRecentlyInteracted(particle, nowMs)) {
    _wakeSwirlResult.x = 0; _wakeSwirlResult.y = 0; return _wakeSwirlResult;
  }

  let wakeDirX = particle.interactionDirX;
  let wakeDirY = particle.interactionDirY;
  const wakeDirMag = sqrt(wakeDirX * wakeDirX + wakeDirY * wakeDirY);
  if (wakeDirMag < 0.0001) {
    _wakeSwirlResult.x = 0; _wakeSwirlResult.y = 0; return _wakeSwirlResult;
  }
  wakeDirX /= wakeDirMag;
  wakeDirY /= wakeDirMag;

  const speedScale = max(particle.interactionSpeed, boxSpeed * 0.2);
  const relX = particle.pos.x - particle.interactionAnchorX;
  const relY = particle.pos.y - particle.interactionAnchorY;
  const along = -(relX * wakeDirX + relY * wakeDirY); // positive behind stored interaction direction
  const halfExtentAlong =
    abs(wakeDirX) * box.w * 0.5 + abs(wakeDirY) * box.h * 0.5;
  const behindTrailingFace = along - halfExtentAlong;
  if (behindTrailingFace <= 0 || behindTrailingFace > CONFIG.wakeSwirlLength) {
    _wakeSwirlResult.x = 0; _wakeSwirlResult.y = 0; return _wakeSwirlResult;
  }

  const perpX = -wakeDirY;
  const perpY = wakeDirX;
  const lateral = relX * perpX + relY * perpY;
  const absLateral = abs(lateral);
  if (absLateral > CONFIG.wakeSwirlWidth) {
    _wakeSwirlResult.x = 0; _wakeSwirlResult.y = 0; return _wakeSwirlResult;
  }

  const alongFalloff = 1 - behindTrailingFace / CONFIG.wakeSwirlLength;
  const lateralFalloff = 1 - absLateral / CONFIG.wakeSwirlWidth;
  const envelope = max(0, alongFalloff * lateralFalloff);
  if (envelope <= 0) {
    _wakeSwirlResult.x = 0; _wakeSwirlResult.y = 0; return _wakeSwirlResult;
  }

  const phase = behindTrailingFace * CONFIG.wakeSwirlFrequency;
  const swirlSign = sin(phase);
  const swirlScale = CONFIG.wakeSwirlStrength * speedScale * envelope * swirlSign;
  const advectionScale = CONFIG.wakeDragStrength * 0.7 * speedScale * envelope;
  _wakeSwirlResult.x = perpX * swirlScale + wakeDirX * advectionScale;
  _wakeSwirlResult.y = perpY * swirlScale + wakeDirY * advectionScale;
  return _wakeSwirlResult;
}

function resolveParticleBoxContainment(particle, box) {
  const pad = CONFIG.collisionEjectPadding;

  // Push out by nearest face, then re-test once for safety.
  for (let pass = 0; pass < 2; pass++) {
    if (!isParticleInsideBox(particle.pos.x, particle.pos.y, box)) return;

    const px = particle.pos.x;
    const py = particle.pos.y;
    const leftDist = px - box.x;
    const rightDist = box.x + box.w - px;
    const topDist = py - box.y;
    const bottomDist = box.y + box.h - py;

    let minDist = leftDist;
    let nx = -1;
    let ny = 0;
    if (rightDist < minDist) {
      minDist = rightDist;
      nx = 1;
      ny = 0;
    }
    if (topDist < minDist) {
      minDist = topDist;
      nx = 0;
      ny = -1;
    }
    if (bottomDist < minDist) {
      nx = 0;
      ny = 1;
    }

    if (nx !== 0) {
      particle.pos.x = nx < 0 ? box.x - pad : box.x + box.w + pad;
    } else {
      particle.pos.y = ny < 0 ? box.y - pad : box.y + box.h + pad;
    }
  }
}

function enforceAllParticleBoxContainment() {
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].scrollFrozen) continue;
    if (particles[i].ignoresBoxCollision || particles[i].scrollCollisionDisabled) continue;
    const nearbyBoxes = getNearbyBoxesForPoint(particles[i].pos.x, particles[i].pos.y);
    for (let j = 0; j < nearbyBoxes.length; j++) {
      resolveParticleBoxContainment(particles[i], nearbyBoxes[j]);
      resolveParticleSurfaceSlide(particles[i], nearbyBoxes[j]);
    }
  }
}

function resolveParticleSurfaceSlide(particle, box) {
  const nearX = constrain(particle.pos.x, box.x, box.x + box.w);
  const nearY = constrain(particle.pos.y, box.y, box.y + box.h);
  const dx = particle.pos.x - nearX;
  const dy = particle.pos.y - nearY;
  const distSq = dx * dx + dy * dy;
  const band = max(0.1, CONFIG.surfaceSlideBand * CONFIG.particleSize);
  if (distSq === 0 || distSq > band * band) return;

  const dist = sqrt(distSq);
  const nx = dx / dist;
  const ny = dy / dist;

  // Remove only inward velocity component so particles slide along faces.
  const vn = particle.vel.x * nx + particle.vel.y * ny;
  if (vn < 0) {
    const remove = vn * CONFIG.surfaceInwardDamp;
    particle.vel.x -= remove * nx;
    particle.vel.y -= remove * ny;
  }

  // Keep a tiny clearance outside the face.
  const targetDist = band * 0.5;
  if (dist < targetDist) {
    const push = targetDist - dist;
    const correction = min(push * CONFIG.surfacePosRelaxation, CONFIG.surfaceMaxCorrection);
    particle.pos.x += nx * correction;
    particle.pos.y += ny * correction;
  }
}

function settleParticleState(particle) {
  // Snap tiny residual velocity to exact zero, then clear interaction state.
  if (particle.vel.x * particle.vel.x + particle.vel.y * particle.vel.y < 1e-4) {
    particle.vel.x = 0;
    particle.vel.y = 0;
    particle.interactedUntilMs = 0;
  }
}

function markParticleInteracted(particle, nowMs, box) {
  particle.interactedUntilMs = nowMs + CONFIG.recentInteractionMs;
  const boxVx = box.vx;
  const boxVy = box.vy;
  const boxSpeed = sqrt(boxVx * boxVx + boxVy * boxVy);

  if (boxSpeed > 0.0001) {
    particle.interactionDirX = boxVx / boxSpeed;
    particle.interactionDirY = boxVy / boxSpeed;
    particle.interactionSpeed = boxSpeed;
  } else if (particle.vel.magSq() > 0.0001) {
    const speed = sqrt(particle.vel.x * particle.vel.x + particle.vel.y * particle.vel.y);
    if (speed > 0.0001) {
      particle.interactionDirX = particle.vel.x / speed;
      particle.interactionDirY = particle.vel.y / speed;
      particle.interactionSpeed = speed;
    }
  }

  particle.interactionAnchorX = box.x + box.w * 0.5;
  particle.interactionAnchorY = box.y + box.h * 0.5;
}

function isParticleRecentlyInteracted(particle, nowMs) {
  return nowMs <= particle.interactedUntilMs;
}

function pointInBox(px, py, box) {
  return (
    px >= box.x &&
    px <= box.x + box.w &&
    py >= box.y &&
    py <= box.y + box.h
  );
}

function isParticleInsideBox(px, py, box) {
  const eps = 1e-4;
  return (
    px > box.x + eps &&
    px < box.x + box.w - eps &&
    py > box.y + eps &&
    py < box.y + box.h - eps
  );
}

function resolveParticleBounds(particle, nowMs = millis()) {
  const p = particle.pos;
  const minX = CONFIG.edgePadding;
  const maxX = width - CONFIG.edgePadding;
  const minY = CONFIG.edgePadding;
  const maxY = height - CONFIG.edgePadding;
  const useWeightedEdgeRespawn = CONFIG.useWeightedEdgeRespawn;
  const weightedMixChance = useWeightedEdgeRespawn
    ? 1
    : constrain(CONFIG.edgeRespawnWeightedMixPercent, 0, 100) / 100;
  let wrapped = false;

  if (p.x < minX) {
    p.x = maxX;
    wrapped = true;
    if (random() < weightedMixChance) {
      p.y = pickWeightedRespawnCoordinate(true, p.x, minY, maxY, nowMs);
    }
    resetParticleInteractionState(particle);
  } else if (p.x > maxX) {
    p.x = minX;
    wrapped = true;
    if (random() < weightedMixChance) {
      p.y = pickWeightedRespawnCoordinate(true, p.x, minY, maxY, nowMs);
    }
    resetParticleInteractionState(particle);
  }

  if (p.y < minY) {
    p.y = maxY;
    wrapped = true;
    if (random() < weightedMixChance) {
      p.x = pickWeightedRespawnCoordinate(false, p.y, minX, maxX, nowMs);
    }
    resetParticleInteractionState(particle);
  } else if (p.y > maxY) {
    p.y = minY;
    wrapped = true;
    if (random() < weightedMixChance) {
      p.x = pickWeightedRespawnCoordinate(false, p.y, minX, maxX, nowMs);
    }
    resetParticleInteractionState(particle);
  }

  if (wrapped) {
    syncParticleDisplayState(particle, p.x, p.y);
    particle.scrollCollisionDisabled = false;
  }
}

function resetParticleInteractionState(particle) {
  particle.interactedUntilMs = 0;
  particle.interactionDirX = 0;
  particle.interactionDirY = 0;
  particle.interactionSpeed = 0;
}

function renderParticles(dtFrames = 1) {
  const baseR = RENDER_COLORS.particles[0];
  const baseG = RENDER_COLORS.particles[1];
  const baseB = RENDER_COLORS.particles[2];
  const baseA = getCurrentParticleAlpha();
  const minSpeed = max(0, getQualityValue('particleRenderMinSpeed'));
  const minSpeedRamp = max(0.02, minSpeed * 0.7);
  const alphaBoost = max(0, CONFIG.particleSpeedAlphaBoost);
  const duneAlphaBoost = max(0, CONFIG.particleDuneAlphaBoost);
  const duneSizeBoost = max(0, CONFIG.particleDuneSizeBoost);
  const widthBoost = max(0, CONFIG.particleSpeedWidthBoost);
  const renderFraction = constrain(getQualityValue('particleRenderFraction'), 0.01, 1);
  const tailAlphaWeight = renderFraction;
  const tailWidthWeight = max(0.2, sqrt(renderFraction));
  const particleCount = particles.length;
  // Scale segment clamp with dt so longer frames don't truncate trails.
  const maxSegLen = MAX_RENDER_SEGMENT_LENGTH_PX * max(1, dtFrames);
  // Pre-compute boosted color once (not per boosted particle).
  const boostedColor = { r: RENDER_COLORS.windBoostColor[0], g: RENDER_COLORS.windBoostColor[1], b: RENDER_COLORS.windBoostColor[2] };
  const fadeInMs = max(0, CONFIG.scrollFreezeFadeInMs);
  const renderNowMs = millis();
  const glowEnabled = CONFIG.enableBoxGlow;
  const glowHaloSize = CONFIG.boxGlowHaloSize;
  const glowHaloAlpha = CONFIG.boxGlowHaloAlpha;
  const glowCoreBlend = constrain(CONFIG.boxGlowCoreWhite, 0, 1);
  const glowUseOklch = CONFIG.glowBlendOklch;
  const glowChromaFloor = max(0, CONFIG.glowBlendChromaFloor);
  const glowHueShift = CONFIG.glowBlendHueShift * (Math.PI / 180);
  const glowCoreDiameter = max(0.5, CONFIG.boxGlowCoreDiameter);
  const glowCoreR = RENDER_COLORS.boxGlowCore[0];
  const glowCoreG = RENDER_COLORS.boxGlowCore[1];
  const glowCoreB = RENDER_COLORS.boxGlowCore[2];
  const glowCoreA = RENDER_COLORS.boxGlowCore.length > 3 ? RENDER_COLORS.boxGlowCore[3] : 255;
  // Pre-convert particle and glow core colors to OkLCh for perceptually uniform blending.
  const baseOklch = srgbToOklch(baseR, baseG, baseB);
  const boostedOklch = srgbToOklch(boostedColor.r, boostedColor.g, boostedColor.b);
  const glowCoreOklch = srgbToOklch(glowCoreR, glowCoreG, glowCoreB);
  // Track previous stroke state to skip redundant canvas state changes.
  let prevStrokeR = -1;
  let prevStrokeG = -1;
  let prevStrokeB = -1;
  let prevStrokeA = -1;
  let prevWeight = -1;
  const renderParticleAt = (p, i) => {
    const speed = sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
    // Read interpolated position into locals before the scratch object is reused.
    getInterpolatedParticlePosition(p);
    const interpX = _interpolatedPos.x;
    const interpY = _interpolatedPos.y;
    // Compute scroll fade-in factor (0..1). Only applies to particles
    // that were frozen during manual scroll (scrollUnfrozeAtMs !== 0).
    // -1 means "start timing on this render frame".
    let scrollFadeFactor = 1;
    if (fadeInMs > 0 && p.scrollUnfrozeAtMs !== 0) {
      if (p.scrollUnfrozeAtMs < 0) {
        p.scrollUnfrozeAtMs = renderNowMs;
        if (i === debugFadeParticleIndex) {
          console.log(`[scroll-fade] fade START for particle ${i}, fadeInMs=${fadeInMs}, renderNowMs=${renderNowMs}`);
        }
      }
      const elapsed = renderNowMs - p.scrollUnfrozeAtMs;
      if (elapsed >= fadeInMs) {
        p.scrollUnfrozeAtMs = 0;
        if (i === debugFadeParticleIndex) {
          console.log(`[scroll-fade] fade COMPLETE for particle ${i}`);
        }
      } else {
        scrollFadeFactor = elapsed / fadeInMs;
        if (i === debugFadeParticleIndex && Math.floor(elapsed / 500) !== Math.floor((elapsed - 16) / 500)) {
          console.log(`[scroll-fade] particle ${i}: sff=${scrollFadeFactor.toFixed(3)}, elapsed=${Math.round(elapsed)}ms / ${fadeInMs}ms`);
        }
      }
    }
    const isFadingIn = scrollFadeFactor < 1;
    // Skip particles below the speed threshold, unless they are fading in.
    if (speed < minSpeed && !isFadingIn) {
      p.displayX = interpX;
      p.displayY = interpY;
      return;
    }
    const minSpeedAlphaRamp = constrain((speed - minSpeed) / minSpeedRamp, 0, 1);
    const t = particleCount > 1 ? i / (particleCount - 1) : 0;
    const renderAlphaWeight = lerp(1, tailAlphaWeight, t);
    const renderWidthWeight = lerp(1, tailWidthWeight, t);
    const colorR = p.isBoosted ? boostedColor.r : baseR;
    const colorG = p.isBoosted ? boostedColor.g : baseG;
    const colorB = p.isBoosted ? boostedColor.b : baseB;
    const speedFactor = 1 + speed;
    const duneSignal = constrain(p.duneAlphaSignal || 0, 0, 1);
    const duneAlphaFactor = 1 + duneAlphaBoost * duneSignal;
    const duneSizeFactor = 1 + duneSizeBoost * duneSignal;
    const fastAlphaAdd = p.isBoosted ? max(0, CONFIG.windBoostAlphaMultiplier) : 0;
    // Compute the normal alpha, then multiply by scroll fade factor.
    const normalAlpha = baseA * renderAlphaWeight * minSpeedAlphaRamp * (1 + alphaBoost * (speedFactor - 1)) * duneAlphaFactor + fastAlphaAdd;
    const alpha = Math.round(constrain(normalAlpha * scrollFadeFactor, 0, 255));
    // Quantize weight to nearest 0.25px to reduce unique state transitions.
    const weight = Math.max(
      0.5,
      Math.round(
        CONFIG.particleSize *
        p.sizeMultiplier *
        renderWidthWeight *
        (1 + widthBoost * (speedFactor - 1)) *
        duneSizeFactor * 4
      ) * 0.25
    );
    const segment = clampRenderedSegment(
      p.displayX,
      p.displayY,
      interpX,
      interpY,
      maxSegLen
    );
    const glow = glowEnabled ? p.boxGlowIntensity : 0;
    if (glow > 0 && !isFadingIn) {
      // Halo pass: wider stroke, base color, low alpha scaled by intensity.
      const haloA = Math.round(glowHaloAlpha * glow);
      const haloW = Math.max(0.5, weight * glowHaloSize);
      stroke(colorR, colorG, colorB, haloA);
      strokeWeight(haloW);
      line(segment.fromX, segment.fromY, segment.toX, segment.toY);
      // Core pass: lerp toward core color.
      const blend = glow * glowCoreBlend;
      let coreR, coreG, coreB;
      if (glowUseOklch) {
        const src = p.isBoosted ? boostedOklch : baseOklch;
        const dst = glowCoreOklch;
        let dh = (dst.h + glowHueShift) - src.h;
        if (dh > Math.PI)  dh -= 2 * Math.PI;
        if (dh < -Math.PI) dh += 2 * Math.PI;
        const blendedRgb = oklchToSrgb(
          src.L + (dst.L - src.L) * blend,
          Math.max(glowChromaFloor * Math.sin(blend * Math.PI), src.C + (dst.C - src.C) * blend),
          src.h + dh * blend,
        );
        coreR = blendedRgb.r;
        coreG = blendedRgb.g;
        coreB = blendedRgb.b;
      } else {
        coreR = Math.round(colorR + (glowCoreR - colorR) * blend);
        coreG = Math.round(colorG + (glowCoreG - colorG) * blend);
        coreB = Math.round(colorB + (glowCoreB - colorB) * blend);
      }
      const coreA = Math.round(constrain((normalAlpha + (glowCoreA - normalAlpha) * blend), 0, 255));
      const coreW = weight + (glowCoreDiameter - weight) * glow;
      stroke(coreR, coreG, coreB, coreA);
      strokeWeight(coreW);
      line(segment.fromX, segment.fromY, segment.toX, segment.toY);
      // Invalidate tracking since glow changed state unpredictably.
      prevStrokeR = coreR; prevStrokeG = coreG; prevStrokeB = coreB; prevStrokeA = coreA;
      prevWeight = coreW;
    } else {
      // Normal non-glow path with redundancy elimination.
      if (colorR !== prevStrokeR || colorG !== prevStrokeG || colorB !== prevStrokeB || alpha !== prevStrokeA) {
        stroke(colorR, colorG, colorB, alpha);
        prevStrokeR = colorR;
        prevStrokeG = colorG;
        prevStrokeB = colorB;
        prevStrokeA = alpha;
      }
      if (weight !== prevWeight) {
        strokeWeight(weight);
        prevWeight = weight;
      }
      line(segment.fromX, segment.fromY, segment.toX, segment.toY);
    }
    p.displayX = segment.toX;
    p.displayY = segment.toY;
  };
  noFill();
  strokeCap(ROUND);
  for (let i = 0; i < particleCount; i++) {
    const p = particles[i];
    if (p.isBoosted || p.scrollFrozen) continue;
    renderParticleAt(p, i);
  }
  // Reset tracking before the boosted pass (different base color).
  prevStrokeR = -1; prevStrokeG = -1; prevStrokeB = -1; prevStrokeA = -1; prevWeight = -1;
  for (let i = 0; i < particleCount; i++) {
    const p = particles[i];
    if (!p.isBoosted || p.scrollFrozen) continue;
    renderParticleAt(p, i);
  }
  noStroke();
}

function renderBoxes() {
  if (!CONFIG.showBoxes) {
    sourceFlowBoxes = [];
    syncFlowBoxOverlay();
    return;
  }
  syncFlowBoxOverlay();

  for (let i = 0; i < activeBoxes.length; i++) {
    const box = activeBoxes[i];
    const displayBox = getInterpolatedBoxPosition(box);

    if (CONFIG.enableParticleSeparation && CONFIG.showSeparationZone) {
      const r = CONFIG.separationNearBoxRadius;
      noStroke();
      fill(...RENDER_COLORS.separationZone, CONFIG.separationZoneAlpha);
      rect(displayBox.x - r, displayBox.y - r, box.w + r * 2, box.h + r * 2, 6);
    }
  }
}

function mousePressed() {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i];
    if (pointInBox(mouseX, mouseY, box)) {
      draggedBoxIndex = i;
      dragOffsetX = mouseX - box.x;
      dragOffsetY = mouseY - box.y;
      return;
    }
  }
}

function mouseDragged() {
  if (draggedBoxIndex < 0) return;

  const box = boxes[draggedBoxIndex];
  const targetX = constrain(mouseX - dragOffsetX, 0, width - box.w);
  const targetY = constrain(mouseY - dragOffsetY, 0, height - box.h);

  const nextVx = targetX - box.x;
  const nextVy = targetY - box.y;

  box.vx = lerp(box.vx, nextVx, 0.8);
  box.vy = lerp(box.vy, nextVy, 0.8);

  box.x = targetX;
  box.y = targetY;
}

function mouseReleased() {
  if (draggedBoxIndex >= 0) {
    boxes[draggedBoxIndex].vx = 0;
    boxes[draggedBoxIndex].vy = 0;
  }
  draggedBoxIndex = -1;
}
