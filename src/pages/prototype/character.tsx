// src/pages/prototype/character.tsx

import React, { useState, useEffect } from "react";
import type { NextPage } from "next";
import CharacterSheet, {
  SkillsPanel,
  SavingThrowsPanel,
  ActionsPanel,
} from "@/lib/components/CharacterSheet";
import RollLog, { type LoggedRoll } from "@/lib/components/RollLog";
import type { Character } from "@/lib/types/Character";
import type { AdvantageState, RollResult } from "@/lib/rules/rollDice";
import type { ActionButton } from "@/lib/types/ActionButton";
import { abilityMod } from "@/lib/rules/computeModifiers";
import Panel from "@/lib/components/Panel";
import PlayArea from "@/lib/components/PlayArea";
import { useCharacter } from "@/lib/context/CharacterContext";

// --- Temporary mock character for Prototype ---
const mockCharacter: Character = {
  id: "pc-1",
  name: "Eldric",
  raceName: "Human",
  className: "Fighter",
  level: 3,
  proficiencyBonus: 2,

  maxHp: 28,
  currentHp: 28,
  armorClass: 17,

  abilities: {
    STR: 16,
    DEX: 14,
    CON: 14,
    INT: 10,
    WIS: 12,
    CHA: 8,
  },

  skills: {
    Athletics: { ability: "STR", proficient: true },
    Perception: { ability: "WIS", proficient: true },
    Stealth: { ability: "DEX", proficient: false },
  },

  savingThrows: {
    STR: { proficient: true },
    DEX: { proficient: false },
    CON: { proficient: true },
    INT: { proficient: false },
    WIS: { proficient: false },
    CHA: { proficient: false },
  },

  actions: [],

  inventory: [
    {
      id: "longsword",
      name: "Longsword",
      description: "A versatile martial weapon",
      quantity: 1,
      weight: 3,
      equipped: true,
      equipmentSlot: "mainHand",
      category: "Weapon",
    },
    {
      id: "shield",
      name: "Shield",
      description: "+2 AC",
      quantity: 1,
      weight: 6,
      equipped: true,
      equipmentSlot: "offHand",
      category: "Armor",
    },
    {
      id: "chainmail",
      name: "Chain Mail",
      description: "Heavy armor, AC 16",
      quantity: 1,
      weight: 55,
      equipped: true,
      equipmentSlot: "chest",
      category: "Armor",
    },
    {
      id: "potion-healing",
      name: "Potion of Healing",
      description: "Restores 2d4+2 HP",
      quantity: 3,
      weight: 0.5,
      category: "Potion",
    },
    {
      id: "rope",
      name: "Hempen Rope",
      description: "50 feet",
      quantity: 1,
      weight: 10,
      category: "Adventuring Gear",
    },
    {
      id: "rations",
      name: "Rations",
      description: "1 day",
      quantity: 7,
      weight: 2,
      category: "Food",
    },
  ],
  // Narrative/background fields for Character tab
  background: "Soldier",
  personalityTraits:
    "I’m always polite and respectful. I’m haunted by memories of war; I can’t get the images of violence out of my mind.",
  ideals: "Greater Good. Our lot is to lay down our lives in defense of others.",
  bonds: "I would still lay down my life for the people I served with.",
  flaws: "I made a terrible mistake in battle that cost many lives—and I would do anything to keep that mistake secret.",
  features: [
    "Military Rank: You have a military rank from your career as a soldier.",
    "Fighting Style: Defense",
  ],
};

// Derive some quick actions for the hotbar
const strMod = abilityMod(mockCharacter.abilities.STR);
const dexMod = abilityMod(mockCharacter.abilities.DEX);
const initBonus = dexMod;
const attackBonus = strMod + mockCharacter.proficiencyBonus;

const athleticsBonus =
  abilityMod(mockCharacter.abilities[mockCharacter.skills.Athletics.ability]) +
  (mockCharacter.skills.Athletics.proficient
    ? mockCharacter.proficiencyBonus
    : 0);
const perceptionBonus =
  abilityMod(mockCharacter.abilities[mockCharacter.skills.Perception.ability]) +
  (mockCharacter.skills.Perception.proficient
    ? mockCharacter.proficiencyBonus
    : 0);
const stealthBonus =
  abilityMod(mockCharacter.abilities[mockCharacter.skills.Stealth.ability]) +
  (mockCharacter.skills.Stealth.proficient
    ? mockCharacter.proficiencyBonus
    : 0);

mockCharacter.actions = [
  {
    id: "init",
    label: "Initiative",
    kind: "initiative",
    formula: `1d20 + ${initBonus}`,
    advantageAllowed: true,
  },
  {
    id: "attack-long",
    label: "Longsword Attack",
    kind: "attack",
    formula: `1d20 + ${attackBonus}`,
    advantageAllowed: true,
  },
  {
    id: "skill-athletics",
    label: "Athletics",
    kind: "skill",
    formula: `1d20 + ${athleticsBonus}`,
    advantageAllowed: true,
  },
  {
    id: "skill-perception",
    label: "Perception",
    kind: "skill",
    formula: `1d20 + ${perceptionBonus}`,
    advantageAllowed: true,
  },
  {
    id: "skill-stealth",
    label: "Stealth",
    kind: "skill",
    formula: `1d20 + ${stealthBonus}`,
    advantageAllowed: true,
  },
  {
    id: "spell-magic-missile",
    label: "Magic Missile",
    kind: "spell",
    formula: "1d20 + 3", // placeholder; later this will follow spell rules
    advantageAllowed: true,
  },
];

const CharacterPrototypePage: NextPage = () => {
  const { character: contextCharacter } = useCharacter();

  // Use character from context, or fall back to mock character
  const character = contextCharacter || mockCharacter;

  const [advState] = useState<AdvantageState>("normal");
  const [rolls, setRolls] = useState<LoggedRoll[]>([]);
  const [currentHp, setCurrentHp] = useState<number>(character.currentHp);
  const [lastRollDisplay, setLastRollDisplay] = useState<{
    label: string;
    total: number;
  } | null>(null);
  const [activePlayTab, setActivePlayTab] = useState<"Map" | "Party" | "The Table" | "Character" | "Notes">("The Table");

  // Update currentHp when character changes
  useEffect(() => {
    setCurrentHp(character.currentHp);
  }, [character]);

  useEffect(() => {
    if (!lastRollDisplay) return;

    const timeout = window.setTimeout(() => {
      setLastRollDisplay(null);
    }, 2000); // 2 seconds

    return () => window.clearTimeout(timeout);
  }, [lastRollDisplay]);

  const handleRoll = (result: RollResult, action: ActionButton) => {
    const entry: LoggedRoll = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      result,
      action,
    };

    // Add to the roll history
    setRolls((prev) => [...prev, entry]);

    // Show a big centered number for this roll
    setLastRollDisplay({
      label: action.label,
      total: result.total, // assumes RollResult has .total (same as RollLog uses)
    });
  };

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <div className="w-full px-4 py-4 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 flex-1 min-h-0">
          {/* Left column: pinned character panel */}
          <div className="space-y-4 lg:w-80 lg:shrink-0 lg:sticky lg:top-20 h-full min-h-0">
            <CharacterSheet
              character={{ ...character, currentHp }}
              advState={advState}
              onRoll={handleRoll}
              onHpChange={setCurrentHp}
            />
          </div>

          {/* Center column: Play Area */}
          <div className="flex-1 h-full min-h-0">
            <PlayArea character={character} onTabChange={setActivePlayTab} />
          </div>

          {/* Right column: skills, saves, and full-width roll log */}
          <div className="flex flex-col gap-4 lg:w-80 lg:shrink-0 lg:sticky lg:top-20 h-full min-h-0">
            {/* Skills at the top */}
            <div className="shrink-0">
              <SkillsPanel
                character={{ ...character, currentHp }}
                advState={advState}
                onRoll={handleRoll}
              />
            </div>

            {/* Saving Throws panel */}
            <div className="shrink-0">
              <SavingThrowsPanel
                character={{ ...character, currentHp }}
                advState={advState}
                onRoll={handleRoll}
              />
            </div>

            {/* Spacer to push Roll Log to bottom */}
            <div className="flex-1 min-h-0"></div>

            {/* Full-width Roll Log pinned to bottom */}
            <div className="shrink-0">
              <Panel title="Roll Log">
                <RollLog rolls={rolls} />
              </Panel>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-centred Actions hotbar (only on The Table tab) */}
      {activePlayTab === "The Table" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
          <div className="pointer-events-auto max-w-3xl w-full px-4">
            <div className="frame">
              <ActionsPanel
                character={{ ...character, currentHp }}
                advState={advState}
                onRoll={handleRoll}
              />
            </div>
          </div>
        </div>
      )}
      {/* Center-screen roll display */}
      {lastRollDisplay && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="pointer-events-auto frame pad-4 text-center">
            <div className=" mb-1">{lastRollDisplay.label}</div>
            <div className="">{lastRollDisplay.total}</div>
          </div>
        </div>
      )}
    </main>
  );
};

export default CharacterPrototypePage;
