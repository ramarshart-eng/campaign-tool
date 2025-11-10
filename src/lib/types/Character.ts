// src/lib/types/Character.ts

import type { ActionButton } from "./ActionButton";
import type { Item } from "./Item";

export interface AbilityScores {
  STR: number;
  DEX: number;
  CON: number;
  INT: number;
  WIS: number;
  CHA: number;
}

export interface SkillDefinition {
  ability: keyof AbilityScores;
  proficient: boolean;
}

// Simple shape for saving throw proficiencies
export interface SavingThrows {
  STR: { proficient: boolean };
  DEX: { proficient: boolean };
  CON: { proficient: boolean };
  INT: { proficient: boolean };
  WIS: { proficient: boolean };
  CHA: { proficient: boolean };
}

export interface Character {
  id: string;
  name: string;
  className: string;
  classBreakdown?: { name: string; level: number }[];
  raceName?: string;
  level: number;
  proficiencyBonus: number;

  maxHp: number;
  currentHp: number;
  armorClass: number;

  abilities: AbilityScores;

  // Skill proficiencies by name (e.g. "Athletics", "Perception")
  skills: Record<string, SkillDefinition>;

  // Saving throw proficiencies by ability
  savingThrows: SavingThrows;

  // Generic actions (attacks, initiative, quick checks, etc.)
  actions: ActionButton[];

  // Inventory items
  inventory?: Item[];

  // Narrative/background fields
  background?: string;
  personalityTraits?: string; // free-form text
  ideals?: string; // free-form text
  bonds?: string; // free-form text
  flaws?: string; // free-form text
  features?: string[]; // notable features/feats/background features
  feats?: string[];
  spellcasting?: {
    classes: Array<{
      className: string;
      ability: keyof AbilityScores;
      cantrips: string[];
      known?: string[];
      prepared: string[];
      saveDC: number;
      attackBonus: number;
    }>;
  };
  // Player notes (3 columns in Notes tab)
  notes?: string[]; // length 3 preferred
  // Optional titles per notes page (same index as notes pages)
  notesTitles?: string[];
  // Optional category path (e.g., "Chapter > Section") per notes page
  notesCategory?: string[];
  // List of available category paths for the notebook index
  notesCategoryList?: string[];
}
