# Ray-Traced Lighting System - Visual Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     BATTLEMAP CANVAS                             │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Tiles      │  │   Lighting   │  │   Camera     │          │
│  │  (placed)    │  │   Tiles      │  │   State      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                  │
│                            ▼                                     │
│              ┌──────────────────────────────┐                    │
│              │  renderRayTracedLighting()   │                    │
│              └──────────────┬───────────────┘                    │
└────────────────────────────┼──────────────────────────────────┘
                             │
        ╔════════════════════╧════════════════════╗
        ║     LIGHTING SYSTEM PIPELINE            ║
        ╚════════════════════╤════════════════════╝
                             │
    ┌────────────────────────┴────────────────────────┐
    │                                                  │
    ▼                                                  ▼
┌───────────────────┐                    ┌────────────────────┐
│ STEP 1:           │                    │ PARALLEL:          │
│ Build Occluder    │                    │ Load Shading       │
│ Grid              │                    │ Texture            │
└─────┬─────────────┘                    └────────┬───────────┘
      │                                           │
      │  ┌────────────────────────────────────┐  │
      └─▶│ buildOccluderGrid()                │◀─┘
         │ • Sample tile alpha channels       │
         │ • 4x4 grid per cell                │
         │ • Store in spatial hash            │
         └─────────────┬──────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────────────┐
         │ OccluderGrid:                       │
         │ Map<"x,y,subX,subY", opacity>       │
         └─────────────┬──────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────────────┐
         │ STEP 2:                             │
         │ Create Darkness Canvas              │
         │ • Draw shading texture (tiled)      │
         │ • Apply darknessOpacity             │
         └─────────────┬──────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────────────┐
         │ STEP 3: For Each Light Source       │
         └─────────────┬──────────────────────┘
                       │
           ╔═══════════╧═══════════╗
           ║   PER-LIGHT PIPELINE  ║
           ╚═══════════╤═══════════╝
                       │
                       ▼
         ┌─────────────────────────────────────┐
         │ generateVisibilityPolygon()         │
         │ • Cast 360 rays in circle           │
         │ • Each ray: castRay()               │
         │   - Step at 0.125 cell intervals   │
         │   - Sample occluder grid            │
         │   - Accumulate opacity              │
         │   - Stop at full occlusion          │
         │ • Return polygon vertices           │
         └─────────────┬──────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────────────┐
         │ generateLightMap()                  │
         │ • Draw visibility polygon           │
         │ • Apply radial gradient mask        │
         │   (light falloff with distance)     │
         │ • Return light canvas               │
         └─────────────┬──────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────────────┐
         │ Composite to Darkness Canvas        │
         │ • globalCompositeOperation:         │
         │   "destination-out"                 │
         │ • Erases darkness where light is    │
         └─────────────┬──────────────────────┘
                       │
           ╔═══════════╧═══════════╗
           ║   (Repeat for all     ║
           ║    light sources)     ║
           ╚═══════════╤═══════════╝
                       │
                       ▼
         ┌─────────────────────────────────────┐
         │ STEP 4:                             │
         │ Draw Darkness to Main Canvas        │
         └─────────────┬──────────────────────┘
                       │
                       ▼
         ┌─────────────────────────────────────┐
         │ STEP 5: Color Tint (Optional)       │
         │ For Each Light:                     │
         │ • generateLightTintMap()            │
         │ • Apply with "overlay" blend        │
         │ • Creates warm light color          │
         └─────────────────────────────────────┘
```

## Ray Casting Detail

```
                  Light Source @ (5, 5)
                        ◉
                       /|\
                      / | \
    Ray 1 → → → → → /  |  \ ← ← ← ← ← Ray 359
                   /   |   \
                  /    |    \
                 /  Ray 180  \
                /      ↓      \
               /       ↓       \
              /        ↓        \
    ┌────────────────────────────────┐
    │                                │
    │    ╔═══════╗   Open Space     │
    │    ║ Wall  ║                   │
    │    ║  ███  ║   Ray blocked     │
    │    ║  ███  ║◄──── here         │
    │    ╔═══════╝                   │
    │                                │
    │    Rays continue               │
    │    in shadow                   │
    └────────────────────────────────┘

Ray Accumulation:
  Step 1: opacity = 0.0  (open air)
  Step 2: opacity = 0.0  (open air)
  Step 3: opacity = 0.8  (hit wall alpha)
  Step 4: opacity = 0.96 (absorb more)
  Step 5: opacity = 1.0  (fully blocked)
  → Ray stops, vertex placed at Step 5 position
```

## Occluder Grid Sampling

```
┌─────────────────────────────────────────┐
│         Single Grid Cell (1x1)          │
│                                          │
│  Sub-grid sampling at 4x4 resolution:   │
│                                          │
│    0.0  0.0  0.0  0.0                   │
│    0.0  0.8  0.9  0.0                   │
│    0.0  0.9  1.0  0.2                   │
│    0.0  0.3  0.2  0.0                   │
│                                          │
│  Each value = alpha from tile image     │
│  Pillar occupies ~40% of cell           │
└─────────────────────────────────────────┘

When ray passes at position (cellX, cellY, 0.6, 0.7):
  → Sample subgrid[2][2] = 1.0
  → Ray heavily absorbed here
```

## Shadow Map Generation

```
STEP A: Cast rays, get vertices

     ◉ Light
    /│\
   / │ \
  /  │  \
 v1  v2  v3  ← Vertices from ray casting
  \  │  /
   \ │ /
    v│v
   ──█──  Wall
      █


STEP B: Draw visibility polygon

  Canvas (white = lit)
  ┌──────────────┐
  │              │
  │   ▓▓▓▓▓▓     │  ▓ = lit area (white)
  │   ▓▓◉▓▓▓     │
  │   ▓▓▓▓▓▓     │
  │   ──███──    │  █ = wall shadow (black)
  │     ███      │
  └──────────────┘


STEP C: Apply radial gradient mask

  Canvas (opacity falloff)
  ┌──────────────┐
  │   ░░░░       │  ░ = dim (far from light)
  │   ░▓▓▓░      │  ▓ = bright (near light)
  │   ░▓◉▓░      │  ◉ = full intensity
  │   ░▓▓▓░      │
  │   ──███──    │  █ = shadow (no light)
  │     ███      │
  └──────────────┘


STEP D: Composite to darkness layer

  Darkness (black = dark, transparent = lit)
  ┌──────────────┐
  │ ████████████ │
  │ ███░▓◉▓░████ │  destination-out removes
  │ ████░░░█████ │  darkness where light is
  │ ██████████   │
  └──────────────┘
```

## Blend Mode Summary

| Stage | Blend Mode | Effect |
|-------|------------|--------|
| Darkness base | `source-over` | Draw black background |
| Light removal | `destination-out` | Erase darkness where light is |
| Color tint | `overlay` | Apply warm color to lit areas |
| Radial gradient | `destination-in` | Mask to light shape |

## Data Structures

```typescript
// Occluder Grid (spatial hash)
{
  data: Map {
    "5,3,0,0" => 0.2,  // Cell (5,3), sub (0,0) = 20% opaque
    "5,3,1,0" => 0.8,  // Cell (5,3), sub (1,0) = 80% opaque
    "5,3,1,1" => 1.0,  // Cell (5,3), sub (1,1) = fully opaque
    // ... thousands more entries
  },
  resolution: 4  // 4x4 samples per cell
}

// Visibility Polygon (per light)
[
  { x: 5.2, y: 3.8, opacity: 0.0 },  // Vertex 0 (unobstructed)
  { x: 5.3, y: 3.7, opacity: 0.0 },  // Vertex 1 (unobstructed)
  { x: 5.4, y: 3.6, opacity: 1.0 },  // Vertex 2 (hit wall)
  // ... 360 vertices total
]

// Light Configuration
{
  darknessOpacity: 0.8,
  lightRadius: 3,          // 3 cells
  lightIntensity: 1.0,
  lightColor: "#e1be7a",   // Warm golden
  occluderResolution: 4,
  rayCount: 360,
  applyColorTint: true
}
```

## Performance Profile

```
┌─────────────────────────────────────────────────────┐
│ Frame Budget: 16.67ms (60 FPS)                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  buildOccluderGrid()     ████████ 8ms               │
│                                                      │
│  Light 1                 ███ 3ms                    │
│  Light 2                 ███ 3ms                    │
│  Light 3                 ███ 3ms                    │
│  Light 4                 ███ 3ms                    │
│  Light 5                 ███ 3ms                    │
│                                                      │
│  Composite & Tint        ██ 2ms                     │
│                                                      │
│  TOTAL                   █████████████████ 25ms     │
│                                                      │
│  ⚠ Over budget by 8.33ms (need optimization)        │
└─────────────────────────────────────────────────────┘

Optimization Target: ~12ms total (under budget)
```

## Configuration Trade-offs

| Parameter | Low | Medium | High |
|-----------|-----|--------|------|
| **occluderResolution** | 2 (4 samples) | 4 (16 samples) | 8 (64 samples) |
| Quality | Blocky shadows | Balanced | Accurate |
| Cost | ~2ms | ~8ms | ~30ms |
| | | | |
| **rayCount** | 120 | 360 | 720 |
| Quality | Angular shadows | Smooth | Very smooth |
| Cost/light | ~1ms | ~3ms | ~6ms |
| | | | |
| **lightRadius** | 2 cells | 3 cells | 5 cells |
| Quality | Small pools | Normal | Large areas |
| Cost/light | ~2ms | ~3ms | ~5ms |
