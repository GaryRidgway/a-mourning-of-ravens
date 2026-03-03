// https://www.openprocessing.org/sketch/157576

const CONFIG = {
  particleCount: 5000,
  particleSize: 0.65,
  particleSizeRandomNegative: 0.12,
  particleSizeRandomPositive: 0.9,
  particleRenderMinSpeed: 0.1,
  particleSpeedAlphaBoost: 3.24,
  particleSpeedWidthBoost: 0.26,
  particleRenderFraction: 1,
  enableAmbientMotion: true,
  ambientWindStrength: 0.042,
  duneBandScale: 100,
  duneAlongWarpScale: 316,
  duneWarpStrength: 1.5,
  duneContrast: 1,
  duneDriftSpeed: 0.1,
  microNoiseScale: 596,
  microTurbulenceStrength: 0.014,
  windBoostParticleRatio: 0.02,
  windBoostMinMultiplier: 5,
  windBoostMaxMultiplier: 10,
  windBoostTurbulenceMinMultiplier: 4,
  windBoostTurbulenceMaxMultiplier: 8,
  edgeRespawnWeightBase: 0.05,
  edgeRespawnWeightStrength: 0.45,
  edgeRespawnWeightExponent: 2,
  useWeightedEdgeRespawn: false,
  edgeRespawnWeightedMixPercent: 20,
  enableParticleSeparation: true,
  particleCollisionRadius: 0.95,
  particleCollisionStrength: 0.64,
  particleCollisionVelocityDamp: 0.22,
  separationEveryNFrames: 4,
  maxSeparationPairsPerTick: 70000,
  maxSeparationCandidatesPerCell: 24,
  enableAdaptiveSeparationCadence: true,
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
  boxCollisionParticipantRatio: 1,
  enablePrewarm: false,
  prewarmSteps: 550,
  prewarmTimeStepMs: 10,
  prewarmEnableSeparation: false,
  showSeparationZone: true,
  separationZoneAlpha: 0,
  damping: 0.86,
  maxSpeed: 1.7,
  trailAlpha: 9,
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
  enableWindShadow: false,
  windShadowLength: 188,
  windShadowWidthGrowth: 0.24,
  windShadowStrength: 1,
  windShadowRotationDeg: -15,
  windShadowOffsetAlong: -93,
  windShadowOffsetLateral: 1,
  showWindShadowZone: true,
  windShadowZoneAlpha: 0,
  edgePadding: 0,
  edgeRestitution: 0.35,
  boxVelocityDecay: 0.86,
  boxStationarySpeedThreshold: 0.12,
  showBoxes: true,
  showDebug: false,
};

const RENDER_COLORS = {
  fade: [20, 17, 11],
  particles: [164, 40, 40, 97],
  separationZone: [130, 175, 235],
  boxStrokeIdle: [200, 200, 180, 0],
  boxStrokeDragged: [250, 230, 190, 0],
  windShadowZone: [120, 160, 220],
};

const CONTROL_PARAM_DEFS = [
  { key: 'particleSize', type: 'number', digits: 2 },
  { key: 'particleSizeRandomNegative', type: 'number', digits: 2 },
  { key: 'particleSizeRandomPositive', type: 'number', digits: 2 },
  { key: 'particleRenderMinSpeed', type: 'number', digits: 2 },
  { key: 'particleSpeedAlphaBoost', type: 'number', digits: 2 },
  { key: 'particleSpeedWidthBoost', type: 'number', digits: 2 },
  { key: 'particleRenderFraction', type: 'number', digits: 2 },
  { key: 'enableAmbientMotion', type: 'bool' },
  { key: 'ambientWindStrength', type: 'number', digits: 3 },
  { key: 'duneBandScale', type: 'number', digits: 0 },
  { key: 'duneAlongWarpScale', type: 'number', digits: 0 },
  { key: 'duneWarpStrength', type: 'number', digits: 2 },
  { key: 'duneContrast', type: 'number', digits: 2 },
  { key: 'duneDriftSpeed', type: 'number', digits: 2 },
  { key: 'microNoiseScale', type: 'number', digits: 0 },
  { key: 'microTurbulenceStrength', type: 'number', digits: 3 },
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
  { key: 'enableWindShadow', type: 'bool' },
  { key: 'windShadowLength', type: 'number', digits: 0 },
  { key: 'windShadowWidthGrowth', type: 'number', digits: 2 },
  { key: 'windShadowStrength', type: 'number', digits: 2 },
  { key: 'windShadowRotationDeg', type: 'number', digits: 0 },
  { key: 'windShadowOffsetAlong', type: 'number', digits: 0 },
  { key: 'windShadowOffsetLateral', type: 'number', digits: 0 },
  { key: 'showWindShadowZone', type: 'bool' },
  { key: 'windShadowZoneAlpha', type: 'number', digits: 0 },
  { key: 'enablePrewarm', type: 'bool' },
  { key: 'prewarmSteps', type: 'number', digits: 0 },
  { key: 'prewarmTimeStepMs', type: 'number', digits: 0 },
  { key: 'prewarmEnableSeparation', type: 'bool' },
];

const COLOR_PARAM_DEFS = [
  { key: 'fade', param: 'colorFade' },
  { key: 'particles', param: 'colorParticles' },
  { key: 'separationZone', param: 'colorSeparationZone' },
  { key: 'boxStrokeIdle', param: 'colorBoxStrokeIdle' },
  { key: 'boxStrokeDragged', param: 'colorBoxStrokeDragged' },
  { key: 'windShadowZone', param: 'colorWindShadowZone' },
];

const COLOR_ALPHA_PARAM_DEFS = [
  { key: 'fade', param: 'colorFadeAlpha', source: 'config', configKey: 'trailAlpha', digits: 0 },
  { key: 'particles', param: 'colorParticlesAlpha', source: 'render', digits: 0 },
  { key: 'separationZone', param: 'colorSeparationZoneAlpha', source: 'config', configKey: 'separationZoneAlpha', digits: 0 },
  { key: 'boxStrokeIdle', param: 'colorBoxStrokeIdleAlpha', source: 'render', digits: 0 },
  { key: 'boxStrokeDragged', param: 'colorBoxStrokeDraggedAlpha', source: 'render', digits: 0 },
  { key: 'windShadowZone', param: 'colorWindShadowZoneAlpha', source: 'config', configKey: 'windShadowZoneAlpha', digits: 0 },
];

const particles = [];
const boxes = [];
let activeBoxes = [];
let externalBoxSyncEnabled = false;
const BOX_ACTIVE_MARGIN = 280;

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

applyConfigFromUrlParams();

class FlowBox {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }
}

function setup() {
  frameRate(120);
  const canvas = createCanvas(windowWidth, windowHeight);
  const mount = document.getElementById('poem-bg');
  if (mount) {
    canvas.parent(mount);
  }
  noStroke();
  setupDuneControls();

  fill(...RENDER_COLORS.fade);
  rect(0, 0, width, height);

  for (let i = 0; i < CONFIG.particleCount; i++) {
    const ignoresBoxCollision = i / CONFIG.particleCount >= CONFIG.boxCollisionParticipantRatio;
    particles.push(createParticle(random(width), random(height), ignoresBoxCollision));
  }

  if (CONFIG.enablePrewarm && CONFIG.prewarmSteps > 0) {
    runPrewarmSimulation();
  }

  // Expose API for external apps (poem) to drive box positions.
  window.setFlowBoxes = function setFlowBoxes(nextBoxes = []) {
    externalBoxSyncEnabled = true;
    draggedBoxIndex = -1;

    while (boxes.length < nextBoxes.length) {
      boxes.push(new FlowBox(0, 0, 1, 1));
    }
    while (boxes.length > nextBoxes.length) {
      boxes.pop();
    }

    for (let i = 0; i < nextBoxes.length; i++) {
      const src = nextBoxes[i];
      const box = boxes[i];
      box.x = src.x;
      box.y = src.y;
      box.w = src.w;
      box.h = src.h;
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
  updateAdaptiveSeparationCadence(nowMs);
  fadeCanvas();
  updateBoxes();
  updateActiveBoxes();
  updateParticles(nowMs, frameCount, true);
  renderParticles();
  renderBoxes();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function fadeCanvas() {
  fill(...RENDER_COLORS.fade, CONFIG.trailAlpha);
  rect(0, 0, width, height);
}

function setupDuneControls() {
  if (controlsBound) return;

  const panel = document.getElementById('dune-controls');
  if (!panel) return;

  controlsBound = true;
  const edgeRespawnMixInput = panel.querySelector('[data-key="edgeRespawnWeightedMixPercent"]');
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
        CONFIG[def.key] = parsed;
        updateControlOutput(def.key, parsed, def.digits);
      }
      if (def.key === 'useWeightedEdgeRespawn') {
        syncEdgeRespawnMixDisabledState();
      }
      syncColorAlphaInputsForConfigKey(def.key);
      syncUrlParamsFromConfig();
    });
  }
  syncEdgeRespawnMixDisabledState();

  bindColorControls(panel);
  bindColorAlphaControls(panel);
  bindAppControls(panel);
  setupDetailsPersistence(panel);
}

function bindAppControls(panel) {
  const params = new URLSearchParams(window.location.search);
  const wordBoxesInput = panel.querySelector('[data-app-key="wordBoxes"]');
  const wordInsetXInput = panel.querySelector('[data-app-key="wordInsetX"]');
  const wordInsetYInput = panel.querySelector('[data-app-key="wordInsetY"]');
  const wordInsetXOutput = panel.querySelector('[data-app-value-for="wordInsetX"]');
  const wordInsetYOutput = panel.querySelector('[data-app-value-for="wordInsetY"]');

  if (wordBoxesInput) {
    const raw = params.get('wordBoxes');
    const initial = raw === null ? true : raw === '1';
    wordBoxesInput.checked = initial;
  }

  const initialInsetFallbackRaw = params.get('wordInset');
  const initialInsetXFallbackRaw = params.get('wordInsetX');
  const initialInsetYFallbackRaw = params.get('wordInsetY');
  const initialInsetXFallback = Number.isFinite(Number(initialInsetXFallbackRaw))
    ? Number(initialInsetXFallbackRaw)
    : (
      Number.isFinite(Number(initialInsetFallbackRaw))
        ? Number(initialInsetFallbackRaw)
        : 3
    );
  const initialInsetYFallback = Number.isFinite(Number(initialInsetYFallbackRaw))
    ? Number(initialInsetYFallbackRaw)
    : (
      Number.isFinite(Number(initialInsetFallbackRaw))
        ? Number(initialInsetFallbackRaw)
        : 5
    );
  if (wordInsetXInput) {
    const initialInsetRaw = params.get('wordInsetX');
    const initialInset = Number.isFinite(Number(initialInsetRaw))
      ? Number(initialInsetRaw)
      : initialInsetXFallback;
    wordInsetXInput.value = String(initialInset);
    if (wordInsetXOutput) {
      wordInsetXOutput.textContent = initialInset.toFixed(1);
    }
    if (typeof window.__mournSetWordInsetXPx === 'function') {
      window.__mournSetWordInsetXPx(initialInset);
    }
  }

  if (wordInsetYInput) {
    const initialInsetRaw = params.get('wordInsetY');
    const initialInset = Number.isFinite(Number(initialInsetRaw))
      ? Number(initialInsetRaw)
      : initialInsetYFallback;
    wordInsetYInput.value = String(initialInset);
    if (wordInsetYOutput) {
      wordInsetYOutput.textContent = initialInset.toFixed(1);
    }
    if (typeof window.__mournSetWordInsetYPx === 'function') {
      window.__mournSetWordInsetYPx(initialInset);
    }
  }

  const syncAppParams = () => {
    const nextParams = new URLSearchParams(window.location.search);
    if (wordBoxesInput) {
      const enabled = !!wordBoxesInput.checked;
      if (enabled) {
        nextParams.set('wordBoxes', '1');
      } else {
        nextParams.delete('wordBoxes');
      }
    }

    if (wordInsetXInput) {
      const inset = Number(wordInsetXInput.value);
      if (Number.isFinite(inset)) {
        nextParams.set('wordInsetX', inset.toFixed(1));
      }
    }
    if (wordInsetYInput) {
      const inset = Number(wordInsetYInput.value);
      if (Number.isFinite(inset)) {
        nextParams.set('wordInsetY', inset.toFixed(1));
      }
    }
    nextParams.delete('wordInset');

    const next = `${window.location.pathname}?${nextParams.toString()}`;
    window.history.replaceState({}, '', next);
  };

  if (wordBoxesInput) {
    wordBoxesInput.addEventListener('input', () => {
      const enabled = !!wordBoxesInput.checked;
      syncAppParams();
      if (typeof window.__mournSetWordBoxes === 'function') {
        window.__mournSetWordBoxes(enabled);
      }
    });
  }

  if (wordInsetXInput) {
    wordInsetXInput.addEventListener('input', () => {
      const inset = Number(wordInsetXInput.value);
      if (!Number.isFinite(inset)) return;
      if (wordInsetXOutput) {
        wordInsetXOutput.textContent = inset.toFixed(1);
      }
      syncAppParams();
      if (typeof window.__mournSetWordInsetXPx === 'function') {
        window.__mournSetWordInsetXPx(inset);
      }
    });
  }

  if (wordInsetYInput) {
    wordInsetYInput.addEventListener('input', () => {
      const inset = Number(wordInsetYInput.value);
      if (!Number.isFinite(inset)) return;
      if (wordInsetYOutput) {
        wordInsetYOutput.textContent = inset.toFixed(1);
      }
      syncAppParams();
      if (typeof window.__mournSetWordInsetYPx === 'function') {
        window.__mournSetWordInsetYPx(inset);
      }
    });
  }

  if (wordBoxesInput) {
    const enabled = !!wordBoxesInput.checked;
    if (typeof window.__mournSetWordBoxes === 'function') {
      window.__mournSetWordBoxes(enabled);
    }
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
    ignoresBoxCollision,
    isBoosted: boosted,
    windBoostMultiplier,
    turbulenceBoostMultiplier,
    sizeMultiplier: (boosted ? 0.5 : 1) * randomSizeMultiplier,
    interactedUntilMs: 0,
    interactionDirX: 0,
    interactionDirY: 0,
    interactionAnchorX: x,
    interactionAnchorY: y,
    interactionSpeed: 0,
  };
}

function updateBoxes() {
  if (externalBoxSyncEnabled) {
    return;
  }

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (i !== draggedBoxIndex) {
      box.vx *= CONFIG.boxVelocityDecay;
      box.vy *= CONFIG.boxVelocityDecay;
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
}

function updateParticles(nowMs = millis(), tickIndex = frameCount, allowSeparation = true) {
  const frameCache = buildFrameCache(nowMs);
  const useAmbient = CONFIG.enableAmbientMotion;
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
      const exposure = particle.ignoresBoxCollision
        ? 1
        : getWindExposureMultiplierXY(particle.pos.x, particle.pos.y, frameCache);
      accX += ambient.x * exposure * particle.windBoostMultiplier;
      accY += ambient.y * exposure * particle.windBoostMultiplier;
    }

    if (!particle.ignoresBoxCollision) {
      for (let j = 0; j < activeBoxes.length; j++) {
        const boxForce = applyBoxInfluence(particle, activeBoxes[j], nowMs);
        accX += boxForce.x;
        accY += boxForce.y;
      }
    }

    particle.vel.x += accX;
    particle.vel.y += accY;
    particle.vel.mult(CONFIG.damping);
    particle.vel.limit(CONFIG.maxSpeed);
    particle.pos.add(particle.vel);

    // Strict occupancy: particles are not allowed to remain inside boxes.
    if (!particle.ignoresBoxCollision) {
      for (let j = 0; j < activeBoxes.length; j++) {
        resolveParticleBoxContainment(particle, activeBoxes[j]);
        resolveParticleSurfaceSlide(particle, activeBoxes[j]);
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
    resolveParticleSeparation(nowMs);
    // Separation can nudge particles into colliders; clamp them back out immediately.
    enforceAllParticleBoxContainment();
  }
}

function updateAdaptiveSeparationCadence(nowMs) {
  const baseCadence = max(1, floor(CONFIG.separationEveryNFrames));
  if (!CONFIG.enableAdaptiveSeparationCadence) {
    dynamicSeparationEveryNFrames = baseCadence;
    lastDrawTimeMs = nowMs;
    return;
  }

  if (lastDrawTimeMs <= 0) {
    dynamicSeparationEveryNFrames = baseCadence;
    lastDrawTimeMs = nowMs;
    return;
  }

  const frameMs = nowMs - lastDrawTimeMs;
  lastDrawTimeMs = nowMs;
  const target = max(1, CONFIG.adaptiveTargetFrameMs);
  const maxCadence = max(baseCadence, floor(CONFIG.adaptiveCadenceMax));

  if (frameMs > target * 1.05) {
    dynamicSeparationEveryNFrames = min(maxCadence, dynamicSeparationEveryNFrames + 1);
  } else if (frameMs < target * 0.9) {
    dynamicSeparationEveryNFrames = max(
      baseCadence,
      dynamicSeparationEveryNFrames - CONFIG.adaptiveCadenceRecovery
    );
  }
}

function getCurrentSeparationCadence() {
  if (!CONFIG.enableAdaptiveSeparationCadence) {
    return max(1, floor(CONFIG.separationEveryNFrames));
  }
  return max(1, floor(dynamicSeparationEveryNFrames));
}

function runPrewarmSimulation() {
  const steps = max(0, floor(CONFIG.prewarmSteps));
  const dt = max(1, floor(CONFIG.prewarmTimeStepMs));
  const startMs = millis();

  for (let i = 0; i < steps; i++) {
    const simTimeMs = startMs + i * dt;
    updateParticles(simTimeMs, i, CONFIG.prewarmEnableSeparation);
  }
}

function getCellKey(cx, cy) {
  return (cx + CELL_KEY_OFFSET) * CELL_KEY_STRIDE + (cy + CELL_KEY_OFFSET);
}

function resolveParticleSeparation(nowMs) {
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
  const maxPairs = max(1, floor(CONFIG.maxSeparationPairsPerTick));
  const maxCandidatesPerCell = max(1, floor(CONFIG.maxSeparationCandidatesPerCell));
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
            frameCount;
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

  for (let i = 0; i < activeBoxes.length; i++) {
    if (isNearBox(particle.pos.x, particle.pos.y, activeBoxes[i], CONFIG.separationNearBoxRadius)) {
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
  const windDirX = -0.70710678;
  const windDirY = 0.70710678;
  const windPerpX = -windDirY;
  const windPerpY = windDirX;
  const t = nowMs * 0.001;
  const driftPixels = t * CONFIG.duneDriftSpeed * 240;

  const rot = radians(CONFIG.windShadowRotationDeg);
  const c = cos(rot);
  const s = sin(rot);
  const shadowDirX = windDirX * c - windDirY * s;
  const shadowDirY = windDirX * s + windDirY * c;
  const shadowPerpX = -shadowDirY;
  const shadowPerpY = shadowDirX;

  return {
    nowMs,
    windDirX,
    windDirY,
    windPerpX,
    windPerpY,
    driftPixels,
    shadowDirX,
    shadowDirY,
    shadowPerpX,
    shadowPerpY,
  };
}

function sampleDuneWindForceXY(px, py, frameCache, turbulenceMultiplier = 1) {
  const sampleX = px - frameCache.windDirX * frameCache.driftPixels;
  const sampleY = py - frameCache.windDirY * frameCache.driftPixels;
  const along = sampleX * frameCache.windDirX + sampleY * frameCache.windDirY;
  const across = sampleX * frameCache.windPerpX + sampleY * frameCache.windPerpY;

  const warpedAcross =
    across / CONFIG.duneBandScale +
    sin(along / CONFIG.duneAlongWarpScale) * CONFIG.duneWarpStrength;
  const ridge01 = (sin(warpedAcross) + 1) * 0.5;
  const duneMultiplier = 0.25 + 0.95 * pow(ridge01, CONFIG.duneContrast);
  const windAmp = CONFIG.ambientWindStrength * duneMultiplier;

  const n = noise(
    sampleX / CONFIG.microNoiseScale,
    sampleY / CONFIG.microNoiseScale
  ) * 2 - 1;
  const microAmp = n * CONFIG.microTurbulenceStrength * turbulenceMultiplier;

  return {
    x: frameCache.windDirX * windAmp + frameCache.windPerpX * microAmp,
    y: frameCache.windDirY * windAmp + frameCache.windPerpY * microAmp,
  };
}

function getWindExposureMultiplierXY(px, py, frameCache) {
  if (!CONFIG.enableWindShadow) return 1;

  let maxReduction = 0;
  for (let i = 0; i < activeBoxes.length; i++) {
    const reduction = computeWindShadowReductionXY(px, py, activeBoxes[i], frameCache);
    if (reduction > maxReduction) maxReduction = reduction;
  }
  return constrain(1 - maxReduction, 0, 1);
}

function computeWindShadowReductionXY(px, py, box, frameCache) {
  const center = getWindShadowCenterXY(box, frameCache);
  const relX = px - center.x;
  const relY = py - center.y;

  const along = relX * frameCache.shadowDirX + relY * frameCache.shadowDirY;
  const halfAlong =
    abs(frameCache.shadowDirX) * box.w * 0.5 +
    abs(frameCache.shadowDirY) * box.h * 0.5;
  const downwindDist = along - halfAlong;
  if (downwindDist <= 0 || downwindDist > CONFIG.windShadowLength) return 0;

  const lateral = abs(relX * frameCache.shadowPerpX + relY * frameCache.shadowPerpY);
  const halfLateral =
    abs(frameCache.shadowPerpX) * box.w * 0.5 +
    abs(frameCache.shadowPerpY) * box.h * 0.5;
  const shadowHalfWidth = halfLateral + CONFIG.windShadowWidthGrowth * downwindDist;
  if (lateral > shadowHalfWidth || shadowHalfWidth <= 0) return 0;

  const alongFalloff = 1 - downwindDist / CONFIG.windShadowLength;
  const lateralFalloff = 1 - lateral / shadowHalfWidth;
  return constrain(
    CONFIG.windShadowStrength * alongFalloff * lateralFalloff,
    0,
    0.98
  );
}

function getWindShadowCenterXY(box, frameCache) {
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;
  return {
    x:
      cx +
      frameCache.shadowDirX * CONFIG.windShadowOffsetAlong +
      frameCache.shadowPerpX * CONFIG.windShadowOffsetLateral,
    y:
      cy +
      frameCache.shadowDirY * CONFIG.windShadowOffsetAlong +
      frameCache.shadowPerpY * CONFIG.windShadowOffsetLateral,
  };
}

function sampleDuneMultiplierAt(x, y, nowMs) {
  if (!CONFIG.enableAmbientMotion) return 1;

  const dirX = -0.70710678;
  const dirY = 0.70710678;
  const perpX = -dirY;
  const perpY = dirX;

  const t = nowMs * 0.001;
  const driftPixels = t * CONFIG.duneDriftSpeed * 240;
  const sampleX = x - dirX * driftPixels;
  const sampleY = y - dirY * driftPixels;
  const along = sampleX * dirX + sampleY * dirY;
  const across = sampleX * perpX + sampleY * perpY;

  const warpedAcross =
    across / CONFIG.duneBandScale +
    sin(along / CONFIG.duneAlongWarpScale) * CONFIG.duneWarpStrength;
  const ridgeWave = sin(warpedAcross);
  const ridge01 = (ridgeWave + 1) * 0.5;
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
    for (let j = 0; j < activeBoxes.length; j++) {
      resolveParticleBoxContainment(particles[i], activeBoxes[j]);
      resolveParticleSurfaceSlide(particles[i], activeBoxes[j]);
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
    particle.prevX = p.x;
    particle.prevY = p.y;
  }
}

function resetParticleInteractionState(particle) {
  particle.interactedUntilMs = 0;
  particle.interactionDirX = 0;
  particle.interactionDirY = 0;
  particle.interactionSpeed = 0;
}

function renderParticles() {
  const baseR = RENDER_COLORS.particles[0];
  const baseG = RENDER_COLORS.particles[1];
  const baseB = RENDER_COLORS.particles[2];
  const baseA = RENDER_COLORS.particles.length > 3 ? RENDER_COLORS.particles[3] : 255;
  const minSpeed = max(0, CONFIG.particleRenderMinSpeed);
  const alphaBoost = max(0, CONFIG.particleSpeedAlphaBoost);
  const widthBoost = max(0, CONFIG.particleSpeedWidthBoost);
  const renderFraction = constrain(CONFIG.particleRenderFraction, 0.01, 1);
  const tailAlphaWeight = renderFraction;
  const tailWidthWeight = max(0.2, sqrt(renderFraction));
  const particleCount = particles.length;
  noFill();
  strokeCap(ROUND);
  for (let i = 0; i < particleCount; i++) {
    const p = particles[i];
    const speed = sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
    if (speed < minSpeed) {
      continue;
    }
    const t = particleCount > 1 ? i / (particleCount - 1) : 0;
    const renderAlphaWeight = lerp(1, tailAlphaWeight, t);
    const renderWidthWeight = lerp(1, tailWidthWeight, t);
    const speedFactor = 1 + speed;
    const alpha = constrain(
      baseA * renderAlphaWeight * (1 + alphaBoost * (speedFactor - 1)),
      0,
      255
    );
    stroke(baseR, baseG, baseB, alpha);
    strokeWeight(
      Math.max(
        0.5,
        CONFIG.particleSize *
        p.sizeMultiplier *
        renderWidthWeight *
        (1 + widthBoost * (speedFactor - 1))
      )
    );
    line(p.prevX, p.prevY, p.pos.x, p.pos.y);
  }
  noStroke();
}

function renderBoxes() {
  if (!CONFIG.showBoxes) return;
  const shouldRenderWindShadow = CONFIG.enableWindShadow && CONFIG.showWindShadowZone;
  let shadowDirX = 0;
  let shadowDirY = 0;
  if (shouldRenderWindShadow) {
    const a = radians(CONFIG.windShadowRotationDeg);
    const c = cos(a);
    const s = sin(a);
    shadowDirX = -0.70710678 * c - 0.70710678 * s;
    shadowDirY = -0.70710678 * s + 0.70710678 * c;
  }

  for (let i = 0; i < activeBoxes.length; i++) {
    const box = activeBoxes[i];
    const isDragged = boxes[draggedBoxIndex] === box;

    if (shouldRenderWindShadow) {
      drawWindShadowZone(box, shadowDirX, shadowDirY);
    }

    if (CONFIG.enableParticleSeparation && CONFIG.showSeparationZone) {
      const r = CONFIG.separationNearBoxRadius;
      noStroke();
      fill(...RENDER_COLORS.separationZone, CONFIG.separationZoneAlpha);
      rect(box.x - r, box.y - r, box.w + r * 2, box.h + r * 2, 6);
    }

    noFill();
    strokeWeight(isDragged ? 2.5 : 1.5);
    stroke(...(isDragged ? RENDER_COLORS.boxStrokeDragged : RENDER_COLORS.boxStrokeIdle));
    rect(box.x, box.y, box.w, box.h, 4);
    noStroke();
  }
}

function drawWindShadowZone(box, shadowDirX, shadowDirY) {
  const perpX = -shadowDirY;
  const perpY = shadowDirX;
  const centerX =
    box.x +
    box.w * 0.5 +
    shadowDirX * CONFIG.windShadowOffsetAlong +
    perpX * CONFIG.windShadowOffsetLateral;
  const centerY =
    box.y +
    box.h * 0.5 +
    shadowDirY * CONFIG.windShadowOffsetAlong +
    perpY * CONFIG.windShadowOffsetLateral;
  const halfAlong = abs(shadowDirX) * box.w * 0.5 + abs(shadowDirY) * box.h * 0.5;
  const halfLateral = abs(perpX) * box.w * 0.5 + abs(perpY) * box.h * 0.5;

  const startCenterX = centerX + shadowDirX * halfAlong;
  const startCenterY = centerY + shadowDirY * halfAlong;
  const endDist = CONFIG.windShadowLength;
  const endCenterX = startCenterX + shadowDirX * endDist;
  const endCenterY = startCenterY + shadowDirY * endDist;
  const endHalfWidth = halfLateral + CONFIG.windShadowWidthGrowth * endDist;
  const startLeftX = startCenterX + perpX * halfLateral;
  const startLeftY = startCenterY + perpY * halfLateral;
  const startRightX = startCenterX - perpX * halfLateral;
  const startRightY = startCenterY - perpY * halfLateral;
  const endLeftX = endCenterX + perpX * endHalfWidth;
  const endLeftY = endCenterY + perpY * endHalfWidth;
  const endRightX = endCenterX - perpX * endHalfWidth;
  const endRightY = endCenterY - perpY * endHalfWidth;

  noStroke();
  fill(...RENDER_COLORS.windShadowZone, CONFIG.windShadowZoneAlpha);
  beginShape();
  vertex(startLeftX, startLeftY);
  vertex(startRightX, startRightY);
  vertex(endRightX, endRightY);
  vertex(endLeftX, endLeftY);
  endShape(CLOSE);
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
