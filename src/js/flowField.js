// https://www.openprocessing.org/sketch/157576

const CONFIG = {
  particleCount: 5000,
  enableAutoRenderScale: true,
  autoRenderScaleThresholdPx: 1080,
  particleSize: 0.25,
  particleSizeRandomNegative: 0,
  particleSizeRandomPositive: 0,
  boxCollisionParticipantRatio: 0.2,
  particleRenderMinSpeed: 0,
  particleSpeedAlphaBoost: 4.28,
  particleDuneAlphaBoost: 0,
  particleDuneSizeBoost: 0,
  particleSpeedWidthBoost: 1.3,
  particleRenderFraction: 1,
  useWaveRenderer: true,
  waveLineCount: 34,
  waveAmplitude: 18,
  wavePointStep: 18,
  waveStrokeWeight: 1.15,
  waveFieldInfluence: 120,
  waveDriftMultiplier: 1,
  waveDuneAlphaBoost: 1.25,
  waveBoxGap: 8,
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
  windBoostAlphaMultiplier: 1,
  windBoostLightnessShift: 0,
  windBoostMinMultiplier: 5,
  windBoostMaxMultiplier: 10,
  windBoostTurbulenceMinMultiplier: 4,
  windBoostTurbulenceMaxMultiplier: 8,
  edgeRespawnWeightBase: 0.05,
  edgeRespawnWeightStrength: 0.45,
  edgeRespawnWeightExponent: 2,
  useWeightedEdgeRespawn: false,
  edgeRespawnWeightedMixPercent: 22,
  enableParticleSeparation: true,
  particleCollisionRadius: 0.95,
  particleCollisionStrength: 0.64,
  particleCollisionVelocityDamp: 0.22,
  separationEveryNFrames: 4,
  maxSeparationPairsPerTick: 70000,
  maxSeparationCandidatesPerCell: 24,
  enableAdaptiveSeparationCadence: false,
  adaptiveTargetFrameMs: 16.7,
  adaptiveCadenceMax: 8,
  adaptiveCadenceRecovery: 0.25,
  separationNearBoxRadius: 20,
  separationMinSpeed: 1,
  staticParticleSpeedThreshold: 0.08,
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
  backgroundFadeOscillationPeriodSec: 27.9,
  particleAlphaSecondary: 67,
  insidePushStrength: 0.7,
  collisionEjectPadding: 0.02,
  collisionOutVelocity: 0.18,
  minTurbulenceBoxSpeed: 0.08,
  boxVelocityTransfer: 0.65,
  boundaryBand: 14,
  turbulenceStrength: 0.5,
  wakeDragStrength: 0.5,
  wakeSwirlLength: 350,
  wakeSwirlWidth: 95,
  wakeSwirlStrength: 10,
  wakeSwirlFrequency: 0.06,
  recentInteractionMs: 3000,
  edgePadding: 0,
  edgeRestitution: 0.35,
  boxVelocityDecay: 0.86,
  boxStationarySpeedThreshold: 0.12,
  showBoxes: true,
  showDebug: false,
  enableAdaptiveQuality: true,
  lockQualityTier: true,
  qualityTargetFps: 30,
  qualityDecisionWindowMs: 1200,
  qualityCooldownMs: 900,
  qualityTransitionMs: 700,
  qualityHudEnabled: true,
  pauseSimulation: false,
};

const MAX_EFFECTIVE_DT_FRAMES = 1.75;
const MAX_RENDER_SEGMENT_LENGTH_PX = 12;

const RENDER_COLORS = {
  fade: [0, 0, 0],
  particles: [255, 137, 0, 18],
  separationZone: [130, 175, 235],
  boxStrokeIdle: [200, 200, 180, 0],
  boxStrokeDragged: [250, 230, 190, 0],
};

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
  { key: 'useWaveRenderer', type: 'bool' },
  { key: 'waveLineCount', type: 'number', digits: 0 },
  { key: 'waveAmplitude', type: 'number', digits: 1 },
  { key: 'wavePointStep', type: 'number', digits: 0 },
  { key: 'waveStrokeWeight', type: 'number', digits: 2 },
  { key: 'waveFieldInfluence', type: 'number', digits: 0 },
  { key: 'waveDriftMultiplier', type: 'number', digits: 2 },
  { key: 'waveDuneAlphaBoost', type: 'number', digits: 2 },
  { key: 'waveBoxGap', type: 'number', digits: 0 },
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
  { key: 'windBoostLightnessShift', type: 'number', digits: 2 },
  { key: 'windBoostMinMultiplier', type: 'number', digits: 2 },
  { key: 'windBoostMaxMultiplier', type: 'number', digits: 2 },
  { key: 'windBoostTurbulenceMinMultiplier', type: 'number', digits: 2 },
  { key: 'windBoostTurbulenceMaxMultiplier', type: 'number', digits: 2 },
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
  { key: 'backgroundFadeOscillationPeriodSec', type: 'number', digits: 1 },
];

const COLOR_PARAM_DEFS = [
  { key: 'fade', param: 'colorFade' },
  { key: 'particles', param: 'colorParticles' },
  { key: 'separationZone', param: 'colorSeparationZone' },
  { key: 'boxStrokeIdle', param: 'colorBoxStrokeIdle' },
  { key: 'boxStrokeDragged', param: 'colorBoxStrokeDragged' },
];

const COLOR_ALPHA_PARAM_DEFS = [
  { key: 'fade', param: 'colorFadeAlpha', source: 'config', configKey: 'trailAlpha', digits: 0 },
  { key: 'fadeSecondary', param: 'colorFadeAlphaSecondary', source: 'config', configKey: 'trailAlphaSecondary', digits: 0 },
  { key: 'particles', param: 'colorParticlesAlpha', source: 'render', digits: 0 },
  { key: 'particlesSecondary', param: 'colorParticlesAlphaSecondary', source: 'config', configKey: 'particleAlphaSecondary', digits: 0 },
  { key: 'separationZone', param: 'colorSeparationZoneAlpha', source: 'config', configKey: 'separationZoneAlpha', digits: 0 },
  { key: 'boxStrokeIdle', param: 'colorBoxStrokeIdleAlpha', source: 'render', digits: 0 },
  { key: 'boxStrokeDragged', param: 'colorBoxStrokeDraggedAlpha', source: 'render', digits: 0 },
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
  useWaveRenderer: 'Renders flowing wave lines instead of the particle system.',
  waveLineCount: 'How many wave rows are drawn across the screen.',
  waveAmplitude: 'Base vertical displacement of the wave lines.',
  wavePointStep: 'Horizontal sampling distance between wave points. Lower values are smoother but more expensive.',
  waveStrokeWeight: 'Base stroke width of the wave lines.',
  waveFieldInfluence: 'How strongly the ambient wind field bends and steers the waves.',
  waveDriftMultiplier: 'Additional temporal drift applied to the wave phase.',
  waveDuneAlphaBoost: 'How strongly dune ridges brighten the wave segments.',
  waveBoxGap: 'Extra clearance around word collider boxes where wave segments are suppressed.',
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
  windBoostLightnessShift: 'Shifts boosted particles toward black or white in HSL lightness space.',
  windBoostMinMultiplier: 'Minimum wind-force multiplier for boosted particles.',
  windBoostMaxMultiplier: 'Maximum wind-force multiplier for boosted particles.',
  windBoostTurbulenceMinMultiplier: 'Minimum turbulence multiplier for boosted particles.',
  windBoostTurbulenceMaxMultiplier: 'Maximum turbulence multiplier for boosted particles.',
  boxForceMaxRadius: 'Maximum distance from a collider where box influence is allowed to affect particles.',
  surfaceSlideBand: 'Thickness of the near-surface band where particles are encouraged to slide along collider faces.',
  staticInfluenceForwardDotMin: 'Minimum forward alignment required before a moving box starts affecting nearby particles.',
  backsideDragStrength: 'How strongly particles are slowed on the lee side of a moving collider.',
  backgroundFadeOscillationPeriodSec: 'How many seconds it takes to complete one full ease-in-out background alpha cycle. Set to 0 to disable.',
};

const COLOR_CONTROL_TOOLTIPS = {
  fade: 'Background clear or fade color used behind the particles.',
  particles: 'Base particle trail color.',
  separationZone: 'Debug color used for separation-zone visualization.',
  boxStrokeIdle: 'Outline color for collider boxes when idle.',
  boxStrokeDragged: 'Outline color for collider boxes while dragged.',
};

const COLOR_ALPHA_CONTROL_TOOLTIPS = {
  fade: 'Alpha used for the background fade pass. Ignored when transparent trails are enabled.',
  fadeSecondary: 'Secondary background fade alpha used as the other end of the oscillation range.',
  particles: 'Base particle alpha before speed and trail fade adjustments.',
  particlesSecondary: 'Secondary particle alpha used as the other end of the oscillation range.',
  separationZone: 'Opacity of the separation-zone debug overlay.',
  boxStrokeIdle: 'Opacity of idle collider box outlines.',
  boxStrokeDragged: 'Opacity of dragged collider box outlines.',
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
const SIM_MAX_STEPS_PER_FRAME = 8;

let draggedBoxIndex = -1;
let dragOffsetX = 0;
let dragOffsetY = 0;
let controlsBound = false;
let dynamicSeparationEveryNFrames = CONFIG.separationEveryNFrames;
let lastDrawTimeMs = 0;
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

function detectRefreshRateFps(sampleCount = 45) {
  return new Promise((resolve) => {
    const deltas = [];
    let prevTs = null;
    let frames = 0;
    const step = (ts) => {
      if (prevTs !== null) {
        const dt = ts - prevTs;
        if (dt > 0 && dt < 40) {
          deltas.push(dt);
        }
      }
      prevTs = ts;
      frames += 1;
      if (frames >= sampleCount) {
        if (deltas.length === 0) {
          resolve(60);
          return;
        }
        const sorted = deltas.slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length * 0.5)];
        resolve(constrain(Math.round(1000 / median), 30, 240));
        return;
      }
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  });
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
  frameRate(120);
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
  setupDuneControls();
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
}

function draw() {
  const nowMs = millis();
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
  if (CONFIG.useWaveRenderer) {
    renderWaves(nowMs);
  } else {
    updateParticles(nowMs, simStepCount, true, dtFrames);
    updateAdaptiveSeparationCadence(nowMs);
    renderParticles();
  }
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
  setupDetailsPersistence(panel);
  detectRefreshRateFps().then((fps) => {
    detectedRefreshRateFps = fps;
    applyQualityTargetFpsBounds(panel);
  });
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

function rgbToHsl(r, g, b) {
  const rn = clampColorByte(r) / 255;
  const gn = clampColorByte(g) / 255;
  const bn = clampColorByte(b) / 255;
  const maxC = Math.max(rn, gn, bn);
  const minC = Math.min(rn, gn, bn);
  const delta = maxC - minC;
  let h = 0;
  let s = 0;
  const l = (maxC + minC) * 0.5;

  if (delta > 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (maxC) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h /= 6;
    if (h < 0) h += 1;
  }

  return { h, s, l };
}

function hslToRgb(h, s, l) {
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  if (s <= 0) {
    const gray = clampColorByte(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: clampColorByte(hue2rgb(p, q, h + 1 / 3) * 255),
    g: clampColorByte(hue2rgb(p, q, h) * 255),
    b: clampColorByte(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

function applyLightnessShiftToRgb(r, g, b, shift) {
  const amount = constrain(shift, -1, 1);
  if (amount === 0) {
    return { r: clampColorByte(r), g: clampColorByte(g), b: clampColorByte(b) };
  }
  const hsl = rgbToHsl(r, g, b);
  const nextL = amount >= 0
    ? hsl.l + (1 - hsl.l) * amount
    : hsl.l * (1 + amount);
  return hslToRgb(hsl.h, hsl.s, constrain(nextL, 0, 1));
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
  };
}

function syncParticleDisplayState(particle, x = particle.pos.x, y = particle.pos.y) {
  particle.prevX = x;
  particle.prevY = y;
  particle.displayX = x;
  particle.displayY = y;
}

function getInterpolatedParticlePosition(particle) {
  return {
    x: lerp(particle.prevX, particle.pos.x, simRenderAlpha),
    y: lerp(particle.prevY, particle.pos.y, simRenderAlpha),
  };
}

function getInterpolatedBoxPosition(box) {
  return {
    x: lerp(box.prevX, box.x, simRenderAlpha),
    y: lerp(box.prevY, box.y, simRenderAlpha),
  };
}

function clampRenderedSegment(fromX, fromY, toX, toY, maxLen = MAX_RENDER_SEGMENT_LENGTH_PX) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const lenSq = dx * dx + dy * dy;
  const maxLenSq = maxLen * maxLen;
  if (lenSq <= maxLenSq || lenSq <= 1e-9) {
    return { fromX, fromY, toX, toY };
  }
  const len = sqrt(lenSq);
  const scale = maxLen / len;
  return {
    fromX,
    fromY,
    toX: fromX + dx * scale,
    toY: fromY + dy * scale,
  };
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
  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
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

    if (!particle.ignoresBoxCollision) {
      const nearbyBoxes = getNearbyBoxesForPoint(particle.pos.x, particle.pos.y);
      for (let j = 0; j < nearbyBoxes.length; j++) {
        const boxForce = applyBoxInfluence(particle, nearbyBoxes[j], nowMs);
        accX += boxForce.x;
        accY += boxForce.y;
      }
    }

    particle.vel.x += accX * safeDtFrames;
    particle.vel.y += accY * safeDtFrames;
    particle.vel.mult(damping);
    particle.vel.limit(CONFIG.maxSpeed);
    particle.pos.x += particle.vel.x * safeDtFrames;
    particle.pos.y += particle.vel.y * safeDtFrames;

    // Strict occupancy: particles are not allowed to remain inside boxes.
    if (!particle.ignoresBoxCollision) {
      const nearbyBoxes = getNearbyBoxesForPoint(particle.pos.x, particle.pos.y);
      for (let j = 0; j < nearbyBoxes.length; j++) {
        resolveParticleBoxContainment(particle, nearbyBoxes[j]);
        resolveParticleSurfaceSlide(particle, nearbyBoxes[j]);
      }
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

  const frameMs = nowMs - lastDrawTimeMs;
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

function buildFrameCache(nowMs) {
  const windAngle = radians(CONFIG.ambientWindDirectionDeg);
  const windDirX = cos(windAngle);
  const windDirY = sin(windAngle);
  const windPerpX = -windDirY;
  const windPerpY = windDirX;
  const duneBandAngle = radians(CONFIG.duneBandRotationDeg);
  const duneDirX = cos(duneBandAngle);
  const duneDirY = sin(duneBandAngle);
  const dunePerpX = -duneDirY;
  const dunePerpY = duneDirX;
  const t = nowMs * 0.001;
  const driftPixels = t * CONFIG.duneDriftSpeed * 240;

  return {
    nowMs,
    windDirX,
    windDirY,
    windPerpX,
    windPerpY,
    duneDirX,
    duneDirY,
    dunePerpX,
    dunePerpY,
    duneBandOffsetPx: CONFIG.duneBandOffsetPx,
    driftPixels,
  };
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

  return {
    x: frameCache.windDirX * windAmp + frameCache.windPerpX * microAmp,
    y: frameCache.windDirY * windAmp + frameCache.windPerpY * microAmp,
    duneSignal: constrain((duneMultiplier - 0.25) / 0.95, 0, 1),
  };
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

function pickWeightedRespawnCoordinate(isVerticalEdge, fixedCoord, minCoord, maxCoord, nowMs) {
  const bins = 24;
  const span = maxCoord - minCoord;
  if (span <= 0) return minCoord;

  const weights = new Array(bins);
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
  if (boxSpeed < CONFIG.boxStationarySpeedThreshold) return { x: 0, y: 0 };
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
    return {
      x: boundaryForceX + wakeSwirl.x,
      y: boundaryForceY + wakeSwirl.y,
    };
  }
  // Inside particles are handled only by containment projection (no force push).
  return { x: 0, y: 0 };
}

function computeWakeSwirlForce(particle, box, boxSpeed, nowMs) {
  if (!isParticleRecentlyInteracted(particle, nowMs)) return { x: 0, y: 0 };

  let wakeDirX = particle.interactionDirX;
  let wakeDirY = particle.interactionDirY;
  const wakeDirMag = sqrt(wakeDirX * wakeDirX + wakeDirY * wakeDirY);
  if (wakeDirMag < 0.0001) return { x: 0, y: 0 };
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
    return { x: 0, y: 0 };
  }

  const perpX = -wakeDirY;
  const perpY = wakeDirX;
  const lateral = relX * perpX + relY * perpY;
  const absLateral = abs(lateral);
  if (absLateral > CONFIG.wakeSwirlWidth) return { x: 0, y: 0 };

  const alongFalloff = 1 - behindTrailingFace / CONFIG.wakeSwirlLength;
  const lateralFalloff = 1 - absLateral / CONFIG.wakeSwirlWidth;
  const envelope = max(0, alongFalloff * lateralFalloff);
  if (envelope <= 0) return { x: 0, y: 0 };

  const phase = behindTrailingFace * CONFIG.wakeSwirlFrequency;
  const swirlSign = sin(phase);
  const swirlScale = CONFIG.wakeSwirlStrength * speedScale * envelope * swirlSign;
  const advectionScale = CONFIG.wakeDragStrength * 0.7 * speedScale * envelope;
  return {
    x: perpX * swirlScale + wakeDirX * advectionScale,
    y: perpY * swirlScale + wakeDirY * advectionScale,
  };
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
    if (particles[i].ignoresBoxCollision) continue;
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
  if (particle.vel.magSq() < 1e-4) {
    particle.vel.set(0, 0);
  }

  if (particle.vel.x === 0 && particle.vel.y === 0) {
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
  }
}

function resetParticleInteractionState(particle) {
  particle.interactedUntilMs = 0;
  particle.interactionDirX = 0;
  particle.interactionDirY = 0;
  particle.interactionSpeed = 0;
}

function isWavePointBlocked(px, py, gap = 0) {
  const nearbyBoxes = getNearbyBoxesForPoint(px, py);
  for (let i = 0; i < nearbyBoxes.length; i++) {
    const box = nearbyBoxes[i];
    if (
      px >= box.x - gap &&
      px <= box.x + box.w + gap &&
      py >= box.y - gap &&
      py <= box.y + box.h + gap
    ) {
      return true;
    }
  }
  return false;
}

function renderWaves(nowMs = simTimeMs) {
  const baseR = RENDER_COLORS.particles[0];
  const baseG = RENDER_COLORS.particles[1];
  const baseB = RENDER_COLORS.particles[2];
  const baseA = getCurrentParticleAlpha();
  const renderFraction = constrain(getQualityValue('particleRenderFraction'), 0.01, 1);
  const rowCount = max(4, floor(CONFIG.waveLineCount * lerp(0.45, 1, renderFraction)));
  const pointStep = max(4, floor(CONFIG.wavePointStep / max(0.5, renderFraction)));
  const spacing = height / (rowCount + 1);
  const frameCache = buildFrameCache(nowMs);
  const boxGap = max(0, CONFIG.waveBoxGap * currentRenderScale);
  const strokeBase = max(0.2, CONFIG.waveStrokeWeight);
  const fieldInfluence = CONFIG.waveFieldInfluence * currentRenderScale;
  const timePhase = nowMs * 0.001 * CONFIG.waveDriftMultiplier;
  const lineAlphaBase = baseA * lerp(0.55, 1, renderFraction);

  noFill();
  strokeCap(ROUND);

  for (let row = 0; row < rowCount; row++) {
    const baseY = spacing * (row + 1);
    const rowPhase = row * 0.63 + timePhase;
    let prev = null;

    for (let x = -pointStep; x <= width + pointStep; x += pointStep) {
      const ambient = sampleDuneWindForceXY(x, baseY, frameCache, 1);
      const duneSignal = constrain(ambient.duneSignal || 0, 0, 1);
      const localAmp = CONFIG.waveAmplitude * currentRenderScale * (0.45 + 0.55 * duneSignal);
      const wavePhase =
        rowPhase +
        x / max(24, CONFIG.duneBandScale * 0.55) +
        baseY / max(30, CONFIG.duneAlongWarpScale * 0.7);
      const sampleX = x + ambient.x * fieldInfluence * 0.25;
      const sampleY = baseY + sin(wavePhase) * localAmp + ambient.y * fieldInfluence;
      const blocked = isWavePointBlocked(sampleX, sampleY, boxGap);

      if (blocked) {
        prev = null;
        continue;
      }

      const point = {
        x: sampleX,
        y: sampleY,
        duneSignal,
      };

      if (prev) {
        const segmentAlpha = constrain(
          lineAlphaBase * (1 + CONFIG.waveDuneAlphaBoost * point.duneSignal),
          0,
          255
        );
        stroke(baseR, baseG, baseB, segmentAlpha);
        strokeWeight(strokeBase * (0.8 + 0.35 * point.duneSignal));
        line(prev.x, prev.y, point.x, point.y);
      }

      prev = point;
    }
  }

  noStroke();
}

function renderParticles() {
  const baseR = RENDER_COLORS.particles[0];
  const baseG = RENDER_COLORS.particles[1];
  const baseB = RENDER_COLORS.particles[2];
  const baseA = getCurrentParticleAlpha();
  const fastLightnessShift = constrain(CONFIG.windBoostLightnessShift, -1, 1);
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
  const renderParticleAt = (p, i) => {
    const speed = sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
    const interpolatedPos = getInterpolatedParticlePosition(p);
    if (speed < minSpeed) {
      p.displayX = interpolatedPos.x;
      p.displayY = interpolatedPos.y;
      return;
    }
    const minSpeedAlphaRamp = constrain((speed - minSpeed) / minSpeedRamp, 0, 1);
    const t = particleCount > 1 ? i / (particleCount - 1) : 0;
    const renderAlphaWeight = lerp(1, tailAlphaWeight, t);
    const renderWidthWeight = lerp(1, tailWidthWeight, t);
    const speedFactor = 1 + speed;
    const duneSignal = constrain(p.duneAlphaSignal || 0, 0, 1);
    const duneAlphaFactor = 1 + duneAlphaBoost * duneSignal;
    const duneSizeFactor = 1 + duneSizeBoost * duneSignal;
    const fastAlphaAdd = p.isBoosted ? max(0, CONFIG.windBoostAlphaMultiplier) : 0;
    const renderColor = p.isBoosted
      ? applyLightnessShiftToRgb(baseR, baseG, baseB, fastLightnessShift)
      : { r: baseR, g: baseG, b: baseB };
    const alpha = constrain(
      baseA * renderAlphaWeight * minSpeedAlphaRamp * (1 + alphaBoost * (speedFactor - 1)) * duneAlphaFactor + fastAlphaAdd,
      0,
      255
    );
    stroke(renderColor.r, renderColor.g, renderColor.b, alpha);
    strokeWeight(
      Math.max(
        0.5,
        CONFIG.particleSize *
        p.sizeMultiplier *
        renderWidthWeight *
        (1 + widthBoost * (speedFactor - 1)) *
        duneSizeFactor
      )
    );
    const segment = clampRenderedSegment(
      p.displayX,
      p.displayY,
      interpolatedPos.x,
      interpolatedPos.y
    );
    line(segment.fromX, segment.fromY, segment.toX, segment.toY);
    p.displayX = segment.toX;
    p.displayY = segment.toY;
  };
  noFill();
  strokeCap(ROUND);
  for (let i = 0; i < particleCount; i++) {
    const p = particles[i];
    if (p.isBoosted) continue;
    renderParticleAt(p, i);
  }
  for (let i = 0; i < particleCount; i++) {
    const p = particles[i];
    if (!p.isBoosted) continue;
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
