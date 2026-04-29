// Default values for the Smoke A / Smoke B controls in index.html.
// Keys mirror the deriveKey() output used by the smoke control init script
// (e.g. s1OffsetX, s1Reverse, s2L1Speed, s1Enabled). Numeric / select values
// are stored as the string the input expects; bool toggles use booleans.
const SMOKE_DEFAULTS = {
  // Smoke A (#smoke-container-1)
  s1Enabled: false,
  s1Scale: '1',
  s1OffsetX: '243',
  s1OffsetY: '435',
  s1Rotation: '15',
  s1Opacity: '1',
  s1Brightness: '1',
  s1Saturation: '2',
  s1Hue: '195',
  s1Reverse: true,
  s1Blend: 'screen',
  s1L1Speed: '68',
  s1L1Start: '0',
  s1L2Speed: '125.4',
  s1L2Start: '0',
  s1L3Speed: '138.4',
  s1L3Start: '-50.4',

  // Smoke B (#smoke-container-2)
  s2Enabled: false,
  s2Scale: '0.67',
  s2OffsetX: '611',
  s2OffsetY: '2000',
  s2Rotation: '16',
  s2Opacity: '1',
  s2Brightness: '1.23',
  s2Saturation: '5',
  s2Hue: '195',
  s2Reverse: false,
  s2Blend: 'screen',
  s2L1Speed: '37.3',
  s2L1Start: '-26',
  s2L2Speed: '76.7',
  s2L2Start: '-20.8',
  s2L3Speed: '142.8',
  s2L3Start: '-60',
};
