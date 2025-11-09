/**
 * Step 4: Ability Scores Assignment
 * Uses Standard Array: 15, 14, 13, 12, 10, 8
 */

import React, { useState } from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";

interface AbilityScoresStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
const ABILITY_NAMES = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};

const AbilityScoresStep: React.FC<AbilityScoresStepProps> = ({
  state,
  updateState,
  onNext,
  onPrevious,
}) => {
  const [scores, setScores] = useState(state.abilityScores);
  const [availableScores, setAvailableScores] = useState(() => {
    // Calculate which scores are still available
    const used = Object.values(scores);
    return STANDARD_ARRAY.filter((score) => {
      const usedCount = used.filter((s) => s === score).length;
      const totalCount = STANDARD_ARRAY.filter((s) => s === score).length;
      return usedCount < totalCount;
    });
  });

  const handleScoreChange = (ability: keyof typeof scores, newScore: number) => {
    const oldScore = scores[ability];

    // Update scores
    const newScores = { ...scores, [ability]: newScore };
    setScores(newScores);

    // Update available scores
    const newAvailable = [...availableScores];
    if (oldScore !== 10) {
      // Return old score to available pool (unless it's the default)
      newAvailable.push(oldScore);
    }
    if (newScore !== 10) {
      // Remove new score from available pool
      const index = newAvailable.indexOf(newScore);
      if (index > -1) {
        newAvailable.splice(index, 1);
      }
    }
    setAvailableScores(newAvailable.sort((a, b) => b - a));
  };

  const handleNext = () => {
    updateState({ abilityScores: scores });
    onNext();
  };

  // Check if all scores are assigned
  const allAssigned = availableScores.length === 0 || availableScores.every((s) => s === 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className=" mb-2">Assign Ability Scores</h2>
        <p className="text-muted mb-4">
          Assign the standard array scores (15, 14, 13, 12, 10, 8) to your abilities.
        </p>
          {availableScores.length > 0 && (
          <div className="frame surface-warn pad-3">
            <span className="subheading">Available Scores:</span>{" "}
            {availableScores.join(", ")}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ABILITIES.map((ability) => {
          const racialBonus =
            state.selectedRace?.ability_bonuses.find(
              (bonus) => bonus.ability_score.index === ability.toLowerCase()
            )?.bonus || 0;

          return (
            <div key={ability} className="frame pad-4">
              <label className="block mb-2">
                <span className="subheading">{ABILITY_NAMES[ability]}</span>
                <span className=" text-muted ml-2">({ability})</span>
              </label>

              <select
                value={scores[ability]}
                onChange={(e) => handleScoreChange(ability, Number(e.target.value))}
                className="w-full input-frame"
              >
                <option value={scores[ability]}>{scores[ability]}</option>
                {availableScores.map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>

              <div className="mt-2 ">
                {racialBonus > 0 && (
                  <div className="text-success subheading">Racial Bonus: +{racialBonus}</div>
                )}
                <div className="subheading">Final Score: {scores[ability] + racialBonus}</div>
                <div className="text-muted">
                  Modifier: {Math.floor((scores[ability] + racialBonus - 10) / 2) >= 0 ? "+" : ""}
                  {Math.floor((scores[ability] + racialBonus - 10) / 2)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onPrevious} className="btn-frame">
          Previous
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!allAssigned}
          className={`btn-frame ${!allAssigned ? "btn-disabled" : ""}`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AbilityScoresStep;
