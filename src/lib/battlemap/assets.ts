import manifestJson from "../../../public/assets/battlemap/manifest.json";

export type BattlemapIconId = keyof typeof manifestJson.icons;
export type BattlemapGridId = keyof typeof manifestJson.grid;
export type BattlemapTokenId = keyof typeof manifestJson.tokens;
export type BattlemapPanelId = keyof typeof manifestJson.panels;

export interface BattlemapImageAsset {
  "1x": string;
  "2x": string;
  size?: [number, number] | number[];
}

export interface BattlemapPanelAsset {
  image: string;
  image2x?: string;
  nineSlice?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export interface BattlemapAssetManifest {
  version: number;
  icons: Record<BattlemapIconId, BattlemapImageAsset>;
  cursors: Record<string, string>;
  grid: Record<BattlemapGridId, BattlemapImageAsset>;
  tokens: Record<BattlemapTokenId, BattlemapImageAsset>;
  panels: Record<BattlemapPanelId, BattlemapPanelAsset>;
}

export const battlemapAssetManifest: BattlemapAssetManifest = manifestJson;

export interface ResolvedImageAsset {
  src: string;
  srcSet?: string;
  width?: number;
  height?: number;
}

function resolveImageAsset(asset: BattlemapImageAsset): ResolvedImageAsset {
  const sizeArray = asset.size ?? [];
  const [width, height] = sizeArray;
  const srcSet = asset["2x"] ? `${asset["1x"]} 1x, ${asset["2x"]} 2x` : undefined;
  return { src: asset["1x"], srcSet, width, height };
}

export function getBattlemapIcon(id: BattlemapIconId): BattlemapImageAsset {
  return battlemapAssetManifest.icons[id];
}

export function getResolvedBattlemapIcon(id: BattlemapIconId): ResolvedImageAsset {
  return resolveImageAsset(getBattlemapIcon(id));
}

export function getBattlemapGrid(id: BattlemapGridId): BattlemapImageAsset {
  return battlemapAssetManifest.grid[id];
}

export function getResolvedBattlemapGrid(id: BattlemapGridId): ResolvedImageAsset {
  return resolveImageAsset(getBattlemapGrid(id));
}

export function getBattlemapToken(id: BattlemapTokenId): BattlemapImageAsset {
  return battlemapAssetManifest.tokens[id];
}

export function getResolvedBattlemapToken(id: BattlemapTokenId): ResolvedImageAsset {
  return resolveImageAsset(getBattlemapToken(id));
}

export function getBattlemapPanel(id: BattlemapPanelId): BattlemapPanelAsset {
  return battlemapAssetManifest.panels[id];
}

export function getBattlemapCursor(id: keyof typeof manifestJson.cursors): string {
  return battlemapAssetManifest.cursors[id];
}

export interface ManifestValidationIssue {
  path: string;
  message: string;
}

/**
 * Validate manifest integrity so swapped PNGs fail loudly in dev.
 */
export function validateBattlemapManifest(
  manifest: BattlemapAssetManifest = battlemapAssetManifest
): ManifestValidationIssue[] {
  const issues: ManifestValidationIssue[] = [];

  const checkImageAsset = (path: string, asset: BattlemapImageAsset | undefined) => {
    if (!asset) {
      issues.push({ path, message: "Missing asset entry" });
      return;
    }
    if (!asset["1x"]) issues.push({ path, message: "Missing 1x path" });
    if (!asset["2x"]) issues.push({ path, message: "Missing 2x path" });
    if (asset.size && asset.size.length !== 2) {
      issues.push({ path, message: "Size should be a tuple [width,height]" });
    }
  };

  Object.entries(manifest.icons).forEach(([key, asset]) =>
    checkImageAsset(`icons.${key}`, asset)
  );
  Object.entries(manifest.grid).forEach(([key, asset]) =>
    checkImageAsset(`grid.${key}`, asset)
  );
  Object.entries(manifest.tokens).forEach(([key, asset]) =>
    checkImageAsset(`tokens.${key}`, asset)
  );

  Object.entries(manifest.panels).forEach(([key, asset]) => {
    if (!asset) {
      issues.push({ path: `panels.${key}`, message: "Missing panel entry" });
      return;
    }
    if (!asset.image) issues.push({ path: `panels.${key}`, message: "Missing image path" });
    const ns = asset.nineSlice;
    if (ns) {
      const fields: Array<keyof typeof ns> = ["left", "right", "top", "bottom"];
      fields.forEach((f) => {
        if (typeof ns[f] !== "number") {
          issues.push({ path: `panels.${key}.nineSlice.${f}`, message: "Expected number" });
        }
      });
    }
  });

  return issues;
}
