/**
 * Occluder Segments
 * Builds world-space line segments from tiles with collision effects
 * by transforming cached contour data to world coordinates.
 */

import type { PlacedTile } from "@/lib/battlemap/tileEffects";
import { enrichTileWithMetadata } from "@/lib/battlemap/tileEffects";
import { hasTileEffect } from "@/lib/battlemap/tileMetadata";
import {
  type Segment,
  traceAndCacheContour,
  clearContourCache,
} from "./contourTracer";

export type { Segment } from "./contourTracer";

export type OccluderData = {
  /** All occluder segments in world cell coordinates */
  segments: Segment[];
  /** Version number for cache invalidation */
  version: number;
  /** Bounding box for quick culling */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

/**
 * Get the size of a tile in cells from its filename
 */
function getTileSizeCells(src: string): { w: number; h: number } {
  const match = src.match(/_(\d+)X(\d+)_/i);
  if (match) {
    return { w: parseInt(match[1], 10), h: parseInt(match[2], 10) };
  }
  return { w: 1, h: 1 };
}

let currentVersion = 0;

/**
 * Build occluder segments from all tiles with collision effects.
 * Traces contours from alpha channels and transforms to world coordinates.
 *
 * @param tiles - All placed tiles on the map
 * @param imageCache - Cache of loaded tile images
 * @param cellSize - Size of one grid cell in pixels
 * @param alphaThreshold - Alpha threshold for contour detection (0-255)
 * @param simplifyEpsilon - Douglas-Peucker simplification tolerance (in cells)
 * @returns OccluderData with world-space segments
 */
export function buildOccluderSegments(
  tiles: PlacedTile[],
  imageCache: Map<string, HTMLImageElement>,
  cellSize: number,
  alphaThreshold: number = 128,
  simplifyEpsilon: number = 0.05
): OccluderData {
  const allSegments: Segment[] = [];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const safeCellSize = cellSize > 0 ? cellSize : 1;

  // Debug: count tiles with collision
  let collisionTileCount = 0;
  let noCollisionTileCount = 0;
  let noImageCount = 0;

  for (const tile of tiles) {
    // Check if this tile blocks light (has collision effect)
    const enriched = enrichTileWithMetadata(tile);
    if (!enriched || !hasTileEffect(enriched.metadata, "collision")) {
      noCollisionTileCount++;
      continue;
    }

    const img = imageCache.get(tile.src);
    if (!img || !img.complete || img.width === 0 || img.height === 0) {
      noImageCount++;
      continue;
    }

    collisionTileCount++;

    // Get tile footprint for computing center position
    const baseSpan = getTileSizeCells(tile.src);
    const footprint =
      tile.rotationIndex % 2 === 0
        ? { w: baseSpan.w, h: baseSpan.h }
        : { w: baseSpan.h, h: baseSpan.w };

    // Tile center in cell coordinates
    const tileCenterX =
      typeof tile.centerX === "number"
        ? tile.centerX
        : tile.cellX + footprint.w / 2;
    const tileCenterY =
      typeof tile.centerY === "number"
        ? tile.centerY
        : tile.cellY + footprint.h / 2;

    // Native image dimensions in cells, accounting for tile scale
    const tileScale = tile.scale ?? 1;
    const imgWidthCells = (img.width * tileScale) / safeCellSize;
    const imgHeightCells = (img.height * tileScale) / safeCellSize;

    // After rotation, the oriented dimensions
    const isRightAngle = (tile.rotationIndex ?? 0) % 2 !== 0;
    const orientedWidthCells = isRightAngle ? imgHeightCells : imgWidthCells;
    const orientedHeightCells = isRightAngle ? imgWidthCells : imgHeightCells;

    // World bounds of the rendered tile
    const worldLeft = tileCenterX - orientedWidthCells / 2;
    const worldTop = tileCenterY - orientedHeightCells / 2;

    // Debug: log tile dimensions for first few tiles
    if (allSegments.length === 0) {
      console.log("[OccluderSegments] First tile:", {
        src: tile.src.split("/").pop(),
        imgPx: { w: img.width, h: img.height },
        scale: tileScale,
        cellSize: safeCellSize,
        imgCells: { w: imgWidthCells, h: imgHeightCells },
        orientedCells: { w: orientedWidthCells, h: orientedHeightCells },
        footprint,
        center: { x: tileCenterX, y: tileCenterY },
        worldBounds: { left: worldLeft, top: worldTop },
        rotationIndex: tile.rotationIndex,
      });
    }

    // Trace contour (cached per tile + rotation + mirror)
    const localSegments = traceAndCacheContour(
      img,
      tile.src,
      tile.rotationIndex ?? 0,
      tile.mirrorX ?? false,
      tile.mirrorY ?? false,
      alphaThreshold,
      simplifyEpsilon / Math.max(orientedWidthCells, orientedHeightCells)
    );

    // Transform segments from normalized (0-1) to world coordinates
    for (const seg of localSegments) {
      const worldSeg: Segment = {
        x1: worldLeft + seg.x1 * orientedWidthCells,
        y1: worldTop + seg.y1 * orientedHeightCells,
        x2: worldLeft + seg.x2 * orientedWidthCells,
        y2: worldTop + seg.y2 * orientedHeightCells,
      };

      allSegments.push(worldSeg);

      // Update bounds
      minX = Math.min(minX, worldSeg.x1, worldSeg.x2);
      minY = Math.min(minY, worldSeg.y1, worldSeg.y2);
      maxX = Math.max(maxX, worldSeg.x1, worldSeg.x2);
      maxY = Math.max(maxY, worldSeg.y1, worldSeg.y2);
    }
  }

  currentVersion++;

  console.log("[OccluderSegments] Build complete:", {
    totalSegments: allSegments.length,
    version: currentVersion,
  });

  return {
    segments: allSegments,
    version: currentVersion,
    bounds: {
      minX: minX === Infinity ? 0 : minX,
      minY: minY === Infinity ? 0 : minY,
      maxX: maxX === -Infinity ? 0 : maxX,
      maxY: maxY === -Infinity ? 0 : maxY,
    },
  };
}

/**
 * Clear all caches (call when tiles are reloaded)
 */
export function clearOccluderCache(): void {
  clearContourCache();
  currentVersion = 0;
}

/**
 * Build a spatial index for faster ray-segment intersection.
 * Divides world into grid buckets, each containing indices of overlapping segments.
 */
export type SpatialIndex = {
  buckets: Map<string, number[]>;
  bucketSize: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

export function buildSpatialIndex(
  occluders: OccluderData,
  bucketSize: number = 2
): SpatialIndex {
  const buckets = new Map<string, number[]>();

  for (let i = 0; i < occluders.segments.length; i++) {
    const seg = occluders.segments[i];

    // Find all buckets this segment overlaps
    const minBucketX = Math.floor(Math.min(seg.x1, seg.x2) / bucketSize);
    const maxBucketX = Math.floor(Math.max(seg.x1, seg.x2) / bucketSize);
    const minBucketY = Math.floor(Math.min(seg.y1, seg.y2) / bucketSize);
    const maxBucketY = Math.floor(Math.max(seg.y1, seg.y2) / bucketSize);

    for (let bx = minBucketX; bx <= maxBucketX; bx++) {
      for (let by = minBucketY; by <= maxBucketY; by++) {
        const key = `${bx},${by}`;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = [];
          buckets.set(key, bucket);
        }
        bucket.push(i);
      }
    }
  }

  return {
    buckets,
    bucketSize,
    bounds: occluders.bounds,
  };
}

/**
 * Get segment indices that may intersect a ray from origin in given direction
 */
export function getSegmentsAlongRay(
  index: SpatialIndex,
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  maxDist: number
): Set<number> {
  const result = new Set<number>();

  // March along ray through buckets
  const step = index.bucketSize / 2; // Half bucket size for better coverage
  const steps = Math.ceil(maxDist / step);

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * maxDist;
    const x = originX + dirX * t;
    const y = originY + dirY * t;

    const bx = Math.floor(x / index.bucketSize);
    const by = Math.floor(y / index.bucketSize);

    // Check this bucket and neighbors (for edge cases)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${bx + dx},${by + dy}`;
        const bucket = index.buckets.get(key);
        if (bucket) {
          for (const idx of bucket) {
            result.add(idx);
          }
        }
      }
    }
  }

  return result;
}
