import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import {
  LayerGroup,
  LayerId,
  LayerLeaf,
  LayerNode,
  LayerStack,
  flattenLayerTree,
  isDescendantOf,
  reorderNode,
} from "@/lib/battlemap/layers";

type Tint = { color: string; alpha: number };

type BattlemapLayersPanelProps = {
  layers: LayerStack;
  selectedLayerIds: string[];
  soloLayerId: string | null;
  presets?: Array<{ id: string; name: string; visibleLayerIds: LayerId[] }>;
  onLayersChange: (next: LayerStack) => void;
  onSelectedLayerIdsChange: (ids: string[]) => void;
  onSoloLayerChange: (id: string | null) => void;
  onTintChange: (layerId: string, tint: Tint | null) => void;
  onCreateLayer: (parentId: string | null) => void;
  onCreateGroup: (parentId: string | null) => void;
  onDuplicateLayer: (layerId: string) => void;
  onDeleteLayers: (layerIds: string[]) => void;
  onReorder: (
    dragId: string,
    targetId: string,
    position: "above" | "inside" | "below"
  ) => void;
  onToggleVisibility: (nodeId: string) => void;
  onToggleLock: (nodeId: string) => void;
  onRenameLayer: (nodeId: string, name: string) => void;
  onToggleOutline: (layerId: string, value: boolean) => void;
  onToggleShadow: (layerId: string, value: boolean) => void;
  onOutlineWidthChange: (layerId: string, width: number) => void;
  onShadowDistanceChange: (layerId: string, distance: number) => void;
  onLightRadiusChange: (layerId: string, radius: number) => void;
  onLightIntensityChange: (layerId: string, intensity: number) => void;
  shadowOpacityByLayer: Record<string, number | undefined>;
  onShadowOpacityChange: (layerId: string, opacity: number) => void;
  shadeOpacityByLayer: Record<string, number | undefined>;
  onShadeOpacityChange: (layerId: string, opacity: number) => void;
  onDarknessOpacityChange: (opacity: number) => void;
  onSelectTilesForLayers?: (layerIds: string[]) => void;
  onCreateGroupFromLayers?: (layerIds: string[]) => void;
  onSavePreset?: (name: string, visibleLayerIds: string[]) => void;
  onApplyPreset?: (presetId: string) => void;
};

const iconButtonStyle: React.CSSProperties = {
  border: "1px solid #dfe6e9",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  width: 26,
  height: 26,
  padding: 0,
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const contextMenuItemStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 10px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 12,
  display: "block",
  whiteSpace: "nowrap",
};

const LockIcon: React.FC<{ locked: boolean }> = ({ locked }) => (
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
    {locked ? (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" ry="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ) : (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" ry="2" />
        <path d="M12 15v2" />
        <path d="M8 11V7a4 4 0 0 1 7.5-2" />
      </>
    )}
  </svg>
);

const FolderIcon: React.FC = () => (
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
    <path d="M3 6h5l2 2h11v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M3 6v12a2 2 0 0 0 2 2h14" />
  </svg>
);

const PlusIcon: React.FC = () => (
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
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon: React.FC = () => (
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
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const LayerRow: React.FC<{
  node: LayerNode;
  depth: number;
  isSelected: boolean;
  soloActive: boolean;
  isSolo: boolean;
  onClick: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onVisibilityClick: (e: React.MouseEvent, nodeId: string) => void;
  onToggleExpand: (nodeId: string) => void;
  onDeleteLayers: (nodeIds: string[]) => void;
  index: number;
  onDragStart: (nodeId: string) => void;
  onDragEnd: () => void;
  onDragOverIndex: (index: number) => void;
  dragInsertIndex: number | null;
  canDropAtGap: (gapIndex: number) => boolean;
  isDragging: boolean;
  isEditing: boolean;
  nameDraft: string;
  onStartEdit: (nodeId: string) => void;
  onNameChange: (nodeId: string, name: string) => void;
  onCommitName: (nodeId: string) => void;
  onCancelEdit: () => void;
  onContextMenu: (event: React.MouseEvent, nodeId: string) => void;
}> = ({
  node,
  depth,
  isSelected,
  soloActive,
  isSolo,
  onClick,
  onDoubleClick,
  onVisibilityClick,
  onToggleExpand,
  onDeleteLayers,
  index,
  onDragStart,
  onDragEnd,
  onDragOverIndex,
  dragInsertIndex,
  canDropAtGap,
  isDragging,
  isEditing,
  nameDraft,
  onStartEdit,
  onNameChange,
  onCommitName,
  onCancelEdit,
  onContextMenu,
}) => {
  const indent = depth * 16;
  const showExpand = node.type === "group";
  const showTopGap = dragInsertIndex === index;
  const showBottomGap = dragInsertIndex === index + 1;
  const topAllowed = showTopGap && canDropAtGap(index);
  const bottomAllowed = showBottomGap && canDropAtGap(index + 1);
  const isPinned =
    node.type === "layer" &&
    ((node as LayerLeaf).role === "background" ||
      (node as LayerLeaf).role === "lighting");
  const showDragHandle =
    node.type === "group" || (node.type === "layer" && !isPinned);
  return (
    <div
      className="battlemap-layer-row"
      onClick={(e) => onClick(e, node.id)}
      onDoubleClick={(e) => onDoubleClick(e, node.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, node.id);
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = (
          e.currentTarget as HTMLDivElement
        ).getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const mid = rect.height / 2;
        const gapIndex = offsetY < mid ? index : index + 1;
        onDragOverIndex(gapIndex);
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "52px 1fr",
        gap: 6,
        alignItems: "center",
        padding: "6px",
        borderRadius: 6,
        background: isSelected
          ? "rgba(78,141,245,0.12)"
          : isPinned
          ? "#f8fafc"
          : "#fff",
        border: isPinned ? "1px solid #eef2f7" : "1px solid transparent",
        borderTop: showTopGap
          ? `2px solid ${topAllowed ? "#4e8df5" : "#cbd5e1"}`
          : "2px solid transparent",
        borderBottom: showBottomGap
          ? `2px solid ${bottomAllowed ? "#4e8df5" : "#cbd5e1"}`
          : "2px solid transparent",
        boxSizing: "border-box",
        outline: "none",
        cursor:
          (showTopGap && !topAllowed && isDragging) ||
          (showBottomGap && !bottomAllowed && isDragging)
            ? "not-allowed"
            : "pointer",
        minHeight: 34,
        marginLeft: indent,
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {showDragHandle ? (
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStart(node.id);
            }}
            onDragEnd={(e) => {
              e.stopPropagation();
              onDragEnd();
            }}
            style={{
              width: 14,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              borderRadius: 4,
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              aria-hidden="true"
              focusable="false"
              style={{ display: "block" }}
            >
              <circle cx="2" cy="2" r="0.75" fill="#9ca3af" />
              <circle cx="5" cy="2" r="0.75" fill="#9ca3af" />
              <circle cx="8" cy="2" r="0.75" fill="#9ca3af" />
              <circle cx="2" cy="5" r="0.75" fill="#9ca3af" />
              <circle cx="5" cy="5" r="0.75" fill="#9ca3af" />
              <circle cx="8" cy="5" r="0.75" fill="#9ca3af" />
            </svg>
          </div>
        ) : (
          <div style={{ width: 14, height: 24 }} />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onVisibilityClick(e, node.id);
          }}
          style={{
            ...iconButtonStyle,
            background: isSolo
              ? "rgba(78,141,245,0.2)"
              : node.visible
              ? "#fff"
              : "#f1f3f5",
          }}
          aria-label="Toggle visibility"
        >
          {node.visible ? "👁" : "🚫"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
          width: "100%",
        }}
      >
        {showExpand ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            style={{
              cursor: "pointer",
              userSelect: "none",
              fontSize: 12,
              lineHeight: 1,
            }}
            aria-label={node.expanded ? "Collapse" : "Expand"}
          >
            {node.expanded ? "▾" : "▸"}
          </span>
        ) : null}
        {showExpand ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FolderIcon />
          </span>
        ) : null}
        {isEditing ? (
          <input
            type="text"
            value={nameDraft}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onNameChange(node.id, e.target.value)}
            onBlur={() => onCommitName(node.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onCommitName(node.id);
              } else if (e.key === "Escape") {
                onCancelEdit();
              }
            }}
            style={{
              fontWeight: showExpand ? 700 : 400,
              fontSize: 12,
              flex: 1,
              width: "100%",
              minWidth: 0,
              padding: "2px 4px",
              borderRadius: 4,
              border: "1px solid #d1d5db",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <div
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartEdit(node.id);
            }}
            style={{
              fontWeight: showExpand ? 700 : 400,
              fontSize: 12,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "text",
            }}
          >
            {node.name}
            {soloActive && isSolo ? " (Solo)" : ""}
            {isPinned ? (
              <span
                style={{
                  marginLeft: 6,
                  padding: "1px 6px",
                  borderRadius: 9999,
                  fontSize: 10,
                  lineHeight: 1.6,
                  background: "#eef2ff",
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                }}
              >
                Pinned
              </span>
            ) : null}
          </div>
        )}
        {node.type === "layer" && node.locked ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 4,
            }}
          >
            <LockIcon locked />
          </span>
        ) : null}
      </div>
    </div>
  );
};

const computeNextSelection = (
  flat: Array<{ node: LayerNode; depth: number }>,
  selected: string[],
  targetId: string,
  opts: { isMeta: boolean; isShift: boolean }
): string[] => {
  if (opts.isShift) {
    const ids = flat
      .filter((f) => f.node.type === "layer" || f.node.type === "group")
      .map((f) => f.node.id);
    if (selected.length === 0) return [targetId];
    const last = selected[selected.length - 1];
    const start = ids.indexOf(last);
    const end = ids.indexOf(targetId);
    if (start === -1 || end === -1) return [targetId];
    const [lo, hi] = start < end ? [start, end] : [end, start];
    return ids.slice(lo, hi + 1);
  }
  if (opts.isMeta) {
    return selected.includes(targetId)
      ? selected.filter((id) => id !== targetId)
      : [...selected, targetId];
  }
  return [targetId];
};

const BattlemapLayersPanel: React.FC<BattlemapLayersPanelProps> = (props) => {
  const { layers, selectedLayerIds, soloLayerId } = props;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragInsertIndex, setDragInsertIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetIds: string[];
  } | null>(null);
  const [layerStyles, setLayerStyles] = useState<{
    layerId: LayerId;
    x: number;
    y: number;
  } | null>(null);
  const [layerStylesTab, setLayerStylesTab] = useState<
    "effects" | "adjustments"
  >("effects");

  const flat = useMemo(() => flattenLayerTree(layers, true, true), [layers]);
  const handleRowClick = (e: React.MouseEvent, nodeId: LayerId) => {
    const isMeta = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;
    props.onSelectedLayerIdsChange(
      computeNextSelection(flat, selectedLayerIds, nodeId, { isMeta, isShift })
    );
  };

  const handleRowDoubleClick = (event: React.MouseEvent, nodeId: LayerId) => {
    const node = layers.nodes[nodeId];
    if (!node || node.type !== "layer") return;
    props.onSelectedLayerIdsChange([nodeId]);
    setLayerStyles({ layerId: nodeId, x: event.clientX, y: event.clientY });
  };

  const beginEdit = (nodeId: LayerId) => {
    const node = layers.nodes[nodeId];
    if (!node) return;
    setEditingId(nodeId);
    setEditingName(node.name);
  };

  const handleNameChange = (nodeId: LayerId, name: string) => {
    if (editingId !== nodeId) return;
    setEditingName(name);
  };

  const commitEdit = (nodeId: LayerId) => {
    if (editingId !== nodeId) return;
    const trimmed = editingName.trim();
    if (trimmed && layers.nodes[nodeId]?.name !== trimmed) {
      props.onRenameLayer(nodeId, trimmed);
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleDragStart = (nodeId: string) => {
    setDraggingId(nodeId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragInsertIndex(null);
  };

  const handleDragOverIndex = (index: number) => {
    if (!draggingId) return;
    setDragInsertIndex(index);
  };

  const handleDrop = () => {
    if (!draggingId || dragInsertIndex === null) {
      handleDragEnd();
      return;
    }
    const ordered: Array<{ node: LayerNode; depth: number }> = [];
    const walk = (ids: LayerId[], depth: number) => {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const node = layers.nodes[id];
        if (!node) continue;
        if (node.type === "layer") {
          const leaf = node as LayerLeaf;
          if (
            leaf.role === "grid" ||
            leaf.role === "tokens" ||
            leaf.role === "fog"
          ) {
            continue;
          }
        }
        ordered.push({ node, depth });
        if (node.type === "group" && node.expanded && node.childIds.length) {
          walk(node.childIds, depth + 1);
        }
      }
    };
    walk(layers.rootIds, 0);

    // Build display list (top-most first) as reverse of natural order
    const displayList = [...ordered].reverse();

    // Compute allowed gap range (root-level) between Background (bottom) and Lighting (top)
    const bgIndex = ordered.findIndex(
      (e) =>
        e.node.type === "layer" && (e.node as LayerLeaf).role === "background"
    );
    const lightIndex = ordered.findIndex(
      (e) =>
        e.node.type === "layer" && (e.node as LayerLeaf).role === "lighting"
    );
    const minGap = bgIndex >= 0 ? bgIndex + 1 : 0; // cannot insert below background (gap before background is 0..bgIndex)
    const maxGap = lightIndex >= 0 ? lightIndex : ordered.length; // cannot insert above lighting (gap after lighting is lightIndex+1)
    const isInsideGap =
      dragInsertIndex > 0 &&
      dragInsertIndex <= ordered.length &&
      ordered[dragInsertIndex - 1]?.node.type === "group";
    if (!isInsideGap) {
      const allowed = dragInsertIndex >= minGap && dragInsertIndex <= maxGap;
      if (!allowed) {
        handleDragEnd();
        return;
      }
    }

    const fromIndexDisplay = displayList.findIndex(
      (e) => e.node.id === draggingId
    );
    if (fromIndexDisplay === -1) {
      handleDragEnd();
      return;
    }
    const rows = displayList.length;
    const fromIndex = rows - 1 - fromIndexDisplay; // natural index
    if (fromIndex === -1) {
      handleDragEnd();
      return;
    }
    // Convert display gap index to natural gap index
    const gapNat = rows - dragInsertIndex;
    if (dragInsertIndex === 0 || dragInsertIndex === rows) {
      // disallow extremes unless inside-group (handled below)
    }
    if (gapNat === fromIndex || gapNat === fromIndex + 1) {
      handleDragEnd();
      return;
    }

    let targetId: string;
    let position: "above" | "inside" | "below";

    // If the gap is immediately after a group row (in display order), interpret this as "drop into that group".
    if (dragInsertIndex > 0 && dragInsertIndex <= displayList.length) {
      const beforeNode = displayList[dragInsertIndex - 1]?.node;
      if (beforeNode && beforeNode.type === "group") {
        targetId = beforeNode.id;
        position = "inside";
      } else {
        // Use natural gap index to compute target
        if (gapNat < ordered.length) {
          targetId = ordered[gapNat].node.id;
          position = "above";
        } else {
          targetId = ordered[gapNat - 1].node.id;
          position = "below";
        }
      }
    } else {
      // Extremes are blocked earlier; keep a safe fallback
      handleDragEnd();
      return;
    }

    const dragNode = layers.nodes[draggingId];
    const targetNode = layers.nodes[targetId];
    if (!dragNode || !targetNode) {
      handleDragEnd();
      return;
    }
    if (
      dragNode.type === "group" &&
      targetNode.type === "group" &&
      isDescendantOf(layers, targetId, draggingId)
    ) {
      handleDragEnd();
      return;
    }

    const next = reorderNode(layers, draggingId, targetId, position);
    try {
      const roots = Array.isArray(next.rootIds) ? next.rootIds : [];
      // Debug: visualize new root order (bottom→top).
      console.log("[Layers] rootIds updated (bottom→top):", roots);
    } catch {}
    props.onLayersChange(next);
    handleDragEnd();
  };

  const handleRowContextMenu = (event: React.MouseEvent, nodeId: LayerId) => {
    const isInSelection = selectedLayerIds.includes(nodeId);
    const targetIds =
      isInSelection && selectedLayerIds.length > 0
        ? [...selectedLayerIds]
        : [nodeId];
    props.onSelectedLayerIdsChange(targetIds);
    setContextMenu({ x: event.clientX, y: event.clientY, targetIds });
  };

  const lockState = useMemo(() => {
    const selectedLayers = selectedLayerIds
      .map((id) => layers.nodes[id])
      .filter((n): n is LayerLeaf => n?.type === "layer");
    const anySelected = selectedLayers.length > 0;
    const anyUnlocked = selectedLayers.some((l) => !l.locked);
    const anyLocked = selectedLayers.some((l) => l.locked);
    const action = anySelected && anyUnlocked ? "lock" : "unlock";
    return { anySelected, anyUnlocked, anyLocked, action };
  }, [layers.nodes, selectedLayerIds]);
  const selectionHasLocked = useMemo(
    () =>
      selectedLayerIds.some((id) => {
        const n = layers.nodes[id];
        return n?.type === "layer" && n.locked;
      }),
    [layers.nodes, selectedLayerIds]
  );

  const toggleLockForSelection = () => {
    if (!lockState.anySelected) return;
    const shouldLock = lockState.action === "lock";
    selectedLayerIds.forEach((id) => {
      const node = layers.nodes[id];
      if (node?.type === "layer") {
        if (shouldLock && !node.locked) props.onToggleLock(id);
        if (!shouldLock && node.locked) props.onToggleLock(id);
      }
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: "100%",
        minHeight: 0,
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
        <div className="battlemap-card__title">Layers</div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            className="battlemap-button"
            title="Add layer"
            onClick={() => props.onCreateLayer(null)}
            style={{
              padding: "6px 10px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PlusIcon />
          </button>
          <button
            className="battlemap-button"
            title="Add group"
            onClick={() => props.onCreateGroup(null)}
            style={{
              padding: "6px 10px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FolderIcon />
          </button>
          <button
            className="battlemap-button"
            title={
              lockState.action === "lock" ? "Lock selected" : "Unlock selected"
            }
            disabled={!lockState.anySelected}
            onClick={toggleLockForSelection}
            style={{
              padding: "6px 10px",
              color: "#111",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <LockIcon locked={lockState.action === "unlock"} />
          </button>
          {selectedLayerIds.length > 0 ? (
            <button
              className="battlemap-button"
              title="Delete selected"
              onClick={() => props.onDeleteLayers(selectedLayerIds)}
              disabled={selectionHasLocked}
              style={{
                padding: "6px 10px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>

        <div
          style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: 4 }}
            onDragOver={(e) => {
              if (!draggingId) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              if (!draggingId) return;
              e.preventDefault();
              handleDrop();
            }}
          >
            {(() => {
              const orderedForList: Array<{ node: LayerNode; depth: number }> =
                [];
              const walk = (ids: LayerId[], depth: number) => {
                // Walk in natural order so the UI mirrors canvas stacking (bottom→top)
                for (let i = 0; i < ids.length; i++) {
                  const id = ids[i];
                  const node = layers.nodes[id];
                  if (!node) continue;
                  if (node.type === "layer") {
                    const leaf = node as LayerLeaf;
                    if (
                      leaf.role === "grid" ||
                      leaf.role === "tokens" ||
                      leaf.role === "fog"
                    ) {
                      continue;
                    }
                  }
                  orderedForList.push({ node, depth });
                  if (
                    node.type === "group" &&
                    node.expanded &&
                    node.childIds.length
                  ) {
                    walk(node.childIds, depth + 1);
                  }
                }
              };
              walk(layers.rootIds, 0);
              const displayList = [...orderedForList].reverse();
              const canDropAtGap = (gapIndex: number) => {
                if (!draggingId) return false;
                const rows = displayList.length;
                // Inside-group always allowed
                if (gapIndex > 0 && gapIndex <= rows) {
                  const beforeNode = displayList[gapIndex - 1]?.node;
                  if (beforeNode && beforeNode.type === "group") return true;
                }
                // Disallow extremes: above Lighting (top) and below Background (bottom)
                if (gapIndex <= 0 || gapIndex >= rows) return false;
                return true;
              };
              return displayList.map(({ node, depth }, index) => (
                <LayerRow
                  key={node.id}
                  node={node}
                  depth={depth}
                  isSelected={selectedLayerIds.includes(node.id)}
                  soloActive={!!soloLayerId}
                  isSolo={soloLayerId === node.id}
                  onClick={handleRowClick}
                  onDoubleClick={handleRowDoubleClick}
                  onVisibilityClick={(e, id) => {
                    if (e.altKey) {
                      props.onSoloLayerChange(soloLayerId === id ? null : id);
                    } else {
                      props.onToggleVisibility(id);
                    }
                  }}
                  onToggleExpand={(id) => {
                    const n = layers.nodes[id];
                    if (n?.type !== "group") return;
                    props.onLayersChange({
                      ...layers,
                      nodes: {
                        ...layers.nodes,
                        [id]: { ...n, expanded: !n.expanded } as LayerGroup,
                      },
                    });
                  }}
                  onDeleteLayers={props.onDeleteLayers}
                  index={index}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOverIndex={handleDragOverIndex}
                  dragInsertIndex={dragInsertIndex}
                  canDropAtGap={canDropAtGap}
                  isDragging={!!draggingId}
                  isEditing={editingId === node.id}
                  nameDraft={editingId === node.id ? editingName : node.name}
                  onStartEdit={beginEdit}
                  onNameChange={handleNameChange}
                  onCommitName={commitEdit}
                  onCancelEdit={cancelEdit}
                  onContextMenu={handleRowContextMenu}
                />
              ));
            })()}
          </div>
        </div>
      </div>
      {contextMenu && typeof window !== "undefined"
        ? (() => {
            const layerNodes = contextMenu.targetIds
              .map((id) => layers.nodes[id])
              .filter((n): n is LayerLeaf => n?.type === "layer");
            const hasLayers = layerNodes.length > 0;
            const multipleLayers = layerNodes.length > 1;
            const anyUnlockedInCtx = layerNodes.some((l) => !l.locked);

            const closeMenu = () => setContextMenu(null);

            const menu = (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 2147483647,
                }}
                onClick={closeMenu}
              >
                <div
                  style={{
                    position: "absolute",
                    top: contextMenu.y,
                    left: contextMenu.x,
                    transform: "translateY(4px)",
                    background: "#fff",
                    border: "1px solid #dfe6e9",
                    borderRadius: 8,
                    boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
                    minWidth: 140,
                    padding: 4,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {layerNodes.length === 1 ? (
                    <button
                      type="button"
                      style={contextMenuItemStyle}
                      onClick={() => {
                        props.onDuplicateLayer(layerNodes[0].id);
                        closeMenu();
                      }}
                    >
                      Duplicate layer
                    </button>
                  ) : null}
                  {hasLayers && props.onSelectTilesForLayers ? (
                    <button
                      type="button"
                      style={contextMenuItemStyle}
                      onClick={() => {
                        props.onSelectTilesForLayers?.(
                          layerNodes.map((l) => l.id)
                        );
                        closeMenu();
                      }}
                    >
                      Select tiles in layer{multipleLayers ? "s" : ""}
                    </button>
                  ) : null}
                  {multipleLayers && props.onCreateGroupFromLayers ? (
                    <button
                      type="button"
                      style={contextMenuItemStyle}
                      onClick={() => {
                        props.onCreateGroupFromLayers?.(
                          layerNodes.map((l) => l.id)
                        );
                        closeMenu();
                      }}
                    >
                      Group selected layers
                    </button>
                  ) : null}
                  {hasLayers ? (
                    <button
                      type="button"
                      style={contextMenuItemStyle}
                      onClick={() => {
                        layerNodes.forEach((l) => {
                          if (anyUnlockedInCtx && !l.locked) {
                            props.onToggleLock(l.id);
                          } else if (!anyUnlockedInCtx && l.locked) {
                            props.onToggleLock(l.id);
                          }
                        });
                        closeMenu();
                      }}
                    >
                      {anyUnlockedInCtx ? "Lock layer(s)" : "Unlock layer(s)"}
                    </button>
                  ) : null}
                  {hasLayers ? (
                    <button
                      type="button"
                      style={contextMenuItemStyle}
                      onClick={() => {
                        props.onDeleteLayers(contextMenu.targetIds);
                        closeMenu();
                      }}
                    >
                      Delete layer{multipleLayers ? "s" : ""}
                    </button>
                  ) : null}
                </div>
              </div>
            );

            return ReactDOM.createPortal(menu, document.body);
          })()
        : null}
      {layerStyles && typeof window !== "undefined"
        ? (() => {
            const node = layers.nodes[layerStyles.layerId];
            if (!node || node.type !== "layer") return null;
            const leaf = node as LayerLeaf;
            const close = () => setLayerStyles(null);
            const outlineWidth = leaf.outlineWidth ?? 3;
            const shadowDistance = leaf.shadowDistance ?? 0.3;
            const shadowOpacity = props.shadowOpacityByLayer[leaf.id] ?? 0.8;
            const shadeOpacity = props.shadeOpacityByLayer[leaf.id] ?? 0;
            const tint = leaf.tint ?? { color: "#ffffff", alpha: 0 };

            // Color swatches from the provided image
            const swatches = ["#2E3338", "#C4C3AE"];

            const panel = (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 2147483647,
                }}
                onClick={close}
              >
                <div
                  style={{
                    position: "absolute",
                    top: layerStyles.y,
                    left: layerStyles.x,
                    transform: "translate(-50%, 8px)",
                    background: "#fff",
                    border: "1px solid #dfe6e9",
                    borderRadius: 8,
                    boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
                    minWidth: 280,
                    maxWidth: 320,
                    padding: 0,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid #f1f3f5",
                    }}
                  >
                    <div
                      style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}
                    >
                      Layer Styles
                    </div>
                    <div style={{ fontSize: 11, color: "#868e96" }}>
                      {leaf.name}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div
                    style={{
                      display: "flex",
                      borderBottom: "1px solid #f1f3f5",
                      padding: "0 10px",
                      gap: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setLayerStylesTab("effects")}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: layerStylesTab === "effects" ? 600 : 500,
                        color:
                          layerStylesTab === "effects" ? "#2563eb" : "#6b7280",
                        borderBottom:
                          layerStylesTab === "effects"
                            ? "2px solid #2563eb"
                            : "2px solid transparent",
                        marginBottom: "-1px",
                      }}
                    >
                      Effects
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayerStylesTab("adjustments")}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight:
                          layerStylesTab === "adjustments" ? 600 : 500,
                        color:
                          layerStylesTab === "adjustments"
                            ? "#2563eb"
                            : "#6b7280",
                        borderBottom:
                          layerStylesTab === "adjustments"
                            ? "2px solid #2563eb"
                            : "2px solid transparent",
                        marginBottom: "-1px",
                      }}
                    >
                      Adjustments
                    </button>
                  </div>

                  {/* Content */}
                  <div
                    style={{
                      padding: "8px 10px",
                      maxHeight: 400,
                      overflowY: "auto",
                      fontFamily: "var(--font-eb-garamond)",
                    }}
                  >
                    {layerStylesTab === "effects" ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {/* Outline Toggle */}
                        <div>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={leaf.hasOutline}
                              onChange={(e) =>
                                props.onToggleOutline(leaf.id, e.target.checked)
                              }
                              style={{ cursor: "pointer" }}
                            />
                            <span>Outline</span>
                          </label>
                          {leaf.hasOutline && (
                            <div style={{ paddingLeft: 24, marginTop: 6 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  marginBottom: 4,
                                }}
                              >
                                <label
                                  style={{ fontSize: 11, color: "#6b7280" }}
                                >
                                  Thickness
                                </label>
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "#495057",
                                    fontWeight: 500,
                                  }}
                                >
                                  {outlineWidth}px
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={16}
                                step={1}
                                value={outlineWidth}
                                onChange={(e) =>
                                  props.onOutlineWidthChange(
                                    leaf.id,
                                    Number(e.target.value) || 0
                                  )
                                }
                                style={{ width: "100%", height: 4 }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Shadow Toggle */}
                        <div>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={leaf.hasShadow}
                              onChange={(e) =>
                                props.onToggleShadow(leaf.id, e.target.checked)
                              }
                              style={{ cursor: "pointer" }}
                            />
                            <span>Shadow</span>
                          </label>
                          {leaf.hasShadow && (
                            <div
                              style={{
                                paddingLeft: 24,
                                marginTop: 6,
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: 3,
                                  }}
                                >
                                  <label
                                    style={{ fontSize: 11, color: "#6b7280" }}
                                  >
                                    Distance
                                  </label>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "#495057",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {shadowDistance.toFixed(2)}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={shadowDistance}
                                  onChange={(e) =>
                                    props.onShadowDistanceChange(
                                      leaf.id,
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  style={{ width: "100%", height: 4 }}
                                />
                              </div>
                              <div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: 3,
                                  }}
                                >
                                  <label
                                    style={{ fontSize: 11, color: "#6b7280" }}
                                  >
                                    Opacity
                                  </label>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "#495057",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {Math.round(shadowOpacity * 100)}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={shadowOpacity}
                                  onChange={(e) =>
                                    props.onShadowOpacityChange(
                                      leaf.id,
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  style={{ width: "100%", height: 4 }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Lighting controls (Lighting layer only) */}
                        {leaf.id === "lighting" && (
                          <div>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 12,
                                fontWeight: 500,
                              }}
                            >
                              <span>Lighting</span>
                            </label>
                            <div
                              style={{
                                paddingLeft: 0,
                                marginTop: 6,
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: 3,
                                  }}
                                >
                                  <label
                                    style={{ fontSize: 11, color: "#6b7280" }}
                                  >
                                    Darkness
                                  </label>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "#495057",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {Math.round(
                                      (props.layers.mapDarknessOpacity ?? 0) *
                                        100
                                    )}
                                    %
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={props.layers.mapDarknessOpacity ?? 0}
                                  onChange={(e) =>
                                    props.onDarknessOpacityChange(
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  style={{ width: "100%", height: 4 }}
                                />
                              </div>
                              <div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: 3,
                                  }}
                                >
                                  <label
                                    style={{ fontSize: 11, color: "#6b7280" }}
                                  >
                                    Intensity
                                  </label>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "#495057",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {Math.round(
                                      (leaf.lightIntensity ?? 1) * 100
                                    )}
                                    %
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={leaf.lightIntensity ?? 1}
                                  onChange={(e) =>
                                    props.onLightIntensityChange(
                                      leaf.id,
                                      Number(e.target.value) || 1
                                    )
                                  }
                                  style={{ width: "100%", height: 4 }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {/* Tint Section */}
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              marginBottom: 6,
                              color: "#1f2937",
                            }}
                          >
                            Tint
                          </div>
                          <div>
                            <div
                              style={{
                                display: "flex",
                                gap: 5,
                                marginBottom: 6,
                              }}
                            >
                              {swatches.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() =>
                                    props.onTintChange(leaf.id, {
                                      color,
                                      alpha: tint.alpha,
                                    })
                                  }
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 4,
                                    border:
                                      tint.color === color
                                        ? "2px solid #2563eb"
                                        : "2px solid #e5e7eb",
                                    background: color,
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                  title={color}
                                />
                              ))}
                            </div>
                            <div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  marginBottom: 3,
                                }}
                              >
                                <label
                                  style={{ fontSize: 11, color: "#6b7280" }}
                                >
                                  Intensity
                                </label>
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: "#495057",
                                    fontWeight: 500,
                                  }}
                                >
                                  {Math.round(tint.alpha * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={tint.alpha}
                                onChange={(e) =>
                                  props.onTintChange(leaf.id, {
                                    color: tint.color,
                                    alpha: Number(e.target.value) || 0,
                                  })
                                }
                                style={{ width: "100%", height: 4 }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Shade Section */}
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              marginBottom: 6,
                              color: "#1f2937",
                            }}
                          >
                            Shade
                          </div>
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 3,
                              }}
                            >
                              <label style={{ fontSize: 11, color: "#6b7280" }}>
                                Opacity
                              </label>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "#495057",
                                  fontWeight: 500,
                                }}
                              >
                                {Math.round(shadeOpacity * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={shadeOpacity}
                              onChange={(e) =>
                                props.onShadeOpacityChange(
                                  leaf.id,
                                  Number(e.target.value) || 0
                                )
                              }
                              style={{ width: "100%", height: 4 }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      padding: "6px 10px",
                      borderTop: "1px solid #f1f3f5",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        props.onToggleOutline(leaf.id, false);
                        props.onToggleShadow(leaf.id, false);
                        props.onTintChange(leaf.id, {
                          color: "#ffffff",
                          alpha: 0,
                        });
                        props.onShadeOpacityChange(leaf.id, 0);
                      }}
                      style={{
                        fontSize: 11,
                        padding: "4px 10px",
                        borderRadius: 4,
                        border: "1px solid #dfe6e9",
                        background: "#fff",
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      style={{
                        fontSize: 11,
                        padding: "4px 12px",
                        borderRadius: 4,
                        border: "none",
                        background: "#2563eb",
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            );

            return ReactDOM.createPortal(panel, document.body);
          })()
        : null}
    </div>
  );
};

export default BattlemapLayersPanel;
