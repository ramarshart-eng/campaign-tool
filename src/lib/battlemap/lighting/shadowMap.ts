/**
 * Shadow Map Generation
 * Creates shadow masks for light sources using ray-traced visibility
 */

import type { OccluderGrid } from "./occluderGrid";
import { generateVisibilityPolygon } from "./rayCasting";

export type Camera = {
  panX: number;
  panY: number;
  zoom: number;
};

export type WorldToScreenFunc = (
  worldX: number,
  worldY: number
) => { x: number; y: number };

/**
 * Generate a shadow map canvas for a single light source
 *
 * @param lightCenterX - Light center X in cells
 * @param lightCenterY - Light center Y in cells
 * @param lightRadius - Light radius in cells
 * @param occluderGrid - The occluder grid
 * @param canvasWidth - Output canvas width in pixels
 * @param canvasHeight - Output canvas height in pixels
 * @param cellSize - Size of one cell in world units (e.g., 100px)
 * @param gridOrigin - World origin offset
 * @param worldToScreen - Function to convert world coords to screen coords
 * @param rayCount - Number of rays to cast (default 360)
 * @returns Canvas with white for lit areas, black for shadows
 */
export function generateShadowMap(
  lightCenterX: number,
  lightCenterY: number,
  lightRadius: number,
  occluderGrid: OccluderGrid,
  canvasWidth: number,
  canvasHeight: number,
  cellSize: number,
  gridOrigin: number,
  worldToScreen: WorldToScreenFunc,
  rayCount: number = 360
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Generate visibility polygon in cell space
  const vertices = generateVisibilityPolygon(
    lightCenterX,
    lightCenterY,
    lightRadius,
    occluderGrid,
    rayCount
  );

  // Calculate light center in canvas-local pixel coordinates
  // Canvas center is at (canvasWidth/2, canvasHeight/2)
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;

  // Convert light center from cell coords to canvas-local pixel coords
  const lightWorldX = lightCenterX * cellSize + gridOrigin;
  const lightWorldY = lightCenterY * cellSize + gridOrigin;
  const lightScreen = worldToScreen(lightWorldX, lightWorldY);

  // Calculate offset from light to canvas center in screen space
  const offsetX = lightScreen.x - canvasCenterX;
  const offsetY = lightScreen.y - canvasCenterY;

  // Draw lit area as continuous polygon connecting all ray endpoints
  ctx.fillStyle = "white";
  ctx.beginPath();

  // Draw polygon of all ray endpoints in canvas-local coordinates
  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i];
    const vertexWorldX = vertex.x * cellSize + gridOrigin;
    const vertexWorldY = vertex.y * cellSize + gridOrigin;
    const vertexScreen = worldToScreen(vertexWorldX, vertexWorldY);

    // Convert from screen coords to canvas-local coords by subtracting the offset
    const canvasX = vertexScreen.x - offsetX;
    const canvasY = vertexScreen.y - offsetY;

    if (i === 0) {
      ctx.moveTo(canvasX, canvasY);
    } else {
      ctx.lineTo(canvasX, canvasY);
    }
  }

  ctx.closePath();
  ctx.fill();

  const drawnTriangles = vertices.length;

  // Check if polygon is within canvas bounds
  const firstVertexScreen = worldToScreen(
    vertices[0].x * cellSize + gridOrigin,
    vertices[0].y * cellSize + gridOrigin
  );

  // Convert first vertex to canvas-local for validation
  const firstCanvasX = firstVertexScreen.x - offsetX;
  const firstCanvasY = firstVertexScreen.y - offsetY;

  console.log("[ShadowMap] Generated:", {
    lightCenter: { x: lightCenterX, y: lightCenterY },
    lightScreenPos: { x: lightScreen.x, y: lightScreen.y },
    canvasCenter: { x: canvasCenterX, y: canvasCenterY },
    offset: { x: offsetX, y: offsetY },
    vertices: vertices.length,
    firstVertexScreen: { x: firstVertexScreen.x, y: firstVertexScreen.y },
    firstVertexCanvasLocal: { x: firstCanvasX, y: firstCanvasY },
    canvasSize: { w: canvasWidth, h: canvasHeight },
    inBoundsCanvasLocal:
      firstCanvasX >= 0 &&
      firstCanvasX <= canvasWidth &&
      firstCanvasY >= 0 &&
      firstCanvasY <= canvasHeight,
  });

  return canvas;
}

/**
 * Generate a soft shadow map with gradient falloff and smooth edges
 *
 * @param lightCenterX - Light center X in cells
 * @param lightCenterY - Light center Y in cells
 * @param lightRadius - Light radius in cells
 * @param lightIntensity - Light brightness (0-1)
 * @param occluderGrid - The occluder grid
 * @param canvasWidth - Output canvas width in pixels
 * @param canvasHeight - Output canvas height in pixels
 * @param cellSize - Size of one cell in world units
 * @param gridOrigin - World origin offset
 * @param worldToScreen - Function to convert world coords to screen coords
 * @param camera - Camera state for zoom calculation
 * @param rayCount - Number of rays to cast
 * @returns Canvas with radial gradient masked by shadows
 */
export function generateLightMap(
  lightCenterX: number,
  lightCenterY: number,
  lightRadius: number,
  lightIntensity: number,
  occluderGrid: OccluderGrid,
  canvasWidth: number,
  canvasHeight: number,
  cellSize: number,
  gridOrigin: number,
  worldToScreen: WorldToScreenFunc,
  camera: Camera,
  rayCount: number = 360
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const lightWorldX = lightCenterX * cellSize + gridOrigin;
  const lightWorldY = lightCenterY * cellSize + gridOrigin;
  const lightScreen = worldToScreen(lightWorldX, lightWorldY);

  // Calculate screen-space radius using camera zoom
  const lightRadiusPx = lightRadius * cellSize * camera.zoom;

  // Calculate canvas-local coordinates for the gradient center
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;
  const offsetX = lightScreen.x - canvasCenterX;
  const offsetY = lightScreen.y - canvasCenterY;
  const gradientCenterX = canvasCenterX;
  const gradientCenterY = canvasCenterY;

  // Step 1: Draw radial gradient first (centered in canvas)
  const gradient = ctx.createRadialGradient(
    gradientCenterX,
    gradientCenterY,
    0,
    gradientCenterX,
    gradientCenterY,
    lightRadiusPx
  );

  // Gradient with smooth falloff
  gradient.addColorStop(0, `rgba(255, 255, 255, ${lightIntensity})`);
  gradient.addColorStop(0.7, `rgba(255, 255, 255, ${lightIntensity * 0.5})`);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Step 2: Mask the gradient with the shadow polygon using destination-in
  ctx.globalCompositeOperation = "destination-in";

  // Generate and draw shadow mask
  const shadowMask = generateShadowMap(
    lightCenterX,
    lightCenterY,
    lightRadius,
    occluderGrid,
    canvasWidth,
    canvasHeight,
    cellSize,
    gridOrigin,
    worldToScreen,
    rayCount
  );

  console.log("[LightMap] Before masking:", {
    lightScreenPos: { x: lightScreen.x, y: lightScreen.y },
    gradientCenter: { x: gradientCenterX, y: gradientCenterY },
    gradientRadius: lightRadiusPx,
    offset: { x: offsetX, y: offsetY },
    canvasSize: { w: canvas.width, h: canvas.height },
    maskSize: { w: shadowMask.width, h: shadowMask.height },
    compositeOp: ctx.globalCompositeOperation,
  });

  ctx.drawImage(shadowMask, 0, 0);

  console.log("[LightMap] After masking - complete");

  ctx.globalCompositeOperation = "source-over";

  return canvas;
}

/**
 * Generate a colored light tint map (for warm light overlays)
 *
 * @param lightCenterX - Light center X in cells
 * @param lightCenterY - Light center Y in cells
 * @param lightRadius - Light radius in cells
 * @param lightIntensity - Light brightness (0-1)
 * @param lightColor - Light color (hex string, e.g., "#e1be7a")
 * @param occluderGrid - The occluder grid
 * @param canvasWidth - Output canvas width in pixels
 * @param canvasHeight - Output canvas height in pixels
 * @param cellSize - Size of one cell in world units
 * @param gridOrigin - World origin offset
 * @param worldToScreen - Function to convert world coords to screen coords
 * @param camera - Camera state for zoom calculation
 * @param rayCount - Number of rays to cast
 * @returns Canvas with colored radial gradient masked by shadows
 */
export function generateLightTintMap(
  lightCenterX: number,
  lightCenterY: number,
  lightRadius: number,
  lightIntensity: number,
  lightColor: string,
  occluderGrid: OccluderGrid,
  canvasWidth: number,
  canvasHeight: number,
  cellSize: number,
  gridOrigin: number,
  worldToScreen: WorldToScreenFunc,
  camera: Camera,
  rayCount: number = 360
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const lightWorldX = lightCenterX * cellSize + gridOrigin;
  const lightWorldY = lightCenterY * cellSize + gridOrigin;
  const lightScreen = worldToScreen(lightWorldX, lightWorldY);

  // Calculate screen-space radius using camera zoom
  const lightRadiusPx = lightRadius * cellSize * camera.zoom;

  // Calculate canvas-local coordinates for the gradient center
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;

  // Parse color to RGB
  const rgb = hexToRgb(lightColor);

  // Step 1: Draw colored radial gradient first (centered in canvas)
  const gradient = ctx.createRadialGradient(
    canvasCenterX,
    canvasCenterY,
    0,
    canvasCenterX,
    canvasCenterY,
    lightRadiusPx
  );

  // Colored gradient
  gradient.addColorStop(
    0,
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${lightIntensity})`
  );
  gradient.addColorStop(
    0.5,
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${lightIntensity * 0.5})`
  );
  gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Step 2: Mask the gradient with the shadow polygon using destination-in
  ctx.globalCompositeOperation = "destination-in";

  // Generate shadow mask
  const shadowMask = generateShadowMap(
    lightCenterX,
    lightCenterY,
    lightRadius,
    occluderGrid,
    canvasWidth,
    canvasHeight,
    cellSize,
    gridOrigin,
    worldToScreen,
    rayCount
  );

  ctx.drawImage(shadowMask, 0, 0);

  ctx.globalCompositeOperation = "source-over";

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
 * Batch generate light maps for multiple light sources
 * More efficient than generating individually
 *
 * @param lights - Array of light configurations
 * @param occluderGrid - The occluder grid
 * @param canvasWidth - Output canvas width
 * @param canvasHeight - Output canvas height
 * @param cellSize - Size of one cell
 * @param gridOrigin - World origin offset
 * @param worldToScreen - Coordinate conversion function
 * @param camera - Camera state for zoom calculation
 * @returns Array of light map canvases
 */
export function generateLightMapsBatch(
  lights: Array<{
    centerX: number;
    centerY: number;
    radius: number;
    intensity: number;
    color?: string;
  }>,
  occluderGrid: OccluderGrid,
  canvasWidth: number,
  canvasHeight: number,
  cellSize: number,
  gridOrigin: number,
  worldToScreen: WorldToScreenFunc,
  camera: Camera
): HTMLCanvasElement[] {
  return lights.map((light) =>
    generateLightMap(
      light.centerX,
      light.centerY,
      light.radius,
      light.intensity,
      occluderGrid,
      canvasWidth,
      canvasHeight,
      cellSize,
      gridOrigin,
      worldToScreen,
      camera
    )
  );
}
