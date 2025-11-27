import monstersJson from "./srd-monsters.json" assert { type: "json" };

export interface SrdAbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface SrdAction {
  name: string;
  desc: string;
  attack_bonus?: number;
  damage_dice?: string;
  damage_bonus?: number;
}

export interface SrdMonster {
  id: string;
  name: string;
  size: string;
  type: string;
  subtype?: string | null;
  alignment?: string | null;
  armor_class: number;
  hit_points: number;
  hit_dice: string;
  speed: string;
  ability_scores: SrdAbilityScores;
  saving_throws?: Record<string, number>;
  skills?: Record<string, number>;
  damage_vulnerabilities?: string;
  damage_resistances?: string;
  damage_immunities?: string;
  condition_immunities?: string;
  senses?: string;
  languages?: string;
  challenge_rating: string;
  xp: number;
  special_abilities?: SrdAction[];
  actions?: SrdAction[];
  legendary_actions?: SrdAction[];
  reactions?: SrdAction[];
}

export interface SrdMonsterSummary {
  id: string;
  name: string;
  cr: string;
  xp: number;
  type: string;
}

const SRD_MONSTERS = monstersJson as SrdMonster[];

export const SRD_MONSTERS_BY_ID = new Map<string, SrdMonster>(
  SRD_MONSTERS.map((monster) => [monster.id, monster])
);

export const SRD_MONSTER_SUMMARIES: SrdMonsterSummary[] = SRD_MONSTERS.map(
  (monster) => ({
    id: monster.id,
    name: monster.name,
    cr: monster.challenge_rating,
    xp: monster.xp,
    type: monster.type,
  })
);

export default SRD_MONSTERS;
