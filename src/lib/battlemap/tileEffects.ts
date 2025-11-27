/**
 * Tile Effects System
 * Applies tile effects to game mechanics (collision, hazards, etc)
 */

import type { TileMetadata, TileEffect } from "@/lib/battlemap/tileMetadata";
import {
  getTileMetadata,
  parseTilePathMetadata,
  hasTileEffect,
} from "@/lib/battlemap/tileMetadata";

export type PlacedTile = {
  id: string;
  cellX: number;
  cellY: number;
  centerX?: number;
  centerY?: number;
  src: string;
  rotationIndex: number;
  rotationRadians?: number;
  mirrorX?: boolean;
  scale?: number;
  strokeId?: string;
  layer: string;
  order: number;
  mirrorY?: boolean;
  layerId?: string | null;
};

export type TileWithMetadata = PlacedTile & {
  metadata: TileMetadata;
};

/**
 * Enrich a placed tile with its metadata
 */
export function enrichTileWithMetadata(
  tile: PlacedTile
): TileWithMetadata | null {
  const pathMeta = parseTilePathMetadata(tile.src);
  if (!pathMeta) return null;

  const metadata = getTileMetadata(pathMeta.category, pathMeta.subcategory);
  return { ...tile, metadata };
}

/**
 * Check if a tile is solid (has collision)
 */
export function isTileSolid(tile: PlacedTile | TileWithMetadata): boolean {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched) return false;
  return hasTileEffect(enriched.metadata, "collision");
}

/**
 * Check if a tile is hazardous
 */
export function isTileHazard(tile: PlacedTile | TileWithMetadata): boolean {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched) return false;
  return hasTileEffect(enriched.metadata, "hazard");
}

/**
 * Check if a tile is interactive
 */
export function isTileInteractive(
  tile: PlacedTile | TileWithMetadata
): boolean {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched) return false;
  return hasTileEffect(enriched.metadata, "interactive");
}

/**
 * Check if a tile is difficult terrain
 */
export function isTileDifficultTerrain(
  tile: PlacedTile | TileWithMetadata
): boolean {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched) return false;
  return hasTileEffect(enriched.metadata, "difficult_terrain");
}

/**
 * Check if a tile is water
 */
export function isTileWater(tile: PlacedTile | TileWithMetadata): boolean {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched) return false;
  return hasTileEffect(enriched.metadata, "water");
}

/**
 * Check if a tile emits light
 */
export function isTileLightSource(
  tile: PlacedTile | TileWithMetadata
): boolean {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched) return false;
  return hasTileEffect(enriched.metadata, "light_source");
}

/**
 * Check if a tile is unlit (does not receive light)
 */
export function isTileUnlit(tile: PlacedTile | TileWithMetadata): boolean {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched) return false;
  return hasTileEffect(enriched.metadata, "unlit");
}

/**
 * Get hazard damage from a tile
 */
export function getTileHazardDamage(
  tile: PlacedTile | TileWithMetadata
): number {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched || !isTileHazard(enriched)) return 0;
  return enriched.metadata.hazardDamage ?? 1;
}

/**
 * Get light properties from a tile
 */
export function getTileLightProperties(
  tile: PlacedTile | TileWithMetadata
): { radius: number; color: string } | null {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched || !isTileLightSource(enriched)) return null;

  return {
    radius: enriched.metadata.lightRadius ?? 2,
    color: enriched.metadata.lightColor ?? "#e1be7a",
  };
}

/**
 * Get movement cost multiplier for terrain
 */
export function getTileMovementCostMultiplier(
  tile: PlacedTile | TileWithMetadata
): number {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched || !isTileDifficultTerrain(enriched)) return 1;

  return enriched.metadata.difficultyMultiplier ?? 1.5;
}

/**
 * Get particle effect type if tile has particles
 */
export function getTileParticleEffect(
  tile: PlacedTile | TileWithMetadata
): string | null {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched) return null;

  if (hasTileEffect(enriched.metadata, "particle")) {
    return enriched.metadata.particleType ?? null;
  }
  return null;
}

/**
 * Get interactive type if tile is interactive
 */
export function getTileInteractiveType(
  tile: PlacedTile | TileWithMetadata
): string | null {
  const enriched = "metadata" in tile ? tile : enrichTileWithMetadata(tile);
  if (!enriched || !isTileInteractive(enriched)) return null;

  return enriched.metadata.interactiveType ?? null;
}

/**
 * Filter tiles by effect
 */
export function filterTilesByEffect(
  tiles: (PlacedTile | TileWithMetadata)[],
  effect: TileEffect
): TileWithMetadata[] {
  return tiles
    .map((tile) => ("metadata" in tile ? tile : enrichTileWithMetadata(tile)))
    .filter(
      (tile): tile is TileWithMetadata =>
        tile !== null && hasTileEffect(tile.metadata, effect)
    );
}

/**
 * Get all solid tiles in a region (for collision detection)
 */
export function getSolidTilesInRegion(
  tiles: PlacedTile[],
  minCellX: number,
  maxCellX: number,
  minCellY: number,
  maxCellY: number
): TileWithMetadata[] {
  return tiles
    .filter(
      (t) =>
        t.cellX >= minCellX &&
        t.cellX <= maxCellX &&
        t.cellY >= minCellY &&
        t.cellY <= maxCellY
    )
    .filter(isTileSolid)
    .map((t) => {
      const enriched = enrichTileWithMetadata(t);
      return enriched as TileWithMetadata;
    })
    .filter(Boolean);
}

/**
 * Get all hazard tiles in a region (for damage application)
 */
export function getHazardTilesInRegion(
  tiles: PlacedTile[],
  minCellX: number,
  maxCellX: number,
  minCellY: number,
  maxCellY: number
): TileWithMetadata[] {
  return tiles
    .filter(
      (t) =>
        t.cellX >= minCellX &&
        t.cellX <= maxCellX &&
        t.cellY >= minCellY &&
        t.cellY <= maxCellY
    )
    .filter(isTileHazard)
    .map((t) => {
      const enriched = enrichTileWithMetadata(t);
      return enriched as TileWithMetadata;
    })
    .filter(Boolean);
}

/**
 * Get all interactive tiles in a region
 */
export function getInteractiveTilesInRegion(
  tiles: PlacedTile[],
  minCellX: number,
  maxCellX: number,
  minCellY: number,
  maxCellY: number
): TileWithMetadata[] {
  return tiles
    .filter(
      (t) =>
        t.cellX >= minCellX &&
        t.cellX <= maxCellX &&
        t.cellY >= minCellY &&
        t.cellY <= maxCellY
    )
    .filter(isTileInteractive)
    .map((t) => {
      const enriched = enrichTileWithMetadata(t);
      return enriched as TileWithMetadata;
    })
    .filter(Boolean);
}
