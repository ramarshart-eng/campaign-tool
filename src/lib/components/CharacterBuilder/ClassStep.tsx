/**
 * Step 3: Class Selection
 */

import React, { useState } from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";
import { useClasses, useClass } from "@/lib/hooks/useSRD";
import type { APIReference } from "@/lib/types/SRD";

interface ClassStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onNext: () => void;
  onPrevious: () => void;
  classesPrefetch?: APIReference[];
}

const ClassStep: React.FC<ClassStepProps> = ({
  state,
  updateState,
  onNext,
  onPrevious,
  classesPrefetch,
}) => {
  const hook = useClasses();
  const classes = classesPrefetch ?? hook.data;
  const loading = classesPrefetch ? false : hook.loading;
  const error = classesPrefetch ? null : hook.error;
  const [selectedIndex, setSelectedIndex] = useState<string | null>(
    state.selectedClass?.index || null
  );
  const { data: classDetails } = useClass(selectedIndex);

  const handleSelect = (index: string) => {
    setSelectedIndex(index);
  };

  const handleNext = () => {
    if (classDetails) {
      updateState({ selectedClass: classDetails });
      onNext();
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div>
        <h2 className=" mb-1">Choose Your Class</h2>
        <p className="text-muted mt-0">
          Your class determines your combat abilities, skills, and role in the party.
        </p>
        {/* Keep panel steady; no inline loading/error messages */}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {classes?.map((cls) => (
          <button
            key={cls.index}
            onClick={() => handleSelect(cls.index)}
            className={`choice-card ${selectedIndex === cls.index ? "is-active" : ""}`}
          >
            <div className=" ">{cls.name}</div>
          </button>
        ))}
      </div>

      {/* Class details */}
      {classDetails && (
        <div className="frame surface-muted pad-6">
          <h3 className=" mb-3">{classDetails.name}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="subheading">Hit Die:</span> 1d{classDetails.hit_die}
            </div>

            {classDetails.spellcasting && (
              <div>
                <span className="subheading">Spellcasting Ability:</span>{" "}
                {classDetails.spellcasting.spellcasting_ability.name}
              </div>
            )}

            {classDetails.saving_throws && classDetails.saving_throws.length > 0 && (
              <div>
                <span className="subheading">Saving Throw Proficiencies:</span>
                <ul className="list-disc list-inside ml-2">
                  {classDetails.saving_throws.map((save) => (
                    <li key={save.index}>{save.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {classDetails.proficiencies && classDetails.proficiencies.length > 0 && (
              <div>
                <span className="subheading">Proficiencies:</span>
                <ul className="list-disc list-inside ml-2">
                  {classDetails.proficiencies.slice(0, 5).map((prof) => (
                    <li key={prof.index}>{prof.name}</li>
                  ))}
                  {classDetails.proficiencies.length > 5 && (
                    <li>...and {classDetails.proficiencies.length - 5} more</li>
                  )}
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

export default ClassStep;


