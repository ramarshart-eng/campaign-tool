/**
 * Character Builder - Multi-step wizard for creating characters
 */

import React, { useState } from "react";
import type { Character } from "@/lib/types/Character";
import type { SRDRace, SRDClass } from "@/lib/types/SRD";
import type { LocalBackground } from "@/lib/data/backgrounds";
import NameStep from "./NameStep";
import RaceStep from "./RaceStep";
import ClassStep from "./ClassStep";
import AbilityScoresStep from "./AbilityScoresStep";
import BackgroundStep from "./BackgroundStep";
import EquipmentStep from "./EquipmentStep";
import ReviewStep from "./ReviewStep";
import type { Item } from "@/lib/types/Item";
import PersonalityStep from "./PersonalityStep";

export type BuilderStep =
  | "name"
  | "race"
  | "class"
  | "abilities"
  | "background"
  | "personality"
  | "equipment"
  | "review";

export interface CharacterBuilderState {
  name: string;
  selectedRace: SRDRace | null;
  selectedClass: SRDClass | null;
  selectedBackground: LocalBackground | null;
  abilityScores: {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
  };
  selectedSkills: string[];
  inventory: Item[];
  // Narrative fields
  personalityTraits: string;
  ideals: string;
  bonds: string;
  flaws: string;
}

interface CharacterBuilderProps {
  onComplete: (character: Character) => void;
  onCancel?: () => void;
}

const CharacterBuilder: React.FC<CharacterBuilderProps> = ({
  onComplete,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<BuilderStep>("name");
  const [builderState, setBuilderState] = useState<CharacterBuilderState>({
    name: "",
    selectedRace: null,
    selectedClass: null,
    selectedBackground: null,
    abilityScores: {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 10,
      CHA: 10,
    },
    selectedSkills: [],
    inventory: [],
    personalityTraits: "",
    ideals: "",
    bonds: "",
    flaws: "",
  });

  const updateState = (updates: Partial<CharacterBuilderState>) => {
    setBuilderState((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    const steps: BuilderStep[] = [
      "name",
      "race",
      "class",
      "abilities",
      "background",
      "personality",
      "equipment",
      "review",
    ];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const previousStep = () => {
    const steps: BuilderStep[] = [
      "name",
      "race",
      "class",
      "abilities",
      "background",
      "personality",
      "equipment",
      "review",
    ];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleComplete = (character: Character) => {
    onComplete(character);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app p-4">
      <div className="w-full max-w-7xl h-[960px] border-2 border-black bg-white builder-dense">
        {/* Progress indicator */}
        <div className="border-b-2 border-black p-4">
          <div className="flex justify-between items-center">
            <h1 className="">Character Builder</h1>
            <div className="flex gap-2">
              {["name", "race", "class", "abilities", "background", "personality", "equipment", "review"].map((step, index) => {
                const steps: BuilderStep[] = ["name", "race", "class", "abilities", "background", "equipment", "review"];
                const currentIndex = steps.indexOf(currentStep);
                const isActive = step === currentStep;
                const isComplete = index < currentIndex;

                return (
                  <div
                    key={step}
                    className={`step-dot ${isActive ? "is-active" : ""} ${isComplete ? "is-complete" : ""}`}
                  >
                    {index + 1}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step content */}
        <div className="p-8">
          {currentStep === "name" && (
            <NameStep
              state={builderState}
              updateState={updateState}
              onNext={nextStep}
              onCancel={onCancel}
            />
          )}
          {currentStep === "race" && (
            <RaceStep
              state={builderState}
              updateState={updateState}
              onNext={nextStep}
              onPrevious={previousStep}
            />
          )}
          {currentStep === "class" && (
            <ClassStep
              state={builderState}
              updateState={updateState}
              onNext={nextStep}
              onPrevious={previousStep}
            />
          )}
          {currentStep === "abilities" && (
            <AbilityScoresStep
              state={builderState}
              updateState={updateState}
              onNext={nextStep}
              onPrevious={previousStep}
            />
          )}
          {currentStep === "background" && (
            <BackgroundStep
              state={builderState}
              updateState={updateState}
              onNext={nextStep}
              onPrevious={previousStep}
            />
          )}
          {currentStep === "personality" && (
            <PersonalityStep
              state={builderState}
              updateState={updateState}
              onNext={nextStep}
              onPrevious={previousStep}
            />
          )}
          {currentStep === "equipment" && (
            <EquipmentStep
              state={builderState}
              updateState={updateState}
              onNext={nextStep}
              onPrevious={previousStep}
            />
          )}
          {currentStep === "review" && (
            <ReviewStep
              state={builderState}
              onComplete={handleComplete}
              onPrevious={previousStep}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterBuilder;


