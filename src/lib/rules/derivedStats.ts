import type { SRDClass, SRDRace } from "@/lib/types/SRD";
import type { AbilityScores } from "@/lib/types/Character";
import type { AbilityKey, AdvancementMap } from "@/lib/types/advancement";

export interface ClassLikeSelection {
  classRef: Pick<SRDClass, "index" | "name" | "hit_die"> | null;
  level: number;
}

export const getTotalLevel = (selections: ClassLikeSelection[] = []): number =>
  selections.reduce((sum, entry) => sum + Math.max(0, entry.level || 0), 0);

export const getProficiencyBonus = (totalLevel: number): number => {
  if (totalLevel >= 17) return 6;
  if (totalLevel >= 13) return 5;
  if (totalLevel >= 9) return 4;
  if (totalLevel >= 5) return 3;
  return 2;
};

const averageHitDie = (hitDie: number): number => {
  if (!hitDie) return 0;
  return Math.floor(hitDie / 2) + 1;
};

export const estimateHitPoints = (
  selections: ClassLikeSelection[] = [],
  conMod: number
): { base: number; conBonus: number; total: number } => {
  if (!selections.length) {
    return { base: 0, conBonus: 0, total: 0 };
  }
  let base = 0;
  let firstLevel = true;
  selections.forEach((entry) => {
    const hitDie = entry.classRef?.hit_die ?? 0;
    for (let lvl = 0; lvl < entry.level; lvl++) {
      if (firstLevel) {
        base += hitDie;
        firstLevel = false;
      } else {
        base += averageHitDie(hitDie);
      }
    }
  });
  const totalLevels = getTotalLevel(selections);
  const conBonus = conMod * totalLevels;
  return { base, conBonus, total: base + conBonus };
};

export const applyRacialBonuses = (
  base: AbilityScores,
  race: SRDRace | null
): AbilityScores => {
  if (!race?.ability_bonuses?.length) return { ...base };
  const result: AbilityScores = { ...base };
  race.ability_bonuses.forEach((bonus) => {
    const abilityKey = bonus.ability_score.index.toUpperCase() as keyof AbilityScores;
    result[abilityKey] = (result[abilityKey] ?? 0) + bonus.bonus;
  });
  return result;
};

export const getAsiLevels = (selections: ClassLikeSelection[] = []): number[] => {
  const baseLevels = new Set([4, 8, 12, 16, 19]);
  selections.forEach((entry) => {
    const index = entry.classRef?.index;
    if (!index) return;
    if (index === "fighter") {
      baseLevels.add(6);
      baseLevels.add(14);
    }
    if (index === "rogue") {
      baseLevels.add(10);
    }
  });
  return Array.from(baseLevels).sort((a, b) => a - b);
};

interface FeatAbilitySource {
  abilityIncreases?: Partial<Record<AbilityKey, number>>;
}

interface AbilityImprovementOptions {
  featsById?: Record<string, FeatAbilitySource>;
  levelFilter?: (level: number) => boolean;
}

export const applyAbilityScoreImprovements = (
  base: AbilityScores,
  advancements: AdvancementMap | undefined,
  totalLevel: number,
  options?: AbilityImprovementOptions
): AbilityScores => {
  const result: AbilityScores = { ...base };
  if (!advancements) return result;
  const featsMap = options?.featsById ?? {};
  const levelFilter = options?.levelFilter;

  Object.entries(advancements).forEach(([levelStr, choice]) => {
    const level = Number(levelStr);
    if (!choice || Number.isNaN(level) || level > totalLevel) return;
    if (levelFilter && !levelFilter(level)) return;
    if (choice.mode === "asi" && choice.abilityChoices) {
      choice.abilityChoices.forEach((pick) => {
        if (!pick) return;
        result[pick] = Math.min(20, (result[pick] ?? 0) + 1);
      });
    } else if (choice.mode === "feat" && choice.featId) {
      const feat = featsMap[choice.featId];
      if (feat?.abilityIncreases) {
        Object.entries(feat.abilityIncreases).forEach(([ability, amount]) => {
          const key = ability as AbilityKey;
          if (!amount) return;
          result[key] = Math.min(20, (result[key] ?? 0) + amount);
        });
      }
    }
  });

  return result;
};
