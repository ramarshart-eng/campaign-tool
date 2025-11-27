/**
 * Occluder Grid System
 * Builds a spatial grid of light-blocking geometry based on tile alpha channels
 */

import type { PlacedTile } from "@/lib/battlemap/tileEffects";
import { enrichTileWithMetadata } from "@/lib/battlemap/tileEffects";
import { hasTileEffect } from "@/lib/battlemap/tileMetadata";

export type OccluderGrid = {
  /** Map of "cellX,cellY,subX,subY" -> opacity (0-1) */
  data: Map<string, number>;
  /** Resolution: how many sub-samples per cell (e.g., 4 = 4x4 grid per cell) */
  resolution: number;
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

/**
 * Build an occluder grid from tiles with collision effects
 * Samples alpha channel at sub-cell resolution for accurate shadows
 *
 * @param tiles - All placed tiles on the map
 * @param imageCache - Cache of loaded tile images
 * @param resolution - Sub-samples per cell (4 = 4x4 grid per cell, 16 samples total)
 * @returns OccluderGrid with alpha values
 */
export async function buildOccluderGrid(
  tiles: PlacedTile[],
  imageCache: Map<string, HTMLImageElement>,
  resolution: number = 4
): Promise<OccluderGrid> {
  const occluders = new Map<string, number>();

  // Create a temporary canvas for sampling alpha
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { data: occluders, resolution };
  }

  let processedCount = 0;
  for (const tile of tiles) {
    // Check if this tile blocks light (has collision effect)
    const enriched = enrichTileWithMetadata(tile);
    if (!enriched || !hasTileEffect(enriched.metadata, "collision")) {
      continue;
    }

    processedCount++;
    if (processedCount <= 3) {
      console.log("[OccluderGrid] Processing tile:", {
        src: tile.src,
        cellX: tile.cellX,
        cellY: tile.cellY,
        effects: enriched.metadata.effects,
      });
    }

    const img = imageCache.get(tile.src);
    if (!img || !img.complete || img.width === 0 || img.height === 0) {
      continue;
    }

    // Get tile dimensions
    const baseSpan = getTileSizeCells(tile.src);
    const footprint =
      tile.rotationIndex % 2 === 0
        ? { w: baseSpan.w, h: baseSpan.h }
        : { w: baseSpan.h, h: baseSpan.w };

    // Resize canvas to sample the tile at sub-cell resolution
    const samplesPerCell = resolution;
    const totalSamplesW = footprint.w * samplesPerCell;
    const totalSamplesH = footprint.h * samplesPerCell;
    canvas.width = totalSamplesW;
    canvas.height = totalSamplesH;

    // Clear and draw the tile image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Handle rotation and mirroring
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.translate(centerX, centerY);

    if (tile.rotationIndex) {
      ctx.rotate((tile.rotationIndex * Math.PI) / 2);
    }

    const scaleX = tile.mirrorX ? -1 : 1;
    const scaleY = tile.mirrorY ? -1 : 1;
    ctx.scale(scaleX, scaleY);

    ctx.drawImage(img, -centerX, -centerY, canvas.width, canvas.height);
    ctx.restore();

    // Sample alpha channel
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Store alpha values in grid
    for (let subY = 0; subY < totalSamplesH; subY++) {
      for (let subX = 0; subX < totalSamplesW; subX++) {
        const pixelIndex = (subY * totalSamplesW + subX) * 4;
        const alpha = pixels[pixelIndex + 3] / 255; // Normalize to 0-1

        // Store all alpha values (even small ones) to capture fine edge detail
        if (alpha > 0) {
          // Map to world grid coordinates
          const worldCellX = tile.cellX + Math.floor(subX / samplesPerCell);
          const worldCellY = tile.cellY + Math.floor(subY / samplesPerCell);
          const localSubX = subX % samplesPerCell;
          const localSubY = subY % samplesPerCell;

          const key = `${worldCellX},${worldCellY},${localSubX},${localSubY}`;

          // Use max opacity if multiple tiles overlap
          const existing = occluders.get(key) || 0;
          occluders.set(key, Math.max(existing, alpha));
        }
      }
    }
  }

  console.log("[OccluderGrid] Build complete:", {
    processedTiles: processedCount,
    totalOccluders: occluders.size,
    resolution,
  });

  return { data: occluders, resolution };
}

/**
 * Sample occluder grid at a specific world position
 * @param grid - The occluder grid
 * @param x - X position in cells (can be fractional)
 * @param y - Y position in cells (can be fractional)
 * @returns Opacity at this position (0-1)
 */
export function sampleOccluderGrid(
  grid: OccluderGrid,
  x: number,
  y: number
): number {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const fracX = x - cellX;
  const fracY = y - cellY;

  const subX = Math.floor(fracX * grid.resolution);
  const subY = Math.floor(fracY * grid.resolution);

  const key = `${cellX},${cellY},${subX},${subY}`;
  return grid.data.get(key) || 0;
}

/**
 * Get all cells that have any occluding geometry
 * Useful for broad-phase culling
 */
export function getOccupiedCells(grid: OccluderGrid): Set<string> {
  const cells = new Set<string>();
  for (const key of grid.data.keys()) {
    const [cellX, cellY] = key.split(",");
    cells.add(`${cellX},${cellY}`);
  }
  return cells;
}
