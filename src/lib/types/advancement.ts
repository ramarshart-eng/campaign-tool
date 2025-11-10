import type { AbilityScores } from "./Character";

export type AbilityKey = keyof AbilityScores;
export type AbilityPick = AbilityKey | "";

export interface AdvancementChoice {
  mode: "asi" | "feat";
  abilityChoices?: [AbilityPick, AbilityPick];
  featId?: string;
}

export type AdvancementMap = Record<number, AdvancementChoice>;
