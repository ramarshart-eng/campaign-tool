export type LayerId = string;

export type LayerRole =
  | "background"
  | "grid"
  | "tokens"
  | "fog"
  | "lighting"
  | "normal";

export type LayerNode = LayerLeaf | LayerGroup;

export type LayerStack = {
  rootIds: LayerId[];
  nodes: Record<LayerId, LayerNode>;
  mapDarknessOpacity?: number; // 0–1, darkness level for the entire map
};

export type LayerLeaf = {
  id: LayerId;
  type: "layer";
  role: LayerRole;
  name: string;
  parentId: LayerId | null;
  visible: boolean;
  locked: boolean;
  tint: { color: string; alpha: number } | null;
  hasOutline: boolean;
  hasShadow: boolean;
  outlineWidth?: number;
  shadowDistance?: number; // in tiles, 0–1
  shadowOpacity?: number; // 0–1
  shadeOpacity?: number; // 0–1, for applying the shading texture over the entire layer
  lightRadius?: number; // in tiles, for lighting layers
  lightIntensity?: number; // 0–1, brightness multiplier for lights
};

export type LayerGroup = {
  id: LayerId;
  type: "group";
  name: string;
  parentId: LayerId | null;
  visible: boolean;
  locked: boolean;
  expanded: boolean;
  childIds: LayerId[];
};

const id = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

// Ensure Background is bottom-most at root and Lighting is top-most at root.
export const normalizeStackExtremes = (stack: LayerStack): LayerStack => {
  const background = findLayerByRole(stack, "background");
  const lighting = findLayerByRole(stack, "lighting");
  if (!background && !lighting) return stack;

  const next: LayerStack = {
    ...stack,
    nodes: { ...stack.nodes },
    rootIds: [...stack.rootIds],
  };

  // Remove background and lighting from any group childIds
  const removeFromGroups = (nodeId: LayerId) => {
    Object.values(next.nodes).forEach((n) => {
      if (n.type === "group" && n.childIds.includes(nodeId)) {
        n.childIds = n.childIds.filter((id) => id !== nodeId);
      }
    });
  };

  if (background) {
    removeFromGroups(background.id);
    const bNode = next.nodes[background.id] as LayerLeaf;
    next.nodes[background.id] = { ...bNode, parentId: null };
  }
  if (lighting) {
    removeFromGroups(lighting.id);
    const lNode = next.nodes[lighting.id] as LayerLeaf;
    next.nodes[lighting.id] = { ...lNode, parentId: null };
  }

  // Ensure rootIds contain background and lighting exactly once
  const roots = next.rootIds.filter(
    (id) => id !== background?.id && id !== lighting?.id
  );
  if (background) roots.unshift(background.id);
  if (lighting) roots.push(lighting.id);
  next.rootIds = roots;
  return next;
};

export const createDefaultLayerStack = (): LayerStack => {
  const background: LayerLeaf = {
    id: "background",
    type: "layer",
    role: "background",
    name: "Background",
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

  const layer1: LayerLeaf = {
    id: "layer-1",
    type: "layer",
    role: "normal",
    name: "Layer 1",
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

  const lighting: LayerLeaf = {
    id: "lighting",
    type: "layer",
    role: "lighting",
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
    lightRadius: 4,
    lightIntensity: 1,
  };

  const nodes: Record<LayerId, LayerNode> = {
    [background.id]: background,
    [layer1.id]: layer1,
    [lighting.id]: lighting,
  };

  return {
    // Render order from bottom to top: Background, Layer 1, Lighting
    // Keeping this deterministic ensures canvas draw order matches the UI intent.
    rootIds: [background.id, layer1.id, lighting.id],
    nodes,
    mapDarknessOpacity: 0,
  };
};

export const findLayerByRole = (
  stack: LayerStack,
  role: LayerRole
): LayerLeaf | undefined => {
  return Object.values(stack.nodes).find(
    (n) => n.type === "layer" && n.role === role
  ) as LayerLeaf | undefined;
};

export const flattenLayerTree = (
  stack: LayerStack,
  includeGroups = true,
  respectExpansion = true
): Array<{ node: LayerNode; depth: number }> => {
  const result: Array<{ node: LayerNode; depth: number }> = [];
  const walk = (ids: LayerId[], depth: number) => {
    for (const id of ids) {
      const node = stack.nodes[id];
      if (!node) continue;
      if (includeGroups || node.type === "layer") {
        result.push({ node, depth });
      }
      const shouldWalkChildren =
        node.type === "group" &&
        node.childIds.length &&
        (!respectExpansion || node.expanded);
      if (shouldWalkChildren) {
        walk(node.childIds, depth + 1);
      }
    }
  };
  walk(stack.rootIds, 0);
  return result;
};

export const toggleVisibility = (
  stack: LayerStack,
  nodeId: LayerId
): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node) return stack;
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, visible: !node.visible } as LayerNode;
  return next;
};

export const toggleLock = (stack: LayerStack, nodeId: LayerId): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node) return stack;
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, locked: !node.locked } as LayerNode;
  return next;
};

export const renameNode = (
  stack: LayerStack,
  nodeId: LayerId,
  name: string
): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node) return stack;
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, name } as LayerNode;
  return next;
};

export const setOutline = (
  stack: LayerStack,
  nodeId: LayerId,
  value: boolean
): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node || node.type !== "layer") return stack;
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, hasOutline: value };
  return next;
};

export const setShadow = (
  stack: LayerStack,
  nodeId: LayerId,
  value: boolean
): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node || node.type !== "layer") return stack;
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, hasShadow: value };
  return next;
};

export const setOutlineWidth = (
  stack: LayerStack,
  nodeId: LayerId,
  width: number
): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node || node.type !== "layer") return stack;
  const clamped = Math.max(0, Math.min(width, 32));
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, outlineWidth: clamped };
  return next;
};

export const setShadowDistance = (
  stack: LayerStack,
  nodeId: LayerId,
  distance: number
): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node || node.type !== "layer") return stack;
  const clamped = Math.max(0, Math.min(distance, 1));
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, shadowDistance: clamped };
  return next;
};

export const setShadowOpacity = (
  stack: LayerStack,
  nodeId: LayerId,
  opacity: number
): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node || node.type !== "layer") return stack;
  const clamped = Math.max(0, Math.min(opacity, 1));
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, shadowOpacity: clamped };
  return next;
};

export const setShadeOpacity = (
  stack: LayerStack,
  nodeId: LayerId,
  opacity: number
): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node || node.type !== "layer") return stack;
  const clamped = Math.max(0, Math.min(opacity, 1));
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, shadeOpacity: clamped };
  return next;
};

export const setLightRadius = (
  stack: LayerStack,
  nodeId: LayerId,
  radius: number
): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node || node.type !== "layer") return stack;
  const clamped = Math.max(0.1, Math.min(radius, 10)); // Allow 0.1 to 10 tiles
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, lightRadius: clamped };
  return next;
};

export const setLightIntensity = (
  stack: LayerStack,
  nodeId: LayerId,
  intensity: number
): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node || node.type !== "layer") return stack;
  const clamped = Math.max(0, Math.min(intensity, 1)); // Allow 0 to 1
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, lightIntensity: clamped };
  return next;
};

export const setDarknessOpacity = (
  stack: LayerStack,
  opacity: number
): LayerStack => {
  const clamped = Math.max(0, Math.min(opacity, 1));
  return { ...stack, mapDarknessOpacity: clamped };
};

export const setTint = (
  stack: LayerStack,
  nodeId: LayerId,
  tint: { color: string; alpha: number } | null
): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node || node.type !== "layer") return stack;
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  next.nodes[nodeId] = { ...node, tint };
  return next;
};

export const insertNewLayer = (
  stack: LayerStack,
  opts: {
    parentId: LayerId | null;
    name?: string;
    role?: LayerRole;
    aboveLayerId?: LayerId;
  }
): LayerStack => {
  let name = opts.name;
  if (!name) {
    const existingNames = new Set(
      Object.values(stack.nodes).map((n) => n.name)
    );
    let counter = 1;
    // Find the first "Layer N" that doesn't already exist in the stack.
    // This checks against both layers and groups to avoid any name collisions.
    // We intentionally use a simple 1-based sequence for readability.
    while (true) {
      const candidate = `Layer ${counter}`;
      if (!existingNames.has(candidate)) {
        name = candidate;
        break;
      }
      counter += 1;
    }
  }

  const layer: LayerLeaf = {
    id: id(),
    type: "layer",
    role: opts.role ?? "normal",
    name,
    parentId: opts.parentId ?? null,
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
  const next: LayerStack = {
    ...stack,
    nodes: { ...stack.nodes, [layer.id]: layer },
  };

  // Determine where to insert the layer
  const parentId = opts.parentId ?? null;
  const aboveLayerId = opts.aboveLayerId;

  if (parentId) {
    const parent = stack.nodes[parentId];
    if (parent?.type === "group") {
      if (aboveLayerId) {
        const idx = parent.childIds.indexOf(aboveLayerId);
        if (idx >= 0) {
          // Insert AFTER the reference layer to place it visually above
          next.nodes[parentId] = {
            ...parent,
            childIds: [
              ...parent.childIds.slice(0, idx + 1),
              layer.id,
              ...parent.childIds.slice(idx + 1),
            ],
          };
        } else {
          next.nodes[parentId] = {
            ...parent,
            childIds: [...parent.childIds, layer.id],
          };
        }
      } else {
        next.nodes[parentId] = {
          ...parent,
          childIds: [...parent.childIds, layer.id],
        };
      }
    } else {
      next.rootIds = [...stack.rootIds, layer.id];
    }
  } else {
    if (aboveLayerId) {
      const idx = stack.rootIds.indexOf(aboveLayerId);
      if (idx >= 0) {
        let insertIndex = idx + 1; // visually above the reference
        const lightingLeaf = findLayerByRole(stack, "lighting");
        const lightingIndex = lightingLeaf
          ? stack.rootIds.indexOf(lightingLeaf.id)
          : -1;
        if (lightingIndex !== -1 && insertIndex > lightingIndex) {
          insertIndex = lightingIndex; // do not insert above lighting
        }
        next.rootIds = [
          ...stack.rootIds.slice(0, insertIndex),
          layer.id,
          ...stack.rootIds.slice(insertIndex),
        ];
      } else {
        const lightingLeaf = findLayerByRole(stack, "lighting");
        const lightingIndex = lightingLeaf
          ? stack.rootIds.indexOf(lightingLeaf.id)
          : -1;
        if (lightingIndex !== -1) {
          next.rootIds = [
            ...stack.rootIds.slice(0, lightingIndex),
            layer.id,
            ...stack.rootIds.slice(lightingIndex),
          ];
        } else {
          next.rootIds = [...stack.rootIds, layer.id];
        }
      }
    } else {
      // Default: insert just below Lighting (i.e., before it), or at end if no Lighting exists
      const lightingLeaf = findLayerByRole(stack, "lighting");
      const lightingIndex = lightingLeaf
        ? stack.rootIds.indexOf(lightingLeaf.id)
        : -1;
      if (lightingIndex !== -1) {
        next.rootIds = [
          ...stack.rootIds.slice(0, lightingIndex),
          layer.id,
          ...stack.rootIds.slice(lightingIndex),
        ];
      } else {
        next.rootIds = [...stack.rootIds, layer.id];
      }
    }
  }
  return normalizeStackExtremes(next);
};

export const insertNewGroup = (
  stack: LayerStack,
  opts: { parentId: LayerId | null; name?: string }
): LayerStack => {
  const group: LayerGroup = {
    id: id(),
    type: "group",
    name: opts.name ?? "New Group",
    parentId: opts.parentId ?? null,
    visible: true,
    locked: false,
    expanded: true,
    childIds: [],
  };
  const next: LayerStack = {
    ...stack,
    nodes: { ...stack.nodes, [group.id]: group },
  };
  if (opts.parentId) {
    const parent = stack.nodes[opts.parentId];
    if (parent?.type === "group") {
      next.nodes[opts.parentId] = {
        ...parent,
        childIds: [...parent.childIds, group.id],
      };
    } else {
      next.rootIds = [...stack.rootIds, group.id];
    }
  } else {
    next.rootIds = [...stack.rootIds, group.id];
  }
  return normalizeStackExtremes(next);
};

export const deleteNodes = (
  stack: LayerStack,
  nodeIds: LayerId[]
): LayerStack => {
  const toDelete = new Set(nodeIds);
  const nextNodes: Record<LayerId, LayerNode> = {};

  const filterIds = (ids: LayerId[]): LayerId[] =>
    ids
      .filter((id) => !toDelete.has(id))
      .map((id) => {
        const node = stack.nodes[id];
        if (node?.type === "group") {
          return node.id;
        }
        return id;
      });

  for (const [id, node] of Object.entries(stack.nodes)) {
    if (toDelete.has(id)) continue;
    if (node.type === "group") {
      nextNodes[id] = { ...node, childIds: filterIds(node.childIds) };
    } else {
      nextNodes[id] = node;
    }
  }

  const nextRootIds = filterIds(stack.rootIds);
  return normalizeStackExtremes({ rootIds: nextRootIds, nodes: nextNodes });
};

const removeFromParent = (stack: LayerStack, nodeId: LayerId): LayerStack => {
  const node = stack.nodes[nodeId];
  if (!node) return stack;
  if (node.parentId) {
    const parent = stack.nodes[node.parentId];
    if (parent?.type === "group") {
      return {
        ...stack,
        nodes: {
          ...stack.nodes,
          [parent.id]: {
            ...parent,
            childIds: parent.childIds.filter((id) => id !== nodeId),
          },
        },
      };
    }
  } else {
    return { ...stack, rootIds: stack.rootIds.filter((id) => id !== nodeId) };
  }
  return stack;
};

export const reorderNode = (
  stack: LayerStack,
  dragId: LayerId,
  targetId: LayerId,
  position: "above" | "inside" | "below"
): LayerStack => {
  if (dragId === targetId) return stack;
  const dragNode = stack.nodes[dragId];
  const targetNode = stack.nodes[targetId];
  if (!dragNode || !targetNode) return stack;

  // Enforce hard constraints:
  // - Nothing can be placed below the Background layer (Background must be first at root)
  // - Nothing can be placed above the Lighting layer (Lighting must be last at root)
  // - Background/Lighting cannot be moved into groups; they always live at root extremes
  const backgroundLeaf = findLayerByRole(stack, "background");
  const lightingLeaf = findLayerByRole(stack, "lighting");
  const backgroundId = backgroundLeaf?.id;
  const lightingId = lightingLeaf?.id;

  // If dragging Background or Lighting, force them to root extremes regardless of target/position.
  if (dragId === backgroundId) {
    // Remove from any parent, then ensure it's at index 0 of rootIds
    let next = removeFromParent(stack, dragId);
    const roots = next.rootIds.filter((id) => id !== dragId);
    next = {
      ...next,
      rootIds: [dragId, ...roots.filter((id) => id !== dragId)],
      nodes: { ...next.nodes, [dragId]: { ...dragNode, parentId: null } },
    };
    return normalizeStackExtremes(next);
  }
  if (dragId === lightingId) {
    // Remove from any parent, then ensure it's at the end of rootIds
    let next = removeFromParent(stack, dragId);
    const roots = next.rootIds.filter((id) => id !== dragId);
    next = {
      ...next,
      rootIds: [...roots.filter((id) => id !== dragId), dragId],
      nodes: { ...next.nodes, [dragId]: { ...dragNode, parentId: null } },
    };
    return normalizeStackExtremes(next);
  }

  let next = removeFromParent(stack, dragId);

  if (position === "inside" && targetNode.type === "group") {
    // Prevent placing Background/Lighting inside groups (already handled above if dragId matches)
    const baseTarget = (next.nodes[targetId] as LayerGroup) ?? targetNode;
    const updatedTarget: LayerGroup = {
      ...baseTarget,
      // Ensure the dragged id appears only once, appended at the end.
      childIds: [...baseTarget.childIds.filter((id) => id !== dragId), dragId],
    };
    next = {
      ...next,
      nodes: {
        ...next.nodes,
        [dragId]: { ...dragNode, parentId: targetNode.id },
        [targetNode.id]: updatedTarget,
      },
    };
    return next;
  }

  const parentId = targetNode.parentId;
  if (parentId) {
    const parent = next.nodes[parentId];
    if (parent?.type === "group") {
      const newChildIds = parent.childIds.filter((id) => id !== dragId);
      const targetIndex = newChildIds.indexOf(targetId);
      if (targetIndex === -1) return stack;
      newChildIds.splice(
        position === "above" ? targetIndex : targetIndex + 1,
        0,
        dragId
      );
      next = {
        ...next,
        nodes: {
          ...next.nodes,
          [dragId]: { ...dragNode, parentId },
          [parent.id]: { ...parent, childIds: newChildIds },
        },
      };
      return next;
    }
  }

  // root level
  const filteredRoot = next.rootIds.filter((id) => id !== dragId);
  const targetIndex = filteredRoot.indexOf(targetId);
  if (targetIndex === -1) return stack;
  let insertIndex = position === "above" ? targetIndex : targetIndex + 1;
  // Clamp insert index so it cannot go below Background or above Lighting
  const bgIndex = backgroundId ? filteredRoot.indexOf(backgroundId) : -1;
  const lightIndex = lightingId ? filteredRoot.indexOf(lightingId) : -1;
  // Ensure background stays at index 0
  const minIndex = bgIndex === -1 ? 0 : 1; // cannot insert before background
  // Ensure lighting stays at the end
  const maxIndex = lightIndex === -1 ? filteredRoot.length : lightIndex; // cannot insert after lighting
  if (insertIndex < minIndex) insertIndex = minIndex;
  if (insertIndex > maxIndex) insertIndex = maxIndex;
  filteredRoot.splice(insertIndex, 0, dragId);
  next = {
    ...next,
    rootIds: filteredRoot,
    nodes: { ...next.nodes, [dragId]: { ...dragNode, parentId: null } },
  };
  return normalizeStackExtremes(next);
};

export const duplicateLayer = (
  stack: LayerStack,
  layerId: LayerId
): LayerStack => {
  const node = stack.nodes[layerId];
  if (!node || node.type !== "layer") return stack;
  const dup: LayerLeaf = { ...node, id: id(), name: `${node.name} Copy` };
  const next: LayerStack = {
    ...stack,
    nodes: { ...stack.nodes, [dup.id]: dup },
  };
  if (node.parentId) {
    const parent = stack.nodes[node.parentId];
    if (parent?.type === "group") {
      const idx = parent.childIds.indexOf(layerId);
      const childIds = [...parent.childIds];
      childIds.splice(idx + 1, 0, dup.id);
      next.nodes[parent.id] = { ...parent, childIds };
    } else {
      next.rootIds = [...stack.rootIds, dup.id];
    }
  } else {
    const idx = stack.rootIds.indexOf(layerId);
    const roots = [...stack.rootIds];
    roots.splice(idx + 1, 0, dup.id);
    next.rootIds = roots;
  }
  return normalizeStackExtremes(next);
};

export const getVisibleLayerIds = (stack: LayerStack): LayerId[] => {
  return flattenLayerTree(stack, true, false)
    .map((entry) => entry.node)
    .filter((n): n is LayerLeaf => n.type === "layer" && n.visible)
    .map((n) => n.id);
};

export const applyVisibilityPreset = (
  stack: LayerStack,
  preset: { visibleLayerIds: LayerId[] }
): LayerStack => {
  const visibleSet = new Set(preset.visibleLayerIds);
  const next: LayerStack = { ...stack, nodes: { ...stack.nodes } };
  Object.values(next.nodes).forEach((node) => {
    if (node.type === "layer") {
      next.nodes[node.id] = { ...node, visible: visibleSet.has(node.id) };
    }
  });
  return next;
};

export const isDescendantOf = (
  stack: LayerStack,
  nodeId: LayerId,
  ancestorId: LayerId
): boolean => {
  let current: LayerNode | undefined = stack.nodes[nodeId];
  while (current && current.parentId) {
    if (current.parentId === ancestorId) return true;
    current = stack.nodes[current.parentId];
  }
  return false;
};
