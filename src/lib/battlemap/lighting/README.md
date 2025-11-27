# Battlemap Lighting System

Alpha-based ray tracing for realistic dynamic lighting and shadows.

## Overview

This module implements a complete ray-traced lighting system for the battlemap that:
- ✅ Blocks light at walls, doors, and pillars
- ✅ Samples tile alpha channels for accurate occlusion
- ✅ Supports semi-transparent occluders
- ✅ Generates smooth shadow boundaries
- ✅ Applies warm color tints to lit areas

## Quick Start

```typescript
import { renderRayTracedLighting } from '@/lib/battlemap/lighting';

await renderRayTracedLighting(
  ctx,                // Canvas 2D context
  width, height,      // Canvas dimensions
  placedTiles,        // All tiles on map
  lightingTiles,      // Tiles that emit light
  imageCache,         // Loaded images
  CELL_SIZE,          // Grid cell size (px)
  GRID_ORIGIN,        // World origin offset
  worldToScreen,      // Coordinate transform
  {
    darknessOpacity: 0.8,
    lightRadius: 3,
    lightIntensity: 1.0,
    lightColor: "#e1be7a",
    occluderResolution: 4,
    rayCount: 360,
    applyColorTint: true,
  },
  shadingImg,         // Optional shading texture
  camera              // Camera state
);
```

## Architecture

### Modules

- **[occluderGrid.ts](./occluderGrid.ts)** - Spatial grid of light-blocking geometry
  - `buildOccluderGrid()` - Sample tile alphas at sub-cell resolution
  - `sampleOccluderGrid()` - Query opacity at any position
  - `getOccupiedCells()` - Get all cells with geometry

- **[rayCasting.ts](./rayCasting.ts)** - Ray tracing algorithms
  - `castRay()` - Trace single ray with opacity accumulation
  - `castRayCone()` - Trace cone of rays for soft shadows
  - `generateVisibilityPolygon()` - Cast 360° of rays from a point
  - `generateAdaptiveVisibilityPolygon()` - Adaptive ray density

- **[shadowMap.ts](./shadowMap.ts)** - Shadow map rendering
  - `generateShadowMap()` - Create lit area polygon
  - `generateLightMap()` - Shadow map + radial gradient
  - `generateLightTintMap()` - Colored light overlay
  - `generateLightMapsBatch()` - Process multiple lights

- **[lightRenderer.ts](./lightRenderer.ts)** - High-level API
  - `renderRayTracedLighting()` - Complete lighting pipeline
  - `createUnlitMask()` - Mask for unlit tiles

### Data Flow

```
Tiles → buildOccluderGrid() → OccluderGrid
                                    ↓
Light Source → generateVisibilityPolygon(grid)
                                    ↓
                        Visibility Polygon
                                    ↓
                    generateLightMap()
                                    ↓
                        Shadow Map Canvas
                                    ↓
              Composite to Main Canvas
```

## Configuration

```typescript
type LightingConfig = {
  darknessOpacity: number;      // 0-1, base darkness
  lightRadius: number;           // Cells (e.g., 3)
  lightIntensity: number;        // 0-1, brightness
  lightColor: string;            // Hex color
  occluderResolution: number;    // Samples/cell (4 = 4×4)
  rayCount: number;              // Rays/light (360)
  applyColorTint: boolean;       // Warm overlay
};
```

## Performance

| Operation | Time (ms) | Notes |
|-----------|-----------|-------|
| buildOccluderGrid | 5-20 | 500 tiles, 4×4 resolution |
| castRay (360×) | 2-5 | Per light source |
| generateLightMap | 3-8 | Per light source |
| **Total (5 lights)** | **40-100** | Target: <16ms (60fps) |

### Optimization

**Reduce cost:**
- Lower `occluderResolution` to 2-3
- Lower `rayCount` to 180-240
- Cache occluder grid between frames

**Increase quality:**
- Raise `occluderResolution` to 6-8
- Raise `rayCount` to 540-720
- Use `generateAdaptiveVisibilityPolygon()`

## Examples

### Basic Usage

```typescript
const occluderGrid = await buildOccluderGrid(
  tiles,
  imageCache,
  4 // 4×4 samples per cell
);

const vertices = generateVisibilityPolygon(
  lightX, lightY,
  lightRadius,
  occluderGrid,
  360 // ray count
);

const shadowMap = generateLightMap(
  lightX, lightY,
  lightRadius,
  intensity,
  occluderGrid,
  canvasWidth,
  canvasHeight,
  cellSize,
  gridOrigin,
  worldToScreen
);

ctx.globalCompositeOperation = "destination-out";
ctx.drawImage(shadowMap, 0, 0);
```

### Ray Casting

```typescript
const result = castRay(
  lightX, lightY,      // Start
  targetX, targetY,    // End
  occluderGrid,
  maxDistance
);

console.log(result.opacity);   // 0-1 (accumulated)
console.log(result.distance);  // Cells traveled
```

### Sampling Occluders

```typescript
const opacity = sampleOccluderGrid(
  occluderGrid,
  5.2,  // X in cells (fractional)
  3.7   // Y in cells (fractional)
);
// Returns: 0-1 opacity at this position
```

## Tile Effects

The system uses tile metadata effects:

- **`collision`** - Blocks light (alpha-sampled)
- **`unlit`** - Tile stays dark, doesn't receive light

Example:
```typescript
// In tileMetadata.ts
walls: { effects: ["collision", "unlit"] },
pillars: { effects: ["collision", "unlit"] },
doors: { effects: ["collision", "interactive"] },
```

## Testing

Run TypeScript compiler:
```bash
npx tsc --noEmit
```

Check integration:
```bash
# Verify imports
grep -r "renderRayTracedLighting" src/
```

## Documentation

- **Quick Start**: [docs/lighting-quick-start.md](../../../../docs/lighting-quick-start.md)
- **Full Guide**: [docs/lighting-system.md](../../../../docs/lighting-system.md)
- **Architecture**: [docs/lighting-system-diagram.md](../../../../docs/lighting-system-diagram.md)
- **Summary**: [docs/lighting-redesign-summary.md](../../../../docs/lighting-redesign-summary.md)

## Future Enhancements

- [ ] Colored shadows (stained glass)
- [ ] Light bouncing (indirect lighting)
- [ ] Ambient occlusion
- [ ] Dynamic occluders (moving objects)
- [ ] Web Worker support
- [ ] Adaptive quality based on zoom
- [ ] Shadow caching when static
- [ ] Per-tile light colors

## License

Part of the campaign-tool project.
