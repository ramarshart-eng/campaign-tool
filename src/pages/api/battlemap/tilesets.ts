import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

type Tileset = {
  id: string;
  name: string;
  tiles: string[];
};

type Environment = {
  id: string;
  name: string;
  categories: Array<{ id: string; name: string }>;
};

type TilesetResponse = { tilesets: Tileset[]; environments: Environment[] };

const BATTLEMAP_ROOT = path.join(process.cwd(), "public", "assets", "battlemap");
const TILESETS_ROOT = path.join(BATTLEMAP_ROOT, "Tilesets");

export default function handler(_req: NextApiRequest, res: NextApiResponse<TilesetResponse | { error: string }>) {
  try {
    const tilesets: Tileset[] = [];
    const envsResult: Environment[] = [];
    if (!fs.existsSync(TILESETS_ROOT)) {
      return res.status(200).json({ tilesets, environments: envsResult });
    }

    // Walk Tilesets/<environment>/<type>/<files>.png (supports one extra nesting level under environment)
    const environments = fs.readdirSync(TILESETS_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory());
    environments.forEach((env) => {
      const envPath = path.join(TILESETS_ROOT, env.name);
      const types = fs.readdirSync(envPath, { withFileTypes: true }).filter((e) => e.isDirectory());
      const categoryNames = new Set<string>();

      if (types.length === 0) {
        // If no type subfolders, treat environment folder as a tileset if it has PNGs.
        const files = fs.readdirSync(envPath).filter((f) => f.toLowerCase().endsWith(".png"));
        if (files.length > 0) {
          tilesets.push({
            id: env.name,
            name: toTitle(env.name),
            tiles: files.map((file) => `/assets/battlemap/Tilesets/${env.name}/${file}`),
          });
        }
        envsResult.push({
          id: env.name,
          name: toTitle(env.name),
          categories: [],
        });
        return;
      }

      types.forEach((typeDir) => {
        const typePath = path.join(envPath, typeDir.name);
        categoryNames.add(typeDir.name);
        const nested = fs.readdirSync(typePath, { withFileTypes: true }).filter((e) => e.isDirectory());

        if (nested.length > 0) {
          // If there's another nesting (e.g., env/type/variant), each variant is its own tileset.
          nested.forEach((variantDir) => {
            const variantPath = path.join(typePath, variantDir.name);
            const files = fs.readdirSync(variantPath).filter((f) => f.toLowerCase().endsWith(".png"));
            if (files.length === 0) return;
            const variantTiles = files.map(
              (file) => `/assets/battlemap/Tilesets/${env.name}/${typeDir.name}/${variantDir.name}/${file}`
            );
            tilesets.push({
              id: `${env.name}/${typeDir.name}/${variantDir.name}`,
              name: `${toTitle(env.name)} / ${toTitle(typeDir.name)} / ${toTitle(variantDir.name)}`,
              tiles: variantTiles,
            });
            tilesets.push({
              id: `${env.name}/brushes/${typeDir.name}/${variantDir.name}`,
              name: `${toTitle(env.name)} / Brushes / ${toTitle(typeDir.name)} / ${toTitle(variantDir.name)}`,
              tiles: pickRandomTile(variantTiles),
            });
          });
        } else {
          const files = fs.readdirSync(typePath).filter((f) => f.toLowerCase().endsWith(".png"));
          if (files.length === 0) return;
          const typeTiles = files.map((file) => `/assets/battlemap/Tilesets/${env.name}/${typeDir.name}/${file}`);
          tilesets.push({
            id: `${env.name}/${typeDir.name}`,
            name: `${toTitle(env.name)} / ${toTitle(typeDir.name)}`,
            tiles: typeTiles,
          });
          tilesets.push({
            id: `${env.name}/brushes/${typeDir.name}`,
            name: `${toTitle(env.name)} / Brushes / ${toTitle(typeDir.name)}`,
            tiles: pickRandomTile(typeTiles),
          });
        }
      });

      categoryNames.add("brushes");

      const categories = Array.from(categoryNames.values());
      const sortedCategories = [
        ...categories.filter((c) => c === "brushes"),
        ...categories.filter((c) => c !== "brushes"),
      ];

      envsResult.push({
        id: env.name,
        name: toTitle(env.name),
        categories: sortedCategories.map((id) => ({ id, name: toTitle(id) })),
      });
    });

    res.status(200).json({ tilesets, environments: envsResult });
  } catch (err) {
    console.error("tileset discovery failed", err);
    res.status(500).json({ error: "Failed to load tilesets" });
  }
}

const toTitle = (slug: string) =>
  slug
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

const pickRandomTile = (tiles: string[]) => {
  if (tiles.length === 0) return [];
  const index = Math.floor(Math.random() * tiles.length);
  return [tiles[index]];
};
