import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";
import { getAsiLevels, getTotalLevel, applyAbilityScoreImprovements } from "@/lib/rules/derivedStats";
import type { AbilityKey, AdvancementChoice, AdvancementMap } from "@/lib/types/advancement";
import { SRD_FEATS, FEATS_BY_ID } from "@/lib/data/feats";

const ABILITY_KEYS: AbilityKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

interface AdvancementStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const emptyAbilityChoices: AdvancementChoice["abilityChoices"] = ["", ""];

const AdvancementStep: React.FC<AdvancementStepProps> = ({
  state,
  updateState,
  onNext,
  onPrevious,
}) => {
  const totalLevel = getTotalLevel(state.classSelections);
  const asiLevels = getAsiLevels(state.classSelections).filter((lvl) => lvl <= totalLevel);
  const [openFeatLevel, setOpenFeatLevel] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const baseAbilitiesWithRace = useMemo(() => {
    const base = { ...state.abilityScores };
    state.selectedRace?.ability_bonuses.forEach((bonus) => {
      const key = bonus.ability_score.index.toUpperCase() as AbilityKey;
      base[key] = (base[key] ?? 0) + bonus.bonus;
    });
    return base;
  }, [state.abilityScores, state.selectedRace]);

  useEffect(() => {
    if (openFeatLevel == null) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(event.target as Node)) {
        setOpenFeatLevel(null);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, [openFeatLevel]);

  const ensureEntry = (level: number): AdvancementChoice => {
    const existing = state.advancements[level];
    if (existing) {
      if (existing.mode === "asi" && !existing.abilityChoices) {
        return { ...existing, abilityChoices: [...emptyAbilityChoices] };
      }
      return existing;
    }
    return { mode: "asi", abilityChoices: [...emptyAbilityChoices] };
  };

  const updateAdvancement = (level: number, next: AdvancementChoice) => {
    const merged: AdvancementMap = { ...(state.advancements || {}) };
    merged[level] = next;
    updateState({ advancements: merged });
  };

  const handleToggleFeats = (allow: boolean) => {
    let updatedAdvancements = state.advancements;
    if (!allow) {
      updatedAdvancements = Object.fromEntries(
        Object.entries(state.advancements).map(([lvl, entry]) => {
          if (entry.mode === "feat") {
            return [
              Number(lvl),
              {
                mode: "asi",
                abilityChoices: entry.abilityChoices ?? [...emptyAbilityChoices],
              } as AdvancementChoice,
            ];
          }
          return [Number(lvl), entry];
        })
      ) as AdvancementMap;
    }
    updateState({ allowFeats: allow, advancements: updatedAdvancements });
  };

  const abilitiesBeforeLevel = (level: number) =>
    applyAbilityScoreImprovements(
      baseAbilitiesWithRace,
      state.advancements,
      level - 1,
      {
        featsById: FEATS_BY_ID,
        levelFilter: (entryLevel) => entryLevel < level,
      }
    );

  const meetsPrerequisites = (featId: string, level: number) => {
    const feat = FEATS_BY_ID[featId];
    if (!feat) return false;
    if (!feat.prerequisites || feat.prerequisites.length === 0) return true;
    const abilities = abilitiesBeforeLevel(level);
    return feat.prerequisites.every((req) => {
      if (req.type === "ability") {
        return (abilities[req.ability] ?? 0) >= req.minimum;
      }
      return true;
    });
  };

  const renderAsiControls = (level: number, entry: AdvancementChoice) => {
    const picks = entry.abilityChoices ?? [...emptyAbilityChoices];
    const handlePick = (slotIndex: 0 | 1, ability: AbilityKey | "") => {
      const nextChoices: AdvancementChoice["abilityChoices"] = [...(picks || [])] as [
        AbilityKey | "",
        AbilityKey | ""
      ];
      nextChoices[slotIndex] = ability;
      updateAdvancement(level, { ...entry, mode: "asi", abilityChoices: nextChoices });
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[0, 1].map((slot) => (
          <select
            key={slot}
            className="input-frame"
            value={picks?.[slot] ?? ""}
            onChange={(e) => handlePick(slot as 0 | 1, e.target.value as AbilityKey)}
          >
            <option value="">No increase</option>
            {ABILITY_KEYS.map((ability) => (
              <option key={ability} value={ability}>
                {ability} +1
              </option>
            ))}
          </select>
        ))}
      </div>
    );
  };

  const renderFeatControls = (level: number, entry: AdvancementChoice) => {
    const selectedFeat = entry.featId ? FEATS_BY_ID[entry.featId] : null;
    const togglePopover = () => {
      setOpenFeatLevel((prev) => (prev === level ? null : level));
    };

    return (
      <div className="relative">
        <button type="button" className="btn-frame" onClick={togglePopover}>
          {selectedFeat ? selectedFeat.name : "Choose feat"}
        </button>
        {selectedFeat && (
          <p className="text-muted text-sm mt-1 truncate-1" title={selectedFeat.description}>
            {selectedFeat.description}
          </p>
        )}
        {openFeatLevel === level && (
          <div className="popover mt-2" ref={popoverRef}>
            <div className="popover-list">
              {SRD_FEATS.map((feat) => {
                const allowed = meetsPrerequisites(feat.id, level);
                return (
                  <button
                    key={feat.id}
                    type="button"
                    className={`suggestion-option ${entry.featId === feat.id ? "is-active" : ""}`}
                    disabled={!allowed}
                    onClick={() => {
                      updateAdvancement(level, { ...entry, mode: "feat", featId: feat.id });
                      setOpenFeatLevel(null);
                    }}
                  >
                    <div className="font-semibold text-left">{feat.name}</div>
                    <div className="text-xs text-muted text-left">{feat.description}</div>
                    {!allowed && (
                      <div className="text-xs text-danger text-left">Prerequisites not met</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCard = (level: number) => {
    const entry = ensureEntry(level);
    const mode = entry.mode === "feat" && !state.allowFeats ? "asi" : entry.mode;
    const effectiveEntry = mode === entry.mode ? entry : { ...entry, mode };

    const onModeChange = (nextMode: "asi" | "feat") => {
      updateAdvancement(level, {
        ...effectiveEntry,
        mode: nextMode,
        abilityChoices: effectiveEntry.abilityChoices ?? [...emptyAbilityChoices],
        featId: nextMode === "feat" ? effectiveEntry.featId : undefined,
      });
    };

    return (
      <div key={`asi-${level}`} className="frame pad-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Level {level} Advancement</div>
          <div className="flex gap-2 items-center text-sm">
            <button
              type="button"
              className={`choice-chip ${mode === "asi" ? "is-active" : ""}`}
              onClick={() => onModeChange("asi")}
            >
              Ability Score
            </button>
            <button
              type="button"
              className={`choice-chip ${mode === "feat" ? "is-active" : ""}`}
              disabled={!state.allowFeats}
              onClick={() => onModeChange("feat")}
            >
              Feat
            </button>
          </div>
        </div>
        {mode === "asi" ? renderAsiControls(level, effectiveEntry) : renderFeatControls(level, effectiveEntry)}
      </div>
    );
  };

  return (
    <div className="builder-step">
      <div>
        <h2 className=" mb-1">Ability Improvements & Feats</h2>
        <p className="text-muted mt-0">
          Track how your character uses Ability Score Improvements or feats as they level up.
        </p>
      </div>

      <div className="frame pad-4 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.allowFeats}
            onChange={(e) => handleToggleFeats(e.target.checked)}
          />
          Enable feats (optional rule)
        </label>
        {asiLevels.length === 0 ? (
          <p className="text-muted text-sm">
            You won&rsquo;t gain ability score improvements until higher levels. Increase your class levels first to unlock these choices.
          </p>
        ) : (
          <div className="space-y-3">
            {asiLevels.map((level) => renderCard(level))}
          </div>
        )}
      </div>

      <div className="builder-footer">
        <button type="button" onClick={onPrevious} className="btn-frame btn-frame--lg">
          Previous
        </button>
        <button type="button" onClick={onNext} className="btn-frame">
          Next
        </button>
      </div>
    </div>
  );
};

export default AdvancementStep;
