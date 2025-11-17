import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterBuilderState, SpellcastingChoice } from "./CharacterBuilder";
import { getClassSpells, getSpell } from "@/lib/api/srd";
import type { SRDSpell } from "@/lib/types/SRD";
import {
  getTotalLevel,
  getProficiencyBonus,
  applyRacialBonuses,
  applyAbilityScoreImprovements,
} from "@/lib/rules/derivedStats";
import { abilityMod } from "@/lib/rules/computeModifiers";
import { getSpellcastingMeta } from "@/lib/rules/spellcastingRules";
import { FEATS_BY_ID } from "@/lib/data/feats";
import type { AbilityKey } from "@/lib/types/advancement";
import type { SRDClass } from "@/lib/types/SRD";

interface SpellsStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
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
  onOptionHover?: (spell: SpellReference, rect: DOMRect | null) => void;
}

const SpellPicker: React.FC<SpellPickerProps> = ({
  title,
  max,
  value,
  options,
  onChange,
  disabledPredicate,
  onOptionHover,
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
      {open && (
        <div className="popover mt-2" role="dialog">
          <div className="popover-list">
            {options.map((spell) => {
              const isActive = value.includes(spell.name);
              const disabled =
                (!isActive && value.length >= max) ||
                (disabledPredicate ? disabledPredicate(spell) : false);
              return (
                <button
                  type="button"
                  key={spell.index}
                  className={`suggestion-option ${isActive ? "is-active" : ""}`}
                  disabled={disabled}
                  onClick={() => toggleSpell(spell.name)}
                  onMouseEnter={(e) =>
                    onOptionHover?.(spell, e.currentTarget.getBoundingClientRect())
                  }
                  onMouseLeave={() => onOptionHover?.(spell, null)}
                >
                  <div className="font-semibold text-left">{spell.name}</div>
                  <div className="text-xs text-muted text-left">
                    Level {spell.level}
                  </div>
                  {disabled && !isActive && (
                    <div className="text-xs text-danger text-left">
                      Not available
                    </div>
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

const ensureChoice = (
  choices: Record<string, SpellcastingChoice>,
  classIndex: string,
): SpellcastingChoice => {
  if (choices[classIndex]) return choices[classIndex];
  return { cantrips: [], prepared: [] };
};

const SpellsStep: React.FC<SpellsStepProps> = ({ state, updateState }) => {
  const [spellsCache, setSpellsCache] = useState<Record<string, SpellReference[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const totalLevel = getTotalLevel(state.classSelections);
  const abilityScoresWithRace = applyRacialBonuses(
    state.abilityScores,
    state.selectedRace,
  );
  const finalAbilities = applyAbilityScoreImprovements(
    abilityScoresWithRace,
    state.advancements,
    totalLevel,
    {
      featsById: FEATS_BY_ID,
    },
  );
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

  // Fetch class spell lists once per casting class
  useEffect(() => {
    castingEntries.forEach((entry) => {
      const idx = entry.classRef.index;
      if (spellsCache[idx] || loading[idx]) return;
      setLoading((prev) => ({ ...prev, [idx]: true }));
      getClassSpells(idx)
        .then((res) => {
          const spells =
            res.results?.map((spell) => ({
              index: spell.index,
              name: spell.name,
              level: spell.level ?? 0,
            })) ?? [];
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
  const [spellDetail, setSpellDetail] = useState<Record<string, SRDSpell>>({});
  const [loadingDetail, setLoadingDetail] = useState<Record<string, boolean>>({});
  const [spellTooltip, setSpellTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    desc?: string;
  } | null>(null);

  const activeEntry = useMemo(() => {
    if (!castingEntries.length) return null;
    const target = castingEntries.find(
      (entry) => entry.classRef.index === activeClassIndex,
    );
    return target ?? castingEntries[0];
  }, [castingEntries, activeClassIndex]);

  // Keep a valid active class selected
  useEffect(() => {
    if (castingEntries.length === 0) {
      setActiveClassIndex(null);
    } else if (
      !activeClassIndex ||
      !castingEntries.find(
        (entry) => entry.classRef.index === activeClassIndex,
      )
    ) {
      setActiveClassIndex(castingEntries[0].classRef.index);
    }
  }, [castingEntries, activeClassIndex]);

  // Prefetch SRD spell descriptions for selected spells on the active class
  useEffect(() => {
    if (!activeEntry) return;
    const classIndex = activeEntry.classRef.index;
    const classSpells = spellsCache[classIndex] || [];
    if (!classSpells.length) return;

    const nameToIndex = new Map<string, string>();
    classSpells.forEach((s) => nameToIndex.set(s.name, s.index));

    const choice = ensureChoice(state.spellcastingChoices, classIndex);
    const names: string[] = [
      ...(choice.cantrips ?? []),
      ...((choice.known ?? []) as string[]),
      ...(choice.prepared ?? []),
    ];

    names.forEach((n) => {
      const idx = nameToIndex.get(n);
      if (!idx) return;
      if (spellDetail[idx] || loadingDetail[idx]) return;
      setLoadingDetail((prev) => ({ ...prev, [idx]: true }));
      getSpell(idx)
        .then((d) => {
          setSpellDetail((prev) => ({ ...prev, [idx]: d }));
        })
        .catch(() => {
          // ignore errors; description will simply be missing
        })
        .finally(() => {
          setLoadingDetail((prev) => ({ ...prev, [idx]: false }));
        });
    });
  }, [activeEntry, spellsCache, state.spellcastingChoices, spellDetail, loadingDetail]);

  // Clear any tooltip when the active class changes
  useEffect(() => {
    setSpellTooltip(null);
  }, [activeEntry]);

  const metaMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof getSpellcastingMeta> | null> = {};
    castingEntries.forEach((entry) => {
      map[entry.classRef.index] = getSpellcastingMeta(
        entry.classRef.index,
        entry.level,
        finalAbilities,
      );
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
    labelOverride?: string,
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
          const currentChoice = ensureChoice(
            state.spellcastingChoices,
            classIndex,
          );
          const updated: SpellcastingChoice = {
            ...currentChoice,
            cantrips:
              type === "cantrips" ? next : currentChoice.cantrips,
            prepared:
              type === "prepared" ? next : currentChoice.prepared,
            known: type === "known" ? next : currentChoice.known,
          };
          if (!updated.known) delete updated.known;
          updateChoice(classIndex, updated);
        }}
        onOptionHover={(spell, rect) => {
          if (!rect) {
            setSpellTooltip(null);
            return;
          }
          const detail = spellDetail[spell.index];
          const desc =
            detail?.desc?.length
              ? detail.desc.join("\n\n")
              : loadingDetail[spell.index]
              ? "Loading..."
              : undefined;

          if (!detail && !loadingDetail[spell.index]) {
            setLoadingDetail((prev) => ({ ...prev, [spell.index]: true }));
            getSpell(spell.index)
              .then((d) => {
                setSpellDetail((prev) => ({ ...prev, [spell.index]: d }));
              })
              .catch(() => {
                // ignore; tooltip will just not show description
              })
              .finally(() => {
                setLoadingDetail((prev) => ({ ...prev, [spell.index]: false }));
              });
          }

          if (!desc) return;

          setSpellTooltip({
            x: rect.right + 8,
            y: rect.top,
            name: spell.name,
            desc,
          });
        }}
      />
    );
  };

  const renderActiveClass = () => {
    if (!activeEntry) {
      return (
        <p className="text-muted">
          No spellcasting classes at your current levels.
        </p>
      );
    }
    const classIndex = activeEntry.classRef.index;
    const meta = metaMap[classIndex];
    if (!meta) {
      return (
        <p className="text-muted">
          This class does not gain spells at the current level.
        </p>
      );
    }
    const choice = ensureChoice(state.spellcastingChoices, classIndex);
    const classSpells = spellsCache[classIndex];
    const isLoading = loading[classIndex];
    if (!classSpells) {
      return (
        <p className="text-sm text-muted">
          {isLoading
            ? "Loading spells..."
            : "Spell list unavailable for this class."}
        </p>
      );
    }

    const highestSpellLevel = Math.max(
      1,
      Math.min(activeEntry.level, 9),
    );
    const cantripOptions = classSpells.filter(
      (spell) => (spell.level ?? 0) === 0,
    );
    const leveledOptions = classSpells.filter((spell) => {
      const lvl = spell.level ?? 0;
      return lvl > 0 && lvl <= highestSpellLevel;
    });

    const nameToIndex = new Map<string, string>();
    [...cantripOptions, ...leveledOptions].forEach((s) =>
      nameToIndex.set(s.name, s.index),
    );

    const knownOptions = leveledOptions;
    const preparedOptions = leveledOptions;
    const knownSet = new Set(choice.known ?? []);
    const abilityModifier = abilityMods[meta.ability];
    const saveDC = 8 + proficiencyBonus + abilityModifier;
    const attackBonus = proficiencyBonus + abilityModifier;

    return (
      <div className="space-y-4">
        {buildPicker(
          classIndex,
          "cantrips",
          meta.cantripsKnown,
          cantripOptions,
        )}
        {meta.mode !== "prepared" &&
          meta.knownCount &&
          buildPicker(
            classIndex,
            "known",
            meta.knownCount,
            knownOptions,
            undefined,
            meta.mode === "known" ? "Spells Known" : "Spellbook",
          )}
        {(meta.mode === "prepared" ||
          meta.mode === "known-prepared") &&
          buildPicker(
            classIndex,
            "prepared",
            meta.preparedCount,
            meta.mode === "known-prepared"
              ? preparedOptions.filter((spell) =>
                  knownSet.has(spell.name),
                )
              : preparedOptions,
            meta.mode === "known-prepared"
              ? (spell) => !knownSet.has(spell.name)
              : undefined,
          )}

        <div className="text-sm text-muted flex flex-wrap gap-4">
          <span>Spell Save DC: {saveDC}</span>
          <span>
            Spell Attack Bonus:{" "}
            {attackBonus >= 0 ? `+${attackBonus}` : attackBonus}
          </span>
        </div>

        {(choice.cantrips?.length ||
          choice.known?.length ||
          choice.prepared?.length) && (() => {
          const tiles: { name: string; kinds: string[] }[] = [];
          const tileMap = new Map<string, { name: string; kinds: string[] }>();

          const addTile = (name: string | undefined, kind: string) => {
            if (!name) return;
            const existing = tileMap.get(name);
            if (existing) {
              if (!existing.kinds.includes(kind)) {
                existing.kinds.push(kind);
              }
            } else {
              const tile = { name, kinds: [kind] };
              tileMap.set(name, tile);
              tiles.push(tile);
            }
          };

          (choice.cantrips ?? []).forEach((name) =>
            addTile(name, "Cantrip"),
          );
          if (meta.mode !== "prepared") {
            (choice.known ?? []).forEach((name) =>
              addTile(
                name,
                meta.mode === "known" ? "Known" : "Spellbook",
              ),
            );
          }
          if (meta.mode === "prepared" || meta.mode === "known-prepared") {
            (choice.prepared ?? []).forEach((name) =>
              addTile(name, "Prepared"),
            );
          }

          if (!tiles.length) return null;

          return (
            <div className="mt-2 flex flex-wrap gap-2">
              {tiles.map((tile) => {
                const idx = nameToIndex.get(tile.name || "");
                const d = idx ? spellDetail[idx] : undefined;
                return (
                  <div
                    key={tile.name}
                    className="choice-chip text-left cursor-default"
                    onMouseEnter={(e) => {
                      const rect =
                        e.currentTarget.getBoundingClientRect();
                      const desc =
                        d?.desc?.length
                          ? d.desc.join("\n\n")
                          : idx && loadingDetail[idx]
                          ? "Loading..."
                          : undefined;
                      if (!desc) return;
                      setSpellTooltip({
                        x: rect.right + 8,
                        y: rect.top,
                        name: tile.name,
                        desc,
                      });
                    }}
                    onMouseLeave={() => setSpellTooltip(null)}
                  >
                    <div className="font-semibold">{tile.name}</div>
                    {tile.kinds.length > 0 && (
                      <div className="text-xs text-muted">
                        {tile.kinds.join(" • ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    );
  };

  // Determine per-class completion status for visual indicators
  const isClassComplete = (entry: (typeof castingEntries)[number]): boolean => {
    if (!entry?.classRef) return true;
    const classIndex = entry.classRef.index;
    const meta = metaMap[classIndex];
    if (!meta) return true; // no spellcasting requirements at this level
    const choice = ensureChoice(state.spellcastingChoices, classIndex);
    const cantripsOk =
      (choice.cantrips?.length || 0) === (meta.cantripsKnown || 0);
    const knownOk =
      meta.mode !== "prepared"
        ? (choice.known?.length || 0) === (meta.knownCount || 0)
        : true;
    const preparedOk =
      meta.mode === "prepared" || meta.mode === "known-prepared"
        ? (choice.prepared?.length || 0) === (meta.preparedCount || 0)
        : true;
    return cantripsOk && knownOk && preparedOk;
  };

  const completedCount = castingEntries.filter((e) =>
    isClassComplete(e),
  ).length;

  return (
    <div className="builder-step">
      <div>
        <h2 className=" mb-1">Choose Your Spells</h2>
        <p className="text-muted mt-0">
          Select the cantrips and spells your spellcasting classes know or
          prepare at 1st level.
        </p>
        {castingEntries.length > 0 && (
          <p className="text-muted mt-0 text-sm">
            Classes complete: {completedCount}/{castingEntries.length}
          </p>
        )}
      </div>

      {castingEntries.length === 0 ? (
        <div className="frame pad-4 text-sm text-muted">
          No spellcasting options are available for your current class
          levels.
        </div>
      ) : (
        <div className="frame pad-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {castingEntries.map((entry) => (
              <button
                key={entry.classRef.index}
                type="button"
                className={`choice-chip ${
                  activeEntry?.classRef.index === entry.classRef.index
                    ? "is-active"
                    : ""
                }`}
                onClick={() =>
                  setActiveClassIndex(entry.classRef.index)
                }
              >
                {entry.classRef.name} {entry.level}
                <span
                  className={`ml-2 ${
                    isClassComplete(entry)
                      ? "text-success"
                      : "text-danger"
                  }`}
                  title={
                    isClassComplete(entry)
                      ? "All selections complete"
                      : "Selections incomplete"
                  }
                  aria-hidden="true"
                >
                  {isClassComplete(entry) ? "✓" : "•"}
                </span>
              </button>
            ))}
          </div>
          {renderActiveClass()}
        </div>
      )}

      {spellTooltip && (
        <div
          className="tooltip"
          style={{
            left: spellTooltip.x,
            top: spellTooltip.y,
          }}
        >
          <div className=" mb-1">{spellTooltip.name}</div>
          <div className="text-sm whitespace-pre-line">
            {spellTooltip.desc}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpellsStep;


