/**
 * Light Renderer
 * High-level API for rendering ray-traced lighting on the battlemap
 */

import type { PlacedTile } from "@/lib/battlemap/tileEffects";
import {
  isTileUnlit,
  enrichTileWithMetadata,
  getTileLightProperties,
} from "@/lib/battlemap/tileEffects";
import { hasTileEffect } from "@/lib/battlemap/tileMetadata";
import { buildOccluderGrid, type OccluderGrid } from "./occluderGrid";
import { generateVisibilityPolygon } from "./rayCasting";
import { generateLightTintMap } from "./shadowMap";
import type { WorldToScreenFunc } from "./shadowMap";

export type LightingConfig = {
  /** Base darkness opacity (0-1) */
  darknessOpacity: number;
  /** Light radius in cells */
  lightRadius: number;
  /** Light intensity (0-1) */
  lightIntensity: number;
  /** Default light color (hex) */
  lightColor: string;
  /** Resolution of occluder grid (samples per cell) */
  occluderResolution: number;
  /** Number of rays per light source */
  rayCount: number;
  /** Whether to apply warm color tint */
  applyColorTint: boolean;
};

const DEFAULT_CONFIG: LightingConfig = {
  darknessOpacity: 0.8,
  lightRadius: 4,
  lightIntensity: 1,
  lightColor: "#e1be7a",
  occluderResolution: 8,
  rayCount: 1440,
  applyColorTint: false,
};

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
  console.log("🔦 [LIGHTING] renderRayTracedLighting called", {
    placedTiles: placedTiles.length,
    lightingTiles: lightingTiles.length,
    config,
  });

  const cfg = { ...DEFAULT_CONFIG, ...config };
  // Ensure requested tint color matches spec
  cfg.lightColor = config.lightColor ?? "#e1be7a";

  // Build occluder grid from all tiles with collision
  const occluderGrid = await buildOccluderGrid(
    placedTiles,
    imageCache,
    cfg.occluderResolution
  );

  // Debug: Log occluder grid size
  console.log("[Lighting] Occluder grid built:", {
    totalOccluders: occluderGrid.data.size,
    resolution: occluderGrid.resolution,
    totalTiles: placedTiles.length,
    lightingTiles: lightingTiles.length,
  });

  // Create darkness canvas
  const darknessCanvas = document.createElement("canvas");
  darknessCanvas.width = width;
  darknessCanvas.height = height;
  const darkCtx = darknessCanvas.getContext("2d");
  if (!darkCtx) return;

  // Draw base darkness as solid black (no shading texture)
  darkCtx.clearRect(0, 0, width, height);
  darkCtx.globalAlpha = cfg.darknessOpacity;
  darkCtx.fillStyle = "#000000";
  darkCtx.fillRect(0, 0, width, height);
  darkCtx.globalAlpha = 1;

  // Render lights by erasing darkness
  if (lightingTiles.length > 0 && camera) {
    darkCtx.globalCompositeOperation = "destination-out";

    for (const lightTile of lightingTiles) {
      const lightCenterX = lightTile.cellX + 0.5; // Assume 1x1 tiles for now
      const lightCenterY = lightTile.cellY + 0.5;

      // Get light properties from tile metadata
      const lightProps = getTileLightProperties(lightTile);
      const lightColor = lightProps?.color ?? cfg.lightColor;

      // Dynamic radius based on light tile alpha coverage (opaque area reduces radius)
      let lightRadius = cfg.lightRadius * (lightTile.scale ?? 1);
      const lightImg = imageCache.get(lightTile.src);
      if (
        lightImg &&
        lightImg.complete &&
        lightImg.width > 0 &&
        lightImg.height > 0
      ) {
        try {
          const sampleCanvas = document.createElement("canvas");
          const sW = Math.min(128, lightImg.width);
          const sH = Math.min(128, lightImg.height);
          sampleCanvas.width = sW;
          sampleCanvas.height = sH;
          const sCtx = sampleCanvas.getContext("2d");
          if (sCtx) {
            sCtx.drawImage(lightImg, 0, 0, sW, sH);
            const imgData = sCtx.getImageData(0, 0, sW, sH).data;
            let opaque = 0;
            const total = sW * sH;
            for (let i = 0; i < imgData.length; i += 4) {
              const a = imgData[i + 3];
              if (a > 200) opaque++;
            }
            const opaqueRatio = opaque / total; // 0..1
            // Heuristic: more opaque area => smaller radius; clamp within [0.6, 1.4]
            const scaleFactor = 0.6 + 0.8 * opaqueRatio;
            lightRadius = Math.max(
              0.5,
              cfg.lightRadius * (lightTile.scale ?? 1) * scaleFactor
            );
          }
        } catch {}
      }

      // Convert light center from cells to world coordinates
      const lightWorldX = lightCenterX * cellSize + gridOrigin;
      const lightWorldY = lightCenterY * cellSize + gridOrigin;
      const lightScreen = worldToScreen(lightWorldX, lightWorldY);

      // Generate visibility polygon in cell space
      const vertices = generateVisibilityPolygon(
        lightCenterX,
        lightCenterY,
        lightRadius,
        occluderGrid,
        cfg.rayCount
      );

      console.log("[Lighting] Drawing light:", {
        cellPos: { x: lightCenterX, y: lightCenterY },
        screenPos: { x: lightScreen.x, y: lightScreen.y },
        radius: lightRadius,
        vertices: vertices.length,
      });

      // Create a temporary canvas for this light with clip path
      const lightCanvas = document.createElement("canvas");
      lightCanvas.width = width;
      lightCanvas.height = height;
      const lightCtx = lightCanvas.getContext("2d");
      if (!lightCtx) continue;

      // Set up clipping path from visibility polygon (raycast result)
      // Limit only the gradient fill to the clipped region; remove clip before masking
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

      // Draw radial gradient within the clipped region
      const lightRadiusPx = lightRadius * cellSize * camera.zoom;
      const gradient = lightCtx.createRadialGradient(
        lightScreen.x,
        lightScreen.y,
        0,
        lightScreen.x,
        lightScreen.y,
        lightRadiusPx
      );

      // Convert light color to RGB for gradient
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

      // Remove clip before applying tile alpha masking
      lightCtx.restore();

      // Avoid blurring alpha edges when masking
      lightCtx.imageSmoothingEnabled = false;

      // Additionally mask with tile alpha to refine shadow edges
      // We need to darken the light where tiles have alpha, using the alpha as a mask

      // Find all blocking tiles within light radius
      const lightRadiusCells = lightRadius * 1.5;
      const minTileX = Math.floor(lightCenterX - lightRadiusCells);
      const maxTileX = Math.ceil(lightCenterX + lightRadiusCells);
      const minTileY = Math.floor(lightCenterY - lightRadiusCells);
      const maxTileY = Math.ceil(lightCenterY + lightRadiusCells);

      for (const tile of placedTiles) {
        if (
          tile.cellX < minTileX ||
          tile.cellX > maxTileX ||
          tile.cellY < minTileY ||
          tile.cellY > maxTileY
        ) {
          continue;
        }

        const enriched = enrichTileWithMetadata(tile);
        if (!enriched || !hasTileEffect(enriched.metadata, "collision")) {
          continue;
        }

        const img = imageCache.get(tile.src);
        if (!img || !img.complete || img.width === 0) continue;

        // Get tile position in world space
        // Render mask in screen space using worldToScreen center
        lightCtx.save();

        // Mirror BattlemapCanvas placement: center image on grid footprint center, using native PNG dimensions
        const nameMatch = tile.src
          .split("/")
          .pop()
          ?.match(/_(\d+)x(\d+)/i);
        const baseW = nameMatch ? parseInt(nameMatch[1], 10) : 1;
        const baseH = nameMatch ? parseInt(nameMatch[2], 10) : 1;
        const rotationIndex = tile.rotationIndex ?? 0;
        const footprintW = rotationIndex % 2 === 0 ? baseW : baseH;
        const footprintH = rotationIndex % 2 === 0 ? baseH : baseW;
        const imgNativeW = Math.max(1, img.width || 0);
        const imgNativeH = Math.max(1, img.height || 0);
        const scale = tile.scale ?? 1;
        const tileWidthPx = imgNativeW * (camera?.zoom ?? 1) * scale;
        const tileHeightPx = imgNativeH * (camera?.zoom ?? 1) * scale;

        // Move to tile center and apply transforms
        // Compute screen-space center based on footprint center
        const centerCellX =
          typeof (tile as any).centerX === "number"
            ? (tile as any).centerX
            : tile.cellX + footprintW / 2;
        const centerCellY =
          typeof (tile as any).centerY === "number"
            ? (tile as any).centerY
            : tile.cellY + footprintH / 2;
        const worldCenterX = gridOrigin + centerCellX * cellSize;
        const worldCenterY = gridOrigin + centerCellY * cellSize;
        // Translate to screen-space center
        const screenCenter = worldToScreen(worldCenterX, worldCenterY);
        lightCtx.translate(
          Math.round(screenCenter.x),
          Math.round(screenCenter.y)
        );

        if (rotationIndex) {
          lightCtx.rotate((rotationIndex * Math.PI) / 2);
        }

        if (tile.mirrorX) lightCtx.scale(-1, 1);
        if (tile.mirrorY) lightCtx.scale(1, -1);

        // Use destination-out to remove light where the tile is opaque
        lightCtx.globalCompositeOperation = "destination-out";
        // First pass: exact alpha mask
        lightCtx.drawImage(
          img,
          -tileWidthPx / 2,
          -tileHeightPx / 2,
          tileWidthPx,
          tileHeightPx
        );
        // Second pass: slight 1px dilation to eat residual fringes
        lightCtx.drawImage(
          img,
          -tileWidthPx / 2 - 1,
          -tileHeightPx / 2 - 1,
          tileWidthPx + 2,
          tileHeightPx + 2
        );

        lightCtx.restore();
      }

      lightCtx.globalCompositeOperation = "source-over";

      // Composite this light onto the darkness canvas (removes darkness)
      darkCtx.drawImage(lightCanvas, 0, 0);
    }

    darkCtx.globalCompositeOperation = "source-over";
  }

  // Draw darkness layer to main canvas
  ctx.save();
  ctx.drawImage(darknessCanvas, 0, 0);
  ctx.restore();

  // Apply colored light overlays using the same visibility polygons
  if (lightingTiles.length > 0 && camera) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay"; // Overlay blend mode for color tinting

    for (const lightTile of lightingTiles) {
      const lightCenterX = lightTile.cellX + 0.5;
      const lightCenterY = lightTile.cellY + 0.5;

      // Get light properties from tile metadata
      const lightProps = getTileLightProperties(lightTile);
      const lightColor = lightProps?.color ?? cfg.lightColor;
      let lightRadius = cfg.lightRadius * (lightTile.scale ?? 1);

      // Apply same radius adjustment as the white light
      const lightImg = imageCache.get(lightTile.src);
      if (
        lightImg &&
        lightImg.complete &&
        lightImg.width > 0 &&
        lightImg.height > 0
      ) {
        try {
          const sampleCanvas = document.createElement("canvas");
          const sW = Math.min(128, lightImg.width);
          const sH = Math.min(128, lightImg.height);
          sampleCanvas.width = sW;
          sampleCanvas.height = sH;
          const sCtx = sampleCanvas.getContext("2d");
          if (sCtx) {
            sCtx.drawImage(lightImg, 0, 0, sW, sH);
            const imgData = sCtx.getImageData(0, 0, sW, sH).data;
            let opaque = 0;
            const total = sW * sH;
            for (let i = 0; i < imgData.length; i += 4) {
              const a = imgData[i + 3];
              if (a > 200) opaque++;
            }
            const opaqueRatio = opaque / total;
            const scaleFactor = 0.6 + 0.8 * opaqueRatio;
            lightRadius = Math.max(
              0.5,
              cfg.lightRadius * (lightTile.scale ?? 1) * scaleFactor
            );
          }
        } catch {}
      }

      // Convert light center from cells to world coordinates
      const lightWorldX = lightCenterX * cellSize + gridOrigin;
      const lightWorldY = lightCenterY * cellSize + gridOrigin;
      const lightScreen = worldToScreen(lightWorldX, lightWorldY);

      // Generate the same visibility polygon
      const vertices = generateVisibilityPolygon(
        lightCenterX,
        lightCenterY,
        lightRadius,
        occluderGrid,
        cfg.rayCount
      );

      // Create colored light canvas with clipping
      const colorCanvas = document.createElement("canvas");
      colorCanvas.width = width;
      colorCanvas.height = height;
      const colorCtx = colorCanvas.getContext("2d");
      if (!colorCtx) continue;

      // Set up the same clipping path
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

      // Draw colored radial gradient within the clipped region
      const lightRadiusPx = lightRadius * cellSize * camera.zoom;
      const colorGradient = colorCtx.createRadialGradient(
        lightScreen.x,
        lightScreen.y,
        0,
        lightScreen.x,
        lightScreen.y,
        lightRadiusPx
      );

      // Convert light color to RGB
      const rgb = hexToRgb(lightColor);
      const colorIntensity = cfg.lightIntensity * 0.4; // Reduced for subtle tint
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

      // Composite the colored light onto main canvas
      ctx.drawImage(colorCanvas, 0, 0);
    }

    ctx.restore();
  }

  // Legacy color tint overlay (kept for backward compatibility)
  if (cfg.applyColorTint && lightingTiles.length > 0 && camera) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";

    for (const lightTile of lightingTiles) {
      const lightCenterX = lightTile.cellX + 0.5;
      const lightCenterY = lightTile.cellY + 0.5;

      const tintMap = generateLightTintMap(
        lightCenterX,
        lightCenterY,
        cfg.lightRadius * (lightTile.scale ?? 1),
        cfg.lightIntensity,
        cfg.lightColor,
        occluderGrid,
        width,
        height,
        cellSize,
        gridOrigin,
        worldToScreen,
        camera,
        cfg.rayCount
      );

      ctx.drawImage(tintMap, 0, 0);
    }

    ctx.restore();
  }
}

/**
 * Helper: Render tiled shading texture
 */
function renderTiledShading(
  ctx: CanvasRenderingContext2D,
  shadingImg: HTMLImageElement,
  width: number,
  height: number,
  cellSize: number,
  gridOrigin: number,
  camera: { panX: number; panY: number; zoom: number }
): void {
  const viewLeft = -camera.panX / camera.zoom - gridOrigin;
  const viewTop = -camera.panY / camera.zoom - gridOrigin;
  const viewRight = viewLeft + width / camera.zoom;
  const viewBottom = viewTop + height / camera.zoom;

  const startX = Math.floor(viewLeft / cellSize) - 1;
  const endX = Math.ceil(viewRight / cellSize) + 1;
  const startY = Math.floor(viewTop / cellSize) - 1;
  const endY = Math.ceil(viewBottom / cellSize) + 1;

  for (let tx = startX; tx <= endX; tx++) {
    for (let ty = startY; ty <= endY; ty++) {
      const x = tx * cellSize;
      const y = ty * cellSize;
      const screenX = (gridOrigin + x) * camera.zoom + camera.panX;
      const screenY = (gridOrigin + y) * camera.zoom + camera.panY;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.drawImage(shadingImg, 0, 0, cellSize, cellSize);
      ctx.restore();
    }
  }
}

/**
 * Create an unlit tile mask (for tiles that should always be dark)
 * This can be used to mask out walls so they don't receive lighting
 *
 * @param placedTiles - All tiles on the map
 * @param imageCache - Cache of loaded tile images
 * @param width - Canvas width
 * @param height - Canvas height
 * @param cellSize - Cell size in pixels
 * @param gridOrigin - Grid origin offset
 * @param worldToScreen - Coordinate conversion
 * @returns Canvas with unlit tile masks
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

    const rectWidth = cellSize; // Assume 1x1 for now
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
