/**
 * Step: Personality (Traits, Ideals, Bonds, Flaws)
 */

import React, { useEffect, useMemo, useState } from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";
import { getBackground } from "@/lib/api/srd";
import type { SRDBackground } from "@/lib/types/SRD";

interface PersonalityStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const PersonalityStep: React.FC<PersonalityStepProps> = ({
  state,
  updateState,
  onNext,
  onPrevious,
}) => {
  const [traits, setTraits] = useState(state.personalityTraits || "");
  const [ideals, setIdeals] = useState(state.ideals || "");
  const [bonds, setBonds] = useState(state.bonds || "");
  const [flaws, setFlaws] = useState(state.flaws || "");

  // SRD suggestions for the selected background
  const [srdBackground, setSrdBackground] = useState<SRDBackground | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const index = state.selectedBackground?.index;
    if (!index) {
      setSrdBackground(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getBackground(index)
      .then((data) => {
        if (!cancelled) setSrdBackground(data as SRDBackground);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state.selectedBackground?.index]);

  const srd = useMemo(() => {
    if (!srdBackground) return null;
    const traitOptions = srdBackground.personality_traits?.from?.options?.map((o: any) => o.string).filter(Boolean) || [];
    const idealOptions = srdBackground.ideals?.from?.options?.map((o: any) => o.desc).filter(Boolean) || [];
    const bondOptions = srdBackground.bonds?.from?.options?.map((o: any) => o.string).filter(Boolean) || [];
    const flawOptions = srdBackground.flaws?.from?.options?.map((o: any) => o.string).filter(Boolean) || [];
    return {
      choose: {
        traits: srdBackground.personality_traits?.choose ?? 2,
        ideals: srdBackground.ideals?.choose ?? 1,
        bonds: srdBackground.bonds?.choose ?? 1,
        flaws: srdBackground.flaws?.choose ?? 1,
      },
      traitOptions,
      idealOptions,
      bondOptions,
      flawOptions,
    };
  }, [srdBackground]);

  const toggleSuggestion = (
    kind: "traits" | "ideals" | "bonds" | "flaws",
    value: string
  ) => {
    const current = { traits, ideals, bonds, flaws }[kind];
    const lines = current
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const exists = lines.includes(value);
    let next: string[];
    if (exists) {
      next = lines.filter((s) => s !== value);
    } else {
      const limit = srd?.choose[kind] ?? (kind === "traits" ? 2 : 1);
      if (limit && lines.length >= limit) {
        // replace the last selected to respect SRD choose count
        next = [...lines.slice(0, limit - 1), value];
      } else {
        next = [...lines, value];
      }
    }
    const nextText = next.join("\n");
    if (kind === "traits") setTraits(nextText);
    if (kind === "ideals") setIdeals(nextText);
    if (kind === "bonds") setBonds(nextText);
    if (kind === "flaws") setFlaws(nextText);
  };

  const handleNext = () => {
    updateState({
      personalityTraits: traits,
      ideals,
      bonds,
      flaws,
    });
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className=" mb-2">Define Your Personality</h2>
        <p className="text-muted">
          Add or tweak your character's traits, ideals, bonds, and flaws. You can always edit these later on the Character tab.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="frame pad-4">
          <div className="mb-2">Personality Traits</div>
          <textarea
            className="w-full min-h-28 border-2 border-black p-2 bg-transparent textarea-lined"
            value={traits}
            onChange={(e) => setTraits(e.target.value)}
            placeholder="Quirks, habits, mannerisms..."
          />
          {srd && srd.traitOptions.length > 0 && (
            <div className="mt-2">
              <div className="text-sm mb-1">Suggestions (choose {srd.choose.traits}):</div>
              <div className="flex flex-wrap gap-2">
                {srd.traitOptions.map((opt) => {
                  const selected = traits.split("\n").includes(opt);
                  return (
                    <button
                      type="button"
                      key={opt}
                      className={`choice-chip ${selected ? "is-active" : ""}`}
                      onClick={() => toggleSuggestion("traits", opt)}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="frame pad-4">
          <div className="mb-2">Ideals</div>
          <textarea
            className="w-full min-h-28 border-2 border-black p-2 bg-transparent textarea-lined"
            value={ideals}
            onChange={(e) => setIdeals(e.target.value)}
            placeholder="Beliefs or guiding principles..."
          />
          {srd && srd.idealOptions.length > 0 && (
            <div className="mt-2">
              <div className="text-sm mb-1">Suggestions (choose {srd.choose.ideals}):</div>
              <div className="flex flex-wrap gap-2">
                {srd.idealOptions.map((opt) => {
                  const selected = ideals.split("\n").includes(opt);
                  return (
                    <button
                      type="button"
                      key={opt}
                      className={`choice-chip ${selected ? "is-active" : ""}`}
                      onClick={() => toggleSuggestion("ideals", opt)}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="frame pad-4">
          <div className="mb-2">Bonds</div>
          <textarea
            className="w-full min-h-28 border-2 border-black p-2 bg-transparent textarea-lined"
            value={bonds}
            onChange={(e) => setBonds(e.target.value)}
            placeholder="People, places, or obligations..."
          />
          {srd && srd.bondOptions.length > 0 && (
            <div className="mt-2">
              <div className="text-sm mb-1">Suggestions (choose {srd.choose.bonds}):</div>
              <div className="flex flex-wrap gap-2">
                {srd.bondOptions.map((opt) => {
                  const selected = bonds.split("\n").includes(opt);
                  return (
                    <button
                      type="button"
                      key={opt}
                      className={`choice-chip ${selected ? "is-active" : ""}`}
                      onClick={() => toggleSuggestion("bonds", opt)}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="frame pad-4">
          <div className="mb-2">Flaws</div>
          <textarea
            className="w-full min-h-28 border-2 border-black p-2 bg-transparent textarea-lined"
            value={flaws}
            onChange={(e) => setFlaws(e.target.value)}
            placeholder="Weaknesses, vices, or tendencies..."
          />
          {srd && srd.flawOptions.length > 0 && (
            <div className="mt-2">
              <div className="text-sm mb-1">Suggestions (choose {srd.choose.flaws}):</div>
              <div className="flex flex-wrap gap-2">
                {srd.flawOptions.map((opt) => {
                  const selected = flaws.split("\n").includes(opt);
                  return (
                    <button
                      type="button"
                      key={opt}
                      className={`choice-chip ${selected ? "is-active" : ""}`}
                      onClick={() => toggleSuggestion("flaws", opt)}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onPrevious}
          className="btn-frame btn-frame--lg"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="btn-frame"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PersonalityStep;
