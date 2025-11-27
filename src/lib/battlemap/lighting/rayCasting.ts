/**
 * Ray Casting System
 * Traces rays through the occluder grid to determine light visibility
 */

import type { OccluderGrid } from "./occluderGrid";
import { sampleOccluderGrid } from "./occluderGrid";

/**
 * Cast a ray from (x0, y0) to (x1, y1) in cell-space coordinates
 * Returns the accumulated opacity along the ray (0 = clear, 1 = fully blocked)
 *
 * @param x0 - Start X in cells
 * @param y0 - Start Y in cells
 * @param x1 - Target X in cells
 * @param y1 - Target Y in cells
 * @param occluderGrid - The occluder grid to test against
 * @param maxDistance - Maximum distance to trace (in cells)
 * @returns Object with accumulated opacity and distance traveled
 */
export function castRay(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  occluderGrid: OccluderGrid,
  maxDistance: number = Infinity
): { opacity: number; distance: number } {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const totalDist = Math.sqrt(dx * dx + dy * dy);

  if (totalDist === 0) {
    return { opacity: 0, distance: 0 };
  }

  const clampedDist = Math.min(totalDist, maxDistance);

  // Sample at very high resolution for precise alpha detection (0.0625 cells = 16 samples per cell)
  const stepSize = 0.0625;
  const steps = Math.ceil(clampedDist / stepSize);

  // Normalized direction
  const dirX = dx / totalDist;
  const dirY = dy / totalDist;

  let accumulatedOpacity = 0;
  let currentDistance = 0;

  for (let i = 1; i <= steps; i++) {
    currentDistance = (i / steps) * clampedDist;
    const x = x0 + dirX * currentDistance;
    const y = y0 + dirY * currentDistance;

    // Sample occluder grid at this position
    const opacity = sampleOccluderGrid(occluderGrid, x, y);

    // Accumulate opacity with exponential falloff model
    // This simulates light absorption through semi-transparent media
    if (opacity > 0) {
      // Each step absorbs light based on opacity and step size
      const absorption = opacity * stepSize;
      accumulatedOpacity += absorption * (1 - accumulatedOpacity);

      // Early exit if we hit solid geometry (opacity > 0.5)
      // OR if accumulated opacity is significantly blocked
      if (opacity > 0.5 || accumulatedOpacity >= 0.3) {
        return {
          opacity: Math.max(opacity, accumulatedOpacity),
          distance: currentDistance,
        };
      }
    }
  }

  // If we made it through the whole ray, return the actual distance traveled
  // Even if some opacity accumulated, the ray reached its full distance
  return { opacity: accumulatedOpacity, distance: clampedDist };
}

/**
 * Cast multiple rays in a cone from a point
 * Useful for generating smooth shadow boundaries
 *
 * @param x0 - Start X in cells
 * @param y0 - Start Y in cells
 * @param targetX - Target X in cells
 * @param targetY - Target Y in cells
 * @param coneAngle - Cone angle in radians (e.g., 0.1 = ~6 degrees)
 * @param rayCount - Number of rays to cast in the cone
 * @param occluderGrid - The occluder grid
 * @param maxDistance - Maximum distance to trace
 * @returns Average opacity across all rays
 */
export function castRayCone(
  x0: number,
  y0: number,
  targetX: number,
  targetY: number,
  coneAngle: number,
  rayCount: number,
  occluderGrid: OccluderGrid,
  maxDistance: number = Infinity
): number {
  const dx = targetX - x0;
  const dy = targetY - y0;
  const baseAngle = Math.atan2(dy, dx);

  let totalOpacity = 0;

  for (let i = 0; i < rayCount; i++) {
    const t = rayCount > 1 ? (i / (rayCount - 1)) * 2 - 1 : 0; // -1 to 1
    const angle = baseAngle + t * (coneAngle / 2);

    const dist = Math.sqrt(dx * dx + dy * dy);
    const endX = x0 + Math.cos(angle) * dist;
    const endY = y0 + Math.sin(angle) * dist;

    const result = castRay(x0, y0, endX, endY, occluderGrid, maxDistance);
    totalOpacity += result.opacity;
  }

  return totalOpacity / rayCount;
}

/**
 * Generate visibility polygon vertices for a light source
 * Casts rays in a circle and returns the points where light reaches or is blocked
 *
 * @param centerX - Light center X in cells
 * @param centerY - Light center Y in cells
 * @param radius - Light radius in cells
 * @param rayCount - Number of rays (more = smoother shadows, default 360)
 * @param occluderGrid - The occluder grid
 * @returns Array of {x, y, opacity} vertices in cell space
 */
export function generateVisibilityPolygon(
  centerX: number,
  centerY: number,
  radius: number,
  occluderGrid: OccluderGrid,
  rayCount: number = 360
): Array<{ x: number; y: number; opacity: number }> {
  const vertices: Array<{ x: number; y: number; opacity: number }> = [];
  const angleStep = (Math.PI * 2) / rayCount;

  let blockedCount = 0;
  for (let i = 0; i < rayCount; i++) {
    const angle = i * angleStep;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    const targetX = centerX + dx * radius;
    const targetY = centerY + dy * radius;

    const result = castRay(
      centerX,
      centerY,
      targetX,
      targetY,
      occluderGrid,
      radius
    );

    if (result.opacity > 0.5) blockedCount++;

    // Calculate actual end point (either blocked or at max radius)
    const actualDist = result.distance;
    const endX = centerX + dx * actualDist;
    const endY = centerY + dy * actualDist;

    vertices.push({
      x: endX,
      y: endY,
      opacity: result.opacity,
    });
  }

  // Debug: Check if distances are actually varying
  const uniqueDistances = new Set(
    vertices.map((v) => {
      const dx = v.x - centerX;
      const dy = v.y - centerY;
      return Math.sqrt(dx * dx + dy * dy).toFixed(2);
    })
  );

  console.log("[RayCasting] Visibility polygon:", {
    center: { x: centerX, y: centerY },
    radius,
    rayCount,
    blockedRays: blockedCount,
    totalRays: rayCount,
    blockagePercent: ((blockedCount / rayCount) * 100).toFixed(1) + "%",
    uniqueDistances: uniqueDistances.size,
    sampleDistances: Array.from(uniqueDistances).slice(0, 10),
  });

  return vertices;
}

/**
 * Smooth a visibility polygon using Catmull-Rom interpolation
 * Creates smooth curves between ray endpoints to eliminate jagged edges
 *
 * @param vertices - Original visibility polygon vertices
 * @param interpolationSteps - Number of interpolation steps between each pair of vertices (default 4)
 * @returns Smoothed vertices with interpolated points
 */
export function smoothVisibilityPolygon(
  vertices: Array<{ x: number; y: number; opacity: number }>,
  interpolationSteps: number = 4
): Array<{ x: number; y: number; opacity: number }> {
  if (vertices.length < 2) return vertices;

  const smoothed: Array<{ x: number; y: number; opacity: number }> = [];

  for (let i = 0; i < vertices.length; i++) {
    const p0 = vertices[(i - 1 + vertices.length) % vertices.length];
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    const p3 = vertices[(i + 2) % vertices.length];

    // Add the current vertex
    smoothed.push(p1);

    // Interpolate between p1 and p2 using Catmull-Rom
    for (let step = 1; step <= interpolationSteps; step++) {
      const t = step / (interpolationSteps + 1);
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom basis functions
      const q =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

      const r =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

      const opacityInterp =
        0.5 *
        (2 * p1.opacity +
          (-p0.opacity + p2.opacity) * t +
          (2 * p0.opacity - 5 * p1.opacity + 4 * p2.opacity - p3.opacity) * t2 +
          (-p0.opacity + 3 * p1.opacity - 3 * p2.opacity + p3.opacity) * t3);

      smoothed.push({
        x: q,
        y: r,
        opacity: Math.max(0, Math.min(1, opacityInterp)), // Clamp to 0-1
      });
    }
  }

  return smoothed;
}

/**
 * Optimized visibility polygon generation with adaptive ray density
 * Casts more rays near shadow edges for smooth shadows
 *
 * @param centerX - Light center X in cells
 * @param centerY - Light center Y in cells
 * @param radius - Light radius in cells
 * @param occluderGrid - The occluder grid
 * @param minRayCount - Minimum rays (in open areas)
 * @param maxRayCount - Maximum rays (near occluders)
 * @returns Array of vertices
 */
export function generateAdaptiveVisibilityPolygon(
  centerX: number,
  centerY: number,
  radius: number,
  occluderGrid: OccluderGrid,
  minRayCount: number = 120,
  maxRayCount: number = 360
): Array<{ x: number; y: number; opacity: number }> {
  // First pass: low-res scan to find shadow edges
  const coarseVertices = generateVisibilityPolygon(
    centerX,
    centerY,
    radius,
    occluderGrid,
    minRayCount
  );

  const vertices: Array<{ x: number; y: number; opacity: number }> = [];

  // Second pass: refine near shadow edges
  for (let i = 0; i < coarseVertices.length; i++) {
    const curr = coarseVertices[i];
    const next = coarseVertices[(i + 1) % coarseVertices.length];

    vertices.push(curr);

    // Check if there's a shadow edge between curr and next
    const opacityDiff = Math.abs(curr.opacity - next.opacity);
    const distDiff = Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2);

    // If there's a significant opacity change or distance change, add intermediate rays
    if (opacityDiff > 0.3 || distDiff > 0.5) {
      const refinementCount = Math.min(
        5,
        Math.ceil((maxRayCount / minRayCount) * opacityDiff * 5)
      );

      for (let j = 1; j <= refinementCount; j++) {
        const t = j / (refinementCount + 1);
        const angle =
          Math.atan2(curr.y - centerY, curr.x - centerX) * (1 - t) +
          Math.atan2(next.y - centerY, next.x - centerX) * t;

        const targetX = centerX + Math.cos(angle) * radius;
        const targetY = centerY + Math.sin(angle) * radius;

        const result = castRay(
          centerX,
          centerY,
          targetX,
          targetY,
          occluderGrid,
          radius
        );

        const actualDist = result.distance;
        const endX = centerX + Math.cos(angle) * actualDist;
        const endY = centerY + Math.sin(angle) * actualDist;

        vertices.push({ x: endX, y: endY, opacity: result.opacity });
      }
    }
  }

  return vertices;
}
