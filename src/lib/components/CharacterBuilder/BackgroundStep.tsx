/**
 * Step 5: Background Selection
 */

import React, { useState } from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";
import { useBackgrounds } from "@/lib/hooks/useSRD";

interface BackgroundStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const BackgroundStep: React.FC<BackgroundStepProps> = ({
  state,
  updateState,
  onNext,
  onPrevious,
}) => {
  const { data: backgrounds, loading, error } = useBackgrounds();
  const [selectedBackground, setSelectedBackground] = useState(
    state.selectedBackground
  );

  const handleSelect = (background: typeof selectedBackground) => {
    setSelectedBackground(background);
  };

  const handleNext = () => {
    if (selectedBackground) {
      updateState({ selectedBackground });
      onNext();
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading backgrounds...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-danger">
        Error loading backgrounds: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className=" mb-2">Choose Your Background</h2>
        <p className="text-muted">
          Your background represents your character's history and provides additional skills and features.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {backgrounds?.map((bg) => (
          <button
            key={bg.index}
            onClick={() => handleSelect(bg)}
            className={`choice-card ${selectedBackground?.index === bg.index ? "is-active" : ""}`}
          >
            <div className="  mb-1">{bg.name}</div>
            <div className=" opacity-80">
              Skills: {bg.skillProficiencies.join(", ")}
            </div>
          </button>
        ))}
      </div>

      {/* Background details */}
      {selectedBackground && (
        <div className="frame surface-muted pad-6">
          <h3 className=" mb-4">{selectedBackground.name}</h3>

          <div className="space-y-3">
            <div>
              <span className="subheading">Skill Proficiencies:</span>
              <ul className="list-disc list-inside ml-2">
                {selectedBackground.skillProficiencies.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </div>

            {selectedBackground.toolProficiencies && (
              <div>
                <span className="subheading">Tool Proficiencies:</span>
                <ul className="list-disc list-inside ml-2">
                  {selectedBackground.toolProficiencies.map((tool) => (
                    <li key={tool}>{tool}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedBackground.languages && (
              <div>
                <span className="subheading">Languages:</span> {selectedBackground.languages} additional language(s)
              </div>
            )}

            <div>
              <span className="subheading">Feature:</span> {selectedBackground.featureName}
              <p className=" text-muted mt-1">
                {selectedBackground.featureDescription}
              </p>
            </div>
          </div>
        </div>
      )}

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
          onClick={handleNext}
          disabled={!selectedBackground}
          className={`btn-frame ${!selectedBackground ? "btn-disabled" : ""}`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default BackgroundStep;


