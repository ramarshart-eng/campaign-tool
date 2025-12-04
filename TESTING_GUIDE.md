# Quick Testing & Validation Guide

## Summary of Changes

✅ **Occluders now fully opaque:** Any alpha > 0 blocks light (binarized)  
✅ **Faster sampling:** Binary nearest-neighbor check (1 Map lookup vs 4)  
✅ **Removed double-masking:** Single visibility polygon clip, no per-tile `destination-out`  
✅ **Adaptive rays:** 240 base rays with edge refinement (instead of 1440 uniform)  
✅ **Polygon cache:** Reused across lights and color passes

---

## What to Test

### 1. **No Light on Occluders**

- Open the battlemap
- Place a light source near walls or circular occluders
- **Expected:** Walls and circular tokens remain dark (no light bleeding through)
- **Check:** Console logs should show occluder grid built with binary values

### 2. **Circular Shadow Fidelity**

- Place a circular token (creature) in light
- Look at the shadow edge
- **Expected:** Smooth, accurate circular boundary (not jagged or "starbursts")
- **Check:** Shadow should follow the token outline closely

### 3. **Multiple Lights Performance**

- Add 3–5 lights to a small area with overlapping radii
- Monitor frame rate / rendering time
- **Expected:** Faster than before; polygon cache should reduce ray work
- **Check:** Console should show cache hits (reused vertices) for same-position lights

### 4. **Color Overlay Accuracy**

- With `applyColorTint: true` or colored lights enabled
- **Expected:** Color tint matches the white light clipping boundary
- **Check:** No extra color halos beyond shadow edge

### 5. **Edge Cases**

- **No lights:** Should show full darkness; no errors
- **Light fully inside occluder:** Should show no light
- **Light at tile edge:** Shadow should be crisp, no artifacts

---

## Console Log Inspection

Look for these logs when rendering starts:

```
🔦 [LIGHTING] renderRayTracedLighting called {
  placedTiles: <count>,
  lightingTiles: <count>,
  config: {...}
}

[Lighting] Occluder grid built: {
  totalOccluders: <count>,
  resolution: 8,
  alphaThreshold: 0,
  processedTiles: <count>
}

[Lighting] Drawing light: {
  cellPos: {x, y},
  screenPos: {x, y},
  radius: <radius>,
  vertices: <count>  // Polygon vertex count from adaptive ray casting
}

[RayCasting] Visibility polygon: {
  center: {x, y},
  radius: <radius>,
  rayCount: <count>,
  blockedRays: <count>,
  blockagePercent: "<percent>%",
  uniqueDistances: <count>,
  sampleDistances: [...]  // Should show mostly 2–3 unique values if rays are blocked
}
```

**Good signs:**

- `totalOccluders` > 0 (occluders detected)
- `blockagePercent` reflects actual obstructions
- `vertices` count reasonable (120–480 range for adaptive)
- Multiple lights with same position show cache reuse (fewer consecutive log entries)

---

## Performance Benchmarking

### Before (1440 uniform rays)

- 5 lights: ~50–100ms per frame
- Many ray samples, lots of Map lookups

### After (240 adaptive rays + caching)

- 5 lights: ~10–30ms per frame (estimated 2–5× speedup)
- Fewer rays, binary check, cache hits

**How to measure:**

```javascript
// In console or performance profiler:
performance.mark("lighting-start");
// ... call renderRayTracedLighting ...
performance.mark("lighting-end");
performance.measure("lighting", "lighting-start", "lighting-end");
console.log(performance.getEntriesByName("lighting")[0].duration);
```

---

## Troubleshooting

### Issue: Still seeing light on walls

- Check that `alphaThreshold` is `0` (default)
- Verify occluder grid is built (check log for `totalOccluders > 0`)
- Ensure collision tiles have the "collision" effect metadata

### Issue: Circular shadows are jagged

- Increase `rayCount` in config (try 360–480)
- If still jagged, check `generateAdaptiveVisibilityPolygon` refinement parameters

### Issue: Performance not improved

- Verify polygon cache is being reused (look for same cache keys in logs)
- Check that you're not creating new lights at different positions every frame (defeats cache)

### Issue: Color tint doesn't match white light

- Ensure both white light and color pass use the same cached polygon
- Check blend mode (should be `overlay` for color)

---

## Configuration Knobs

In `lightRenderer.ts` or config passed to `renderRayTracedLighting`:

```typescript
config: {
  rayCount: 240,           // Base rays (120 min, up to 720 max with refinement)
  occluderResolution: 8,   // Subcells per grid cell (higher = more detail, slower build)
  lightRadius: 4,          // Light spread in cells
  lightIntensity: 1,       // Brightness
  darknessOpacity: 0.8,    // How dark the night is
}

// In buildOccluderGrid call:
alphaThreshold: 0          // Any alpha > 0 is opaque; raise to 0.1 to ignore noise
```

---

## Code Locations

- **Binarization & sampling:** `src/lib/battlemap/lighting/occluderGrid.ts`
- **Adaptive rays & caching:** `src/lib/battlemap/lighting/lightRenderer.ts`
- **Ray casting logic:** `src/lib/battlemap/lighting/rayCasting.ts` (unchanged, already supports binary)
- **Documentation:** `LIGHTING_IMPROVEMENTS.md` (this repo)

---

## Next Steps (Optional Future Work)

1. **Typed arrays:** Replace `Map<string, number>` with numeric indices for 2–3× faster sampling
2. **Sweep-based visibility:** Exact polygons via segment intersection (better for complex shapes)
3. **Circle primitives:** Metadata-driven circular occluders with ray-circle intersection (perfect round shadows)
4. **GPU backend:** WebGL shadow map + SDF for soft penumbra and high performance
