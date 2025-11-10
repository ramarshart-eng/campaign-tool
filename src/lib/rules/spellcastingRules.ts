import type { AbilityScores } from "@/lib/types/Character";
import { abilityMod } from "@/lib/rules/computeModifiers";
import type { AbilityKey } from "@/lib/types/advancement";

export type SpellcastingMode = "prepared" | "known-prepared" | "known";

export interface SpellcastingMeta {
  classIndex: string;
  ability: AbilityKey;
  mode: SpellcastingMode;
  cantripsKnown: number;
  knownCount?: number;
  preparedCount: number;
}

interface ClassCastingConfig {
  ability: AbilityKey;
  mode: SpellcastingMode;
  cantripBreakpoints: Array<{ level: number; count: number }>;
  preparedFormula?: (level: number, abilityMod: number) => number;
  knownFormula?: (level: number) => number;
  knownTable?: Record<number, number>;
  minCasterLevel?: number;
}

const BARD_SPELLS_KNOWN: Record<number, number> = {
  1: 4,
  2: 5,
  3: 6,
  4: 7,
  5: 8,
  6: 9,
  7: 10,
  8: 11,
  9: 12,
  10: 14,
  11: 15,
  12: 15,
  13: 16,
  14: 18,
  15: 19,
  16: 19,
  17: 20,
  18: 22,
  19: 22,
  20: 22,
};

const SORCERER_SPELLS_KNOWN: Record<number, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
  9: 10,
  10: 11,
  11: 12,
  12: 12,
  13: 13,
  14: 13,
  15: 14,
  16: 14,
  17: 15,
  18: 15,
  19: 15,
  20: 15,
};

const WARLOCK_SPELLS_KNOWN: Record<number, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
  9: 10,
  10: 10,
  11: 11,
  12: 11,
  13: 12,
  14: 13,
  15: 13,
  16: 14,
  17: 14,
  18: 15,
  19: 15,
  20: 15,
};

const CLASS_CASTING: Record<string, ClassCastingConfig> = {
  cleric: {
    ability: "WIS",
    mode: "prepared",
    cantripBreakpoints: [
      { level: 1, count: 3 },
      { level: 4, count: 4 },
      { level: 10, count: 5 },
    ],
    preparedFormula: (level, abilityMod) => Math.max(1, abilityMod + level),
  },
  druid: {
    ability: "WIS",
    mode: "prepared",
    cantripBreakpoints: [
      { level: 1, count: 2 },
      { level: 4, count: 3 },
      { level: 10, count: 4 },
    ],
    preparedFormula: (level, abilityMod) => Math.max(1, abilityMod + level),
  },
  wizard: {
    ability: "INT",
    mode: "known-prepared",
    cantripBreakpoints: [
      { level: 1, count: 3 },
      { level: 4, count: 4 },
      { level: 10, count: 5 },
    ],
    preparedFormula: (level, abilityMod) => Math.max(1, abilityMod + level),
    knownFormula: (level) => 6 + Math.max(0, level - 1) * 2,
  },
  bard: {
    ability: "CHA",
    mode: "known",
    cantripBreakpoints: [
      { level: 1, count: 2 },
      { level: 4, count: 3 },
      { level: 10, count: 4 },
      { level: 16, count: 5 },
    ],
    knownTable: BARD_SPELLS_KNOWN,
  },
  sorcerer: {
    ability: "CHA",
    mode: "known",
    cantripBreakpoints: [
      { level: 1, count: 4 },
      { level: 4, count: 5 },
      { level: 10, count: 6 },
    ],
    knownTable: SORCERER_SPELLS_KNOWN,
  },
  warlock: {
    ability: "CHA",
    mode: "known",
    cantripBreakpoints: [
      { level: 1, count: 2 },
      { level: 4, count: 3 },
      { level: 10, count: 4 },
    ],
    knownTable: WARLOCK_SPELLS_KNOWN,
  },
};

const pickBreakpoint = (breakpoints: Array<{ level: number; count: number }>, level: number) => {
  let current = breakpoints[0]?.count ?? 0;
  breakpoints.forEach((bp) => {
    if (level >= bp.level) current = bp.count;
  });
  return current;
};

const pickFromTable = (table: Record<number, number> | undefined, level: number) => {
  if (!table) return 0;
  let current = 0;
  Object.keys(table)
    .map((key) => Number(key))
    .sort((a, b) => a - b)
    .forEach((key) => {
      if (level >= key) current = table[key];
    });
  return current;
};

export const getSpellcastingMeta = (
  classIndex: string,
  classLevel: number,
  abilityScores: AbilityScores
): SpellcastingMeta | null => {
  const config = CLASS_CASTING[classIndex];
  if (!config || classLevel <= 0) return null;
  if (config.minCasterLevel && classLevel < config.minCasterLevel) return null;
  const abilityScore = abilityScores[config.ability];
  const abilityModifier = abilityMod(abilityScore ?? 10);
  const cantripsKnown = pickBreakpoint(config.cantripBreakpoints, classLevel);
  const preparedCount =
    config.mode === "prepared" || config.mode === "known-prepared"
      ? Math.max(0, config.preparedFormula ? config.preparedFormula(classLevel, abilityModifier) : 0)
      : 0;
  let knownCount: number | undefined;
  if (config.mode !== "prepared") {
    if (config.knownTable) {
      knownCount = pickFromTable(config.knownTable, classLevel);
    } else if (config.knownFormula) {
      knownCount = Math.max(1, config.knownFormula(classLevel));
    }
  }

  return {
    classIndex,
    ability: config.ability,
    mode: config.mode,
    cantripsKnown,
    knownCount,
    preparedCount,
  };
};
