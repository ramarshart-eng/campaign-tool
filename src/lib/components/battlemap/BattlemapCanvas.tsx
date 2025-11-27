import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getResolvedBattlemapIcon,
  getResolvedBattlemapToken,
  getBattlemapCursor,
  BattlemapTokenId,
} from "@/lib/battlemap/assets";
import {
  centerAndSpanToTopLeft,
  snapWorldToCenter,
  topLeftAndSpanToCenter,
} from "@/lib/battlemap/coords";
import {
  LayerId,
  LayerLeaf,
  LayerStack,
  flattenLayerTree,
  isDescendantOf,
  normalizeStackExtremes,
} from "@/lib/battlemap/layers";
import { isTileUnlit } from "@/lib/battlemap/tileEffects";
import {
  parseTilePathMetadata,
  getTileMetadata,
  hasTileEffect,
} from "@/lib/battlemap/tileMetadata";
import { renderRayTracedLighting } from "@/lib/battlemap/lighting/lightRenderer";

type Token = {
  id: string;
  label: string;
  assetId: BattlemapTokenId;
  cellX: number;
  cellY: number;
  width?: number; // in cells
  height?: number; // in cells
  ownerId?: string;
  locked?: boolean;
};

type Camera = {
  panX: number;
  panY: number;
  zoom: number;
};

const CELL_SIZE = 100; // px per cell
const GRID_EXTENT_CELLS = 400; // +/-200 cells
const GRID_EXTENT_PX = GRID_EXTENT_CELLS * CELL_SIZE;
const GRID_ORIGIN = -GRID_EXTENT_PX / 2;
const BACKGROUND_TILE_SRC = "/assets/battlemap/Background/HatchBG.png";
const SHADING_TILE_SRC = "/assets/battlemap/Shading/Shading.png";
const FALLBACK_TILE_BASE =
  "/assets/battlemap/Tilesets/Dungeon/Floor/Flagstones";
const FALLBACK_TILESET = [
  `${FALLBACK_TILE_BASE}/flagstone_1X1_1.png`,
  `${FALLBACK_TILE_BASE}/flagstone_1X1_2.png`,
  `${FALLBACK_TILE_BASE}/flagstone_1X1_3.png`,
  `${FALLBACK_TILE_BASE}/flagstone_1X1_4.png`,
  `${FALLBACK_TILE_BASE}/flagstone_1X1_5.png`,
  `${FALLBACK_TILE_BASE}/flagstone_1X1_6.png`,
  `${FALLBACK_TILE_BASE}/flagstone_1X1_7.png`,
  `${FALLBACK_TILE_BASE}/flagstone_1X1_8.png`,
  `${FALLBACK_TILE_BASE}/flagstone_1X1_9.png`,
  `${FALLBACK_TILE_BASE}/flagstone_1X1_D1.png`,
  `${FALLBACK_TILE_BASE}/flagstone_1X1_D2.png`,
  `${FALLBACK_TILE_BASE}/flagstone_1X1_D3.png`,
];
const RIGHT_ANGLE_ROTATIONS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
const FREE_ROTATION_STEP = Math.PI / 6; // 30°

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const dirFromDelta = (dx: number, dy: number): 0 | 1 | 2 | 3 => {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 0 : 2; // right / left
  }
  return dy >= 0 ? 1 : 3; // down / up
};

type TileLayer =
  | "background"
  | "floor"
  | "structure"
  | "lighting"
  | "props"
  | "decoration";
const legacyLayerKeys = [
  "background",
  "floor",
  "structure",
  "lighting",
  "props",
  "decoration",
] as const;
const GRID_CENTER_CELL = GRID_EXTENT_CELLS / 2; // cell index whose center is at world (0,0)

type BattlemapCanvasProps = {
  activeBrushTiles?: string[];
  activeBrush?: {
    resolvedCorners?: {
      tl?: { src: string; rotationIndex: number };
      tr?: { src: string; rotationIndex: number };
      bl?: { src: string; rotationIndex: number };
      br?: { src: string; rotationIndex: number };
    };
    resolvedBorders?: {
      top?: { src: string; rotationIndex: number; autoRotate?: boolean };
      bottom?: { src: string; rotationIndex: number; autoRotate?: boolean };
      left?: { src: string; rotationIndex: number; autoRotate?: boolean };
      right?: { src: string; rotationIndex: number; autoRotate?: boolean };
    };
    resolvedCornerPool?: {
      src: string;
      rotationIndex: number;
      autoRotate?: boolean;
    }[];
    resolvedBorderPool?: {
      src: string;
      rotationIndex: number;
      autoRotate?: boolean;
    }[];
    resolvedFillTiles?: string[];
    randomness?: { positionJitter?: number; sizeJitter?: number };
    endpointSuffixes?: string[];
    cornerSuffixes?: string[];
    excludeBorderTilesInFill?: boolean;
    edgeRandomMirrorX?: boolean;
    clearOverlapsLayers?: TileLayer[];
    tilesetId?: string;
    layer?: string;
    edgePoolFilter?: "bOnly" | "nonCorner" | "all";
    fillExclusionSuffixes?: string[];
    borderSuffixes?: string[];
    cornerClockwiseOffset?: number;
    cornerCounterClockwiseOffset?: number;
    decorationMode?: "none" | "adaptiveGrid";
    decorationInset?: number;
    decorationMinSpacing?: number;
    decorationMaxSpacing?: number;
  };
  selectedTile?: string | null;
  mapSeed: string;
  maps: Array<{ id: string; name: string; seed?: string }>;
  selectedMapId: string;
  onSelectMap: (id: string) => void;
  onCreateMap: () => void;
  onRenameMap: (id: string, name: string) => void;
  onToggleGrid?: () => void;
  onToggleTokensLayer?: () => void;
  onToggleFogLayer?: () => void;
  onDropToken?: () => void;
  snapDebug?: boolean;
  selectedLayerKey?: TileLayer | null;
  legacyLayerIds?: Partial<Record<TileLayer, string>>;
  layers?: LayerStack;
  soloLayerId?: LayerId | null;
  onLoadLayers?: (stack: LayerStack) => void;
  selectedLayerId?: string | null;
  selectTilesForLayerIds?: string[] | null;
  shadowOpacityByLayer?: Record<string, number | undefined>;
  shadeOpacityByLayer?: Record<string, number | undefined>;
  darknessOpacity?: number;
  lightColor?: string; // hex color for light tint
};

type Tileset = {
  id: string;
  name: string;
  tiles: string[];
};

type MapSize = { w: number; h: number };

const BattlemapCanvas: React.FC<BattlemapCanvasProps> = ({
  activeBrushTiles,
  activeBrush,
  selectedTile,
  mapSeed,
  maps,
  selectedMapId,
  onSelectMap,
  onCreateMap,
  onRenameMap,
  onToggleGrid,
  onToggleTokensLayer,
  onToggleFogLayer,
  snapDebug = false,
  selectedLayerKey = null,
  legacyLayerIds,
  layers,
  soloLayerId = null,
  onLoadLayers,
  selectedLayerId = null,
  selectTilesForLayerIds = null,
  shadowOpacityByLayer,
  shadeOpacityByLayer,
  darknessOpacity = 0,
  lightColor = "#e1be7a",
}) => {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const selectIcon = getResolvedBattlemapIcon("select");
  const panIcon = getResolvedBattlemapIcon("pan");
  const roomIcon = getResolvedBattlemapIcon("draw.rectangle");
  const areaIcon = getResolvedBattlemapIcon("draw.polygon");
  const gradientIcon = getResolvedBattlemapIcon("draw.gradient");
  const measureIcon = getResolvedBattlemapIcon("measure");
  const gridToggleIcon = getResolvedBattlemapIcon("grid.toggle");
  const fogIcon = getResolvedBattlemapIcon("fog.toggle");
  const eraseIcon = getResolvedBattlemapIcon("erase");
  const borderIcon = getResolvedBattlemapIcon("draw.border");
  const brushIcon = getResolvedBattlemapIcon("draw.brush");
  const brushCursor = getBattlemapCursor("draw");
  const selectCursor = getBattlemapCursor("select");
  const panCursor = getBattlemapCursor("pan");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [camera, setCamera] = useState<Camera>({ panX: 0, panY: 0, zoom: 1 });
  const [cameraReady, setCameraReady] = useState(false);
  const cameraInitializedRef = useRef(false);
  const [canvasSized, setCanvasSized] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [tilesets, setTilesets] = useState<Tileset[]>([
    { id: "fallback", name: "Flagstones", tiles: FALLBACK_TILESET },
  ]);
  const [activeTilesetId, setActiveTilesetId] = useState<string | null>(
    "fallback"
  );
  const [placedTiles, setPlacedTiles] = useState<
    Array<{
      id: string;
      cellX: number;
      cellY: number;
      centerX?: number;
      centerY?: number;
      src: string;
      rotationIndex: number;
      rotationRadians?: number;
      mirrorX?: boolean;
      scale?: number;
      strokeId?: string;
      layer: TileLayer;
      order: number;
      mirrorY?: boolean;
      layerId?: string | null;
    }>
  >([]);
  useEffect(() => {
    if (!legacyLayerIds) return;
    setPlacedTiles((prev) =>
      prev.map((t) =>
        typeof t.layerId !== "undefined"
          ? t
          : { ...t, layerId: legacyLayerIds[t.layer] ?? null }
      )
    );
  }, [legacyLayerIds]);
  const panState = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    forced: boolean;
  } | null>(null);
  const [spacePanning, setSpacePanning] = useState(false);
  const dragState = useRef<{
    tokenId?: string | null;
    tileIds?: string[];
    anchorId?: string;
    startPositions?: Map<
      string,
      {
        topLeft: { cellX: number; cellY: number };
        center: { centerX: number; centerY: number };
        footprint: { w: number; h: number };
      }
    >;
  } | null>(null);
  const skipPanRef = useRef(false);
  const tileStroke = useRef<{ active: boolean; visited: Set<string> }>({
    active: false,
    visited: new Set(),
  });

  const currentUserId = "dm-local"; // placeholder for user id; DM can move any token

  const [tokens, setTokens] = useState<Token[]>([
    {
      id: "pc-1",
      label: "PC",
      assetId: "base.pc",
      cellX: -1,
      cellY: -1,
      ownerId: "player-1",
    },
    {
      id: "pc-2",
      label: "PC",
      assetId: "base.pc",
      cellX: 0,
      cellY: -1,
      ownerId: "player-2",
    },
    {
      id: "npc-1",
      label: "NPC",
      assetId: "base.npc",
      cellX: -1,
      cellY: 0,
      ownerId: "dm-local",
    },
    {
      id: "monster-1",
      label: "Monster",
      assetId: "base.monster",
      cellX: 1,
      cellY: 1,
      width: 2,
      height: 2,
      ownerId: "dm-local",
    },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoveredTool, setHoveredTool] = useState<{
    label: string;
    index: number;
  } | null>(null);
  const [hoveredNavTool, setHoveredNavTool] = useState<{
    label: string;
    index: number;
  } | null>(null);
  const [selectedPlacedTileIds, setSelectedPlacedTileIds] = useState<
    Set<string>
  >(new Set());
  const [dragPreviewTile, setDragPreviewTile] = useState<{
    src: string;
    cellX: number;
    cellY: number;
    layer: TileLayer;
  } | null>(null);
  const selectedPlacedTile = useMemo(() => {
    const first = Array.from(selectedPlacedTileIds)[0];
    return placedTiles.find((t) => t.id === first) ?? null;
  }, [placedTiles, selectedPlacedTileIds]);
  const [selectionBox, setSelectionBox] = useState<{
    active: boolean;
    start?: { cellX: number; cellY: number };
    end?: { cellX: number; cellY: number };
    mode?: "replace" | "toggle";
  }>({ active: false });
  const [placementWarning, setPlacementWarning] = useState<string | null>(null);
  const [snapProbe, setSnapProbe] = useState<{
    centerX: number;
    centerY: number;
    w: number;
    h: number;
  } | null>(null);
  const historyRef = useRef<
    { placedTiles: typeof placedTiles; camera: Camera }[]
  >([]);
  const historyIndexRef = useRef<number>(-1);

  const cloneTiles = (tiles: typeof placedTiles) => {
    try {
      return structuredClone(tiles);
    } catch {
      return JSON.parse(JSON.stringify(tiles)) as typeof placedTiles;
    }
  };

  const placeLine = (
    start: { cellX: number; cellY: number },
    end: { cellX: number; cellY: number },
    strokeId?: string,
    recordHistory = false,
    appendToStroke = false,
    commit = true,
    placeStartEndpoint = true,
    placeEndEndpoint = true,
    incomingDir?: 0 | 1 | 2 | 3
  ) => {
    const cells = buildPolylineCells([start, end], false);
    return placeCells({
      cells,
      strokeId,
      recordHistory,
      appendToStroke,
      commit,
      placeStartEndpoint,
      placeEndEndpoint,
      incomingDir,
      skipClearOverlaps: false,
    });
  };

  const placePolyline = ({
    points,
    strokeId,
    recordHistory = false,
    appendToStroke = false,
    commit = true,
    closed = false,
  }: {
    points: { cellX: number; cellY: number }[];
    strokeId?: string;
    recordHistory?: boolean;
    appendToStroke?: boolean;
    commit?: boolean;
    closed?: boolean;
  }) => {
    const cells = buildPolylineCells(points, closed);
    if (cells.length === 0) return;
    const incomingForFirst =
      closed && cells.length >= 2
        ? dirFromDelta(
            cells[0].cellX - cells[cells.length - 2].cellX,
            cells[0].cellY - cells[cells.length - 2].cellY
          )
        : undefined;
    return placeCells({
      cells,
      strokeId,
      recordHistory,
      appendToStroke,
      commit,
      placeStartEndpoint: !closed,
      placeEndEndpoint: !closed,
      incomingDir: incomingForFirst,
      closed,
      skipClearOverlaps: closed, // closing a polygon can place many tiles; skip overlap clearing for speed
    });
  };

  const pushHistory = (nextTiles?: typeof placedTiles, nextCamera?: Camera) => {
    const snapshot = {
      placedTiles: cloneTiles(nextTiles ?? placedTiles),
      camera: { ...(nextCamera ?? camera) },
    };
    historyRef.current = [
      ...historyRef.current.slice(0, historyIndexRef.current + 1),
      snapshot,
    ];
    historyIndexRef.current = historyRef.current.length - 1;
  };

  const saveMapState = () => {
    if (!selectedMapId) return;
    console.log(
      `[SAVE] ${new Date().toISOString()} Saving map ${selectedMapId} with ${
        placedTiles.length
      } tiles`
    );
    pushHistory();
    const payload = {
      placedTiles,
      layers,
      fogCells: Array.from(fogVisibleCells).map((key) => {
        const [x, y] = key.split(",").map((v) => parseInt(v, 10));
        return { x, y };
      }),
      fogMode,
      mapSize,
    };
    try {
      const json = JSON.stringify(payload);
      localStorage.setItem(`battlemap:${selectedMapId}`, json);
      console.log(
        `[SAVE] ${new Date().toISOString()} Successfully saved ${
          payload.placedTiles.length
        } tiles (${json.length} bytes)`
      );
    } catch (err) {
      console.warn("Failed to save map", err);
    }
  };

  const saveMapStateRef = useRef(saveMapState);
  useEffect(() => {
    saveMapStateRef.current = saveMapState;
  }, [saveMapState]);

  // Autosave: debounce saves to avoid race conditions with other effects
  const autosaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!selectedMapId || placedTiles.length === 0) return;
    console.log(
      `[AUTOSAVE_EFFECT] ${new Date().toISOString()} Triggered, placedTiles.length = ${
        placedTiles.length
      }, scheduling save in 500ms`
    );

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    // Debounce with 500ms to let rapid changes batch together
    // and to prevent saving before state is fully settled
    autosaveTimerRef.current = window.setTimeout(() => {
      console.log(
        `[AUTOSAVE_EXECUTING] ${new Date().toISOString()} About to save, current placedTiles.length = ${
          placedTiles.length
        }`
      );
      saveMapState();
      autosaveTimerRef.current = null;
    }, 500);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
    // include only serializable dependencies to prevent excessive triggers
  }, [selectedMapId, placedTiles]);

  // Save map ID for persistence across reloads
  useEffect(() => {
    if (selectedMapId) {
      try {
        localStorage.setItem("battlemap:lastSelectedMapId", selectedMapId);
      } catch {}
    }
  }, [selectedMapId]);

  // Save on unload (beforeunload doesn't always fire on dev reloads; use unload as fallback)
  useEffect(() => {
    const beforeUnloadHandler = () => {
      try {
        saveMapStateRef.current();
      } catch {}
    };
    const unloadHandler = () => {
      try {
        saveMapStateRef.current();
      } catch {}
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
    window.addEventListener("unload", unloadHandler);
    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      window.removeEventListener("unload", unloadHandler);
    };
  }, []);

  const loadMapState = (mapId: string) => {
    try {
      const raw = localStorage.getItem(`battlemap:${mapId}`);
      console.log(
        `[LOAD] ${new Date().toISOString()} Loading map ${mapId}: raw data =`,
        raw ? `${raw.length} bytes` : "NOT FOUND"
      );
      if (!raw) {
        console.log(
          `[LOAD] ${new Date().toISOString()} Map ${mapId}: no save found, clearing state`
        );
        setPlacedTiles([]);
        historyRef.current = [{ placedTiles: [], camera }];
        historyIndexRef.current = 0;
        cameraInitializedRef.current = false;
        setCameraReady(false);
        setCamera({ panX: 0, panY: 0, zoom: 1 });
        return;
      }
      const parsed = JSON.parse(raw) as {
        placedTiles?: typeof placedTiles;
        camera?: Camera;
        layers?: LayerStack;
        fogRect?: {
          minX: number;
          maxX: number;
          minY: number;
          maxY: number;
        } | null;
        fogCells?: Array<{ x: number; y: number }>;
        fogMode?: "set" | "add" | "subtract";
        mapSize?: MapSize;
      };
      setPlacedTiles(parsed.placedTiles ?? []);
      if (parsed.fogCells && parsed.fogCells.length > 0) {
        setFogVisibleCells(
          new Set(parsed.fogCells.map((c) => `${c.x},${c.y}`))
        );
      } else if (parsed.fogRect) {
        const rect = parsed.fogRect;
        const cells = new Set<string>();
        for (let x = rect.minX; x <= rect.maxX; x++) {
          for (let y = rect.minY; y <= rect.maxY; y++) {
            cells.add(`${x},${y}`);
          }
        }
        setFogVisibleCells(cells);
      } else {
        setFogVisibleCells(new Set());
      }
      setFogMode(parsed.fogMode ?? "set");
      if (parsed.mapSize && parsed.mapSize.w > 0 && parsed.mapSize.h > 0) {
        setMapSize(parsed.mapSize);
      } else {
        setMapSize({ w: 10, h: 10 });
      }
      if (parsed.layers && parsed.layers.rootIds && parsed.layers.nodes) {
        // Normalize extremes so saved maps can’t violate constraints
        onLoadLayers?.(normalizeStackExtremes(parsed.layers));
      }
      cameraInitializedRef.current = false;
      setCameraReady(false);
      centerCameraOnOrigin(1);
      historyRef.current = [
        {
          placedTiles: cloneTiles(parsed.placedTiles ?? []),
          camera: { panX: camera.panX, panY: camera.panY, zoom: 1 },
        },
      ];
      historyIndexRef.current = 0;
    } catch (err) {
      console.warn("Failed to load map", err);
    }
  };

  const imageCache = useMemo(() => new Map<string, HTMLImageElement>(), []);
  const tintedCache = useMemo(() => new Map<string, HTMLCanvasElement>(), []);
  const pixelCache = useMemo(() => new Map<string, HTMLCanvasElement>(), []);
  const missingImageFallback = useMemo(() => {
    // Avoid touching DOM APIs during SSR.
    if (typeof Image === "undefined") return null;
    const img = new Image();
    // 1x1 transparent PNG
    img.src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAFgwJ/lknhNQAAAABJRU5ErkJggg==";
    return img;
  }, []);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const shadingImageRef = useRef<HTMLImageElement | null>(null);
  const layerMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shadowBlurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shadowFalloffMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outlineMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shadingTexCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shadingTiledCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const solidShadowCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const falloffShadowCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerMaskCacheRef = useRef<
    Map<string, { gen: number; width: number; height: number }>
  >(new Map());
  const tintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shadeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const darknessCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bgReady, setBgReady] = useState(false);
  const renderGeneration = useRef(0);
  const renderQueuedRef = useRef(false);
  const forceRender = () => {
    if (!canvasSized) return;
    renderQueuedRef.current = false;
    const gen = ++renderGeneration.current;
    render(gen);
  };
  const [resizeTick, setResizeTick] = useState(0);
  const [activeTool, setActiveTool] = useState<
    | "select"
    | "pan"
    | "measure"
    | "room"
    | "border"
    | "area"
    | "polygon"
    | "gradient"
    | "fog"
    | "tile"
    | "erase"
  >("select");
  const [measure, setMeasure] = useState<{
    points: { cellX: number; cellY: number }[];
    floating: { cellX: number; cellY: number } | null;
    active: boolean;
  }>({
    points: [],
    floating: null,
    active: false,
  });
  const [fogVisibleCells, setFogVisibleCells] = useState<Set<string>>(
    () => new Set()
  );
  const [fogMode, setFogMode] = useState<"set" | "add" | "subtract">("set");
  const [mapSize, setMapSize] = useState<MapSize>({ w: 10, h: 10 });
  const [mapSettingsOpen, setMapSettingsOpen] = useState(false);
  const [hoveredTopbarControl, setHoveredTopbarControl] = useState<{
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const [placementWarningActive, setPlacementWarningActive] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  useEffect(() => {
    if (!placementWarning) {
      setPlacementWarningActive(false);
      return;
    }
    setPlacementWarningActive(true);
    const fadeTimeout = window.setTimeout(() => {
      setPlacementWarningActive(false);
    }, 1500);
    const clearTimeoutId = window.setTimeout(() => {
      setPlacementWarning(null);
    }, 2000);
    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(clearTimeoutId);
    };
  }, [placementWarning]);

  // External request to select all tiles within one or more layers.
  useEffect(() => {
    if (!selectTilesForLayerIds || selectTilesForLayerIds.length === 0) return;
    const layerIdSet = new Set(selectTilesForLayerIds);
    const nextSelection = new Set(
      placedTiles
        .filter((t) => {
          if (t.layerId && layerIdSet.has(t.layerId)) return true;
          // Fallback for legacy tiles without explicit layerId: match on legacy layer key if it happens to equal a layer id.
          if (!t.layerId && layerIdSet.has(t.layer as unknown as string))
            return true;
          return false;
        })
        .map((t) => t.id)
    );
    setSelectedPlacedTileIds(nextSelection);
  }, [selectTilesForLayerIds, placedTiles]);

  const centerCameraOnOrigin = (zoom = 1) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setCamera({ panX: 0, panY: 0, zoom });
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    // Center on world (0,0), which lies at the center of GRID_CENTER_CELL.
    const worldX = GRID_ORIGIN + GRID_CENTER_CELL * CELL_SIZE;
    const worldY = GRID_ORIGIN + GRID_CENTER_CELL * CELL_SIZE;
    setCamera({ panX: cx - worldX * zoom, panY: cy - worldY * zoom, zoom });
  };

  const getDefaultTileSpan = (): { w: number; h: number } => {
    if (selectedTile) return getTileSizeCells(selectedTile);
    if (activeBrushTiles && activeBrushTiles.length > 0)
      return getTileSizeCells(activeBrushTiles[0]);
    const activeTileset = tilesets.find((t) => t.id === activeTilesetId);
    const fallback = (activeTileset?.tiles ?? FALLBACK_TILESET)[0];
    return fallback ? getTileSizeCells(fallback) : { w: 1, h: 1 };
  };

  const worldToScreen = (worldX: number, worldY: number) => ({
    x: worldX * camera.zoom + camera.panX,
    y: worldY * camera.zoom + camera.panY,
  });
  const snapToCellCenter = (v: number) => Math.round(v - 0.5) + 0.5;

  const getTileFootprint = (tile: (typeof placedTiles)[number]) => {
    const baseSpan = getTileSpanFromName(tile.src);
    const footprint =
      tile.rotationIndex % 2 === 0
        ? { w: baseSpan.w, h: baseSpan.h }
        : { w: baseSpan.h, h: baseSpan.w };
    const center =
      typeof tile.centerX === "number" && typeof tile.centerY === "number"
        ? { centerX: tile.centerX, centerY: tile.centerY }
        : topLeftAndSpanToCenter(
            { cellX: tile.cellX, cellY: tile.cellY },
            footprint
          );
    const topLeft = centerAndSpanToTopLeft(center, footprint);
    return { footprint, center, topLeft };
  };

  const computeGroupPivot = (tiles: typeof placedTiles) => {
    if (tiles.length <= 1) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    tiles.forEach((t) => {
      const fp = getTileFootprint(t);
      const left = fp.center.centerX - fp.footprint.w / 2;
      const top = fp.center.centerY - fp.footprint.h / 2;
      const right = fp.center.centerX + fp.footprint.w / 2;
      const bottom = fp.center.centerY + fp.footprint.h / 2;
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    });
    const rawCenter = {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
    return {
      centerX: snapToCellCenter(rawCenter.centerX),
      centerY: snapToCellCenter(rawCenter.centerY),
    };
  };

  const snapTilesToGrid = (ids: Set<string>) => {
    if (!snapEnabled || ids.size === 0) return;
    setPlacedTiles((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (!ids.has(t.id)) return t;
        const fp = getTileFootprint(t);
        const worldX = GRID_ORIGIN + fp.center.centerX * CELL_SIZE;
        const worldY = GRID_ORIGIN + fp.center.centerY * CELL_SIZE;
        const snappedCenter = snapWorldToCenter(
          worldX,
          worldY,
          fp.footprint,
          GRID_ORIGIN,
          CELL_SIZE
        );
        const snappedTopLeft = centerAndSpanToTopLeft(
          snappedCenter,
          fp.footprint
        );
        if (
          snappedTopLeft.cellX === fp.topLeft.cellX &&
          snappedTopLeft.cellY === fp.topLeft.cellY &&
          snappedCenter.centerX === fp.center.centerX &&
          snappedCenter.centerY === fp.center.centerY
        ) {
          return t;
        }
        changed = true;
        return {
          ...t,
          cellX: snappedTopLeft.cellX,
          cellY: snappedTopLeft.cellY,
          centerX: snappedCenter.centerX,
          centerY: snappedCenter.centerY,
        };
      });
      if (changed) {
        pushHistory(next);
      }
      return next;
    });
  };

  const isTileVisible = (tile: (typeof placedTiles)[number]) =>
    legacyVisibility[tile.layer] ?? true;

  const updateSnapProbe = ({
    worldX,
    worldY,
    hitTile,
    hitToken,
    draggingTileId,
    draggingTokenId,
  }: {
    worldX: number;
    worldY: number;
    hitTile?: (typeof placedTiles)[number] | null;
    hitToken?: Token | null;
    draggingTileId?: string | null;
    draggingTokenId?: string | null;
  }) => {
    if (!snapDebug || !snapEnabled) {
      if (snapProbe) setSnapProbe(null);
      return;
    }
    let probeSpan = getDefaultTileSpan();
    if (draggingTileId) {
      const dragTile = placedTiles.find((t) => t.id === draggingTileId);
      if (dragTile) {
        const span = getTileSpanFromName(dragTile.src);
        probeSpan =
          dragTile.rotationIndex % 2 === 0
            ? { w: span.w, h: span.h }
            : { w: span.h, h: span.w };
      }
    } else if (draggingTokenId) {
      const tok = tokens.find((t) => t.id === draggingTokenId);
      if (tok) probeSpan = { w: tok.width ?? 1, h: tok.height ?? 1 };
    } else if (activeTool === "tile") {
      probeSpan = getDefaultTileSpan();
    } else if (activeTool === "select" && hitTile) {
      const span = getTileSpanFromName(hitTile.src);
      probeSpan =
        hitTile.rotationIndex % 2 === 0
          ? { w: span.w, h: span.h }
          : { w: span.h, h: span.w };
    } else if (activeTool === "select" && hitToken) {
      probeSpan = { w: hitToken.width ?? 1, h: hitToken.height ?? 1 };
    } else if (activeTool === "measure") {
      probeSpan = { w: 1, h: 1 };
    }
    const center = snapEnabled
      ? snapWorldToCenter(worldX, worldY, probeSpan, GRID_ORIGIN, CELL_SIZE)
      : {
          centerX: (worldX - GRID_ORIGIN) / CELL_SIZE,
          centerY: (worldY - GRID_ORIGIN) / CELL_SIZE,
        };
    setSnapProbe({
      centerX: center.centerX,
      centerY: center.centerY,
      w: probeSpan.w,
      h: probeSpan.h,
    });
  };
  const [roomDrag, setRoomDrag] = useState<{
    active: boolean;
    start?: { cellX: number; cellY: number };
    end?: { cellX: number; cellY: number };
    strokeId?: string;
    mode?: "fill" | "border";
  }>({ active: false });
  const [polygonPath, setPolygonPath] = useState<{
    active: boolean;
    points: { cellX: number; cellY: number }[];
    strokeId?: string;
  }>({ active: false, points: [] });
  const [polygonHover, setPolygonHover] = useState<{
    cellX: number;
    cellY: number;
  } | null>(null);
  const lastMouseCellRef = useRef<{ cellX: number; cellY: number } | null>(
    null
  );
  const [lineDrag, setLineDrag] = useState<{
    active: boolean;
    start?: { cellX: number; cellY: number };
    end?: { cellX: number; cellY: number };
    strokeId?: string;
  }>({ active: false });
  const [eraseDrag, setEraseDrag] = useState<{
    active: boolean;
    start?: { cellX: number; cellY: number };
    end?: { cellX: number; cellY: number };
  }>({ active: false });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    open: boolean;
  }>({
    x: 0,
    y: 0,
    open: false,
  });
  const selectionPivotRef = useRef<{
    key: string;
    pivot: { centerX: number; centerY: number };
  } | null>(null);

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve) => {
      const cached = imageCache.get(src);
      if (cached && cached.complete) {
        resolve(cached);
        return;
      }
      const img = new Image();
      img.onload = () => {
        imageCache.set(src, img);
        resolve(img);
      };
      img.onerror = () => {
        // Avoid blocking the render loop when an asset is missing; draw a transparent placeholder instead.
        console.warn(
          `battlemap: failed to load image ${src}, using transparent placeholder`
        );
        const fallback =
          missingImageFallback ??
          // Safety for environments where Image isn't available (SSR).
          ({
            width: 1,
            height: 1,
            complete: true,
          } as unknown as HTMLImageElement);
        imageCache.set(src, fallback);
        resolve(fallback);
      };
      img.src = src;
      imageCache.set(src, img);
    });

  const ensureOffscreenCanvas = (
    ref: React.MutableRefObject<HTMLCanvasElement | null>,
    width: number,
    height: number
  ) => {
    let canvas = ref.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      ref.current = canvas;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return canvas;
  };

  const getPixelCanvas = (src: string): HTMLCanvasElement | null => {
    const existing = pixelCache.get(src);
    if (existing) return existing;
    const img = imageCache.get(src);
    if (!img || img.width === 0 || img.height === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, img.width || 0);
    canvas.height = Math.max(1, img.height || 0);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    pixelCache.set(src, canvas);
    return canvas;
  };

  const hitTestTileAlpha = (
    cx: number,
    cy: number,
    tile: (typeof placedTiles)[number]
  ): boolean => {
    const img = imageCache.get(tile.src);
    if (!img || img.width === 0 || img.height === 0) return false;
    const pxCanvas = getPixelCanvas(tile.src);
    const pxCtx = pxCanvas?.getContext("2d");
    if (!pxCanvas || !pxCtx) return false;

    const baseSpan = getTileSizeCells(tile.src);
    const footprint =
      tile.rotationIndex % 2 === 0
        ? { w: baseSpan.w, h: baseSpan.h }
        : { w: baseSpan.h, h: baseSpan.w };

    const center =
      typeof tile.centerX === "number" && typeof tile.centerY === "number"
        ? { centerX: tile.centerX, centerY: tile.centerY }
        : topLeftAndSpanToCenter(
            { cellX: tile.cellX, cellY: tile.cellY },
            footprint
          );

    const worldCenterX = GRID_ORIGIN + center.centerX * CELL_SIZE;
    const worldCenterY = GRID_ORIGIN + center.centerY * CELL_SIZE;
    const screenCenterX = worldCenterX * camera.zoom + camera.panX;
    const screenCenterY = worldCenterY * camera.zoom + camera.panY;

    // Transform point into tile local space (the same transform used during draw, inverted)
    const dx = cx - screenCenterX;
    const dy = cy - screenCenterY;
    const angle = getTileRotationRadians(tile);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const scaleX = tile.mirrorX ? -1 : 1;
    const scaleY = tile.mirrorY ? -1 : 1;
    const drawScale = (tile.scale ?? 1) * camera.zoom;
    const lx = rx / (drawScale * scaleX);
    const ly = ry / (drawScale * scaleY);

    const drawWidth = Math.max(1, img.width || 0);
    const drawHeight = Math.max(1, img.height || 0);

    // Map local coords where image is drawn centered at (0,0) to pixel space
    const px = Math.round(lx + drawWidth / 2);
    const py = Math.round(ly + drawHeight / 2);
    if (px < 0 || py < 0 || px >= drawWidth || py >= drawHeight) return false;
    const data = pxCtx.getImageData(px, py, 1, 1).data;
    return (data[3] ?? 0) > 10; // threshold alpha > ~4%
  };

  const getShadingImage = async () => {
    if (shadingImageRef.current && shadingImageRef.current.complete) {
      return shadingImageRef.current;
    }
    const img = await loadImage(SHADING_TILE_SRC);
    shadingImageRef.current = img;
    return img;
  };

  const ensureTiledShadingCanvas = async (
    width: number,
    height: number
  ): Promise<HTMLCanvasElement | null> => {
    const shadingImg = await getShadingImage();
    if (!shadingImg) return null;
    const tiled = ensureOffscreenCanvas(shadingTiledCanvasRef, width, height);
    const tctx = tiled.getContext("2d");
    if (!tctx) return null;
    // Rebuild only when size changes
    if (tiled.width !== width || tiled.height !== height) {
      // dimensions already set by ensureOffscreenCanvas
    }
    tctx.clearRect(0, 0, width, height);
    tctx.save();
    tctx.translate(camera.panX, camera.panY);
    tctx.scale(camera.zoom, camera.zoom);
    tctx.translate(GRID_ORIGIN, GRID_ORIGIN);
    const tileW = shadingImg.width || 1;
    const tileH = shadingImg.height || 1;
    const viewLeft = -camera.panX / camera.zoom - GRID_ORIGIN;
    const viewTop = -camera.panY / camera.zoom - GRID_ORIGIN;
    const viewRight = viewLeft + width / camera.zoom;
    const viewBottom = viewTop + height / camera.zoom;
    const startX = Math.floor(viewLeft / tileW) - 1;
    const endX = Math.ceil(viewRight / tileW) + 1;
    const startY = Math.floor(viewTop / tileH) - 1;
    const endY = Math.ceil(viewBottom / tileH) + 1;
    for (let tx = startX; tx <= endX; tx++) {
      for (let ty = startY; ty <= endY; ty++) {
        const x = tx * tileW;
        const y = ty * tileH;
        tctx.drawImage(shadingImg, x, y, tileW, tileH);
      }
    }
    tctx.restore();
    return tiled;
  };

  const useToScreen =
    (camera: Camera) => (token: Token, sizePxOverride?: number) => {
      const wCells = token.width ?? 1;
      const hCells = token.height ?? 1;
      const centerX = GRID_ORIGIN + (token.cellX + wCells / 2) * CELL_SIZE;
      const centerY = GRID_ORIGIN + (token.cellY + hCells / 2) * CELL_SIZE;
      const sizePx = sizePxOverride ?? CELL_SIZE * Math.max(wCells, hCells);
      const x =
        centerX * camera.zoom + camera.panX - (sizePx * camera.zoom) / 2;
      const y =
        centerY * camera.zoom + camera.panY - (sizePx * camera.zoom) / 2;
      const size = sizePx * camera.zoom;
      return { x, y, size };
    };

  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    if (!gridVisibleEffective) return;
    ctx.save();
    ctx.translate(camera.panX, camera.panY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(GRID_ORIGIN, GRID_ORIGIN);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1 / camera.zoom; // crisp lines

    const viewLeft = -camera.panX / camera.zoom - GRID_ORIGIN;
    const viewTop = -camera.panY / camera.zoom - GRID_ORIGIN;
    const viewRight = viewLeft + width / camera.zoom;
    const viewBottom = viewTop + height / camera.zoom;

    const startCol = Math.floor(viewLeft / CELL_SIZE) - 1;
    const endCol = Math.ceil(viewRight / CELL_SIZE) + 1;
    const startRow = Math.floor(viewTop / CELL_SIZE) - 1;
    const endRow = Math.ceil(viewBottom / CELL_SIZE) + 1;

    ctx.beginPath();
    for (let col = startCol; col <= endCol; col++) {
      const x = col * CELL_SIZE;
      ctx.moveTo(x, startRow * CELL_SIZE);
      ctx.lineTo(x, endRow * CELL_SIZE);
    }
    for (let row = startRow; row <= endRow; row++) {
      const y = row * CELL_SIZE;
      ctx.moveTo(startCol * CELL_SIZE, y);
      ctx.lineTo(endCol * CELL_SIZE, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  const seededRand = (seed: string, x: number, y: number) => {
    const base = hash(`${seed}:${x}:${y}`);
    return (salt: number) => {
      const h = hash(base + salt);
      return (h >>> 0) / 0xffffffff;
    };
  };

  const hash = (input: string | number) => {
    let h = typeof input === "number" ? input : 1779033703 ^ input.length;
    const str = typeof input === "number" ? `${input}` : input;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };

  const getTileLayer = (
    src?: string,
    activeBrush?: { layer?: string; tilesetId?: string },
    tilesetId?: string | null
  ): TileLayer => {
    const explicit = (activeBrush?.layer ?? "").toLowerCase() as TileLayer;
    if (
      explicit &&
      [
        "background",
        "floor",
        "structure",
        "lighting",
        "props",
        "decoration",
      ].includes(explicit)
    ) {
      return explicit;
    }
    const brushTileset = activeBrush?.tilesetId?.toLowerCase() ?? "";
    const tileset = tilesetId?.toLowerCase() ?? "";
    const srcLower = src?.toLowerCase() ?? "";
    const name = srcLower.split("/").pop() ?? "";

    const isLighting =
      [brushTileset, tileset, srcLower, name].some(
        (v) => v.includes("lighting") || v.includes("light")
      ) &&
      ![brushTileset, tileset, srcLower, name].some(
        (v) => v.includes("shading") || v.includes("shade")
      );
    if (isLighting) return "lighting";

    const isFloor = [brushTileset, tileset, srcLower, name].some(
      (v) => v.includes("floor") || v.includes("/floor/")
    );
    if (isFloor) return "floor";

    const isDoor = [brushTileset, tileset, srcLower, name].some((v) =>
      v.includes("door")
    );
    const isPillar = [brushTileset, tileset, srcLower, name].some((v) =>
      v.includes("pillar")
    );
    const isWall = [brushTileset, tileset, srcLower, name].some(
      (v) => v.includes("walls") || v.includes("/walls/") || v.includes("wall_")
    );
    if (isDoor || isWall || isPillar) return "structure";

    const isStairs = [brushTileset, tileset, srcLower, name].some((v) =>
      v.includes("stair")
    );
    const isRocks = [brushTileset, tileset, srcLower, name].some((v) =>
      v.includes("rock")
    );
    const isRailing = [brushTileset, tileset, srcLower, name].some((v) =>
      v.includes("railing")
    );
    const isDecoration = [brushTileset, tileset, srcLower, name].some((v) =>
      v.includes("decor")
    );

    if (isStairs || isRocks || isRailing || isDecoration) return "decoration";

    if ([brushTileset, tileset, srcLower, name].some((v) => v.includes("prop")))
      return "props";
    if (
      [brushTileset, tileset, srcLower, name].some((v) =>
        v.includes("background")
      )
    )
      return "background";
    return "floor";
  };

  // Tile size / hitbox is derived solely from the `_WxH` suffix
  // in the filename; native pixel dimensions never influence span.
  const getTileSizeCells = (src: string) => {
    const name = src.split("/").pop() ?? "";
    const match = name.match(/_(\d+)x(\d+)/i);
    if (match) {
      const w = parseInt(match[1], 10);
      const h = parseInt(match[2], 10);
      if (w > 0 && h > 0) return { w, h };
    }
    return { w: 1, h: 1 };
  };

  const shouldMirrorTileOnDrop = (src: string) => {
    const { w, h } = getTileSizeCells(src);
    if (w === h) return false;
    return Math.random() < 0.5;
  };

  const getTileSpanFromName = (src?: string) => {
    const name = src?.split("/").pop() ?? "";
    const match = name.match(/_(\d+)x(\d+)/i);
    if (match) {
      const w = parseInt(match[1], 10);
      const h = parseInt(match[2], 10);
      if (w > 0 && h > 0) return { w, h };
    }
    return { w: 1, h: 1 };
  };

  type TileFootprintBounds = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };

  const boundsOverlap = (a: TileFootprintBounds, b: TileFootprintBounds) =>
    !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);

  const getTileBounds = (tile: {
    src: string;
    rotationIndex: number;
    cellX: number;
    cellY: number;
    centerX?: number;
    centerY?: number;
    rotationRadians?: number;
  }) => {
    const baseSpan = getTileSpanFromName(tile.src);
    const footprint =
      tile.rotationIndex % 2 === 0
        ? { w: baseSpan.w, h: baseSpan.h }
        : { w: baseSpan.h, h: baseSpan.w };
    const center =
      typeof tile.centerX === "number" && typeof tile.centerY === "number"
        ? { centerX: tile.centerX, centerY: tile.centerY }
        : topLeftAndSpanToCenter(
            { cellX: tile.cellX, cellY: tile.cellY },
            footprint
          );
    const topLeft = centerAndSpanToTopLeft(center, footprint);
    // Snap to integer cell coverage to avoid tiny offsets (e.g., jitter) causing missed overlaps.
    const minX = Math.round(topLeft.cellX + 1e-6);
    const minY = Math.round(topLeft.cellY + 1e-6);
    return {
      minX,
      maxX: minX + footprint.w - 1,
      minY,
      maxY: minY + footprint.h - 1,
    };
  };

  const isLayerLocked = (layerId?: string | null, legacyKey?: TileLayer) => {
    if (!layers) return false;
    const id =
      layerId ?? (legacyKey ? legacyLayerIds?.[legacyKey] ?? null : null);
    if (!id) return false;
    const node = layers.nodes[id];
    if (node && node.type === "layer") {
      return !!node.locked;
    }
    return false;
  };

  const isTileLocked = (tile: { layerId?: string | null; layer: TileLayer }) =>
    isLayerLocked(tile.layerId, tile.layer);

  const removeOverlappingTiles = (
    tiles: typeof placedTiles,
    incoming: Array<{
      src: string;
      rotationIndex: number;
      cellX: number;
      cellY: number;
      centerX?: number;
      centerY?: number;
      layer: TileLayer;
    }>,
    layers: TileLayer[]
  ) => {
    let result = tiles;
    for (const tile of incoming) {
      if (!layers.includes(tile.layer)) continue;
      const incomingBounds = getTileBounds(tile);
      result = result.filter((existing) => {
        if (isTileLocked(existing)) return true;
        if (!layers.includes(existing.layer)) return true;
        const existingBounds = getTileBounds(existing);
        return !boundsOverlap(existingBounds, incomingBounds);
      });
    }
    return result;
  };

  const resolveLayerId = (layer: TileLayer | undefined | null) => {
    if (!layer) return null;
    return legacyLayerIds?.[layer] ?? null;
  };

  const resolveLegacyKeyForLayerId = (
    layerId: string | null | undefined
  ): TileLayer | null => {
    if (!layerId || !legacyLayerIds) return null;
    const entries = Object.entries(legacyLayerIds) as [TileLayer, string][];
    const match = entries.find(([, id]) => id === layerId);
    return match ? match[0] : null;
  };

  // Resolve which logical layer and concrete stack layer id to use when placing tiles.
  // Prefers the currently selected stack leaf when it is a real layer; otherwise picks
  // the first visible art layer from the stack, falling back to legacy mappings.
  const resolvePlacementLayerForSrc = (
    src?: string,
    options?: { ignoreBrush?: boolean }
  ) => {
    // Only the currently selected layer controls placement; do not auto-assign based on filename.
    const selectedNode = selectedLayerId
      ? layers?.nodes[selectedLayerId]
      : undefined;

    if (
      selectedNode &&
      selectedNode.type === "layer" &&
      selectedNode.role !== "grid" &&
      selectedNode.role !== "tokens" &&
      selectedNode.role !== "fog"
    ) {
      // Prefer a legacy key that maps to this concrete layer id, if any.
      const legacyKey = resolveLegacyKeyForLayerId(selectedNode.id) ?? null;
      const layer: TileLayer =
        legacyKey && (legacyLayerKeys as readonly string[]).includes(legacyKey)
          ? legacyKey
          : selectedLayerKey &&
            (legacyLayerKeys as readonly string[]).includes(selectedLayerKey)
          ? selectedLayerKey
          : "floor";
      return { layer, targetLayerId: selectedNode.id };
    }

    // If the asset is a light, force placement on the lighting layer when available.
    const srcLower = src?.toLowerCase() ?? "";
    const name = srcLower.split("/").pop() ?? "";

    // Check filename for lighting indicators
    const isLightingByName =
      [srcLower, name].some(
        (v) => v.includes("lighting") || v.includes("light")
      ) &&
      ![srcLower, name].some(
        (v) => v.includes("shading") || v.includes("shade")
      );

    // Check tile metadata for light_source effect
    let isLightingByMetadata = false;
    if (src) {
      const pathMeta = parseTilePathMetadata(src);
      if (pathMeta) {
        const metadata = getTileMetadata(
          pathMeta.category,
          pathMeta.subcategory
        );
        isLightingByMetadata = hasTileEffect(metadata, "light_source");
      }
    }

    const isLighting = isLightingByName || isLightingByMetadata;

    if (isLighting && layers) {
      const list = flattenLayerTree(layers, true, true)
        .map((e) => e.node)
        .filter((n): n is LayerLeaf => n.type === "layer");
      const lightingLeaf = list.find((leaf) => leaf.role === "lighting");
      if (lightingLeaf) {
        return { layer: "lighting" as const, targetLayerId: lightingLeaf.id };
      }
    }
    // No valid placement layer (e.g., no selection or a non-art layer is selected).
    return null;
  };

  // Decide which layer to use for a given tile, optionally ignoring brush metadata when we're placing a single tile.
  const orderedLayers = useMemo<LayerLeaf[] | null>(() => {
    if (!layers) return null;
    // Preserve natural `rootIds` order: Background → … → Lighting
    return flattenLayerTree(layers, true, true)
      .map((e) => e.node)
      .filter((n): n is LayerLeaf => n.type === "layer");
  }, [layers]);

  const isLeafVisible = (leaf: LayerLeaf) => {
    if (!leaf.visible) return false;
    if (!soloLayerId || !layers) return true;
    if (leaf.id === soloLayerId) return true;
    const soloNode = layers.nodes[soloLayerId];
    if (soloNode?.type === "group") {
      return isDescendantOf(layers, leaf.id, soloNode.id);
    }
    return false;
  };

  const visibleForRole = (role: LayerLeaf["role"]) => {
    if (!orderedLayers) return undefined;
    return orderedLayers.some(
      (leaf) => leaf.role === role && isLeafVisible(leaf)
    );
  };

  const legacyVisibility = useMemo<Record<TileLayer, boolean>>(() => {
    if (!orderedLayers) {
      return {
        background: true,
        floor: true,
        structure: true,
        lighting: true,
        props: true,
        decoration: true,
      };
    }
    const map: Partial<Record<TileLayer, boolean>> = {};
    orderedLayers.forEach((leaf) => {
      const asKey = leaf.id as TileLayer;
      if ((legacyLayerKeys as readonly string[]).includes(asKey)) {
        map[asKey] = isLeafVisible(leaf);
      }
      if (leaf.role === "background") {
        map.background = isLeafVisible(leaf);
      }
    });
    return {
      background: map.background ?? true,
      floor: map.floor ?? true,
      structure: map.structure ?? true,
      lighting: map.lighting ?? true,
      props: map.props ?? true,
      decoration: map.decoration ?? true,
    };
  }, [orderedLayers, soloLayerId, layers]);

  const gridVisibleEffective = orderedLayers ? !!visibleForRole("grid") : true;
  const tokensVisibleEffective = orderedLayers
    ? !!visibleForRole("tokens")
    : true;
  const fogVisibleEffective = orderedLayers ? !!visibleForRole("fog") : true;
  const backgroundVisibleEffective = legacyVisibility.background;

  const resolveTileLayer = (src?: string, opts?: { ignoreBrush?: boolean }) => {
    // Legacy entry point: when no modern layer stack is used, fall back to the explicitly selected legacy key.
    if (
      selectedLayerKey &&
      (legacyLayerKeys as readonly string[]).includes(selectedLayerKey)
    ) {
      return selectedLayerKey;
    }
    // Otherwise, avoid any filename-based heuristics; layer will be derived from the currently selected stack layer.
    return getTileLayer(
      src,
      opts?.ignoreBrush ? undefined : activeBrush,
      activeTilesetId
    );
  };

  const toScreen = useToScreen(camera);
  const getRenderSizePx = (token: Token) => {
    const isOneByOne = (token.width ?? 1) === 1 && (token.height ?? 1) === 1;
    if (isOneByOne) return CELL_SIZE * 1.5; // ~150px reference on 100px cell => 1.5x cell
    return CELL_SIZE * Math.max(token.width ?? 1, token.height ?? 1);
  };

  const drawTokens = async (
    ctx: CanvasRenderingContext2D,
    generation: number,
    width: number,
    height: number
  ) => {
    if (!tokensVisibleEffective) return;
    const viewLeft = -camera.panX / camera.zoom;
    const viewTop = -camera.panY / camera.zoom;
    const viewRight = viewLeft + width / camera.zoom;
    const viewBottom = viewTop + height / camera.zoom;

    // Preload unique token images once per render.
    const uniqueTokenSrcs = Array.from(
      new Set(
        tokens.map((token) => {
          const asset = getResolvedBattlemapToken(token.assetId);
          const isOneByOne =
            (token.width ?? 1) === 1 && (token.height ?? 1) === 1;
          return isOneByOne
            ? "/assets/battlemap/Tokens/Token_1X1_1.png"
            : asset.src;
        })
      )
    );
    await Promise.all(uniqueTokenSrcs.map((src) => loadImage(src)));

    for (const token of tokens) {
      if (generation !== renderGeneration.current) return; // drop stale frames
      const asset = getResolvedBattlemapToken(token.assetId);
      const isOneByOne = (token.width ?? 1) === 1 && (token.height ?? 1) === 1;
      const src = isOneByOne
        ? "/assets/battlemap/Tokens/Token_1X1_1.png"
        : asset.src;
      const renderSizePx = getRenderSizePx(token);
      const img = imageCache.get(src);
      if (generation !== renderGeneration.current) return; // in case a newer render started while loading
      if (!img || img.width === 0 || img.height === 0) continue;
      const wCells = token.width ?? 1;
      const hCells = token.height ?? 1;
      const worldCenterX = GRID_ORIGIN + (token.cellX + wCells / 2) * CELL_SIZE;
      const worldCenterY = GRID_ORIGIN + (token.cellY + hCells / 2) * CELL_SIZE;
      const worldHalfSize = renderSizePx / 2;
      const worldLeft = worldCenterX - worldHalfSize;
      const worldRight = worldCenterX + worldHalfSize;
      const worldTop = worldCenterY - worldHalfSize;
      const worldBottom = worldCenterY + worldHalfSize;
      if (
        worldRight < viewLeft ||
        worldLeft > viewRight ||
        worldBottom < viewTop ||
        worldTop > viewBottom
      ) {
        continue;
      }
      const { x, y, size } = toScreen(token, renderSizePx);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(
        x + size / 2,
        y + size / 2,
        size / 2,
        size / 2,
        0,
        0,
        Math.PI * 2
      );
      ctx.clip();
      ctx.drawImage(img, x, y, size, size);
      if (selectedId === token.id) {
        ctx.strokeStyle = "rgba(78,141,245,0.6)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const drawMeasure = (ctx: CanvasRenderingContext2D) => {
    const pathPoints = [...measure.points];
    if (measure.floating) {
      pathPoints.push(measure.floating);
    }
    if (pathPoints.length < 2) return;
    ctx.save();
    ctx.strokeStyle = "rgba(78,141,245,0.8)";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(78,141,245,0.8)";
    ctx.beginPath();
    const screenPoints = pathPoints.map((p) => {
      const wx = GRID_ORIGIN + (p.cellX + 0.5) * CELL_SIZE;
      const wy = GRID_ORIGIN + (p.cellY + 0.5) * CELL_SIZE;
      return {
        x: wx * camera.zoom + camera.panX,
        y: wy * camera.zoom + camera.panY,
      };
    });
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let i = 1; i < screenPoints.length; i++) {
      ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    ctx.stroke();
    screenPoints.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // distance
    let distCells = 0;
    for (let i = 1; i < pathPoints.length; i++) {
      const dx = Math.abs(pathPoints[i].cellX - pathPoints[i - 1].cellX);
      const dy = Math.abs(pathPoints[i].cellY - pathPoints[i - 1].cellY);
      distCells += Math.max(dx, dy); // diagonal counts as one step
    }
    const distFeet = distCells * 5;
    const label = `${distFeet.toFixed(1)} ft`;
    const last = screenPoints[screenPoints.length - 1];
    const padding = 4;
    ctx.font = "12px sans-serif";
    const textWidth = ctx.measureText(label).width;
    const boxW = textWidth + padding * 2;
    const boxH = 18;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(last.x - boxW / 2, last.y - boxH / 2, boxW, boxH);
    ctx.strokeStyle = "rgba(78,141,245,0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(last.x - boxW / 2, last.y - boxH / 2, boxW, boxH);
    ctx.fillStyle = "#1f3b7a";
    ctx.fillText(label, last.x - textWidth / 2, last.y + 4);
    ctx.restore();
  };
  const getNextOrder = (layer: TileLayer, layerId?: string | null) => {
    const max = placedTiles
      .filter((t) => (layerId ? t.layerId === layerId : t.layer === layer))
      .reduce((m, t) => Math.max(m, t.order ?? 0), 0);
    return max + 1;
  };

  const getTileRotationRadians = (tile: {
    rotationIndex: number;
    rotationRadians?: number;
  }) => {
    if (typeof tile.rotationRadians === "number") return tile.rotationRadians;
    return RIGHT_ANGLE_ROTATIONS[tile.rotationIndex] ?? 0;
  };

  const drawLayerEffectsFromAlpha = async (
    ctx: CanvasRenderingContext2D,
    generation: number,
    width: number,
    height: number,
    tiles: typeof placedTiles,
    leaf: LayerLeaf,
    mode: "shadow" | "outline" | "both" = "both"
  ) => {
    if ((!leaf.hasOutline && !leaf.hasShadow) || tiles.length === 0) return;
    if (width <= 0 || height <= 0) return;
    // Build or reuse the alpha mask for this layer at current generation and size
    const maskCanvas = ensureOffscreenCanvas(layerMaskCanvasRef, width, height);
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;
    // Always rebuild mask to reflect live changes (tiles, settings, camera)
    maskCtx.clearRect(0, 0, width, height);
    const prevSmoothing = maskCtx.imageSmoothingEnabled;
    maskCtx.imageSmoothingEnabled = false;
    for (const tile of tiles) {
      if (generation !== renderGeneration.current) return;
      const img = imageCache.get(tile.src);
      if (!img || img.width === 0 || img.height === 0) continue;
      const baseSpan = getTileSizeCells(tile.src);
      const footprint =
        tile.rotationIndex % 2 === 0
          ? { w: baseSpan.w, h: baseSpan.h }
          : { w: baseSpan.h, h: baseSpan.w };
      const worldCenterX =
        GRID_ORIGIN +
        ((typeof tile.centerX === "number"
          ? tile.centerX
          : tile.cellX + footprint.w / 2) as number) *
          CELL_SIZE;
      const worldCenterY =
        GRID_ORIGIN +
        ((typeof tile.centerY === "number"
          ? tile.centerY
          : tile.cellY + footprint.h / 2) as number) *
          CELL_SIZE;
      const { x: screenCenterX, y: screenCenterY } = worldToScreen(
        worldCenterX,
        worldCenterY
      );
      const renderWidth =
        Math.max(1, img.width || 0) * camera.zoom * (tile.scale ?? 1);
      const renderHeight =
        Math.max(1, img.height || 0) * camera.zoom * (tile.scale ?? 1);
      maskCtx.save();
      maskCtx.translate(screenCenterX, screenCenterY);
      const radians = getTileRotationRadians(tile);
      if (radians) maskCtx.rotate(radians);
      if (tile.mirrorX || tile.mirrorY) {
        maskCtx.scale(tile.mirrorX ? -1 : 1, tile.mirrorY ? -1 : 1);
      }
      maskCtx.drawImage(
        img,
        -renderWidth / 2,
        -renderHeight / 2,
        renderWidth,
        renderHeight
      );
      maskCtx.restore();
    }
    maskCtx.imageSmoothingEnabled = prevSmoothing;

    // Shading: discrete distance bands with linear falloff from alpha edge
    if (leaf.hasShadow && (mode === "shadow" || mode === "both")) {
      const distanceTiles = Math.max(
        0,
        Math.min(leaf.shadowDistance ?? 0.3, 1)
      );
      const maxDistancePx = Math.max(
        1,
        Math.round(distanceTiles * CELL_SIZE * camera.zoom)
      );
      const shadowOpacity = shadowOpacityByLayer?.[leaf.id] ?? 0.8;

      const blurredCanvas = ensureOffscreenCanvas(
        shadowBlurCanvasRef,
        width,
        height
      );
      const bctx = blurredCanvas.getContext("2d");
      if (!bctx) return;
      bctx.clearRect(0, 0, width, height);
      bctx.filter = `blur(${Math.max(1, maxDistancePx)}px)`;
      bctx.drawImage(maskCanvas, 0, 0);
      bctx.filter = "none";

      // Pre-tiled shading texture
      const shadingTiled = await ensureTiledShadingCanvas(width, height);
      if (!shadingTiled) return;

      // Solid region: pure black multiply clipped to tile mask, guarantees alpha=1 at source
      const solidShadow = ensureOffscreenCanvas(
        solidShadowCanvasRef,
        width,
        height
      );
      const solidShadowCtx = solidShadow.getContext("2d");
      if (!solidShadowCtx) return;
      solidShadowCtx.clearRect(0, 0, width, height);
      solidShadowCtx.fillStyle = "#000";
      solidShadowCtx.fillRect(0, 0, width, height);
      solidShadowCtx.globalCompositeOperation = "destination-in";
      solidShadowCtx.drawImage(maskCanvas, 0, 0);
      solidShadowCtx.globalCompositeOperation = "source-over";

      ctx.save();
      ctx.globalAlpha = shadowOpacity;
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(solidShadow, 0, 0);
      ctx.restore();

      if (distanceTiles > 0) {
        // Build falloff mask by subtracting the solid region from the blurred mask
        const falloffMask = ensureOffscreenCanvas(
          shadowFalloffMaskCanvasRef,
          width,
          height
        );
        const falloffCtx = falloffMask.getContext("2d");
        if (!falloffCtx) return;
        falloffCtx.clearRect(0, 0, width, height);
        falloffCtx.drawImage(blurredCanvas, 0, 0);
        falloffCtx.globalCompositeOperation = "destination-out";
        falloffCtx.drawImage(maskCanvas, 0, 0);
        falloffCtx.globalCompositeOperation = "source-over";

        const falloffShadow = ensureOffscreenCanvas(
          falloffShadowCanvasRef,
          width,
          height
        );
        const falloffShadowCtx = falloffShadow.getContext("2d");
        if (!falloffShadowCtx) return;
        falloffShadowCtx.clearRect(0, 0, width, height);
        falloffShadowCtx.fillStyle = "#000";
        falloffShadowCtx.fillRect(0, 0, width, height);
        const falloffTexture = ensureOffscreenCanvas(
          shadingTexCanvasRef,
          width,
          height
        );
        const falloffTextureCtx = falloffTexture.getContext("2d");
        if (!falloffTextureCtx) return;
        falloffTextureCtx.clearRect(0, 0, width, height);
        falloffTextureCtx.drawImage(shadingTiled, 0, 0);
        falloffTextureCtx.globalCompositeOperation = "destination-in";
        falloffTextureCtx.drawImage(falloffMask, 0, 0);
        falloffTextureCtx.globalCompositeOperation = "source-over";

        falloffShadowCtx.globalCompositeOperation = "destination-in";
        // Apply the textured alpha to the pure black fill so only opacity is affected.
        falloffShadowCtx.drawImage(falloffTexture, 0, 0);
        falloffShadowCtx.globalCompositeOperation = "source-over";

        // Multiply in falloff shadow (still pure black, but alpha shaped by texture)
        ctx.save();
        ctx.globalAlpha = shadowOpacity;
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(falloffShadow, 0, 0);
        ctx.restore();
      }
    }

    // Outline: hard stroke around the alpha silhouette with configurable thickness.
    if (leaf.hasOutline && (mode === "outline" || mode === "both")) {
      const thicknessRaw = leaf.outlineWidth ?? 3;
      const radius = Math.max(1, Math.min(Math.floor(thicknessRaw), 32));
      const outlineCanvas = ensureOffscreenCanvas(
        outlineMaskCanvasRef,
        width,
        height
      );
      const octx = outlineCanvas.getContext("2d");
      if (!octx) return;
      octx.clearRect(0, 0, width, height);
      // Binary ring by shifted copies only at perimeter for crisp stroke
      octx.save();
      octx.globalCompositeOperation = "source-over";
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius || dist < radius - 1) continue; // thin ring ~1px thickness
          octx.drawImage(maskCanvas, dx, dy);
        }
      }
      octx.restore();
      // Remove original fill, leaving only the ring
      octx.globalCompositeOperation = "destination-out";
      octx.drawImage(maskCanvas, 0, 0);
      octx.globalCompositeOperation = "source-in";
      octx.fillStyle = "black";
      octx.fillRect(0, 0, width, height);
      octx.globalCompositeOperation = "source-over";

      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(outlineCanvas, 0, 0);
      ctx.restore();
    }
  };

  const drawPlacedTiles = async (
    ctx: CanvasRenderingContext2D,
    generation: number,
    width: number,
    height: number
  ) => {
    const visibility: Record<TileLayer, boolean> = legacyVisibility;
    const useStackOrdering = !!orderedLayers;
    const legacySorted = [...placedTiles].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );

    const layerSequence: Array<{
      tiles: typeof placedTiles;
      leaf?: LayerLeaf;
    }> = [];
    if (useStackOrdering && orderedLayers) {
      orderedLayers.forEach((leaf) => {
        if (!isLeafVisible(leaf)) return;
        if (
          leaf.role === "grid" ||
          leaf.role === "tokens" ||
          leaf.role === "fog"
        )
          return;
        const tilesForLeaf = placedTiles.filter((t) => {
          if (t.layerId && t.layerId === leaf.id) return true;
          const asKey = leaf.id as TileLayer;
          if (
            (legacyLayerKeys as readonly string[]).includes(asKey) &&
            t.layer === asKey
          )
            return true;
          if (leaf.role === "background" && t.layer === "background")
            return true;
          return false;
        });
        if (tilesForLeaf.length > 0) {
          const sortedByOrder = [...tilesForLeaf].sort(
            (a, b) => (a.order ?? 0) - (b.order ?? 0)
          );
          layerSequence.push({ tiles: sortedByOrder, leaf });
        }
      });
    } else {
      layerSequence.push({ tiles: legacySorted });
    }

    // Visible world bounds for culling.
    const viewLeft = -camera.panX / camera.zoom;
    const viewTop = -camera.panY / camera.zoom;
    const viewRight = viewLeft + width / camera.zoom;
    const viewBottom = viewTop + height / camera.zoom;

    // Preload unique images once per render generation to avoid per-tile awaits.
    const uniqueSrcs = Array.from(new Set(placedTiles.map((t) => t.src)));
    await Promise.all(uniqueSrcs.map((src) => loadImage(src)));

    for (const group of layerSequence) {
      if (group.leaf && group.leaf.hasShadow) {
        await drawLayerEffectsFromAlpha(
          ctx,
          generation,
          width,
          height,
          group.tiles,
          group.leaf,
          "shadow"
        );
        if (generation !== renderGeneration.current) {
          return;
        }
      }

      for (const tile of group.tiles) {
        if (!visibility[tile.layer]) continue;
        if (generation !== renderGeneration.current) {
          return;
        }
        const img = imageCache.get(tile.src);
        if (generation !== renderGeneration.current) {
          return;
        }
        if (!img || img.width === 0 || img.height === 0) {
          continue;
        }
        const baseSpan = getTileSizeCells(tile.src);
        const footprint =
          tile.rotationIndex % 2 === 0
            ? { w: baseSpan.w, h: baseSpan.h }
            : { w: baseSpan.h, h: baseSpan.w };
        // NOTE: placement intentionally uses the PNG's native dimensions; keep this behavior to preserve artist-authored sizing.
        const renderWidth = Math.max(1, img.width || 0);
        const renderHeight = Math.max(1, img.height || 0);
        const scale = tile.scale ?? 1;

        // Center the native-size image on the grid footprint center derived from (rotated) span.
        const worldCenterX =
          GRID_ORIGIN +
          ((typeof tile.centerX === "number"
            ? tile.centerX
            : tile.cellX + footprint.w / 2) as number) *
            CELL_SIZE;
        const worldCenterY =
          GRID_ORIGIN +
          ((typeof tile.centerY === "number"
            ? tile.centerY
            : tile.cellY + footprint.h / 2) as number) *
            CELL_SIZE;

        const halfW = (footprint.w * CELL_SIZE) / 2;
        const halfH = (footprint.h * CELL_SIZE) / 2;
        const worldLeft = worldCenterX - halfW;
        const worldRight = worldCenterX + halfW;
        const worldTop = worldCenterY - halfH;
        const worldBottom = worldCenterY + halfH;
        if (
          worldRight < viewLeft ||
          worldLeft > viewRight ||
          worldBottom < viewTop ||
          worldTop > viewBottom
        ) {
          continue;
        }

        const { x: screenCenterX, y: screenCenterY } = worldToScreen(
          worldCenterX,
          worldCenterY
        );

        const drawWidth = renderWidth * camera.zoom * scale;
        const drawHeight = renderHeight * camera.zoom * scale;

        ctx.save();
        ctx.translate(screenCenterX, screenCenterY);
        ctx.rotate(getTileRotationRadians(tile));
        const scaleX = tile.mirrorX ? -1 : 1;
        const scaleY = tile.mirrorY ? -1 : 1;
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(
          img,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );
        ctx.restore();

        if (selectedPlacedTileIds.has(tile.id)) {
          const { w: spanXCells, h: spanYCells } = getTileSizeCells(tile.src);
          ctx.save();
          ctx.strokeStyle = "rgba(78,141,245,0.8)";
          ctx.lineWidth = 3;
          const isRightAngle = tile.rotationIndex % 2 !== 0;
          const baseSpan = { w: spanXCells, h: spanYCells };
          const fp = isRightAngle ? { w: baseSpan.h, h: baseSpan.w } : baseSpan;
          const center =
            typeof tile.centerX === "number" && typeof tile.centerY === "number"
              ? { centerX: tile.centerX, centerY: tile.centerY }
              : topLeftAndSpanToCenter(
                  { cellX: tile.cellX, cellY: tile.cellY },
                  fp
                );
          const worldCx = GRID_ORIGIN + center.centerX * CELL_SIZE;
          const worldCy = GRID_ORIGIN + center.centerY * CELL_SIZE;
          const worldLeft = worldCx - (fp.w * CELL_SIZE) / 2;
          const worldTop = worldCy - (fp.h * CELL_SIZE) / 2;
          const { x: screenLeft, y: screenTop } = worldToScreen(
            worldLeft,
            worldTop
          );
          const boxWidth = fp.w * CELL_SIZE * camera.zoom;
          const boxHeight = fp.h * CELL_SIZE * camera.zoom;
          ctx.strokeRect(screenLeft, screenTop, boxWidth, boxHeight);
          ctx.restore();
        }
      }

      if (group.leaf && group.leaf.hasOutline) {
        await drawLayerEffectsFromAlpha(
          ctx,
          generation,
          width,
          height,
          group.tiles,
          group.leaf,
          "outline"
        );
        if (generation !== renderGeneration.current) {
          return;
        }
      }

      // Apply tint and shade effects masked to layer alpha
      if (group.leaf && group.tiles.length > 0) {
        const hasTint = group.leaf.tint && group.leaf.tint.alpha > 0;
        const shadeOpacity = shadeOpacityByLayer?.[group.leaf.id ?? ""] ?? 0;
        const hasShade = shadeOpacity > 0;

        if (hasTint || hasShade) {
          // Create alpha mask from tiles
          const maskCanvas = ensureOffscreenCanvas(
            layerMaskCanvasRef,
            width,
            height
          );
          const maskCtx = maskCanvas.getContext("2d");
          if (maskCtx) {
            maskCtx.clearRect(0, 0, width, height);

            // Draw all tiles to create alpha mask
            for (const tile of group.tiles) {
              if (generation !== renderGeneration.current) return;
              const img = imageCache.get(tile.src);
              if (!img || img.width === 0 || img.height === 0) continue;

              const baseSpan = getTileSizeCells(tile.src);
              const footprint =
                tile.rotationIndex % 2 === 0
                  ? { w: baseSpan.w, h: baseSpan.h }
                  : { w: baseSpan.h, h: baseSpan.w };

              const worldCenterX =
                GRID_ORIGIN +
                ((typeof tile.centerX === "number"
                  ? tile.centerX
                  : tile.cellX + footprint.w / 2) as number) *
                  CELL_SIZE;
              const worldCenterY =
                GRID_ORIGIN +
                ((typeof tile.centerY === "number"
                  ? tile.centerY
                  : tile.cellY + footprint.h / 2) as number) *
                  CELL_SIZE;

              const { x: screenCenterX, y: screenCenterY } = worldToScreen(
                worldCenterX,
                worldCenterY
              );

              const renderWidth =
                Math.max(1, img.width || 0) * camera.zoom * (tile.scale ?? 1);
              const renderHeight =
                Math.max(1, img.height || 0) * camera.zoom * (tile.scale ?? 1);

              maskCtx.save();
              maskCtx.translate(screenCenterX, screenCenterY);
              const radians = getTileRotationRadians(tile);
              if (radians) maskCtx.rotate(radians);
              if (tile.mirrorX || tile.mirrorY) {
                maskCtx.scale(tile.mirrorX ? -1 : 1, tile.mirrorY ? -1 : 1);
              }
              maskCtx.drawImage(
                img,
                -renderWidth / 2,
                -renderHeight / 2,
                renderWidth,
                renderHeight
              );
              maskCtx.restore();
            }

            // Apply tint (multiply blend with color, masked to alpha)
            if (hasTint) {
              const tintAlpha = group.leaf.tint!.alpha;
              const tintColor = group.leaf.tint!.color;

              const tintCanvas = ensureOffscreenCanvas(
                tintCanvasRef,
                width,
                height
              );
              const tintCtx = tintCanvas.getContext("2d");
              if (tintCtx) {
                tintCtx.clearRect(0, 0, width, height);
                tintCtx.fillStyle = tintColor;
                tintCtx.fillRect(0, 0, width, height);
                tintCtx.globalCompositeOperation = "destination-in";
                tintCtx.drawImage(maskCanvas, 0, 0);
                tintCtx.globalCompositeOperation = "source-over";

                ctx.save();
                ctx.globalAlpha = tintAlpha;
                ctx.globalCompositeOperation = "multiply";
                ctx.drawImage(tintCanvas, 0, 0);
                ctx.restore();
              }
            }

            // Apply shade (shading texture, masked to alpha)
            if (hasShade) {
              const shadingImg = await getShadingImage();
              if (generation !== renderGeneration.current) return;

              if (shadingImg && shadingImg.complete && shadingImg.width > 0) {
                const shadeCanvas = ensureOffscreenCanvas(
                  shadeCanvasRef,
                  width,
                  height
                );
                const shadeCtx = shadeCanvas.getContext("2d");
                if (shadeCtx) {
                  shadeCtx.clearRect(0, 0, width, height);

                  // Tile the shading texture in world space, aligned to grid
                  const tileW = shadingImg.width || 1;
                  const tileH = shadingImg.height || 1;
                  const viewLeft = -camera.panX / camera.zoom - GRID_ORIGIN;
                  const viewTop = -camera.panY / camera.zoom - GRID_ORIGIN;
                  const viewRight = viewLeft + width / camera.zoom;
                  const viewBottom = viewTop + height / camera.zoom;
                  const startX = Math.floor(viewLeft / tileW) - 1;
                  const endX = Math.ceil(viewRight / tileW) + 1;
                  const startY = Math.floor(viewTop / tileH) - 1;
                  const endY = Math.ceil(viewBottom / tileH) + 1;

                  shadeCtx.save();
                  shadeCtx.translate(camera.panX, camera.panY);
                  shadeCtx.scale(camera.zoom, camera.zoom);
                  shadeCtx.translate(GRID_ORIGIN, GRID_ORIGIN);
                  for (let tx = startX; tx <= endX; tx++) {
                    for (let ty = startY; ty <= endY; ty++) {
                      const x = tx * tileW;
                      const y = ty * tileH;
                      shadeCtx.drawImage(shadingImg, x, y, tileW, tileH);
                    }
                  }
                  shadeCtx.restore();

                  // Mask to layer alpha
                  shadeCtx.globalCompositeOperation = "destination-in";
                  shadeCtx.drawImage(maskCanvas, 0, 0);
                  shadeCtx.globalCompositeOperation = "source-over";

                  ctx.save();
                  ctx.globalAlpha = shadeOpacity;
                  ctx.globalCompositeOperation = "multiply";
                  ctx.drawImage(shadeCanvas, 0, 0);
                  ctx.restore();
                }
              }
            }
          }
        }
      }
    }

    // drag preview
    if (dragPreviewTile && visibility[dragPreviewTile.layer]) {
      const img =
        imageCache.get(dragPreviewTile.src) ??
        (await loadImage(dragPreviewTile.src));
      if (generation !== renderGeneration.current) {
        return;
      }
      if (!img || img.width === 0 || img.height === 0) {
        return;
      }
      const baseSpan = getTileSizeCells(dragPreviewTile.src);
      const footprint = { w: baseSpan.w, h: baseSpan.h };
      const renderWidth = Math.max(1, img.width || 0);
      const renderHeight = Math.max(1, img.height || 0);

      const worldCenterX =
        GRID_ORIGIN + (dragPreviewTile.cellX + footprint.w / 2) * CELL_SIZE;
      const worldCenterY =
        GRID_ORIGIN + (dragPreviewTile.cellY + footprint.h / 2) * CELL_SIZE;
      const { x: screenCenterX, y: screenCenterY } = worldToScreen(
        worldCenterX,
        worldCenterY
      );

      const drawWidth = renderWidth * camera.zoom;
      const drawHeight = renderHeight * camera.zoom;

      ctx.save();
      ctx.translate(screenCenterX, screenCenterY);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(
        img,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
      ctx.restore();
    }
  };

  const drawLighting = async (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    console.log("[drawLighting] Called with:", {
      darknessOpacity,
      hasLayers: !!layers,
    });
    if (!layers) {
      console.log("[drawLighting] Skipping - no layers");
      return;
    }

    // Get the lighting layer to check visibility
    const lightingLayerNode = layers.nodes["lighting"];
    const isLightingVisible =
      lightingLayerNode?.type === "layer" ? lightingLayerNode.visible : true;

    // Skip rendering if lighting layer is hidden or no darkness
    if (darknessOpacity <= 0 || !isLightingVisible) {
      console.log("[drawLighting] Skipping - darkness off or lighting hidden");
      return;
    }

    const lightRadius = 4; // Fixed radius of 4 tiles
    const lightIntensity =
      (lightingLayerNode?.type === "layer"
        ? lightingLayerNode.lightIntensity
        : undefined) ?? 1;

    // Find lighting tiles - check both layerId and legacy layer property
    const lightingTiles = placedTiles.filter((t) => {
      // Check if tile is on the lighting layer (by id or legacy layer name)
      return t.layerId === "lighting" || t.layer === "lighting";
    });

    // Load the shading texture
    const shadingImg = await getShadingImage();

    // Use the new ray-traced lighting system
    await renderRayTracedLighting(
      ctx,
      width,
      height,
      placedTiles,
      lightingTiles,
      imageCache,
      CELL_SIZE,
      GRID_ORIGIN,
      worldToScreen,
      {
        darknessOpacity,
        lightRadius,
        lightIntensity,
        lightColor: lightColor ?? "#e1be7a",
        occluderResolution: 4,
        rayCount: 360,
        applyColorTint: false,
      },
      shadingImg,
      camera
    );
  };

  const drawFog = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    // If fog is hidden or there are no fog constraints, skip rendering.
    if (!fogVisibleEffective || fogVisibleCells.size === 0) return;
    // Determine which cells are in view.
    const viewLeft = -camera.panX / camera.zoom - GRID_ORIGIN;
    const viewTop = -camera.panY / camera.zoom - GRID_ORIGIN;
    const viewRight = viewLeft + width / camera.zoom;
    const viewBottom = viewTop + height / camera.zoom;
    const startCellX = Math.floor(viewLeft / CELL_SIZE) - 1;
    const endCellX = Math.ceil(viewRight / CELL_SIZE) + 1;
    const startCellY = Math.floor(viewTop / CELL_SIZE) - 1;
    const endCellY = Math.ceil(viewBottom / CELL_SIZE) + 1;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    for (let x = startCellX; x <= endCellX; x++) {
      for (let y = startCellY; y <= endCellY; y++) {
        const key = `${x},${y}`;
        // If this cell is marked visible, skip drawing fog here.
        if (fogVisibleCells.has(key)) continue;
        const worldLeftCell = GRID_ORIGIN + x * CELL_SIZE;
        const worldTopCell = GRID_ORIGIN + y * CELL_SIZE;
        const screenLeft = worldLeftCell * camera.zoom + camera.panX;
        const screenTop = worldTopCell * camera.zoom + camera.panY;
        const screenRight =
          (worldLeftCell + CELL_SIZE) * camera.zoom + camera.panX;
        const screenBottom =
          (worldTopCell + CELL_SIZE) * camera.zoom + camera.panY;
        const w = screenRight - screenLeft;
        const h = screenBottom - screenTop;
        if (w <= 0 || h <= 0) continue;
        // Expand slightly to cover seams between cells.
        ctx.fillRect(screenLeft - 0.5, screenTop - 0.5, w + 1, h + 1);
      }
    }
    ctx.restore();
  };

  // Place a tile using pointer world coordinates; snapping is center-based and parity-aware.
  const placeTileAt = (worldX: number, worldY: number) => {
    const activeTileset = tilesets.find((t) => t.id === activeTilesetId);
    const tiles =
      (selectedTile ? [selectedTile] : undefined) ??
      (activeBrushTiles && activeBrushTiles.length > 0
        ? activeBrushTiles
        : activeTileset?.tiles ?? FALLBACK_TILESET);
    if (!tiles || tiles.length === 0) return;
    const seedKey = selectedTile
      ? `tile:${selectedTile}`
      : activeBrushTiles && activeBrushTiles.length > 0
      ? `brush:${activeBrushTiles.join(",")}`
      : activeTileset?.id ?? "fallback";
    const rand = seededRand(
      `${mapSeed}:${seedKey}`,
      Math.round(worldX),
      Math.round(worldY)
    );
    const src = tiles[Math.floor(rand(0) * tiles.length)];
    const span = getTileSizeCells(src);
    const rotationIndex = Math.floor(rand(1) * RIGHT_ANGLE_ROTATIONS.length);
    const rotatedSpan =
      rotationIndex % 2 === 0 ? span : { w: span.h, h: span.w };
    const center = snapEnabled
      ? snapWorldToCenter(worldX, worldY, rotatedSpan, GRID_ORIGIN, CELL_SIZE)
      : {
          centerX: (worldX - GRID_ORIGIN) / CELL_SIZE,
          centerY: (worldY - GRID_ORIGIN) / CELL_SIZE,
        };
    const { cellX, cellY } = centerAndSpanToTopLeft(center, rotatedSpan);
    const placement = resolvePlacementLayerForSrc(src);
    if (!placement) {
      setPlacementWarning("Select a layer before painting.");
      return;
    }
    setPlacementWarning(null);
    const { layer, targetLayerId } = placement;
    if (isLayerLocked(targetLayerId, layer)) return;
    const order = getNextOrder(layer, targetLayerId);
    const newTile = {
      id: `${cellX},${cellY}:${Date.now()}`,
      cellX,
      cellY,
      centerX: center.centerX,
      centerY: center.centerY,
      src,
      rotationIndex,
      layer,
      order,
      layerId: targetLayerId,
    };
    console.log(
      `[PLACE_TILE] Placing tile at (${cellX},${cellY}), current placedTiles.length =`,
      placedTiles.length
    );
    setPlacedTiles((prev) => {
      const clearLayers = activeBrush?.clearOverlapsLayers ?? ["floor"];
      const withoutOverlap =
        clearLayers.length > 0
          ? removeOverlappingTiles(prev, [newTile], clearLayers)
          : prev;
      console.log(
        `[PLACE_TILE] After placement, new placedTiles.length will be =`,
        withoutOverlap.length + 1
      );
      return [...withoutOverlap, newTile];
    });
  };

  const clearMeasure = () =>
    setMeasure({ points: [], floating: null, active: false });
  const closeContextMenu = () => setContextMenu({ open: false, x: 0, y: 0 });

  const loadTilesets = async () => {
    try {
      const res = await fetch("/api/battlemap/tilesets");
      if (!res.ok) throw new Error("failed to fetch tilesets");
      const data = (await res.json()) as { tilesets: Tileset[] };
      if (data.tilesets.length > 0) {
        setTilesets(data.tilesets);
        setActiveTilesetId((prev) => {
          if (prev && prev !== "fallback") return prev;
          return data.tilesets[0].id;
        });
      } else {
        setTilesets([
          { id: "fallback", name: "Flagstones", tiles: FALLBACK_TILESET },
        ]);
        setActiveTilesetId("fallback");
      }
    } catch (e) {
      console.error("tileset load error", e);
      setTilesets([
        { id: "fallback", name: "Flagstones", tiles: FALLBACK_TILESET },
      ]);
      setActiveTilesetId("fallback");
    }
  };

  const render = async (generation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssWidth =
      rect.width || canvas.clientWidth || canvas.width / dpr || 0;
    const cssHeight =
      rect.height || canvas.clientHeight || canvas.height / dpr || 0;
    const targetWidth = Math.max(1, Math.floor(cssWidth * dpr));
    const targetHeight = Math.max(1, Math.floor(cssHeight * dpr));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    // Compute screen-space map bounds (if any) for clipping.
    const mapBoundsToScreen = () => {
      if (mapSize.w <= 0 || mapSize.h <= 0) return null;
      const halfW = mapSize.w / 2;
      const halfH = mapSize.h / 2;
      const minCellX = Math.floor(GRID_CENTER_CELL - halfW);
      const maxCellX = minCellX + mapSize.w;
      const minCellY = Math.floor(GRID_CENTER_CELL - halfH);
      const maxCellY = minCellY + mapSize.h;
      const worldLeft = GRID_ORIGIN + minCellX * CELL_SIZE;
      const worldTop = GRID_ORIGIN + minCellY * CELL_SIZE;
      const worldRight = GRID_ORIGIN + maxCellX * CELL_SIZE;
      const worldBottom = GRID_ORIGIN + maxCellY * CELL_SIZE;
      const left = worldLeft * camera.zoom + camera.panX;
      const top = worldTop * camera.zoom + camera.panY;
      const right = worldRight * camera.zoom + camera.panX;
      const bottom = worldBottom * camera.zoom + camera.panY;
      const w = right - left;
      const h = bottom - top;
      if (w <= 0 || h <= 0) return null;
      return { left, top, w, h };
    };
    const clipRect = mapBoundsToScreen();

    // Clip everything (background + world content) to map bounds, if defined.
    if (clipRect) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipRect.left, clipRect.top, clipRect.w, clipRect.h);
      ctx.clip();
    }

    // Always fill the map area with a solid background color (background color layer).
    {
      const viewLeft = -camera.panX / camera.zoom - GRID_ORIGIN;
      const viewTop = -camera.panY / camera.zoom - GRID_ORIGIN;
      const viewRight = viewLeft + cssWidth / camera.zoom;
      const viewBottom = viewTop + cssHeight / camera.zoom;
      ctx.save();
      ctx.translate(camera.panX, camera.panY);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(GRID_ORIGIN, GRID_ORIGIN);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(
        viewLeft,
        viewTop,
        viewRight - viewLeft,
        viewBottom - viewTop
      );
      ctx.restore();
    }

    if (!bgImageRef.current) {
      const bg = await loadImage(BACKGROUND_TILE_SRC);
      if (generation !== renderGeneration.current) return;
      bgImageRef.current = bg;
      setBgReady(true);
    }
    if (bgImageRef.current && backgroundVisibleEffective) {
      if (generation !== renderGeneration.current) return;
      ctx.save();
      ctx.translate(camera.panX, camera.panY);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(GRID_ORIGIN, GRID_ORIGIN);
      const tileW = bgImageRef.current.width;
      const tileH = bgImageRef.current.height;
      const viewLeft = -camera.panX / camera.zoom - GRID_ORIGIN;
      const viewTop = -camera.panY / camera.zoom - GRID_ORIGIN;
      const viewRight = viewLeft + cssWidth / camera.zoom;
      const viewBottom = viewTop + cssHeight / camera.zoom;
      const startX = Math.floor(viewLeft / tileW) - 1;
      const endX = Math.ceil(viewRight / tileW) + 1;
      const startY = Math.floor(viewTop / tileH) - 1;
      const endY = Math.ceil(viewBottom / tileH) + 1;
      for (let tx = startX; tx <= endX; tx++) {
        for (let ty = startY; ty <= endY; ty++) {
          const x = tx * tileW;
          const y = ty * tileH;
          ctx.drawImage(bgImageRef.current, x, y, tileW, tileH);
        }
      }
      // Background tint removed; tiles render without additional tint.
      ctx.restore();
    }

    await drawPlacedTiles(ctx, generation, cssWidth, cssHeight);
    if (gridVisibleEffective) {
      drawGrid(ctx, cssWidth, cssHeight);
    }
    if (lineDrag.active && lineDrag.start && lineDrag.end) {
      ctx.save();
      ctx.translate(camera.panX, camera.panY);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(GRID_ORIGIN, GRID_ORIGIN);
      const cells = getLineCells(lineDrag.start, lineDrag.end);
      ctx.strokeStyle = "rgba(78,141,245,0.9)";
      ctx.setLineDash([CELL_SIZE / 2, CELL_SIZE / 2]);
      ctx.lineWidth = 2 / camera.zoom;
      ctx.beginPath();
      cells.forEach((cell, idx) => {
        const cx = (cell.cellX + 0.5) * CELL_SIZE;
        const cy = (cell.cellY + 0.5) * CELL_SIZE;
        if (idx === 0) {
          ctx.moveTo(cx, cy);
        } else {
          ctx.lineTo(cx, cy);
        }
      });
      ctx.stroke();
      ctx.restore();
    }
    if (polygonPath.active && polygonPath.points.length > 0) {
      ctx.save();
      ctx.translate(camera.panX, camera.panY);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(GRID_ORIGIN, GRID_ORIGIN);
      const previewPoints = polygonHover
        ? [...polygonPath.points, polygonHover]
        : [...polygonPath.points];
      if (polygonHover) {
        lastMouseCellRef.current = polygonHover;
      }
      ctx.strokeStyle = "rgba(78,141,245,0.9)";
      ctx.setLineDash([CELL_SIZE / 2, CELL_SIZE / 2]);
      ctx.lineWidth = 2 / camera.zoom;
      // Draw dashed guide and point markers
      ctx.beginPath();
      previewPoints.forEach((pt, idx) => {
        const cx = (pt.cellX + 0.5) * CELL_SIZE;
        const cy = (pt.cellY + 0.5) * CELL_SIZE;
        if (idx === 0) {
          ctx.moveTo(cx, cy);
        } else {
          ctx.lineTo(cx, cy);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
      previewPoints.forEach((pt) => {
        const cx = (pt.cellX + 0.5) * CELL_SIZE;
        const cy = (pt.cellY + 0.5) * CELL_SIZE;
        const r = Math.max(3, 6 / camera.zoom);
        ctx.fillStyle = "rgba(78,141,245,0.9)";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw tile previews for the entire polyline (closed=false while hovering)
      const previewTiles = placePolyline({
        points: previewPoints,
        strokeId: polygonPath.strokeId,
        recordHistory: false,
        appendToStroke: false,
        commit: false,
        closed: false,
      }) as
        | Array<{
            cellX: number;
            cellY: number;
            src: string;
            rotationIndex: number;
            mirrorX?: boolean;
            mirrorY?: boolean;
            layer: TileLayer;
            order: number;
          }>
        | undefined;
      if (previewTiles) {
        previewTiles.forEach((t) => {
          const img = imageCache.get(t.src);
          const tileSpan = getTileSpanFromName(t.src);
          const w =
            CELL_SIZE * (t.rotationIndex % 2 === 0 ? tileSpan.w : tileSpan.h);
          const h =
            CELL_SIZE * (t.rotationIndex % 2 === 0 ? tileSpan.h : tileSpan.w);
          const x = t.cellX * CELL_SIZE;
          const y = t.cellY * CELL_SIZE;
          if (img && img.complete) {
            ctx.save();
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate(
              RIGHT_ANGLE_ROTATIONS[
                t.rotationIndex % RIGHT_ANGLE_ROTATIONS.length
              ]
            );
            const drawW = img.width * (CELL_SIZE / 100);
            const drawH = img.height * (CELL_SIZE / 100);
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          } else {
            ctx.fillStyle = "rgba(78,141,245,0.08)";
            ctx.strokeStyle = "rgba(78,141,245,0.4)";
            ctx.lineWidth = 1 / camera.zoom;
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
          }
        });
      }

      ctx.restore();
    }
    if (roomDrag.active && roomDrag.start && roomDrag.end) {
      ctx.save();
      ctx.translate(camera.panX, camera.panY);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(GRID_ORIGIN, GRID_ORIGIN);
      const minX = Math.min(roomDrag.start.cellX, roomDrag.end.cellX);
      const maxX = Math.max(roomDrag.start.cellX, roomDrag.end.cellX);
      const minY = Math.min(roomDrag.start.cellY, roomDrag.end.cellY);
      const maxY = Math.max(roomDrag.start.cellY, roomDrag.end.cellY);
      const width = (maxX - minX + 1) * CELL_SIZE;
      const height = (maxY - minY + 1) * CELL_SIZE;
      ctx.strokeStyle = "rgba(78,141,245,0.9)";
      ctx.setLineDash([CELL_SIZE / 2, CELL_SIZE / 2]);
      ctx.lineWidth = 2 / camera.zoom;
      ctx.strokeRect(minX * CELL_SIZE, minY * CELL_SIZE, width, height);
      ctx.restore();
    }
    if (eraseDrag.active && eraseDrag.start && eraseDrag.end) {
      ctx.save();
      ctx.translate(camera.panX, camera.panY);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(GRID_ORIGIN, GRID_ORIGIN);
      const minX = Math.min(eraseDrag.start.cellX, eraseDrag.end.cellX);
      const maxX = Math.max(eraseDrag.start.cellX, eraseDrag.end.cellX);
      const minY = Math.min(eraseDrag.start.cellY, eraseDrag.end.cellY);
      const maxY = Math.max(eraseDrag.start.cellY, eraseDrag.end.cellY);
      const width = (maxX - minX + 1) * CELL_SIZE;
      const height = (maxY - minY + 1) * CELL_SIZE;
      ctx.strokeStyle = "rgba(220,38,38,0.9)";
      ctx.setLineDash([CELL_SIZE / 2, CELL_SIZE / 2]);
      ctx.lineWidth = 2 / camera.zoom;
      ctx.strokeRect(minX * CELL_SIZE, minY * CELL_SIZE, width, height);
      ctx.restore();
    }
    await drawTokens(ctx, generation, cssWidth, cssHeight);
    drawMeasure(ctx);

    // Map bounds outline/debug is disabled; clipping already enforces bounds.

    // Debug overlay for snapped center/footprint (optional)
    if (snapDebug && snapProbe) {
      const toScreen = (wx: number, wy: number) => ({
        x: wx * camera.zoom + camera.panX,
        y: wy * camera.zoom + camera.panY,
      });
      const worldCenterX = GRID_ORIGIN + snapProbe.centerX * CELL_SIZE;
      const worldCenterY = GRID_ORIGIN + snapProbe.centerY * CELL_SIZE;
      const worldLeft =
        GRID_ORIGIN + (snapProbe.centerX - snapProbe.w / 2) * CELL_SIZE;
      const worldTop =
        GRID_ORIGIN + (snapProbe.centerY - snapProbe.h / 2) * CELL_SIZE;
      const worldRight =
        GRID_ORIGIN + (snapProbe.centerX + snapProbe.w / 2) * CELL_SIZE;
      const worldBottom =
        GRID_ORIGIN + (snapProbe.centerY + snapProbe.h / 2) * CELL_SIZE;
      const { x: cx, y: cy } = toScreen(worldCenterX, worldCenterY);
      const { x: left, y: top } = toScreen(worldLeft, worldTop);
      const { x: right, y: bottom } = toScreen(worldRight, worldBottom);
      ctx.save();
      ctx.strokeStyle = "rgba(255,0,0,0.8)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(left, top, right - left, bottom - top);
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy);
      ctx.lineTo(cx + 6, cy);
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx, cy + 6);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,0,0,0.8)";
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Lighting: darkness overlay with light sources punching through.
    await drawLighting(ctx, cssWidth, cssHeight);

    // Fog layer: rendered last, above everything else.
    drawFog(ctx, cssWidth, cssHeight);

    // End clipping for world content and background.
    if (clipRect) {
      ctx.restore();
    }
  };

  const handleDragPreview = (
    clientX: number,
    clientY: number,
    dataTransfer: DataTransfer | null
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const worldX = (cx - camera.panX) / camera.zoom;
    const worldY = (cy - camera.panY) / camera.zoom;
    const tileData =
      dataTransfer?.getData("application/battlemap-tile") ||
      dataTransfer?.getData("text/plain");
    const src =
      (tileData &&
        (() => {
          try {
            const payload = JSON.parse(tileData) as { src: string };
            return payload.src;
          } catch {
            return null;
          }
        })()) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__battlemapDraggingTileSrc ||
      null;
    if (src) {
      const span = getTileSizeCells(src);
      const center = snapEnabled
        ? snapWorldToCenter(worldX, worldY, span, GRID_ORIGIN, CELL_SIZE)
        : {
            centerX: (worldX - GRID_ORIGIN) / CELL_SIZE,
            centerY: (worldY - GRID_ORIGIN) / CELL_SIZE,
          };
      const topLeft = centerAndSpanToTopLeft(center, span);
      setDragPreviewTile({
        src,
        cellX: topLeft.cellX,
        cellY: topLeft.cellY,
        layer: resolveTileLayer(src, { ignoreBrush: true }),
      });
    } else {
      setDragPreviewTile(null);
    }
  };

  const getTilesetIdFromSrc = (src?: string | null): string | null => {
    if (!src) return null;
    const normalizedSrc = src.toLowerCase();

    // First, try an exact match against known tileset entries.
    const exact = tilesets.find((ts) =>
      ts.tiles.some((t) => t.toLowerCase() === normalizedSrc)
    );
    if (exact) return exact.id;

    // Fallback: infer from path prefix and match against known ids.
    const prefix = "/assets/battlemap/Tilesets/";
    const idx = normalizedSrc.indexOf(prefix);
    if (idx === -1) return null;
    const rest = normalizedSrc.slice(idx + prefix.length);
    const parts = rest.split("/").filter(Boolean);

    // Try decreasing prefix lengths up to 3 segments: env, env/type, env/type/variant.
    for (let len = Math.min(3, parts.length); len >= 1; len -= 1) {
      const candidate = parts.slice(0, len).join("/");
      const match = tilesets.find((ts) => ts.id.toLowerCase() === candidate);
      if (match) return match.id;
    }

    return null;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setSpacePanning(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        // undo
        if (historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
          const prev = historyRef.current[historyIndexRef.current];
          if (prev) {
            setPlacedTiles(prev.placedTiles);
            setCamera(prev.camera);
          }
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setSpacePanning(false);
        panState.current = null;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedPlacedTileIds.size === 0) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (["input", "textarea", "select"].includes(tag)) return;
      const selection = new Set(selectedPlacedTileIds);
      if (e.code === "Delete" || e.code === "Backspace") {
        setPlacedTiles((prev) => {
          const next = prev.filter((t) => {
            if (!selection.has(t.id)) return true;
            if (isTileLocked(t)) return true;
            return false;
          });
          if (next.length !== prev.length) {
            pushHistory(next);
          }
          return next;
        });
        setSelectedPlacedTileIds(new Set());
      }
      if (e.code === "KeyR") {
        e.preventDefault();
        rotateSelectedTile(1);
      }
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)
      ) {
        e.preventDefault();
        const delta =
          e.code === "ArrowUp"
            ? { dx: 0, dy: -1 }
            : e.code === "ArrowDown"
            ? { dx: 0, dy: 1 }
            : e.code === "ArrowLeft"
            ? { dx: -1, dy: 0 }
            : { dx: 1, dy: 0 };
        nudgeSelectedTiles(delta.dx, delta.dy);
      }
      if (e.code === "KeyH") {
        e.preventDefault();
        mirrorSelectedTiles("x"); // horizontal flip across vertical axis
      }
      if (e.code === "KeyV") {
        e.preventDefault();
        mirrorSelectedTiles("y"); // vertical flip across horizontal axis
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPlacedTileIds, snapEnabled]);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const root = shellRef.current;
      if (!root) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // Keep the current tool when clicking in the right-hand tiles/brush rail;
      // only reset to Select when clicking completely outside the battlemap UI.
      const inRightRail = !!target.closest(".battlemap-page__rail--right");
      if (!root.contains(target) && !inRightRail) {
        setActiveTool("select");
      }
    };
    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const applySize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        setResizeTick((t) => t + 1);
      }
      setCanvasSized(rect.width > 0 && rect.height > 0);
    };

    applySize();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => applySize());
      observer.observe(canvas);
      const parent = canvas.parentElement;
      if (parent) observer.observe(parent);
    } else {
      window.addEventListener("resize", applySize);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener("resize", applySize);
      }
    };
  }, []);

  // Do not clear tiles on mapSeed changes; rely on explicit load/create flows

  useEffect(() => {
    selectionPivotRef.current = null;
  }, [selectedPlacedTileIds]);

  useEffect(() => {
    if (selectedMapId) {
      console.log(
        `[AUTO_LOAD_EFFECT] ${new Date().toISOString()} selectedMapId changed to ${selectedMapId}, loading...`
      );
      loadMapState(selectedMapId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMapId]);

  useEffect(() => {
    loadTilesets();
  }, []);

  useEffect(() => {
    if (historyIndexRef.current === -1) {
      pushHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMapPickerOpen(false);
  }, [selectedMapId]);

  useEffect(() => {
    if (!canvasSized) return;
    if (renderQueuedRef.current) return;
    renderQueuedRef.current = true;
    requestAnimationFrame(() => {
      renderQueuedRef.current = false;
      const gen = ++renderGeneration.current;
      render(gen);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    camera,
    tokens,
    selectedId,
    gridVisibleEffective,
    tokensVisibleEffective,
    measure,
    bgReady,
    mapSeed,
    resizeTick,
    placedTiles,
    legacyVisibility,
    roomDrag,
    lineDrag,
    polygonPath,
    polygonHover,
    dragPreviewTile,
    eraseDrag,
    canvasSized,
    snapProbe,
    snapDebug,
    fogVisibleCells,
    mapSize,
    fogVisibleEffective,
    orderedLayers,
    shadowOpacityByLayer,
    shadeOpacityByLayer,
    darknessOpacity,
  ]);

  useEffect(() => {
    // Always center on world origin (0,0) on load; ignore any saved camera
    if (cameraInitializedRef.current) return;
    if (!canvasSized) return;
    centerCameraOnOrigin(1);
    cameraInitializedRef.current = true;
    setCameraReady(true);
  }, [selectedMapId, canvasSized, mapSeed]);

  const centerOnSelection = () => {
    if (!selectedId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const token = tokens.find((t) => t.id === selectedId);
    if (!token) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const worldX =
      GRID_ORIGIN + (token.cellX + (token.width ?? 1) / 2) * CELL_SIZE;
    const worldY =
      GRID_ORIGIN + (token.cellY + (token.height ?? 1) / 2) * CELL_SIZE;
    setCamera((prev) => ({
      ...prev,
      panX: cx - worldX * prev.zoom,
      panY: cy - worldY * prev.zoom,
    }));
  };

  const zoomAt = (cx: number, cy: number, deltaZoom: number) => {
    const nextZoom = clamp(camera.zoom + deltaZoom, 0.2, 3);
    if (nextZoom === camera.zoom) return;
    const wx = (cx - camera.panX) / camera.zoom;
    const wy = (cy - camera.panY) / camera.zoom;
    const panX = cx - wx * nextZoom;
    const panY = cy - wy * nextZoom;
    setCamera({ panX, panY, zoom: nextZoom });
  };

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    zoomAt(cx, cy, delta);
  };

  const startPan: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (skipPanRef.current) return;
    if (event.button !== 0) return; // only left click starts pan
    if (hoverId && !spacePanning) return; // don't pan when over a token unless space-panning
    const toolBlocksPan = [
      "select",
      "measure",
      "tile",
      "room",
      "border",
      "area",
      "polygon",
      "gradient",
      "fog",
      "erase",
    ].includes(activeTool);
    if (!spacePanning && toolBlocksPan) return; // respect tool behavior unless space override
    panState.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: camera.panX,
      panY: camera.panY,
      forced: spacePanning,
    };
  };

  const handlePan: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!panState.current) return;
    const dx = event.clientX - panState.current.startX;
    const dy = event.clientY - panState.current.startY;
    setCamera((prev) => {
      const state = panState.current;
      if (!state) return prev;
      return { ...prev, panX: state.panX + dx, panY: state.panY + dy };
    });
  };

  const stopPan = () => {
    panState.current = null;
  };

  const handleCanvasMouseDown: React.MouseEventHandler<HTMLCanvasElement> = (
    e
  ) => {
    closeContextMenu();
    if (e.button !== 0) return;
    if (spacePanning) return; // spacebar pan overrides tool actions
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldX = (cx - camera.panX) / camera.zoom;
    const worldY = (cy - camera.panY) / camera.zoom;
    const rawCellX = Math.floor((worldX - GRID_ORIGIN) / CELL_SIZE);
    const rawCellY = Math.floor((worldY - GRID_ORIGIN) / CELL_SIZE);

    const hitPlaced = placedTiles
      .slice()
      .reverse()
      .find((t) => {
        const visible = legacyVisibility[t.layer] ?? true;
        if (!visible) return false;
        if (isTileLocked(t)) return false;
        // Alpha-based pixel hit test at cursor position
        return hitTestTileAlpha(cx, cy, t);
      });

    const hitToken = [...tokens].reverse().find((token) => {
      const { x, y, size } = toScreen(token, getRenderSizePx(token));
      return cx >= x && cx <= x + size && cy >= y && cy <= y + size;
    });

    lastMouseCellRef.current = { cellX: rawCellX, cellY: rawCellY };
    updateSnapProbe({
      worldX,
      worldY,
      hitTile: hitPlaced ?? null,
      hitToken: hitToken ?? null,
      draggingTileId: dragState.current?.anchorId ?? null,
      draggingTokenId: dragState.current?.tokenId ?? null,
    });

    if (hitPlaced && (activeTool === "select" || activeTool === "pan")) {
      const modifier = e.shiftKey || e.ctrlKey || e.metaKey;
      const alreadySelected = selectedPlacedTileIds.has(hitPlaced.id);
      const nextSelection =
        activeTool === "pan"
          ? new Set<string>([hitPlaced.id])
          : (() => {
              if (!modifier && alreadySelected) {
                // Keep existing selection when clicking within it.
                return new Set(selectedPlacedTileIds);
              }
              const base = modifier
                ? new Set(selectedPlacedTileIds)
                : new Set<string>();
              if (modifier) {
                if (base.has(hitPlaced.id)) {
                  base.delete(hitPlaced.id);
                } else {
                  base.add(hitPlaced.id);
                }
              } else {
                base.add(hitPlaced.id);
              }
              return base;
            })();
      setSelectedPlacedTileIds(nextSelection);
      if (activeTool === "select") {
        snapTilesToGrid(nextSelection);
      }
      const toDrag = placedTiles.filter((t) => nextSelection.has(t.id));
      const anchor = toDrag.find((t) => t.id === hitPlaced.id) ?? toDrag[0];
      if (anchor) {
        const startPositions = new Map<
          string,
          {
            topLeft: { cellX: number; cellY: number };
            center: { centerX: number; centerY: number };
            footprint: { w: number; h: number };
          }
        >();
        toDrag.forEach((tile) => {
          const fp = getTileFootprint(tile);
          startPositions.set(tile.id, {
            topLeft: fp.topLeft,
            center: fp.center,
            footprint: fp.footprint,
          });
        });
        dragState.current = {
          tileIds: toDrag.map((t) => t.id),
          anchorId: anchor.id,
          startPositions,
        };
      }
      skipPanRef.current = true;
      e.stopPropagation(); // prevent parent pan start
      return;
    }

    if (activeTool === "select" && !hitPlaced && !hitToken) {
      setSelectionBox({
        active: true,
        start: { cellX: rawCellX, cellY: rawCellY },
        end: { cellX: rawCellX, cellY: rawCellY },
        mode: e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace",
      });
      return;
    }

    if (
      activeTool === "room" ||
      activeTool === "border" ||
      activeTool === "fog"
    ) {
      const strokeId = `room-${Date.now()}`;
      setRoomDrag({
        active: true,
        start: { cellX: rawCellX, cellY: rawCellY },
        end: { cellX: rawCellX, cellY: rawCellY },
        strokeId,
        mode: activeTool === "border" ? "border" : "fill",
      });
      return;
    }

    if (activeTool === "area") {
      const strokeId = `line-${Date.now()}`;
      setLineDrag({
        active: true,
        start: { cellX: rawCellX, cellY: rawCellY },
        end: { cellX: rawCellX, cellY: rawCellY },
        strokeId,
      });
      return;
    }

    if (activeTool === "polygon") {
      setPolygonPath((prev) => {
        const strokeId =
          prev.active && prev.strokeId ? prev.strokeId : `poly-${Date.now()}`;
        const nextPoint = { cellX: rawCellX, cellY: rawCellY };
        if (!prev.active || prev.points.length === 0) {
          return { active: true, points: [nextPoint], strokeId };
        }
        return { active: true, points: [...prev.points, nextPoint], strokeId };
      });
      return;
    }

    if (activeTool === "tile") {
      tileStroke.current.active = true;
      tileStroke.current.visited = new Set([`${rawCellX},${rawCellY}`]);
      placeTileAt(worldX, worldY);
      return;
    }

    if (activeTool === "erase") {
      setEraseDrag({
        active: true,
        start: { cellX: rawCellX, cellY: rawCellY },
        end: { cellX: rawCellX, cellY: rawCellY },
      });
      return;
    }

    if (activeTool === "measure") {
      setMeasure((prev) => {
        const last = prev.points[prev.points.length - 1];
        const dx = rawCellX - (last?.cellX ?? 0);
        const dy = rawCellY - (last?.cellY ?? 0);
        let snapX = rawCellX;
        let snapY = rawCellY;
        if (last) {
          if (Math.abs(dx) > Math.abs(dy)) {
            snapY = last.cellY; // horizontal
          } else if (Math.abs(dy) > Math.abs(dx)) {
            snapX = last.cellX; // vertical
          } else {
            // perfect diagonal, keep both
          }
        }
        if (!prev.active || prev.points.length === 0) {
          return {
            points: [{ cellX: snapX, cellY: snapY }],
            floating: { cellX: snapX, cellY: snapY },
            active: true,
          };
        }
        const pts = [...prev.points, { cellX: snapX, cellY: snapY }];
        return {
          points: pts,
          floating: { cellX: snapX, cellY: snapY },
          active: true,
        };
      });
      return;
    }

    const canMove =
      hitToken &&
      !hitToken.locked &&
      (hitToken.ownerId === currentUserId || currentUserId === "dm-local");
    if (hitToken) {
      setSelectedId(hitToken.id);
      if (canMove) {
        dragState.current = { tokenId: hitToken.id };
      }
      e.stopPropagation(); // prevent pan start
      return;
    }
    setSelectedId(null);
    setSelectedPlacedTileIds(new Set());
    setTokens((prev) => prev); // no-op, just for clarity
  };

  const handleCanvasMouseMove: React.MouseEventHandler<HTMLCanvasElement> = (
    e
  ) => {
    if (spacePanning) return; // suppress tool interactions while panning with space
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldX = (cx - camera.panX) / camera.zoom;
    const worldY = (cy - camera.panY) / camera.zoom;
    const rawCellX = Math.floor((worldX - GRID_ORIGIN) / CELL_SIZE);
    const rawCellY = Math.floor((worldY - GRID_ORIGIN) / CELL_SIZE);
    const hit = [...tokens].reverse().find((token) => {
      const { x, y, size } = toScreen(token, getRenderSizePx(token));
      return cx >= x && cx <= x + size && cy >= y && cy <= y + size;
    });
    setHoverId(hit?.id ?? null);
    if (activeTool === "polygon") {
      setPolygonHover({ cellX: rawCellX, cellY: rawCellY });
    } else {
      setPolygonHover(null);
    }

    const hoverPlaced = placedTiles
      .slice()
      .reverse()
      .find((t) => {
        const visible = legacyVisibility[t.layer] ?? true;
        if (!visible) return false;
        return hitTestTileAlpha(cx, cy, t);
      });

    updateSnapProbe({
      worldX,
      worldY,
      hitTile: hoverPlaced ?? null,
      hitToken: hit ?? null,
      draggingTileId: dragState.current?.anchorId ?? null,
      draggingTokenId: dragState.current?.tokenId ?? null,
    });

    if (selectionBox.active && activeTool === "select") {
      setSelectionBox((prev) => ({
        ...prev,
        end: { cellX: rawCellX, cellY: rawCellY },
      }));
      return;
    }

    if (
      (activeTool === "room" ||
        activeTool === "border" ||
        activeTool === "fog") &&
      roomDrag.active &&
      roomDrag.start
    ) {
      const nextEnd = { cellX: rawCellX, cellY: rawCellY };
      setRoomDrag((prev) => ({ ...prev, end: nextEnd }));
      if (activeTool !== "fog") {
        placeRectangle(
          roomDrag.start,
          nextEnd,
          roomDrag.strokeId,
          roomDrag.mode ?? "fill"
        );
      }
      return;
    }

    if (activeTool === "area" && lineDrag.active && lineDrag.start) {
      const nextEnd = { cellX: rawCellX, cellY: rawCellY };
      setLineDrag((prev) => ({ ...prev, end: nextEnd }));
      placeLine(lineDrag.start, nextEnd, lineDrag.strokeId);
      return;
    }

    if (activeTool === "erase" && eraseDrag.active && eraseDrag.start) {
      const nextEnd = { cellX: rawCellX, cellY: rawCellY };
      setEraseDrag((prev) => ({ ...prev, end: nextEnd }));
      return;
    }

    if (activeTool === "tile" && tileStroke.current.active) {
      const key = `${rawCellX},${rawCellY}`;
      if (!tileStroke.current.visited.has(key)) {
        tileStroke.current.visited.add(key);
        placeTileAt(worldX, worldY);
      }
      return;
    }

    if (
      activeTool === "measure" &&
      measure.active &&
      measure.points.length >= 1
    ) {
      setMeasure((prev) => {
        const last = prev.points[prev.points.length - 1];
        if (!last) return prev;
        const dx = rawCellX - last.cellX;
        const dy = rawCellY - last.cellY;
        let snapX = rawCellX;
        let snapY = rawCellY;
        if (Math.abs(dx) > Math.abs(dy)) {
          snapY = last.cellY;
        } else if (Math.abs(dy) > Math.abs(dx)) {
          snapX = last.cellX;
        }
        return { ...prev, floating: { cellX: snapX, cellY: snapY } };
      });
    } else if (
      dragState.current?.tileIds &&
      dragState.current.tileIds.length > 0
    ) {
      const anchorId =
        dragState.current.anchorId ?? dragState.current.tileIds[0];
      const anchorStart = dragState.current.startPositions?.get(anchorId);
      if (!anchorStart) return;
      if (snapEnabled) {
        const anchorCenter = snapWorldToCenter(
          worldX,
          worldY,
          anchorStart.footprint,
          GRID_ORIGIN,
          CELL_SIZE
        );
        const anchorTopLeft = centerAndSpanToTopLeft(
          anchorCenter,
          anchorStart.footprint
        );
        const deltaX = anchorTopLeft.cellX - anchorStart.topLeft.cellX;
        const deltaY = anchorTopLeft.cellY - anchorStart.topLeft.cellY;
        setPlacedTiles((prev) =>
          prev.map((t) => {
            const start = dragState.current?.startPositions?.get(t.id);
            if (!start) return t;
            const nextTopLeft = {
              cellX: start.topLeft.cellX + deltaX,
              cellY: start.topLeft.cellY + deltaY,
            };
            const nextCenter = topLeftAndSpanToCenter(
              nextTopLeft,
              start.footprint
            );
            return {
              ...t,
              cellX: nextTopLeft.cellX,
              cellY: nextTopLeft.cellY,
              centerX: nextCenter.centerX,
              centerY: nextCenter.centerY,
            };
          })
        );
      } else {
        const anchorCenter = {
          centerX: (worldX - GRID_ORIGIN) / CELL_SIZE,
          centerY: (worldY - GRID_ORIGIN) / CELL_SIZE,
        };
        const deltaCenterX = anchorCenter.centerX - anchorStart.center.centerX;
        const deltaCenterY = anchorCenter.centerY - anchorStart.center.centerY;
        setPlacedTiles((prev) =>
          prev.map((t) => {
            const start = dragState.current?.startPositions?.get(t.id);
            if (!start) return t;
            const nextCenter = {
              centerX: start.center.centerX + deltaCenterX,
              centerY: start.center.centerY + deltaCenterY,
            };
            const nextTopLeft = centerAndSpanToTopLeft(
              nextCenter,
              start.footprint
            );
            return {
              ...t,
              cellX: nextTopLeft.cellX,
              cellY: nextTopLeft.cellY,
              centerX: nextCenter.centerX,
              centerY: nextCenter.centerY,
            };
          })
        );
      }
    } else if (dragState.current?.tokenId) {
      // snap drag to the nearest cell under cursor (no diagonal snap needed for drag)
      const footprintW = dragState.current?.tokenId
        ? tokens.find((tok) => tok.id === dragState.current?.tokenId)?.width ??
          1
        : 1;
      const footprintH = dragState.current?.tokenId
        ? tokens.find((tok) => tok.id === dragState.current?.tokenId)?.height ??
          1
        : 1;
      const tokenSpan = { w: footprintW, h: footprintH };
      const tokenCenter = snapWorldToCenter(
        worldX,
        worldY,
        tokenSpan,
        GRID_ORIGIN,
        CELL_SIZE
      );
      const { cellX: dragCellX, cellY: dragCellY } = centerAndSpanToTopLeft(
        tokenCenter,
        tokenSpan
      );
      setTokens((prev) =>
        prev.map((t) => {
          if (t.id !== dragState.current?.tokenId) return t;
          const footprintW = t.width ?? 1;
          const footprintH = t.height ?? 1;
          const occupied = prev.some((other) => {
            if (other.id === t.id) return false;
            const ow = other.width ?? 1;
            const oh = other.height ?? 1;
            const overlapX =
              dragCellX < other.cellX + ow &&
              dragCellX + footprintW > other.cellX;
            const overlapY =
              dragCellY < other.cellY + oh &&
              dragCellY + footprintH > other.cellY;
            return overlapX && overlapY;
          });
          if (occupied) return t;
          return { ...t, cellX: dragCellX, cellY: dragCellY };
        })
      );
    }
  };

  const placeRectangle = (
    start: { cellX: number; cellY: number },
    end: { cellX: number; cellY: number },
    strokeId?: string,
    mode: "fill" | "border" = "fill",
    recordHistory = false
  ) => {
    let tiles =
      (selectedTile ? [selectedTile] : undefined) ??
      (activeBrushTiles && activeBrushTiles.length > 0
        ? activeBrushTiles
        : tilesets.find((t) => t.id === activeTilesetId)?.tiles) ??
      FALLBACK_TILESET;
    const useBorders = mode === "border";
    const activeBorders = useBorders ? activeBrush?.resolvedBorders : undefined;
    const activeCorners = useBorders ? activeBrush?.resolvedCorners : undefined;
    if (!tiles && !useBorders) return;
    if (!useBorders && tiles) {
      const exclusionSuffixes =
        activeBrush?.fillExclusionSuffixes ??
        (activeBrush?.excludeBorderTilesInFill ? ["_b", "_bc", "_bic"] : []);
      if (exclusionSuffixes.length > 0) {
        const filtered = tiles.filter((src) => {
          const name = src.split("/").pop()?.toLowerCase() ?? "";
          return !exclusionSuffixes.some((suf) =>
            name.includes(suf.toLowerCase())
          );
        });
        if (filtered.length > 0) {
          tiles = filtered;
        }
      }
    }
    // Rectangle placements should never pull from border-marked or end tiles.
    if (!useBorders && tiles) {
      const nonBorder = tiles.filter((src) => {
        const name = src.split("/").pop()?.toLowerCase() ?? "";
        return !["_b", "_bc", "_bic", "-b", "-bc", "-bic", "_e", "-e"].some(
          (suf) => name.includes(suf)
        );
      });
      if (nonBorder.length > 0) {
        tiles = nonBorder;
      }
    }
    const decoTiles = tiles
      ? tiles.filter((src) => {
          const name = src.split("/").pop()?.toLowerCase() ?? "";
          return name.includes("_d") || name.includes("-d");
        })
      : [];
    const decoEnabled =
      activeBrush?.decorationMode === "adaptiveGrid" || decoTiles.length > 0;
    const baseFillTiles =
      decoTiles.length > 0 && tiles
        ? (() => {
            const base = tiles.filter((src) => {
              const name = src.split("/").pop()?.toLowerCase() ?? "";
              return !(name.includes("_d") || name.includes("-d"));
            });
            return base.length > 0 ? base : tiles;
          })()
        : tiles ?? [];
    const seedKey = selectedTile
      ? `tile:${selectedTile}`
      : activeBrushTiles && activeBrushTiles.length > 0
      ? `brush:${activeBrushTiles.join(",")}`
      : activeTilesetId ?? "fallback";
    const minX = Math.min(start.cellX, end.cellX);
    const maxX = Math.max(start.cellX, end.cellX);
    const minY = Math.min(start.cellY, end.cellY);
    const maxY = Math.max(start.cellY, end.cellY);
    const placement = resolvePlacementLayerForSrc(tiles?.[0]);
    if (!placement) {
      setPlacementWarning("Select a layer before painting.");
      return;
    }
    setPlacementWarning(null);
    const { layer, targetLayerId } = placement;
    if (isLayerLocked(targetLayerId, layer)) return;
    const clearLayers = activeBrush?.clearOverlapsLayers ?? ["floor"];
    const baseOrder = getNextOrder(layer, targetLayerId);
    const toPlace: Array<{
      id: string;
      cellX: number;
      cellY: number;
      src: string;
      rotationIndex: number;
      strokeId?: string;
      layer: TileLayer;
      order: number;
      layerId?: string | null;
      mirrorX?: boolean;
      mirrorY?: boolean;
      centerX?: number;
      centerY?: number;
      scale?: number;
    }> = [];
    let counter = 0;
    const positionJitter = !useBorders
      ? activeBrush?.randomness?.positionJitter ?? 0
      : 0;
    const sizeJitter = !useBorders
      ? activeBrush?.randomness?.sizeJitter ?? 0
      : 0;
    if (useBorders) {
      const corners = activeCorners ?? {};
      const borders = activeBorders ?? {};
      const cornerPoolSources =
        activeBrush?.resolvedCornerPool?.map((c) => c.src) ?? [];
      const edgePoolSources =
        activeBrush?.resolvedBorderPool?.map((b) => ({
          src: b.src,
          rotationIndex: b.autoRotate ? 0 : b.rotationIndex ?? 0,
          autoRotate: b.autoRotate ?? true, // Default to true for edges to auto-rotate
        })) ?? [];
      const rawEdgePool =
        edgePoolSources.length > 0
          ? edgePoolSources
          : (activeBrush?.resolvedFillTiles ?? [])
              .filter((src) => {
                // Exclude end tiles from border/edge pools
                const name = src.split("/").pop()?.toLowerCase() ?? "";
                return !["_e", "-e"].some((suf) => name.includes(suf));
              })
              .map((src) => ({
                src,
                rotationIndex: 0,
                autoRotate: true, // Ensure fallback pool tiles auto-rotate for edges
              }));

      // Corner orientation is driven by the placement/tool logic, not by
      // any baked rotation in the PNG or brush JSON. Corner pools only
      // supply src; we map the desired corner rotation (from tools config)
      // into a RIGHT_ANGLE_ROTATIONS index here.
      const pickCornerTile = (
        cellX: number,
        cellY: number,
        rotationIndex: number
      ) => {
        const poolSrcs: string[] =
          cornerPoolSources.length > 0
            ? cornerPoolSources
            : edgePoolSources.length > 0
            ? edgePoolSources.map((e) => e.src)
            : tiles ?? [];
        if (poolSrcs.length === 0) return undefined;
        const rand = seededRand(`${mapSeed}:${seedKey}:corner`, cellX, cellY);
        const src = poolSrcs[Math.floor(rand(0) * poolSrcs.length)];
        // Corners are oriented purely by the requested rotationIndex (tools config), not by any baked rotation.
        const appliedRotation =
          (rotationIndex + 1) % RIGHT_ANGLE_ROTATIONS.length;
        return { src, rotationIndex: appliedRotation };
      };

      const pickEdgeTile = (
        cellX: number,
        cellY: number,
        rotationIndex: number,
        borderTile?: {
          src?: string;
          rotationIndex?: number;
          autoRotate?: boolean;
        }
      ) => {
        const pool = edgePoolSources.length > 0 ? edgePoolSources : rawEdgePool;
        const candidates: Array<{
          src: string;
          rotationIndex: number;
          autoRotate?: boolean;
        }> = [];
        if (borderTile?.src) {
          // Border tiles default to autoRotate: true so edges face the correct direction
          const shouldAutoRotate = borderTile.autoRotate !== false; // Default true unless explicitly false
          candidates.push({
            src: borderTile.src,
            rotationIndex: shouldAutoRotate
              ? rotationIndex
              : borderTile.rotationIndex ?? 0,
            autoRotate: shouldAutoRotate,
          });
        }
        pool.forEach((entry) => {
          candidates.push({
            src: entry.src,
            rotationIndex: entry.autoRotate
              ? rotationIndex
              : entry.rotationIndex ?? rotationIndex,
            autoRotate: entry.autoRotate,
          });
        });
        if (candidates.length === 0) return undefined;
        const rand = seededRand(`${mapSeed}:${seedKey}:edge`, cellX, cellY);
        const chosen = candidates[Math.floor(rand(0) * candidates.length)];
        // Random vertical-axis mirror for variation (do not rotate) only if requested by the brush.
        const mirrorX = activeBrush?.edgeRandomMirrorX ? rand(1) > 0.5 : false;
        return {
          src: chosen.src,
          rotationIndex: chosen.rotationIndex,
          mirrorX,
        };
      };

      const pushTile = (
        cellX: number,
        cellY: number,
        tile?: {
          src: string;
          rotationIndex?: number;
          mirrorX?: boolean;
          mirrorY?: boolean;
        }
      ) => {
        const chosen = tile;
        if (!chosen) return;
        const rotationIndex =
          typeof chosen.rotationIndex === "number" ? chosen.rotationIndex : 0;
        toPlace.push({
          id: `${cellX},${cellY}:${Date.now()}:${counter++}`,
          cellX,
          cellY,
          src: chosen.src,
          rotationIndex,
          mirrorX: chosen.mirrorX,
          strokeId,
          layer,
          order: baseOrder + counter,
          layerId: targetLayerId,
        });
      };
      // corners with fallback to random _c tile or random edge tile rotated
      pushTile(minX, minY, corners.tl ?? pickCornerTile(minX, minY, 3));
      pushTile(maxX, minY, corners.tr ?? pickCornerTile(maxX, minY, 0));
      pushTile(minX, maxY, corners.bl ?? pickCornerTile(minX, maxY, 2));
      pushTile(maxX, maxY, corners.br ?? pickCornerTile(maxX, maxY, 1));
      // top/bottom edges
      for (let x = minX + 1; x <= maxX - 1; x++) {
        pushTile(x, minY, pickEdgeTile(x, minY, 0, borders.top));
        pushTile(x, maxY, pickEdgeTile(x, maxY, 2, borders.bottom));
      }
      // left/right edges
      for (let y = minY + 1; y <= maxY - 1; y++) {
        pushTile(minX, y, pickEdgeTile(minX, y, 3, borders.left));
        pushTile(maxX, y, pickEdgeTile(maxX, y, 1, borders.right));
      }
    } else if (tiles) {
      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      const innerWidth = Math.max(0, width - 2);
      const innerHeight = Math.max(0, height - 2);
      const area = innerWidth * innerHeight;
      const decoMin = activeBrush?.decorationMinSpacing ?? 2;
      const decoMax = activeBrush?.decorationMaxSpacing ?? 6;
      const decoSpacing =
        decoTiles.length > 0 && decoEnabled && area > 0
          ? Math.max(
              decoMin,
              Math.min(decoMax, Math.round(Math.sqrt(area / 9)))
            )
          : 0;
      const decoRand =
        decoTiles.length > 0 && decoSpacing > 0
          ? seededRand(`${mapSeed}:${seedKey}:deco`, minX, minY)
          : null;
      const inset = Math.max(0, activeBrush?.decorationInset ?? 1);
      const decoOffsetX = decoRand ? Math.floor(decoRand(0) * decoSpacing) : 0;
      const decoOffsetY = decoRand ? Math.floor(decoRand(1) * decoSpacing) : 0;
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const rand = seededRand(`${mapSeed}:${seedKey}`, x, y);
          const patternDecor =
            decoEnabled &&
            decoTiles.length > 0 &&
            decoSpacing > 0 &&
            x >= minX + inset &&
            x <= maxX - inset &&
            y >= minY + inset &&
            y <= maxY - inset &&
            (x - (minX + inset) - decoOffsetX + decoSpacing) % decoSpacing ===
              0 &&
            (y - (minY + inset) - decoOffsetY + decoSpacing) % decoSpacing ===
              0;
          const pool = patternDecor ? decoTiles : baseFillTiles;
          if (!pool || pool.length === 0) continue;
          const src = pool[Math.floor(rand(0) * pool.length)];
          const rotationIndex = Math.floor(
            rand(1) * RIGHT_ANGLE_ROTATIONS.length
          );
          const jitterX =
            positionJitter > 0 ? (rand(2) - 0.5) * 2 * positionJitter : 0;
          const jitterY =
            positionJitter > 0 ? (rand(3) - 0.5) * 2 * positionJitter : 0;
          const scale =
            sizeJitter > 0 ? 1 + (rand(4) - 0.5) * 2 * sizeJitter : 1;
          const centerX = x + 0.5 + jitterX;
          const centerY = y + 0.5 + jitterY;
          toPlace.push({
            id: `${x},${y}:${Date.now()}:${counter++}`,
            cellX: x,
            cellY: y,
            src,
            rotationIndex,
            centerX,
            centerY,
            scale,
            strokeId,
            layer,
            order: baseOrder + counter,
            layerId: targetLayerId,
          });
        }
      }
    }
    let nextTiles: typeof placedTiles | null = null;
    setPlacedTiles((prev) => {
      const filtered = prev.filter((t) => {
        if (strokeId && t.strokeId === strokeId) return false; // replace current stroke entirely
        return true;
      });
      const shouldClearOverlaps =
        !useBorders &&
        clearLayers.length > 0 &&
        toPlace.some((t) => clearLayers.includes(t.layer));
      const cleared = shouldClearOverlaps
        ? removeOverlappingTiles(filtered, toPlace, clearLayers)
        : filtered;
      nextTiles = [...cleared, ...toPlace];
      return nextTiles;
    });
    if (recordHistory && nextTiles) {
      pushHistory(nextTiles);
    }
    return nextTiles;
  };

  const getLineCells = (
    start: { cellX: number; cellY: number },
    end: { cellX: number; cellY: number }
  ) => {
    // First, compute a Bresenham line between the points.
    const raw: Array<{ cellX: number; cellY: number }> = [];
    let x0 = start.cellX;
    let y0 = start.cellY;
    const x1 = end.cellX;
    const y1 = end.cellY;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      raw.push({ cellX: x0, cellY: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }

    // Then expand diagonal steps into orthogonal steps so that we always have
    // a full tile path (4-connected) between the endpoints. This creates
    // explicit corner cells where direction changes, which lets the line tool
    // place corner tiles.
    if (raw.length === 0) return raw;
    const stepped: Array<{ cellX: number; cellY: number }> = [];
    for (let i = 0; i < raw.length - 1; i += 1) {
      const a = raw[i];
      const b = raw[i + 1];
      if (i === 0) {
        stepped.push(a);
      }
      const dxStep = b.cellX - a.cellX;
      const dyStep = b.cellY - a.cellY;

      if (dxStep !== 0 && dyStep !== 0) {
        // Diagonal move: insert an intermediate cell so we walk orthogonally.
        // We bias to horizontal-first so the path "stair-steps" predictably.
        const mid = { cellX: b.cellX, cellY: a.cellY };
        // Avoid duplicates if Bresenham already visited this cell.
        const last = stepped[stepped.length - 1];
        if (!last || last.cellX !== mid.cellX || last.cellY !== mid.cellY) {
          stepped.push(mid);
        }
      }

      const last = stepped[stepped.length - 1];
      if (!last || last.cellX !== b.cellX || last.cellY !== b.cellY) {
        stepped.push(b);
      }
    }

    return stepped;
  };

  const buildPolylineCells = (
    points: { cellX: number; cellY: number }[],
    closed: boolean
  ) => {
    if (points.length < 2) return [];
    const cells: Array<{ cellX: number; cellY: number }> = [];
    const segments = closed ? points.length : points.length - 1;
    for (let i = 0; i < segments; i += 1) {
      const a = points[i];
      const b = i === points.length - 1 ? points[0] : points[i + 1];
      const segCells = getLineCells(a, b);
      if (cells.length === 0) {
        cells.push(...segCells);
      } else {
        // Drop the first cell of subsequent segments to avoid duplicates at joints.
        cells.push(...segCells.slice(1));
      }
    }
    if (closed && cells.length > 1) {
      const first = cells[0];
      const last = cells[cells.length - 1];
      if (first.cellX === last.cellX && first.cellY === last.cellY) {
        cells.pop();
      }
    }
    return cells;
  };

  const placeCells = ({
    cells,
    strokeId,
    recordHistory = false,
    appendToStroke = false,
    commit = true,
    placeStartEndpoint = true,
    placeEndEndpoint = true,
    incomingDir,
    skipFirstCell = false,
    skipLastCell = false,
    closed = false,
    skipClearOverlaps = false,
  }: {
    cells: Array<{ cellX: number; cellY: number }>;
    strokeId?: string;
    recordHistory?: boolean;
    appendToStroke?: boolean;
    commit?: boolean;
    placeStartEndpoint?: boolean;
    placeEndEndpoint?: boolean;
    incomingDir?: 0 | 1 | 2 | 3;
    skipFirstCell?: boolean;
    skipLastCell?: boolean;
    closed?: boolean;
    skipClearOverlaps?: boolean;
  }) => {
    const tilesFromSelection =
      (selectedTile ? [selectedTile] : undefined) ??
      (activeBrushTiles && activeBrushTiles.length > 0
        ? activeBrushTiles
        : undefined);

    const inferredTilesetIdFromSelection =
      (tilesFromSelection && tilesFromSelection.length > 0
        ? getTilesetIdFromSrc(tilesFromSelection[0])
        : null) ?? null;

    const activeTileset =
      tilesets.find((t) => t.id === activeTilesetId) ?? null;
    const baseTilesetIdRaw = inferredTilesetIdFromSelection ?? activeTilesetId;
    const baseTilesetId =
      baseTilesetIdRaw && baseTilesetIdRaw.includes("/brushes/")
        ? baseTilesetIdRaw.replace("/brushes", "")
        : baseTilesetIdRaw;
    const baseTileset: Tileset | null = baseTilesetId
      ? tilesets.find((t) => t.id === baseTilesetId) ?? activeTileset ?? null
      : activeTileset ?? null;
    const tilesetTiles =
      baseTileset?.tiles ?? activeTileset?.tiles ?? FALLBACK_TILESET;
    const tiles =
      (selectedTile ? [selectedTile] : undefined) ??
      (activeBrushTiles && activeBrushTiles.length > 0
        ? activeBrushTiles
        : tilesetTiles);
    if (!tiles || tiles.length === 0 || cells.length === 0) return;
    const seedKey = selectedTile
      ? `tile:${selectedTile}`
      : activeBrushTiles && activeBrushTiles.length > 0
      ? `brush:${activeBrushTiles.join(",")}`
      : activeTilesetId ?? "fallback";
    // Derive a base direction from the first non-zero delta so closed paths (start=end) still get a rotation.
    let baseDir: 0 | 1 | 2 | 3 = 0;
    for (let i = 0; i < cells.length - 1; i += 1) {
      const dx = cells[i + 1].cellX - cells[i].cellX;
      const dy = cells[i + 1].cellY - cells[i].cellY;
      if (dx !== 0 || dy !== 0) {
        baseDir = dirFromDelta(dx, dy);
        break;
      }
    }
    const baseRotationIndex = baseDir; // 0:right,1:down,2:left,3:up

    const placement = resolvePlacementLayerForSrc(tiles?.[0]);
    if (!placement) {
      setPlacementWarning("Select a layer before painting.");
      return;
    }
    setPlacementWarning(null);
    const { layer, targetLayerId } = placement;
    if (isLayerLocked(targetLayerId, layer)) return;
    const clearLayers = skipClearOverlaps
      ? []
      : activeBrush?.clearOverlapsLayers ?? ["floor"];

    // Endpoint and corner handling:
    // - Tiles whose filenames contain any of the configured endpoint suffixes
    //   (from tools/brush JSON) are used for the first and last cells.
    // - Tiles whose filenames contain any of the configured corner suffixes
    //   are treated as corner tiles and used where the path changes direction.
    // - Remaining tiles are used for straight body segments.
    const endpointSuffixes = (activeBrush?.endpointSuffixes ?? ["_e"]).map(
      (s) => s.toLowerCase()
    );
    const cornerSuffixes = (activeBrush?.cornerSuffixes ?? ["_c"]).map((s) =>
      s.toLowerCase()
    );

    const endpointSource = Array.from(new Set([...tiles, ...tilesetTiles]));
    const cornerSource = endpointSource;

    const endpointTiles = endpointSource.filter((src: string) => {
      const name = src.split("/").pop()?.toLowerCase() ?? "";
      return endpointSuffixes.some((suf) => name.includes(suf));
    });
    const cornerTiles = cornerSource.filter((src: string) => {
      const name = src.split("/").pop()?.toLowerCase() ?? "";
      return cornerSuffixes.some((suf) => name.includes(suf));
    });
    const bodyTilesRawFromBrush = tiles.filter((src: string) => {
      const name = src.split("/").pop()?.toLowerCase() ?? "";
      const isEndpoint = endpointSuffixes.some((suf) => name.includes(suf));
      const isCorner = cornerSuffixes.some((suf) => name.includes(suf));
      return !isEndpoint && !isCorner;
    });
    const bodyTilesRawFromTileset = tilesetTiles.filter((src: string) => {
      const name = src.split("/").pop()?.toLowerCase() ?? "";
      const isEndpoint = endpointSuffixes.some((suf) => name.includes(suf));
      const isCorner = cornerSuffixes.some((suf) => name.includes(suf));
      return !isEndpoint && !isCorner;
    });
    const bodyTiles =
      bodyTilesRawFromBrush.length > 0
        ? bodyTilesRawFromBrush
        : bodyTilesRawFromTileset.length > 0
        ? bodyTilesRawFromTileset
        : tilesetTiles;

    const toPlaceRaw = cells.map((cell, idx) => {
      const prev =
        idx > 0 ? cells[idx - 1] : closed ? cells[cells.length - 1] : null;
      const next =
        idx < cells.length - 1 ? cells[idx + 1] : closed ? cells[0] : null;
      const isEndpoint =
        (idx === 0 && placeStartEndpoint) ||
        (idx === cells.length - 1 && placeEndEndpoint);

      const dirIn = prev
        ? (() => {
            const dx = cell.cellX - prev.cellX;
            const dy = cell.cellY - prev.cellY;
            // If the wrapped prev cell is identical (common when a closed path repeats the start),
            // fall back to the provided incoming direction so corners resolve correctly.
            if (dx === 0 && dy === 0) return incomingDir;
            return dirFromDelta(dx, dy);
          })()
        : incomingDir;
      const dirOut = next
        ? dirFromDelta(next.cellX - cell.cellX, next.cellY - cell.cellY)
        : undefined;
      const isCorner =
        !isEndpoint &&
        typeof dirIn !== "undefined" &&
        typeof dirOut !== "undefined" &&
        dirIn !== dirOut;

      let pool: string[];
      if (isEndpoint && endpointTiles.length > 0) {
        pool = endpointTiles;
      } else if (isCorner && cornerTiles.length > 0) {
        pool = cornerTiles;
      } else {
        pool = bodyTiles;
      }

      const rand = seededRand(`${mapSeed}:${seedKey}`, cell.cellX, cell.cellY);
      const src = pool[Math.floor(rand(idx) * pool.length)];

      let rotationIndex: number;
      if (isEndpoint && endpointTiles.length > 0) {
        // Flip endpoint facing: start/end face outward relative to the line.
        rotationIndex =
          idx === 0
            ? (baseRotationIndex + 2) % RIGHT_ANGLE_ROTATIONS.length
            : baseRotationIndex;
      } else if (
        isCorner &&
        cornerTiles.length > 0 &&
        typeof dirIn !== "undefined" &&
        typeof dirOut !== "undefined"
      ) {
        // Orient corners based on turn direction.
        // We treat rotationIndex 0 as facing RIGHT, 1 DOWN, 2 LEFT, 3 UP.
        // Starting from dirOut, we nudge by +/-90° so the �inside� of the
        // corner lines up with the corridor.
        const delta = (dirOut - dirIn + 4) % 4; // 1: CW, 3: CCW
        if (delta === 1) {
          // Clockwise turn (e.g. going up->right or right->down):
          // rotate 90° CW relative to dirOut.
          rotationIndex = dirOut;
        } else if (delta === 3) {
          // Counter‑clockwise turn (e.g. right->up or down->right):
          // rotate 90° CCW relative to dirOut.
          rotationIndex =
            (dirOut + RIGHT_ANGLE_ROTATIONS.length - 1) %
            RIGHT_ANGLE_ROTATIONS.length;
        } else {
          rotationIndex = dirOut;
        }
      } else {
        // Body segments: keep the existing random 0/180 flip along the line and align to the segment direction.
        const add180 = rand(idx + 1) > 0.5 ? 2 : 0;
        const straightDir =
          typeof dirOut !== "undefined"
            ? dirOut
            : typeof dirIn !== "undefined"
            ? dirIn
            : baseRotationIndex;
        rotationIndex = (straightDir + add180) % RIGHT_ANGLE_ROTATIONS.length;
      }

      // For closed shapes the first cell is re-used at the end; rely on the turn-based orientation above.
      return {
        id: `${cell.cellX},${cell.cellY}:${Date.now()}:${idx}`,
        cellX: cell.cellX,
        cellY: cell.cellY,
        src,
        rotationIndex,
        strokeId,
        layer,
        order: getNextOrder(layer) + idx,
        layerId: targetLayerId,
      };
    });
    const toPlace = toPlaceRaw.filter((_, idx) => {
      if (skipFirstCell && idx === 0) return false;
      if (skipLastCell && idx === toPlaceRaw.length - 1) return false;
      return true;
    });
    let nextTiles: typeof placedTiles | null = null;
    if (!commit) {
      return toPlace;
    }

    setPlacedTiles((prev) => {
      const filtered = appendToStroke
        ? prev
        : prev.filter((t) => {
            if (isTileLocked(t)) return true;
            if (strokeId && t.strokeId === strokeId) return false;
            return true;
          });
      const shouldClearOverlaps =
        clearLayers.length > 0 &&
        toPlace.some((t) => clearLayers.includes(t.layer));
      const cleared = shouldClearOverlaps
        ? removeOverlappingTiles(filtered, toPlace, clearLayers)
        : filtered;
      nextTiles = [...cleared, ...toPlace];
      return nextTiles;
    });
    if (recordHistory && nextTiles) {
      pushHistory(nextTiles);
    }
    return nextTiles;
  };

  const rotateSelectedTile = (delta: number) => {
    if (selectedPlacedTileIds.size === 0) return;
    const selection = new Set(selectedPlacedTileIds);
    const selectedTiles = placedTiles.filter((t) => selection.has(t.id));

    // Free rotation mode: rotate around each tile's image center in 30° increments without snapping to grid.
    if (!snapEnabled) {
      setPlacedTiles((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (!selection.has(t.id)) return t;
          if (isTileLocked(t)) return t;
          changed = true;
          const currentAngle =
            typeof t.rotationRadians === "number"
              ? t.rotationRadians
              : RIGHT_ANGLE_ROTATIONS[t.rotationIndex] ?? 0;
          const targetAngle = currentAngle + delta * FREE_ROTATION_STEP;
          const snappedAngle =
            Math.round(targetAngle / FREE_ROTATION_STEP) * FREE_ROTATION_STEP;
          return {
            ...t,
            rotationRadians: snappedAngle,
            // Keep center and cell coordinates unchanged in free mode.
          };
        });
        if (changed) {
          pushHistory(next);
        }
        return next;
      });
      return;
    }

    const selectionKey = Array.from(selection).sort().join(",");
    const groupPivot =
      selectionPivotRef.current?.key === selectionKey
        ? selectionPivotRef.current.pivot
        : computeGroupPivot(selectedTiles);
    if (groupPivot && selectionKey) {
      selectionPivotRef.current = { key: selectionKey, pivot: groupPivot };
    }
    const steps =
      ((delta % RIGHT_ANGLE_ROTATIONS.length) + RIGHT_ANGLE_ROTATIONS.length) %
      RIGHT_ANGLE_ROTATIONS.length;
    const orientationDelta =
      selectedTiles.length > 1
        ? (((delta + 2) % RIGHT_ANGLE_ROTATIONS.length) +
            RIGHT_ANGLE_ROTATIONS.length) %
          RIGHT_ANGLE_ROTATIONS.length
        : delta;
    setPlacedTiles((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (!selection.has(t.id)) return t;
        if (isTileLocked(t)) return t;
        changed = true;
        const baseSpan = getTileSpanFromName(t.src);
        const currentFootprint =
          t.rotationIndex % 2 === 0
            ? { w: baseSpan.w, h: baseSpan.h }
            : { w: baseSpan.h, h: baseSpan.w };
        const currentCenter =
          typeof t.centerX === "number" && typeof t.centerY === "number"
            ? { centerX: t.centerX, centerY: t.centerY }
            : topLeftAndSpanToCenter(
                { cellX: t.cellX, cellY: t.cellY },
                currentFootprint
              );
        const pivot = groupPivot ?? currentCenter;
        const offset = {
          x: currentCenter.centerX - pivot.centerX,
          y: currentCenter.centerY - pivot.centerY,
        };
        const rotatedOffset = (() => {
          switch (steps) {
            case 1:
              return { x: offset.y, y: -offset.x };
            case 2:
              return { x: -offset.x, y: -offset.y };
            case 3:
              return { x: -offset.y, y: offset.x };
            default:
              return offset;
          }
        })();
        const rotatedCenter = {
          centerX: pivot.centerX + rotatedOffset.x,
          centerY: pivot.centerY + rotatedOffset.y,
        };
        const snappedCenter = {
          centerX: snapToCellCenter(rotatedCenter.centerX),
          centerY: snapToCellCenter(rotatedCenter.centerY),
        };
        const nextRotation =
          (t.rotationIndex + orientationDelta + RIGHT_ANGLE_ROTATIONS.length) %
          RIGHT_ANGLE_ROTATIONS.length;
        const nextFootprint =
          nextRotation % 2 === 0
            ? { w: baseSpan.w, h: baseSpan.h }
            : { w: baseSpan.h, h: baseSpan.w };
        const nextTopLeft = centerAndSpanToTopLeft(
          snappedCenter,
          nextFootprint
        );
        return {
          ...t,
          rotationIndex: nextRotation,
          cellX: nextTopLeft.cellX,
          cellY: nextTopLeft.cellY,
          centerX: snappedCenter.centerX,
          centerY: snappedCenter.centerY,
        };
      });
      if (changed) {
        pushHistory(next);
      }
      return next;
    });
  };

  const nudgeSelectedTiles = (dx: number, dy: number) => {
    if (selectedPlacedTileIds.size === 0) return;
    const selection = new Set(selectedPlacedTileIds);
    setPlacedTiles((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (!selection.has(t.id)) return t;
        changed = true;
        const fp = getTileFootprint(t);
        const baseCenter = (() => {
          if (!snapEnabled) return fp.center;
          const worldX = GRID_ORIGIN + fp.center.centerX * CELL_SIZE;
          const worldY = GRID_ORIGIN + fp.center.centerY * CELL_SIZE;
          return snapWorldToCenter(
            worldX,
            worldY,
            fp.footprint,
            GRID_ORIGIN,
            CELL_SIZE
          );
        })();
        const baseTopLeft = centerAndSpanToTopLeft(baseCenter, fp.footprint);
        const nextTopLeft = {
          cellX: baseTopLeft.cellX + dx,
          cellY: baseTopLeft.cellY + dy,
        };
        const nextCenter = topLeftAndSpanToCenter(nextTopLeft, fp.footprint);
        return {
          ...t,
          cellX: nextTopLeft.cellX,
          cellY: nextTopLeft.cellY,
          centerX: nextCenter.centerX,
          centerY: nextCenter.centerY,
        };
      });
      if (changed) {
        pushHistory(next);
      }
      return next;
    });
    selectionPivotRef.current = null;
  };

  const mirrorSelectedTiles = (axis: "x" | "y") => {
    if (selectedPlacedTileIds.size === 0) return;
    const selection = new Set(selectedPlacedTileIds);
    const selectedTiles = placedTiles.filter((t) => selection.has(t.id));
    const groupPivot = (() => {
      if (selectedTiles.length <= 1) return null;
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      selectedTiles.forEach((t) => {
        const fp = getTileFootprint(t);
        const left = fp.center.centerX - fp.footprint.w / 2;
        const top = fp.center.centerY - fp.footprint.h / 2;
        const right = fp.center.centerX + fp.footprint.w / 2;
        const bottom = fp.center.centerY + fp.footprint.h / 2;
        minX = Math.min(minX, left);
        minY = Math.min(minY, top);
        maxX = Math.max(maxX, right);
        maxY = Math.max(maxY, bottom);
      });
      const rawCenter = {
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
      };
      return {
        centerX: snapToCellCenter(rawCenter.centerX),
        centerY: snapToCellCenter(rawCenter.centerY),
      };
    })();
    setPlacedTiles((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (!selection.has(t.id)) return t;
        if (isTileLocked(t)) return t;
        changed = true;
        const baseSpan = getTileSpanFromName(t.src);
        const footprint =
          t.rotationIndex % 2 === 0
            ? { w: baseSpan.w, h: baseSpan.h }
            : { w: baseSpan.h, h: baseSpan.w };
        const center =
          typeof t.centerX === "number" && typeof t.centerY === "number"
            ? { centerX: t.centerX, centerY: t.centerY }
            : topLeftAndSpanToCenter(
                { cellX: t.cellX, cellY: t.cellY },
                footprint
              );
        const pivot = groupPivot ?? center;
        const reflectedCenter =
          axis === "x"
            ? {
                centerX: pivot.centerX - (center.centerX - pivot.centerX),
                centerY: center.centerY,
              }
            : {
                centerX: center.centerX,
                centerY: pivot.centerY - (center.centerY - pivot.centerY),
              };
        const snappedCenter = {
          centerX: snapToCellCenter(reflectedCenter.centerX),
          centerY: snapToCellCenter(reflectedCenter.centerY),
        };
        // Keep tile rotation as-is; flip the artwork along the appropriate local axis derived from world mirror axis.
        const nextRotation = t.rotationIndex;
        const toggleLocalMirrors = (() => {
          const mod =
            ((t.rotationIndex % RIGHT_ANGLE_ROTATIONS.length) +
              RIGHT_ANGLE_ROTATIONS.length) %
            RIGHT_ANGLE_ROTATIONS.length;
          if (axis === "x") {
            // World vertical axis: in local space, x when upright/180, y when 90/270.
            const flipX = mod === 0 || mod === 2;
            return {
              mirrorX: flipX ? !t.mirrorX : t.mirrorX,
              mirrorY: flipX ? t.mirrorY : !t.mirrorY,
            };
          }
          // axis === "y"
          const flipY = mod === 0 || mod === 2;
          return {
            mirrorX: flipY ? t.mirrorX : !t.mirrorX,
            mirrorY: flipY ? !t.mirrorY : t.mirrorY,
          };
        })();
        const nextFootprint =
          nextRotation % 2 === 0
            ? { w: baseSpan.w, h: baseSpan.h }
            : { w: baseSpan.h, h: baseSpan.w };
        const nextTopLeft = centerAndSpanToTopLeft(
          snappedCenter,
          nextFootprint
        );
        return {
          ...t,
          rotationIndex: nextRotation,
          mirrorX: toggleLocalMirrors.mirrorX,
          mirrorY: toggleLocalMirrors.mirrorY,
          cellX: nextTopLeft.cellX,
          cellY: nextTopLeft.cellY,
          centerX: snappedCenter.centerX,
          centerY: snappedCenter.centerY,
        };
      });
      if (changed) {
        pushHistory(next);
      }
      return next;
    });
    selectionPivotRef.current = null;
  };

  const nudgeTileOrder = (direction: 1 | -1) => {
    if (!selectedPlacedTile) return;
    setPlacedTiles((prev) => {
      const sameLayer = prev
        .filter((t) => t.layer === selectedPlacedTile.layer)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const idx = sameLayer.findIndex((t) => t.id === selectedPlacedTile.id);
      const targetIdx = idx + direction;
      if (idx === -1 || targetIdx < 0 || targetIdx >= sameLayer.length)
        return prev;
      const swapWith = sameLayer[targetIdx];
      const next = prev.map((t) => {
        if (t.id === selectedPlacedTile.id)
          return { ...t, order: swapWith.order ?? 0 };
        if (t.id === swapWith.id)
          return { ...t, order: selectedPlacedTile.order ?? 0 };
        return t;
      });
      pushHistory(next);
      return next;
    });
  };

  const handleCanvasMouseUp: React.MouseEventHandler<
    HTMLCanvasElement
  > = () => {
    const wasTileStroke = tileStroke.current.active;
    const draggedTileIds = dragState.current?.tileIds;
    const dragStartPositions = dragState.current?.startPositions;
    dragState.current = null;
    skipPanRef.current = false;
    setHoverId(null);

    if (
      selectionBox.active &&
      selectionBox.start &&
      selectionBox.end &&
      activeTool === "select"
    ) {
      const minX = Math.min(selectionBox.start.cellX, selectionBox.end.cellX);
      const maxX = Math.max(selectionBox.start.cellX, selectionBox.end.cellX);
      const minY = Math.min(selectionBox.start.cellY, selectionBox.end.cellY);
      const maxY = Math.max(selectionBox.start.cellY, selectionBox.end.cellY);
      const hits = placedTiles
        .filter((t) => isTileVisible(t))
        .filter((t) => !isTileLocked(t))
        .filter((t) => {
          const fp = getTileFootprint(t);
          const tileMaxX = fp.topLeft.cellX + fp.footprint.w - 1;
          const tileMaxY = fp.topLeft.cellY + fp.footprint.h - 1;
          const overlapsX = !(tileMaxX < minX || fp.topLeft.cellX > maxX);
          const overlapsY = !(tileMaxY < minY || fp.topLeft.cellY > maxY);
          return overlapsX && overlapsY;
        })
        .map((t) => t.id);
      const nextSelection =
        selectionBox.mode === "toggle"
          ? (() => {
              const base = new Set(selectedPlacedTileIds);
              hits.forEach((id) => {
                if (base.has(id)) base.delete(id);
                else base.add(id);
              });
              return base;
            })()
          : new Set(hits);
      setSelectedPlacedTileIds(nextSelection);
    }
    setSelectionBox({ active: false });

    if (tileStroke.current.active) {
      tileStroke.current.active = false;
      tileStroke.current.visited.clear();
    }
    if (roomDrag.active && roomDrag.start && roomDrag.end) {
      if (activeTool === "fog") {
        const minX = Math.min(roomDrag.start.cellX, roomDrag.end.cellX);
        const maxX = Math.max(roomDrag.start.cellX, roomDrag.end.cellX);
        const minY = Math.min(roomDrag.start.cellY, roomDrag.end.cellY);
        const maxY = Math.max(roomDrag.start.cellY, roomDrag.end.cellY);
        const rectCells: string[] = [];
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            rectCells.push(`${x},${y}`);
          }
        }
        setFogVisibleCells((prev) => {
          const next = new Set(prev);
          if (fogMode === "set") {
            const fresh = new Set<string>();
            rectCells.forEach((key) => fresh.add(key));
            return fresh;
          }
          if (fogMode === "add") {
            // Add fog: remove visibility in the selection.
            rectCells.forEach((key) => next.delete(key));
            return next;
          }
          // subtract: remove fog -> add visibility in selection.
          rectCells.forEach((key) => next.add(key));
          return next;
        });
      } else {
        placeRectangle(
          roomDrag.start,
          roomDrag.end,
          roomDrag.strokeId,
          roomDrag.mode ?? "fill",
          true
        );
      }
    }
    if (lineDrag.active && lineDrag.start && lineDrag.end) {
      placeLine(lineDrag.start, lineDrag.end, lineDrag.strokeId, true);
    }
    if (eraseDrag.active && eraseDrag.start && eraseDrag.end) {
      const minX = Math.min(eraseDrag.start.cellX, eraseDrag.end.cellX);
      const maxX = Math.max(eraseDrag.start.cellX, eraseDrag.end.cellX);
      const minY = Math.min(eraseDrag.start.cellY, eraseDrag.end.cellY);
      const maxY = Math.max(eraseDrag.start.cellY, eraseDrag.end.cellY);
      setPlacedTiles((prev) => {
        const next = prev.filter((t) => {
          if (isTileLocked(t)) return true;
          return (
            t.cellX < minX || t.cellX > maxX || t.cellY < minY || t.cellY > maxY
          );
        });
        pushHistory(next);
        return next;
      });
    }
    if (draggedTileIds && dragStartPositions && draggedTileIds.length > 0) {
      const moved = draggedTileIds.some((id) => {
        const start = dragStartPositions.get(id);
        const tile = placedTiles.find((t) => t.id === id);
        if (!start || !tile) return false;
        const current = getTileFootprint(tile);
        return (
          current.topLeft.cellX !== start.topLeft.cellX ||
          current.topLeft.cellY !== start.topLeft.cellY
        );
      });
      if (moved) {
        pushHistory();
      }
    }
    setRoomDrag({ active: false });
    setLineDrag({ active: false });
    setEraseDrag({ active: false });
    if (wasTileStroke) {
      pushHistory();
    }
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDragPreviewTile(null);
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldX = (cx - camera.panX) / camera.zoom;
    const worldY = (cy - camera.panY) / camera.zoom;
    const tileData =
      e.dataTransfer.getData("application/battlemap-tile") ||
      e.dataTransfer.getData("text/plain");
    const src =
      (tileData &&
        (() => {
          try {
            const payload = JSON.parse(tileData) as { src: string };
            return payload.src;
          } catch {
            return null;
          }
        })()) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__battlemapDraggingTileSrc ||
      null;
    if (src) {
      try {
        const placement = resolvePlacementLayerForSrc(src, {
          ignoreBrush: true,
        });
        if (!placement) {
          setPlacementWarning("Select a layer before painting.");
          return;
        }
        setPlacementWarning(null);
        const { layer, targetLayerId } = placement;
        if (isLayerLocked(targetLayerId, layer)) return;
        const newId = `tile-${Date.now()}`;
        const order = getNextOrder(layer, targetLayerId);
        const span = getTileSizeCells(src);
        const mirrorX = shouldMirrorTileOnDrop(src);
        const center = snapEnabled
          ? snapWorldToCenter(worldX, worldY, span, GRID_ORIGIN, CELL_SIZE)
          : {
              centerX: (worldX - GRID_ORIGIN) / CELL_SIZE,
              centerY: (worldY - GRID_ORIGIN) / CELL_SIZE,
            };
        const { cellX, cellY } = centerAndSpanToTopLeft(center, span);
        setPlacedTiles((prev) => {
          const next = [
            ...prev,
            {
              id: newId,
              cellX,
              cellY,
              src,
              rotationIndex: 0,
              mirrorX,
              layer,
              order,
              layerId: targetLayerId,
              centerX: center.centerX,
              centerY: center.centerY,
            },
          ];
          pushHistory(next);
          return next;
        });
      } catch {
        // ignore invalid payload
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__battlemapDraggingTileSrc;
      return;
    }

    const data = e.dataTransfer.getData("application/battlemap-token");
    if (!data) return;
    let payload: {
      label: string;
      assetId: BattlemapTokenId;
      width?: number;
      height?: number;
    } | null = null;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    const newId = `token-${Date.now()}`;
    const tokenSpan = { w: payload?.width ?? 1, h: payload?.height ?? 1 };
    const tokenCenter = snapWorldToCenter(
      worldX,
      worldY,
      tokenSpan,
      GRID_ORIGIN,
      CELL_SIZE
    );
    const { cellX, cellY } = centerAndSpanToTopLeft(tokenCenter, tokenSpan);
    setTokens((prev) => [
      ...prev,
      {
        id: newId,
        label: payload?.label ?? "Token",
        assetId: payload?.assetId ?? "base.npc",
        cellX,
        cellY,
        width: payload?.width,
        height: payload?.height,
        ownerId: currentUserId,
      },
    ]);
    setSelectedId(newId);
  };

  const navToolButtons = [
    {
      key: "select",
      label: "Select",
      icon: selectIcon.src,
      active: activeTool === "select",
      onClick: () => setActiveTool("select"),
    },
    {
      key: "pan",
      label: "Pan",
      icon: panIcon.src,
      active: activeTool === "pan",
      onClick: () => setActiveTool("pan"),
    },
    {
      key: "rotate-left",
      label: "Rotate selection -90° (R-)",
      glyph: "⟲",
      active: false,
      onClick: () => rotateSelectedTile(-1),
    },
    {
      key: "rotate-right",
      label: "Rotate selection +90° (R)",
      glyph: "⟳",
      active: false,
      onClick: () => rotateSelectedTile(1),
    },
    {
      key: "mirror-h",
      label: "Mirror horizontally (H)",
      glyph: "⇋",
      active: false,
      onClick: () => mirrorSelectedTiles("x"),
    },
    {
      key: "mirror-v",
      label: "Mirror vertically (V)",
      glyph: "⇵",
      active: false,
      onClick: () => mirrorSelectedTiles("y"),
    },
  ];

  const toolButtons = [
    {
      key: "room",
      label: "Rectangle",
      icon: roomIcon.src,
      active: activeTool === "room",
      onClick: () => setActiveTool("room"),
    },
    {
      key: "border",
      label: "Border",
      icon: borderIcon.src,
      active: activeTool === "border",
      onClick: () => setActiveTool("border"),
    },
    {
      key: "polygon",
      label: "Polygon",
      icon: areaIcon.src,
      active: activeTool === "polygon",
      onClick: () => setActiveTool("polygon"),
    },
    {
      key: "area",
      label: "Line",
      icon: areaIcon.src,
      active: activeTool === "area",
      onClick: () => setActiveTool("area"),
    },
    {
      key: "gradient",
      label: "Gradient",
      icon: gradientIcon.src,
      active: activeTool === "gradient",
      onClick: () => setActiveTool("gradient"),
    },
    {
      key: "freehand",
      label: "Tile brush",
      icon: brushIcon.src,
      active: activeTool === "tile",
      onClick: () => setActiveTool("tile"),
    },
    {
      key: "erase",
      label: "Erase",
      icon: eraseIcon.src,
      active: activeTool === "erase",
      onClick: () => setActiveTool("erase"),
    },
    {
      key: "fog",
      label: "Fog of war",
      icon: fogIcon.src,
      active: activeTool === "fog",
      onClick: () => setActiveTool("fog"),
    },
  ];

  return (
    <div style={styles.shell} ref={shellRef}>
      <div style={styles.toolbar}>
        <div style={{ ...styles.toolbarLeft, position: "relative" }}>
          <input
            type="text"
            value={
              maps.find((m) => m.id === selectedMapId)?.name ?? "Untitled map"
            }
            onChange={(e) => {
              const next = e.target.value;
              if (!selectedMapId) return;
              onRenameMap(selectedMapId, next);
            }}
            style={{ ...styles.nameInput }}
            placeholder="Map name"
          />
          <button
            type="button"
            style={styles.iconButton}
            onClick={() => setMapPickerOpen((v) => !v)}
          >
            v
          </button>
          {mapPickerOpen ? (
            <div style={styles.mapPopover}>
              {maps.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  style={{
                    ...styles.menuItem,
                    ...(m.id === selectedMapId ? styles.menuItemActive : {}),
                  }}
                  onClick={() => {
                    onSelectMap(m.id);
                    setMapPickerOpen(false);
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={onCreateMap}
          >
            New Map
          </button>
        </div>
        <div style={styles.toolbarRight}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => loadMapState(selectedMapId)}
            >
              Edit
            </button>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={saveMapState}
            >
              Save
            </button>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                style={{
                  ...styles.secondaryButton,
                  paddingInline: 6,
                  borderRadius: 999,
                  opacity: gridVisibleEffective ? 1 : 0.4,
                }}
                onClick={onToggleGrid}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTopbarControl({
                    label: gridVisibleEffective ? "Hide grid" : "Show grid",
                    x: rect.left + rect.width / 2,
                    y: rect.bottom + 6,
                  });
                }}
                onMouseLeave={() => setHoveredTopbarControl(null)}
              >
                {/* grid icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <path d="M9 3v18" />
                  <path d="M15 3v18" />
                  <path d="M3 9h18" />
                  <path d="M3 15h18" />
                </svg>
              </button>
              <button
                type="button"
                style={{
                  ...styles.secondaryButton,
                  paddingInline: 6,
                  borderRadius: 999,
                  opacity: tokensVisibleEffective ? 1 : 0.4,
                }}
                onClick={onToggleTokensLayer}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTopbarControl({
                    label: tokensVisibleEffective
                      ? "Hide tokens"
                      : "Show tokens",
                    x: rect.left + rect.width / 2,
                    y: rect.bottom + 6,
                  });
                }}
                onMouseLeave={() => setHoveredTopbarControl(null)}
              >
                {/* tokens icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20a8 8 0 0 1 16 0" />
                </svg>
              </button>
              <button
                type="button"
                style={{
                  ...styles.secondaryButton,
                  paddingInline: 6,
                  borderRadius: 999,
                  opacity: fogVisibleEffective ? 1 : 0.4,
                }}
                onClick={onToggleFogLayer}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTopbarControl({
                    label: fogVisibleEffective ? "Hide fog" : "Show fog",
                    x: rect.left + rect.width / 2,
                    y: rect.bottom + 6,
                  });
                }}
                onMouseLeave={() => setHoveredTopbarControl(null)}
              >
                {/* fog icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 15h12" />
                  <path d="M5 19h14" />
                  <path d="M7 11h10" />
                  <path d="M5 7h6" />
                </svg>
              </button>
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setMapSettingsOpen((v) => !v)}
            >
              Settings
            </button>
            {mapSettingsOpen ? (
              <div style={styles.mapSettingsPopover}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Map size (cells)
                </div>
                <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      fontSize: 11,
                    }}
                  >
                    <span>Width</span>
                    <input
                      type="number"
                      min={1}
                      max={400}
                      value={mapSize.w}
                      onChange={(e) =>
                        setMapSize((prev) => ({
                          ...prev,
                          w: Math.max(
                            1,
                            Math.min(400, Number(e.target.value) || 1)
                          ),
                        }))
                      }
                      style={styles.mapSettingsInput}
                    />
                  </label>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      fontSize: 11,
                    }}
                  >
                    <span>Height</span>
                    <input
                      type="number"
                      min={1}
                      max={400}
                      value={mapSize.h}
                      onChange={(e) =>
                        setMapSize((prev) => ({
                          ...prev,
                          h: Math.max(
                            1,
                            Math.min(400, Number(e.target.value) || 1)
                          ),
                        }))
                      }
                      style={styles.mapSettingsInput}
                    />
                  </label>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 6,
                  }}
                >
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => setMapSettingsOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {hoveredTopbarControl ? (
        <div
          className="app-overlay-content"
          style={{
            left: hoveredTopbarControl.x,
            top: hoveredTopbarControl.y,
            transform: "translateX(-50%)",
            background: "#1f2937",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: 6,
            fontSize: 12,
            whiteSpace: "nowrap",
            boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
            pointerEvents: "none",
          }}
        >
          {hoveredTopbarControl.label}
        </div>
      ) : null}

      <div
        style={{
          ...styles.canvas,
          cursor: (() => {
            if (spacePanning) return `url(${panCursor}) 6 6, grab`;
            if (dragState.current || panState.current) return "grabbing";
            if (hoverId) return "pointer";
            if (activeTool === "tile")
              return `url(${brushCursor}) 4 4, crosshair`;
            if (activeTool === "room")
              return `url(${roomIcon.src}) 12 12, crosshair`;
            if (activeTool === "area")
              return `url(${areaIcon.src}) 12 12, crosshair`;
            if (activeTool === "gradient")
              return `url(${gradientIcon.src}) 12 12, crosshair`;
            if (activeTool === "measure")
              return `url(${measureIcon.src}) 12 12, crosshair`;
            if (activeTool === "fog")
              return `url(${fogIcon.src}) 12 12, crosshair`;
            if (activeTool === "pan") return `url(${panCursor}) 6 6, grab`;
            return `url(${selectCursor}) 2 2, default`;
          })(),
        }}
        onWheel={handleWheel}
        onMouseDown={startPan}
        onMouseMove={handlePan}
        onMouseUp={stopPan}
        onMouseLeave={() => {
          stopPan();
          dragState.current = null;
          setSnapProbe(null);
          setPolygonHover(null);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          const padding = 160;
          const maxX = rect.width - padding;
          const maxY = rect.height - 120;
          setContextMenu({
            open: true,
            x: Math.max(0, Math.min(cx, maxX)),
            y: Math.max(0, Math.min(cy, maxY)),
          });
          stopPan();
          dragState.current = null;
        }}
        onDragOver={(e) => {
          e.preventDefault();
          handleDragPreview(e.clientX, e.clientY, e.dataTransfer);
        }}
        onDragLeave={() => setDragPreviewTile(null)}
        onDrop={handleDrop}
      >
        {activeTool === "fog" ? (
          <div style={styles.fogModeToolbar}>
            {(["set", "add", "subtract"] as const).map((mode) => {
              const isActive = fogMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  style={{
                    ...styles.fogModeButton,
                    ...(isActive ? styles.fogModeButtonActive : {}),
                  }}
                  onClick={() => setFogMode(mode)}
                  title={
                    mode === "set"
                      ? "Replace visible area"
                      : mode === "add"
                      ? "Add fog"
                      : "Remove fog"
                  }
                >
                  {mode === "set" ? "R" : mode === "add" ? "+" : "-"}
                </button>
              );
            })}
            <button
              type="button"
              style={styles.fogClearButton}
              onClick={() => setFogVisibleCells(new Set())}
              title="Clear fog of war"
            >
              ×
            </button>
          </div>
        ) : null}
        <div style={styles.leftToolbar}>
          {navToolButtons.map((btn, index) => (
            <button
              key={btn.key}
              type="button"
              title={btn.label}
              style={{
                ...styles.iconOnlyButton,
                ...(btn.active ? styles.iconOnlyButtonActive : {}),
              }}
              className={`battlemap-icon-button ${
                btn.active ? "is-active" : ""
              }`}
              onClick={btn.onClick}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                e.currentTarget.blur();
              }}
              onFocus={(e) => e.currentTarget.blur()}
              onMouseEnter={() =>
                setHoveredNavTool({ label: btn.label, index })
              }
              onMouseLeave={() => setHoveredNavTool(null)}
            >
              {btn.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={btn.icon} alt={btn.label} style={styles.iconImg} />
              ) : (
                <span style={styles.iconGlyph}>{btn.glyph ?? "•"}</span>
              )}
            </button>
          ))}
          {hoveredNavTool ? (
            <div
              style={{
                position: "absolute",
                top: 8 + hoveredNavTool.index * 44,
                left: 44,
                background: "#1f2937",
                color: "#fff",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 12,
                whiteSpace: "nowrap",
                boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
                pointerEvents: "none",
              }}
            >
              {hoveredNavTool.label}
            </div>
          ) : null}
        </div>
        <div style={styles.floatingToolbar}>
          {toolButtons.map((btn, index) => (
            <button
              key={btn.key}
              type="button"
              title={btn.label}
              style={{
                ...styles.iconOnlyButton,
                ...(btn.active ? styles.iconOnlyButtonActive : {}),
              }}
              className={`battlemap-icon-button ${
                btn.active ? "is-active" : ""
              }`}
              onClick={btn.onClick}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                e.currentTarget.blur();
              }}
              onFocus={(e) => e.currentTarget.blur()}
              onMouseEnter={() => setHoveredTool({ label: btn.label, index })}
              onMouseLeave={() => setHoveredTool(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={btn.icon} alt={btn.label} style={styles.iconImg} />
            </button>
          ))}
          {hoveredTool ? (
            <div
              style={{
                position: "absolute",
                top: 8 + hoveredTool.index * 44,
                right: 44,
                background: "#1f2937",
                color: "#fff",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 12,
                whiteSpace: "nowrap",
                boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
                pointerEvents: "none",
              }}
            >
              {hoveredTool.label}
            </div>
          ) : null}
        </div>
        <div style={styles.bottomToolbar}>
          <button
            type="button"
            title={snapEnabled ? "Disable snap to grid" : "Enable snap to grid"}
            style={{
              ...styles.iconOnlyButton,
              ...(snapEnabled ? styles.iconOnlyButtonActive : {}),
            }}
            className={`battlemap-icon-button ${
              snapEnabled ? "is-active" : ""
            }`}
            onClick={() => setSnapEnabled((prev) => !prev)}
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              e.currentTarget.blur();
            }}
            onFocus={(e) => e.currentTarget.blur()}
          >
            <span style={styles.iconGlyph}>{snapEnabled ? "SN" : "FR"}</span>
          </button>
        </div>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%" }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={() => {
            setHoverId(null);
            setSnapProbe(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            handleDragPreview(e.clientX, e.clientY, e.dataTransfer);
          }}
          onDragLeave={() => setDragPreviewTile(null)}
          onDoubleClick={(e) => {
            if (activeTool === "measure") {
              setMeasure((prev) => ({
                ...prev,
                active: false,
                floating: null,
              }));
              setActiveTool("select");
            } else if (
              activeTool === "polygon" &&
              polygonPath.active &&
              polygonPath.points.length >= 3
            ) {
              const rect = canvasRef.current?.getBoundingClientRect();
              let currentCell = lastMouseCellRef.current;
              if (rect) {
                const cx = e.clientX - rect.left;
                const cy = e.clientY - rect.top;
                const worldX = (cx - camera.panX) / camera.zoom;
                const worldY = (cy - camera.panY) / camera.zoom;
                const cellX = Math.floor((worldX - GRID_ORIGIN) / CELL_SIZE);
                const cellY = Math.floor((worldY - GRID_ORIGIN) / CELL_SIZE);
                currentCell = { cellX, cellY };
              }
              const pts = (() => {
                if (!currentCell) return polygonPath.points;
                const lastPt =
                  polygonPath.points[polygonPath.points.length - 1];
                if (
                  lastPt &&
                  lastPt.cellX === currentCell.cellX &&
                  lastPt.cellY === currentCell.cellY
                ) {
                  return polygonPath.points;
                }
                return [...polygonPath.points, currentCell];
              })();
              const strokeId = polygonPath.strokeId ?? `poly-${Date.now()}`;
              placePolyline({
                points: pts,
                strokeId,
                recordHistory: true,
                appendToStroke: false,
                commit: true,
                closed: true,
              });
              setPolygonPath({
                active: false,
                points: [],
                strokeId: undefined,
              });
              setPolygonHover(null);
              forceRender();
            }
          }}
        />
        {placementWarning ? (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "6px 10px",
              borderRadius: 8,
              background: "rgba(31,41,55,0.9)",
              color: "#fff",
              fontSize: 12,
              boxShadow: "0 6px 12px rgba(0,0,0,0.24)",
              pointerEvents: "none",
              zIndex: 20,
              opacity: placementWarningActive ? 1 : 0,
              transition: "opacity 0.5s ease",
            }}
          >
            {placementWarning}
          </div>
        ) : null}
        {selectionBox.active &&
        selectionBox.start &&
        selectionBox.end &&
        activeTool === "select"
          ? (() => {
              const minX = Math.min(
                selectionBox.start.cellX,
                selectionBox.end.cellX
              );
              const maxX = Math.max(
                selectionBox.start.cellX,
                selectionBox.end.cellX
              );
              const minY = Math.min(
                selectionBox.start.cellY,
                selectionBox.end.cellY
              );
              const maxY = Math.max(
                selectionBox.start.cellY,
                selectionBox.end.cellY
              );
              const worldLeft = GRID_ORIGIN + minX * CELL_SIZE;
              const worldTop = GRID_ORIGIN + minY * CELL_SIZE;
              const { x: screenLeft, y: screenTop } = worldToScreen(
                worldLeft,
                worldTop
              );
              const width = (maxX - minX + 1) * CELL_SIZE * camera.zoom;
              const height = (maxY - minY + 1) * CELL_SIZE * camera.zoom;
              return (
                <div
                  style={{
                    position: "absolute",
                    left: screenLeft,
                    top: screenTop,
                    width,
                    height,
                    border: "2px solid rgba(78,141,245,0.6)",
                    background: "rgba(78,141,245,0.12)",
                    pointerEvents: "none",
                    zIndex: 8,
                  }}
                />
              );
            })()
          : null}
        {false && selectedPlacedTile && selectedPlacedTileIds.size === 1
          ? (() => {
              const screenX =
                (GRID_ORIGIN + (selectedPlacedTile!.cellX + 0.5) * CELL_SIZE) *
                  camera.zoom +
                camera.panX;
              const screenY =
                (GRID_ORIGIN + (selectedPlacedTile!.cellY + 0.5) * CELL_SIZE) *
                  camera.zoom +
                camera.panY;
              const tileHalf = (CELL_SIZE * camera.zoom) / 2;
              const bottomY = screenY + tileHalf + 6; // just below the tile
              return (
                <div
                  className="battlemap-tile-toolbar"
                  style={{
                    position: "absolute",
                    left: `${screenX}px`,
                    top: `${bottomY}px`,
                    transform: "translate(-50%, 0)",
                    display: "flex",
                    gap: 8,
                    padding: "6px 8px",
                    background: "rgba(255,255,255,0.95)",
                    border: "1px solid #dfe6e9",
                    borderRadius: 8,
                    boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
                    alignItems: "center",
                    zIndex: 15,
                    pointerEvents: "auto",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#4b5563" }}>Tile</span>
                  <button
                    type="button"
                    style={styles.iconButton}
                    onClick={() => rotateSelectedTile(-1)}
                    title="Rotate -90°"
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    style={styles.iconButton}
                    onClick={() => rotateSelectedTile(1)}
                    title="Rotate +90°"
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    style={styles.iconButton}
                    onClick={() => nudgeTileOrder(-1)}
                    title="Send backward"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    style={styles.iconButton}
                    onClick={() => nudgeTileOrder(1)}
                    title="Bring forward"
                  >
                    Front
                  </button>
                </div>
              );
            })()
          : null}
        {contextMenu.open ? (
          <div
            style={{
              position: "absolute",
              top: contextMenu.y,
              left: contextMenu.x,
              background: "#fff",
              border: "1px solid #dfe6e9",
              borderRadius: 8,
              boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
              padding: "6px 0",
              zIndex: 10,
              minWidth: 180,
            }}
          >
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => {
                centerCameraOnOrigin(1);
                closeContextMenu();
              }}
            >
              Reset Zoom
            </button>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => {
                centerOnSelection();
                closeContextMenu();
              }}
            >
              Center on selection
            </button>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => {
                clearMeasure();
                closeContextMenu();
              }}
            >
              Clear measurement
            </button>
            <button
              type="button"
              style={styles.menuItem}
              onClick={closeContextMenu}
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    border: "1px solid #dfe6e9",
    borderRadius: 12,
    overflow: "hidden",
    background: "#f8f9fa",
    boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
    height: "100%",
    width: "100%",
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
    padding: "10px 12px",
    borderBottom: "1px solid #dfe6e9",
    background: "#ffffff",
    flexWrap: "wrap",
    rowGap: 6,
  },
  toolbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  nameInput: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #dfe6e9",
    background: "#fff",
    fontSize: 13,
    minWidth: 180,
  },
  tilesetSelect: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #dfe6e9",
    background: "#fff",
    fontSize: 13,
  },
  mapPopover: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    background: "#fff",
    border: "1px solid #dfe6e9",
    borderRadius: 8,
    boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
    minWidth: 200,
    zIndex: 20,
    overflow: "hidden",
  },
  menuItemActive: {
    background: "#e9f1ff",
  },
  toolbarButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #dfe6e9",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    flexShrink: 0,
  },
  toolbarButtonActive: {
    borderColor: "#4e8df5",
    background: "#e9f1ff",
  },
  secondaryButton: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #dfe6e9",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    flexShrink: 0,
  },
  iconButton: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #dfe6e9",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    flexShrink: 0,
    lineHeight: 1,
  },
  menuItem: {
    width: "100%",
    textAlign: "left",
    padding: "8px 12px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
  },
  floatingToolbar: {
    position: "absolute",
    top: 12,
    right: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "rgba(255,255,255,0.9)",
    padding: 8,
    borderRadius: 8,
    boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
    zIndex: 5,
  },
  bottomToolbar: {
    position: "absolute",
    bottom: 12,
    right: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "rgba(255,255,255,0.9)",
    padding: 8,
    borderRadius: 8,
    boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
    zIndex: 5,
  },
  leftToolbar: {
    position: "absolute",
    top: 12,
    left: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "rgba(255,255,255,0.9)",
    padding: 8,
    borderRadius: 8,
    boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
    zIndex: 5,
  },
  fogModeToolbar: {
    position: "absolute",
    top: 12,
    right: 72,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    background: "rgba(255,255,255,0.9)",
    padding: 6,
    borderRadius: 8,
    boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
    zIndex: 6,
  },
  fogModeButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: "1px solid #dfe6e9",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1,
    padding: 0,
  },
  fogModeButtonActive: {
    borderColor: "#4e8df5",
    background: "#e9f1ff",
  },
  fogClearButton: {
    marginTop: 2,
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "1px solid #dfe6e9",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    lineHeight: 1,
    padding: 0,
  },
  mapSettingsPopover: {
    position: "absolute",
    top: "calc(100% + 4px)",
    right: 0,
    background: "#ffffff",
    borderRadius: 8,
    border: "1px solid #dfe6e9",
    boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
    padding: 8,
    zIndex: 30,
    minWidth: 180,
  },
  mapSettingsInput: {
    marginTop: 2,
    padding: "4px 6px",
    borderRadius: 6,
    border: "1px solid #dfe6e9",
    fontSize: 12,
    width: 70,
  },
  iconOnlyButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "1px solid #dfe6e9",
    outline: "none",
    boxShadow: "none",
    appearance: "none",
    WebkitAppearance: "none",
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  iconOnlyButtonActive: {
    borderColor: "#4e8df5",
    background: "#e9f1ff",
  },
  iconImg: {
    width: 18,
    height: 18,
  },
  iconGlyph: {
    fontSize: 16,
    lineHeight: 1,
    fontWeight: 600,
  },
  canvas: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    backgroundColor: "transparent",
    position: "relative",
    overflow: "hidden",
  },
};

export default BattlemapCanvas;
