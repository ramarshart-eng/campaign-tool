/**
 * Character Builder - Multi-step wizard for creating characters
 */

import React, { useState } from "react";
import type { Character } from "@/lib/types/Character";
import type { SRDRace, SRDClass } from "@/lib/types/SRD";
import type { LocalBackground } from "@/lib/data/backgrounds";
import NameStep from "./NameStep";
import RaceStep from "./RaceStep";
import ClassLevelsStep from "./ClassLevelsStep";
import AbilityScoresStep from "./AbilityScoresStep";
import BackgroundStep from "./BackgroundStep";
import EquipmentStep from "./EquipmentStep";
import ReviewStep from "./ReviewStep";
import type { Item } from "@/lib/types/Item";
import PersonalityStep from "./PersonalityStep";
import { getRaces, getClasses, getBackground as fetchSRDBackground, getRace, getClass } from "@/lib/api/srd";
import type { APIReference } from "@/lib/types/SRD";
import AdvancementStep from "./AdvancementStep";
import SpellsStep from "./SpellsStep";
import type { AdvancementChoice, AdvancementMap } from "@/lib/types/advancement";

export type BuilderStep =
  | "name"
  | "race"
  | "class"
  | "abilities"
  | "advancement"
  | "spells"
  | "background"
  | "personality"
  | "equipment"
  | "review";

const BUILDER_STEPS: BuilderStep[] = [
  "name",
  "race",
  "class",
  "abilities",
  "advancement",
  "spells",
  "background",
  "personality",
  "equipment",
  "review",
];

export interface ClassSelection {
  classRef: SRDClass | null;
  level: number;
}

export interface SpellcastingChoice {
  cantrips: string[];
  known?: string[];
  prepared: string[];
}

export interface CharacterBuilderState {
  name: string;
  selectedRace: SRDRace | null;
  selectedClass: SRDClass | null;
  classSelections: ClassSelection[];
  selectedBackground: LocalBackground | null;
  level: number;
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
  allowFeats: boolean;
  advancements: AdvancementMap;
  spellcastingChoices: Record<string, SpellcastingChoice>;
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
  const [racesCache, setRacesCache] = useState<APIReference[] | null>(null);
  const [classesCache, setClassesCache] = useState<APIReference[] | null>(null);
  const [raceDetailCache, setRaceDetailCache] = useState<any | null>(null);
  const [classDetailCache, setClassDetailCache] = useState<any | null>(null);
  const [builderState, setBuilderState] = useState<CharacterBuilderState>({
    name: "",
    selectedRace: null,
    selectedClass: null,
    classSelections: [{ classRef: null, level: 1 }],
    selectedBackground: null,
    level: 1,
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
    allowFeats: false,
    advancements: {},
    spellcastingChoices: {},
    personalityTraits: "",
    ideals: "",
    bonds: "",
    flaws: "",
  });

  const updateState = (updates: Partial<CharacterBuilderState>) => {
    setBuilderState((prev) => ({ ...prev, ...updates }));
  };

  const preloadStep = async (step: BuilderStep) => {
    try {
      if (step === "race") {
        const res = await getRaces();
        setRacesCache(res.results);
        if (builderState.selectedRace?.index) {
          try {
            const detail = await getRace(builderState.selectedRace.index);
            setRaceDetailCache(detail);
          } catch {}
        } else {
          setRaceDetailCache(null);
        }
      } else if (step === "class") {
        const res = await getClasses();
        setClassesCache(res.results);
        if (builderState.selectedClass?.index) {
          try {
            const detail = await getClass(builderState.selectedClass.index);
            setClassDetailCache(detail);
          } catch {}
        } else {
          setClassDetailCache(null);
        }
      } else if (step === "personality") {
        const idx = builderState.selectedBackground?.index;
        if (idx) {
          await fetchSRDBackground(idx);
        }
      }
    } catch (_) {
      // Ignore preload errors; step will handle errors gracefully
    }
  };

  const nextStep = async () => {
    const currentIndex = BUILDER_STEPS.indexOf(currentStep);
    if (currentIndex < BUILDER_STEPS.length - 1) {
      const target = BUILDER_STEPS[currentIndex + 1];
      await preloadStep(target);
      setCurrentStep(target);
    }
  };

  const previousStep = async () => {
    const currentIndex = BUILDER_STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      const target = BUILDER_STEPS[currentIndex - 1];
      await preloadStep(target);
      setCurrentStep(target);
    }
  };

  const handleComplete = (character: Character) => {
    onComplete(character);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app p-4">
      <div className="w-full border-2 border-black bg-white builder-dense builder-panel">
        {/* Progress indicator */}
        <div className="border-b-2 border-black p-4">
          <div className="flex justify-between items-center">
            <h1 className="">Character Builder</h1>
            <div className="flex gap-2">
              {BUILDER_STEPS.map((step, index) => {
                const currentIndex = BUILDER_STEPS.indexOf(currentStep);
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
        <div className="builder-content">
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
              racesPrefetch={racesCache ?? undefined}
              raceDetailsPrefetch={raceDetailCache ?? undefined}
            />
          )}
          {currentStep === "class" && (
            <ClassLevelsStep
              state={builderState}
              updateState={updateState}
              onNext={nextStep}
              onPrevious={previousStep}
              classesPrefetch={classesCache ?? undefined}
              classDetailsPrefetch={classDetailCache ?? undefined}
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
          {currentStep === "advancement" && (
            <AdvancementStep
              state={builderState}
              updateState={updateState}
              onNext={nextStep}
              onPrevious={previousStep}
            />
          )}
          {currentStep === "spells" && (
            <SpellsStep
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


