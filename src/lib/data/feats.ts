import type { AbilityKey } from "@/lib/types/advancement";

export interface FeatPrerequisite {
  type: "ability";
  ability: AbilityKey;
  minimum: number;
}

export interface FeatData {
  id: string;
  name: string;
  description: string;
  abilityIncreases?: Partial<Record<AbilityKey, number>>;
  prerequisites?: FeatPrerequisite[];
}

export const SRD_FEATS: FeatData[] = [
  {
    id: "grappler",
    name: "Grappler",
    description:
      "You have advantage on attack rolls against a creature you are grappling, and you can try to pin a grappled foe as an action.",
    prerequisites: [{ type: "ability", ability: "STR", minimum: 13 }],
  },
  {
    id: "skilled",
    name: "Skilled",
    description: "Gain proficiency in any combination of three skills or tools of your choice.",
  },
  {
    id: "tough",
    name: "Tough",
    description: "Your hit point maximum increases by an amount equal to twice your level when you gain this feat.",
  },
];

export const FEATS_BY_ID = SRD_FEATS.reduce<Record<string, FeatData>>((acc, feat) => {
  acc[feat.id] = feat;
  return acc;
}, {});
