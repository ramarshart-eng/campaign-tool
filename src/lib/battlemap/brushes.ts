import fs from "fs";
import path from "path";

export type BrushToolType = "rectangle";

// Brush rotations describe how a tile *could* be oriented,
// but battlemap tools are responsible for deciding the actual
// rotation used at placement time (see BattlemapCanvas border logic).
// Keep this enum in degrees; the canvas converts to a tile-space
// rotation index when it needs to.
export type Rotation = 0 | 90 | 180 | 270;
export type Flip = "h" | "v";

export type TileSpec = {
  tileId: string;
  rotation?: Rotation;
  flip?: Flip;
  weight?: number;
};
export type EdgeSpec = TileSpec & { autoRotate?: boolean };

export type SnapSpec = { size: number; align: "cell" | "edge" };
export type RandomnessSpec = {
  seed?: string;
  jitter?: number;
  positionJitter?: number;
  sizeJitter?: number;
};
export type EdgeModeSpec = {
  kind: "solid" | "hollow" | "dashed";
  pattern?: number[];
  thickness?: number;
};
export type PaddingSpec = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};
export type SizeSpec = { w: number; h: number };

export type RectangleBrush = {
  brushId: string;
  useTool?: string;
  label: string;
  toolType: "rectangle";
  tilesetId: string;
  tilesPath?: string;
  paletteVariant?: string;
  snap?: SnapSpec;
  randomness?: RandomnessSpec;
  rotationMode?: "fixed" | "auto" | "random" | "weighted";
  flipMode?: "none" | "h" | "v" | "both";
  layer?: string;
  zIndex?: number;
  overdraw?: boolean;
  previewStyle?: { stroke: string; fill: string; opacity?: number };
  cornerTiles?: { tl?: TileSpec; tr?: TileSpec; bl?: TileSpec; br?: TileSpec };
  borderTiles?: {
    top?: EdgeSpec;
    bottom?: EdgeSpec;
    left?: EdgeSpec;
    right?: EdgeSpec;
  };
  edgePoolFilter?: "bOnly" | "nonCorner" | "all";
  edgeRandomMirrorX?: boolean;
  excludeBorderTilesInFill?: boolean;
  fillExclusionSuffixes?: string[];
  decorationMode?: "none" | "adaptiveGrid";
  decorationInset?: number;
  decorationMinSpacing?: number;
  decorationMaxSpacing?: number;
  borderSuffixes?: string[];
  cornerSuffixes?: string[];
  endpointSuffixes?: string[];
  cornerClockwiseOffset?: number;
  cornerCounterClockwiseOffset?: number;
  borderAutoRotate?: boolean;
  fillTiles?: TileSpec[];
  edgeMode?: EdgeModeSpec;
  padding?: PaddingSpec;
  minSize?: SizeSpec;
  maxSize?: SizeSpec;
  autoJoin?: boolean;
  clearOverlapsLayers?: string[];
};

export type BrushDefinition = RectangleBrush;
export type ResolvedTile = {
  src: string;
  rotationIndex: number;
  autoRotate?: boolean;
};
export type ResolvedBrushDefinition = BrushDefinition & {
  resolvedFillTiles: string[];
  resolvedCorners?: {
    tl?: ResolvedTile;
    tr?: ResolvedTile;
    bl?: ResolvedTile;
    br?: ResolvedTile;
  };
  resolvedBorders?: {
    top?: ResolvedTile;
    bottom?: ResolvedTile;
    left?: ResolvedTile;
    right?: ResolvedTile;
  };
  resolvedBorderPool?: ResolvedTile[];
  resolvedCornerPool?: ResolvedTile[];
};

export type BrushFile = {
  version: number;
  tilesetId: string;
  paletteVariant?: string;
  palettes?: Array<{
    id: string;
    label?: string;
    tiles: Array<TileSpec | string>;
  }>;
  tools?: Array<
    Partial<BrushDefinition> & {
      toolId?: string;
      paletteRefs?: string[];
      borderPaletteRefs?: string[];
      cornerPaletteRefs?: string[];
    }
  >;
  brushes?: BrushDefinition[];
};

export type BrushValidationIssue = {
  level: "warning" | "error";
  message: string;
  path: string;
  brushId?: string;
  tilesetId?: string;
  file?: string;
};

export type BrushLoaderResult = {
  brushes: ResolvedBrushDefinition[];
  issues: BrushValidationIssue[];
};

const BATTLEMAP_ROOT = path.join(
  process.cwd(),
  "public",
  "assets",
  "battlemap"
);
const TILESETS_ROOT = path.join(BATTLEMAP_ROOT, "Tilesets");
const BRUSH_FILE_PATTERN = /^brushes.*\.json$/i;
const TOOL_FILE_PATTERN = /^tools.*\.json$/i;

const toTileSpec = (entry: TileSpec | string): TileSpec => {
  if (typeof entry === "string") return { tileId: entry };
  return entry;
};

type ToolInput = Partial<BrushDefinition> & {
  toolId?: string;
  paletteRefs?: string[];
  borderPaletteRefs?: string[];
  cornerPaletteRefs?: string[];
  tilesPath?: string;
};

const collectTileIdsForTileset = (tilesetPath: string) => {
  const tileIdToPath = new Map<string, string>();
  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        return;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
        const id = path.parse(entry.name).name.toLowerCase();
        tileIdToPath.set(id, fullPath);
      }
    });
  };
  if (fs.existsSync(tilesetPath)) {
    walk(tilesetPath);
  }
  return tileIdToPath;
};

const validateTileSpec = ({
  spec,
  pathLabel,
  tilesetId,
  tilesetTiles,
  brushId,
  issues,
  file,
}: {
  spec: TileSpec | EdgeSpec | undefined;
  pathLabel: string;
  tilesetId: string;
  tilesetTiles: Map<string, string>;
  brushId?: string;
  issues: BrushValidationIssue[];
  file?: string;
}) => {
  if (!spec) {
    issues.push({
      level: "warning",
      message: "Missing tile spec",
      path: pathLabel,
      brushId,
      tilesetId,
      file,
    });
    return;
  }
  if (!spec.tileId) {
    issues.push({
      level: "error",
      message: "tileId is required",
      path: `${pathLabel}.tileId`,
      brushId,
      tilesetId,
      file,
    });
    return;
  }
  const lookupId = spec.tileId.toLowerCase();
  if (!tilesetTiles.has(lookupId)) {
    issues.push({
      level: "warning",
      message: `tileId "${spec.tileId}" not found in tileset ${tilesetId}`,
      path: `${pathLabel}.tileId`,
      brushId,
      tilesetId,
      file,
    });
  }
};

const validateRectangleBrush = (
  brush: RectangleBrush,
  tilesetTiles: Map<string, string>,
  file: string | undefined,
  issues: BrushValidationIssue[]
) => {
  const tilesetId = brush.tilesetId;
  if (brush.cornerTiles) {
    validateTileSpec({
      spec: brush.cornerTiles.tl,
      pathLabel: "cornerTiles.tl",
      tilesetId,
      tilesetTiles,
      brushId: brush.brushId,
      issues,
      file,
    });
    validateTileSpec({
      spec: brush.cornerTiles.tr,
      pathLabel: "cornerTiles.tr",
      tilesetId,
      tilesetTiles,
      brushId: brush.brushId,
      issues,
      file,
    });
    validateTileSpec({
      spec: brush.cornerTiles.bl,
      pathLabel: "cornerTiles.bl",
      tilesetId,
      tilesetTiles,
      brushId: brush.brushId,
      issues,
      file,
    });
    validateTileSpec({
      spec: brush.cornerTiles.br,
      pathLabel: "cornerTiles.br",
      tilesetId,
      tilesetTiles,
      brushId: brush.brushId,
      issues,
      file,
    });
  }

  if (brush.borderTiles) {
    validateTileSpec({
      spec: brush.borderTiles.top,
      pathLabel: "borderTiles.top",
      tilesetId,
      tilesetTiles,
      brushId: brush.brushId,
      issues,
      file,
    });
    validateTileSpec({
      spec: brush.borderTiles.bottom,
      pathLabel: "borderTiles.bottom",
      tilesetId,
      tilesetTiles,
      brushId: brush.brushId,
      issues,
      file,
    });
    validateTileSpec({
      spec: brush.borderTiles.left,
      pathLabel: "borderTiles.left",
      tilesetId,
      tilesetTiles,
      brushId: brush.brushId,
      issues,
      file,
    });
    validateTileSpec({
      spec: brush.borderTiles.right,
      pathLabel: "borderTiles.right",
      tilesetId,
      tilesetTiles,
      brushId: brush.brushId,
      issues,
      file,
    });
  }

  if (Array.isArray(brush.fillTiles) && brush.fillTiles.length > 0) {
    brush.fillTiles.forEach((spec, idx) =>
      validateTileSpec({
        spec,
        pathLabel: `fillTiles[${idx}]`,
        tilesetId,
        tilesetTiles,
        brushId: brush.brushId,
        issues,
        file,
      })
    );
  }
};

const toRotationIndex = (deg?: Rotation) => {
  switch (deg) {
    case 90:
      return 1;
    case 180:
      return 2;
    case 270:
      return 3;
    default:
      return 0;
  }
};

// Resolve a logical tile spec into a concrete PNG path.
// NOTE: Do not force a default rotation here; leaving rotationIndex
// undefined allows canvas/tools to choose orientation (e.g. corners).
const resolveTile = (
  spec: TileSpec | EdgeSpec | undefined,
  tilesetTiles: Map<string, string>
): ResolvedTile | undefined => {
  if (!spec?.tileId) return undefined;
  const lookupId = spec.tileId.toLowerCase();
  const diskPath = tilesetTiles.get(lookupId);
  if (!diskPath) return undefined;
  const rel = path.relative(path.join(process.cwd(), "public"), diskPath);
  const src = `/${rel.replace(/\\\\/g, "/").replace(/\\/g, "/")}`;
  const rotationIndex =
    typeof spec.rotation === "undefined"
      ? undefined
      : toRotationIndex(spec.rotation);
  return { src, rotationIndex, autoRotate: (spec as EdgeSpec).autoRotate };
};

/**
 * Load all brush definitions under public/assets/battlemap/Tilesets and validate tile references.
 */
export const loadBattlemapBrushesFromDisk = (): BrushLoaderResult => {
  const issues: BrushValidationIssue[] = [];
  const brushes: ResolvedBrushDefinition[] = [];

  if (!fs.existsSync(TILESETS_ROOT)) {
    return { brushes, issues };
  }

  const tilesetDirs = fs
    .readdirSync(TILESETS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory());
  tilesetDirs.forEach((dir) => {
    const tilesetId = dir.name;
    const tilesetPath = path.join(TILESETS_ROOT, tilesetId);
    const tilesetTiles = collectTileIdsForTileset(tilesetPath);
    const toolMap = (() => {
      const map = new Map<string, ToolInput>();
      const toolFiles = fs
        .readdirSync(tilesetPath, { withFileTypes: true })
        .filter(
          (entry) => entry.isFile() && TOOL_FILE_PATTERN.test(entry.name)
        );
      toolFiles.forEach((entry) => {
        try {
          const parsed = JSON.parse(
            fs.readFileSync(path.join(tilesetPath, entry.name), "utf8")
          ) as Partial<BrushFile>;
          const tools: ToolInput[] =
            (parsed.tools as ToolInput[] | undefined) ?? [];
          tools.forEach((tool) => {
            if (tool.toolId) {
              map.set(tool.toolId.toLowerCase(), tool);
            }
          });
        } catch {
          // ignore tool parse errors for now
        }
      });
      return map;
    })();

    if (tilesetTiles.size === 0) {
      issues.push({
        level: "warning",
        message: `No PNG tiles found for tileset ${tilesetId}`,
        path: `${tilesetId}`,
        tilesetId,
      });
    }

    const entries = fs
      .readdirSync(tilesetPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && BRUSH_FILE_PATTERN.test(entry.name));

    entries.forEach((entry) => {
      const filePath = path.join(tilesetPath, entry.name);
      try {
        const parsed = JSON.parse(
          fs.readFileSync(filePath, "utf8")
        ) as Partial<BrushFile>;

        const paletteMap =
          parsed.palettes?.reduce((map, palette) => {
            map.set(
              palette.id.toLowerCase(),
              palette.tiles.map((t) => toTileSpec(t))
            );
            return map;
          }, new Map<string, TileSpec[]>()) ?? new Map<string, TileSpec[]>();

        const tools: ToolInput[] =
          (parsed.brushes as ToolInput[] | undefined) ??
          (parsed.tools as ToolInput[] | undefined) ??
          [];

        if (tools.length === 0) {
          issues.push({
            level: "warning",
            message: "Brush file missing `brushes` or `tools` array",
            path: entry.name,
            tilesetId,
            file: entry.name,
          });
          return;
        }

        tools.forEach((brush) => {
          const baseTool = brush.useTool
            ? toolMap.get(brush.useTool.toLowerCase())
            : undefined;
          if (brush.useTool && !baseTool) {
            issues.push({
              level: "warning",
              message: `useTool "${brush.useTool}" not found for tileset ${tilesetId}`,
              path: `${entry.name}.${
                brush.brushId ?? brush.toolId ?? "brush"
              }.useTool`,
              brushId: brush.brushId,
              tilesetId,
              file: entry.name,
            });
            return;
          }
          const isTool =
            "paletteRefs" in brush || "toolId" in brush || !!parsed.tools;
          const merged: BrushDefinition = {
            ...(baseTool as BrushDefinition),
            ...(brush as BrushDefinition),
          };
          const resolvedBrush: BrushDefinition = {
            ...(merged as BrushDefinition),
            brushId:
              merged.brushId ??
              merged.toolId ??
              merged.useTool ??
              brush.brushId ??
              "brush",
            tilesetId: merged.tilesetId ?? parsed.tilesetId ?? tilesetId,
          } as BrushDefinition;
          if (!resolvedBrush.toolType) {
            issues.push({
              level: "error",
              message:
                "toolType is required (ensure useTool points to a valid tool with toolType)",
              path: `${entry.name}.${resolvedBrush.brushId}.toolType`,
              brushId: resolvedBrush.brushId,
              tilesetId: resolvedBrush.tilesetId,
              file: entry.name,
            });
            return;
          }

          if (!resolvedBrush.brushId) {
            issues.push({
              level: "error",
              message: "brushId is required",
              path: `${entry.name}.brushId`,
              tilesetId,
              file: entry.name,
            });
            return;
          }

          if (resolvedBrush.toolType !== "rectangle") {
            issues.push({
              level: "warning",
              message: `Unsupported toolType "${resolvedBrush.toolType}"`,
              path: `${entry.name}.${resolvedBrush.brushId}.toolType`,
              brushId: resolvedBrush.brushId,
              tilesetId: resolvedBrush.tilesetId,
              file: entry.name,
            });
          }

          if (!resolvedBrush.tilesetId) {
            issues.push({
              level: "error",
              message: "tilesetId is required",
              path: `${entry.name}.${resolvedBrush.brushId}.tilesetId`,
              brushId: resolvedBrush.brushId,
              tilesetId,
              file: entry.name,
            });
            return;
          }

          const targetTilesetTiles =
            resolvedBrush.tilesetId === tilesetId
              ? tilesetTiles
              : collectTileIdsForTileset(
                  path.join(TILESETS_ROOT, resolvedBrush.tilesetId)
                );
          const filteredTilesetTiles = (() => {
            if (!resolvedBrush.tilesPath) return targetTilesetTiles;
            const pathNeedle = resolvedBrush.tilesPath
              .toLowerCase()
              .replace(/\\/g, "/");
            const filtered = new Map<string, string>();
            targetTilesetTiles.forEach((fullPath, id) => {
              const normalized = fullPath.toLowerCase().replace(/\\/g, "/");
              if (normalized.includes(pathNeedle)) {
                filtered.set(id, fullPath);
              }
            });
            return filtered.size > 0 ? filtered : targetTilesetTiles;
          })();

          const allTileIds = Array.from(filteredTilesetTiles.keys());
          const borderSuffixes = resolvedBrush.borderSuffixes ?? ["_b", "-b"];
          const cornerSuffixes = resolvedBrush.cornerSuffixes ?? [
            "_bc",
            "-bc",
            "_c",
            "-c",
          ];
          const cornerIds = allTileIds
            .filter((id) => {
              const lower = id.toLowerCase();
              return cornerSuffixes.some((suf) =>
                lower.includes(suf.toLowerCase())
              );
            })
            .sort((a, b) => {
              const aIsBc = cornerSuffixes
                .slice(0, 2)
                .some((suf) => a.toLowerCase().includes(suf.toLowerCase()));
              const bIsBc = cornerSuffixes
                .slice(0, 2)
                .some((suf) => b.toLowerCase().includes(suf.toLowerCase()));
              if (aIsBc === bIsBc) return 0;
              return aIsBc ? -1 : 1;
            });
          let borderIds = allTileIds.filter((id) => {
            const lower = id.toLowerCase();
            return borderSuffixes.some((suf) =>
              lower.includes(suf.toLowerCase())
            );
          });
          borderIds = borderIds.filter((id) => !cornerIds.includes(id));
          const fillIds = allTileIds.filter(
            (id) => !borderIds.includes(id) && !cornerIds.includes(id)
          );
          const resolveById = (id?: string) =>
            id ? resolveTile({ tileId: id }, filteredTilesetTiles) : undefined;

          validateRectangleBrush(
            resolvedBrush as RectangleBrush,
            filteredTilesetTiles,
            entry.name,
            issues
          );
          const paletteRefs = (isTool ? brush.paletteRefs : undefined) ?? [];
          const borderPaletteRefs =
            (isTool ? brush.borderPaletteRefs : undefined) ?? [];
          const cornerPaletteRefs =
            (isTool ? brush.cornerPaletteRefs : undefined) ?? [];

          const paletteTiles = [
            ...paletteRefs,
            ...borderPaletteRefs,
            ...cornerPaletteRefs,
          ]
            .map((ref) => paletteMap.get((ref ?? "").toLowerCase()) ?? [])
            .flat()
            .filter(Boolean);

          const resolvedFillTiles =
            (
              resolvedBrush.fillTiles ??
              (paletteTiles.length > 0
                ? paletteTiles
                : fillIds.map((id) => ({ tileId: id })))
            )
              ?.map((spec) => {
                const tileSpec = toTileSpec(spec);
                const lookupId = tileSpec.tileId?.toLowerCase();
                if (!lookupId) return null;
                const diskPath = filteredTilesetTiles.get(lookupId);
                if (!diskPath) return null;
                const rel = path.relative(
                  path.join(process.cwd(), "public"),
                  diskPath
                );
                return `/${rel.replace(/\\\\/g, "/").replace(/\\/g, "/")}`;
              })
              .filter(Boolean) ?? [];

          const fallbackCorner =
            cornerIds.length > 0 ? resolveById(cornerIds[0]) : undefined;
          const resolvedCorners = resolvedBrush.cornerTiles
            ? {
                tl:
                  resolveTile(
                    resolvedBrush.cornerTiles.tl,
                    targetTilesetTiles
                  ) ??
                  (() => {
                    const candidate = paletteMap.get(
                      cornerPaletteRefs[0]?.toLowerCase() ?? ""
                    )?.[0];
                    return candidate
                      ? resolveTile(toTileSpec(candidate), targetTilesetTiles)
                      : fallbackCorner;
                  })(),
                tr:
                  resolveTile(
                    resolvedBrush.cornerTiles.tr,
                    targetTilesetTiles
                  ) ??
                  (() => {
                    const candidate = paletteMap.get(
                      cornerPaletteRefs[1]?.toLowerCase() ??
                        cornerPaletteRefs[0]?.toLowerCase() ??
                        ""
                    )?.[0];
                    return candidate
                      ? resolveTile(toTileSpec(candidate), targetTilesetTiles)
                      : fallbackCorner;
                  })(),
                bl:
                  resolveTile(
                    resolvedBrush.cornerTiles.bl,
                    targetTilesetTiles
                  ) ??
                  (() => {
                    const candidate = paletteMap.get(
                      cornerPaletteRefs[2]?.toLowerCase() ??
                        cornerPaletteRefs[0]?.toLowerCase() ??
                        ""
                    )?.[0];
                    return candidate
                      ? resolveTile(toTileSpec(candidate), targetTilesetTiles)
                      : fallbackCorner;
                  })(),
                br:
                  resolveTile(
                    resolvedBrush.cornerTiles.br,
                    targetTilesetTiles
                  ) ??
                  (() => {
                    const candidate = paletteMap.get(
                      cornerPaletteRefs[3]?.toLowerCase() ??
                        cornerPaletteRefs[0]?.toLowerCase() ??
                        ""
                    )?.[0];
                    return candidate
                      ? resolveTile(toTileSpec(candidate), targetTilesetTiles)
                      : fallbackCorner;
                  })(),
              }
            : cornerPaletteRefs.length > 0
            ? {
                tl:
                  resolveTile(
                    toTileSpec(
                      paletteMap.get(
                        cornerPaletteRefs[0]?.toLowerCase() ?? ""
                      )?.[0]
                    ),
                    targetTilesetTiles
                  ) ?? resolveById(cornerIds[0]),
                tr:
                  resolveTile(
                    toTileSpec(
                      paletteMap.get(
                        cornerPaletteRefs[1]?.toLowerCase() ??
                          cornerPaletteRefs[0]?.toLowerCase() ??
                          ""
                      )?.[0]
                    ),
                    targetTilesetTiles
                  ) ?? resolveById(cornerIds[0]),
                bl:
                  resolveTile(
                    toTileSpec(
                      paletteMap.get(
                        cornerPaletteRefs[2]?.toLowerCase() ??
                          cornerPaletteRefs[0]?.toLowerCase() ??
                          ""
                      )?.[0]
                    ),
                    targetTilesetTiles
                  ) ?? resolveById(cornerIds[0]),
                br:
                  resolveTile(
                    toTileSpec(
                      paletteMap.get(
                        cornerPaletteRefs[3]?.toLowerCase() ??
                          cornerPaletteRefs[0]?.toLowerCase() ??
                          ""
                      )?.[0]
                    ),
                    targetTilesetTiles
                  ) ?? resolveById(cornerIds[0]),
              }
            : undefined;

          const fallbackBorder =
            borderIds.length > 0 ? resolveById(borderIds[0]) : undefined;
          const resolvedBorderPool = borderIds
            .map((id) => resolveById(id))
            .filter(Boolean)
            .map((tile) =>
              resolvedBrush.borderAutoRotate
                ? { ...tile, autoRotate: true }
                : tile
            ) as ResolvedTile[];
          const resolvedCornerPool = cornerIds
            .map((id) => resolveById(id))
            .filter(Boolean) as ResolvedTile[];
          const finalResolvedFillTiles =
            resolvedFillTiles.length > 0
              ? resolvedFillTiles
              : resolvedBorderPool.length > 0
              ? resolvedBorderPool.map((t) => t.src)
              : resolvedCornerPool.map((t) => t.src);

          const resolvedBorders = resolvedBrush.borderTiles
            ? {
                top:
                  resolveTile(
                    resolvedBrush.borderTiles.top,
                    targetTilesetTiles
                  ) ??
                  (() => {
                    const candidate = paletteMap.get(
                      borderPaletteRefs[0]?.toLowerCase() ?? ""
                    )?.[0];
                    return candidate
                      ? resolveTile(toTileSpec(candidate), targetTilesetTiles)
                      : fallbackBorder;
                  })(),
                bottom:
                  resolveTile(
                    resolvedBrush.borderTiles.bottom,
                    targetTilesetTiles
                  ) ??
                  (() => {
                    const candidate = paletteMap.get(
                      borderPaletteRefs[1]?.toLowerCase() ??
                        borderPaletteRefs[0]?.toLowerCase() ??
                        ""
                    )?.[0];
                    return candidate
                      ? resolveTile(toTileSpec(candidate), targetTilesetTiles)
                      : fallbackBorder;
                  })(),
                left:
                  resolveTile(
                    resolvedBrush.borderTiles.left,
                    targetTilesetTiles
                  ) ??
                  (() => {
                    const candidate = paletteMap.get(
                      borderPaletteRefs[2]?.toLowerCase() ??
                        borderPaletteRefs[0]?.toLowerCase() ??
                        ""
                    )?.[0];
                    return candidate
                      ? resolveTile(toTileSpec(candidate), targetTilesetTiles)
                      : fallbackBorder;
                  })(),
                right:
                  resolveTile(
                    resolvedBrush.borderTiles.right,
                    targetTilesetTiles
                  ) ??
                  (() => {
                    const candidate = paletteMap.get(
                      borderPaletteRefs[3]?.toLowerCase() ??
                        borderPaletteRefs[0]?.toLowerCase() ??
                        ""
                    )?.[0];
                    return candidate
                      ? resolveTile(toTileSpec(candidate), targetTilesetTiles)
                      : fallbackBorder;
                  })(),
              }
            : undefined;
          if (resolvedBorders && resolvedBrush.borderAutoRotate) {
            if (resolvedBorders.top) resolvedBorders.top.autoRotate = true;
            if (resolvedBorders.bottom)
              resolvedBorders.bottom.autoRotate = true;
            if (resolvedBorders.left) resolvedBorders.left.autoRotate = true;
            if (resolvedBorders.right) resolvedBorders.right.autoRotate = true;
          }

          brushes.push({
            ...resolvedBrush,
            resolvedFillTiles: finalResolvedFillTiles,
            resolvedCorners,
            resolvedBorders,
            resolvedBorderPool,
            resolvedCornerPool,
          });
        });
      } catch (err) {
        issues.push({
          level: "error",
          message: `Failed to parse brush file: ${(err as Error).message}`,
          path: entry.name,
          tilesetId,
          file: entry.name,
        });
      }
    });
  });

  return { brushes, issues };
};
