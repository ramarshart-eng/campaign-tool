/**
 * Step 1: Character Name Input
 */

import React from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";

interface NameStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onCancel?: () => void;
}

const NameStep: React.FC<NameStepProps> = ({
  state,
  updateState,
  onCancel,
}) => {
  const handleChange = (value: string) => {
    updateState({ name: value });
  };

  const handleBlur = () => {
    const trimmed = state.name.trim();
    if (trimmed !== state.name) {
      updateState({ name: trimmed });
    }
  };

  return (
    <div className="builder-step">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className=" mb-1">What is your character&rsquo;s name?</h2>
          <p className="text-muted mt-0">
            This is the name your character will be known by throughout the campaign.
          </p>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-frame">
            Cancel
          </button>
        )}
      </div>

      <div>
        <label htmlFor="character-name" className="block  mb-2">
          Character Name
        </label>
        <input
          id="character-name"
          type="text"
          value={state.name}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          className="w-full input-frame"
          placeholder="Enter character name..."
          autoFocus
        />
      </div>
    </div>
  );
};

export default NameStep;
