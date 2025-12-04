/**
 * Ray-Segment Intersection
 * Fast analytical intersection between rays and line segments
 */

import type { Segment } from "./contourTracer";

/**
 * Compute intersection of ray with line segment.
 * Returns distance along ray to intersection, or null if no intersection.
 *
 * Ray: P = origin + t * direction, t >= 0
 * Segment: Q = (x1,y1) + s * ((x2,y2) - (x1,y1)), s in [0,1]
 *
 * @param originX - Ray origin X
 * @param originY - Ray origin Y
 * @param dirX - Ray direction X (normalized)
 * @param dirY - Ray direction Y (normalized)
 * @param segment - Line segment to test
 * @returns Distance to intersection, or null if no hit
 */
export function intersectRaySegment(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  segment: Segment
): number | null {
  const { x1, y1, x2, y2 } = segment;

  // Segment direction
  const segDx = x2 - x1;
  const segDy = y2 - y1;

  // Cross product of ray direction and segment direction
  const cross = dirX * segDy - dirY * segDx;

  // Parallel or near-parallel lines
  if (Math.abs(cross) < 1e-8) {
    return null;
  }

  // Vector from ray origin to segment start
  const dx = x1 - originX;
  const dy = y1 - originY;

  const t = (dx * segDy - dy * segDx) / cross;
  const s = (dx * dirY - dy * dirX) / cross;

  // Intersection is valid if:
  // - t >= 0: point is in front of ray origin
  // - 0 <= s <= 1: point is on the segment
  if (t >= -1e-6 && s >= -1e-6 && s <= 1 + 1e-6) {
    return Math.max(0, t);
  }

  return null;
}

/**
 * Cast a ray and find the closest intersection with any segment.
 *
 * @param originX - Ray origin X
 * @param originY - Ray origin Y
 * @param angle - Ray angle in radians
 * @param maxDist - Maximum distance to check
 * @param segments - Array of segments to test
 * @param segmentIndices - Optional set of segment indices to test (for spatial index optimization)
 * @returns Distance to closest hit, or maxDist if no hit
 */
export function castRayToSegments(
  originX: number,
  originY: number,
  angle: number,
  maxDist: number,
  segments: Segment[],
  segmentIndices?: Set<number>
): number {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  let closestDist = maxDist;

  if (segmentIndices) {
    for (const idx of segmentIndices) {
      const segment = segments[idx];
      const dist = intersectRaySegment(originX, originY, dirX, dirY, segment);
      if (dist !== null && dist < closestDist) {
        closestDist = dist;
      }
    }
  } else {
    for (const segment of segments) {
      const dist = intersectRaySegment(originX, originY, dirX, dirY, segment);
      if (dist !== null && dist < closestDist) {
        closestDist = dist;
      }
    }
  }

  return closestDist;
}

/**
 * Cast multiple rays and find intersection points.
 * Returns array of hit points for visibility polygon construction.
 *
 * @param originX - Ray origin X
 * @param originY - Ray origin Y
 * @param maxDist - Maximum distance (light radius)
 * @param segments - Array of segments
 * @param rayCount - Number of rays to cast (evenly distributed)
 * @returns Array of hit points in order around the origin
 */
export function castRaysRadial(
  originX: number,
  originY: number,
  maxDist: number,
  segments: Segment[],
  rayCount: number
): Array<{ x: number; y: number; dist: number }> {
  const points: Array<{ x: number; y: number; dist: number }> = [];
  const angleStep = (Math.PI * 2) / rayCount;

  for (let i = 0; i < rayCount; i++) {
    const angle = i * angleStep;
    const dist = castRayToSegments(originX, originY, angle, maxDist, segments);

    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    points.push({
      x: originX + dirX * dist,
      y: originY + dirY * dist,
      dist,
    });
  }

  return points;
}

/**
 * Generate visibility polygon using adaptive ray casting.
 * Casts more rays where shadow edges are detected.
 *
 * @param originX - Light center X
 * @param originY - Light center Y
 * @param maxDist - Light radius
 * @param segments - Occluder segments
 * @param minRays - Minimum number of rays
 * @param maxRays - Maximum number of rays
 * @returns Array of visibility polygon vertices
 */
export function generateVisibilityPolygonFromSegments(
  originX: number,
  originY: number,
  maxDist: number,
  segments: Segment[],
  minRays: number = 72,
  maxRays: number = 360
): Array<{ x: number; y: number }> {
  if (segments.length === 0) {
    // No occluders - return full circle
    const points: Array<{ x: number; y: number }> = [];
    const count = 32;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      points.push({
        x: originX + Math.cos(angle) * maxDist,
        y: originY + Math.sin(angle) * maxDist,
      });
    }
    return points;
  }

  // First pass: cast base rays
  const baseRays = castRaysRadial(originX, originY, maxDist, segments, minRays);

  // Detect edges where distance changes significantly
  const edgeAngles: number[] = [];
  const angleStep = (Math.PI * 2) / minRays;
  const distThreshold = maxDist * 0.05; // tighter edge detection

  for (let i = 0; i < baseRays.length; i++) {
    const prev = baseRays[(i - 1 + baseRays.length) % baseRays.length];
    const curr = baseRays[i];
    const next = baseRays[(i + 1) % baseRays.length];

    const diffPrev = Math.abs(curr.dist - prev.dist);
    const diffNext = Math.abs(curr.dist - next.dist);

    if (diffPrev > distThreshold || diffNext > distThreshold) {
      // This is likely a shadow edge - add more rays nearby
      const baseAngle = i * angleStep;
      edgeAngles.push(baseAngle);
    }
  }

  const twoPi = Math.PI * 2;
  const angleSet = new Set<number>();
  const normalizeAngle = (angle: number) => {
    const norm = ((angle % twoPi) + twoPi) % twoPi;
    return norm;
  };

  // Seed with base ray angles
  for (let i = 0; i < baseRays.length; i++) {
    angleSet.add(normalizeAngle(i * angleStep));
  }

  // Adaptive refinement angles near sharp distance changes
  const refinementBudget = Math.max(0, maxRays - minRays);
  const raysPerEdge =
    edgeAngles.length > 0
      ? Math.max(
          1,
          Math.floor(refinementBudget / Math.max(1, edgeAngles.length))
        )
      : 0;
  for (const edgeAngle of edgeAngles) {
    for (let j = 1; j <= raysPerEdge; j++) {
      const offset = (j / (raysPerEdge + 1)) * angleStep;
      for (const delta of [-offset, offset]) {
        angleSet.add(normalizeAngle(edgeAngle + delta));
      }
    }
  }

  // Always include angles that point at occluder vertices (± epsilon)
  const epsilon = 0.0003;
  for (const segment of segments) {
    const a1 = Math.atan2(segment.y1 - originY, segment.x1 - originX);
    const a2 = Math.atan2(segment.y2 - originY, segment.x2 - originX);
    angleSet.add(normalizeAngle(a1));
    angleSet.add(normalizeAngle(a2));
    angleSet.add(normalizeAngle(a1 + epsilon));
    angleSet.add(normalizeAngle(a1 - epsilon));
    angleSet.add(normalizeAngle(a2 + epsilon));
    angleSet.add(normalizeAngle(a2 - epsilon));
  }

  // Enforce maximum ray count by keeping the best-distributed angles
  let angles = Array.from(angleSet).sort((a, b) => a - b);
  if (angles.length > Math.max(maxRays, minRays)) {
    // Downsample by taking every nth angle
    const step = Math.ceil(angles.length / Math.max(maxRays, minRays));
    const reduced: number[] = [];
    for (let i = 0; i < angles.length; i += step) {
      reduced.push(angles[i]);
    }
    angles = reduced;
  }

  // Cast rays for the final angle set
  const points: Array<{ x: number; y: number }> = [];
  for (const angle of angles) {
    const dist = castRayToSegments(originX, originY, angle, maxDist, segments);
    points.push({
      x: originX + Math.cos(angle) * dist,
      y: originY + Math.sin(angle) * dist,
    });
  }

  return points;
}
