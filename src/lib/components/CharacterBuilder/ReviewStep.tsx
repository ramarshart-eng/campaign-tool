/**
 * Step 6: Review and Complete Character
 */

import React from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";
import type { Character } from "@/lib/types/Character";
import { abilityMod } from "@/lib/rules/computeModifiers";

interface ReviewStepProps {
  state: CharacterBuilderState;
  onComplete: (character: Character) => void;
  onPrevious: () => void;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  state,
  onComplete,
  onPrevious,
}) => {
  const handleComplete = () => {
    if (!state.selectedRace || !state.selectedClass || !state.selectedBackground) {
      return;
    }

    // Calculate final ability scores with racial bonuses
    const finalAbilities = { ...state.abilityScores };
    state.selectedRace.ability_bonuses.forEach((bonus) => {
      const abilityKey = bonus.ability_score.index.toUpperCase() as keyof typeof finalAbilities;
      if (abilityKey in finalAbilities) {
        finalAbilities[abilityKey] += bonus.bonus;
      }
    });

    // Calculate proficiency bonus (level 1 = +2)
    const proficiencyBonus = 2;

    // Calculate HP (class hit die + CON modifier)
    const conMod = abilityMod(finalAbilities.CON);
    const maxHp = state.selectedClass.hit_die + conMod;

    // Calculate AC (base 10 + DEX modifier)
    const dexMod = abilityMod(finalAbilities.DEX);
    const armorClass = 10 + dexMod;

    // Build skills object from background
    const skills: Character["skills"] = {};
    state.selectedBackground.skillProficiencies.forEach((skillName) => {
      // Map skill name to ability
      const skillAbilityMap: Record<string, keyof Character["abilities"]> = {
        Acrobatics: "DEX",
        "Animal Handling": "WIS",
        Arcana: "INT",
        Athletics: "STR",
        Deception: "CHA",
        History: "INT",
        Insight: "WIS",
        Intimidation: "CHA",
        Investigation: "INT",
        Medicine: "WIS",
        Nature: "INT",
        Perception: "WIS",
        Performance: "CHA",
        Persuasion: "CHA",
        Religion: "INT",
        "Sleight of Hand": "DEX",
        Stealth: "DEX",
        Survival: "WIS",
      };
      skills[skillName] = {
        ability: skillAbilityMap[skillName] || "STR",
        proficient: true,
      };
    });

    // Build saving throws with class proficiencies
    const savingThrows: Character["savingThrows"] = {
      STR: { proficient: false },
      DEX: { proficient: false },
      CON: { proficient: false },
      INT: { proficient: false },
      WIS: { proficient: false },
      CHA: { proficient: false },
    };
    state.selectedClass.saving_throws.forEach((save) => {
      const key = save.index.toUpperCase() as keyof typeof savingThrows;
      if (key in savingThrows) {
        savingThrows[key].proficient = true;
      }
    });

    const bg = state.selectedBackground;
    const derivedFeatures: string[] = [
      `${bg.featureName}: ${bg.featureDescription}`,
    ];
    if (bg.toolProficiencies && bg.toolProficiencies.length > 0) {
      derivedFeatures.push(`Tool Proficiencies: ${bg.toolProficiencies.join(", ")}`);
    }
    if (bg.languages && bg.languages > 0) {
      derivedFeatures.push(`Additional Languages: ${bg.languages}`);
    }

    const character: Character = {
      id: `char-${Date.now()}`,
      name: state.name,
      className: state.selectedClass.name,
      raceName: state.selectedRace.name,
      level: 1,
      proficiencyBonus,
      maxHp,
      currentHp: maxHp,
      armorClass,
      abilities: finalAbilities,
      skills,
      savingThrows,
      actions: [],
      inventory: state.inventory,
      // Narrative fields prefilled from builder selections (editable later)
      background: bg.name,
      features: derivedFeatures,
      personalityTraits: state.personalityTraits,
      ideals: state.ideals,
      bonds: state.bonds,
      flaws: state.flaws,
    };

    onComplete(character);
  };

  if (!state.selectedRace || !state.selectedClass || !state.selectedBackground) {
    return <div>Missing required selections</div>;
  }

  // Calculate final scores
  const finalAbilities = { ...state.abilityScores };
  state.selectedRace.ability_bonuses.forEach((bonus) => {
    const abilityKey = bonus.ability_score.index.toUpperCase() as keyof typeof finalAbilities;
    if (abilityKey in finalAbilities) {
      finalAbilities[abilityKey] += bonus.bonus;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className=" mb-2">Review Your Character</h2>
        <p className="text-muted">
          Review your character's details before completing creation.
        </p>
      </div>

      <div className="frame pad-6 space-y-4">
        <div>
          <h3 className="">{state.name}</h3>
          <p className=" text-muted">Level 1 {state.selectedRace.name} {state.selectedClass.name}</p>
          <p className=" text-sm mt-1">
            <span className="text-subtle">Race:</span> {state.selectedRace.name}
            <span className="mx-2">•</span>
            <span className="text-subtle">Class:</span> {state.selectedClass.name}
            <span className="mx-2">•</span>
            <span className="text-subtle">Background:</span> {state.selectedBackground.name}
            <span className="mx-2">•</span>
            <span className="text-subtle">Hit Die:</span> 1d{state.selectedClass.hit_die}
          </p>
        </div>

        <div>
          <h4 className=" mb-2">Ability Scores</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {(Object.entries(finalAbilities) as Array<[keyof typeof finalAbilities, number]>).map(
              ([ability, score]) => (
                <div key={ability}>
                  <span className="text-subtle">{ability}</span> {score} (
                  {abilityMod(score) >= 0 ? "+" : ""}
                  {abilityMod(score)})
                </div>
              )
            )}
          </div>
        </div>

        <div>
          <h4 className=" mb-2">Skills</h4>
          <div className="">
            {state.selectedBackground.skillProficiencies.join(", ")}
          </div>
        </div>

        <div>
          <h4 className=" mb-2">Equipment</h4>
          <p className=" text-muted mb-1">Includes class starting equipment and standard adventuring gear.</p>
          {state.inventory && state.inventory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1">
              {state.inventory.map((it) => (
                <div key={it.id}>
                  {it.name}
                  {it.description ? <span className=" text-subtle"> — {it.description}</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className=" text-muted">No items</div>
          )}
        </div>

        <div>
          <h4 className=" mb-2">Personality</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-black p-2">
              <div className="mb-1">Traits</div>
              <div className="whitespace-pre-wrap text-sm">
                {state.personalityTraits || "—"}
              </div>
            </div>
            <div className="border border-black p-2">
              <div className="mb-1">Ideals</div>
              <div className="whitespace-pre-wrap text-sm">{state.ideals || "—"}</div>
            </div>
            <div className="border border-black p-2">
              <div className="mb-1">Bonds</div>
              <div className="whitespace-pre-wrap text-sm">{state.bonds || "—"}</div>
            </div>
            <div className="border border-black p-2">
              <div className="mb-1">Flaws</div>
              <div className="whitespace-pre-wrap text-sm">{state.flaws || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onPrevious}
          className="btn-frame btn-frame--lg"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={handleComplete}
          className="btn-primary"
        >
          Create Character
        </button>
      </div>
    </div>
  );
};

export default ReviewStep;
