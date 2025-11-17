/**
 * Character Builder reformatted to use the shared BookShell container.
 * Pages render via BookShell.renderSpread with existing step components.
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
import PersonalityStep from "./PersonalityStep";
import SpellsStep from "./SpellsStep";
import ReviewStep from "./ReviewStep";
import {
  applyRacialBonuses,
  applyAbilityScoreImprovements,
  getTotalLevel,
} from "@/lib/rules/derivedStats";
import { FEATS_BY_ID } from "@/lib/data/feats";
import { getSpellcastingMeta } from "@/lib/rules/spellcastingRules";
import BookShell from "@/lib/components/BookShell";
import type { BookShellSlots } from "@/lib/components/BookShell";

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

  type PageRenderer = (slots: BookShellSlots) => React.ReactNode;

  // Page labels for header indicators
  const pageLabel = (pageIndex: number): string => {
    switch (pageIndex) {
      case 0:
        return "Cover";
      case 1:
        return "Name";
      case 2:
        return "Race";
      case 3:
        return "Classes";
      case 4:
        return "Ability Scores";
      case 5:
        return "Background";
      case 6:
        return "Personality";
      case 7:
        return "Spells";
      case 8:
        return "Review";
      case 9:
        return "Review";
      default:
        return "";
    }
  };

  // Single-page completeness (mirrors gating rules)
  const isPageComplete = (pageIndex: number): boolean => {
    if (pageIndex < 0) return false;
    switch (pageIndex) {
      case 0: // Cover
        return true;
      case 1: // Name
        return (builderState.name || "").trim().length > 0;
      case 2: // Race
        return !!builderState.selectedRace;
      case 3: // Classes & Levels
        return (builderState.classSelections || []).some(
          (sel) => !!sel?.classRef,
        );
      case 4: {
        // Ability Scores
        const standard = [15, 14, 13, 12, 10, 8].sort((a, b) => a - b);
        const scores = [
          builderState.abilityScores.STR,
          builderState.abilityScores.DEX,
          builderState.abilityScores.CON,
          builderState.abilityScores.INT,
          builderState.abilityScores.WIS,
          builderState.abilityScores.CHA,
        ].sort((a, b) => a - b);
        return (
          scores.length === 6 &&
          scores.every((v, i) => v === standard[i])
        );
      }
      case 5: // Background
        return !!builderState.selectedBackground;
      case 6: // Personality
        return [
          builderState.personalityTraits,
          builderState.ideals,
          builderState.bonds,
          builderState.flaws,
        ].every((t) => (t || "").trim().length > 0);
      case 7: {
        // Spells
        const selections = (builderState.classSelections || []).filter(
          (s) => s && s.classRef,
        );
        if (selections.length === 0) return true;
        if (!builderState.selectedRace) return false;
        const totalLevel = getTotalLevel(builderState.classSelections);
        const baseWithRace = applyRacialBonuses(
          builderState.abilityScores,
          builderState.selectedRace,
        );
        const finalAbilities = applyAbilityScoreImprovements(
          baseWithRace,
          builderState.advancements,
          totalLevel,
          { featsById: FEATS_BY_ID },
        );
        for (const sel of selections) {
          const classIndex = sel!.classRef!.index;
          const meta = getSpellcastingMeta(
            classIndex,
            sel!.level,
            finalAbilities,
          );
          if (!meta) continue;
          const choice =
            builderState.spellcastingChoices[classIndex] || {
              cantrips: [],
              prepared: [],
              known: [],
            };
          const cantripsOk =
            (choice.cantrips?.length || 0) ===
            (meta.cantripsKnown || 0);
          const knownOk =
            meta.mode !== "prepared"
              ? (choice.known?.length || 0) ===
                (meta.knownCount || 0)
              : true;
          const preparedOk =
            meta.mode === "prepared" || meta.mode === "known-prepared"
              ? (choice.prepared?.length || 0) ===
                (meta.preparedCount || 0)
              : true;
          if (!cantripsOk || !knownOk || !preparedOk) return false;
        }
        return true;
      }
      case 8: // Review (overview)
        return true;
      case 9: // Review (details)
        return true;
      default:
        return false;
    }
  };

  const pages: PageRenderer[] = [
    // 1: Blank cover page (left page 1)
    () => null,
    // 2: Name (right page of first spread)
    () => (
      <NameStep
        state={builderState}
        updateState={updateState}
        onCancel={onCancel}
      />
    ),
    // 3: Race
    () => <RaceStep state={builderState} updateState={updateState} />,
    // 4: Classes & Levels
    () => (
      <ClassLevelsStep
        state={builderState}
        updateState={updateState}
      />
    ),
    // 5: Ability Scores
    () => (
      <AbilityScoresStep
        state={builderState}
        updateState={updateState}
      />
    ),
    // 6: Background
    () => (
      <BackgroundStep
        state={builderState}
        updateState={updateState}
      />
    ),
    // 7: Personality
    () => (
      <PersonalityStep
        state={builderState}
        updateState={updateState}
      />
    ),
    // 8: Spells
    () => <SpellsStep state={builderState} updateState={updateState} />,
    // 9: Review & Complete (overview)
    () => (
      <ReviewStep
        state={builderState}
        onComplete={onComplete}
        part="overview"
      />
    ),
    // 10: Review (equipment/feats only)
    () => (
      <ReviewStep
        state={builderState}
        onComplete={onComplete}
        part="equipment"
      />
    ),
  ];

  return (
    <BookShell
      getPageNumbers={({ spreadStart }) => {
        if (spreadStart === 0) {
          return { left: null, right: 1 };
        }
        return { left: spreadStart, right: spreadStart + 1 };
      }}
      canGoPrev={({ spreadStart }) => spreadStart > 0}
      canGoNext={({ spreadStart }) => {
        // Gate forward navigation by spread completeness (both pages)
        const leftIndex = spreadStart;
        const rightIndex = spreadStart + 1;
        // Prevent advancing past the end (no further spreads)
        const nextLeft = spreadStart + 2;
        const nextRight = nextLeft + 1;
        if (!pages[nextLeft] && !pages[nextRight]) return false;
        if (!pages[leftIndex] || !pages[rightIndex]) return false;
        return (
          isPageComplete(leftIndex) && isPageComplete(rightIndex)
        );
      }}
      renderSpread={(slots) => ({
        left: pages[slots.spreadStart]
          ? pages[slots.spreadStart](slots)
          : null,
        right: pages[slots.spreadStart + 1]
          ? pages[slots.spreadStart + 1](slots)
          : null,
      })}
    />
  );
};

export default CharacterBuilder;
