/**
 * Contour Tracer
 * Extracts polygon outlines from tile alpha channels using marching squares,
 * then simplifies to line segments for fast ray intersection.
 */

export type Point = { x: number; y: number };
export type Segment = { x1: number; y1: number; x2: number; y2: number };

/**
 * Cache for traced contours, keyed by tile src + rotation + mirror state
 */
const contourCache = new Map<string, Segment[]>();

/**
 * Get cache key for a tile's contour
 */
export function getContourCacheKey(
  src: string,
  rotationIndex: number,
  mirrorX: boolean,
  mirrorY: boolean,
  alphaThreshold: number = 128,
  simplifyEpsilon: number = 0.01
): string {
  return `${src}|${rotationIndex}|${mirrorX ? 1 : 0}|${
    mirrorY ? 1 : 0
  }|${alphaThreshold}|${simplifyEpsilon.toFixed(4)}`;
}

/**
 * Get cached contour segments for a tile, or null if not cached
 */
export function getCachedContour(cacheKey: string): Segment[] | null {
  return contourCache.get(cacheKey) ?? null;
}

/**
 * Store contour segments in cache
 */
export function setCachedContour(cacheKey: string, segments: Segment[]): void {
  contourCache.set(cacheKey, segments);
}

/**
 * Clear the contour cache (e.g., when tiles are reloaded)
 */
export function clearContourCache(): void {
  contourCache.clear();
}

/**
 * Trace contours from an image's alpha channel using marching squares.
 * Returns simplified line segments in normalized coordinates (0-1 range).
 *
 * @param img - Source image
 * @param rotationIndex - Rotation (0-3, multiples of 90°)
 * @param mirrorX - Horizontal flip
 * @param mirrorY - Vertical flip
 * @param alphaThreshold - Alpha value (0-255) above which pixel is considered solid
 * @param simplifyEpsilon - Douglas-Peucker simplification tolerance (in normalized coords)
 * @returns Array of line segments in normalized 0-1 coordinates
 */
export function traceContour(
  img: HTMLImageElement,
  rotationIndex: number = 0,
  mirrorX: boolean = false,
  mirrorY: boolean = false,
  alphaThreshold: number = 128,
  simplifyEpsilon: number = 0.01
): Segment[] {
  // Sample at higher resolution for better curve fidelity
  const maxDim = 512;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const srcW = Math.max(1, Math.round(img.width * scale));
  const srcH = Math.max(1, Math.round(img.height * scale));

  // For 90/270 degree rotations, swap canvas dimensions so rotated image fits
  const isRightAngle = rotationIndex % 2 !== 0;
  const w = isRightAngle ? srcH : srcW;
  const h = isRightAngle ? srcW : srcH;

  // Create canvas and draw image with transforms
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);

  if (rotationIndex) {
    ctx.rotate((rotationIndex * Math.PI) / 2);
  }

  ctx.scale(mirrorX ? -1 : 1, mirrorY ? -1 : 1);
  // Draw using source dimensions (before rotation swap)
  ctx.drawImage(img, -srcW / 2, -srcH / 2, srcW, srcH);
  ctx.restore();

  // Get alpha data
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  // Build binary grid (1 = solid, 0 = empty)
  const grid: number[][] = [];
  for (let y = 0; y < h; y++) {
    grid[y] = [];
    for (let x = 0; x < w; x++) {
      const alpha = pixels[(y * w + x) * 4 + 3];
      grid[y][x] = alpha > alphaThreshold ? 1 : 0;
    }
  }

  // Run marching squares to extract contour edges
  const edges = marchingSquares(grid, w, h);

  // Convert edges to normalized coordinates and simplify
  const normalizedEdges: Segment[] = edges.map((e) => ({
    x1: e.x1 / w,
    y1: e.y1 / h,
    x2: e.x2 / w,
    y2: e.y2 / h,
  }));

  // Chain edges into polylines and simplify each
  const polylines = chainEdges(normalizedEdges);
  const simplifiedSegments: Segment[] = [];

  for (const polyline of polylines) {
    const simplified = douglasPeucker(polyline, simplifyEpsilon);
    // Convert back to segments
    for (let i = 0; i < simplified.length - 1; i++) {
      simplifiedSegments.push({
        x1: simplified[i].x,
        y1: simplified[i].y,
        x2: simplified[i + 1].x,
        y2: simplified[i + 1].y,
      });
    }
  }

  return simplifiedSegments;
}

/**
 * Marching squares algorithm - extracts contour edges from binary grid
 */
function marchingSquares(grid: number[][], w: number, h: number): Segment[] {
  const edges: Segment[] = [];

  // Process each 2x2 cell
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      // Get corner values (clockwise from top-left)
      const tl = grid[y][x];
      const tr = grid[y][x + 1];
      const br = grid[y + 1][x + 1];
      const bl = grid[y + 1][x];

      // Compute case index (4-bit)
      const caseIndex = (tl << 3) | (tr << 2) | (br << 1) | bl;

      // Skip empty and full cells
      if (caseIndex === 0 || caseIndex === 15) continue;

      // Edge positions (midpoints of cell edges)
      const top = { x: x + 0.5, y: y };
      const right = { x: x + 1, y: y + 0.5 };
      const bottom = { x: x + 0.5, y: y + 1 };
      const left = { x: x, y: y + 0.5 };

      // Add edges based on case
      switch (caseIndex) {
        case 1: // bottom-left only
          edges.push({ x1: left.x, y1: left.y, x2: bottom.x, y2: bottom.y });
          break;
        case 2: // bottom-right only
          edges.push({ x1: bottom.x, y1: bottom.y, x2: right.x, y2: right.y });
          break;
        case 3: // bottom row
          edges.push({ x1: left.x, y1: left.y, x2: right.x, y2: right.y });
          break;
        case 4: // top-right only
          edges.push({ x1: right.x, y1: right.y, x2: top.x, y2: top.y });
          break;
        case 5: // top-right and bottom-left (saddle)
          edges.push({ x1: left.x, y1: left.y, x2: top.x, y2: top.y });
          edges.push({ x1: bottom.x, y1: bottom.y, x2: right.x, y2: right.y });
          break;
        case 6: // right column
          edges.push({ x1: bottom.x, y1: bottom.y, x2: top.x, y2: top.y });
          break;
        case 7: // all but top-left
          edges.push({ x1: left.x, y1: left.y, x2: top.x, y2: top.y });
          break;
        case 8: // top-left only
          edges.push({ x1: top.x, y1: top.y, x2: left.x, y2: left.y });
          break;
        case 9: // left column
          edges.push({ x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y });
          break;
        case 10: // top-left and bottom-right (saddle)
          edges.push({ x1: top.x, y1: top.y, x2: right.x, y2: right.y });
          edges.push({ x1: left.x, y1: left.y, x2: bottom.x, y2: bottom.y });
          break;
        case 11: // all but top-right
          edges.push({ x1: top.x, y1: top.y, x2: right.x, y2: right.y });
          break;
        case 12: // top row
          edges.push({ x1: right.x, y1: right.y, x2: left.x, y2: left.y });
          break;
        case 13: // all but bottom-right
          edges.push({ x1: bottom.x, y1: bottom.y, x2: right.x, y2: right.y });
          break;
        case 14: // all but bottom-left
          edges.push({ x1: left.x, y1: left.y, x2: bottom.x, y2: bottom.y });
          break;
      }
    }
  }

  return edges;
}

/**
 * Chain disconnected edges into continuous polylines
 */
function chainEdges(edges: Segment[]): Point[][] {
  if (edges.length === 0) return [];

  const polylines: Point[][] = [];
  const used = new Set<number>();
  const epsilon = 0.001;

  function pointsEqual(p1: Point, p2: Point): boolean {
    return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;
  }

  function findConnected(point: Point, excludeIdx: number): number {
    for (let i = 0; i < edges.length; i++) {
      if (used.has(i) || i === excludeIdx) continue;
      const e = edges[i];
      if (
        pointsEqual(point, { x: e.x1, y: e.y1 }) ||
        pointsEqual(point, { x: e.x2, y: e.y2 })
      ) {
        return i;
      }
    }
    return -1;
  }

  for (let startIdx = 0; startIdx < edges.length; startIdx++) {
    if (used.has(startIdx)) continue;

    const polyline: Point[] = [];
    let currentIdx = startIdx;

    // Build chain forward
    while (currentIdx !== -1 && !used.has(currentIdx)) {
      used.add(currentIdx);
      const edge = edges[currentIdx];

      if (polyline.length === 0) {
        polyline.push({ x: edge.x1, y: edge.y1 });
        polyline.push({ x: edge.x2, y: edge.y2 });
      } else {
        const lastPoint = polyline[polyline.length - 1];
        if (pointsEqual(lastPoint, { x: edge.x1, y: edge.y1 })) {
          polyline.push({ x: edge.x2, y: edge.y2 });
        } else {
          polyline.push({ x: edge.x1, y: edge.y1 });
        }
      }

      const nextPoint = polyline[polyline.length - 1];
      currentIdx = findConnected(nextPoint, currentIdx);
    }

    if (polyline.length >= 2) {
      polylines.push(polyline);
    }
  }

  return polylines;
}

/**
 * Douglas-Peucker line simplification algorithm
 */
function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  // Find point with maximum distance from line between first and last
  let maxDist = 0;
  let maxIdx = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  // Otherwise, return just endpoints
  return [first, last];
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLenSq = dx * dx + dy * dy;

  if (lineLenSq === 0) {
    // Line is a point
    const pdx = point.x - lineStart.x;
    const pdy = point.y - lineStart.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }

  // Project point onto line
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLenSq
    )
  );

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  const distX = point.x - projX;
  const distY = point.y - projY;

  return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Trace and cache contour for a tile
 */
export function traceAndCacheContour(
  img: HTMLImageElement,
  src: string,
  rotationIndex: number = 0,
  mirrorX: boolean = false,
  mirrorY: boolean = false,
  alphaThreshold: number = 128,
  simplifyEpsilon: number = 0.01
): Segment[] {
  const cacheKey = getContourCacheKey(
    src,
    rotationIndex,
    mirrorX,
    mirrorY,
    alphaThreshold,
    simplifyEpsilon
  );

  let segments = getCachedContour(cacheKey);
  if (segments) {
    return segments;
  }

  segments = traceContour(
    img,
    rotationIndex,
    mirrorX,
    mirrorY,
    alphaThreshold,
    simplifyEpsilon
  );
  setCachedContour(cacheKey, segments);

  // Debug: log segment count for new traces
  console.log(
    `[ContourTracer] Traced ${segments.length} segments for ${src
      .split("/")
      .pop()} (eps=${simplifyEpsilon})`
  );

  return segments;
}
