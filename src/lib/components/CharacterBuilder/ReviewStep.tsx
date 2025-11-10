/**
 * Step 6: Review and Complete Character
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

interface ReviewStepProps {
  state: CharacterBuilderState;
  onComplete: (character: Character) => void;
  onPrevious: () => void;
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

const ReviewStep: React.FC<ReviewStepProps> = ({
  state,
  onComplete,
  onPrevious,
}) => {
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
      .filter(({ level, choice }) => level <= levelLimit && choice?.mode === "feat" && choice.featId)
      .map(({ choice }) => (choice?.featId ? FEATS_BY_ID[choice.featId] : undefined))
      .filter(Boolean);
  };

  const handleComplete = () => {
    const classSelections = resolveClassSelections();
    const primaryClass = classSelections.find((sel) => sel.classRef)?.classRef;
    if (!state.selectedRace || !primaryClass || !state.selectedBackground) {
      return;
    }

    const totalLevel = getTotalLevel(classSelections);
    const baseWithRace = applyRacialBonuses(state.abilityScores, state.selectedRace);
    const finalAbilities = applyAbilityScoreImprovements(baseWithRace, state.advancements, totalLevel, {
      featsById: FEATS_BY_ID,
    });

    const proficiencyBonus = getProficiencyBonus(totalLevel);
    const conMod = abilityMod(finalAbilities.CON);
    const hpEstimate = estimateHitPoints(classSelections, conMod);
    const maxHp = Math.max(1, hpEstimate.total);

    // Calculate AC (base 10 + DEX modifier)
    const dexMod = abilityMod(finalAbilities.DEX);
    const armorClass = 10 + dexMod;

    // Build skills object from background
    const skills: Character["skills"] = {};
    state.selectedBackground.skillProficiencies.forEach((skillName) => {
      // Map skill name to ability
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

    // Build saving throws with class proficiencies
    const savingThrows: Character["savingThrows"] = {
      STR: { proficient: false },
      DEX: { proficient: false },
      CON: { proficient: false },
      INT: { proficient: false },
      WIS: { proficient: false },
      CHA: { proficient: false },
    };
    primaryClass.saving_throws.forEach((save) => {
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
      derivedFeatures.push(`Tool Proficiencies: ${bg.toolProficiencies.join(", ")}`);
    }
    if (bg.languages && bg.languages > 0) {
      derivedFeatures.push(`Additional Languages: ${bg.languages}`);
    }
    const selectedFeats = collectSelectedFeats(totalLevel);
    const featNames = selectedFeats.map((feat) => feat.name);
    if (featNames.length) {
      featNames.forEach((name) => derivedFeatures.push(`Feat: ${name}`));
    }
    const spellcastingClasses: SpellcastingSummaryEntry[] = classSelections
      .map((entry) => {
        if (!entry.classRef) return null;
        const meta = getSpellcastingMeta(entry.classRef.index, entry.level, finalAbilities);
        if (!meta) return null;
        const choice = state.spellcastingChoices[entry.classRef.index];
        if (!choice) return null;
        const abilityScore = finalAbilities[meta.ability];
        const mod = abilityMod(abilityScore);
        const cantrips = choice.cantrips ?? [];
        const known = meta.mode !== "prepared" ? choice.known ?? [] : undefined;
        const prepared = meta.mode === "known" ? [] : choice.prepared ?? [];
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

    const classSummary = formatClassSummary(classSelections);

    const character: Character = {
      id: `char-${Date.now()}`,
      name: state.name,
      className: classSummary || primaryClass.name,
      classBreakdown: classSelections
        .filter((sel) => sel.classRef)
        .map((sel) => ({ name: sel.classRef!.name, level: sel.level })),
      raceName: state.selectedRace.name,
      level: totalLevel,
      proficiencyBonus,
      maxHp,
      currentHp: maxHp,
      armorClass,
      abilities: finalAbilities,
      skills,
      savingThrows,
      actions: [],
      inventory: state.inventory,
      // Narrative fields prefilled from builder selections (editable later)
      background: bg.name,
      features: derivedFeatures,
      feats: featNames,
      spellcasting: spellcastingClasses.length ? { classes: spellcastingClasses } : undefined,
      personalityTraits: state.personalityTraits,
      ideals: state.ideals,
      bonds: state.bonds,
      flaws: state.flaws,
    };

    onComplete(character);
  };

  const classSelections = resolveClassSelections();
  const primaryClass = classSelections.find((sel) => sel.classRef)?.classRef;
  if (!state.selectedRace || !primaryClass || !state.selectedBackground) {
    return <div>Missing required selections</div>;
  }

  const displayTotalLevel = getTotalLevel(classSelections);
  const displayProficiencyBonus = getProficiencyBonus(displayTotalLevel);
  const displayClassSummary = formatClassSummary(classSelections);
  const baseWithRace = applyRacialBonuses(state.abilityScores, state.selectedRace);
  const finalAbilities = applyAbilityScoreImprovements(baseWithRace, state.advancements, displayTotalLevel, {
    featsById: FEATS_BY_ID,
  });
  const hpPreview = estimateHitPoints(classSelections, abilityMod(finalAbilities.CON));
  const selectedFeatEntries = collectSelectedFeats(displayTotalLevel);
  const displayFeatNames = selectedFeatEntries.map((feat) => feat?.name).filter(Boolean) as string[];
  const spellcastingReport: SpellcastingSummaryEntry[] = useMemo(
    () =>
      classSelections
        .map((entry) => {
          if (!entry.classRef) return null;
          const meta = getSpellcastingMeta(entry.classRef.index, entry.level, finalAbilities);
          if (!meta) return null;
          const choice = state.spellcastingChoices[entry.classRef.index];
          if (!choice) return null;
          const abilityScore = finalAbilities[meta.ability];
          const mod = abilityMod(abilityScore);
          const cantrips = choice.cantrips ?? [];
          const known = meta.mode !== "prepared" ? choice.known ?? [] : undefined;
          const prepared = meta.mode === "known" ? [] : choice.prepared ?? [];
          if (!cantrips.length && !(known && known.length) && !prepared.length) return null;
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

  const [activeSpellTab, setActiveSpellTab] = useState<string | null>(null);
  const [activeSkillsTab, setActiveSkillsTab] = useState<"skills" | "saves">("skills");
  const [activeEquipmentTab, setActiveEquipmentTab] = useState<"equipment" | "feats">("equipment");
  const [activeFeatureTab, setActiveFeatureTab] = useState<string | null>(null);

  useEffect(() => {
    if (spellcastingReport.length === 0) {
      setActiveSpellTab(null);
      return;
    }
    if (!activeSpellTab || !spellcastingReport.find((entry) => entry.className === activeSpellTab)) {
      setActiveSpellTab(spellcastingReport[0]?.className ?? null);
    }
  }, [spellcastingReport, activeSpellTab]);

  const featureTabs = useMemo(() => {
    const tabs: Array<{ id: string; label: string; content: string }> = [];
    if (state.selectedBackground) {
      tabs.push({
        id: "background",
        label: "Background",
        content: `${state.selectedBackground.featureName}: ${state.selectedBackground.featureDescription}`,
      });
    }
    if (primaryClass) {
      const saves = primaryClass.saving_throws?.map((s) => s.name).join(", ") ?? "";
      const spellAbility = primaryClass.spellcasting?.spellcasting_ability?.name;
      const parts = [`Hit Die d${primaryClass.hit_die}`];
      if (saves) parts.push(`Saves: ${saves}`);
      if (spellAbility) parts.push(`Casting Ability: ${spellAbility}`);
      tabs.push({
        id: "class",
        label: primaryClass.name,
        content: parts.join(" · "),
      });
    }
    if (state.selectedRace) {
      const abilityBonuses = state.selectedRace.ability_bonuses
        ?.map((bonus) => `${bonus.ability_score.name} +${bonus.bonus}`)
        .join(", ");
      const languages = state.selectedRace.languages?.map((lang) => lang.name).join(", ") ?? "";
      const raceParts: string[] = [];
      if (abilityBonuses) raceParts.push(`ASI: ${abilityBonuses}`);
      if (languages) raceParts.push(`Languages: ${languages}`);
      tabs.push({
        id: "race",
        label: state.selectedRace.name,
        content: raceParts.join(" · ") || state.selectedRace.name,
      });
    }
    return tabs;
  }, [state.selectedBackground, primaryClass, state.selectedRace]);

  useEffect(() => {
    if (!featureTabs.length) {
      setActiveFeatureTab(null);
      return;
    }
    if (!activeFeatureTab || !featureTabs.find((tab) => tab.id === activeFeatureTab)) {
      setActiveFeatureTab(featureTabs[0].id);
    }
  }, [featureTabs, activeFeatureTab]);

  const skillList = state.selectedBackground?.skillProficiencies ?? [];
  const savingThrowList = primaryClass?.saving_throws?.map((save) => save.name) ?? [];
  const equipmentItems = (state.inventory ?? []).map((item) =>
    item.description ? `${item.name} - ${item.description}` : item.name
  );
  const hasPersonality = Boolean(
    state.personalityTraits || state.ideals || state.bonds || state.flaws
  );

  return (
    <div className="builder-step">
      <div>
        <h2 className=" mb-2">Review Your Character</h2>
        <p className="text-muted">
          Review your character's details before completing creation.
        </p>
      </div>

      <div className="frame pad-6 space-y-4">
        <div>
          <h3 className="">{state.name}</h3>
          <p className=" text-muted">Level {displayTotalLevel} {state.selectedRace.name} {displayClassSummary || primaryClass.name}</p>
          <p className=" mt-1">
            <span className="text-subtle">Race:</span> {state.selectedRace.name}
            <span className="mx-2">•</span>
            <span className="text-subtle">Classes:</span> {displayClassSummary || primaryClass.name}
            <span className="mx-2">•</span>
            <span className="text-subtle">Background:</span> {state.selectedBackground.name}
            <span className="mx-2">•</span>
            <span className="text-subtle">HP Estimate:</span> {hpPreview.total > 0 ? `${hpPreview.total} HP` : "-"}
          </p>
        </div>

        <div>
          <h4 className=" mb-2">Ability Scores</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(Object.entries(finalAbilities) as Array<[keyof typeof finalAbilities, number]>).map(
              ([ability, score]) => (
                <div key={ability}>
                  <span className="text-subtle">{ability}</span> {score} (
                  {abilityMod(score) >= 0 ? "+" : ""}
                  {abilityMod(score)})
                </div>
              )
            )}
          </div>
        </div>

        {(skillList.length > 0 || savingThrowList.length > 0) && (
          <div>
            <h4 className=" mb-2">Skills & Saves</h4>
            <div className="border border-black p-3 text-sm space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`choice-chip ${activeSkillsTab === "skills" ? "is-active" : ""}`}
                  onClick={() => setActiveSkillsTab("skills")}
                >
                  Skills
                </button>
                <button
                  type="button"
                  className={`choice-chip ${activeSkillsTab === "saves" ? "is-active" : ""}`}
                  onClick={() => setActiveSkillsTab("saves")}
                >
                  Saving Throws
                </button>
              </div>
              {activeSkillsTab === "skills" ? (
                <div className="clamp-2" title={skillList.join(", ")}>
                  {skillList.length ? skillList.join(", ") : "No proficiencies"}
                </div>
              ) : (
                <div className="clamp-2" title={savingThrowList.join(", ")}>
                  {savingThrowList.length ? savingThrowList.join(", ") : "No saving throw proficiencies"}
                </div>
              )}
            </div>
          </div>
        )}

        {(equipmentItems.length > 0 || displayFeatNames.length > 0 || spellcastingReport.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-black p-3 text-sm space-y-2 flex flex-col max-h-52">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`choice-chip ${activeEquipmentTab === "equipment" ? "is-active" : ""}`}
                  onClick={() => setActiveEquipmentTab("equipment")}
                >
                  Equipment
                </button>
                <button
                  type="button"
                  className={`choice-chip ${activeEquipmentTab === "feats" ? "is-active" : ""}`}
                  onClick={() => setActiveEquipmentTab("feats")}
                >
                  Feats
                </button>
              </div>
              {activeEquipmentTab === "equipment" ? (
                equipmentItems.length ? (
                  <>
                    <p className="text-muted text-xs">Includes class starting equipment and standard adventuring gear.</p>
                    <div className="flex-1 overflow-auto">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {equipmentItems.map((item, idx) => (
                          <div key={`${item}-${idx}`} className="clamp-2" title={item}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-muted flex-1">No items</div>
                )
              ) : displayFeatNames.length ? (
                <div className="flex-1 overflow-auto">
                  <ul className="list-disc list-inside space-y-1">
                    {displayFeatNames.map((name) => (
                      <li key={name} className="clamp-2" title={name}>
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-muted flex-1">No feats selected</div>
              )}
            </div>
            <div className="border border-black p-3 text-sm space-y-2 flex flex-col max-h-52">
              <div className="flex flex-wrap gap-2">
                {spellcastingReport.length > 0 ? (
                  spellcastingReport.map((entry) => (
                    <button
                      key={entry.className}
                      type="button"
                      className={`choice-chip ${activeSpellTab === entry.className ? "is-active" : ""}`}
                      onClick={() => setActiveSpellTab(entry.className)}
                    >
                      {entry.className}
                    </button>
                  ))
                ) : (
                  <span className="text-muted">No spellcasting classes.</span>
                )}
              </div>
              {spellcastingReport.length > 0 ? (
                (() => {
                  const current =
                    spellcastingReport.find((entry) => entry.className === activeSpellTab) ||
                    spellcastingReport[0];
                  if (!current) return <div className="text-muted flex-1">No spells selected.</div>;
                  return (
                    <div className="space-y-1 flex-1 overflow-auto">
                      <div className="text-muted">
                        Save DC {current.saveDC} · Attack Bonus {current.attackBonus >= 0 ? `+${current.attackBonus}` : current.attackBonus}
                      </div>
                      {current.cantrips.length > 0 && (
                        <div className="clamp-2" title={current.cantrips.join(", ")}>
                          <span className="text-subtle">Cantrips:</span> {current.cantrips.join(", ")}
                        </div>
                      )}
                      {current.known && current.known.length > 0 && (
                        <div className="clamp-2" title={current.known.join(", ")}>
                          <span className="text-subtle">{current.mode === "known" ? "Known Spells" : "Spellbook"}:</span> {current.known.join(", ")}
                        </div>
                      )}
                      {current.prepared.length > 0 && (
                        <div className="clamp-2" title={current.prepared.join(", ")}>
                          <span className="text-subtle">Prepared:</span> {current.prepared.join(", ")}
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

        {(hasPersonality || featureTabs.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {hasPersonality && (
              <div className="border border-black p-3 space-y-1 text-sm">
                <div className="font-semibold">Personality</div>
                {state.personalityTraits && (
                  <div className="clamp-2" title={state.personalityTraits}>
                    <span className="text-subtle">Traits:</span> {state.personalityTraits}
                  </div>
                )}
                {state.ideals && (
                  <div className="clamp-2" title={state.ideals}>
                    <span className="text-subtle">Ideals:</span> {state.ideals}
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
            )}
            {featureTabs.length > 0 && (
              <div className="border border-black p-3 text-sm space-y-2">
                <div className="flex flex-wrap gap-2">
                  {featureTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`choice-chip ${activeFeatureTab === tab.id ? "is-active" : ""}`}
                      onClick={() => setActiveFeatureTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {(() => {
                  const current = featureTabs.find((tab) => tab.id === activeFeatureTab) || featureTabs[0];
                  if (!current) return null;
                  return (
                    <div className="clamp-2" title={current.content}>
                      {current.content}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}


      </div>

      <div className="builder-footer">
        <button
          type="button"
          onClick={onPrevious}
          className="btn-frame btn-frame--lg"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={handleComplete}
          className="btn-primary"
        >
          Create Character
        </button>
      </div>
    </div>
  );
};

export default ReviewStep;
