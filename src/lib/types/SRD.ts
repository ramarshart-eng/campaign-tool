/**
 * TypeScript types for D&D 5e SRD API data
 */

export interface APIReference {
  index: string;
  name: string;
  url: string;
}

export interface AbilityBonus {
  ability_score: APIReference;
  bonus: number;
}

export interface Proficiency {
  index: string;
  name: string;
  url: string;
}

export interface Trait {
  index: string;
  name: string;
  url: string;
}

export interface Language {
  index: string;
  name: string;
  url: string;
}

export interface SRDRace {
  index: string;
  name: string;
  speed: number;
  ability_bonuses: AbilityBonus[];
  alignment: string;
  age: string;
  size: string;
  size_description: string;
  starting_proficiencies: Proficiency[];
  starting_proficiency_options?: {
    choose: number;
    from: {
      option_set_type: string;
      options: Array<{ item: APIReference; option_type: string }>;
    };
    type: string;
  };
  languages: Language[];
  language_desc: string;
  traits: Trait[];
  subraces: APIReference[];
}

export interface StartingEquipmentOption {
  choose: number;
  from: {
    option_set_type: string;
    options: Array<{
      option_type: string;
      item?: APIReference;
      choice?: {
        choose: number;
        from: {
          option_set_type: string;
          options: Array<{ option_type: string; item: APIReference }>;
        };
        type: string;
      };
    }>;
  };
  type: string;
}

export interface SpellcastingInfo {
  level: number;
  spellcasting_ability: APIReference;
  info: Array<{
    name: string;
    desc: string[];
  }>;
}

export interface SRDClass {
  index: string;
  name: string;
  hit_die: number;
  proficiency_choices: Array<{
    choose: number;
    from: {
      option_set_type: string;
      options: Array<{ item: APIReference; option_type: string }>;
    };
    type: string;
  }>;
  proficiencies: Proficiency[];
  saving_throws: APIReference[];
  starting_equipment: Array<{
    equipment: APIReference;
    quantity: number;
  }>;
  starting_equipment_options: StartingEquipmentOption[];
  class_levels: string;
  multi_classing: {
    prerequisites: Array<{
      ability_score: APIReference;
      minimum_score: number;
    }>;
    proficiencies: Proficiency[];
  };
  subclasses: APIReference[];
  spellcasting?: SpellcastingInfo;
}

export interface SRDBackground {
  index: string;
  name: string;
  starting_proficiencies: Proficiency[];
  language_options: {
    choose: number;
    from: {
      option_set_type: string;
      options: Array<{ item: APIReference; option_type: string }>;
    };
    type: string;
  };
  starting_equipment: Array<{
    equipment: APIReference;
    quantity: number;
  }>;
  starting_equipment_options: StartingEquipmentOption[];
  feature: {
    name: string;
    desc: string[];
  };
  personality_traits: {
    choose: number;
    from: {
      option_set_type: string;
      options: Array<{ string: string; option_type: string }>;
    };
    type: string;
  };
  ideals: {
    choose: number;
    from: {
      option_set_type: string;
      options: Array<{
        desc: string;
        alignments: APIReference[];
        option_type: string;
      }>;
    };
    type: string;
  };
  bonds: {
    choose: number;
    from: {
      option_set_type: string;
      options: Array<{ string: string; option_type: string }>;
    };
    type: string;
  };
  flaws: {
    choose: number;
    from: {
      option_set_type: string;
      options: Array<{ string: string; option_type: string }>;
    };
    type: string;
  };
}

export interface SRDSkill {
  index: string;
  name: string;
  desc: string[];
  ability_score: APIReference;
}

export interface SRDAbilityScore {
  index: string;
  name: string;
  full_name: string;
  desc: string[];
  skills: APIReference[];
}

export interface SRDSpell {
  index: string;
  name: string;
  desc: string[];
  higher_level?: string[];
  range: string;
  components: string[];
  material?: string;
  ritual: boolean;
  duration: string;
  concentration: boolean;
  casting_time: string;
  level: number;
  attack_type?: string;
  damage?: {
    damage_type: APIReference;
    damage_at_slot_level?: Record<string, string>;
    damage_at_character_level?: Record<string, string>;
  };
  dc?: {
    dc_type: APIReference;
    dc_success: string;
  };
  area_of_effect?: {
    type: string;
    size: number;
  };
  school: APIReference;
  classes: APIReference[];
  subclasses: APIReference[];
}

/**
 * Character builder types - used during the creation process
 */
export interface CharacterBuilderState {
  step: "name" | "race" | "class" | "abilities" | "background" | "equipment" | "review";
  name: string;
  selectedRace: SRDRace | null;
  selectedClass: SRDClass | null;
  selectedBackground: SRDBackground | null;
  abilityScores: {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
  };
  selectedSkills: string[];
  selectedEquipment: string[];
}
