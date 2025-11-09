// src/lib/rules/computeModifiers.ts

import type { AbilityScores } from "@/lib/types/Character";

export const abilityMod = (score: number): number =>
  Math.floor((score - 10) / 2);

export const computeAbilityMods = (abilities: AbilityScores) => ({
  STR: abilityMod(abilities.STR),
  DEX: abilityMod(abilities.DEX),
  CON: abilityMod(abilities.CON),
  INT: abilityMod(abilities.INT),
  WIS: abilityMod(abilities.WIS),
  CHA: abilityMod(abilities.CHA),
});
