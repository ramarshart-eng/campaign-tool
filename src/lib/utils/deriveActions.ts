import type { Character } from "@/lib/types/Character";
import type { ActionButton } from "@/lib/types/ActionButton";
import { abilityMod } from "@/lib/rules/computeModifiers";
import { matchWeapon } from "@/lib/data/weapons";

type FeatureBuilder = (character: Character) => ActionButton[];

const formatModifier = (value: number): string =>
  `${value >= 0 ? "+" : ""}${value}`;

const buildD20Formula = (modifier: number): string =>
  modifier === 0 ? "1d20" : `1d20 ${formatModifier(modifier)}`;

const safeLevel = (character: Character) => Math.max(1, character.level || 1);

const CLASS_FEATURE_BUILDERS: Array<{ match: string; build: FeatureBuilder }> = [
  {
    match: "fighter",
    build: (character) => [
      {
        id: "class-fighter-second-wind",
        label: "Second Wind",
        kind: "skill",
        formula: `1d10 ${formatModifier(safeLevel(character))}`,
        advantageAllowed: false,
      },
    ],
  },
  {
    match: "barbarian",
    build: (character) => {
      const strBonus = abilityMod(character.abilities.STR) + character.proficiencyBonus + 2;
      return [
        {
          id: "class-barbarian-rage",
          label: "Rage Swing",
          kind: "attack",
          formula: buildD20Formula(strBonus),
          advantageAllowed: true,
        },
      ];
    },
  },
  {
    match: "rogue",
    build: (character) => {
      const diceCount = Math.max(1, Math.ceil(safeLevel(character) / 2));
      return [
        {
          id: "class-rogue-sneak-attack",
          label: "Sneak Attack",
          kind: "attack",
          formula: `${diceCount}d6`,
          advantageAllowed: false,
        },
      ];
    },
  },
  {
    match: "paladin",
    build: (character) => [
      {
        id: "class-paladin-lay-on-hands",
        label: "Lay on Hands",
        kind: "spell",
        formula: `1d6 ${formatModifier(safeLevel(character))}`,
        advantageAllowed: false,
      },
    ],
  },
  {
    match: "cleric",
    build: (character) => {
      const wisBonus = abilityMod(character.abilities.WIS) + character.proficiencyBonus;
      return [
        {
          id: "class-cleric-channel-divinity",
          label: "Channel Divinity",
          kind: "spell",
          formula: buildD20Formula(wisBonus),
          advantageAllowed: true,
        },
      ];
    },
  },
  {
    match: "druid",
    build: (character) => {
      const wisBonus = abilityMod(character.abilities.WIS);
      return [
        {
          id: "class-druid-wild-shape",
          label: "Wild Shape Check",
          kind: "spell",
          formula: buildD20Formula(wisBonus + character.proficiencyBonus),
          advantageAllowed: true,
        },
      ];
    },
  },
  {
    match: "ranger",
    build: () => [
      {
        id: "class-ranger-hunters-mark",
        label: "Hunter's Mark",
        kind: "attack",
        formula: "1d6",
        advantageAllowed: false,
      },
    ],
  },
  {
    match: "monk",
    build: (character) => {
      const dexBonus = abilityMod(character.abilities.DEX) + character.proficiencyBonus;
      return [
        {
          id: "class-monk-flurry",
          label: "Flurry of Blows",
          kind: "attack",
          formula: buildD20Formula(dexBonus),
          advantageAllowed: true,
        },
      ];
    },
  },
  {
    match: "wizard",
    build: (character) => {
      const intMod = abilityMod(character.abilities.INT);
      return [
        {
          id: "class-wizard-arcane-recovery",
          label: "Arcane Recovery",
          kind: "spell",
          formula: `1d6 ${formatModifier(intMod)}`,
          advantageAllowed: false,
        },
      ];
    },
  },
  {
    match: "sorcerer",
    build: (character) => {
      const chaBonus = abilityMod(character.abilities.CHA) + character.proficiencyBonus;
      return [
        {
          id: "class-sorcerer-font-of-magic",
          label: "Font of Magic",
          kind: "spell",
          formula: buildD20Formula(chaBonus),
          advantageAllowed: true,
        },
      ];
    },
  },
  {
    match: "warlock",
    build: (character) => {
      const chaBonus = abilityMod(character.abilities.CHA) + character.proficiencyBonus;
      return [
        {
          id: "class-warlock-eldritch-blast",
          label: "Eldritch Blast",
          kind: "attack",
          formula: buildD20Formula(chaBonus),
          advantageAllowed: true,
        },
      ];
    },
  },
  {
    match: "bard",
    build: (character) => {
      const chaMod = abilityMod(character.abilities.CHA);
      return [
        {
          id: "class-bard-inspiration",
          label: "Bardic Inspiration",
          kind: "skill",
          formula: `1d6 ${formatModifier(chaMod)}`,
          advantageAllowed: false,
        },
      ];
    },
  },
];

const RACE_FEATURE_BUILDERS: Array<{ match: string; build: FeatureBuilder }> = [
  {
    match: "half-elf",
    build: (character) => {
      const chaBonus = abilityMod(character.abilities.CHA);
      return [
        {
          id: "race-half-elf-fey-ancestry",
          label: "Fey Ancestry",
          kind: "skill",
          formula: buildD20Formula(chaBonus + character.proficiencyBonus),
          advantageAllowed: true,
        },
      ];
    },
  },
  {
    match: "half-orc",
    build: () => [
      {
        id: "race-half-orc-savage-attacks",
        label: "Savage Attacks",
        kind: "attack",
        formula: "1d12",
        advantageAllowed: true,
      },
    ],
  },
  {
    match: "dragonborn",
    build: (character) => {
      const dice = Math.max(2, Math.ceil(safeLevel(character) / 2) + 1);
      return [
        {
          id: "race-dragonborn-breath",
          label: "Breath Weapon",
          kind: "spell",
          formula: `${dice}d6`,
          advantageAllowed: false,
        },
      ];
    },
  },
  {
    match: "tiefling",
    build: () => [
      {
        id: "race-tiefling-hellish-rebuke",
        label: "Hellish Rebuke",
        kind: "spell",
        formula: "2d10",
        advantageAllowed: false,
      },
    ],
  },
  {
    match: "dwarf",
    build: (character) => {
      const conBonus = abilityMod(character.abilities.CON) + character.proficiencyBonus;
      return [
        {
          id: "race-dwarf-resilience",
          label: "Dwarven Resilience",
          kind: "skill",
          formula: buildD20Formula(conBonus),
          advantageAllowed: true,
        },
      ];
    },
  },
  {
    match: "elf",
    build: (character) => {
      const dexBonus = abilityMod(character.abilities.DEX) + character.proficiencyBonus;
      return [
        {
          id: "race-elf-keen-senses",
          label: "Keen Senses",
          kind: "skill",
          formula: buildD20Formula(dexBonus),
          advantageAllowed: true,
        },
      ];
    },
  },
  {
    match: "gnome",
    build: (character) => {
      const intBonus = abilityMod(character.abilities.INT) + character.proficiencyBonus;
      return [
        {
          id: "race-gnome-cunning",
          label: "Gnome Cunning",
          kind: "skill",
          formula: buildD20Formula(intBonus),
          advantageAllowed: true,
        },
      ];
    },
  },
  {
    match: "halfling",
    build: () => [
      {
        id: "race-halfling-lucky",
        label: "Halfling Luck",
        kind: "skill",
        formula: "1d20",
        advantageAllowed: true,
      },
    ],
  },
  {
    match: "human",
    build: (character) => [
      {
        id: "race-human-inspiration",
        label: "Inspiring Presence",
        kind: "skill",
        formula: `1d6 ${formatModifier(character.proficiencyBonus)}`,
        advantageAllowed: false,
      },
    ],
  },
];

/**
 * Derive a basic set of action buttons from a character state.
 * - Initiative from DEX
 * - One attack per equipped weapon (assumes proficiency for prototype)
 * - Skill checks for proficient skills
 */
export function deriveActionsFromCharacter(character: Character): ActionButton[] {
  const derived: ActionButton[] = [];

  derived.push(...buildWeaponActions(character));
  derived.push(...buildGeneralActions(character));
  derived.push(...buildClassFeatureActions(character));
  derived.push(...buildRaceFeatureActions(character));
  derived.push(...buildClassCantrips(character));
  derived.push(...buildClassSpells(character));

  return uniqueById(derived);
}

function buildWeaponActions(character: Character): ActionButton[] {
  const items = character.inventory ?? [];
  const actions: ActionButton[] = [];

  for (const item of items) {
    // Consider items in hands or explicitly equipped; don't rely solely on category
    const isInHand = item.equipmentSlot === "mainHand" || item.equipmentSlot === "offHand";
    if (!(item.equipped || isInHand)) continue;
    const wp = matchWeapon(item.name);
    if (!wp) continue;
    const primary = wp.ability;
    const atkBonus = abilityMod(character.abilities[primary]) + character.proficiencyBonus;
    actions.push({
      id: `attack-${item.id}`,
      label: `${item.name} Attack`,
      kind: "attack",
      formula: buildD20Formula(atkBonus),
      advantageAllowed: true,
    });
  }

  return actions;
}

function buildClassFeatureActions(character: Character): ActionButton[] {
  const normalized = (character.className || "").toLowerCase();
  if (!normalized) return [];
  return CLASS_FEATURE_BUILDERS.filter(({ match }) => normalized.includes(match)).flatMap(({ build }) => build(character));
}

function buildRaceFeatureActions(character: Character): ActionButton[] {
  const normalized = (character.raceName || "").toLowerCase();
  if (!normalized) return [];
  return RACE_FEATURE_BUILDERS.filter(({ match }) => normalized.includes(match)).flatMap(({ build }) => build(character));
}

function uniqueById(actions: ActionButton[]): ActionButton[] {
  const map = new Map<string, ActionButton>();
  for (const action of actions) {
    if (!map.has(action.id)) {
      map.set(action.id, action);
    }
  }
  return Array.from(map.values());
}

// SRD-based general actions that any character can take
function buildGeneralActions(character: Character): ActionButton[] {
  const actions: ActionButton[] = [];

  // Unarmed Strike (SRD): Attack roll using STR + proficiency; damage not modeled here
  const strMod = abilityMod(character.abilities.STR);
  const unarmedAtk = strMod + character.proficiencyBonus;
  actions.push({
    id: "general-unarmed-strike",
    label: "Unarmed Strike",
    kind: "attack",
    formula: buildD20Formula(unarmedAtk),
    advantageAllowed: true,
  });

  // Grapple (SRD): Athletics check vs target's Athletics/Acrobatics
  const athleticsBase = abilityMod(character.abilities.STR) + (character.skills["Athletics"]?.proficient ? character.proficiencyBonus : 0);
  actions.push({
    id: "general-grapple",
    label: "Grapple (Athletics)",
    kind: "skill",
    formula: buildD20Formula(athleticsBase),
    advantageAllowed: true,
  });

  // Shove (SRD): Athletics check vs target's Athletics/Acrobatics
  actions.push({
    id: "general-shove",
    label: "Shove (Athletics)",
    kind: "skill",
    formula: buildD20Formula(athleticsBase),
    advantageAllowed: true,
  });

  return actions;
}

// Class cantrips and basic spells for prototype
function buildClassCantrips(character: Character): ActionButton[] {
  const actions: ActionButton[] = [];
  const cls = (character.className || "").toLowerCase();
  if (!cls) return actions;

  if (cls.includes("cleric")) {
    const wisMod = abilityMod(character.abilities.WIS);
    actions.push({
      id: "cantrip-cleric-sacred-flame",
      label: "Sacred Flame",
      kind: "cantrip",
      formula: "1d8",
      advantageAllowed: false,
    });
    actions.push({
      id: "cantrip-cleric-guidance",
      label: "Guidance",
      kind: "cantrip",
      formula: `1d4 ${formatModifier(wisMod)}`,
      advantageAllowed: false,
    });
  }

  return actions;
}

function buildClassSpells(character: Character): ActionButton[] {
  const actions: ActionButton[] = [];
  const cls = (character.className || "").toLowerCase();
  if (!cls) return actions;

  if (cls.includes("cleric")) {
    const wisMod = abilityMod(character.abilities.WIS);
    const spellAtk = wisMod + character.proficiencyBonus;
    actions.push({
      id: "spell-cleric-cure-wounds",
      label: "Cure Wounds",
      kind: "spell",
      formula: `1d8 ${formatModifier(wisMod)}`,
      advantageAllowed: false,
    });
    actions.push({
      id: "spell-cleric-bless",
      label: "Bless",
      kind: "spell",
      formula: "1d4",
      advantageAllowed: false,
    });
    actions.push({
      id: "spell-cleric-guiding-bolt-atk",
      label: "Guiding Bolt (Atk)",
      kind: "spell",
      formula: buildD20Formula(spellAtk),
      advantageAllowed: true,
    });
  }

  return actions;
}
