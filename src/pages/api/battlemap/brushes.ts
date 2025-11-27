import type { NextApiRequest, NextApiResponse } from "next";
import {
  loadBattlemapBrushesFromDisk,
  ResolvedBrushDefinition,
  BrushValidationIssue,
} from "@/lib/battlemap/brushes";

type BrushesResponse =
  | { brushes: ResolvedBrushDefinition[]; issues: BrushValidationIssue[] }
  | { error: string };

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<BrushesResponse>
) {
  try {
    const { brushes, issues } = loadBattlemapBrushesFromDisk();
    if (process.env.NODE_ENV !== "production") {
      // Debug visibility during development
      // eslint-disable-next-line no-console
      console.log(
        `[battlemap brushes] loaded ${brushes.length} brushes, ${issues.length} issues`
      );
      issues.forEach((issue) => {
        // eslint-disable-next-line no-console
        console.log(`  [${issue.level}] ${issue.message} (${issue.path})`);
      });
    }
    res.status(200).json({ brushes, issues });
  } catch (err) {
    console.error("battlemap brushes load failed", err);
    res.status(500).json({ error: "Failed to load brushes" });
  }
}
