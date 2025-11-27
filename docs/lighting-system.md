# Ray-Traced Lighting System

## Overview

The battlemap lighting system uses **alpha-based ray tracing** to create realistic shadows that respect tile geometry. Light sources cast rays in all directions, and these rays are occluded by tiles with the `collision` effect based on their actual alpha channel values.

## Architecture

### Core Components

```
src/lib/battlemap/lighting/
├── occluderGrid.ts     - Spatial grid of light-blocking geometry
├── rayCasting.ts       - Ray tracing algorithms
├── shadowMap.ts        - Shadow map generation per light
├── lightRenderer.ts    - High-level rendering API
└── index.ts            - Public exports
```

### Data Flow

```
1. Build Occluder Grid
   ↓ (samples tile alpha channels at sub-cell resolution)
2. For Each Light Source
   ↓ (cast 360 rays in a circle)
3. Generate Visibility Polygon
   ↓ (ray hits create polygon vertices)
4. Apply Radial Gradient Mask
   ↓ (light falloff with distance)
5. Composite to Canvas
   ↓ (destination-out for darkness removal)
6. Apply Color Tint Overlay
   (optional warm light color)
```

## Key Features

### 1. Alpha-Based Occlusion

Unlike simple position-based blocking, the system samples the actual **alpha channel** of tile images:

- Pillars that only occupy 30% of a cell block light proportionally
- Semi-transparent tiles (windows, iron bars) partially block light
- Accurate shadows for irregular tile shapes

**Implementation:**
```typescript
const occluderGrid = await buildOccluderGrid(
  tiles,
  imageCache,
  resolution // 4 = 4x4 samples per cell
);
```

### 2. Ray Casting with Accumulation

Rays accumulate opacity as they pass through occluders:

```typescript
const result = castRay(
  lightX, lightY,    // Start position
  targetX, targetY,  // Target position
  occluderGrid,
  maxRadius
);
// Returns: { opacity: 0-1, distance: cells }
```

**Alpha Accumulation Formula:**
```typescript
// Each step absorbs light based on opacity
const absorption = opacity * stepSize;
accumulatedOpacity += absorption * (1 - accumulatedOpacity);
```

This creates realistic **light absorption** through semi-transparent media.

### 3. Visibility Polygon Generation

For each light source, rays are cast in a 360° circle:

```typescript
const vertices = generateVisibilityPolygon(
  centerX, centerY,
  radius,
  occluderGrid,
  rayCount // default 360
);
// Returns: [{x, y, opacity}, ...]
```

The resulting polygon defines the **lit area** and is rendered with a radial gradient for smooth falloff.

### 4. Shadow Map Rendering

Shadow maps are generated as off-screen canvases:

```typescript
const shadowMap = generateLightMap(
  centerX, centerY,
  radius,
  intensity,
  occluderGrid,
  canvasWidth, canvasHeight,
  cellSize, gridOrigin,
  worldToScreen
);
```

These are then composited using `destination-out` to "erase" darkness where light reaches.

## Configuration

### Lighting Parameters

All configurable via `LightingConfig`:

```typescript
type LightingConfig = {
  darknessOpacity: number;      // 0-1, base darkness level
  lightRadius: number;           // In cells (e.g., 3)
  lightIntensity: number;        // 0-1, brightness
  lightColor: string;            // Hex color for tint
  occluderResolution: number;    // Samples per cell (4 = 4x4 grid)
  rayCount: number;              // Rays per light (360 = smooth)
  applyColorTint: boolean;       // Enable warm color overlay
};
```

### Layer Properties

Light parameters are read from the **lighting layer** in the layer stack:

```typescript
const lightingLayer = layers.nodes["lighting"];
const lightRadius = lightingLayer.lightRadius ?? 2;
const lightIntensity = lightingLayer.lightIntensity ?? 1;
```

These can be adjusted in the UI via the layers panel.

## Performance

### Benchmarks (approximate)

| Metric | Value |
|--------|-------|
| Occluder grid build | ~5-20ms for 500 tiles |
| Ray casting per light | ~2-5ms at 360 rays |
| Shadow map generation | ~3-8ms per light |
| Total for 5 lights | ~40-100ms per frame |

### Optimizations

1. **Occluder Grid Caching**
   - Grid is rebuilt only when tiles change
   - Consider caching between frames if tiles are static

2. **Adaptive Ray Count**
   - Use `generateAdaptiveVisibilityPolygon()` for dynamic ray density
   - More rays near shadow edges, fewer in open areas

3. **Spatial Culling**
   - Only process lights within viewport + radius
   - Only include occluders within light range

4. **Resolution Tuning**
   - `occluderResolution: 4` is good balance (16 samples/cell)
   - Lower to 2-3 for faster performance
   - Raise to 6-8 for higher fidelity

5. **Ray Count Tuning**
   - 360 rays = very smooth shadows
   - 180 rays = good for most cases
   - 120 rays = acceptable for distant lights

### Future Optimizations

- **Web Worker**: Offload ray casting to worker thread
- **Dirty Region Tracking**: Cache shadow maps when lights don't move
- **Shadow Casting Algorithm**: Cast rays only at occluder edges (4× fewer rays)

## Usage

### Basic Integration

The system is integrated into [BattlemapCanvas.tsx:2077-2127](../src/lib/components/battlemap/BattlemapCanvas.tsx#L2077-L2127):

```typescript
await renderRayTracedLighting(
  ctx,
  width, height,
  placedTiles,      // All tiles
  lightingTiles,    // Tiles on "lighting" layer
  imageCache,
  CELL_SIZE,
  GRID_ORIGIN,
  worldToScreen,
  {
    darknessOpacity,
    lightRadius,
    lightIntensity,
    lightColor: "#e1be7a",
    occluderResolution: 4,
    rayCount: 360,
    applyColorTint: true,
  },
  shadingImg,
  camera
);
```

### Creating Light Sources

Place any tile on the **"lighting" layer** to make it emit light:

1. Select a tile (torch, brazier, etc.)
2. Set layer to "lighting"
3. Adjust light radius/intensity in layer properties

### Configuring Occluders

Tiles block light if they have the `collision` effect:

```typescript
// In tileMetadata.ts
walls: { effects: ["collision", "unlit"] },
pillars: { effects: ["collision", "unlit"] },
doors: { effects: ["collision", "interactive"] },
```

The `unlit` effect prevents tiles from receiving light (keeps walls dark).

## Tile Metadata Effects

### `collision`
- Blocks light rays
- Alpha channel sampled at sub-cell resolution
- Partial transparency = partial occlusion

### `unlit`
- Tile does not receive light
- Stays dark even if in light radius
- Useful for walls, pillars that should cast shadows

### `light_source`
- Marks tiles that emit light (legacy)
- Now determined by placement on "lighting" layer
- Can be used for tile-specific light properties (future)

## Visual Comparison

### Before (Simple Radial Gradient)
- Light passes through walls
- Uniform circular light pattern
- Walls redrawn on top (mask hack)
- No geometry awareness

### After (Ray-Traced)
- Light blocked by walls, doors, pillars
- Realistic shadow shapes
- Respects tile alpha channels
- Partial occlusion for semi-transparent tiles

## Known Limitations

1. **Single-Sample Ray Marching**
   - Rays sample at 0.125 cell intervals
   - Very thin features (<12.5% cell width) may be missed
   - Increase occluder resolution or ray step density if needed

2. **No Light Bouncing**
   - Light doesn't reflect off surfaces
   - Pure occlusion model only
   - Future: add ambient light term for indirect lighting

3. **No Colored Shadows**
   - Shadows are always black (darkness)
   - Future: support colored glass/stained windows

4. **Static Geometry**
   - Occluder grid assumes tiles don't move during frame
   - Rebuild required if tiles are animated/moved

## Troubleshooting

### "Light passes through thin pillars"
- Increase `occluderResolution` from 4 to 6 or 8
- Check that tile has `collision` effect
- Verify tile alpha channel is opaque

### "Shadows are jagged/pixelated"
- Increase `rayCount` from 360 to 720
- Or use `generateAdaptiveVisibilityPolygon()`

### "Performance is slow"
- Reduce `rayCount` to 180-240
- Reduce `occluderResolution` to 2-3
- Cull lights outside viewport

### "Walls are still lit"
- Add `unlit` effect to wall tile metadata
- Check that tiles are marked as `collision` types

### "Light color doesn't show"
- Ensure `applyColorTint: true`
- Check `lightColor` is valid hex
- Increase `lightIntensity`

## API Reference

See type definitions in:
- [occluderGrid.ts](../src/lib/battlemap/lighting/occluderGrid.ts)
- [rayCasting.ts](../src/lib/battlemap/lighting/rayCasting.ts)
- [shadowMap.ts](../src/lib/battlemap/lighting/shadowMap.ts)
- [lightRenderer.ts](../src/lib/battlemap/lighting/lightRenderer.ts)

## Credits

Inspired by classic ray casting techniques from early 3D games (Wolfenstein 3D, Doom) adapted for 2D top-down lighting with modern alpha-based occlusion.
