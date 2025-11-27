export type GridSpan = { w: number; h: number };
export type GridCenter = { centerX: number; centerY: number };
export type GridTopLeft = { cellX: number; cellY: number };

export const worldToCellUnits = (worldX: number, worldY: number, gridOrigin: number, cellSize: number) => {
  const xCells = (worldX - gridOrigin) / cellSize;
  const yCells = (worldY - gridOrigin) / cellSize;
  return { xCells, yCells };
};

// Snap a raw cell coordinate based on span parity:
// - odd span: center on cell centers (n + 0.5)
// - even span: center on grid lines (n)
const snapCellCenter = (raw: number, spanCells: number) => {
  if (spanCells % 2 === 0) {
    return Math.round(raw);
  }
  return Math.round(raw - 0.5) + 0.5;
};

export const snapWorldToCenter = (
  worldX: number,
  worldY: number,
  span: GridSpan,
  gridOrigin: number,
  cellSize: number
): GridCenter => {
  const { xCells, yCells } = worldToCellUnits(worldX, worldY, gridOrigin, cellSize);
  return {
    centerX: snapCellCenter(xCells, span.w),
    centerY: snapCellCenter(yCells, span.h),
  };
};

export const centerAndSpanToTopLeft = (center: GridCenter, span: GridSpan): GridTopLeft => {
  return {
    cellX: center.centerX - span.w / 2,
    cellY: center.centerY - span.h / 2,
  };
};

export const topLeftAndSpanToCenter = (topLeft: GridTopLeft, span: GridSpan): GridCenter => {
  return {
    centerX: topLeft.cellX + span.w / 2,
    centerY: topLeft.cellY + span.h / 2,
  };
};
