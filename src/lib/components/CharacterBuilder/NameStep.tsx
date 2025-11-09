/**
 * Step 1: Character Name Input
 */

import React, { useState } from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";

interface NameStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onNext: () => void;
  onCancel?: () => void;
}

const NameStep: React.FC<NameStepProps> = ({
  state,
  updateState,
  onNext,
  onCancel,
}) => {
  const [localName, setLocalName] = useState(state.name);

  const handleNext = () => {
    if (localName.trim()) {
      updateState({ name: localName.trim() });
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className=" mb-2">What is your character's name?</h2>
        <p className="text-muted">
          This is the name your character will be known by throughout the campaign.
        </p>
      </div>

      <div>
        <label htmlFor="character-name" className="block  mb-2">
          Character Name
        </label>
        <input
          id="character-name"
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && localName.trim()) {
              handleNext();
            }
          }}
          className="w-full input-frame"
          placeholder="Enter character name..."
          autoFocus
        />
      </div>

      <div className="flex justify-between pt-4">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="btn-frame">
            Cancel
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={!localName.trim()}
          className={`btn-frame ${!localName.trim() ? "btn-disabled" : ""}`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default NameStep;
