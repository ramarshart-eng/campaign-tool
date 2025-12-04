/**
 * Light Renderer (Segment-Based)
 * High-level API for rendering ray-traced lighting on the battlemap
 * using contour-traced occluder segments for accurate, fast shadow casting.
 */

import type { PlacedTile } from "@/lib/battlemap/tileEffects";
import {
  isTileUnlit,
  getTileLightProperties,
  enrichTileWithMetadata,
} from "@/lib/battlemap/tileEffects";
import { hasTileEffect } from "@/lib/battlemap/tileMetadata";
import { buildOccluderSegments, type OccluderData } from "./occluderSegments";
import { generateVisibilityPolygonFromSegments } from "./raySegmentIntersection";
import type { WorldToScreenFunc } from "./shadowMap";

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

export type LightingConfig = {
  /** Base darkness opacity (0-1) */
  darknessOpacity: number;
  /** Light radius in cells */
  lightRadius: number;
  /** Light intensity (0-1) */
  lightIntensity: number;
  /** Default light color (hex) */
  lightColor: string;
  /** Alpha threshold for contour detection (0-255) */
  alphaThreshold: number;
  /** Contour simplification tolerance (in cells) */
  simplifyEpsilon: number;
  /** Minimum rays for visibility polygon */
  minRays: number;
  /** Maximum rays for visibility polygon */
  maxRays: number;
  /** Whether to apply warm color tint */
  applyColorTint: boolean;
};

const DEFAULT_CONFIG: LightingConfig = {
  darknessOpacity: 0.8,
  lightRadius: 4,
  lightIntensity: 1,
  lightColor: "#e1be7a",
  alphaThreshold: 128,
  simplifyEpsilon: 0.02,
  minRays: 540,
  maxRays: 1080,
  applyColorTint: false,
};

const TILE_SIZE_REGEX = /_(\d+)X(\d+)_/i;

let cachedOccluders: OccluderData | null = null;
let cachedOccluderSignature: string | null = null;
type MaskCache = {
  signature: string;
  width: number;
  height: number;
  cameraKey: string;
  canvas: HTMLCanvasElement;
};
let cachedOccluderMask: MaskCache | null = null;
let reusableLightCanvas: HTMLCanvasElement | null = null;
let reusableColorCanvas: HTMLCanvasElement | null = null;

function getTileSizeCellsFromSrc(src: string): { w: number; h: number } {
  const match = src.match(TILE_SIZE_REGEX);
  if (match) {
    return { w: parseInt(match[1], 10), h: parseInt(match[2], 10) };
  }
  return { w: 1, h: 1 };
}

function getTileFootprintInCells(tile: PlacedTile): { w: number; h: number } {
  const base = getTileSizeCellsFromSrc(tile.src);
  return (tile.rotationIndex ?? 0) % 2 === 0 ? base : { w: base.h, h: base.w };
}

function computeTileCenterCells(
  tile: PlacedTile,
  footprint: { w: number; h: number }
): { x: number; y: number } {
  return {
    x:
      typeof tile.centerX === "number"
        ? tile.centerX
        : tile.cellX + footprint.w / 2,
    y:
      typeof tile.centerY === "number"
        ? tile.centerY
        : tile.cellY + footprint.h / 2,
  };
}

function formatNumber(value: number | undefined, fractionDigits = 4): string {
  return typeof value === "number" ? value.toFixed(fractionDigits) : "";
}

function computeOccluderSignature(tiles: PlacedTile[]): string {
  const entries = tiles.map((tile) => {
    const footprint = getTileFootprintInCells(tile);
    const center = computeTileCenterCells(tile, footprint);
    return [
      tile.src,
      tile.cellX,
      tile.cellY,
      formatNumber(center.x),
      formatNumber(center.y),
      tile.rotationIndex ?? 0,
      tile.mirrorX ? 1 : 0,
      tile.mirrorY ? 1 : 0,
      formatNumber(tile.scale ?? 1, 3),
    ].join(":");
  });
  entries.sort();
  return entries.join("|");
}

function acquireCanvas(
  existing: HTMLCanvasElement | null,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = existing ?? document.createElement("canvas");
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas;
}

function getOccluderMaskCanvas(
  signature: string,
  width: number,
  height: number,
  tiles: PlacedTile[],
  imageCache: Map<string, HTMLImageElement>,
  cellSize: number,
  gridOrigin: number,
  worldToScreen: WorldToScreenFunc,
  camera?: { panX: number; panY: number; zoom: number }
): HTMLCanvasElement | null {
  if (!camera || tiles.length === 0) {
    return null;
  }

  const cameraKey = `${camera.panX.toFixed(2)}:${camera.panY.toFixed(
    2
  )}:${camera.zoom.toFixed(4)}`;

  const needsRebuild =
    !cachedOccluderMask ||
    cachedOccluderMask.signature !== signature ||
    cachedOccluderMask.width !== width ||
    cachedOccluderMask.height !== height ||
    cachedOccluderMask.cameraKey !== cameraKey;

  if (!needsRebuild) {
    return cachedOccluderMask!.canvas;
  }

  const canvas = acquireCanvas(
    cachedOccluderMask?.canvas ?? null,
    width,
    height
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.clearRect(0, 0, width, height);

  for (const tile of tiles) {
    const img = imageCache.get(tile.src);
    if (!img || !img.complete || img.width === 0 || img.height === 0) {
      continue;
    }

    const footprint = getTileFootprintInCells(tile);
    const center = computeTileCenterCells(tile, footprint);
    const tileWorldX = center.x * cellSize + gridOrigin;
    const tileWorldY = center.y * cellSize + gridOrigin;
    const tileScreen = worldToScreen(tileWorldX, tileWorldY);

    const tileScale = tile.scale ?? 1;
    const drawWidth = img.width * camera.zoom * tileScale;
    const drawHeight = img.height * camera.zoom * tileScale;

    ctx.save();
    ctx.translate(tileScreen.x, tileScreen.y);
    ctx.rotate(((tile.rotationIndex ?? 0) * Math.PI) / 2);
    ctx.scale(tile.mirrorX ? -1 : 1, tile.mirrorY ? -1 : 1);
    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }

  cachedOccluderMask = {
    signature,
    width,
    height,
    cameraKey,
    canvas,
  };

  return canvas;
}

/**
 * Helper: Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const sanitized = hex.replace("#", "");
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return { r, g, b };
}

/**
 * Render ray-traced lighting onto a canvas context
 *
 * @param ctx - Canvas 2D context to render to
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @param placedTiles - All tiles on the map
 * @param lightingTiles - Tiles that emit light
 * @param imageCache - Cache of loaded tile images
 * @param cellSize - Size of one grid cell in pixels
 * @param gridOrigin - World coordinate origin offset
 * @param worldToScreen - Function to convert world coords to screen coords
 * @param config - Lighting configuration
 * @param shadingImg - Optional shading texture image
 * @param camera - Camera state for computing screen-space radius
 * @returns Promise that resolves when rendering is complete
 */
export async function renderRayTracedLighting(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  placedTiles: PlacedTile[],
  lightingTiles: PlacedTile[],
  imageCache: Map<string, HTMLImageElement>,
  cellSize: number,
  gridOrigin: number,
  worldToScreen: WorldToScreenFunc,
  config: Partial<LightingConfig> = {},
  shadingImg?: HTMLImageElement,
  camera?: { panX: number; panY: number; zoom: number }
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  cfg.lightColor = config.lightColor ?? "#e1be7a";

  const occluderTiles = placedTiles.filter((tile) => {
    const enriched = enrichTileWithMetadata(tile);
    return enriched && hasTileEffect(enriched.metadata, "collision");
  });

  const occluderSignature = computeOccluderSignature(occluderTiles);

  if (!cachedOccluders || cachedOccluderSignature !== occluderSignature) {
    const buildStart = performance.now();
    cachedOccluders = buildOccluderSegments(
      occluderTiles,
      imageCache,
      cellSize,
      cfg.alphaThreshold,
      cfg.simplifyEpsilon
    );
    cachedOccluderSignature = occluderSignature;
    console.log(
      `[Lighting] Built ${
        cachedOccluders.segments.length
      } occluder segments in ${(performance.now() - buildStart).toFixed(1)}ms`
    );
  }

  const occluders = cachedOccluders!;

  // Initialize polygon cache for reuse across light sources
  const polygonCache = new Map<string, Array<{ x: number; y: number }>>();

  const occluderMask = getOccluderMaskCanvas(
    occluderSignature,
    width,
    height,
    occluderTiles,
    imageCache,
    cellSize,
    gridOrigin,
    worldToScreen,
    camera
  );

  // Create darkness canvas
  const darknessCanvas = document.createElement("canvas");
  darknessCanvas.width = width;
  darknessCanvas.height = height;
  const darkCtx = darknessCanvas.getContext("2d");
  if (!darkCtx) return;

  // Draw base darkness
  darkCtx.clearRect(0, 0, width, height);
  darkCtx.globalAlpha = cfg.darknessOpacity;
  darkCtx.fillStyle = "#000000";
  darkCtx.fillRect(0, 0, width, height);
  darkCtx.globalAlpha = 1;

  // Render lights by erasing darkness
  if (lightingTiles.length > 0 && camera) {
    darkCtx.globalCompositeOperation = "destination-out";

    for (const lightTile of lightingTiles) {
      const lightCenterX = lightTile.cellX + 0.5;
      const lightCenterY = lightTile.cellY + 0.5;

      // Get light properties from tile metadata
      const lightProps = getTileLightProperties(lightTile);
      const lightColor = lightProps?.color ?? cfg.lightColor;
      const lightRadius = cfg.lightRadius;

      // Debug: log light position for first light
      if (lightTile === lightingTiles[0]) {
        console.log("[Lighting] First light:", {
          cellX: lightTile.cellX,
          cellY: lightTile.cellY,
          centerInCells: { x: lightCenterX, y: lightCenterY },
          radius: lightRadius,
          numSegments: occluders.segments.length,
          bounds: occluders.bounds,
        });
      }

      // Convert light center to screen coordinates
      const lightWorldX = lightCenterX * cellSize + gridOrigin;
      const lightWorldY = lightCenterY * cellSize + gridOrigin;
      const lightScreen = worldToScreen(lightWorldX, lightWorldY);

      // Generate visibility polygon (cached by position + radius)
      const cacheKey = `${lightCenterX.toFixed(2)},${lightCenterY.toFixed(
        2
      )},${lightRadius.toFixed(2)},${occluders.version}`;
      let vertices = polygonCache.get(cacheKey);

      if (!vertices) {
        const startTime = performance.now();
        vertices = generateVisibilityPolygonFromSegments(
          lightCenterX,
          lightCenterY,
          lightRadius,
          occluders.segments,
          cfg.minRays,
          cfg.maxRays
        );
        polygonCache.set(cacheKey, vertices);
        console.log(
          `[Lighting] Generated visibility polygon with ${
            vertices.length
          } vertices in ${(performance.now() - startTime).toFixed(1)}ms`
        );
      }

      // Create temporary canvas for this light
      reusableLightCanvas = acquireCanvas(reusableLightCanvas, width, height);
      const lightCtx = reusableLightCanvas.getContext("2d");
      if (!lightCtx) continue;
      lightCtx.clearRect(0, 0, width, height);

      // Set up clipping path from visibility polygon
      lightCtx.save();
      lightCtx.beginPath();
      for (let i = 0; i < vertices.length; i++) {
        const vertex = vertices[i];
        const vertexWorldX = vertex.x * cellSize + gridOrigin;
        const vertexWorldY = vertex.y * cellSize + gridOrigin;
        const vertexScreen = worldToScreen(vertexWorldX, vertexWorldY);

        if (i === 0) {
          lightCtx.moveTo(vertexScreen.x, vertexScreen.y);
        } else {
          lightCtx.lineTo(vertexScreen.x, vertexScreen.y);
        }
      }
      lightCtx.closePath();
      lightCtx.clip();

      // Draw radial gradient within clipped region
      const lightRadiusPx = lightRadius * cellSize * camera.zoom;
      const gradient = lightCtx.createRadialGradient(
        lightScreen.x,
        lightScreen.y,
        0,
        lightScreen.x,
        lightScreen.y,
        lightRadiusPx
      );

      const rgb = hexToRgb(lightColor);
      gradient.addColorStop(
        0,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${cfg.lightIntensity})`
      );
      gradient.addColorStop(
        0.7,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${cfg.lightIntensity * 0.5})`
      );
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      lightCtx.fillStyle = gradient;
      lightCtx.fillRect(0, 0, width, height);
      lightCtx.restore();

      if (occluderMask) {
        lightCtx.globalCompositeOperation = "destination-out";
        lightCtx.drawImage(occluderMask, 0, 0);
        lightCtx.globalCompositeOperation = "source-over";
      }

      // Composite light onto darkness canvas (erasing darkness)
      darkCtx.drawImage(reusableLightCanvas, 0, 0);
    }

    darkCtx.globalCompositeOperation = "source-over";
  }

  // Draw darkness layer to main canvas
  ctx.save();
  ctx.drawImage(darknessCanvas, 0, 0);
  ctx.restore();

  // Apply colored light overlays
  if (lightingTiles.length > 0 && camera) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";

    for (const lightTile of lightingTiles) {
      const lightCenterX = lightTile.cellX + 0.5;
      const lightCenterY = lightTile.cellY + 0.5;

      const lightProps = getTileLightProperties(lightTile);
      const lightColor = lightProps?.color ?? cfg.lightColor;
      const lightRadius = cfg.lightRadius;

      const lightWorldX = lightCenterX * cellSize + gridOrigin;
      const lightWorldY = lightCenterY * cellSize + gridOrigin;
      const lightScreen = worldToScreen(lightWorldX, lightWorldY);

      // Reuse cached visibility polygon
      const cacheKey = `${lightCenterX.toFixed(2)},${lightCenterY.toFixed(
        2
      )},${lightRadius.toFixed(2)},${occluders.version}`;
      const vertices = polygonCache.get(cacheKey);
      if (!vertices) continue;

      // Create colored light canvas
      reusableColorCanvas = acquireCanvas(reusableColorCanvas, width, height);
      const colorCtx = reusableColorCanvas.getContext("2d");
      if (!colorCtx) continue;
      colorCtx.clearRect(0, 0, width, height);

      // Clip and draw colored gradient
      colorCtx.save();
      colorCtx.beginPath();
      for (let i = 0; i < vertices.length; i++) {
        const vertex = vertices[i];
        const vertexWorldX = vertex.x * cellSize + gridOrigin;
        const vertexWorldY = vertex.y * cellSize + gridOrigin;
        const vertexScreen = worldToScreen(vertexWorldX, vertexWorldY);

        if (i === 0) {
          colorCtx.moveTo(vertexScreen.x, vertexScreen.y);
        } else {
          colorCtx.lineTo(vertexScreen.x, vertexScreen.y);
        }
      }
      colorCtx.closePath();
      colorCtx.clip();

      const lightRadiusPx = lightRadius * cellSize * camera.zoom;
      const colorGradient = colorCtx.createRadialGradient(
        lightScreen.x,
        lightScreen.y,
        0,
        lightScreen.x,
        lightScreen.y,
        lightRadiusPx
      );

      const rgb = hexToRgb(lightColor);
      const colorIntensity = cfg.lightIntensity * 0.4;
      colorGradient.addColorStop(
        0,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${colorIntensity})`
      );
      colorGradient.addColorStop(
        0.7,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${colorIntensity * 0.5})`
      );
      colorGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      colorCtx.fillStyle = colorGradient;
      colorCtx.fillRect(0, 0, width, height);
      colorCtx.restore();

      if (occluderMask) {
        colorCtx.globalCompositeOperation = "destination-out";
        colorCtx.drawImage(occluderMask, 0, 0);
        colorCtx.globalCompositeOperation = "source-over";
      }

      ctx.drawImage(reusableColorCanvas, 0, 0);
    }

    ctx.restore();
  }
}

/**
 * Invalidate cached occluders (call when tiles change)
 * Note: Currently not using caching, segments are rebuilt each frame
 */
export function invalidateOccluderCache(): void {
  cachedOccluders = null;
  cachedOccluderSignature = null;
  cachedOccluderMask = null;
}

/**
 * Create an unlit tile mask (for tiles that should always be dark)
 */
export function createUnlitMask(
  placedTiles: PlacedTile[],
  imageCache: Map<string, HTMLImageElement>,
  width: number,
  height: number,
  cellSize: number,
  gridOrigin: number,
  worldToScreen: WorldToScreenFunc
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "white";

  for (const tile of placedTiles) {
    if (!isTileUnlit(tile)) continue;

    const img = imageCache.get(tile.src);
    if (!img || !img.complete) continue;

    const tileWorldX = (tile.cellX + 0.5) * cellSize + gridOrigin;
    const tileWorldY = (tile.cellY + 0.5) * cellSize + gridOrigin;
    const screen = worldToScreen(tileWorldX, tileWorldY);

    const rectWidth = cellSize;
    const rectHeight = cellSize;

    ctx.fillRect(
      screen.x - rectWidth / 2,
      screen.y - rectHeight / 2,
      rectWidth,
      rectHeight
    );
  }

  return canvas;
}
