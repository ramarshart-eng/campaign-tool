/**
 * Step 6: Review and Complete Character
 *
 * This component is used twice by the builder:
 * - part="overview"  -> left review page (summary, abilities, personality)
 * - part="equipment" -> right review page (background/class/race, equipment, feats, spells)
 */

import React, { useEffect, useMemo, useState } from "react";
import type { CharacterBuilderState, ClassSelection } from "./CharacterBuilder";
import type { Character } from "@/lib/types/Character";
import { abilityMod } from "@/lib/rules/computeModifiers";
import {
  applyAbilityScoreImprovements,
  applyRacialBonuses,
  estimateHitPoints,
  getProficiencyBonus,
  getTotalLevel,
} from "@/lib/rules/derivedStats";
import { FEATS_BY_ID } from "@/lib/data/feats";
import { getSpellcastingMeta, type SpellcastingMode } from "@/lib/rules/spellcastingRules";
import { getClassSpells, getSpell } from "@/lib/api/srd";
import type { SRDSpell } from "@/lib/types/SRD";

interface ReviewStepProps {
  state: CharacterBuilderState;
  onComplete: (character: Character) => void;
  part?: "overview" | "equipment";
}

type SpellcastingSummaryEntry = {
  className: string;
  ability: keyof Character["abilities"];
  mode: SpellcastingMode;
  cantrips: string[];
  known?: string[];
  prepared: string[];
  saveDC: number;
  attackBonus: number;
};

const ReviewStep: React.FC<ReviewStepProps> = ({ state, onComplete, part }) => {
  const resolveClassSelections = (): ClassSelection[] => {
    if (state.classSelections && state.classSelections.length > 0) {
      return state.classSelections;
    }
    return [{ classRef: state.selectedClass ?? null, level: state.level || 1 }];
  };

  const formatClassSummary = (selections: ClassSelection[]) =>
    selections
      .filter((sel) => sel.classRef && sel.level > 0)
      .map((sel) => `${sel.classRef!.name} ${sel.level}`)
      .join(" / ");

  const collectSelectedFeats = (levelLimit: number) => {
    return Object.entries(state.advancements || {})
      .map(([lvl, choice]) => ({ level: Number(lvl), choice }))
      .filter(
        ({ level, choice }) =>
          level <= levelLimit && choice?.mode === "feat" && choice.featId
      )
      .map(({ choice }) =>
        choice?.featId ? FEATS_BY_ID[choice.featId] : undefined
      )
      .filter(Boolean);
  };

  const classSelections = resolveClassSelections();
  const primaryClass = classSelections.find((sel) => sel.classRef)?.classRef;

  if (!state.selectedRace || !primaryClass || !state.selectedBackground) {
    return <div>Missing required selections</div>;
  }

  // Display / preview stats (used on both pages)
  const displayTotalLevel = getTotalLevel(classSelections);
  const displayProficiencyBonus = getProficiencyBonus(displayTotalLevel);
  const displayClassSummary = formatClassSummary(classSelections);
  const baseWithRace = applyRacialBonuses(
    state.abilityScores,
    state.selectedRace
  );
  const finalAbilities = applyAbilityScoreImprovements(
    baseWithRace,
    state.advancements,
    displayTotalLevel,
    { featsById: FEATS_BY_ID }
  );
  const hpPreview = estimateHitPoints(
    classSelections,
    abilityMod(finalAbilities.CON)
  );
  const selectedFeatEntries = collectSelectedFeats(displayTotalLevel);
  const displayFeatNames = selectedFeatEntries
    .map((feat) => feat?.name)
    .filter(Boolean) as string[];

  const spellcastingReport: SpellcastingSummaryEntry[] = useMemo(
    () =>
      classSelections
        .map((entry) => {
          if (!entry.classRef) return null;
          const meta = getSpellcastingMeta(
            entry.classRef.index,
            entry.level,
            finalAbilities
          );
          if (!meta) return null;
          const choice = state.spellcastingChoices[entry.classRef.index];
          if (!choice) return null;
          const abilityScore = finalAbilities[meta.ability];
          const mod = abilityMod(abilityScore);
          const cantrips = choice.cantrips ?? [];
          const known =
            meta.mode !== "prepared" ? choice.known ?? [] : undefined;
          const prepared =
            meta.mode === "known" ? [] : choice.prepared ?? [];
          if (!cantrips.length && !(known && known.length) && !prepared.length) {
            return null;
          }
          return {
            className: entry.classRef.name,
            ability: meta.ability,
            mode: meta.mode,
            cantrips,
            known,
            prepared,
            saveDC: 8 + displayProficiencyBonus + mod,
            attackBonus: displayProficiencyBonus + mod,
          };
        })
        .filter(Boolean) as SpellcastingSummaryEntry[],
    [classSelections, finalAbilities, displayProficiencyBonus, state.spellcastingChoices]
  );

  const showOverview = !part || part === "overview";
  const isEquipmentPage = part === "equipment";

  const [activeSpellTab, setActiveSpellTab] = useState<string | null>(null);
  const [activeEquipmentTab, setActiveEquipmentTab] = useState<
    "equipment" | "feats"
  >("equipment");
  const [activeFeatureTab, setActiveFeatureTab] = useState<string | null>(null);
  const [spellsCache, setSpellsCache] = useState<
    Record<string, { index: string; name: string; level: number }[]>
  >({});
  const [loadingSpells, setLoadingSpells] = useState<Record<string, boolean>>(
    {}
  );
  const [spellDetail, setSpellDetail] = useState<Record<string, SRDSpell>>({});
  const [loadingDetail, setLoadingDetail] = useState<Record<string, boolean>>(
    {}
  );
  const [reviewTooltip, setReviewTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    body: string;
  } | null>(null);

  useEffect(() => {
    if (spellcastingReport.length === 0) {
      setActiveSpellTab(null);
      return;
    }
    if (
      !activeSpellTab ||
      !spellcastingReport.find((entry) => entry.className === activeSpellTab)
    ) {
      setActiveSpellTab(spellcastingReport[0]?.className ?? null);
    }
  }, [spellcastingReport, activeSpellTab]);

  const skillList = state.selectedBackground.skillProficiencies ?? [];

  const featureTabs = useMemo(() => {
    const tabs: Array<{ id: string; label: string; content: string }> = [];

    // Background (includes skills)
    if (state.selectedBackground) {
      const bg = state.selectedBackground;
      const bgParts: string[] = [
        `${bg.featureName}: ${bg.featureDescription}`,
      ];
      if (skillList.length) {
        bgParts.push(`Skills: ${skillList.join(", ")}`);
      }
      tabs.push({
        id: "background",
        label: "Background",
        content: bgParts.join(" • "),
      });
    }

    if (primaryClass) {
      const saves =
        primaryClass.saving_throws?.map((s) => s.name).join(", ") ?? "";
      const spellAbility =
        primaryClass.spellcasting?.spellcasting_ability?.name;
      const parts: string[] = [`Hit Die d${primaryClass.hit_die}`];
      if (saves) parts.push(`Saves: ${saves}`);
      if (spellAbility) parts.push(`Casting Ability: ${spellAbility}`);
      tabs.push({
        id: "class",
        label: primaryClass.name,
        content: parts.join(" • "),
      });
    }

    if (state.selectedRace) {
      const abilityBonuses =
        state.selectedRace.ability_bonuses
          ?.map(
            (bonus) => `${bonus.ability_score.name} +${bonus.bonus}`
          )
          .join(", ") ?? "";
      const languages =
        state.selectedRace.languages?.map((lang) => lang.name).join(", ") ??
        "";
      const raceParts: string[] = [];
      if (abilityBonuses) raceParts.push(`ASI: ${abilityBonuses}`);
      if (languages) raceParts.push(`Languages: ${languages}`);
      tabs.push({
        id: "race",
        label: state.selectedRace.name,
        content: raceParts.join(" • ") || state.selectedRace.name,
      });
    }

    return tabs;
  }, [state.selectedBackground, primaryClass, state.selectedRace, skillList]);

  useEffect(() => {
    if (!featureTabs.length) {
      setActiveFeatureTab(null);
      return;
    }
    if (
      !activeFeatureTab ||
      !featureTabs.find((tab) => tab.id === activeFeatureTab)
    ) {
      setActiveFeatureTab(featureTabs[0].id);
    }
  }, [featureTabs, activeFeatureTab]);

  // Fetch class spell lists for classes that appear in the spellcasting report
  useEffect(() => {
    spellcastingReport.forEach((entry) => {
      const classIndex = classSelections.find(
        (sel) => sel.classRef && sel.classRef.name === entry.className
      )?.classRef?.index;
      if (!classIndex) return;
      if (spellsCache[classIndex] || loadingSpells[classIndex]) return;

      setLoadingSpells((prev) => ({ ...prev, [classIndex]: true }));
      getClassSpells(classIndex)
        .then((res) => {
          const spells =
            res.results?.map((spell) => ({
              index: spell.index,
              name: spell.name,
              level: spell.level ?? 0,
            })) ?? [];
          setSpellsCache((prev) => ({ ...prev, [classIndex]: spells }));
        })
        .catch(() => {
          setSpellsCache((prev) => ({ ...prev, [classIndex]: [] }));
        })
        .finally(() => {
          setLoadingSpells((prev) => ({ ...prev, [classIndex]: false }));
        });
    });
  }, [spellcastingReport, classSelections, spellsCache, loadingSpells]);

  // Prefetch SRD spell descriptions for spells shown in the report
  useEffect(() => {
    spellcastingReport.forEach((entry) => {
      const classIndex = classSelections.find(
        (sel) => sel.classRef && sel.classRef.name === entry.className
      )?.classRef?.index;
      if (!classIndex) return;
      const classSpells = spellsCache[classIndex] || [];
      if (!classSpells.length) return;

      const nameToIndex = new Map<string, string>();
      classSpells.forEach((s) => nameToIndex.set(s.name, s.index));

      const names: string[] = [
        ...entry.cantrips,
        ...(entry.known ?? []),
        ...entry.prepared,
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
            // ignore errors; tooltip will simply have no description
          })
          .finally(() => {
            setLoadingDetail((prev) => ({ ...prev, [idx]: false }));
          });
      });
    });
  }, [spellcastingReport, classSelections, spellsCache, spellDetail, loadingDetail]);

  // Equipment (with fallback when the Equipment step is omitted)
  const STARTING_ITEMS_BY_CLASS: Record<string, string[]> = {
    barbarian: ["Greataxe", "Javelin (4)", "Explorer's Pack"],
    bard: ["Rapier", "Lute", "Leather Armor", "Dagger"],
    cleric: ["Mace", "Shield", "Scale Mail", "Holy Symbol"],
    druid: ["Quarterstaff", "Leather Armor", "Druidic Focus", "Explorer's Pack"],
    fighter: ["Longsword", "Shield", "Chain Mail", "Handaxe (2)"],
    monk: ["Shortsword", "Darts (10)", "Explorer's Pack"],
    paladin: ["Longsword", "Shield", "Chain Mail", "Holy Symbol"],
    ranger: ["Longbow", "Arrows (20)", "Shortsword (2)", "Leather Armor"],
    rogue: [
      "Rapier",
      "Shortbow",
      "Arrows (20)",
      "Leather Armor",
      "Thieves' Tools",
    ],
    sorcerer: ["Dagger (2)", "Arcane Focus", "Explorer's Pack"],
    warlock: ["Dagger (2)", "Arcane Focus", "Leather Armor", "Scholar's Pack"],
    wizard: ["Quarterstaff", "Spellbook", "Arcane Focus", "Scholar's Pack"],
  };

  const COMMON_ITEMS_STRINGS: string[] = [
    "Backpack",
    "Bedroll",
    "Hempen Rope (50 ft)",
    "Rations (10 days)",
    "Waterskin",
    "Torch (10)",
    "Tinderbox",
    "Potion of Healing (2)",
  ];

  let equipmentItems = (state.inventory ?? []).map((item) =>
    item.description ? `${item.name} - ${item.description}` : item.name
  );

  if (equipmentItems.length === 0) {
    const classKey = primaryClass.index ?? state.selectedClass?.index ?? "";
    equipmentItems = [
      ...(classKey && STARTING_ITEMS_BY_CLASS[classKey]
        ? STARTING_ITEMS_BY_CLASS[classKey]
        : []),
      ...COMMON_ITEMS_STRINGS,
    ];
  }

  const hasPersonality = Boolean(
    state.personalityTraits || state.ideals || state.bonds || state.flaws
  );

  const handleComplete = () => {
    const selections = resolveClassSelections();
    const firstClass = selections.find((sel) => sel.classRef)?.classRef;
    if (!state.selectedRace || !firstClass || !state.selectedBackground) {
      return;
    }

    const totalLevel = getTotalLevel(selections);
    const base = applyRacialBonuses(state.abilityScores, state.selectedRace);
    const abilities = applyAbilityScoreImprovements(
      base,
      state.advancements,
      totalLevel,
      { featsById: FEATS_BY_ID }
    );

    const proficiencyBonus = getProficiencyBonus(totalLevel);
    const conMod = abilityMod(abilities.CON);
    const hpEstimate = estimateHitPoints(selections, conMod);
    const maxHp = Math.max(1, hpEstimate.total);

    const dexMod = abilityMod(abilities.DEX);
    const armorClass = 10 + dexMod;

    // Skills from background
    const skills: Character["skills"] = {};
    state.selectedBackground.skillProficiencies.forEach((skillName) => {
      const skillAbilityMap: Record<string, keyof Character["abilities"]> = {
        Acrobatics: "DEX",
        "Animal Handling": "WIS",
        Arcana: "INT",
        Athletics: "STR",
        Deception: "CHA",
        History: "INT",
        Insight: "WIS",
        Intimidation: "CHA",
        Investigation: "INT",
        Medicine: "WIS",
        Nature: "INT",
        Perception: "WIS",
        Performance: "CHA",
        Persuasion: "CHA",
        Religion: "INT",
        "Sleight of Hand": "DEX",
        Stealth: "DEX",
        Survival: "WIS",
      };
      skills[skillName] = {
        ability: skillAbilityMap[skillName] || "STR",
        proficient: true,
      };
    });

    // Saving throws from class
    const savingThrows: Character["savingThrows"] = {
      STR: { proficient: false },
      DEX: { proficient: false },
      CON: { proficient: false },
      INT: { proficient: false },
      WIS: { proficient: false },
      CHA: { proficient: false },
    };
    firstClass.saving_throws.forEach((save) => {
      const key = save.index.toUpperCase() as keyof typeof savingThrows;
      if (key in savingThrows) {
        savingThrows[key].proficient = true;
      }
    });

    const bg = state.selectedBackground;
    const derivedFeatures: string[] = [
      `${bg.featureName}: ${bg.featureDescription}`,
    ];
    if (bg.toolProficiencies && bg.toolProficiencies.length > 0) {
      derivedFeatures.push(
        `Tool Proficiencies: ${bg.toolProficiencies.join(", ")}`
      );
    }
    if (bg.languages && bg.languages > 0) {
      derivedFeatures.push(`Additional Languages: ${bg.languages}`);
    }

    const selectedFeats = collectSelectedFeats(totalLevel);
    const featNames = selectedFeats
      .map((feat) => feat?.name)
      .filter(Boolean) as string[];
    if (featNames.length) {
      featNames.forEach((name) => derivedFeatures.push(`Feat: ${name}`));
    }

    const spellcastingClasses: SpellcastingSummaryEntry[] = selections
      .map((entry) => {
        if (!entry.classRef) return null;
        const meta = getSpellcastingMeta(
          entry.classRef.index,
          entry.level,
          abilities
        );
        if (!meta) return null;
        const choice = state.spellcastingChoices[entry.classRef.index];
        if (!choice) return null;
        const abilityScore = abilities[meta.ability];
        const mod = abilityMod(abilityScore);
        const cantrips = choice.cantrips ?? [];
        const known =
          meta.mode !== "prepared" ? choice.known ?? [] : undefined;
        const prepared =
          meta.mode === "known" ? [] : choice.prepared ?? [];
        if (!cantrips.length && !(known && known.length) && !prepared.length) {
          return null;
        }
        return {
          className: entry.classRef.name,
          ability: meta.ability,
          mode: meta.mode,
          cantrips,
          known,
          prepared,
          saveDC: 8 + proficiencyBonus + mod,
          attackBonus: proficiencyBonus + mod,
        };
      })
      .filter(Boolean) as SpellcastingSummaryEntry[];

    const classSummary = formatClassSummary(selections);

    const character: Character = {
      id: `char-${Date.now()}`,
      name: state.name,
      className: classSummary || firstClass.name,
      classBreakdown: selections
        .filter((sel) => sel.classRef)
        .map((sel) => ({
          name: sel.classRef!.name,
          level: sel.level,
        })),
      raceName: state.selectedRace.name,
      level: totalLevel,
      proficiencyBonus,
      maxHp,
      currentHp: maxHp,
      armorClass,
      abilities,
      skills,
      savingThrows,
      actions: [],
      inventory: state.inventory,
      background: bg.name,
      features: derivedFeatures,
      feats: featNames,
      spellcasting: spellcastingClasses.length
        ? { classes: spellcastingClasses }
        : undefined,
      personalityTraits: state.personalityTraits,
      ideals: state.ideals,
      bonds: state.bonds,
      flaws: state.flaws,
    };

    onComplete(character);
  };

  return (
    <div className="builder-step">
      {!isEquipmentPage && (
        <div>
          <h2 className="mb-2">Review Your Character</h2>
          <p className="text-muted">
            Review your character’s details before completing creation.
          </p>
        </div>
      )}

      <div className="frame pad-6 space-y-4">
        {showOverview && (
          <div>
            <h3 className="">{state.name || "Unnamed Character"}</h3>
            <p className="text-muted">
              Level {displayTotalLevel} {state.selectedRace.name}{" "}
              {displayClassSummary || primaryClass.name}
            </p>
            <p className="mt-1 text-sm text-muted">
              HP Estimate:{" "}
              {hpPreview.total > 0 ? `${hpPreview.total} HP` : "–"}
            </p>
          </div>
        )}

        {showOverview && (
          <div>
            <h4 className="mb-2">Ability Scores</h4>
            <div className="grid grid-cols-6 gap-2">
              {(Object.entries(finalAbilities) as Array<
                [keyof typeof finalAbilities, number]
              >).map(([abilityKey, score]) => (
                <div
                  key={abilityKey}
                  className="border border-black p-2 text-center"
                >
                  <div className="font-semibold">{abilityKey}</div>
                  <div className="text-lg">{score}</div>
                  <div className="text-sm text-muted">
                    {abilityMod(score) >= 0
                      ? `+${abilityMod(score)}`
                      : abilityMod(score)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showOverview && (
          <div className="flex flex-col gap-3">
            {hasPersonality && (
              <div>
                <h4 className="mb-2">Personality</h4>
                <div className="border border-black p-3 space-y-1 text-sm">
                  {state.personalityTraits && (
                    <div className="clamp-2" title={state.personalityTraits}>
                      <span className="text-subtle">Traits:</span>{" "}
                      {state.personalityTraits}
                    </div>
                  )}
                  {state.ideals && (
                    <div className="clamp-2" title={state.ideals}>
                      <span className="text-subtle">Ideals:</span>{" "}
                      {state.ideals}
                    </div>
                  )}
                  {state.bonds && (
                    <div className="clamp-2" title={state.bonds}>
                      <span className="text-subtle">Bonds:</span> {state.bonds}
                    </div>
                  )}
                  {state.flaws && (
                    <div className="clamp-2" title={state.flaws}>
                      <span className="text-subtle">Flaws:</span> {state.flaws}
                    </div>
                  )}
                </div>
              </div>
            )}

            {featureTabs.length > 0 && (
              <div>
                <h4 className="mb-2">Background & Origin</h4>
                <div className="border border-black p-3 text-sm space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {featureTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`choice-chip ${
                          activeFeatureTab === tab.id ? "is-active" : ""
                        }`}
                        onClick={() => setActiveFeatureTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const current =
                      featureTabs.find(
                        (tab) => tab.id === activeFeatureTab
                      ) || featureTabs[0];
                    if (!current) return null;
                    return (
                      <div className="clamp-2" title={current.content}>
                        {current.content}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right-page content: equipment/feats, spells */}
        {isEquipmentPage &&
          (equipmentItems.length > 0 ||
            displayFeatNames.length > 0 ||
            spellcastingReport.length > 0) && (
            <div className="flex flex-col gap-3">
              {/* Equipment / Feats (equipment page only) */}
              {isEquipmentPage && (
                <div className="border border-black p-3 text-sm space-y-2 flex flex-col">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`choice-chip ${
                        activeEquipmentTab === "equipment"
                          ? "is-active"
                          : ""
                      }`}
                      onClick={() => setActiveEquipmentTab("equipment")}
                    >
                      Equipment
                    </button>
                    <button
                      type="button"
                      className={`choice-chip ${
                        activeEquipmentTab === "feats" ? "is-active" : ""
                      }`}
                      onClick={() => setActiveEquipmentTab("feats")}
                    >
                      Feats
                    </button>
                  </div>
                  {activeEquipmentTab === "equipment" ? (
                    equipmentItems.length ? (
                      <div className="flex-1 overflow-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                          {equipmentItems.map((item, idx) => (
                            <div
                              key={`${item}-${idx}`}
                              className="clamp-2 cursor-default"
                              onMouseEnter={(e) => {
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                setReviewTooltip({
                                  x: rect.right + 8,
                                  y: rect.top,
                                  title: "Equipment",
                                  body: item,
                                });
                              }}
                              onMouseLeave={() => setReviewTooltip(null)}
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted flex-1">No items</div>
                    )
                  ) : displayFeatNames.length ? (
                    <div className="flex-1 overflow-auto">
                      <ul className="list-disc list-inside space-y-1">
                        {displayFeatNames.map((name) => (
                          <li
                            key={name}
                            className="clamp-2 cursor-default"
                            onMouseEnter={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setReviewTooltip({
                                x: rect.right + 8,
                                y: rect.top,
                                title: "Feat",
                                body: name,
                              });
                            }}
                            onMouseLeave={() => setReviewTooltip(null)}
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-muted flex-1">
                      No feats selected
                    </div>
                  )}
                </div>
              )}

              {/* Spells summary */}
              <div className="border border-black p-3 text-sm space-y-2 flex flex-col">
                <div className="flex flex-wrap gap-2">
                  {spellcastingReport.length > 0 ? (
                    spellcastingReport.map((entry) => (
                      <button
                        key={entry.className}
                        type="button"
                        className={`choice-chip ${
                          activeSpellTab === entry.className ? "is-active" : ""
                        }`}
                        onClick={() => setActiveSpellTab(entry.className)}
                      >
                        {entry.className}
                      </button>
                    ))
                  ) : (
                    <span className="text-muted">
                      No spellcasting selections
                    </span>
                  )}
                </div>
                {spellcastingReport.length > 0 ? (
                  (() => {
                    const current =
                      spellcastingReport.find(
                        (entry) => entry.className === activeSpellTab
                      ) || spellcastingReport[0];
                    if (!current) {
                      return (
                        <div className="text-muted flex-1">
                          No spells selected.
                        </div>
                      );
                    }

                    const tiles: { name: string; kinds: string[] }[] = [];
                    const tileMap = new Map<
                      string,
                      { name: string; kinds: string[] }
                    >();
                    const addTile = (name: string, kind: string) => {
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

                    current.cantrips.forEach((n) => addTile(n, "Cantrip"));
                    (current.known ?? []).forEach((n) =>
                      addTile(
                        n,
                        current.mode === "known" ? "Known" : "Spellbook"
                      )
                    );
                    current.prepared.forEach((n) => addTile(n, "Prepared"));

                    const classIndex = classSelections.find(
                      (sel) => sel.classRef && sel.classRef.name === current.className
                    )?.classRef?.index;
                    const classSpells = classIndex ? spellsCache[classIndex] || [] : [];
                    const nameToIndex = new Map<string, string>();
                    classSpells.forEach((s) => nameToIndex.set(s.name, s.index));

                    return (
                      <div className="space-y-2 flex-1 overflow-auto">
                        <div className="text-muted">
                          Save DC {current.saveDC} / Attack Bonus{" "}
                          {current.attackBonus >= 0
                            ? `+${current.attackBonus}`
                            : current.attackBonus}
                        </div>
                        {tiles.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {tiles.map((tile) => (
                              <button
                                key={tile.name}
                                type="button"
                                className="choice-chip text-left cursor-default"
                                onMouseEnter={(e) => {
                                  const rect =
                                    e.currentTarget.getBoundingClientRect();
                                  const idx = nameToIndex.get(tile.name);
                                  const detail = idx ? spellDetail[idx] : undefined;
                                  const desc =
                                    detail?.desc?.length
                                      ? detail.desc.join("\n\n")
                                      : idx && loadingDetail[idx]
                                      ? "Loading..."
                                      : tile.kinds.join(" / ");
                                  setReviewTooltip({
                                    x: rect.right + 8,
                                    y: rect.top,
                                    title: tile.name,
                                    body: desc,
                                  });
                                }}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                <div className="font-semibold">
                                  {tile.name}
                                </div>
                                {tile.kinds.length > 0 && (
                                  <div className="text-xs text-muted">
                                    {tile.kinds.join(" / ")}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted flex-1">
                            No spells selected.
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-muted flex-1">No spells selected.</div>
                )}
              </div>
            </div>
          )}

        {isEquipmentPage && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              className="btn-frame"
              onClick={handleComplete}
            >
              Complete Character
            </button>
          </div>
        )}
      </div>

      {reviewTooltip && (
        <div
          className="tooltip"
          style={{
            left: reviewTooltip.x,
            top: reviewTooltip.y,
          }}
        >
          <div className="mb-1 font-semibold">{reviewTooltip.title}</div>
          <div className="text-sm whitespace-pre-line">
            {reviewTooltip.body}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewStep;
