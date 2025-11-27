# Tile Metadata & Effects System - Implementation Summary

## Overview

A comprehensive tile categorization and effects system has been implemented to enable advanced game mechanics based on tile types.

## Files Created

### 1. `src/lib/battlemap/tileMetadata.ts`

Core metadata system defining:

**Tile Categories (6 main types):**

- Structure (Walls, Pillars, Railings, Doors, Stairs)
- Terrain (Floor, Ground, Water, Special Surfaces)
- Vegetation (Trees, Bushes, Grass, Flowers)
- Decoration (Furniture, Objects, Torches, Rocks, Chains, Banners)
- Hazard (Fire, Spikes, Traps, Magical)
- Lighting (Light Sources, Shadow Effects)

**Tile Effects (10 effect types):**

- `collision` - Blocks movement
- `hazard` - Deals damage (with customizable damage amount and type)
- `interactive` - Can be interacted with (doors, levers, chests)
- `light_source` - Emits light (with configurable radius and color)
- `shadow` - Creates shadow
- `difficult_terrain` - Slows movement (with cost multiplier)
- `water` - Water terrain
- `particle` - Spawn particles (fire, sparks, smoke, etc)
- `sound` - Trigger sound effect
- `visual_effect` - Special visual effect

**Metadata Properties:**

- `hazardDamage` - Damage per interaction
- `hazardType` - Type of damage (fire, cold, lightning, poison, slashing)
- `lightRadius` - Light radius in tiles
- `lightColor` - Light color (hex)
- `difficultyMultiplier` - Movement cost multiplier
- `interactiveType` - Type of interaction
- `soundEvent` - Sound to trigger
- `particleType` - Type of particle effect

**Key Functions:**

- `getTileMetadata()` - Get metadata for a tile
- `parseTilePathMetadata()` - Parse category/subcategory from file path
- `hasTileEffect()` - Check if tile has specific effect
- `filterTilesByEffect()` - Find tiles with specific effect

### 2. `src/lib/battlemap/tileEffects.ts`

Game mechanics helpers for using tile metadata:

**Tile Enrichment:**

- `enrichTileWithMetadata()` - Add metadata to placed tile

**Effect Checking Functions:**

- `isTileSolid()` - Has collision
- `isTileHazard()` - Deals damage
- `isTileInteractive()` - Can be interacted with
- `isTileDifficultTerrain()` - Slows movement
- `isTileWater()` - Water tile
- `isTileLightSource()` - Emits light

**Property Getters:**

- `getTileHazardDamage()` - Get damage amount
- `getTileLightProperties()` - Get light radius and color
- `getTileMovementCostMultiplier()` - Get movement cost
- `getTileParticleEffect()` - Get particle effect type
- `getTileInteractiveType()` - Get interaction type

**Region Queries:**

- `getSolidTilesInRegion()` - Find collision tiles in area
- `getHazardTilesInRegion()` - Find hazard tiles in area
- `getInteractiveTilesInRegion()` - Find interactive tiles in area
- `filterTilesByEffect()` - Filter tiles by any effect

### 3. `src/pages/api/battlemap/tileMetadata.ts`

API endpoint that returns all tiles with their metadata:

**Endpoint:** `GET /api/battlemap/tileMetadata`

**Response:**

```json
{
  "tiles": [
    {
      "src": "/assets/battlemap/Tilesets/Structure/Walls/WallSolid.png",
      "metadata": {
        "category": "structure",
        "subcategory": "walls",
        "name": "Walls",
        "effects": ["collision"]
      }
    },
    ...
  ]
}
```

## Default Metadata Configuration

**Structure:**

- Walls: collision
- Pillars: collision
- Railings: collision
- Doors: collision, interactive
- Stairs: none

**Terrain:**

- Water: water, difficult_terrain (2x cost)
- Others: none

**Vegetation:**

- Trees: collision
- Others: none

**Decoration:**

- Furniture: collision
- Torches: light_source, particle (1.5 tile radius, golden light)
- Others: none

**Hazard:**

- Fire: hazard, particle, light_source (2 damage, fire particles, orange light)
- Spikes: hazard (1 damage, slashing)
- Traps: hazard, interactive (1 damage)
- Magical: hazard, particle, visual_effect (1 damage, sparkle particles)

**Lighting:**

- Light Sources: light_source (2 tile radius, golden light)
- Shadow Effects: shadow

## Future Integration Points

### 1. Collision Detection

```typescript
const solidTiles = getSolidTilesInRegion(placedTiles, x1, x2, y1, y2);
if (solidTiles.length > 0) {
  // Block movement or handle collision
}
```

### 2. Hazard System

```typescript
const hazards = getHazardTilesInRegion(placedTiles, x1, x2, y1, y2);
hazards.forEach((tile) => {
  const damage = getTileHazardDamage(tile);
  applyDamage(creature, damage, tile.metadata.hazardType);
});
```

### 3. Movement Cost Calculation

```typescript
const terrain = getTileMovementCostMultiplier(tile);
const movementCost = baseMovement * terrain;
```

### 4. Interactive Tiles

```typescript
const interactive = getInteractiveTilesInRegion(placedTiles, x1, x2, y1, y2);
interactive.forEach((tile) => {
  const type = getTileInteractiveType(tile);
  if (type === "door") openDoor(tile);
  else if (type === "lever") activateLever(tile);
});
```

### 5. Particle Effects

```typescript
const particle = getTileParticleEffect(tile);
if (particle === "fire") spawnFireParticles(tile);
else if (particle === "sparkle") spawnSparkles(tile);
```

## Path Structure Expected

Tiles are automatically categorized based on folder path:

```
/assets/battlemap/Tilesets/{Category}/{Subcategory}/{FileName}.png
```

Example:

- `/assets/battlemap/Tilesets/Structure/Walls/WallSolid.png` → Structure/Walls category
- `/assets/battlemap/Tilesets/Hazard/Fire/FireTile.png` → Hazard/Fire category
- `/assets/battlemap/Tilesets/Decoration/Torches/TorchBright.png` → Decoration/Torches category

## Usage Example

```typescript
import {
  getTileMetadata,
  parseTilePathMetadata,
} from "@/lib/battlemap/tileMetadata";
import { isTileSolid, getTileHazardDamage } from "@/lib/battlemap/tileEffects";

// Parse a tile path
const meta = parseTilePathMetadata(
  "/assets/battlemap/Tilesets/Structure/Walls/WallSolid.png"
);
// Result: { category: 'structure', subcategory: 'walls' }

// Get full metadata
const metadata = getTileMetadata("structure", "walls");
// Result: { category: 'structure', subcategory: 'walls', name: 'Walls', effects: ['collision'] }

// Check effects
if (isTileSolid(placedTile)) {
  console.log("This tile blocks movement");
}

// Get hazard damage
const damage = getTileHazardDamage(hazardTile);
```

## Notes

- All metadata is generated automatically from tile paths
- Custom overrides can be added per-tile by loading overrides from API
- The system is designed to scale - new tile types and effects can be added easily
- Effects are composable - tiles can have multiple effects simultaneously
- Default values provide sensible fallbacks (e.g., default light radius of 2 tiles)
