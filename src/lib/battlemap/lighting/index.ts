/**
 * Battlemap Lighting System
 * Ray-traced lighting with alpha-based occlusion
 */

export {
  buildOccluderGrid,
  sampleOccluderGrid,
  getOccupiedCells,
} from "./occluderGrid";
export type { OccluderGrid } from "./occluderGrid";

export {
  castRay,
  castRayCone,
  generateVisibilityPolygon,
  smoothVisibilityPolygon,
  generateAdaptiveVisibilityPolygon,
} from "./rayCasting";

export {
  generateShadowMap,
  generateLightMap,
  generateLightTintMap,
  generateLightMapsBatch,
} from "./shadowMap";
export type { Camera, WorldToScreenFunc } from "./shadowMap";

export { renderRayTracedLighting, createUnlitMask } from "./lightRenderer";
export type { LightingConfig } from "./lightRenderer";
