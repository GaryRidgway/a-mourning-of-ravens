const RENDER_COLORS = {
  fade: [0, 0, 0],
  particles: [112, 0, 0, 208],
  windBoostColor: [255, 200, 0],
  separationZone: [130, 175, 235],
  boxStrokeIdle: [200, 200, 180, 0],
  boxStrokeDragged: [250, 230, 190, 0],
  boxGlowCore: [209, 0, 0, 255],
};

const RENDER_COLORS_DEFAULTS = {};
for (const k in RENDER_COLORS) {
  RENDER_COLORS_DEFAULTS[k] = RENDER_COLORS[k].slice();
}
