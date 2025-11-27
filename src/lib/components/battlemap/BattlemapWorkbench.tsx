import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import BattlemapCanvas from "@/lib/components/battlemap/BattlemapCanvas";
import BattlemapLayersPanel from "@/lib/components/battlemap/BattlemapLayersPanel";
import {
  LayerStack,
  LayerLeaf,
  LayerId,
  createDefaultLayerStack,
  findLayerByRole,
  toggleVisibility,
  toggleLock,
  renameNode,
  setOutline,
  setShadow,
  setOutlineWidth,
  setShadowDistance,
  setLightRadius,
  setLightIntensity,
  setDarknessOpacity,
  setTint,
  insertNewLayer,
  insertNewGroup,
  duplicateLayer,
  deleteNodes,
  reorderNode,
  getVisibleLayerIds,
  applyVisibilityPreset,
} from "@/lib/battlemap/layers";

type Tint = { color: string; alpha: number };
type VisibilityPreset = {
  id: string;
  name: string;
  visibleLayerIds: LayerId[];
};

const DEFAULT_MAP_SEED = Math.random().toString(36).slice(2, 10);
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

const BattlemapWorkbench: React.FC = () => {
  const initialLayers = useMemo(() => {
    const base = createDefaultLayerStack();
    const bg = findLayerByRole(base, "background");
    if (!bg || bg.locked) return base;
    return {
      ...base,
      nodes: {
        ...base.nodes,
        [bg.id]: { ...bg, locked: true },
      },
    };
  }, []);
  const [layers, setLayers] = useState<LayerStack>(() => {
    // Fix existing layer order: ensure lighting is first, background is last
    const base = initialLayers;
    const lightingNode = Object.values(base.nodes).find(
      (n) => n.type === "layer" && (n as LayerLeaf).role === "lighting"
    );
    const backgroundNode = Object.values(base.nodes).find(
      (n) => n.type === "layer" && (n as LayerLeaf).role === "background"
    );

    if (lightingNode && backgroundNode) {
      // Reorder rootIds: lighting first, background last, everything else in between
      const newRootIds = base.rootIds.filter(
        (id) => id !== lightingNode.id && id !== backgroundNode.id
      );
      return {
        ...base,
        rootIds: [lightingNode.id, ...newRootIds, backgroundNode.id],
      };
    }

    return base;
  });
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [soloLayerId, setSoloLayerId] = useState<string | null>(null);
  const [shadowOpacityByLayer, setShadowOpacityByLayer] = useState<
    Record<string, number>
  >(() => {
    const next: Record<string, number> = {};
    Object.values(initialLayers.nodes).forEach((node) => {
      if (node.type === "layer") {
        next[node.id] = 0.8;
      }
    });
    return next;
  });
  const [shadeOpacityByLayer, setShadeOpacityByLayer] = useState<
    Record<string, number>
  >(() => {
    const next: Record<string, number> = {};
    Object.values(initialLayers.nodes).forEach((node) => {
      if (node.type === "layer") {
        next[node.id] = 0;
      }
    });
    return next;
  });
  const [presets, setPresets] = useState<VisibilityPreset[]>([]);
  const snapDebug = false;
  const [maps, setMaps] = useState([
    { id: "map-1", name: "Map 1", seed: DEFAULT_MAP_SEED },
  ]);
  const [selectedMapId, setSelectedMapId] = useState("map-1");

  // Restore the last selected map ID on mount so reload loads the correct map and tiles
  useEffect(() => {
    try {
      const lastMapId = localStorage.getItem("battlemap:lastSelectedMapId");
      if (lastMapId) {
        setSelectedMapId(lastMapId);
      }
    } catch {}
  }, []);

  const [environments, setEnvironments] = useState<
    Array<{
      id: string;
      name: string;
      categories: Array<{ id: string; name: string }>;
    }>
  >([]);
  const [tilesets, setTilesets] = useState<
    Array<{ id: string; name: string; tiles: string[] }>
  >([]);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<
    string | null
  >(null);
  const [envPopoverOpen, setEnvPopoverOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [brushes, setBrushes] = useState<
    Array<{
      brushId: string;
      label: string;
      tilesetId: string;
      resolvedFillTiles: string[];
      resolvedCorners?: {
        tl?: { src: string; rotationIndex: number };
        tr?: { src: string; rotationIndex: number };
        bl?: { src: string; rotationIndex: number };
        br?: { src: string; rotationIndex: number };
      };
      resolvedBorders?: {
        top?: { src: string; rotationIndex: number };
        bottom?: { src: string; rotationIndex: number };
        left?: { src: string; rotationIndex: number };
        right?: { src: string; rotationIndex: number };
      };
    }>
  >([]);
  const [activeBrushId, setActiveBrushId] = useState<string | null>(null);
  const [hoveredAsset, setHoveredAsset] = useState<{
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedAssetTile, setSelectedAssetTile] = useState<string | null>(
    null
  );
  const [selectTilesLayerIds, setSelectTilesLayerIds] = useState<
    string[] | null
  >(null);

  const toTitle = (slug: string) =>
    slug
      .replace(/[-_]/g, " ")
      .split(" ")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

  const handleToggleVisibility = (nodeId: LayerId) =>
    setLayers((prev) => toggleVisibility(prev, nodeId));
  const handleToggleLock = (nodeId: LayerId) =>
    setLayers((prev) => toggleLock(prev, nodeId));
  const handleCreateLayer = (parentId: LayerId | null) =>
    setLayers((prev) => {
      const selectedLayerId = selectedLayerIds[0] ?? null;
      const next = insertNewLayer(prev, {
        parentId,
        aboveLayerId: selectedLayerId,
      });
      const newIdValue = Object.keys(next.nodes).find((id) => !prev.nodes[id]);
      if (newIdValue) {
        setShadowOpacityByLayer((prevShadow) => ({
          ...prevShadow,
          [newIdValue]: 0.8,
        }));
        setShadeOpacityByLayer((prevShade) => ({
          ...prevShade,
          [newIdValue]: 0,
        }));
      }
      return next;
    });
  const handleCreateGroup = (parentId: LayerId | null) =>
    setLayers((prev) => insertNewGroup(prev, { parentId }));
  const handleDuplicateLayer = (layerId: LayerId) =>
    setLayers((prev) => {
      const next = duplicateLayer(prev, layerId);
      const newIdValue = Object.keys(next.nodes).find((id) => !prev.nodes[id]);
      if (newIdValue) {
        setShadowOpacityByLayer((prevShadow) => ({
          ...prevShadow,
          [newIdValue]: prevShadow[layerId] ?? 0.8,
        }));
        setShadeOpacityByLayer((prevShade) => ({
          ...prevShade,
          [newIdValue]: prevShade[layerId] ?? 0,
        }));
      }
      return next;
    });
  const handleDeleteLayers = (ids: LayerId[]) =>
    setLayers((prev) => {
      const allowed = ids.filter((id) => {
        const node = prev.nodes[id];
        if (!node) return false;
        if (node.type === "group") return true;
        return node.type === "layer" && node.role === "normal";
      });
      if (!allowed.length) return prev;
      setShadowOpacityByLayer((prevShadow) => {
        const nextShadow = { ...prevShadow };
        allowed.forEach((id) => {
          delete nextShadow[id];
        });
        return nextShadow;
      });
      setShadeOpacityByLayer((prevShade) => {
        const nextShade = { ...prevShade };
        allowed.forEach((id) => {
          delete nextShade[id];
        });
        return nextShade;
      });
      return deleteNodes(prev, allowed);
    });
  const handleReorder = (
    dragId: LayerId,
    targetId: LayerId,
    position: "above" | "inside" | "below"
  ) => setLayers((prev) => reorderNode(prev, dragId, targetId, position));
  const handleRenameLayer = (nodeId: LayerId, name: string) =>
    setLayers((prev) => renameNode(prev, nodeId, name));
  const handleOutline = (layerId: LayerId, value: boolean) =>
    setLayers((prev) => setOutline(prev, layerId, value));
  const handleShadow = (layerId: LayerId, value: boolean) =>
    setLayers((prev) => setShadow(prev, layerId, value));
  const handleOutlineWidth = (layerId: LayerId, width: number) =>
    setLayers((prev) => setOutlineWidth(prev, layerId, width));
  const handleShadowDistance = (layerId: LayerId, distance: number) =>
    setLayers((prev) => setShadowDistance(prev, layerId, distance));
  const handleLightRadius = (layerId: LayerId, radius: number) =>
    setLayers((prev) => setLightRadius(prev, layerId, radius));
  const handleLightIntensity = (layerId: LayerId, intensity: number) =>
    setLayers((prev) => setLightIntensity(prev, layerId, intensity));
  const handleShadowOpacity = (layerId: LayerId, opacity: number) =>
    setShadowOpacityByLayer((prev) => ({
      ...prev,
      [layerId]: Math.max(0, Math.min(opacity, 1)),
    }));
  const handleShadeOpacity = (layerId: LayerId, opacity: number) =>
    setShadeOpacityByLayer((prev) => ({
      ...prev,
      [layerId]: Math.max(0, Math.min(opacity, 1)),
    }));
  const handleTintChange = (
    layerId: LayerId,
    tint: { color: string; alpha: number } | null
  ) => setLayers((prev) => setTint(prev, layerId, tint));
  const handleSavePreset = (name: string) =>
    setPresets((prev) => [
      ...prev,
      { id: newId(), name, visibleLayerIds: getVisibleLayerIds(layers) },
    ]);
  const handleApplyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setLayers((prev) => applyVisibilityPreset(prev, preset));
  };
  const handleSelectTilesForLayers = (ids: LayerId[]) => {
    setSelectTilesLayerIds(ids.slice());
  };
  const handleCreateGroupFromLayers = (ids: LayerId[]) =>
    setLayers((prev) => {
      const layerIds = ids.filter((id) => prev.nodes[id]?.type === "layer");
      if (layerIds.length < 2) return prev;
      const firstNode = prev.nodes[layerIds[0]];
      if (!firstNode) return prev;
      const parentId = firstNode.parentId ?? null;
      let next = insertNewGroup(prev, { parentId, name: "New Group" });
      const newGroupId = Object.keys(next.nodes).find(
        (id) => !prev.nodes[id] && next.nodes[id]?.type === "group"
      );
      if (!newGroupId) return prev;
      layerIds.forEach((layerId) => {
        next = reorderNode(next, layerId, newGroupId, "inside");
      });
      return next;
    });

  useEffect(() => {
    const loadEnvironments = async () => {
      try {
        const res = await fetch("/api/battlemap/tilesets");
        const data = await res.json();
        const envs =
          (data.environments as Array<{
            id: string;
            name: string;
            categories: Array<{ id: string; name: string }>;
          }>) ?? [];
        setEnvironments(envs);
        setTilesets(
          (data.tilesets as Array<{
            id: string;
            name: string;
            tiles: string[];
          }>) ?? []
        );
        if (envs.length > 0) {
          setSelectedEnvironmentId((prev) => prev ?? envs[0].id);
        }
      } catch (e) {
        console.error("Failed to load environments", e);
      }
    };
    loadEnvironments();
  }, []);

  useEffect(() => {
    const loadBrushes = async () => {
      try {
        const res = await fetch("/api/battlemap/brushes");
        if (!res.ok) return;
        const data = await res.json();
        const list =
          (data.brushes as Array<{
            brushId: string;
            label: string;
            tilesetId: string;
            resolvedFillTiles: string[];
            resolvedCorners?: {
              tl?: { src: string; rotationIndex: number };
              tr?: { src: string; rotationIndex: number };
              bl?: { src: string; rotationIndex: number };
              br?: { src: string; rotationIndex: number };
            };
            resolvedBorders?: {
              top?: { src: string; rotationIndex: number };
              bottom?: { src: string; rotationIndex: number };
              left?: { src: string; rotationIndex: number };
              right?: { src: string; rotationIndex: number };
            };
          }>) ?? [];
        setBrushes(list);
        setActiveBrushId((prev) => prev ?? list[0]?.brushId ?? null);
      } catch (err) {
        console.warn("Failed to load brushes", err);
      }
    };
    loadBrushes();
  }, []);

  const activeBrush = brushes.find((b) => b.brushId === activeBrushId);
  const activeBrushTiles = useMemo(
    () => activeBrush?.resolvedFillTiles ?? [],
    [activeBrush]
  );

  const rgba = (hex: string, alpha: number) => {
    const clean = hex.replace("#", "");
    const bigint = parseInt(clean.length === 3 ? clean.repeat(2) : clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const a = alpha > 0 ? alpha : 0.3;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  const legacyLayerKeys = [
    "background",
    "floor",
    "structure",
    "lighting",
    "props",
    "decoration",
  ] as const;
  const selectedLegacyLayer = useMemo<(typeof legacyLayerKeys)[number] | null>(
    () =>
      (selectedLayerIds.find((id) =>
        (legacyLayerKeys as readonly string[]).includes(id)
      ) as (typeof legacyLayerKeys)[number]) ?? null,
    [selectedLayerIds]
  );
  const selectedLayerNode = useMemo(() => {
    const selectedId = selectedLayerIds[0];
    if (!selectedId) return null;
    const node = layers.nodes[selectedId];
    return node?.type === "layer" ? node : null;
  }, [selectedLayerIds, layers]);
  const legacyLayerIds = useMemo<
    Partial<Record<(typeof legacyLayerKeys)[number], string>>
  >(() => {
    const map: Partial<Record<(typeof legacyLayerKeys)[number], string>> = {};
    legacyLayerKeys.forEach((k) => {
      const node = layers.nodes[k];
      if (node && node.type === "layer") {
        map[k] = node.id;
      }
    });
    return map;
  }, [layers]);

  return (
    <div className="battlemap-page">
      <aside className="battlemap-page__rail">
        <BattlemapLayersPanel
          layers={layers}
          selectedLayerIds={selectedLayerIds}
          soloLayerId={soloLayerId}
          presets={presets}
          onLayersChange={setLayers}
          onSelectedLayerIdsChange={setSelectedLayerIds}
          onSoloLayerChange={setSoloLayerId}
          onTintChange={handleTintChange}
          onCreateLayer={handleCreateLayer}
          onCreateGroup={handleCreateGroup}
          onDuplicateLayer={handleDuplicateLayer}
          onDeleteLayers={handleDeleteLayers}
          onToggleVisibility={handleToggleVisibility}
          onToggleLock={handleToggleLock}
          onRenameLayer={handleRenameLayer}
          onToggleOutline={handleOutline}
          onToggleShadow={handleShadow}
          onOutlineWidthChange={handleOutlineWidth}
          onShadowDistanceChange={handleShadowDistance}
          onLightRadiusChange={handleLightRadius}
          onLightIntensityChange={handleLightIntensity}
          shadowOpacityByLayer={shadowOpacityByLayer}
          onShadowOpacityChange={handleShadowOpacity}
          shadeOpacityByLayer={shadeOpacityByLayer}
          onShadeOpacityChange={handleShadeOpacity}
          onDarknessOpacityChange={(opacity) =>
            setLayers((prev) => setDarknessOpacity(prev, opacity))
          }
          onSelectTilesForLayers={handleSelectTilesForLayers}
          onCreateGroupFromLayers={handleCreateGroupFromLayers}
          onSavePreset={handleSavePreset}
          onApplyPreset={handleApplyPreset}
        />
      </aside>

      <div className="battlemap-page__center">
        <div className="battlemap-canvas-card" style={{ height: "100%" }}>
          <BattlemapCanvas
            activeBrushTiles={activeBrushTiles}
            activeBrush={activeBrush}
            selectedTile={selectedAssetTile}
            maps={maps}
            selectedMapId={selectedMapId}
            onSelectMap={setSelectedMapId}
            onCreateMap={() => {
              const newId = `map-${Date.now()}`;
              const newMap = {
                id: newId,
                name: `Map ${maps.length + 1}`,
                seed: Math.random().toString(36).slice(2, 10),
              };
              setMaps((prev) => [...prev, newMap]);
              setSelectedMapId(newId);
            }}
            onRenameMap={(id, name) =>
              setMaps((prev) =>
                prev.map((m) =>
                  m.id === id ? { ...m, name: name || m.name } : m
                )
              )
            }
            mapSeed={
              maps.find((m) => m.id === selectedMapId)?.seed ?? "default-seed"
            }
            onToggleGrid={() =>
              handleToggleVisibility(
                findLayerByRole(layers, "grid")?.id ?? "grid"
              )
            }
            onToggleTokensLayer={() =>
              handleToggleVisibility(
                findLayerByRole(layers, "tokens")?.id ?? "tokens"
              )
            }
            onToggleFogLayer={() =>
              handleToggleVisibility(
                findLayerByRole(layers, "fog")?.id ?? "fog"
              )
            }
            snapDebug={snapDebug}
            selectedLayerKey={selectedLegacyLayer}
            legacyLayerIds={legacyLayerIds}
            layers={layers}
            soloLayerId={soloLayerId}
            selectedLayerId={selectedLayerIds[0] ?? null}
            selectTilesForLayerIds={selectTilesLayerIds}
            shadowOpacityByLayer={shadowOpacityByLayer}
            shadeOpacityByLayer={shadeOpacityByLayer}
            darknessOpacity={layers.mapDarknessOpacity ?? 0}
            onLoadLayers={(stack) => {
              const bg = findLayerByRole(stack, "background");
              const grid = findLayerByRole(stack, "grid");
              let next = stack;
              const nextNodes = { ...stack.nodes };
              let nextRootIds = [...stack.rootIds];

              if (bg && !bg.locked) {
                nextNodes[bg.id] = { ...bg, locked: true };
              }
              if (grid && !grid.visible) {
                nextNodes[grid.id] = { ...grid, visible: true };
              }

              // Ensure lighting layer exists
              if (!nextNodes["lighting"]) {
                const lightingLayer: (typeof nextNodes)["lighting"] = {
                  id: "lighting",
                  type: "layer",
                  role: "normal",
                  name: "Lighting",
                  parentId: null,
                  visible: true,
                  locked: false,
                  tint: { color: "#ffffff", alpha: 0 },
                  hasOutline: false,
                  hasShadow: false,
                  outlineWidth: 3,
                  shadowDistance: 0.3,
                  shadowOpacity: 0.5,
                  shadeOpacity: 0,
                };
                nextNodes["lighting"] = lightingLayer;
                // Insert before fog layer if it exists, otherwise at the end
                const fogIndex = nextRootIds.indexOf("fog");
                if (fogIndex >= 0) {
                  nextRootIds.splice(fogIndex, 0, "lighting");
                } else {
                  nextRootIds.push("lighting");
                }
              }

              if (nextNodes !== stack.nodes || nextRootIds !== stack.rootIds) {
                next = { ...stack, nodes: nextNodes, rootIds: nextRootIds };
              }
              setLayers(next);
            }}
          />
        </div>
      </div>

      <aside
        className="battlemap-page__rail battlemap-page__rail--right"
        style={{
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          paddingTop: 0,
          maxWidth: 260,
          minWidth: 220,
        }}
      >
        <div
          className="battlemap-card"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            className="battlemap-card__title"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span>Tiles</span>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="battlemap-input"
                style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
                onClick={() => setEnvPopoverOpen((v) => !v)}
              >
                {environments.find((e) => e.id === selectedEnvironmentId)
                  ?.name ?? "Environment"}
              </button>
              {envPopoverOpen ? (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 4,
                    background: "#fff",
                    border: "1px solid #dfe6e9",
                    borderRadius: 8,
                    boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
                    minWidth: 180,
                    zIndex: 30,
                  }}
                >
                  {environments.map((env) => (
                    <button
                      key={env.id}
                      type="button"
                      onClick={() => {
                        setSelectedEnvironmentId(env.id);
                        setEnvPopoverOpen(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        border: "none",
                        background:
                          env.id === selectedEnvironmentId
                            ? "#e9f1ff"
                            : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      {env.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <ul
            className="battlemap-list"
            style={{ overflowY: "auto", flex: 1, minHeight: 0 }}
          >
            {(
              environments.find((e) => e.id === selectedEnvironmentId)
                ?.categories ?? []
            )
              .map((cat) => {
                const categoryKey = `${selectedEnvironmentId}:${cat.id}`;
                const isOpen = expandedCategories.has(categoryKey);
                const brushesForEnv = brushes.filter(
                  (b) =>
                    b.tilesetId.toLowerCase() ===
                    (selectedEnvironmentId ?? "").toLowerCase()
                );
                const tilesForCategory =
                  cat.id === "brushes"
                    ? brushesForEnv.map((brush) => ({
                        tile: brush.resolvedFillTiles[0] ?? "",
                        id: brush.brushId,
                        label: brush.label,
                        type: "brush" as const,
                        preview: brush.resolvedFillTiles[0],
                      }))
                    : tilesets
                        .filter((ts) => {
                          const segments = ts.id.split("/");
                          if (segments.length === 0) return false;
                          const envId = segments[0];
                          const catId = segments[1];
                          return (
                            envId === selectedEnvironmentId && catId === cat.id
                          );
                        })
                        .flatMap((ts) => {
                          return ts.tiles.map((tile) => {
                            const filename = tile.split("/").pop() ?? tile;
                            const base = filename.split(".")[0] ?? filename;
                            const parts = base.split(/[_-]/);
                            const primary = parts[0] ?? base;
                            const suffix = parts[parts.length - 1] ?? "";
                            // If the last segment still contains dimensions (e.g. "1X1_1"), keep only the trailing index.
                            let numberPart = suffix;
                            const dimMatch = suffix.match(/(\d+)$/);
                            if (dimMatch) {
                              numberPart = dimMatch[1];
                            }
                            const spaced = primary.replace(
                              /([a-z0-9])([A-Z])/g,
                              "$1 $2"
                            );
                            const baseLabel = toTitle(spaced);
                            const label =
                              numberPart && numberPart !== primary
                                ? `${baseLabel} ${numberPart}`
                                : baseLabel;
                            return {
                              id: tile,
                              tile,
                              label,
                              type: "tile" as const,
                              preview: tile,
                            };
                          });
                        })
                        // Sort tiles so numbered variants appear in natural numeric order:
                        // e.g., Rocky 1, Rocky 2, ..., Rocky 10 (not 1,10,11,2,...).
                        .sort((a, b) => {
                          const labelA = a.label ?? "";
                          const labelB = b.label ?? "";
                          const baseA = labelA.replace(/\s+\d+$/, "");
                          const baseB = labelB.replace(/\s+\d+$/, "");
                          if (baseA !== baseB)
                            return baseA.localeCompare(baseB);
                          const numA = (() => {
                            const m = labelA.match(/(\d+)\s*$/);
                            return m ? parseInt(m[1], 10) : NaN;
                          })();
                          const numB = (() => {
                            const m = labelB.match(/(\d+)\s*$/);
                            return m ? parseInt(m[1], 10) : NaN;
                          })();
                          if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
                            return numA - numB;
                          }
                          return labelA.localeCompare(labelB);
                        });
                return { cat, categoryKey, isOpen, tilesForCategory };
              })
              .filter(({ tilesForCategory }) => tilesForCategory.length > 0)
              .map(({ cat, categoryKey, isOpen, tilesForCategory }) => (
                <li
                  key={cat.id}
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCategories((prev) => {
                        const next = new Set(prev);
                        if (next.has(categoryKey)) {
                          next.delete(categoryKey);
                        } else {
                          next.add(categoryKey);
                        }
                        return next;
                      })
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #dfe6e9",
                      background: "#fff",
                      cursor: "pointer",
                      fontSize: "inherit",
                    }}
                  >
                    <span>{cat.name}</span>
                    <span style={{ fontSize: 12, color: "#6c757d" }}>
                      {isOpen ? "▼" : "►"}
                    </span>
                  </button>
                  {isOpen ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 6,
                      }}
                    >
                      {tilesForCategory.map(
                        ({ id, tile, label, preview, type }) => (
                          <div
                            key={id}
                            style={{
                              width: "100%",
                              paddingBottom: "100%",
                              position: "relative",
                              overflow: "visible",
                              cursor: "pointer",
                            }}
                            draggable={type === "tile"}
                            onDragStart={(e) => {
                              if (type !== "tile") return;
                              e.dataTransfer.effectAllowed = "copy";
                              const payload = JSON.stringify({ src: tile });
                              e.dataTransfer.setData(
                                "application/battlemap-tile",
                                payload
                              );
                              // Fallback for browsers that strip custom types
                              e.dataTransfer.setData("text/plain", payload);
                              // Store globally as a fallback for browsers that don't expose dataTransfer during dragover
                              const dragWindow = window as Window & {
                                __battlemapDraggingTileSrc?: string;
                              };
                              dragWindow.__battlemapDraggingTileSrc = tile;
                            }}
                            onDragEnd={() => {
                              setSelectedAssetTile(tile);
                              const dragWindow = window as Window & {
                                __battlemapDraggingTileSrc?: string;
                              };
                              delete dragWindow.__battlemapDraggingTileSrc;
                            }}
                            onMouseEnter={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setHoveredAsset({
                                label,
                                x: rect.left + rect.width / 2,
                                y: rect.top,
                              });
                            }}
                            onMouseLeave={() => setHoveredAsset(null)}
                            onClick={() => {
                              if (type === "brush") {
                                setActiveBrushId(id);
                                setSelectedAssetTile(null);
                              } else {
                                setSelectedAssetTile(tile);
                                setActiveBrushId(null);
                              }
                            }}
                          >
                            {(() => {
                              const isSelected =
                                type === "brush"
                                  ? activeBrushId === id
                                  : selectedAssetTile === tile;
                              const borderColor = isSelected
                                ? "#4e8df5"
                                : "#dfe6e9";
                              const boxShadow = isSelected
                                ? "0 0 0 3px rgba(78,141,245,0.2)"
                                : "none";
                              return (
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    border: `1px solid ${borderColor}`,
                                    borderRadius: 6,
                                    overflow: "hidden",
                                    background: "#fff",
                                    boxShadow,
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={
                                      type === "brush"
                                        ? preview ??
                                          "/assets/battlemap/default/icons/draw-brush.svg"
                                        : tile
                                    }
                                    alt={label}
                                    style={{
                                      position: "absolute",
                                      inset: 0,
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                    }}
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        )
                      )}
                      {hoveredAsset && typeof window !== "undefined"
                        ? ReactDOM.createPortal(
                            <div
                              style={{
                                position: "fixed",
                                top: hoveredAsset.y - 10,
                                left: hoveredAsset.x,
                                transform: "translate(-50%, -100%)",
                                background: "#1f2937",
                                color: "#fff",
                                padding: "4px 8px",
                                borderRadius: 6,
                                fontSize: 12,
                                whiteSpace: "nowrap",
                                boxShadow: "0 6px 12px rgba(0,0,0,0.24)",
                                pointerEvents: "none",
                                zIndex: 99999,
                              }}
                            >
                              {hoveredAsset.label}
                            </div>,
                            document.body
                          )
                        : null}
                      {tilesForCategory.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#6c757d" }}>
                          No tiles
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            {environments.length === 0 ? (
              <li>Loading environments...</li>
            ) : null}
          </ul>
        </div>
      </aside>
    </div>
  );
};

export default BattlemapWorkbench;
