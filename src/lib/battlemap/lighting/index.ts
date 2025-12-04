/**
 * Battlemap Lighting System
 * Segment-based ray-traced lighting with contour-traced occlusion
 */

// New segment-based system (primary)
export {
  traceContour,
  traceAndCacheContour,
  getCachedContour,
  clearContourCache,
  getContourCacheKey,
} from "./contourTracer";
export type { Segment, Point } from "./contourTracer";

export {
  buildOccluderSegments,
  clearOccluderCache,
  buildSpatialIndex,
  getSegmentsAlongRay,
} from "./occluderSegments";
export type { OccluderData, SpatialIndex } from "./occluderSegments";

export {
  intersectRaySegment,
  castRayToSegments,
  castRaysRadial,
  generateVisibilityPolygonFromSegments,
} from "./raySegmentIntersection";

export { renderRayTracedLighting, createUnlitMask } from "./lightRenderer";
export type { LightingConfig } from "./lightRenderer";

// Legacy alpha-grid system (kept for backward compatibility)
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
