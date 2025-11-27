/**
 * Tile Metadata System
 * Defines properties and effects for tiles based on their category and type
 */

export type TileCategory =
  | "structure"
  | "terrain"
  | "vegetation"
  | "decoration"
  | "hazard"
  | "lighting";

export type TileSubcategory =
  // Structure
  | "walls"
  | "pillars"
  | "railings"
  | "doors"
  | "stairs"
  // Terrain
  | "floor"
  | "ground"
  | "water"
  | "special_surfaces"
  // Vegetation
  | "trees"
  | "bushes"
  | "grass"
  | "flowers"
  // Decoration
  | "furniture"
  | "objects"
  | "torches"
  | "rocks"
  | "chains"
  | "banners"
  // Hazard
  | "fire"
  | "spikes"
  | "traps"
  | "magical"
  // Lighting
  | "light_sources"
  | "shadow_effects";

export type TileEffect =
  | "collision" // Blocks movement
  | "hazard" // Deals damage
  | "interactive" // Can be interacted with
  | "light_source" // Emits light
  | "shadow" // Creates shadow
  | "difficult_terrain" // Slows movement
  | "water" // Water terrain
  | "particle" // Spawn particles (fire, sparks, etc)
  | "sound" // Trigger sound effect
  | "visual_effect" // Special visual effect
  | "unlit"; // Does not receive light from light sources

export type TileMetadata = {
  category: TileCategory;
  subcategory: TileSubcategory;
  name: string;
  effects: TileEffect[];
  // Effect-specific properties
  hazardDamage?: number; // Damage per turn on hazard tiles
  hazardType?: "fire" | "cold" | "lightning" | "poison" | "slashing";
  lightRadius?: number; // Light radius in tiles
  lightColor?: string; // Light color (hex)
  difficultyMultiplier?: number; // Movement cost multiplier for terrain
  interactiveType?: string; // Type of interaction (door, lever, chest, etc)
  soundEvent?: string; // Sound to trigger
  particleType?: string; // Type of particle effect (fire, smoke, sparkle, etc)
};

/**
 * Default metadata for tile categories
 * This serves as a template - specific tiles can override these
 */
export const DEFAULT_TILE_METADATA: Record<
  TileCategory,
  Partial<TileMetadata>
> = {
  structure: {
    effects: ["collision"],
  },
  terrain: {
    effects: [],
  },
  vegetation: {
    effects: [],
  },
  decoration: {
    effects: [],
  },
  hazard: {
    effects: ["hazard"],
    hazardDamage: 1,
  },
  lighting: {
    effects: ["light_source"],
    lightRadius: 2,
    lightColor: "#e1be7a",
  },
};

/**
 * Specific subcategory defaults - more granular control
 */
export const SUBCATEGORY_DEFAULTS: Record<
  TileSubcategory,
  Partial<TileMetadata>
> = {
  // Structure
  walls: { effects: ["collision", "unlit"] },
  pillars: { effects: ["collision", "unlit"] },
  railings: { effects: ["collision", "unlit"] },
  doors: { effects: ["collision", "interactive"], interactiveType: "door" },
  stairs: { effects: [] },

  // Terrain
  floor: { effects: [] },
  ground: { effects: [] },
  water: { effects: ["water", "difficult_terrain"], difficultyMultiplier: 2 },
  special_surfaces: { effects: [] },

  // Vegetation
  trees: { effects: ["collision"] },
  bushes: { effects: [] },
  grass: { effects: [] },
  flowers: { effects: [] },

  // Decoration
  furniture: { effects: ["collision"] },
  objects: { effects: [] },
  torches: {
    effects: ["light_source", "particle"],
    lightRadius: 1.5,
    lightColor: "#ff9955",
    particleType: "fire",
  },
  rocks: { effects: [] },
  chains: { effects: [] },
  banners: { effects: [] },

  // Hazard
  fire: {
    effects: ["hazard", "particle", "light_source"],
    hazardDamage: 2,
    hazardType: "fire",
    particleType: "fire",
    lightRadius: 1.5,
    lightColor: "#ff6b35",
  },
  spikes: {
    effects: ["hazard"],
    hazardDamage: 1,
    hazardType: "slashing",
  },
  traps: {
    effects: ["hazard", "interactive"],
    hazardDamage: 1,
    interactiveType: "trap",
  },
  magical: {
    effects: ["hazard", "particle", "visual_effect"],
    hazardDamage: 1,
    particleType: "sparkle",
  },

  // Lighting
  light_sources: {
    effects: ["light_source"],
    lightRadius: 2,
    lightColor: "#e1be7a",
  },
  shadow_effects: {
    effects: ["shadow"],
  },
};

/**
 * Get metadata for a tile based on category and subcategory
 * Falls back to defaults if not found
 */
export function getTileMetadata(
  category: TileCategory,
  subcategory: TileSubcategory,
  overrides?: Partial<TileMetadata>
): TileMetadata {
  const defaults =
    SUBCATEGORY_DEFAULTS[subcategory] || DEFAULT_TILE_METADATA[category] || {};

  return {
    category,
    subcategory,
    name: toTitleCase(subcategory),
    effects: [],
    ...defaults,
    ...overrides,
  };
}

/**
 * Determine tile category and subcategory from file path
 */
export function parseTilePathMetadata(
  filePath: string
): { category: TileCategory; subcategory: TileSubcategory } | null {
  // Expected format: /assets/battlemap/Tilesets/{Category}/{Subcategory}/...
  const match = filePath.match(/Tilesets\/([^\/]+)\/([^\/]+)\//i);
  if (!match) return null;

  const rawCategory = match[1].toLowerCase();
  const rawSubcategory = match[2].toLowerCase().replace(/\s+/g, "_");

  const validCategories = Object.keys(DEFAULT_TILE_METADATA) as TileCategory[];
  const category = validCategories.find(
    (c) => c.toLowerCase() === rawCategory
  ) as TileCategory | undefined;

  if (!category) return null;

  const validSubcategories = Object.keys(
    SUBCATEGORY_DEFAULTS
  ) as TileSubcategory[];
  const subcategory = validSubcategories.find(
    (s) => s.toLowerCase() === rawSubcategory
  ) as TileSubcategory | undefined;

  if (!subcategory) return null;

  return { category, subcategory };
}

/**
 * Check if a tile has a specific effect
 */
export function hasTileEffect(
  metadata: TileMetadata,
  effect: TileEffect
): boolean {
  return metadata.effects.includes(effect);
}

/**
 * Get all tiles with a specific effect
 */
export function filterTilesByEffect(
  tiles: Array<{ src: string }>,
  effect: TileEffect
): Array<{ src: string; metadata: TileMetadata }> {
  return tiles
    .map((tile) => {
      const pathMeta = parseTilePathMetadata(tile.src);
      if (!pathMeta) return null;
      const metadata = getTileMetadata(pathMeta.category, pathMeta.subcategory);
      return { src: tile.src, metadata };
    })
    .filter(
      (item): item is { src: string; metadata: TileMetadata } =>
        item !== null && hasTileEffect(item.metadata, effect)
    );
}

function toTitleCase(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
