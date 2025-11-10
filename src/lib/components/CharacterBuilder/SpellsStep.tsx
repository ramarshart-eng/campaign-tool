import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterBuilderState, SpellcastingChoice } from "./CharacterBuilder";
import { getClassSpells } from "@/lib/api/srd";
import { getTotalLevel, getProficiencyBonus, applyRacialBonuses, applyAbilityScoreImprovements } from "@/lib/rules/derivedStats";
import { abilityMod } from "@/lib/rules/computeModifiers";
import { getSpellcastingMeta } from "@/lib/rules/spellcastingRules";
import { FEATS_BY_ID } from "@/lib/data/feats";
import type { AbilityKey } from "@/lib/types/advancement";
import type { SRDClass } from "@/lib/types/SRD";

interface SpellsStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

interface SpellReference {
  index: string;
  name: string;
  level: number;
}

interface SpellPickerProps {
  title: string;
  max: number;
  value: string[];
  options: SpellReference[];
  onChange: (next: string[]) => void;
  disabledPredicate?: (spell: SpellReference) => boolean;
}

const SpellPicker: React.FC<SpellPickerProps> = ({
  title,
  max,
  value,
  options,
  onChange,
  disabledPredicate,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (max <= 0) {
    return null;
  }

  const toggleSpell = (spellName: string) => {
    if (value.includes(spellName)) {
      onChange(value.filter((name) => name !== spellName));
    } else if (value.length < max) {
      onChange([...value, spellName]);
    }
  };

  return (
    <div className="suggestion-picker" ref={containerRef}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>{title}</span>
        <button
          type="button"
          className="btn-frame btn-frame--sm"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          {value.length}/{max} selected
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {value.map((spell) => (
            <span key={spell} className="choice-chip chip-sm truncate-1" title={spell}>
              {spell}
            </span>
          ))}
        </div>
      )}
      {open && (
        <div className="popover mt-2" role="dialog">
          <div className="popover-list">
            {options.map((spell) => {
              const isActive = value.includes(spell.name);
              const disabled =
                (!isActive && value.length >= max) || (disabledPredicate ? disabledPredicate(spell) : false);
              return (
                <button
                  type="button"
                  key={spell.index}
                  className={`suggestion-option ${isActive ? "is-active" : ""}`}
                  disabled={disabled}
                  onClick={() => toggleSpell(spell.name)}
                >
                  <div className="font-semibold text-left">{spell.name}</div>
                  <div className="text-xs text-muted text-left">Level {spell.level}</div>
                  {disabled && !isActive && (
                    <div className="text-xs text-danger text-left">Not available</div>
                  )}
                </button>
              );
            })}
            {options.length === 0 && (
              <div className="text-sm text-muted">No spells available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ensureChoice = (choices: Record<string, SpellcastingChoice>, classIndex: string): SpellcastingChoice => {
  if (choices[classIndex]) return choices[classIndex];
  return { cantrips: [], prepared: [] };
};

const SpellsStep: React.FC<SpellsStepProps> = ({ state, updateState, onNext, onPrevious }) => {
  const [spellsCache, setSpellsCache] = useState<Record<string, SpellReference[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const totalLevel = getTotalLevel(state.classSelections);
  const abilityScoresWithRace = applyRacialBonuses(state.abilityScores, state.selectedRace);
  const finalAbilities = applyAbilityScoreImprovements(abilityScoresWithRace, state.advancements, totalLevel, {
    featsById: FEATS_BY_ID,
  });
  const abilityMods = {
    STR: abilityMod(finalAbilities.STR),
    DEX: abilityMod(finalAbilities.DEX),
    CON: abilityMod(finalAbilities.CON),
    INT: abilityMod(finalAbilities.INT),
    WIS: abilityMod(finalAbilities.WIS),
    CHA: abilityMod(finalAbilities.CHA),
  } satisfies Record<AbilityKey, number>;
  const proficiencyBonus = getProficiencyBonus(totalLevel);

  const castingEntries = useMemo(() => {
    const map: Record<string, { classRef: SRDClass; level: number }> = {};
    state.classSelections.forEach((sel) => {
      if (!sel.classRef || !sel.classRef.spellcasting) return;
      const idx = sel.classRef.index;
      if (!map[idx]) {
        map[idx] = { classRef: sel.classRef, level: 0 };
      }
      map[idx].level += sel.level;
    });
    return Object.values(map);
  }, [state.classSelections]);

  useEffect(() => {
    castingEntries.forEach((entry) => {
      const idx = entry.classRef.index;
      if (spellsCache[idx] || loading[idx]) return;
      setLoading((prev) => ({ ...prev, [idx]: true }));
      getClassSpells(idx)
        .then((res) => {
          const spells =
            res.results?.map((spell) => ({ index: spell.index, name: spell.name, level: spell.level ?? 0 })) ?? [];
          setSpellsCache((prev) => ({ ...prev, [idx]: spells }));
        })
        .catch(() => {
          setSpellsCache((prev) => ({ ...prev, [idx]: [] }));
        })
        .finally(() => {
          setLoading((prev) => ({ ...prev, [idx]: false }));
        });
    });
  }, [castingEntries, spellsCache, loading]);

  const [activeClassIndex, setActiveClassIndex] = useState<string | null>(null);
  const activeEntry = useMemo(() => {
    if (!castingEntries.length) return null;
    const target = castingEntries.find((entry) => entry.classRef.index === activeClassIndex);
    return target ?? castingEntries[0];
  }, [castingEntries, activeClassIndex]);

  useEffect(() => {
    if (castingEntries.length === 0) {
      setActiveClassIndex(null);
    } else if (!activeClassIndex || !castingEntries.find((entry) => entry.classRef.index === activeClassIndex)) {
      setActiveClassIndex(castingEntries[0].classRef.index);
    }
  }, [castingEntries, activeClassIndex]);

  const metaMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof getSpellcastingMeta> | null> = {};
    castingEntries.forEach((entry) => {
      map[entry.classRef.index] = getSpellcastingMeta(entry.classRef.index, entry.level, finalAbilities);
    });
    return map;
  }, [castingEntries, finalAbilities]);

  const updateChoice = (classIndex: string, next: SpellcastingChoice) => {
    updateState({
      spellcastingChoices: {
        ...state.spellcastingChoices,
        [classIndex]: next,
      },
    });
  };

  const buildPicker = (
    classIndex: string,
    type: "cantrips" | "known" | "prepared",
    max: number,
    options: SpellReference[],
    disabledPredicate?: (spell: SpellReference) => boolean,
    labelOverride?: string
  ) => {
    if (max <= 0) return null;
    const current = ensureChoice(state.spellcastingChoices, classIndex);
    const value =
      type === "cantrips"
        ? current.cantrips
        : type === "known"
        ? current.known ?? []
        : current.prepared;

    const labelMap = {
      cantrips: "Cantrips",
      known: "Spellbook",
      prepared: "Prepared",
    } as const;
    const labelText = labelOverride ?? labelMap[type];
    return (
      <SpellPicker
        key={`${classIndex}-${type}`}
        title={`${labelText} (${value.length}/${max})`}
        max={max}
        value={value}
        options={options}
        disabledPredicate={disabledPredicate}
        onChange={(next) => {
          const currentChoice = ensureChoice(state.spellcastingChoices, classIndex);
          const updated: SpellcastingChoice = {
            ...currentChoice,
            cantrips: type === "cantrips" ? next : currentChoice.cantrips,
            prepared: type === "prepared" ? next : currentChoice.prepared,
            known: type === "known" ? next : currentChoice.known,
          };
          if (!updated.known) delete updated.known;
          updateChoice(classIndex, updated);
        }}
      />
    );
  };

  const renderActiveClass = () => {
    if (!activeEntry) {
      return <p className="text-muted">No spellcasting classes at your current levels.</p>;
    }
    const classIndex = activeEntry.classRef.index;
    const meta = metaMap[classIndex];
    if (!meta) {
      return <p className="text-muted">This class does not gain spells at the current level.</p>;
    }
    const choice = ensureChoice(state.spellcastingChoices, classIndex);
    const classSpells = spellsCache[classIndex];
    const isLoading = loading[classIndex];
    if (!classSpells) {
      return (
        <p className="text-sm text-muted">
          {isLoading ? "Loading spells..." : "Spell list unavailable for this class."}
        </p>
      );
    }
    const highestSpellLevel = Math.max(1, Math.min(activeEntry.level, 9));
    const cantripOptions = classSpells.filter((spell) => (spell.level ?? 0) === 0);
    const leveledOptions = classSpells.filter((spell) => {
      const lvl = spell.level ?? 0;
      return lvl > 0 && lvl <= highestSpellLevel;
    });
    const knownOptions = leveledOptions;
    const preparedOptions = leveledOptions;
    const knownSet = new Set(choice.known ?? []);
    const abilityModifier = abilityMods[meta.ability];
    const saveDC = 8 + proficiencyBonus + abilityModifier;
    const attackBonus = proficiencyBonus + abilityModifier;

    return (
      <div className="space-y-4">
        {buildPicker(classIndex, "cantrips", meta.cantripsKnown, cantripOptions)}
        {meta.mode !== "prepared" && meta.knownCount &&
          buildPicker(
            classIndex,
            "known",
            meta.knownCount,
            knownOptions,
            undefined,
            meta.mode === "known" ? "Spells Known" : "Spellbook"
          )}
        {(meta.mode === "prepared" || meta.mode === "known-prepared") &&
          buildPicker(
            classIndex,
            "prepared",
            meta.preparedCount,
            meta.mode === "known-prepared"
              ? preparedOptions.filter((spell) => knownSet.has(spell.name))
              : preparedOptions,
            meta.mode === "known-prepared"
              ? (spell) => !knownSet.has(spell.name)
              : undefined
          )}
        <div className="text-sm text-muted flex flex-wrap gap-4">
          <span>Spell Save DC: {saveDC}</span>
          <span>Spell Attack Bonus: {attackBonus >= 0 ? `+${attackBonus}` : attackBonus}</span>
        </div>
      </div>
    );
  };

  const isClassComplete = (entry: { classRef: SRDClass; level: number }) => {
    const meta = metaMap[entry.classRef.index];
    if (!meta) return true;
    const choice = ensureChoice(state.spellcastingChoices, entry.classRef.index);
    const cantripsOK = choice.cantrips.length === meta.cantripsKnown;
    const requiresKnown = meta.mode === "known-prepared" || meta.mode === "known";
    const knownOK = requiresKnown && meta.knownCount ? (choice.known?.length ?? 0) === meta.knownCount : !requiresKnown;
    const requiresPrepared = meta.mode === "prepared" || meta.mode === "known-prepared";
    const preparedOK = requiresPrepared ? choice.prepared.length === meta.preparedCount : true;
    return cantripsOK && knownOK && preparedOK;
  };

  const canProceed = castingEntries.length === 0 || castingEntries.every(isClassComplete);

  return (
    <div className="builder-step">
      <div>
        <h2 className=" mb-1">Choose Your Spells</h2>
        <p className="text-muted mt-0">
          Select the cantrips and spells your spellcasting classes know or prepare at 1st level.
        </p>
      </div>

      {castingEntries.length === 0 ? (
        <div className="frame pad-4 text-sm text-muted">No spellcasting options are available for your current class levels.</div>
      ) : (
        <div className="frame pad-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {castingEntries.map((entry) => (
              <button
                key={entry.classRef.index}
                type="button"
                className={`choice-chip ${activeEntry?.classRef.index === entry.classRef.index ? "is-active" : ""}`}
                onClick={() => setActiveClassIndex(entry.classRef.index)}
              >
                {entry.classRef.name} {entry.level}
              </button>
            ))}
          </div>
          {renderActiveClass()}
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

export default SpellsStep;
