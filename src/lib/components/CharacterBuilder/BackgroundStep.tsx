/**
 * Step 5: Background Selection
 */

import React from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";
import { useBackgrounds } from "@/lib/hooks/useSRD";

interface BackgroundStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
}

const BackgroundStep: React.FC<BackgroundStepProps> = ({
  state,
  updateState,
}) => {
  const { data: backgrounds } = useBackgrounds();
  const selectedBackground = state.selectedBackground;

  const handleSelect = (background: typeof selectedBackground) => {
    if (background) {
      updateState({ selectedBackground: background });
    }
  };

  return (
    <div className="builder-step">
      <div>
        <h2 className=" mb-1">Choose Your Background</h2>
        <p className="text-muted mt-0">
          Your background represents your character&rsquo;s history and provides additional skills and features.
        </p>
        {/* Keep panel steady; no inline loading/error messages */}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-tight">
        {backgrounds?.map((bg) => (
          <button
            key={bg.index}
            onClick={() => handleSelect(bg)}
            className={`choice-card choice-card--compact background-card ${selectedBackground?.index === bg.index ? "is-active" : ""}`}
          >
            <div className="background-card__title">{bg.name}</div>
            <div className="background-card__meta">
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
    </div>
  );
};

export default BackgroundStep;


