# A Mourning of Ravens

An interactive poetry experience with a particle flow-field background.

## Running

```bash
npm install
npm run watch
```

## URL Parameters

All parameters are set as query string values, e.g. `http://localhost:3000?debug&auto=0.5`.

### Application Flags

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `debug` | flag (presence) | off | Shows the control panel, performance HUD, and pause button. Without this parameter the UI is hidden. |
| `auto` | float | _(disabled)_ | Enables auto-scrolling of the poem at the given speed (pixels per frame). e.g. `auto=0.5`. |
| `perf` | `1` | off | Enables a performance timing probe that logs frame statistics to the console. |

### Word Collider Settings

These control how poem text interacts with the particle flow field.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enableWordColliders` | `0` / `1` | `1` | Enables or disables word collision boxes that deflect particles. |
| `wordBoxes` | `0` / `1` | `1` | Enables or disables the visible word bounding boxes. |
| `wordInset` | float (px) | `0` | Insets word collision boxes equally on both axes. Overridden per-axis by `wordInsetX` / `wordInsetY`. |
| `wordInsetX` | float (px) | `0` | Horizontal inset for word collision boxes. |
| `wordInsetY` | float (px) | `0` | Vertical inset for word collision boxes. |
| `wordOffsetX` | float (px) | `-0.5` | Horizontal offset applied to word collision boxes. |
| `wordOffsetY` | float (px) | `0` | Vertical offset applied to word collision boxes. |

### Flow Field Config Overrides

Any key from the simulation's `CONFIG` object can be set directly as a URL parameter to override its default or cached value. For example:

```
?debug&particleCount=5000&ambientWindStrength=0.2&enableDuneBands=false
```

Boolean values accept `1`, `true`, `0`, or `false`. Numeric values are parsed as floats. Color parameters accept hex values (e.g. `color_fade=%23221a0f`). These overrides are applied on page load and reflected in the control panel when `debug` is enabled.
