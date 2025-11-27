import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import {
  parseTilePathMetadata,
  getTileMetadata,
} from "@/lib/battlemap/tileMetadata";
import type { TileMetadata } from "@/lib/battlemap/tileMetadata";

type TileWithMetadataResponse = {
  src: string;
  metadata: TileMetadata;
};

type TileMetadataResponse = {
  tiles: TileWithMetadataResponse[];
};

const BATTLEMAP_ROOT = path.join(
  process.cwd(),
  "public",
  "assets",
  "battlemap"
);
const TILESETS_ROOT = path.join(BATTLEMAP_ROOT, "Tilesets");

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<TileMetadataResponse | { error: string }>
) {
  try {
    const tiles: TileWithMetadataResponse[] = [];

    // Read all main category folders
    const categories = fs.readdirSync(TILESETS_ROOT).filter((name) => {
      const fullPath = path.join(TILESETS_ROOT, name);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const category of categories) {
      const categoryPath = path.join(TILESETS_ROOT, category);

      // Read subcategories
      const subcategories = fs.readdirSync(categoryPath).filter((name) => {
        const fullPath = path.join(categoryPath, name);
        return fs.statSync(fullPath).isDirectory();
      });

      for (const subcategory of subcategories) {
        const subcategoryPath = path.join(categoryPath, subcategory);

        // Read all PNG files
        const files = fs
          .readdirSync(subcategoryPath)
          .filter((f) => f.toLowerCase().endsWith(".png"));

        for (const file of files) {
          const relativePath = `/assets/battlemap/Tilesets/${category}/${subcategory}/${file}`;
          const pathMeta = parseTilePathMetadata(relativePath);

          if (pathMeta) {
            const metadata = getTileMetadata(
              pathMeta.category,
              pathMeta.subcategory
            );
            tiles.push({
              src: relativePath,
              metadata,
            });
          }
        }
      }
    }

    res.status(200).json({ tiles });
  } catch (err) {
    console.error("tile metadata discovery failed", err);
    res.status(500).json({ error: "Failed to load tile metadata" });
  }
}
