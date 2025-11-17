/**
 * Step 2: Race Selection
 */

import React, { useEffect, useState } from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";
import { useRaces, useRace } from "@/lib/hooks/useSRD";
import type { APIReference, SRDRace } from "@/lib/types/SRD";

interface RaceStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  racesPrefetch?: APIReference[];
  raceDetailsPrefetch?: SRDRace | null;
}

const RaceStep: React.FC<RaceStepProps> = ({
  state,
  updateState,
  racesPrefetch,
  raceDetailsPrefetch,
}) => {
  const hook = useRaces();
  const races = racesPrefetch ?? hook.data;
  const loading = racesPrefetch ? false : hook.loading;
  const error = racesPrefetch ? null : hook.error;
  const [selectedIndex, setSelectedIndex] = useState<string | null>(
    state.selectedRace?.index || null
  );
  const hookDetail = useRace(selectedIndex);
  const raceDetails =
    raceDetailsPrefetch && selectedIndex === state.selectedRace?.index
      ? raceDetailsPrefetch
      : hookDetail.data;

  useEffect(() => {
    if (raceDetails && raceDetails.index === selectedIndex) {
      updateState({ selectedRace: raceDetails });
    }
  }, [raceDetails, selectedIndex, updateState]);

  const handleSelect = (index: string) => {
    setSelectedIndex(index);
  };

  return (
    <div className="builder-step">
      <div>
        <h2 className=" mb-1">Choose Your Race</h2>
        <p className="text-muted mt-0">
          Your race determines your character&rsquo;s physical traits and special abilities.
        </p>
        {/* Keep panel steady; no inline loading/error messages */}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 grid-tight">
        {loading && (
          <div className="text-muted text-sm col-span-2 md:col-span-3">Loading races&hellip;</div>
        )}
        {!loading && error && (
          <div className="text-danger text-sm col-span-2 md:col-span-3">Failed to load races.</div>
        )}
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
                  {raceDetails.ability_bonuses.map((bonus: { ability_score: { name: string }; bonus: number }, idx: number) => (
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
                  {raceDetails.traits.map((trait: { index: string; name: string }) => (
                    <li key={trait.index}>{trait.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RaceStep;
