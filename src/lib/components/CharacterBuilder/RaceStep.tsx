/**
 * Step 2: Race Selection
 */

import React, { useState } from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";
import { useRaces, useRace } from "@/lib/hooks/useSRD";

interface RaceStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const RaceStep: React.FC<RaceStepProps> = ({
  state,
  updateState,
  onNext,
  onPrevious,
}) => {
  const { data: races, loading, error } = useRaces();
  const [selectedIndex, setSelectedIndex] = useState<string | null>(
    state.selectedRace?.index || null
  );
  const { data: raceDetails } = useRace(selectedIndex);

  const handleSelect = (index: string) => {
    setSelectedIndex(index);
  };

  const handleNext = () => {
    if (raceDetails) {
      updateState({ selectedRace: raceDetails });
      onNext();
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div>
        <h2 className=" mb-1">Choose Your Race</h2>
        <p className="text-muted mt-0">
          Your race determines your character's physical traits and special abilities.
        </p>
        {/* Keep panel steady; no inline loading/error messages */}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {races?.map((race) => (
          <button
            key={race.index}
            onClick={() => handleSelect(race.index)}
            className={`choice-card ${selectedIndex === race.index ? "is-active" : ""}`}
          >
            <div className=" ">{race.name}</div>
          </button>
        ))}
      </div>

      {/* Race details */}
      {raceDetails && (
        <div className="frame surface-muted pad-6">
          <h3 className=" mb-3">{raceDetails.name}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="subheading">Speed:</span> {raceDetails.speed} ft.
            </div>

            <div>
              <span className="subheading">Size:</span> {raceDetails.size}
            </div>

            {raceDetails.ability_bonuses && raceDetails.ability_bonuses.length > 0 && (
              <div>
                <span className="subheading">Ability Score Increases:</span>
                <ul className="list-disc list-inside ml-2">
                  {raceDetails.ability_bonuses.map((bonus, idx) => (
                    <li key={idx}>
                      {bonus.ability_score.name} +{bonus.bonus}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {raceDetails.traits && raceDetails.traits.length > 0 && (
              <div>
                <span className="subheading">Racial Traits:</span>
                <ul className="list-disc list-inside ml-2">
                  {raceDetails.traits.map((trait) => (
                    <li key={trait.index}>{trait.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4 mt-auto">
        <button
          type="button"
          onClick={onPrevious}
          className="btn-frame btn-frame--lg"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!selectedIndex}
          className={`btn-frame ${!selectedIndex ? "btn-disabled" : ""}`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default RaceStep;


