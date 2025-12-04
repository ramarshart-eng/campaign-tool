/**
 * Occluder Grid System
 * Builds a spatial grid of light-blocking geometry based on tile alpha channels
 */

import type { PlacedTile } from "@/lib/battlemap/tileEffects";
import { enrichTileWithMetadata } from "@/lib/battlemap/tileEffects";
import { hasTileEffect } from "@/lib/battlemap/tileMetadata";

export type OccluderGrid = {
  /** Map of "cellX,cellY,subX,subY" -> binary opacity (0 or 1) */
  data: Map<string, number>;
  /** Resolution: how many sub-samples per cell (e.g., 4 = 4x4 grid per cell) */
  resolution: number;
  /** Version: incremented on rebuild; use for cache invalidation */
  version: number;
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
 * Samples alpha channel at sub-cell resolution using native image dimensions
 * to match exactly how tiles are rendered on the main canvas.
 *
 * @param tiles - All placed tiles on the map
 * @param imageCache - Cache of loaded tile images
 * @param resolution - Sub-samples per cell (4 = 4x4 grid per cell, 16 samples total)
 * @param alphaThreshold - Alpha threshold for binarization; default 0 (any alpha > 0 is opaque)
 * @param cellSize - Size of one grid cell in pixels
 * @returns OccluderGrid with binary opacity values
 */
export async function buildOccluderGrid(
  tiles: PlacedTile[],
  imageCache: Map<string, HTMLImageElement>,
  resolution: number = 4,
  alphaThreshold: number = 0,
  cellSize: number = 1
): Promise<OccluderGrid> {
  const occluders = new Map<string, number>();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { data: occluders, resolution, version: 1 };
  }

  const safeCellSize = cellSize > 0 ? cellSize : 1;
  const samplesPerCell = Math.max(1, Math.floor(resolution));
  let processedCount = 0;

  for (const tile of tiles) {
    const enriched = enrichTileWithMetadata(tile);
    if (!enriched || !hasTileEffect(enriched.metadata, "collision")) {
      continue;
    }
    processedCount++;

    const img = imageCache.get(tile.src);
    if (!img || !img.complete || img.width === 0 || img.height === 0) {
      continue;
    }

    // Get tile footprint for computing center position
    const baseSpan = getTileSizeCells(tile.src);
    const footprint =
      tile.rotationIndex % 2 === 0
        ? { w: baseSpan.w, h: baseSpan.h }
        : { w: baseSpan.h, h: baseSpan.w };

    // Tile center in cell coordinates (matches main canvas rendering)
    const tileCenterX =
      typeof tile.centerX === "number"
        ? tile.centerX
        : tile.cellX + footprint.w / 2;
    const tileCenterY =
      typeof tile.centerY === "number"
        ? tile.centerY
        : tile.cellY + footprint.h / 2;

    // Native image dimensions in cells (this is what actually renders)
    const imgWidthCells = img.width / safeCellSize;
    const imgHeightCells = img.height / safeCellSize;

    // Sample at reasonable resolution (scale down large images for performance)
    const maxSampleDim = 256;
    const sampleScale = Math.min(
      1,
      maxSampleDim / Math.max(img.width, img.height)
    );
    const sampleW = Math.max(1, Math.round(img.width * sampleScale));
    const sampleH = Math.max(1, Math.round(img.height * sampleScale));

    canvas.width = sampleW;
    canvas.height = sampleH;

    ctx.clearRect(0, 0, sampleW, sampleH);
    ctx.save();
    ctx.translate(sampleW / 2, sampleH / 2);

    // Apply rotation
    if (tile.rotationIndex) {
      ctx.rotate((tile.rotationIndex * Math.PI) / 2);
    }

    // Apply mirroring
    ctx.scale(tile.mirrorX ? -1 : 1, tile.mirrorY ? -1 : 1);

    // Draw at native aspect ratio, centered
    ctx.drawImage(img, -sampleW / 2, -sampleH / 2, sampleW, sampleH);
    ctx.restore();

    const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
    const pixels = imageData.data;

    // After rotation, the oriented dimensions in cells
    const isRightAngle = (tile.rotationIndex ?? 0) % 2 !== 0;
    const orientedWidthCells = isRightAngle ? imgHeightCells : imgWidthCells;
    const orientedHeightCells = isRightAngle ? imgWidthCells : imgHeightCells;

    // World bounds of the rendered tile (centered on tileCenterX/Y)
    const worldLeft = tileCenterX - orientedWidthCells / 2;
    const worldTop = tileCenterY - orientedHeightCells / 2;

    // Map each sampled pixel to world coordinates
    for (let py = 0; py < sampleH; py++) {
      for (let px = 0; px < sampleW; px++) {
        const pixelIndex = (py * sampleW + px) * 4;
        const alpha = pixels[pixelIndex + 3];

        // Binarize: treat any alpha above threshold as fully opaque
        if (alpha > alphaThreshold * 255) {
          // Map pixel position to world cell coordinates
          // px/sampleW gives 0..1 fraction across the (rotated) image
          const fracX = (px + 0.5) / sampleW;
          const fracY = (py + 0.5) / sampleH;

          const worldX = worldLeft + fracX * orientedWidthCells;
          const worldY = worldTop + fracY * orientedHeightCells;

          const worldCellX = Math.floor(worldX);
          const worldCellY = Math.floor(worldY);

          const cellFracX = worldX - worldCellX;
          const cellFracY = worldY - worldCellY;

          const localSubX = Math.max(
            0,
            Math.min(samplesPerCell - 1, Math.floor(cellFracX * samplesPerCell))
          );
          const localSubY = Math.max(
            0,
            Math.min(samplesPerCell - 1, Math.floor(cellFracY * samplesPerCell))
          );

          occluders.set(
            `${worldCellX},${worldCellY},${localSubX},${localSubY}`,
            1
          );
        }
      }
    }
  }

  console.log("[OccluderGrid] Build complete:", {
    processedTiles: processedCount,
    totalOccluders: occluders.size,
    resolution,
    alphaThreshold,
  });

  return { data: occluders, resolution, version: 1 };
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
  // Binary occlusion: return 1 if any nearby sample is opaque, 0 otherwise
  // Since occluders are binarized, we check the nearest sub-sample
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const fracX = x - cellX;
  const fracY = y - cellY;

  const sx = fracX * grid.resolution;
  const sy = fracY * grid.resolution;
  const subX = Math.round(sx);
  const subY = Math.round(sy);

  const clampedSubX = Math.max(0, Math.min(subX, grid.resolution - 1));
  const clampedSubY = Math.max(0, Math.min(subY, grid.resolution - 1));

  const key = `${cellX},${cellY},${clampedSubX},${clampedSubY}`;
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
