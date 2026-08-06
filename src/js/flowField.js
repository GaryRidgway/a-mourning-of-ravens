// https://www.openprocessing.org/sketch/157576
// CONFIG, CONFIG_DEFAULTS, RENDER_COLORS, RENDER_COLORS_DEFAULTS, CONTROL_PARAM_DEFS,
// COLOR_PARAM_DEFS, COLOR_ALPHA_PARAM_DEFS, CONTROL_TOOLTIPS, COLOR_CONTROL_TOOLTIPS,
// and COLOR_ALPHA_CONTROL_TOOLTIPS are declared in src/js/constants/ and loaded ahead
// of this file via index.html script tags.

const MAX_RENDER_SEGMENT_LENGTH_PX = 12;

const particles = [];
const boxes = [];
// Foreground overlay canvas: word-colliding particles render here with a
// fast transparent fade, while ignorers lay persistent ink on the main canvas.
let fgGraphics = null;
// Second transparent ink canvas: background deposits alternate between the
// main canvas and this one, with wipes phase-offset so ink always survives
// somewhere on screen.
let inkBGraphics = null;
let mainCanvasElt = null;
const _mainRenderTarget = {
  stroke: (r, g, b, a) => stroke(r, g, b, a),
  strokeWeight: (w) => strokeWeight(w),
  line: (x1, y1, x2, y2) => line(x1, y1, x2, y2),
};
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
const SIM_MAX_STEPS_PER_FRAME = 4;

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
  ridgeFalloff: 0, ridgeFalloffNorm: 1,
  curlAngleCalibrated: false, curlCalibratedGain: 0,
};
const _interpolatedBoxPos = { x: 0, y: 0 };

// Cached OkLCh conversions — only recomputed when colors change via debug controls.
const _oklchCache = {
  dirty: true,
  baseR: -1, baseG: -1, baseB: -1,
  base: { L: 0, C: 0, h: 0 },
  boostedR: -1, boostedG: -1, boostedB: -1,
  boosted: { L: 0, C: 0, h: 0 },
  glowCoreR: -1, glowCoreG: -1, glowCoreB: -1,
  glowCore: { L: 0, C: 0, h: 0 },
};


// Boid flocking spatial grid and scratch data for boosted particles.
const boidGrid = new Map();
const boidActiveIndices = [];
const boidCellXs = [];
const boidCellYs = [];

// --- Item 7: Pre-baked noise texture (replaces per-particle p5 noise() calls) ---
const NOISE_TEX_SIZE = 256;
const NOISE_TEX_SIZE_MASK = NOISE_TEX_SIZE - 1; // bitmask for wrapping
const NOISE_TEX_TILE = 4.0; // noise-space units per tile
const NOISE_TEX_INV_TILE = 1 / NOISE_TEX_TILE;
// Divergence-free curl-noise tuning: finite-difference step (noise-space units)
// and a gain that brings the raw curl magnitude up to roughly unit scale so
// curlStrength stays comparable between the two field modes.
const CURL_NOISE_DIFF_STEP = 0.02;
const CURL_NOISE_GAIN = 0.25;
// At duneContrast 1 the ridge-attraction shape term peaks at 0.475, so this
// brings duneRidgeAttraction = 1 to roughly one whole wind force of pull.
const DUNE_RIDGE_ATTRACTION_GAIN = 2.1;
// Bounds the trough singularity when duneContrast < 1. No effect at contrast >= 1.
const DUNE_RIDGE_SHAPE_CAP = 4;
// Grid resolution for measuring the texture's peak gradient, and how many of
// the best cells get a local refinement pass afterwards.
const CURL_GRAD_SCAN_STEPS = 512;
const CURL_GRAD_REFINE_CELLS = 32;
let noiseTexture = null; // Float32Array, baked in setup()
// Peak |grad N| over the whole tile, measured after each bake. p5's Perlin
// table is unseeded, so this lands anywhere from ~9 to ~17 depending on the
// page load — it has to be measured, not baked in as a constant.
let curlGradMax = 1;

function bakeNoiseTexture() {
  // Perlin noise is not periodic, so a raw bake has hard value seams wherever
  // the texture wraps. Blend four shifted copies weighted by position so
  // texel 255 flows smoothly into texel 0 on both axes (seamless tile).
  noiseTexture = new Float32Array(NOISE_TEX_SIZE * NOISE_TEX_SIZE);
  const T = NOISE_TEX_TILE;
  for (let y = 0; y < NOISE_TEX_SIZE; y++) {
    const ny = (y / NOISE_TEX_SIZE) * T;
    const wy = y / NOISE_TEX_SIZE;
    for (let x = 0; x < NOISE_TEX_SIZE; x++) {
      const nx = (x / NOISE_TEX_SIZE) * T;
      const wx = x / NOISE_TEX_SIZE;
      const v =
        noise(nx, ny) * (1 - wx) * (1 - wy) +
        noise(nx - T, ny) * wx * (1 - wy) +
        noise(nx, ny - T) * (1 - wx) * wy +
        noise(nx - T, ny - T) * wx * wy;
      noiseTexture[y * NOISE_TEX_SIZE + x] = v * 2 - 1;
    }
  }
  if (CONFIG.equalizeNoiseTexture) {
    equalizeNoiseTextureValues();
  }
  measureCurlGradientMax();
}

// Peak gradient magnitude of the baked texture, sampled the same way the curl
// field samples it (same finite-difference step, same wrapped tile). Angle
// calibration divides by this to guarantee its deflection bound, so an
// underestimate would let the field bend further than the control claims.
//
// A plain grid scan is not enough: at 768 steps this misses the true peak that
// 512 and 1024 both find, because the peak sits between samples. So take the
// best cells from a coarse pass and refine inside each one.
function measureCurlGradientMax() {
  const T = NOISE_TEX_TILE;
  const h = CURL_NOISE_DIFF_STEP;
  const gradAt = (u, v) => {
    const du = (sampleNoiseTexture(u + h, v) - sampleNoiseTexture(u - h, v)) / (2 * h);
    const dv = (sampleNoiseTexture(u, v + h) - sampleNoiseTexture(u, v - h)) / (2 * h);
    return Math.sqrt(du * du + dv * dv);
  };

  const N = CURL_GRAD_SCAN_STEPS;
  const step = T / N;
  // Min-heap would be tidier, but the candidate list is tiny — a linear insert
  // into a sorted array of 32 beats the bookkeeping.
  const bestMag = new Float64Array(CURL_GRAD_REFINE_CELLS);
  const bestU = new Float64Array(CURL_GRAD_REFINE_CELLS);
  const bestV = new Float64Array(CURL_GRAD_REFINE_CELLS);
  for (let j = 0; j < N; j++) {
    const v = j * step;
    for (let i = 0; i < N; i++) {
      const u = i * step;
      const m = gradAt(u, v);
      if (m <= bestMag[CURL_GRAD_REFINE_CELLS - 1]) continue;
      let k = CURL_GRAD_REFINE_CELLS - 1;
      while (k > 0 && bestMag[k - 1] < m) {
        bestMag[k] = bestMag[k - 1];
        bestU[k] = bestU[k - 1];
        bestV[k] = bestV[k - 1];
        k--;
      }
      bestMag[k] = m;
      bestU[k] = u;
      bestV[k] = v;
    }
  }

  // Two rounds of local search around each candidate, each round shrinking the
  // window by 4x, so the final resolution is ~1/16 of a coarse cell.
  let peak = bestMag[0];
  for (let c = 0; c < CURL_GRAD_REFINE_CELLS; c++) {
    let cu = bestU[c];
    let cv = bestV[c];
    let mag = bestMag[c];
    let radius = step;
    for (let round = 0; round < 2; round++) {
      const sub = radius / 2;
      for (let j = -2; j <= 2; j++) {
        for (let i = -2; i <= 2; i++) {
          if (i === 0 && j === 0) continue;
          const u = cu + i * sub;
          const v = cv + j * sub;
          const m = gradAt(u, v);
          if (m > mag) { mag = m; cu = u; cv = v; }
        }
      }
      radius = sub;
    }
    if (mag > peak) peak = mag;
  }
  curlGradMax = peak > 1e-6 ? peak : 1;
}

// Histogram-equalize the baked texture: Perlin values cluster in a narrow bell
// around the midpoint, so a linear read (e.g. the curl angle lerp) only ever
// uses the middle of its range. Remapping each texel by its percentile rank
// spreads the values uniformly across [-1, 1] so the full range gets used.
// This is a monotonic remap, so it preserves both the seamless tiling and the
// smoothstep-interpolated continuity established above.
function equalizeNoiseTextureValues() {
  const n = noiseTexture.length;
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  // Sort indices by their texel value (ascending).
  Array.prototype.sort.call(order, (a, b) => noiseTexture[a] - noiseTexture[b]);
  const inv = n > 1 ? 2 / (n - 1) : 0;
  for (let r = 0; r < n; r++) {
    noiseTexture[order[r]] = r * inv - 1; // rank → uniform across [-1, 1]
  }
}

function sampleNoiseTexture(nx, ny) {
  // Map noise-space coords to tile-space [0,1), wrapping for seamless tiling.
  const tx = ((nx * NOISE_TEX_INV_TILE % 1) + 1) % 1;
  const ty = ((ny * NOISE_TEX_INV_TILE % 1) + 1) % 1;
  const sx = tx * NOISE_TEX_SIZE;
  const sy = ty * NOISE_TEX_SIZE;
  const x0 = floor(sx) & NOISE_TEX_SIZE_MASK;
  const y0 = floor(sy) & NOISE_TEX_SIZE_MASK;
  const x1 = (x0 + 1) & NOISE_TEX_SIZE_MASK;
  const y1 = (y0 + 1) & NOISE_TEX_SIZE_MASK;
  // Smoothstep the interpolation weights: plain bilinear is only C0, and its
  // slope kinks at every texel edge read as polygonal particle paths once the
  // curl field amplifies the value into an angle.
  let fx = sx - floor(sx);
  let fy = sy - floor(sy);
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const v00 = noiseTexture[y0 * NOISE_TEX_SIZE + x0];
  const v10 = noiseTexture[y0 * NOISE_TEX_SIZE + x1];
  const v01 = noiseTexture[y1 * NOISE_TEX_SIZE + x0];
  const v11 = noiseTexture[y1 * NOISE_TEX_SIZE + x1];
  return (v00 * (1 - fx) + v10 * fx) * (1 - fy) +
         (v01 * (1 - fx) + v11 * fx) * fy;
}

// --- Item 8: Sin lookup table (replaces per-particle Math.sin in dune warp) ---
const SIN_LUT_SIZE = 4096;
const SIN_LUT = new Float32Array(SIN_LUT_SIZE);
const SIN_LUT_FACTOR = SIN_LUT_SIZE / (2 * Math.PI);
(function initSinLUT() {
  for (let i = 0; i < SIN_LUT_SIZE; i++) {
    SIN_LUT[i] = Math.sin((i / SIN_LUT_SIZE) * 2 * Math.PI);
  }
})();

function fastSin(x) {
  // Map x to LUT index, wrapping for any input range.
  const i = ((x * SIN_LUT_FACTOR % SIN_LUT_SIZE) + SIN_LUT_SIZE) % SIN_LUT_SIZE;
  return SIN_LUT[i | 0]; // truncate to integer index
}

// --- Item 9: Bucket pool (reuses arrays to avoid per-frame GC from grid buckets) ---
const _bucketPool = [];
let _bucketPoolPtr = 0;

function acquireBucket() {
  if (_bucketPoolPtr < _bucketPool.length) {
    const b = _bucketPool[_bucketPoolPtr++];
    b.length = 0;
    return b;
  }
  const b = [];
  _bucketPool.push(b);
  _bucketPoolPtr++;
  return b;
}

function releaseBuckets() {
  _bucketPoolPtr = 0;
}

const _boidSteer = { x: 0, y: 0 };

let draggedBoxIndex = -1;
let dragOffsetX = 0;
let dragOffsetY = 0;
let controlsBound = false;
let manualScrollActive = false;
let scrollJustEnded = false;
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
// Interpolation nodes for the quality curve, not discrete states. The
// controller's level is a float in 0..1 that samples across these, so every
// point between two nodes is a reachable operating point. That is the whole
// difference from the old tier system: with only five reachable states, one
// step changed the workload by more than the controller's own tolerance band,
// so a machine whose true break-even fell between two of them could never
// settle and ping-ponged instead, visibly pulsing the particle density.
const QUALITY_CURVE = [
  { renderFractionMul: 1, minSpeedAdd: 0, pairMul: 1, candidateMul: 1, sepEveryAdd: 0 },
  { renderFractionMul: 0.86, minSpeedAdd: 0.03, pairMul: 0.85, candidateMul: 0.9, sepEveryAdd: 0 },
  { renderFractionMul: 0.7, minSpeedAdd: 0.08, pairMul: 0.68, candidateMul: 0.75, sepEveryAdd: 1 },
  { renderFractionMul: 0.55, minSpeedAdd: 0.13, pairMul: 0.52, candidateMul: 0.6, sepEveryAdd: 2 },
  { renderFractionMul: 0.4, minSpeedAdd: 0.18, pairMul: 0.38, candidateMul: 0.48, sepEveryAdd: 3 },
];
const qualityState = {
  // 0 = full quality, 1 = maximum degradation. This is the integral of the
  // frame-time error, which is why it converges: once frame time reaches the
  // budget the error is zero and the level simply stops moving.
  level: 0,
  avgFrameMs: 16.7,
  lastFrameMs: null,
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
  applyQualityLevel(0, true);
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
  if (fgGraphics) {
    fgGraphics.resizeCanvas(nextW, nextH);
  }
  if (inkBGraphics) {
    inkBGraphics.resizeCanvas(nextW, nextH);
  }
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
  applyQualityLevel(qualityState.level);
}

function applyQualityLevel(level, snap = false) {
  const clamped = constrain(level, 0, 1);
  qualityState.level = clamped;

  // Sample the curve piecewise-linearly. At level 1 the index lands exactly on
  // the last node, hence clamping the lower index one short of the end.
  const span = QUALITY_CURVE.length - 1;
  const pos = clamped * span;
  const i0 = min(floor(pos), span - 1);
  const t = pos - i0;
  const lo = QUALITY_CURVE[i0];
  const hi = QUALITY_CURVE[i0 + 1];
  const at = (key) => lo[key] + (hi[key] - lo[key]) * t;

  // Targets stay fractional. Flooring here would re-quantize the exact thing
  // the continuous level exists to smooth out; every consumer already floors
  // at read time, so the rounding happens once, at the point of use.
  const b = qualityState.baseline;
  qualityState.target.particleRenderFraction = constrain(
    b.particleRenderFraction * at('renderFractionMul'),
    0.01,
    1
  );
  qualityState.target.particleRenderMinSpeed = max(
    0,
    b.particleRenderMinSpeed + at('minSpeedAdd')
  );
  qualityState.target.maxSeparationPairsPerTick = max(
    1,
    b.maxSeparationPairsPerTick * at('pairMul')
  );
  qualityState.target.maxSeparationCandidatesPerCell = max(
    1,
    b.maxSeparationCandidatesPerCell * at('candidateMul')
  );
  qualityState.target.separationEveryNFrames = max(
    1,
    b.separationEveryNFrames + at('sepEveryAdd')
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
  const currentFadeAlpha = getCurrentBackgroundFadeAlpha();
  const currentParticleAlpha = getCurrentParticleAlpha();
  qualityState.hudEl.innerHTML =
    `<div>FPS ${fps.toFixed(1)} (Target ${targetFps.toFixed(0)}) | Avg Frame ${qualityState.avgFrameMs.toFixed(2)} ms | Quality ${qualityState.level.toFixed(3)}` +
    `${CONFIG.lockQualityLevel ? ' (locked)' : ''}` +
    ` | Render Fraction ${rf.toFixed(2)} | Separation Pair Budget ${pairs} | Particles ${particles.length}/${maxParticles}</div>` +
    `<div>Viewport ${viewportW}x${viewportH}px | Render Scale ${currentRenderScale.toFixed(2)}${autoScaleActive ? ' (auto)' : ''} | Internal Canvas ${internalW}x${internalH}px</div>` +
    `<div>Bg A ${currentFadeAlpha.toFixed(2)}${CONFIG.enableDualInkLayers ? ` | Bg B ${getCurrentBackgroundFadeAlphaB().toFixed(2)}` : ''} | P ${currentParticleAlpha.toFixed(2)}</div>`;
}

function tickAdaptiveQuality(nowMs) {
  if (qualityState.lastFrameMs === null) {
    qualityState.lastFrameMs = nowMs;
    paintQualityHud(nowMs);
    return;
  }

  const dt = constrain(nowMs - qualityState.lastFrameMs, 1, 120);
  qualityState.lastFrameMs = nowMs;
  qualityState.avgFrameMs += (dt - qualityState.avgFrameMs) * 0.08;

  if (!CONFIG.enableAdaptiveQuality) {
    // Release back to full quality rather than freezing wherever the level
    // happened to be. Frame time keeps being measured so the HUD stays honest.
    applyQualityLevel(0);
  } else if (!CONFIG.lockQualityLevel) {
    const targetFrameMs = 1000 / max(1, CONFIG.qualityTargetFps);
    // Fractional overshoot: +0.5 is frames taking half again as long as their
    // budget. Normalizing by the budget is what lets one pair of rate controls
    // mean the same thing at any target framerate.
    const err = (qualityState.avgFrameMs - targetFrameMs) / targetFrameMs;
    // Deadband guards the degrade direction only. Recovery gets none: a display
    // pinned by vsync can sit a hair under target indefinitely, and a symmetric
    // band would strand the piece at reduced quality on a machine with headroom
    // to spare. Proportional rate stops recovery at zero error by itself.
    if (err > max(0, CONFIG.qualityDeadband) || err < 0) {
      const rate = err > 0 ? CONFIG.qualityDegradeRate : CONFIG.qualityRecoverRate;
      // Error is clamped so one pathological frame can move the level by at
      // most a rate-second, instead of slamming it to a stop. Near equilibrium
      // the error is small anyway, so the step shrinks to nothing on its own —
      // that self-braking is what replaces the old cooldown timer.
      const step = constrain(err, -1, 1) * max(0, rate) * dt * 0.001;
      applyQualityLevel(qualityState.level + step);
    }
  }

  smoothQualityEffective(dt);
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
  mainCanvasElt = canvas.elt;
  ensureInkLayerB();
  ensureForegroundLayer();
  applyCanvasLayerVisibility();
  applyWordShadowStyle();
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
  bakeNoiseTexture();
  initQualityManager();
  ensureQualityHud();
  ensureFlowBoxOverlay();
  if (!simulationVisibilityListenerBound) {
    document.addEventListener('visibilitychange', applySimulationPauseState);
    simulationVisibilityListenerBound = true;
  }
  applySimulationPauseState();

  simTimeMs = millis();
  simLastFrameMs = null;
  simAccumulatorMs = 0;
  simStepCount = 0;
  simRenderAlpha = 1;

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
  };

  window.getScrollFreezeDebounceMs = function getScrollFreezeDebounceMs() {
    return CONFIG.scrollFreezeDebounceMs;
  };
}

function draw() {
  const nowMs = millis();
  // Drive auto-scroll from the same frame as the particle sim.
  if (typeof window.__mournTickAutoScroll === 'function') {
    window.__mournTickAutoScroll(nowMs);
  }
  tickAdaptiveQuality(nowMs);
  if (simLastFrameMs === null) {
    simLastFrameMs = nowMs;
  }
  let frameDeltaMs = nowMs - simLastFrameMs;
  simLastFrameMs = nowMs;
  frameDeltaMs = constrain(frameDeltaMs, 0, SIM_MAX_FRAME_DELTA_MS);
  const dtFrames = constrain(frameDeltaMs / SIM_FIXED_STEP_MS, 0, 3);
  simTimeMs = nowMs;
  simStepCount += 1;
  renderDuneDebugLayer(nowMs);
  renderFlowArrowLayer(nowMs);
  fadeCanvas();
  updateBoxes(dtFrames);
  updateActiveBoxes();
  eraseInkUnderBoxes();
  updateParticles(nowMs, simStepCount, true, dtFrames);
  renderParticles(dtFrames);
  renderBoxes();
}

function windowResized() {
  applyRenderScale(getActiveRenderScale());
}

// Show/hide each canvas independently (visibility, not display, so it
// composes with the foreground layer's own display toggling). The simulation
// and rendering keep running either way — these are design-inspection knobs.
function applyCanvasLayerVisibility() {
  if (mainCanvasElt) {
    mainCanvasElt.style.visibility = CONFIG.showBackgroundCanvas ? '' : 'hidden';
  }
  if (inkBGraphics) {
    inkBGraphics.canvas.style.visibility = CONFIG.showBackgroundCanvasB ? '' : 'hidden';
  }
  if (fgGraphics) {
    fgGraphics.canvas.style.visibility = CONFIG.showForegroundCanvas ? '' : 'hidden';
  }
}

// --- Dune debug overlay -----------------------------------------------------
// Greyscale picture of the dune signal: black in the troughs, white on the
// crests. It shows exactly the value particles read for their dune alpha/size
// boost, so where it is white is where they brighten and widen.
//
// Mounted on <body>, not inside #poem-bg: that wrapper has z-index 0, which
// makes it a stacking context its children can never escape. Sitting on top of
// the ink, the poem and the vignette means the field can be read against live
// particles, which is the whole point — hence the opacity control.
//
// Drawn into a deliberately tiny backing store and stretched to the viewport by
// CSS. The dune bands are very low frequency (one cycle every
// 2*PI*duneBandScale px, ~630px at the default 100), so a texel every 6px is
// heavy oversampling, and the browser's own smoothing on the upscale gives a
// cleaner gradient than drawing it at full resolution would.
const DUNE_DEBUG_TEXEL_PX = 6;
// Field value where bands are switched off: the flat multiplier of 1 pushed
// back through the same (m - 0.25) / 0.95 normalisation the particles use.
const DUNE_DEBUG_FLAT_SIGNAL = (1 - 0.25) / 0.95;

let duneDebugCanvas = null;
let duneDebugCtx = null;
let duneDebugImage = null;
let duneDebugAppliedOpacity = -1;

function ensureDuneDebugLayer() {
  if (duneDebugCanvas) return;
  duneDebugCanvas = document.createElement('canvas');
  duneDebugCanvas.id = 'dune-debug-canvas';
  duneDebugCanvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(duneDebugCanvas);
  duneDebugCtx = duneDebugCanvas.getContext('2d');
}

function renderDuneDebugLayer(nowMs) {
  if (!CONFIG.showDuneDebugLayer) {
    if (duneDebugCanvas) duneDebugCanvas.style.display = 'none';
    return;
  }
  ensureDuneDebugLayer();
  if (!duneDebugCtx) return;
  duneDebugCanvas.style.display = 'block';

  // Only touch the style when it actually changes — an every-frame write would
  // invalidate style on an element that covers the whole viewport.
  const opacity = constrain(CONFIG.duneDebugOpacity, 0, 1);
  if (opacity !== duneDebugAppliedOpacity) {
    duneDebugCanvas.style.opacity = String(opacity);
    duneDebugAppliedOpacity = opacity;
  }

  const cols = max(1, ceil(width / DUNE_DEBUG_TEXEL_PX));
  const rows = max(1, ceil(height / DUNE_DEBUG_TEXEL_PX));
  if (duneDebugCanvas.width !== cols || duneDebugCanvas.height !== rows) {
    duneDebugCanvas.width = cols;
    duneDebugCanvas.height = rows;
    duneDebugImage = duneDebugCtx.createImageData(cols, rows);
  }

  const data = duneDebugImage.data;

  if (!CONFIG.enableDuneBands) {
    const flat = round(constrain(DUNE_DEBUG_FLAT_SIGNAL, 0, 1) * 255);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = flat;
      data[i + 1] = flat;
      data[i + 2] = flat;
      data[i + 3] = 255;
    }
    duneDebugCtx.putImageData(duneDebugImage, 0, 0);
    return;
  }

  // Same drift-shifted axes as sampleDuneWindForceXY, hoisted out of the loop.
  const windAngle = radians(CONFIG.ambientWindDirectionDeg);
  const driftPixels = nowMs * 0.001 * CONFIG.duneDriftSpeed * 240;
  const originX = -cos(windAngle) * driftPixels;
  const originY = -sin(windAngle) * driftPixels;
  const duneBandAngle = radians(CONFIG.duneBandRotationDeg);
  const duneDirX = cos(duneBandAngle);
  const duneDirY = sin(duneBandAngle);
  const dunePerpX = -duneDirY;
  const dunePerpY = duneDirX;

  // along/across are linear in x and y, so stepping a texel is a single add.
  const alongPerCol = DUNE_DEBUG_TEXEL_PX * duneDirX;
  const alongPerRow = DUNE_DEBUG_TEXEL_PX * duneDirY;
  const acrossPerCol = DUNE_DEBUG_TEXEL_PX * dunePerpX;
  const acrossPerRow = DUNE_DEBUG_TEXEL_PX * dunePerpY;
  let alongRow = originX * duneDirX + originY * duneDirY;
  let acrossRow = originX * dunePerpX + originY * dunePerpY + CONFIG.duneBandOffsetPx;

  const contrast = CONFIG.duneContrast;
  const isLinear = contrast === 1;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    let along = alongRow;
    let across = acrossRow;
    for (let c = 0; c < cols; c++) {
      const ridge01 = (fastSin(duneWarpedAcross(along, across)) + 1) * 0.5;
      const signal = isLinear ? ridge01 : pow(ridge01, contrast);
      const v = signal * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
      i += 4;
      along += alongPerCol;
      across += acrossPerCol;
    }
    alongRow += alongPerRow;
    acrossRow += acrossPerRow;
  }

  duneDebugCtx.putImageData(duneDebugImage, 0, 0);
}

// --- Flow arrow overlay -----------------------------------------------------
// Quiver plot of the total flow field — the same vector sampleDuneWindForceXY
// hands each particle, so it includes wind, dune banding, ridge attraction,
// micro turbulence and the curl mix together. Arrows show the curl's eddy size
// and shape directly, which a greyscale of any single term cannot.
//
// Colour encodes alignment with the ambient wind, because "which way is this
// actually pushing things" is the question the field is hardest to eyeball:
// cyan runs downwind, amber crosswind, red upwind. Red marks the regions that
// drive particles back against the wind.
const FLOW_ARROW_BUCKETS = 11;
const FLOW_ARROW_MIN_SPACING = 8;
const FLOW_ARROW_UPWIND = [255, 59, 48];
const FLOW_ARROW_CROSS = [255, 228, 172];
const FLOW_ARROW_DOWNWIND = [102, 204, 255];

let flowArrowCanvas = null;
let flowArrowCtx = null;
let flowArrowField = null;
let flowArrowPalette = null;

function buildFlowArrowPalette() {
  const lerpByte = (a, b, t) => round(a + (b - a) * t);
  const out = [];
  for (let i = 0; i < FLOW_ARROW_BUCKETS; i++) {
    // bucket -> alignment in -1..1
    const a = (i / (FLOW_ARROW_BUCKETS - 1)) * 2 - 1;
    const from = FLOW_ARROW_CROSS;
    const to = a >= 0 ? FLOW_ARROW_DOWNWIND : FLOW_ARROW_UPWIND;
    const t = a >= 0 ? a : -a;
    out.push(`rgb(${lerpByte(from[0], to[0], t)}, ${lerpByte(from[1], to[1], t)}, ${lerpByte(from[2], to[2], t)})`);
  }
  return out;
}

function ensureFlowArrowLayer() {
  if (flowArrowCanvas) return;
  flowArrowCanvas = document.createElement('canvas');
  flowArrowCanvas.id = 'flow-arrows-canvas';
  flowArrowCanvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(flowArrowCanvas);
  flowArrowCtx = flowArrowCanvas.getContext('2d');
  flowArrowPalette = buildFlowArrowPalette();
}

function renderFlowArrowLayer(nowMs) {
  if (!CONFIG.showFlowArrows) {
    if (flowArrowCanvas) flowArrowCanvas.style.display = 'none';
    return;
  }
  ensureFlowArrowLayer();
  if (!flowArrowCtx) return;
  flowArrowCanvas.style.display = 'block';

  if (flowArrowCanvas.width !== width || flowArrowCanvas.height !== height) {
    flowArrowCanvas.width = width;
    flowArrowCanvas.height = height;
  }

  const spacing = max(FLOW_ARROW_MIN_SPACING, round(CONFIG.flowArrowSpacing));
  const cols = max(1, floor(width / spacing));
  const rows = max(1, floor(height / spacing));
  const needed = cols * rows * 2;
  if (!flowArrowField || flowArrowField.length < needed) {
    flowArrowField = new Float32Array(needed);
  }

  // Sample first, draw second: arrow length is scaled against the strongest
  // vector on screen, so the plot stays readable at any wind strength instead
  // of collapsing to dots or overshooting into a solid mat.
  const fc = buildFrameCache(nowMs);
  const originX = spacing * 0.5;
  const originY = spacing * 0.5;
  let maxMag = 0;
  let w = 0;
  for (let r = 0; r < rows; r++) {
    const py = originY + r * spacing;
    for (let c = 0; c < cols; c++) {
      const res = sampleDuneWindForceXY(originX + c * spacing, py, fc);
      flowArrowField[w] = res.x;
      flowArrowField[w + 1] = res.y;
      const mag = Math.hypot(res.x, res.y);
      if (mag > maxMag) maxMag = mag;
      w += 2;
    }
  }

  const ctx = flowArrowCtx;
  ctx.clearRect(0, 0, flowArrowCanvas.width, flowArrowCanvas.height);
  if (maxMag <= 1e-9) return;

  // One path per colour bucket, so the whole plot is a handful of strokes
  // rather than a thousand.
  const paths = [];
  for (let i = 0; i < FLOW_ARROW_BUCKETS; i++) paths.push(new Path2D());

  const maxLen = spacing * 0.46;
  const headLen = min(4.5, maxLen * 0.4);
  const windX = fc.windDirX;
  const windY = fc.windDirY;
  let readIndex = 0;
  for (let r = 0; r < rows; r++) {
    const py = originY + r * spacing;
    for (let c = 0; c < cols; c++) {
      const fx = flowArrowField[readIndex];
      const fy = flowArrowField[readIndex + 1];
      readIndex += 2;
      const mag = Math.hypot(fx, fy);
      if (mag <= 1e-9) continue;
      const ux = fx / mag;
      const uy = fy / mag;
      const len = (mag / maxMag) * maxLen;
      const px = originX + c * spacing;
      // Centred on the sample point so the grid stays visually even.
      const baseX = px - ux * len * 0.5;
      const baseY = py - uy * len * 0.5;
      const tipX = px + ux * len * 0.5;
      const tipY = py + uy * len * 0.5;

      const align = constrain(ux * windX + uy * windY, -1, 1);
      const bucket = constrain(
        round((align + 1) * 0.5 * (FLOW_ARROW_BUCKETS - 1)), 0, FLOW_ARROW_BUCKETS - 1
      );
      const path = paths[bucket];
      path.moveTo(baseX, baseY);
      path.lineTo(tipX, tipY);
      // Barbs at +/-150 degrees from the heading.
      const h = min(headLen, len * 0.55);
      if (h > 0.6) {
        const cosA = -0.866, sinA = 0.5;
        path.moveTo(tipX, tipY);
        path.lineTo(tipX + (ux * cosA - uy * sinA) * h, tipY + (ux * sinA + uy * cosA) * h);
        path.moveTo(tipX, tipY);
        path.lineTo(tipX + (ux * cosA + uy * sinA) * h, tipY + (-ux * sinA + uy * cosA) * h);
      }
    }
  }

  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.globalAlpha = constrain(CONFIG.flowArrowOpacity, 0, 1);
  for (let i = 0; i < FLOW_ARROW_BUCKETS; i++) {
    ctx.strokeStyle = flowArrowPalette[i];
    ctx.stroke(paths[i]);
  }
  ctx.globalAlpha = 1;
}

function ensureInkLayerB() {
  if (inkBGraphics) return;
  inkBGraphics = createGraphics(width, height);
  const mount = document.getElementById('poem-bg');
  if (mount) {
    mount.appendChild(inkBGraphics.canvas);
  }
  inkBGraphics.canvas.style.display = 'block';
}

// Words separate themselves from accumulated ink with a glyph-shaped
// drop shadow in the fade color. drop-shadow (not text-shadow) because the
// spans use background-clip: text with a transparent fill — text-shadow
// would bleed through the transparent glyphs.
function applyWordShadowStyle() {
  const root = document.documentElement;
  if (!CONFIG.enableWordShadow) {
    root.style.setProperty('--word-shadow', 'none');
    return;
  }
  const blur = max(0, CONFIG.wordShadowBlur);
  const opacity = constrain(CONFIG.wordShadowOpacity, 0, 1);
  const c = `rgba(${RENDER_COLORS.fade[0]}, ${RENDER_COLORS.fade[1]}, ${RENDER_COLORS.fade[2]}, ${opacity})`;
  root.style.setProperty(
    '--word-shadow',
    `drop-shadow(0 0 ${blur}px ${c}) drop-shadow(0 0 ${blur * 2.5}px ${c})`
  );
}

function ensureForegroundLayer() {
  if (fgGraphics) return;
  fgGraphics = createGraphics(width, height);
  const mount = document.getElementById('poem-bg');
  if (mount) {
    mount.appendChild(fgGraphics.canvas);
  }
  // #poem-bg canvas CSS handles position/size; p5 leaves graphics hidden.
  fgGraphics.canvas.style.display = 'block';
}

// Erase alpha (destination-out) instead of painting the background color —
// all three canvases stay transparent so they stack over the page backdrop.
function applyAlphaErase(ctx, alphaByte, w, h) {
  if (alphaByte <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0, 0, 0, ${alphaByte / 255})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function fadeCanvas() {
  applyAlphaErase(drawingContext, getCurrentBackgroundFadeAlpha(), width, height);
  if (inkBGraphics) {
    if (CONFIG.enableDualInkLayers) {
      if (inkBGraphics.canvas.style.display === 'none') {
        inkBGraphics.canvas.style.display = 'block';
      }
      applyAlphaErase(
        inkBGraphics.drawingContext,
        getCurrentBackgroundFadeAlphaB(),
        inkBGraphics.width,
        inkBGraphics.height
      );
    } else if (inkBGraphics.canvas.style.display !== 'none') {
      inkBGraphics.clear();
      inkBGraphics.canvas.style.display = 'none';
    }
  }
  if (!fgGraphics) return;
  if (CONFIG.enableForegroundLayer) {
    if (fgGraphics.canvas.style.display === 'none') {
      fgGraphics.canvas.style.display = 'block';
    }
    applyAlphaErase(
      fgGraphics.drawingContext,
      clampColorByte(CONFIG.foregroundTrailAlpha),
      fgGraphics.width,
      fgGraphics.height
    );
  } else if (fgGraphics.canvas.style.display !== 'none') {
    fgGraphics.clear();
    fgGraphics.canvas.style.display = 'none';
  }
}

// Word colliders act as squeegees: each frame they erase the ink alpha over
// their footprint so persistent ink is carved away rather than left behind.
// Soft edges come from stacked concentric layers, each removing a fraction
// of the erase alpha — the innermost region receives every coat.
function eraseInkUnderBoxes() {
  if (!CONFIG.enableBoxInkErase) return;
  const eraseAlpha = clampColorByte(CONFIG.boxInkEraseAlpha);
  if (eraseAlpha <= 0) return;
  const pad = max(0, CONFIG.boxInkErasePadding);
  const softness = max(0, CONFIG.boxInkEraseSoftness);
  const layers = softness > 0 ? 4 : 1;
  const layerAlpha = eraseAlpha / layers / 255;
  const targets = [drawingContext];
  if (inkBGraphics && CONFIG.enableDualInkLayers) {
    targets.push(inkBGraphics.drawingContext);
  }
  for (let t = 0; t < targets.length; t++) {
    const ctx = targets[t];
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0, 0, 0, ${layerAlpha})`;
    for (let i = 0; i < activeBoxes.length; i++) {
      const box = activeBoxes[i];
      const displayBox = getInterpolatedBoxPosition(box);
      for (let layer = 0; layer < layers; layer++) {
        const inflate = pad + (layers > 1 ? softness * (1 - layer / (layers - 1)) : 0);
        ctx.beginPath();
        ctx.roundRect(
          displayBox.x - inflate,
          displayBox.y - inflate,
          box.w + inflate * 2,
          box.h + inflate * 2,
          inflate + 2
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function getCurrentBackgroundFadeAlpha() {
  return max(clampColorByte(CONFIG.trailAlpha), getBackgroundPulseAlpha(0));
}

function getCurrentBackgroundFadeAlphaB() {
  return max(
    clampColorByte(CONFIG.trailAlpha),
    getBackgroundPulseAlpha(clamp01(CONFIG.inkLayerPhaseOffset))
  );
}

// Pulse wipe: the fade follows the user-authored keyframe curve across each
// period — flat stretches let trails accumulate, spikes erase the canvas.
// Curve y maps directly to fade alpha (1.0 = full 255 wipe).
// Scrub offset set by dragging the playhead in the curve editor — shifts
// where the pulse cycle currently sits without touching the curve itself.
let pulsePhaseOffsetSec = 0;

function getPulsePhase(periodSec) {
  const phase = ((millis() * 0.001 + pulsePhaseOffsetSec) / periodSec) % 1;
  return phase < 0 ? phase + 1 : phase;
}

function getBackgroundPulseAlpha(phaseOffset01 = 0) {
  const periodSec = CONFIG.backgroundPulsePeriodSec;
  if (!(periodSec > 0)) return 0;
  return 255 * samplePulseCurve((getPulsePhase(periodSec) + phaseOffset01) % 1);
}

// Unity-style keyframe editor for the pulse curve: drag points, click empty
// space to add one, double-click a point to remove it. Endpoints are pinned
// to phase 0 and 1 so the cycle stays closed.
function setupPulseCurveEditor(panel) {
  const canvas = panel.querySelector('#pulse-curve-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const PAD = 10;
  let points = parsePulseCurve(CONFIG.backgroundPulseCurve);
  let dragIndex = -1;
  let draggingPlayhead = false;

  const playheadPx = () => {
    const periodSec = CONFIG.backgroundPulsePeriodSec;
    if (!(periodSec > 0)) return null;
    return PAD + getPulsePhase(periodSec) * (canvas.width - PAD * 2);
  };
  const scrubToPhase = (phase01) => {
    const periodSec = CONFIG.backgroundPulsePeriodSec;
    if (!(periodSec > 0)) return;
    pulsePhaseOffsetSec = phase01 * periodSec - millis() * 0.001;
  };

  // Undo/redo (cmd/ctrl+z, cmd/ctrl+shift+z) — one history entry per
  // completed gesture: a full drag, an add, a delete, or a reset.
  const undoStack = [];
  const redoStack = [];
  let gestureStartCurve = null;
  const pushHistory = (prevCurve) => {
    undoStack.push(prevCurve);
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  };
  const applyCurveString = (str) => {
    CONFIG.backgroundPulseCurve = str;
    points = parsePulseCurve(str);
    syncUrlParamsFromConfig();
    syncPointRows();
  };
  const undoCurve = () => {
    if (!undoStack.length) return;
    redoStack.push(CONFIG.backgroundPulseCurve);
    applyCurveString(undoStack.pop());
  };
  const redoCurve = () => {
    if (!redoStack.length) return;
    undoStack.push(CONFIG.backgroundPulseCurve);
    applyCurveString(redoStack.pop());
  };
  window.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName) && t.type === 'text')) return;
    e.preventDefault();
    if (e.shiftKey) redoCurve(); else undoCurve();
  });

  // Alpha at the top of the canvas. Keyframes are stored in real 0..1 alpha
  // units regardless — this only rescales the drawing/dragging mapping, so a
  // lower ceiling buys precision without changing what any curve means.
  const curveMaxY = () => constrain(CONFIG.backgroundPulseCurveMaxY, 0.05, 1);
  const toPx = (p) => ({
    x: PAD + p.x * (canvas.width - PAD * 2),
    // Clamp so a curve loaded from a URL above the ceiling pins to the top
    // edge instead of drawing off-canvas.
    y: canvas.height - PAD - constrain(p.y / curveMaxY(), 0, 1) * (canvas.height - PAD * 2),
  });
  const toCurve = (px, py) => ({
    x: constrain((px - PAD) / (canvas.width - PAD * 2), 0, 1),
    y: constrain((canvas.height - PAD - py) / (canvas.height - PAD * 2), 0, 1) * curveMaxY(),
  });
  const eventPos = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  };
  const hitTest = (px, py) => {
    for (let i = 0; i < points.length; i++) {
      const p = toPx(points[i]);
      if ((p.x - px) ** 2 + (p.y - py) ** 2 <= 14 ** 2) return i;
    }
    return -1;
  };
  const commit = () => {
    CONFIG.backgroundPulseCurve = serializePulseCurve(points);
    syncUrlParamsFromConfig();
    syncPointRows();
  };

  // Numeric mirror of the keyframes, for values too fine to hit by dragging.
  // Two-way: edits here move the anchors, and drags/adds/removes on the canvas
  // rewrite these fields. Rows are rebuilt only when the anchor count changes
  // so typing is never interrupted by a rebuild.
  const pointsList = panel.querySelector('#pulse-curve-points');
  let pointRowsSignature = null;
  let editStartCurve = null;

  const applyPointEdit = (index, axis, raw) => {
    const v = Number(raw);
    if (!Number.isFinite(v) || !points[index]) return;
    if (axis === 'y') {
      points[index].y = clamp01(v);
    } else {
      // Endpoints stay at 0 and 1; interior anchors keep the same minimum
      // separation the drag path enforces, so the curve can't fold over.
      if (index === 0 || index === points.length - 1) return;
      points[index].x = constrain(
        v,
        points[index - 1].x + 0.005,
        points[index + 1].x - 0.005
      );
    }
    commit();
  };

  const buildPointRows = () => {
    pointsList.textContent = '';
    for (let i = 0; i < points.length; i++) {
      const isEndpoint = i === 0 || i === points.length - 1;
      const row = document.createElement('div');
      row.className = 'curve-point-row';
      const label = document.createElement('span');
      label.textContent = i + 1;
      row.appendChild(label);
      for (const axis of ['x', 'y']) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '1';
        input.step = '0.001';
        input.dataset.axis = axis;
        if (axis === 'x' && isEndpoint) {
          input.disabled = true;
          input.title = 'Endpoint phase is pinned so the cycle stays closed.';
        }
        // One undo entry per edit session, matching how a drag gesture behaves.
        input.addEventListener('focus', () => {
          editStartCurve = CONFIG.backgroundPulseCurve;
        });
        input.addEventListener('input', () => applyPointEdit(i, axis, input.value));
        input.addEventListener('change', () => {
          applyPointEdit(i, axis, input.value);
          // Show the clamped result rather than whatever was typed.
          if (points[i]) input.value = points[i][axis].toFixed(3);
        });
        input.addEventListener('blur', () => {
          if (editStartCurve !== null && editStartCurve !== CONFIG.backgroundPulseCurve) {
            pushHistory(editStartCurve);
          }
          editStartCurve = null;
        });
        row.appendChild(input);
      }
      // Mirrors the canvas double-click delete. Endpoints keep a hidden button
      // so every row stays on the same grid.
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'curve-point-remove';
      remove.textContent = '×';
      if (isEndpoint) {
        remove.disabled = true;
        remove.tabIndex = -1;
        remove.setAttribute('aria-hidden', 'true');
      } else {
        remove.title = 'Remove this anchor';
        remove.setAttribute('aria-label', `Remove anchor ${i + 1}`);
        remove.addEventListener('click', () => {
          if (i <= 0 || i >= points.length - 1) return;
          pushHistory(CONFIG.backgroundPulseCurve);
          points.splice(i, 1);
          commit();
        });
      }
      row.appendChild(remove);
      pointsList.appendChild(row);
    }
  };

  function syncPointRows() {
    if (!pointsList) return;
    const signature = serializePulseCurve(points);
    if (signature === pointRowsSignature) return;
    pointRowsSignature = signature;
    if (pointsList.childElementCount !== points.length) {
      buildPointRows();
    }
    for (let i = 0; i < points.length; i++) {
      const inputs = pointsList.children[i].querySelectorAll('input');
      for (const input of inputs) {
        // Never clobber the field being typed into.
        if (input !== document.activeElement) {
          input.value = points[i][input.dataset.axis].toFixed(3);
        }
      }
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    const pos = eventPos(e);
    let idx = hitTest(pos.x, pos.y);
    // Keyframes win over the playhead; otherwise a nearby playhead is grabbed
    // as a scrubber instead of adding a new point.
    if (idx < 0) {
      const ph = playheadPx();
      if (ph !== null && Math.abs(pos.x - ph) <= 8) {
        draggingPlayhead = true;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }
    gestureStartCurve = CONFIG.backgroundPulseCurve;
    if (idx < 0) {
      const cp = toCurve(pos.x, pos.y);
      idx = points.findIndex((p) => p.x > cp.x);
      if (idx <= 0) return; // clicks left of the first point are ignored
      points.splice(idx, 0, cp);
      commit();
    }
    dragIndex = idx;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const pos = eventPos(e);
    if (draggingPlayhead) {
      scrubToPhase(toCurve(pos.x, pos.y).x);
      return;
    }
    if (dragIndex < 0) {
      // Hover affordances: resize cursor near the playhead, grab near a point.
      const ph = playheadPx();
      if (hitTest(pos.x, pos.y) >= 0) {
        canvas.style.cursor = 'grab';
      } else if (ph !== null && Math.abs(pos.x - ph) <= 8) {
        canvas.style.cursor = 'ew-resize';
      } else {
        canvas.style.cursor = 'crosshair';
      }
      return;
    }
    const cp = toCurve(pos.x, pos.y);
    const p = points[dragIndex];
    p.y = cp.y;
    if (dragIndex > 0 && dragIndex < points.length - 1) {
      p.x = constrain(cp.x, points[dragIndex - 1].x + 0.005, points[dragIndex + 1].x - 0.005);
    }
    commit();
  });
  const endDrag = () => {
    dragIndex = -1;
    draggingPlayhead = false;
    if (gestureStartCurve !== null && gestureStartCurve !== CONFIG.backgroundPulseCurve) {
      pushHistory(gestureStartCurve);
    }
    gestureStartCurve = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('dblclick', (e) => {
    const pos = eventPos(e);
    const idx = hitTest(pos.x, pos.y);
    if (idx > 0 && idx < points.length - 1) {
      pushHistory(CONFIG.backgroundPulseCurve);
      points.splice(idx, 1);
      commit();
    }
  });

  const resetBtn = panel.querySelector('#pulse-curve-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (CONFIG.backgroundPulseCurve !== CONFIG_DEFAULTS.backgroundPulseCurve) {
        pushHistory(CONFIG.backgroundPulseCurve);
      }
      points = parsePulseCurve(CONFIG_DEFAULTS.backgroundPulseCurve);
      commit();
    });
  }

  const render = () => {
    // Re-pull points if the curve changed externally (URL load, reset).
    if (serializePulseCurve(points) !== CONFIG.backgroundPulseCurve) {
      points = parsePulseCurve(CONFIG.backgroundPulseCurve);
      syncPointRows();
    }
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(245, 222, 179, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gx = PAD + (i / 4) * (w - PAD * 2);
      ctx.beginPath(); ctx.moveTo(gx, PAD); ctx.lineTo(gx, h - PAD); ctx.stroke();
    }
    for (let i = 0; i <= 2; i++) {
      const gy = PAD + (i / 2) * (h - PAD * 2);
      ctx.beginPath(); ctx.moveTo(PAD, gy); ctx.lineTo(w - PAD, gy); ctx.stroke();
    }
    // Axis labels. The canvas is displayed at half its internal resolution,
    // so the font is sized 2x for crispness.
    ctx.fillStyle = 'rgba(245, 222, 179, 0.5)';
    ctx.font = '18px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('time →', w - PAD - 6, h - PAD - 4);
    ctx.save();
    ctx.translate(PAD + 4, PAD + 6);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    // Label the ceiling so the zoom level is readable off the axis itself.
    ctx.fillText(`alpha → ${curveMaxY().toFixed(2)}`, 0, 0);
    ctx.restore();
    // Curve, sampled from the same LUT the simulation uses.
    ctx.beginPath();
    for (let i = 0; i <= 128; i++) {
      const x = i / 128;
      const p = toPx({ x, y: samplePulseCurve(x) });
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = '#ffd98a';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < points.length; i++) {
      const p = toPx(points[i]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = i === dragIndex ? '#ffffff' : '#ffd98a';
      ctx.fill();
    }
    // Ghost playhead for ink canvas B's phase-offset wipe (not draggable).
    if (CONFIG.enableDualInkLayers && CONFIG.backgroundPulsePeriodSec > 0) {
      const phaseB = (getPulsePhase(CONFIG.backgroundPulsePeriodSec) + clamp01(CONFIG.inkLayerPhaseOffset)) % 1;
      const pbx = PAD + phaseB * (w - PAD * 2);
      ctx.strokeStyle = 'rgba(120, 170, 255, 0.35)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pbx, PAD); ctx.lineTo(pbx, h - PAD); ctx.stroke();
    }
    // Playhead drawn last so it rides on top — draggable to scrub the cycle.
    const px = playheadPx();
    if (px !== null) {
      ctx.strokeStyle = draggingPlayhead ? 'rgba(255, 130, 110, 0.9)' : 'rgba(255, 100, 80, 0.55)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, PAD); ctx.lineTo(px, h - PAD); ctx.stroke();
      // Grab handle at the top of the line.
      ctx.beginPath();
      ctx.arc(px, PAD, 5, 0, Math.PI * 2);
      ctx.fillStyle = draggingPlayhead ? '#ffffff' : 'rgba(255, 100, 80, 0.9)';
      ctx.fill();
    }
    requestAnimationFrame(render);
  };
  syncPointRows();
  requestAnimationFrame(render);
}

// NOTE: the curve helpers below must not use p5 globals (constrain/floor/…)
// because parsePulseCurve runs from applyConfigFromUrlParams at script-eval
// time, before p5 binds its global functions.
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function parsePulseCurve(str) {
  const pts = [];
  if (typeof str === 'string') {
    for (const seg of str.split('|')) {
      const parts = seg.split(',');
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        pts.push({ x: clamp01(x), y: clamp01(y) });
      }
    }
  }
  if (pts.length < 2) {
    return [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  }
  pts.sort((a, b) => a.x - b.x);
  pts[0].x = 0;
  pts[pts.length - 1].x = 1;
  return pts;
}

function serializePulseCurve(pts) {
  return pts.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join('|');
}

// Monotone cubic Hermite (Fritsch–Carlson) baked into a LUT — smooth between
// keyframes with no overshoot, so the wipe strength never undershoots zero.
const _pulseCurveLut = { source: null, table: new Float32Array(256) };

function samplePulseCurve(phase01) {
  if (_pulseCurveLut.source !== CONFIG.backgroundPulseCurve) {
    bakePulseCurveLut();
  }
  const t = clamp01(phase01) * 255;
  const i = Math.floor(t);
  const frac = t - i;
  const table = _pulseCurveLut.table;
  return table[i] + (table[Math.min(255, i + 1)] - table[i]) * frac;
}

function bakePulseCurveLut() {
  const pts = parsePulseCurve(CONFIG.backgroundPulseCurve);
  const n = pts.length;
  const delta = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = Math.max(1e-6, pts[i + 1].x - pts[i].x);
    delta.push((pts[i + 1].y - pts[i].y) / dx);
  }
  const m = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) * 0.5;
  }
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * delta[i];
      m[i + 1] = tau * b * delta[i];
    }
  }
  const table = _pulseCurveLut.table;
  let seg = 0;
  for (let k = 0; k < 256; k++) {
    const x = k / 255;
    while (seg < n - 2 && x > pts[seg + 1].x) seg++;
    const x0 = pts[seg].x;
    const x1 = pts[seg + 1].x;
    const h = Math.max(1e-6, x1 - x0);
    const t = clamp01((x - x0) / h);
    const t2 = t * t;
    const t3 = t2 * t;
    const y =
      pts[seg].y * (2 * t3 - 3 * t2 + 1) +
      m[seg] * h * (t3 - 2 * t2 + t) +
      pts[seg + 1].y * (-2 * t3 + 3 * t2) +
      m[seg + 1] * h * (t3 - t2);
    table[k] = clamp01(y);
  }
  _pulseCurveLut.source = CONFIG.backgroundPulseCurve;
}

function getCurrentParticleAlpha() {
  return clampColorByte(RENDER_COLORS.particles.length > 3 ? RENDER_COLORS.particles[3] : 255);
}

function setupDuneControls() {
  if (controlsBound) return;

  const panel = document.getElementById('dune-controls');
  if (!panel) return;

  controlsBound = true;
  applyControlTooltips(panel);
  setupPulseCurveEditor(panel);
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

  const constantInkExponentInput = panel.querySelector('[data-key="constantInkExponent"]');
  const syncConstantInkDisabledState = () => {
    if (!constantInkExponentInput) return;
    constantInkExponentInput.disabled = !CONFIG.enableConstantInk;
  };

  // Both flicker sliders are inert unless the glow itself is drawing, so they
  // grey out on either the flicker toggle or Box Glow being off.
  const glowFlickerInputs = ['glowFlickerDepth', 'glowFlickerSpeed']
    .map((key) => panel.querySelector(`[data-key="${key}"]`));
  const syncGlowFlickerDisabledState = () => {
    const off = !CONFIG.enableGlowFlicker || !CONFIG.enableBoxGlow;
    for (const input of glowFlickerInputs) {
      if (input) input.disabled = off;
    }
  };

  // The two curl modes read different controls, and calibration changes which
  // ones again, so which sliders are live is a three-way question. Grey out the
  // ones the active combination ignores rather than leaving them looking
  // functional while doing nothing.
  const curlModeInputs = {};
  for (const key of ['flowFieldMix', 'curlStrength', 'curlAngleRangeDeg',
                     'curlDuneModulation', 'curlAngleCalibrated']) {
    curlModeInputs[key] = panel.querySelector(`[data-key="${key}"]`);
  }
  const syncCurlModeDisabledState = () => {
    const divFree = Boolean(CONFIG.curlDivergenceFree);
    const calibrated = divFree && Boolean(CONFIG.curlAngleCalibrated);
    const set = (key, disabled) => {
      const input = curlModeInputs[key];
      if (input) input.disabled = disabled;
    };
    // Calibration is the only thing that gives the angle range meaning in
    // divergence-free mode; the legacy branch uses it directly.
    set('curlAngleRangeDeg', divFree && !calibrated);
    set('curlDuneModulation', divFree);
    set('curlAngleCalibrated', !divFree);
    // Calibration derives the curl amplitude from the angle bound and holds the
    // wind at full strength, so neither of these has anything left to scale.
    set('curlStrength', calibrated);
    set('flowFieldMix', calibrated);
  };

  for (let i = 0; i < CONTROL_PARAM_DEFS.length; i++) {
    const def = CONTROL_PARAM_DEFS[i];
    const input = panel.querySelector(`[data-key="${def.key}"]`);
    if (!input) continue;

    if (def.type === 'bool') {
      input.checked = Boolean(CONFIG[def.key]);
    } else {
      input.value = String(CONFIG[def.key]);
      updateControlOutput(def.key, CONFIG[def.key], def.digits, def.display);
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
        updateControlOutput(def.key, nextValue, def.digits, def.display);
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
      if (
        def.key === 'enableWordShadow' ||
        def.key === 'wordShadowBlur' ||
        def.key === 'wordShadowOpacity'
      ) {
        applyWordShadowStyle();
      }
      if (
        def.key === 'showBackgroundCanvas' ||
        def.key === 'showBackgroundCanvasB' ||
        def.key === 'showForegroundCanvas'
      ) {
        applyCanvasLayerVisibility();
      }
      if (def.key === 'pauseSimulation') {
        applySimulationPauseState();
      }
      if (def.key === 'equalizeNoiseTexture') {
        bakeNoiseTexture();
      }
      updateQualityBaseline(def.key, CONFIG[def.key]);
      if (def.key === 'useWeightedEdgeRespawn') {
        syncEdgeRespawnMixDisabledState();
      }
      if (def.key === 'enableConstantInk') {
        syncConstantInkDisabledState();
      }
      if (def.key === 'enableGlowFlicker' || def.key === 'enableBoxGlow') {
        syncGlowFlickerDisabledState();
      }
      if (def.key === 'curlDivergenceFree' || def.key === 'curlAngleCalibrated') {
        syncCurlModeDisabledState();
      }
      if (BOOSTED_CONTROL_KEYS.has(def.key)) {
        syncBoostedParticleConfig(def.key === 'windBoostParticleRatio');
      }
      syncColorAlphaInputsForConfigKey(def.key);
      syncUrlParamsFromConfig();
    });
  }
  syncEdgeRespawnMixDisabledState();
  syncCurlModeDisabledState();
  syncConstantInkDisabledState();
  syncGlowFlickerDisabledState();

  bindColorControls(panel);
  bindColorAlphaControls(panel);
  bindAngleControls(panel);
  bindPauseToggleButton();
  bindResetControlsButton();
  bindWordColliderControls(panel);
  setupDetailsPersistence(panel);
  applyQualityTargetFpsBounds(panel);
  bindFontSizeControl();
  bindTextTextureToggle();
  bindTextTextureSizeControl();
  bindVignetteControls();
  bindPanelResizeHandle(panel);
  bindCollapseAllButton(panel);
  // Last: pinning moves rows, so everything else binds against the home layout.
  setupControlPinning(panel);
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

  // Initialise controls to reflect URL-parsed state from scroll.js.
  if (enabledInput && typeof window.__mournGetWordCollidersEnabled === 'function') {
    enabledInput.checked = window.__mournGetWordCollidersEnabled();
  }
  if (wordBoxesInput && typeof window.__mournGetWordBoxes === 'function') {
    wordBoxesInput.checked = window.__mournGetWordBoxes();
  }
  if (insetXInput && typeof window.__mournGetWordInsetXPx === 'function') {
    const v = String(-window.__mournGetWordInsetXPx());
    insetXInput.value = v;
    if (insetXOut) insetXOut.textContent = v;
  }
  if (insetYInput && typeof window.__mournGetWordInsetYPx === 'function') {
    const v = String(-window.__mournGetWordInsetYPx());
    insetYInput.value = v;
    if (insetYOut) insetYOut.textContent = v;
  }
  if (offsetXInput && typeof window.__mournGetWordOffsetXPx === 'function') {
    const v = String(window.__mournGetWordOffsetXPx());
    offsetXInput.value = v;
    if (offsetXOut) offsetXOut.textContent = v;
  }
  if (offsetYInput && typeof window.__mournGetWordOffsetYPx === 'function') {
    const v = String(window.__mournGetWordOffsetYPx());
    offsetYInput.value = v;
    if (offsetYOut) offsetYOut.textContent = v;
  }

  if (enabledInput) {
    enabledInput.addEventListener('change', () => {
      if (typeof window.__mournSetWordCollidersEnabled === 'function') {
        window.__mournSetWordCollidersEnabled(enabledInput.checked);
      }
      syncUrlParamsFromConfig();
    });
  }
  if (wordBoxesInput) {
    wordBoxesInput.addEventListener('change', () => {
      if (typeof window.__mournSetWordBoxes === 'function') {
        window.__mournSetWordBoxes(wordBoxesInput.checked);
      }
      syncUrlParamsFromConfig();
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
      syncUrlParamsFromConfig();
    });
  }
  if (insetYInput) {
    insetYInput.addEventListener('dblclick', () => resetWordSlider(insetYInput, insetYOut, wordColliderDefaults.insetY));
    insetYInput.addEventListener('input', () => {
      if (insetYOut) insetYOut.textContent = insetYInput.value;
      if (typeof window.__mournSetWordInsetYPx === 'function') {
        window.__mournSetWordInsetYPx(-Number(insetYInput.value));
      }
      syncUrlParamsFromConfig();
    });
  }
  if (offsetXInput) {
    offsetXInput.addEventListener('dblclick', () => resetWordSlider(offsetXInput, offsetXOut, wordColliderDefaults.offsetX));
    offsetXInput.addEventListener('input', () => {
      if (offsetXOut) offsetXOut.textContent = offsetXInput.value;
      if (typeof window.__mournSetWordOffsetX === 'function') {
        window.__mournSetWordOffsetX(offsetXInput.value);
      }
      syncUrlParamsFromConfig();
    });
  }
  if (offsetYInput) {
    offsetYInput.addEventListener('dblclick', () => resetWordSlider(offsetYInput, offsetYOut, wordColliderDefaults.offsetY));
    offsetYInput.addEventListener('input', () => {
      if (offsetYOut) offsetYOut.textContent = offsetYInput.value;
      if (typeof window.__mournSetWordOffsetY === 'function') {
        window.__mournSetWordOffsetY(offsetYInput.value);
      }
      syncUrlParamsFromConfig();
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

function bindFontSizeControl() {
  const input = document.getElementById('font-size-input');
  const output = document.getElementById('font-size-output');
  const notice = document.getElementById('font-size-notice');
  if (!input) return;

  const STORAGE_KEY = 'dune-controls:font-size';
  const DEFAULT_SIZE = 16;
  const RELOAD_DELAY_MS = 2000;
  let reloadTimer = null;

  // Initialise to stored value, falling back to the current CSS var.
  const stored = parseFloat(localStorage.getItem(STORAGE_KEY));
  const current = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--base-font-size')
  ) || DEFAULT_SIZE;
  const initialValue = Number.isFinite(stored) ? stored : current;
  input.value = String(initialValue);
  if (output) output.textContent = String(initialValue);

  input.addEventListener('dblclick', () => {
    input.value = String(DEFAULT_SIZE);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  input.addEventListener('input', () => {
    const val = parseFloat(input.value);
    if (!Number.isFinite(val)) return;
    if (output) output.textContent = String(val);

    try { localStorage.setItem(STORAGE_KEY, String(val)); } catch (e) {}

    if (reloadTimer) clearTimeout(reloadTimer);
    if (notice) notice.textContent = 'Reloading in 2s\u2026';

    reloadTimer = setTimeout(() => {
      window.location.reload();
    }, RELOAD_DELAY_MS);
  });
}

function bindVignetteControls() {
  const enableInput = document.getElementById('vignette-enabled');
  const colorInput = document.getElementById('vignette-color-input');
  const colorOutput = document.getElementById('vignette-color-output');
  const strengthInput = document.getElementById('vignette-strength-input');
  const strengthOutput = document.getElementById('vignette-strength-output');
  const innerInput = document.getElementById('vignette-inner-stop-input');
  const innerOutput = document.getElementById('vignette-inner-stop-output');
  if (!enableInput) return;

  const KEYS = {
    enabled: 'dune-controls:vignette-enabled',
    color: 'dune-controls:vignette-color',
    strength: 'dune-controls:vignette-strength',
    inner: 'dune-controls:vignette-inner-stop',
  };
  const DEFAULTS = { enabled: true, color: '#000000', strength: 0.7, inner: 40 };

  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  };

  // Compute the two saturate-stop positions (the boundary between flat-dark and
  // the dark→transparent fade) directly in JS. Nested calc() inside SCSS gets
  // unwrapped during compile, which broke right/bottom edges due to ambiguous
  // operator precedence around the `-`. Setting fully resolved % values dodges
  // the issue entirely.
  const applySaturateStops = () => {
    const innerRaw = parseFloat(innerInput.value);
    const inner = Number.isFinite(innerRaw) ? innerRaw : DEFAULTS.inner;
    const sRaw = parseFloat(strengthInput.value);
    const s = Number.isFinite(sRaw) ? sRaw : DEFAULTS.strength;
    const multiplier = 1 - 1 / Math.max(1, s);
    const nearStopPct = inner * multiplier;
    const farStopPct = 100 - inner * multiplier;
    const root = document.documentElement.style;
    root.setProperty('--vignette-saturate-near', nearStopPct + '%');
    root.setProperty('--vignette-saturate-far', farStopPct + '%');
  };

  const applyShadowColor = () => {
    const { r, g, b } = hexToRgb(colorInput.value || DEFAULTS.color);
    const raw = parseFloat(strengthInput.value);
    const s = Number.isFinite(raw) ? raw : DEFAULTS.strength;
    // Strength 0–1: alpha = s, no flat-dark zone.
    // Strength > 1: alpha pinned at 1; the saturate stops pull inward via
    // applySaturateStops, so a larger band along each edge is solid.
    const alpha = Math.max(0, Math.min(1, s));
    document.documentElement.style.setProperty(
      '--vignette-shadow-color',
      `rgba(${r}, ${g}, ${b}, ${alpha})`
    );
    applySaturateStops();
  };

  const applyInnerStop = (val) => {
    document.documentElement.style.setProperty('--vignette-inner-stop', val + '%');
    if (innerOutput) innerOutput.textContent = String(val);
    applySaturateStops();
  };

  const applyEnabled = (enabled) => {
    const el = document.getElementById('vignette');
    if (el) el.classList.toggle('vignette-off', !enabled);
    [colorInput, strengthInput, innerInput].forEach((i) => { if (i) i.disabled = !enabled; });
  };

  // Initialise from localStorage, falling back to defaults.
  const storedEnabled = localStorage.getItem(KEYS.enabled);
  const storedColor = localStorage.getItem(KEYS.color);
  const storedStrength = parseFloat(localStorage.getItem(KEYS.strength));
  const storedInner = parseFloat(localStorage.getItem(KEYS.inner));

  enableInput.checked = storedEnabled === null ? DEFAULTS.enabled : storedEnabled === 'true';
  colorInput.value = /^#[0-9a-f]{6}$/i.test(storedColor || '') ? storedColor : DEFAULTS.color;
  strengthInput.value = String(Number.isFinite(storedStrength) ? storedStrength : DEFAULTS.strength);
  innerInput.value = String(Number.isFinite(storedInner) ? storedInner : DEFAULTS.inner);

  if (colorOutput) colorOutput.textContent = colorInput.value;
  if (strengthOutput) strengthOutput.textContent = parseFloat(strengthInput.value).toFixed(2);
  applyShadowColor();
  applyInnerStop(innerInput.value);
  applyEnabled(enableInput.checked);

  enableInput.addEventListener('change', () => {
    applyEnabled(enableInput.checked);
    try { localStorage.setItem(KEYS.enabled, String(enableInput.checked)); } catch (e) {}
  });

  colorInput.addEventListener('dblclick', () => {
    colorInput.value = DEFAULTS.color;
    colorInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  colorInput.addEventListener('input', () => {
    if (colorOutput) colorOutput.textContent = colorInput.value;
    applyShadowColor();
    try { localStorage.setItem(KEYS.color, colorInput.value); } catch (e) {}
  });

  strengthInput.addEventListener('dblclick', () => {
    strengthInput.value = String(DEFAULTS.strength);
    strengthInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  strengthInput.addEventListener('input', () => {
    const v = parseFloat(strengthInput.value);
    if (!Number.isFinite(v)) return;
    if (strengthOutput) strengthOutput.textContent = v.toFixed(2);
    applyShadowColor();
    try { localStorage.setItem(KEYS.strength, String(v)); } catch (e) {}
  });

  innerInput.addEventListener('dblclick', () => {
    innerInput.value = String(DEFAULTS.inner);
    innerInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  innerInput.addEventListener('input', () => {
    const v = parseFloat(innerInput.value);
    if (!Number.isFinite(v)) return;
    applyInnerStop(v);
    try { localStorage.setItem(KEYS.inner, String(v)); } catch (e) {}
  });
}

function bindTextTextureToggle() {
  const input = document.getElementById('text-texture-enabled');
  if (!input) return;

  const STORAGE_KEY = 'dune-controls:text-texture-enabled';
  const sizeInput = document.getElementById('text-texture-size-input');

  const applyState = (enabled) => {
    const container = document.getElementById('poem-container');
    if (container) container.classList.toggle('text-texture-off', !enabled);
    if (sizeInput) sizeInput.disabled = !enabled;
  };

  const stored = localStorage.getItem(STORAGE_KEY);
  const initial = stored === null ? true : stored === 'true';
  input.checked = initial;
  applyState(initial);

  input.addEventListener('change', () => {
    applyState(input.checked);
    try { localStorage.setItem(STORAGE_KEY, String(input.checked)); } catch (e) {}
  });
}

function bindTextTextureSizeControl() {
  const input = document.getElementById('text-texture-size-input');
  const output = document.getElementById('text-texture-size-output');
  if (!input) return;

  const STORAGE_KEY = 'dune-controls:text-texture-size';
  const DEFAULT_SIZE = 200;

  const applyValue = (val) => {
    document.documentElement.style.setProperty('--text-texture-size', val + 'px');
    if (output) output.textContent = String(val);
  };

  const stored = parseFloat(localStorage.getItem(STORAGE_KEY));
  const initialValue = Number.isFinite(stored) ? stored : DEFAULT_SIZE;
  input.value = String(initialValue);
  applyValue(initialValue);

  input.addEventListener('dblclick', () => {
    input.value = String(DEFAULT_SIZE);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  input.addEventListener('input', () => {
    const val = parseFloat(input.value);
    if (!Number.isFinite(val)) return;
    applyValue(val);
    try { localStorage.setItem(STORAGE_KEY, String(val)); } catch (e) {}
  });
}

function bindPanelResizeHandle(panel) {
  const handle = document.getElementById('dune-resize-handle');
  if (!handle) return;

  const MIN_WIDTH = 200;
  const MAX_WIDTH = 700;
  const STORAGE_KEY = 'dune-controls:width';

  try {
    const saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    if (Number.isFinite(saved) && saved >= MIN_WIDTH && saved <= MAX_WIDTH) {
      panel.style.width = saved + 'px';
    }
  } catch (e) { /* ignore storage failures */ }

  let dragging = false;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rightEdge = window.innerWidth - 12;
    const newWidth = Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, rightEdge - e.clientX)));
    panel.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.userSelect = '';
    try {
      const w = parseInt(panel.style.width, 10);
      if (Number.isFinite(w)) {
        localStorage.setItem(STORAGE_KEY, String(w));
      }
    } catch (e) { /* ignore storage failures */ }
  });
}

function bindCollapseAllButton(panel) {
  const btn = document.getElementById('collapse-all-btn');
  if (!btn) return;

  const groups = panel.querySelectorAll('details.control-group');

  const updateLabel = () => {
    const anyOpen = Array.from(groups).some(d => d.open);
    btn.textContent = anyOpen ? 'Collapse All' : 'Expand All';
  };

  updateLabel();
  groups.forEach(g => g.addEventListener('toggle', updateLabel));

  btn.addEventListener('click', () => {
    const anyOpen = Array.from(groups).some(d => d.open);
    groups.forEach(g => {
      if (anyOpen) {
        g.removeAttribute('open');
      } else {
        g.setAttribute('open', '');
      }
    });
    updateLabel();
  });
}

// --- Control pinning --------------------------------------------------------
// Pinned rows are MOVED into #pinned-controls rather than cloned. Cloning would
// duplicate data-key attributes and quietly break every panel.querySelector()
// lookup in this file; moving keeps each row a single node with its bound
// listeners intact. A ghost is left in the row's home position so the control
// never just vanishes from its group, and so it can be unpinned from there.
const PIN_ICON_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<path d="M9.4 1 15 6.6l-1.2 1.2-1.5-.4-2.6 2.6.6 2.6-1.2 1.2-3.2-3.2L2.2 14 2 14l.1-.2 3.4-3.7-3.2-3.2 1.2-1.2 2.6.6L8.7 3.7l-.4-1.5z"/>' +
  '</svg>';

const DRAG_ICON_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<circle cx="6" cy="3.5" r="1.4"/><circle cx="10" cy="3.5" r="1.4"/>' +
  '<circle cx="6" cy="8" r="1.4"/><circle cx="10" cy="8" r="1.4"/>' +
  '<circle cx="6" cy="12.5" r="1.4"/><circle cx="10" cy="12.5" r="1.4"/>' +
  '</svg>';

function getControlPinId(row) {
  const keyed = row.querySelector('[data-key]');
  if (keyed) return `k-${keyed.getAttribute('data-key')}`;
  const color = row.querySelector('[data-color-key]');
  if (color) return `c-${color.getAttribute('data-color-key')}`;
  const colorAlpha = row.querySelector('[data-color-alpha-key]');
  if (colorAlpha) return `a-${colorAlpha.getAttribute('data-color-alpha-key')}`;
  const ided = row.querySelector('[id]');
  if (ided && ided.id) return `i-${ided.id}`;
  return '';
}

function setupControlPinning(panel) {
  const section = document.getElementById('pinned-section');
  const list = document.getElementById('pinned-controls');
  if (!section || !list) return;

  const entries = new Map();

  const makePinButton = (id, onToggle) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'control-pin';
    btn.innerHTML = PIN_ICON_SVG;
    btn.addEventListener('click', (event) => {
      // Rows are <label>s: without preventDefault the click forwards to the
      // labelled input and would flip the very checkbox being pinned.
      event.preventDefault();
      event.stopPropagation();
      onToggle(id);
    });
    return btn;
  };

  const syncSectionVisibility = () => {
    section.hidden = list.children.length === 0;
  };

  const persist = () => {
    CONFIG.pinnedControls = Array.from(list.children)
      .map(child => child.dataset.pinId || '')
      .filter(Boolean)
      .join('.');
    syncUrlParamsFromConfig();
  };

  // Reorder by dragging the grip. Pointer events rather than HTML5 drag and
  // drop: the rows are <label>s wrapping range inputs, and making one
  // draggable steals the pointer from its own slider.
  const moveRowToPointer = (row, clientY) => {
    const siblings = Array.from(list.children).filter(c => c !== row);
    for (let i = 0; i < siblings.length; i++) {
      const r = siblings[i].getBoundingClientRect();
      if (clientY < r.top + r.height * 0.5) {
        list.insertBefore(row, siblings[i]);
        return;
      }
    }
    list.appendChild(row);
  };

  const nudgeRow = (row, delta) => {
    const order = Array.from(list.children);
    const from = order.indexOf(row);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return false;
    if (delta < 0) list.insertBefore(row, order[to]);
    else list.insertBefore(row, order[to].nextSibling);
    persist();
    return true;
  };

  const makeDragHandle = (id) => {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'control-drag';
    handle.innerHTML = DRAG_ICON_SVG;
    handle.title = 'Drag to reorder, or focus and use the arrow keys';

    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const entry = entries.get(id);
      if (!entry || !entry.ghost) return;
      // Suppress the label's activation behaviour and any text selection.
      event.preventDefault();
      const row = entry.row;
      row.classList.add('is-dragging');
      document.body.style.userSelect = 'none';

      const onMove = (moveEvent) => moveRowToPointer(row, moveEvent.clientY);
      const onUp = () => {
        row.classList.remove('is-dragging');
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        persist();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });

    handle.addEventListener('keydown', (event) => {
      const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
      if (!delta) return;
      const entry = entries.get(id);
      if (!entry || !entry.ghost) return;
      event.preventDefault();
      if (nudgeRow(entry.row, delta)) handle.focus();
    });

    // A grip inside a <label> would otherwise toggle the labelled control.
    handle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    return handle;
  };

  const togglePin = (id) => {
    const entry = entries.get(id);
    if (!entry) return;
    if (entry.ghost) {
      entry.ghost.replaceWith(entry.row);
      entry.ghost = null;
      entry.row.classList.remove('is-pinned');
      entry.button.title = 'Pin to the top of the panel';
    } else {
      const ghost = document.createElement('div');
      ghost.className = 'control-ghost';
      ghost.dataset.pinId = id;
      ghost.title = 'Pinned to the top of the panel — click to unpin';
      const text = document.createElement('span');
      text.textContent = entry.label;
      ghost.appendChild(text);
      ghost.appendChild(makePinButton(id, togglePin));
      entry.row.replaceWith(ghost);
      entry.ghost = ghost;
      list.appendChild(entry.row);
      entry.row.classList.add('is-pinned');
      entry.button.title = 'Unpin — return to its group';
    }
    syncSectionVisibility();
    persist();
  };

  const rows = panel.querySelectorAll('.control-row');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const id = getControlPinId(row);
    if (!id || entries.has(id)) continue;
    const span = row.querySelector('span');
    const button = makePinButton(id, togglePin);
    button.title = 'Pin to the top of the panel';
    row.dataset.pinId = id;
    // Grip first so it lands left of the pin in the flex toggle rows; the grid
    // rows place both explicitly and CSS hides the grip until the row is pinned.
    row.appendChild(makeDragHandle(id));
    row.appendChild(button);
    entries.set(id, { row, button, ghost: null, label: span ? span.textContent.trim() : id });
  }

  // Ids that no longer match a row are skipped, and the rewrite below drops
  // them from the URL. Each step re-persists, which is redundant but keeps
  // togglePin the single place that knows how a pin is applied.
  const saved = String(CONFIG.pinnedControls || '').split('.');
  for (let i = 0; i < saved.length; i++) {
    if (saved[i] && entries.has(saved[i])) togglePin(saved[i]);
  }
  syncSectionVisibility();
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

// Readout formats, selected by a def's `display` key. These change the panel
// text only — CONFIG and the URL params always hold the raw slider value.
const CONTROL_OUTPUT_FORMATTERS = {
  deg: (v) => `${Math.round(v)}deg`,
  // Boost knobs are gains, not final values: the renderer applies
  // (1 + boost * signal), so a raw 1.2 is really a 2.2x multiplier. Show the
  // factor. Speed signals are unbounded, so quote the rate per px/frame; dune
  // signals are normalized 0..1, so quote the ridge maximum.
  gainPerSpeed: (v) => `${(1 + v).toFixed(2)}×/px`,
  gainPeak: (v) => `${(1 + v).toFixed(2)}× max`,
};

function updateControlOutput(key, value, digits, display) {
  const output = document.querySelector(`[data-value-for="${key}"]`);
  if (!output) return;

  const format = display ? CONTROL_OUTPUT_FORMATTERS[display] : null;
  if (format) {
    output.textContent = format(Number(value));
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

  const curveRaw = params.get('backgroundPulseCurve');
  if (curveRaw !== null) {
    CONFIG.backgroundPulseCurve = serializePulseCurve(parsePulseCurve(curveRaw));
  }

  const pinnedRaw = params.get('pinnedControls');
  if (pinnedRaw !== null) {
    CONFIG.pinnedControls = pinnedRaw;
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
  params.delete('backgroundPulsePeakAlpha');
  params.delete('backgroundPulseDutyPercent');
  params.delete('backgroundPulseUseCurve');
  params.delete('backgroundFadeOscillationPeriodSec');
  params.delete('curlRotations');
  params.delete('flowJitterStrength');
  params.delete('perParticleForceMultSpread');
  params.delete('perParticleVelMultSpread');
  params.delete('colorFadeAlphaSecondary');
  params.delete('colorParticlesAlphaSecondary');
  // Smoke controls were removed entirely — clear stale params from old URLs.
  for (const key of [...params.keys()]) {
    if (/^s[12][A-Z]/.test(key)) params.delete(key);
  }
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

  params.set('backgroundPulseCurve', CONFIG.backgroundPulseCurve);

  // Omitted rather than emitted empty, so an unused feature adds no URL noise.
  if (CONFIG.pinnedControls) {
    params.set('pinnedControls', CONFIG.pinnedControls);
  } else {
    params.delete('pinnedControls');
  }

  for (let i = 0; i < COLOR_PARAM_DEFS.length; i++) {
    const def = COLOR_PARAM_DEFS[i];
    params.set(def.param, rgbArrayToHex(RENDER_COLORS[def.key]).slice(1));
  }
  for (let i = 0; i < COLOR_ALPHA_PARAM_DEFS.length; i++) {
    const def = COLOR_ALPHA_PARAM_DEFS[i];
    params.set(def.param, String(getColorAlpha(def)));
  }

  // Word collider params — read current state via getters exposed by scroll.js.
  params.set('enableWordColliders',
    (typeof window.__mournGetWordCollidersEnabled === 'function' ? window.__mournGetWordCollidersEnabled() : true) ? '1' : '0'
  );
  params.set('wordBoxes',
    (typeof window.__mournGetWordBoxes === 'function' ? window.__mournGetWordBoxes() : true) ? '1' : '0'
  );
  // Inset is stored internally as the negation of the UI slider value.
  const _wix = typeof window.__mournGetWordInsetXPx === 'function' ? window.__mournGetWordInsetXPx() : 0;
  const _wiy = typeof window.__mournGetWordInsetYPx === 'function' ? window.__mournGetWordInsetYPx() : 0;
  params.set('wordInsetX', String(-_wix));
  params.set('wordInsetY', String(-_wiy));
  const _wox = typeof window.__mournGetWordOffsetXPx === 'function' ? window.__mournGetWordOffsetXPx() : 0;
  const _woy = typeof window.__mournGetWordOffsetYPx === 'function' ? window.__mournGetWordOffsetYPx() : 0;
  params.set('wordOffsetX', String(_wox));
  params.set('wordOffsetY', String(_woy));

  // Font size — read the live CSS custom property value.
  const _fs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base-font-size'));
  if (Number.isFinite(_fs)) params.set('fontSize', String(_fs));

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
  _oklchCache.dirty = true;
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
    updateControlOutput(configKey, CONFIG[configKey], def.digits, def.display);
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

// Fixed per-particle multiplier in [1, maxMult], held until respawn so motion
// stays smooth (no per-frame noise). Always >= 1, so raising the control only
// speeds particles up — it never slows or freezes them. maxMult 1 → all 1.
function rollParticleMult(maxMult) {
  const m = max(1, maxMult);
  return m > 1 ? 1 + random() * (m - 1) : 1;
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
    // Fixed offset into the 1D noise field for ember flicker. Spread wide so
    // neighbouring particles sample decorrelated regions — a shared or narrowly
    // spaced phase makes every lit particle dip together and reads as a strobe.
    flickerPhase: random(10000),
    scrollFrozen: false,
    scrollUnfrozeAtMs: 0,
    scrollFadeProgress: 0,
    scrollCollisionDisabled: false,
    forceMult: rollParticleMult(CONFIG.perParticleForceMultMax),
    velMult: rollParticleMult(CONFIG.perParticleVelMultMax),
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
  // Only the particles that actually reach the foreground layer get the
  // multiplier, so this mirrors renderParticles' isFgLayer test rather than
  // reading ignoresBoxCollision on its own. Resolved to 1 when it would be a
  // no-op, which keeps the hot loop down to one multiply and no branch.
  const fgWindMult = CONFIG.enableForegroundLayer
    ? max(0, CONFIG.foregroundWindMultiplier)
    : 1;
  const fgWindMultActive = fgWindMult !== 1;
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
      const windMult = fgWindMultActive && !particle.ignoresBoxCollision
        ? particle.windBoostMultiplier * fgWindMult
        : particle.windBoostMultiplier;
      accX += ambient.x * windMult * particle.forceMult;
      accY += ambient.y * windMult * particle.forceMult;
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
    particle.pos.x += particle.vel.x * safeDtFrames * particle.velMult;
    particle.pos.y += particle.vel.y * safeDtFrames * particle.velMult;

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

function getCurrentSeparationCadence() {
  // The one knob the quality curve cannot move continuously — separation either
  // runs on a given tick or it does not. Everything else the controller drives
  // is a genuine float.
  return max(1, floor(getQualityValue('separationEveryNFrames')));
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
  releaseBuckets();
  for (let a = 0; a < separationActiveIndices.length; a++) {
    const i = separationActiveIndices[a];
    const key = getCellKey(separationCellXs[a], separationCellYs[a]);
    let bucket = separationGrid.get(key);
    if (!bucket) {
      bucket = acquireBucket();
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
  releaseBuckets();
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
    if (!bucket) { bucket = acquireBucket(); boidGrid.set(key, bucket); }
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
  fc.flowFieldMix = constrain(CONFIG.flowFieldMix, 0, 1);
  fc.windAngleRad = windAngle;
  fc.curlRangeRad = radians(constrain(CONFIG.curlAngleRangeDeg, 0, 180));
  // Curl field drifts through noise space on both axes (different rates so
  // the morph doesn't read as a straight translation).
  fc.curlDriftX = nowMs * 0.001 * CONFIG.curlDriftSpeed;
  fc.curlDriftY = nowMs * 0.001 * CONFIG.curlDriftSpeed * 0.83;
  // Rotate the noise gradient: -90deg (compressibility 0) = divergence-free
  // curl (no banding); 0deg (compressibility 1) = raw gradient (full banding).
  const cComp = constrain(CONFIG.curlCompressibility, 0, 1);
  const phi = -HALF_PI * (1 - cComp);
  fc.curlRotCos = Math.cos(phi);
  fc.curlRotSin = Math.sin(phi);
  fc.curlDuneRibbon = constrain(CONFIG.curlDuneRibbon, 0, 1);
  // Angle-calibrated divergence-free curl. Bounding the deflection off the wind
  // cannot be done by clamping the curl's direction — a pointwise remap of the
  // direction field puts the divergence straight back, which is the one thing
  // this mode exists to avoid. But the resultant angle is already bounded by the
  // magnitude ratio: with a uniform wind W and a curl term of magnitude C < W,
  // the sum can never deflect further than asin(C / W). So solve for the gain
  // instead of clamping the angle. The gain is a spatial constant, so the field
  // stays exactly divergence-free and the bound still holds everywhere.
  //
  // The wind reference is the full ambientWindStrength, not the mix-attenuated
  // term: the bound is a ratio, and letting flowFieldMix shrink the reference
  // would collapse the whole field to nothing as it approaches 1. In this mode
  // flowFieldMix and curlStrength do not apply — the deflection bound sets the
  // curl amplitude, and ambientWindStrength sets the speed.
  fc.curlAngleCalibrated = !!CONFIG.curlAngleCalibrated && !!CONFIG.curlDivergenceFree;
  if (fc.curlAngleCalibrated) {
    // 90deg is the ceiling: at C = W the resultant already reaches a right
    // angle, and past that no gain bounds anything. Stop just short so the
    // wind and curl can never cancel exactly and leave a direction-less point.
    const deg = constrain(CONFIG.curlAngleRangeDeg, 0, 89);
    // The ribbon multiplies the gain by (1 - r + r * duneMultiplier), which
    // peaks above 1 because duneMultiplier reaches 1.2. Divide that peak out so
    // the ribbon reshapes the field without letting it breach the bound.
    const ribbonPeak = 1 + 0.2 * fc.curlDuneRibbon;
    fc.curlCalibratedGain =
      CONFIG.ambientWindStrength * Math.sin(radians(deg)) / (curlGradMax * ribbonPeak);
  } else {
    fc.curlCalibratedGain = 0;
  }
  // Ridge-attraction crest falloff, and the constant that renormalises it.
  // At contrast 1 the product cos(w) * (1 - ridge01)^k peaks where
  // sin(w) = -k / (1 + k); dividing by that peak holds the maximum pull at the
  // no-falloff value, so k moves where the pull acts without changing how hard
  // it pulls. Exact at contrast 1, close enough either side of it.
  const ridgeFalloff = max(0, CONFIG.duneRidgeFalloff);
  fc.ridgeFalloff = ridgeFalloff;
  if (ridgeFalloff > 0) {
    const u = -ridgeFalloff / (1 + ridgeFalloff);
    const peak = Math.sqrt(1 - u * u) * pow((1 - u) * 0.5, ridgeFalloff);
    fc.ridgeFalloffNorm = peak > 1e-6 ? 1 / peak : 1;
  } else {
    fc.ridgeFalloffNorm = 1;
  }
  return fc;
}

// The band phase at a point, given its distance along and across the dune
// axis. Shared by the force sampler and the debug overlay so the picture can
// never drift from the field the particles actually feel. Callers derive
// ridge01 = (fastSin(w) + 1) / 2 — 0 in the troughs, 1 on the crests — and the
// force sampler also needs w itself for the ridge-attraction gradient.
function duneWarpedAcross(along, across) {
  return across / CONFIG.duneBandScale +
    fastSin(along / CONFIG.duneAlongWarpScale) * CONFIG.duneWarpStrength;
}

function sampleDuneWindForceXY(px, py, frameCache, turbulenceMultiplier = 1) {
  const sampleX = px - frameCache.windDirX * frameCache.driftPixels;
  const sampleY = py - frameCache.windDirY * frameCache.driftPixels;
  const along = sampleX * frameCache.duneDirX + sampleY * frameCache.duneDirY;
  const across =
    sampleX * frameCache.dunePerpX +
    sampleY * frameCache.dunePerpY +
    frameCache.duneBandOffsetPx;

  const warpedAcross = duneWarpedAcross(along, across);
  const ridge01 = (fastSin(warpedAcross) + 1) * 0.5;
  const duneMultiplier = CONFIG.enableDuneBands
    ? 0.25 + 0.95 * pow(ridge01, CONFIG.duneContrast)
    : 1;
  const windAmp = CONFIG.ambientWindStrength * duneMultiplier;

  const n = sampleNoiseTexture(
    sampleX / CONFIG.microNoiseScale,
    sampleY / CONFIG.microNoiseScale
  );
  const microAmp = n * CONFIG.microTurbulenceStrength * turbulenceMultiplier;

  let fx = frameCache.windDirX * windAmp + frameCache.windPerpX * microAmp;
  let fy = frameCache.windDirY * windAmp + frameCache.windPerpY * microAmp;

  // Curl field as wind-relative steering: noise deflects the force angle up
  // to ±curlAngleRangeDeg around the wind heading, so the flow meanders but
  // never opposes the wind head-on. The dune ridge value can scale the curl
  // amplitude so the banding structure survives inside the meanders.
  const mix = frameCache.flowFieldMix;
  // Calibrated mode ignores flowFieldMix entirely, so it must not be gated by
  // it either — otherwise mix 0 would be a hidden off switch for a control the
  // panel greys out in this mode.
  if (mix > 0 || frameCache.curlAngleCalibrated) {
    const inv = 1 - mix;
    if (CONFIG.curlDivergenceFree) {
      // Curl-noise flow from a scalar noise potential. The force is the
      // gradient (dN/dx, dN/dy) rotated by curlRot: at -90deg it's the curl
      // (dN/dy, -dN/dx) — divergence-free, no convergence zones, no banding;
      // at 0deg it's the raw gradient — fully compressible, clusters into
      // bands. curlCompressibility lerps the rotation between them, so it dials
      // in "some banding" continuously. Wind is a uniform term, which adds no
      // divergence of its own, so banding scales purely with compressibility.
      const s = CONFIG.curlNoiseScale;
      const u = px / s + frameCache.curlDriftX;
      const v = py / s + frameCache.curlDriftY;
      const h = CURL_NOISE_DIFF_STEP;
      const dNdu = (sampleNoiseTexture(u + h, v) - sampleNoiseTexture(u - h, v)) / (2 * h);
      const dNdv = (sampleNoiseTexture(u, v + h) - sampleNoiseTexture(u, v - h)) / (2 * h);
      const cr = frameCache.curlRotCos;
      const sr = frameCache.curlRotSin;
      const cvx = dNdu * cr - dNdv * sr;
      const cvy = dNdu * sr + dNdv * cr;
      // Dune ribbon banding: scale the curl magnitude by the dune signal so the
      // flow runs slower in the troughs and particles pool there, forming bands
      // aligned with the dune ridges. Unlike compressibility this keeps the
      // rotational direction, so it makes ribbons, not spiral vortex traps.
      const ribbon = frameCache.curlDuneRibbon;
      const ribbonScale = 1 - ribbon + ribbon * duneMultiplier;
      const windUniformX = frameCache.windDirX * CONFIG.ambientWindStrength;
      const windUniformY = frameCache.windDirY * CONFIG.ambientWindStrength;
      if (frameCache.curlAngleCalibrated) {
        // Wind at full strength against a curl sized to the deflection bound.
        // No mix term on either: the bound is the ratio between them, so
        // attenuating the wind would let the curl swing past the limit.
        const g = frameCache.curlCalibratedGain * ribbonScale;
        fx = windUniformX + cvx * g + frameCache.windPerpX * microAmp;
        fy = windUniformY + cvy * g + frameCache.windPerpY * microAmp;
      } else {
        const g = CONFIG.curlStrength * CURL_NOISE_GAIN * ribbonScale;
        fx = windUniformX * inv + cvx * g * mix + frameCache.windPerpX * microAmp;
        fy = windUniformY * inv + cvy * g * mix + frameCache.windPerpY * microAmp;
      }
    } else {
      // Legacy angle-from-noise curl: noise sets the flow angle. Compressible —
      // tends to collect particles into filaments over time (see curl mode).
      const cn = sampleNoiseTexture(
        px / CONFIG.curlNoiseScale + frameCache.curlDriftX,
        py / CONFIG.curlNoiseScale + frameCache.curlDriftY
      );
      const angle = frameCache.windAngleRad + cn * frameCache.curlRangeRad;
      const duneMod = constrain(CONFIG.curlDuneModulation, 0, 1);
      const curlAmp = CONFIG.curlStrength * (1 - duneMod + duneMod * duneMultiplier);
      fx = fx * inv + fastSin(angle + HALF_PI) * curlAmp * mix;
      fy = fy * inv + fastSin(angle) * curlAmp * mix;
    }
  }

  // Ridge attraction: pull particles ACROSS the bands toward dune ridges while
  // leaving along-band flow untouched. Converging onto a line makes ribbons;
  // curlCompressibility converges onto points, which is why it makes vortices.
  //
  // The dune signal is analytic, so its gradient is too. dunePerp is
  // perpendicular to duneDir, so stepping along it moves `across` and leaves
  // `along` fixed — the derivative needs no extra samples, just the cosine
  // partnering the sine already computed above:
  //   ridge01 = (sin(w) + 1) / 2                  -> d/dw = cos(w) / 2
  //   duneMultiplier = 0.25 + 0.95 * ridge01^c    -> d/dridge01 = 0.95c*ridge01^(c-1)
  // Deliberately NOT divided by duneBandScale: the true spatial gradient shrinks
  // as bands widen, which would silently weaken the effect every time that
  // slider moves. Scaling by wind strength instead makes the control read as
  // "fraction of the wind force pulling toward ridges" at any band scale.
  const ridgePull = CONFIG.duneRidgeAttraction;
  if (ridgePull > 0 && CONFIG.enableDuneBands) {
    const contrast = CONFIG.duneContrast;
    // ridge01 hits 0 in the troughs, where contrast < 1 sends
    // ridge01^(contrast-1) to infinity — an unbounded pull at trough centres.
    // The cap bounds that; it is inactive for contrast >= 1, where the peak
    // gradient is 0.47-0.84 either way.
    const shaped = contrast === 1
      ? 1
      : min(DUNE_RIDGE_SHAPE_CAP, pow(max(ridge01, 1e-3), contrast - 1));
    const dMult = 0.95 * contrast * shaped * 0.5 * fastSin(warpedAcross + HALF_PI);
    // Crest falloff. The raw gradient still pulls at ~60% of peak where the
    // field reads 0.9 white, which packs particles into the ridge centre;
    // scaling by (1 - signal)^k fades the pull out well before the crest so
    // they ease onto the flank instead. Normalised so k only reshapes the
    // profile — without it, sharpening the falloff would also quietly weaken
    // the whole force and force a re-tune of Ridge Attraction.
    let falloff = 1;
    if (frameCache.ridgeFalloff > 0) {
      const signal = contrast === 1 ? ridge01 : pow(ridge01, contrast);
      falloff = pow(max(1 - signal, 0), frameCache.ridgeFalloff) * frameCache.ridgeFalloffNorm;
    }
    const pull = ridgePull * CONFIG.ambientWindStrength * DUNE_RIDGE_ATTRACTION_GAIN * falloff;
    fx += frameCache.dunePerpX * dMult * pull;
    fy += frameCache.dunePerpY * dMult * pull;
  }

  _duneWindResult.x = fx;
  _duneWindResult.y = fy;
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
    const rv = CONFIG.respawnRandomizeVelocity;
    if (rv > 0) {
      const ang = Math.random() * TWO_PI;
      const mag = Math.random() * rv;
      particle.vel.x = Math.cos(ang) * mag;
      particle.vel.y = Math.sin(ang) * mag;
    }
    particle.forceMult = rollParticleMult(CONFIG.perParticleForceMultMax);
    particle.velMult = rollParticleMult(CONFIG.perParticleVelMultMax);
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
  const fgActive = Boolean(fgGraphics && CONFIG.enableForegroundLayer);
  const dualInkActive = Boolean(inkBGraphics && CONFIG.enableDualInkLayers);
  // Colliders occupy the low indices, so the ink block is contiguous at the
  // top — split it in half at its midpoint so render targets switch once, not
  // per-particle. Where the ink block starts depends on whether the foreground
  // layer is there to take the colliders: with it off they fall through to the
  // ink layers, so the split has to move down or canvas A gets twice B's share.
  const collidersEndIndex = Math.floor(
    particles.length * constrain(CONFIG.boxCollisionParticipantRatio, 0, 1)
  );
  const inkStartIndex = fgActive ? collidersEndIndex : 0;
  const inkSplitIndex = dualInkActive
    ? Math.floor((inkStartIndex + particles.length) * 0.5)
    : particles.length;
  const fgBaseA = clampColorByte(CONFIG.foregroundParticleAlpha);
  const minSpeed = max(0, getQualityValue('particleRenderMinSpeed'));
  const minSpeedRamp = max(0.02, minSpeed * 0.7);
  const alphaBoost = max(0, CONFIG.particleSpeedAlphaBoost);
  const duneAlphaBoost = max(0, CONFIG.particleDuneAlphaBoost);
  const duneSizeBoost = max(0, CONFIG.particleDuneSizeBoost);
  const widthBoost = max(0, CONFIG.particleSpeedWidthBoost);
  const constantInk = Boolean(CONFIG.enableConstantInk);
  const inkExponent = max(0, CONFIG.constantInkExponent);
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
  // Ember flicker. Resolved to a depth of 0 when it would be a no-op so the
  // per-particle test is one already-loaded compare, and advanced on render
  // time rather than frame count so the breathing rate is independent of FPS.
  const flickerDepth = CONFIG.enableGlowFlicker
    ? constrain(CONFIG.glowFlickerDepth, 0, 1)
    : 0;
  const flickerT = renderNowMs * 0.001 * max(0, CONFIG.glowFlickerSpeed);
  // OkLCh conversions — only recomputed when colors actually change.
  if (_oklchCache.dirty ||
      baseR !== _oklchCache.baseR || baseG !== _oklchCache.baseG || baseB !== _oklchCache.baseB ||
      boostedColor.r !== _oklchCache.boostedR || boostedColor.g !== _oklchCache.boostedG || boostedColor.b !== _oklchCache.boostedB ||
      glowCoreR !== _oklchCache.glowCoreR || glowCoreG !== _oklchCache.glowCoreG || glowCoreB !== _oklchCache.glowCoreB) {
    const b = srgbToOklch(baseR, baseG, baseB);
    _oklchCache.base.L = b.L; _oklchCache.base.C = b.C; _oklchCache.base.h = b.h;
    _oklchCache.baseR = baseR; _oklchCache.baseG = baseG; _oklchCache.baseB = baseB;
    const bo = srgbToOklch(boostedColor.r, boostedColor.g, boostedColor.b);
    _oklchCache.boosted.L = bo.L; _oklchCache.boosted.C = bo.C; _oklchCache.boosted.h = bo.h;
    _oklchCache.boostedR = boostedColor.r; _oklchCache.boostedG = boostedColor.g; _oklchCache.boostedB = boostedColor.b;
    const gc = srgbToOklch(glowCoreR, glowCoreG, glowCoreB);
    _oklchCache.glowCore.L = gc.L; _oklchCache.glowCore.C = gc.C; _oklchCache.glowCore.h = gc.h;
    _oklchCache.glowCoreR = glowCoreR; _oklchCache.glowCoreG = glowCoreG; _oklchCache.glowCoreB = glowCoreB;
    _oklchCache.dirty = false;
  }
  const baseOklch = _oklchCache.base;
  const boostedOklch = _oklchCache.boosted;
  const glowCoreOklch = _oklchCache.glowCore;
  // Track previous stroke state to skip redundant canvas state changes.
  let prevStrokeR = -1;
  let prevStrokeG = -1;
  let prevStrokeB = -1;
  let prevStrokeA = -1;
  let prevWeight = -1;
  let prevTarget = null;
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
      }
      const elapsed = renderNowMs - p.scrollUnfrozeAtMs;
      if (elapsed >= fadeInMs) {
        p.scrollUnfrozeAtMs = 0;
      } else {
        scrollFadeFactor = elapsed / fadeInMs;
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
    const colorR = p.isBoosted ? boostedColor.r : baseR;
    const colorG = p.isBoosted ? boostedColor.g : baseG;
    const colorB = p.isBoosted ? boostedColor.b : baseB;
    const speedFactor = 1 + speed;
    const duneSignal = constrain(p.duneAlphaSignal || 0, 0, 1);
    const duneAlphaFactor = 1 + duneAlphaBoost * duneSignal;
    const duneSizeFactor = 1 + duneSizeBoost * duneSignal;
    const fastAlphaAdd = p.isBoosted ? max(0, CONFIG.windBoostAlphaMultiplier) : 0;
    // Route word-colliding particles to the foreground overlay; ignorers lay
    // persistent ink, alternating by index between the two ink canvases so
    // each keeps accumulating while the other wipes. Stroke cache per-target.
    const isFgLayer = fgActive && !p.ignoresBoxCollision;
    let g;
    if (isFgLayer) {
      g = fgGraphics;
    } else if (dualInkActive && i >= inkSplitIndex) {
      g = inkBGraphics;
    } else {
      g = _mainRenderTarget;
    }
    // Tail ramp, normalized within the target layer's own index range rather
    // than the whole array. Ramping across the array would hand whichever
    // layer owns the high indices (ink B) the entire dim, thin end of the
    // ramp while A kept the bright end — the layers would drift apart in
    // weight whenever adaptive quality pushed renderFraction below 1.
    let rampStart;
    let rampEnd;
    if (isFgLayer) {
      rampStart = 0;
      rampEnd = collidersEndIndex;
    } else if (g === inkBGraphics) {
      rampStart = inkSplitIndex;
      rampEnd = particleCount;
    } else {
      rampStart = inkStartIndex;
      rampEnd = inkSplitIndex;
    }
    // Boosted particles are colliders wherever they sit in the array, so a
    // boosted index can fall outside its layer's block — clamp rather than
    // let the ramp run past its ends.
    const rampSpan = rampEnd - rampStart;
    const t = rampSpan > 1 ? constrain((i - rampStart) / (rampSpan - 1), 0, 1) : 0;
    const renderAlphaWeight = lerp(1, tailAlphaWeight, t);
    const renderWidthWeight = lerp(1, tailWidthWeight, t);
    if (g !== prevTarget) {
      prevStrokeR = prevStrokeG = prevStrokeB = prevStrokeA = -1;
      prevWeight = -1;
      prevTarget = g;
    }
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
    // Constant ink: divide the alpha by however much wider this stroke came out
    // than a base-size one would have in the same tail slot, so widening a
    // particle spreads its ink rather than adding more. Measured against the
    // rendered weight, not the nominal one, so the 0.5px floor and the 0.25px
    // quantize can't leave the compensation chasing a width nothing drew — at
    // small Particle Size most strokes sit on the floor and want no correction
    // at all. renderWidthWeight is in both terms so it cancels, leaving the tail
    // ramp's own fade intact instead of being compensated away.
    let inkScale = 1;
    if (constantInk && inkExponent > 0) {
      const refWeight = Math.max(0.5, Math.round(CONFIG.particleSize * renderWidthWeight * 4) * 0.25);
      if (weight !== refWeight) {
        // Every stroke alpha below is handed to the canvas as `a * alphaPercent`
        // with alphaPercent = alpha/255, so the ink a segment lays goes as the
        // square of the number computed here. Halve the exponent so the control
        // means what it says about deposited ink rather than about this local.
        inkScale = Math.pow(refWeight / weight, inkExponent * 0.5);
      }
    }
    // Compute the normal alpha, then multiply by scroll fade factor. The flat
    // boosted-particle add stays outside inkScale: it exists to make those
    // particles pop, and they run narrow, so normalizing it would blow it out.
    const normalAlpha = (isFgLayer ? fgBaseA : baseA) * renderAlphaWeight * minSpeedAlphaRamp * (1 + alphaBoost * (speedFactor - 1)) * duneAlphaFactor * inkScale + fastAlphaAdd;
    const alpha = Math.round(constrain(normalAlpha * scrollFadeFactor, 0, 255));
    const alphaPercent = alpha/255;
    const segment = clampRenderedSegment(
      p.displayX,
      p.displayY,
      interpX,
      interpY,
      maxSegLen
    );
    const glow = glowEnabled ? p.boxGlowIntensity * scrollFadeFactor : 0;
    if (glow > 0) {
      // Ember flicker, deliberately kept off `blend` below. blend is how far the
      // core has travelled toward the core color, so modulating it would drag the
      // hue back toward the base particle color on every dip and the ember would
      // change color as it breathes. The flicker is a level, not a color: it dims
      // and narrows something that stays fully core-colored. The envelope still
      // drives blend, so a glow that is genuinely fading does cool back to the
      // base color — that part is the fade, not the flicker.
      let flicker = 1;
      if (flickerDepth > 0) {
        // p5's noise() clusters hard around 0.5 and spends almost no time near
        // its endpoints, so raw output would make Depth do roughly half what it
        // says. Expand around the midpoint before using it.
        const n = constrain((noise(p.flickerPhase + flickerT) - 0.5) * 2.2 + 0.5, 0, 1);
        // Subtractive: spans 1-depth .. 1, so the un-flickered look is the
        // ceiling and nothing downstream can overshoot its range.
        flicker = 1 - flickerDepth + flickerDepth * n;
      }
      // Halo pass: wider stroke, base color, low alpha scaled by intensity.
      const haloA = Math.round(glowHaloAlpha * glow * flicker);
      const haloW = Math.max(0.5, weight * glowHaloSize);
      g.stroke(colorR, colorG, colorB, haloA * alphaPercent);
      g.strokeWeight(haloW);
      g.line(segment.fromX, segment.fromY, segment.toX, segment.toY);
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
      // Flicker dims the core's own alpha, not the lerp: scaling the whole
      // result would fade the particle underneath it too, so a barely-glowing
      // particle would flicker even though it has almost no ember left. Folding
      // it into the target instead means the flicker vanishes with blend.
      const coreA = Math.round(constrain((normalAlpha + (glowCoreA * flicker - normalAlpha) * blend), 0, 255));
      const coreW = weight + (glowCoreDiameter - weight) * glow * flicker;
      g.stroke(coreR, coreG, coreB, coreA * alphaPercent);
      g.strokeWeight(coreW);
      g.line(segment.fromX, segment.fromY, segment.toX, segment.toY);
      // Invalidate tracking since glow changed state unpredictably.
      prevStrokeR = coreR; prevStrokeG = coreG; prevStrokeB = coreB; prevStrokeA = coreA;
      prevWeight = coreW;
    } else {
      // Normal non-glow path with redundancy elimination.
      if (colorR !== prevStrokeR || colorG !== prevStrokeG || colorB !== prevStrokeB || alpha !== prevStrokeA) {
        g.stroke(colorR, colorG, colorB, alpha * alphaPercent);
        prevStrokeR = colorR;
        prevStrokeG = colorG;
        prevStrokeB = colorB;
        prevStrokeA = alpha;
      }
      if (weight !== prevWeight) {
        g.strokeWeight(weight);
        prevWeight = weight;
      }
      g.line(segment.fromX, segment.fromY, segment.toX, segment.toY);
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
