# Ray-Traced Lighting - Quick Start Guide

## 5-Minute Setup

### 1. Add Light Sources

**Option A: Using the UI**
1. Open the battlemap
2. Select a torch/brazier/light tile from the tileset
3. Place it on the map
4. In the layers panel, set its layer to **"Lighting"**

**Option B: In Code**
```typescript
const lightTile = {
  id: "light-1",
  cellX: 10,
  cellY: 8,
  src: "/assets/battlemap/Decoration/Torches/torch.png",
  layer: "lighting",  // or layerId: "lighting"
  rotationIndex: 0,
  order: 0
};
```

### 2. Configure Light Properties

In the **Layers Panel**:
- Select the "Lighting" layer
- Adjust **Light Radius** (2-5 cells typical)
- Adjust **Light Intensity** (0-1, default 1)

Or in code:
```typescript
layers.nodes["lighting"] = {
  ...layers.nodes["lighting"],
  lightRadius: 3,      // 3 cells
  lightIntensity: 1.0  // Full brightness
};
```

### 3. Set Darkness Level

Adjust the map-wide darkness:
```typescript
layers.mapDarknessOpacity = 0.8;  // 80% darkness
```

Or use the UI slider in the layers panel.

### 4. Verify Occluders

Make sure walls/pillars block light:
```typescript
// In tileMetadata.ts
walls: { effects: ["collision", "unlit"] },
pillars: { effects: ["collision", "unlit"] },
```

The `collision` effect makes tiles block light.
The `unlit` effect keeps them dark.

### 5. Test It!

- Place a torch on the map
- Place walls around it
- Observe light being blocked by walls
- See realistic shadow shapes

## Common Adjustments

### Softer Shadows
```typescript
lightRadius: 4,        // Larger radius
lightIntensity: 0.7,   // Lower intensity
darknessOpacity: 0.6   // Less darkness
```

### Harsher Shadows
```typescript
lightRadius: 2,        // Smaller radius
lightIntensity: 1.0,   // Full intensity
darknessOpacity: 0.9   // More darkness
```

### Warmer Light
```typescript
lightColor: "#ffaa55",  // Orange
applyColorTint: true
```

### Cooler Light (Moonlight)
```typescript
lightColor: "#aaccff",  // Blue-ish
lightIntensity: 0.5
```

## Performance Tuning

### If Lagging

**Quick fix:**
```typescript
rayCount: 180,           // Half the rays
occluderResolution: 3    // Lower resolution
```

**Better fix:**
- Cull lights outside viewport
- Use adaptive ray count
- Cache occluder grid between frames

### If Shadows Look Bad

**Increase quality:**
```typescript
rayCount: 540,           // More rays
occluderResolution: 6    // Higher resolution
```

## Troubleshooting

### Light passes through walls
✅ **Solution**: Add `collision` effect to wall tiles
```typescript
walls: { effects: ["collision", "unlit"] }
```

### Walls are too bright
✅ **Solution**: Add `unlit` effect to keep them dark
```typescript
walls: { effects: ["collision", "unlit"] }
```

### Thin pillars fully block light
✅ **Solution**: This is correct! The pillar's alpha channel is being sampled. If it appears too blocky:
- Increase `occluderResolution` to 6 or 8
- Use higher-resolution pillar artwork

### Shadows are jagged
✅ **Solution**: Increase `rayCount` from 360 to 540 or 720

### Performance issues
✅ **Solution**: See "Performance Tuning" above

## Advanced: Custom Light Colors Per Tile

Currently all lights use the global `lightColor`. To add per-tile colors:

```typescript
// In tileMetadata.ts
torches: {
  effects: ["light_source"],
  lightRadius: 1.5,
  lightColor: "#ff6b35",  // Orange flame
}

// In lightRenderer.ts (future enhancement)
// Read lightColor from tile metadata instead of config
```

## Advanced: Animated Lights

Add flickering effect:
```typescript
// In render loop
const flickerIntensity =
  0.8 + Math.sin(Date.now() / 200) * 0.2;

layers.nodes["lighting"].lightIntensity = flickerIntensity;
```

## Advanced: Colored Shadows (Future)

Not yet implemented, but architecture supports:
```typescript
// Proposed API
const coloredGlass = {
  effects: ["collision", "colored_filter"],
  filterColor: "#ff0000",  // Red glass
  filterOpacity: 0.5       // 50% transparent
};
```

## Example Configurations

### Dungeon Torches
```typescript
{
  darknessOpacity: 0.85,
  lightRadius: 2,
  lightIntensity: 1.0,
  lightColor: "#e1be7a",  // Warm golden
  rayCount: 360
}
```

### Outdoor Moonlight
```typescript
{
  darknessOpacity: 0.4,   // Less dark
  lightRadius: 8,         // Large radius
  lightIntensity: 0.3,    // Dim
  lightColor: "#c0d8ff",  // Cool blue
  rayCount: 180           // Fewer rays (performance)
}
```

### Magical Glow
```typescript
{
  darknessOpacity: 0.7,
  lightRadius: 3,
  lightIntensity: 1.0,
  lightColor: "#aa55ff",  // Purple
  rayCount: 360
}
```

### Campfire
```typescript
{
  darknessOpacity: 0.8,
  lightRadius: 4,         // Larger radius
  lightIntensity: 0.9,
  lightColor: "#ff8833",  // Orange-red
  rayCount: 360
}
```

## Debug Mode

To visualize occluder grid (future feature):
```typescript
// Draw occluder grid overlay
for (const [key, opacity] of occluderGrid.data) {
  const [x, y, subX, subY] = key.split(',').map(Number);
  // Draw semi-transparent red square at this position
  ctx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.5})`;
  ctx.fillRect(screenX, screenY, cellSize/4, cellSize/4);
}
```

## Next Steps

- See [lighting-system.md](./lighting-system.md) for full documentation
- See [lighting-system-diagram.md](./lighting-system-diagram.md) for visual architecture
- Check [BattlemapCanvas.tsx](../src/lib/components/battlemap/BattlemapCanvas.tsx) for implementation
- Explore [lighting/](../src/lib/battlemap/lighting/) source code

## Questions?

Common questions answered in [lighting-system.md](./lighting-system.md#troubleshooting)
