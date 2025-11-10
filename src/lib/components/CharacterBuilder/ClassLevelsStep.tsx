import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterBuilderState, ClassSelection } from "./CharacterBuilder";
import type { APIReference, SRDClass } from "@/lib/types/SRD";
import { useClasses } from "@/lib/hooks/useSRD";
import { getClass, getClassSpells } from "@/lib/api/srd";
import { abilityMod } from "@/lib/rules/computeModifiers";
import { estimateHitPoints, getProficiencyBonus, getTotalLevel } from "@/lib/rules/derivedStats";

interface ClassLevelsStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onNext: () => void;
  onPrevious: () => void;
  classesPrefetch?: APIReference[];
  classDetailsPrefetch?: SRDClass;
}

const ensureSelections = (state: CharacterBuilderState): ClassSelection[] => {
  if (state.classSelections && state.classSelections.length > 0) {
    return state.classSelections;
  }
  return [{ classRef: state.selectedClass ?? null, level: state.level || 1 }];
};

const ClassLevelsStep: React.FC<ClassLevelsStepProps> = ({
  state,
  updateState,
  onNext,
  onPrevious,
  classesPrefetch,
  classDetailsPrefetch,
}) => {
  const selections = ensureSelections(state);
  const [activeIndex, setActiveIndex] = useState(0);
  const classesHook = useClasses();
  const classes = classesPrefetch ?? classesHook.data;
  const loading = classesPrefetch ? false : classesHook.loading;
  const error = classesPrefetch ? null : classesHook.error;
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const classCache = useRef<Record<string, SRDClass>>({});
  const [spellsCache, setSpellsCache] = useState<Record<string, { name: string; level: number }[]>>({});

  useEffect(() => {
    if (classDetailsPrefetch?.index) {
      classCache.current[classDetailsPrefetch.index] = classDetailsPrefetch;
    }
  }, [classDetailsPrefetch]);

  useEffect(() => {
    if (!state.classSelections || state.classSelections.length === 0) {
      updateState({
        classSelections: selections,
        selectedClass: selections[0]?.classRef ?? null,
        level: getTotalLevel(selections),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSelection = selections[Math.min(activeIndex, selections.length - 1)];
  const totalLevel = getTotalLevel(selections);
  const conMod = abilityMod(state.abilityScores.CON);
  const hpEstimate = estimateHitPoints(selections, conMod);

  const commitSelections = (nextSelections: ClassSelection[]) => {
    const cleaned = nextSelections.filter((sel) => sel);
    const nextLevel = getTotalLevel(cleaned);
    const nextAdvancements = { ...(state.advancements || {}) };
    Object.keys(nextAdvancements).forEach((lvl) => {
      if (parseInt(lvl, 10) > nextLevel) {
        delete nextAdvancements[parseInt(lvl, 10)];
      }
    });
    const nextSpellChoices = { ...(state.spellcastingChoices || {}) };
    Object.keys(nextSpellChoices).forEach((classIndex) => {
      if (!cleaned.some((sel) => sel.classRef?.index === classIndex)) {
        delete nextSpellChoices[classIndex];
      }
    });
    updateState({
      classSelections: cleaned,
      selectedClass: cleaned[0]?.classRef ?? null,
      level: nextLevel,
      advancements: nextAdvancements,
      spellcastingChoices: nextSpellChoices,
    });
  };

  const handleLevelChange = (index: number, value: number) => {
    const clamped = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
    const otherLevels = totalLevel - selections[index].level;
    const maxAllowed = Math.max(1, 20 - otherLevels);
    const nextLevel = Math.min(clamped, maxAllowed);
    const nextSelections = selections.map((sel, i) =>
      i === index ? { ...sel, level: nextLevel } : sel
    );
    commitSelections(nextSelections);
  };

  const handleAddClass = () => {
    if (selections.length >= 4 || totalLevel >= 20) return;
    const nextSelections = [...selections, { classRef: null, level: 1 }];
    commitSelections(nextSelections);
    setActiveIndex(nextSelections.length - 1);
  };

  const handleRemoveClass = (index: number) => {
    if (selections.length <= 1) return;
    const nextSelections = selections.filter((_, i) => i !== index);
    commitSelections(nextSelections);
    setActiveIndex(Math.max(0, index - 1));
  };

  const fetchClassDetail = async (classIndex: string) => {
    if (classCache.current[classIndex]) {
      return classCache.current[classIndex];
    }
    const detail = (await getClass(classIndex)) as SRDClass;
    classCache.current[classIndex] = detail;
    return detail;
  };

  const ensureClassSpells = async (classIndex: string) => {
    if (spellsCache[classIndex]) {
      return spellsCache[classIndex];
    }
    try {
      const response = await getClassSpells(classIndex);
      const spells =
        response.results?.map((spell) => ({ name: spell.name, level: spell.level ?? 0 })) ?? [];
      setSpellsCache((prev) => ({ ...prev, [classIndex]: spells }));
      return spells;
    } catch {
      setSpellsCache((prev) => ({ ...prev, [classIndex]: [] }));
      return [];
    }
  };

  const handleSelectClass = async (classIndex: string) => {
    setSelectionError(null);
    setAssigning(true);
    try {
      const detail = await fetchClassDetail(classIndex);
      ensureClassSpells(classIndex);
      const next = selections.map((sel, idx) =>
        idx === activeIndex ? { ...sel, classRef: detail } : sel
      );
      commitSelections(next);
    } catch {
      setSelectionError("Unable to load class details. Please try again.");
    } finally {
      setAssigning(false);
    }
  };

  const summaryLabel = useMemo(() => {
    return selections
      .filter((sel) => sel.classRef && sel.level > 0)
      .map((sel) => `${sel.classRef!.name} ${sel.level}`)
      .join(" / ");
  }, [selections]);

  const canProceed = selections.some((sel) => sel.classRef && sel.level > 0);
  const activeClassSpells = useMemo(() => {
    if (!activeSelection?.classRef) return [];
    const all = spellsCache[activeSelection.classRef.index] || [];
    const levelCap = Math.max(1, activeSelection.level || 1);
    return all.filter((spell) => (spell.level ?? 0) <= levelCap);
  }, [activeSelection, spellsCache]);

  return (
    <div className="builder-step">
      <div>
        <h2 className=" mb-1">Choose Classes & Levels</h2>
        <p className="text-muted mt-0">
          Assign your character&apos;s classes and levels. You can add additional classes later for multiclassing.
        </p>
      </div>

      <div className="frame pad-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {selections.map((sel, idx) => (
            <button
              type="button"
              key={`sel-${idx}-${sel.classRef?.index ?? "empty"}`}
              className={`choice-chip ${idx === activeIndex ? "is-active" : ""}`}
              onClick={() => setActiveIndex(idx)}
            >
              {sel.classRef ? `${sel.classRef.name} ${sel.level}` : `Class ${idx + 1}`}
            </button>
          ))}
          {selections.length < 4 && totalLevel < 20 && (
            <button type="button" className="choice-chip" onClick={handleAddClass}>
              + Add Class
            </button>
          )}
        </div>

        {activeSelection && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-subtle">
              Levels in {activeSelection.classRef ? activeSelection.classRef.name : "Selected Class"}
            </div>
            <input
              type="number"
              min={1}
              max={20}
              value={activeSelection.level}
              onChange={(e) => handleLevelChange(activeIndex, parseInt(e.target.value, 10))}
              className="input-frame w-24"
            />
            {activeIndex > 0 && (
              <button type="button" className="btn-frame btn-frame--sm" onClick={() => handleRemoveClass(activeIndex)}>
                Remove
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-subtle">Total Level:</span> {totalLevel}
          </div>
          <div>
            <span className="text-subtle">Proficiency Bonus:</span> +{getProficiencyBonus(totalLevel)}
          </div>
          <div>
            <span className="text-subtle">HP Estimate:</span> {hpEstimate.total > 0 ? `${hpEstimate.total} HP` : "-"}
          </div>
        </div>
        {summaryLabel && (
          <div className="text-sm text-muted">Summary: {summaryLabel}</div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <h3 className=" text-base">Select a Class</h3>
        {selectionError && <div className="text-danger text-sm">{selectionError}</div>}
        <div className="grid grid-cols-2 md:grid-cols-4 grid-tight">
          {loading && <div className="text-subtle col-span-2">Loading classes...</div>}
          {error && <div className="text-danger col-span-2">Failed to load classes.</div>}
          {classes?.map((cls) => (
            <button
              key={cls.index}
              onClick={() => handleSelectClass(cls.index)}
              disabled={assigning}
              className={`choice-card ${activeSelection?.classRef?.index === cls.index ? "is-active" : ""}`}
            >
              <div>{cls.name}</div>
            </button>
          ))}
        </div>
      </div>

      {activeSelection?.classRef && (
        <div className="frame surface-muted pad-6 mt-4">
          <h3 className=" mb-3">{activeSelection.classRef.name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="subheading">Hit Die:</span> 1d{activeSelection.classRef.hit_die}
            </div>
            {activeSelection.classRef.spellcasting && (
              <div>
                <span className="subheading">Spellcasting Ability:</span> {activeSelection.classRef.spellcasting.spellcasting_ability.name}
              </div>
            )}
            {activeSelection.classRef.proficiencies && activeSelection.classRef.proficiencies.length > 0 && (
              <div>
                <span className="subheading">Proficiencies:</span>
                <span className="ml-1 block md:inline">
                  {activeSelection.classRef.proficiencies.map((prof) => prof.name).join(", ")}
                </span>
              </div>
            )}
            {(activeClassSpells.length > 0 || activeSelection.classRef.spellcasting) && (
              <div>
                <span className="subheading">Class Spells:</span>
                <span className="ml-1 block md:inline">
                  {activeClassSpells.length > 0
                    ? (() => {
                        const preview = activeClassSpells
                          .slice(0, 6)
                          .map((spell) => spell.name)
                          .join(", ");
                        const extra = activeClassSpells.length - 6;
                        return extra > 0 ? `${preview} (+${extra} more)` : preview;
                      })()
                    : "See spell list in class details."}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="builder-footer">
        <button type="button" onClick={onPrevious} className="btn-frame btn-frame--lg">
          Previous
        </button>
        <button type="button" onClick={onNext} disabled={!canProceed} className={`btn-frame ${!canProceed ? "btn-disabled" : ""}`}>
          Next
        </button>
      </div>
    </div>
  );
};

export default ClassLevelsStep;
