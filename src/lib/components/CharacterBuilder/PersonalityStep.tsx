/**
 * Step: Personality (Traits, Ideals, Bonds, Flaws)
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";
import { getBackground } from "@/lib/api/srd";
import type { SRDBackground } from "@/lib/types/SRD";

interface PersonalityStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const splitLines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

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

  const suggestions = useMemo(() => {
    const defaults = {
      choose: { traits: 2, ideals: 1, bonds: 1, flaws: 1 },
      traitOptions: [
        "I speak softly, but I carry a big stick.",
        "I’m always polite and respectful.",
        "I face problems head-on; a simple, direct solution is the best path to success.",
        "I often quote (or misquote) sacred texts and proverbs.",
        "I watch over my friends as if they were a litter of newborn pups.",
        "I’m driven by a wanderlust that led me away from home.",
      ],
      idealOptions: [
        "Charity. I always try to help those in need.",
        "Tradition. The ancient traditions of worship must be preserved.",
        "Freedom. Chains are meant to be broken, as are those who would forge them.",
        "Knowledge. The path to power and self‑improvement is through knowledge.",
      ],
      bondOptions: [
        "I owe my life to the priest who took me in when my parents died.",
        "I will get revenge on the evil forces that destroyed my home.",
        "Someone I love died because of a mistake I made. That will never happen again.",
        "I seek to preserve a sacred text that my enemies consider heretical.",
      ],
      flawOptions: [
        "I am inflexible in my thinking.",
        "I judge others harshly and myself even more so.",
        "I am suspicious of strangers and quick to assume the worst.",
        "I can’t resist a pretty face.",
      ],
    };

    if (!srdBackground) return defaults;

    const traitOptions = srdBackground.personality_traits?.from?.options?.map((o: any) => o.string).filter(Boolean) || [];
    const idealOptions = srdBackground.ideals?.from?.options?.map((o: any) => o.desc).filter(Boolean) || [];
    const bondOptions = srdBackground.bonds?.from?.options?.map((o: any) => o.string).filter(Boolean) || [];
    const flawOptions = srdBackground.flaws?.from?.options?.map((o: any) => o.string).filter(Boolean) || [];

    const choose = {
      traits: srdBackground.personality_traits?.choose ?? defaults.choose.traits,
      ideals: srdBackground.ideals?.choose ?? defaults.choose.ideals,
      bonds: srdBackground.bonds?.choose ?? defaults.choose.bonds,
      flaws: srdBackground.flaws?.choose ?? defaults.choose.flaws,
    };

    return {
      choose,
      traitOptions: traitOptions.length ? traitOptions : defaults.traitOptions,
      idealOptions: idealOptions.length ? idealOptions : defaults.idealOptions,
      bondOptions: bondOptions.length ? bondOptions : defaults.bondOptions,
      flawOptions: flawOptions.length ? flawOptions : defaults.flawOptions,
    };
  }, [srdBackground]);

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
    <div className="builder-step">
      <div>
        <h2 className=" mb-1">Define Your Personality</h2>
        <p className="text-muted mt-0">
          Add or tweak your character's traits, ideals, bonds, and flaws. You can always edit these later on the Character tab.
        </p>
        {/* Suggestions rendered inline below as before */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="frame pad-4">
          <div className="mb-2">Personality Traits</div>
          <textarea
            rows={2}
            className="w-full border-2 border-black p-2 bg-transparent textarea-lined"
            value={traits}
            onChange={(e) => setTraits(e.target.value)}
            placeholder="Quirks, habits, mannerisms..."
          />
          {suggestions && suggestions.traitOptions.length > 0 && (
            <div className="mt-2">
              <SuggestionPicker
                label="Suggestions"
                choose={suggestions.choose.traits}
                options={suggestions.traitOptions}
                value={traits}
                onChange={setTraits}
              />
            </div>
          )}
        </div>
        <div className="frame pad-4">
          <div className="mb-2">Ideals</div>
          <textarea
            rows={2}
            className="w-full border-2 border-black p-2 bg-transparent textarea-lined"
            value={ideals}
            onChange={(e) => setIdeals(e.target.value)}
            placeholder="Beliefs or guiding principles..."
          />
          {suggestions && suggestions.idealOptions.length > 0 && (
            <div className="mt-2">
              <SuggestionPicker
                label="Suggestions"
                choose={suggestions.choose.ideals}
                options={suggestions.idealOptions}
                value={ideals}
                onChange={setIdeals}
              />
            </div>
          )}
        </div>
        <div className="frame pad-4">
          <div className="mb-2">Bonds</div>
          <textarea
            rows={2}
            className="w-full border-2 border-black p-2 bg-transparent textarea-lined"
            value={bonds}
            onChange={(e) => setBonds(e.target.value)}
            placeholder="People, places, or obligations..."
          />
          {suggestions && suggestions.bondOptions.length > 0 && (
            <div className="mt-2">
              <SuggestionPicker
                label="Suggestions"
                choose={suggestions.choose.bonds}
                options={suggestions.bondOptions}
                value={bonds}
                onChange={setBonds}
              />
            </div>
          )}
        </div>
        <div className="frame pad-4">
          <div className="mb-2">Flaws</div>
          <textarea
            rows={2}
            className="w-full border-2 border-black p-2 bg-transparent textarea-lined"
            value={flaws}
            onChange={(e) => setFlaws(e.target.value)}
            placeholder="Weaknesses, vices, or tendencies..."
          />
          {suggestions && suggestions.flawOptions.length > 0 && (
            <div className="mt-2">
              <SuggestionPicker
                label="Suggestions"
                choose={suggestions.choose.flaws}
                options={suggestions.flawOptions}
                value={flaws}
                onChange={setFlaws}
              />
            </div>
          )}
        </div>
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

interface SuggestionPickerProps {
  label: string;
  choose: number;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}

const SuggestionPicker: React.FC<SuggestionPickerProps> = ({
  label,
  choose,
  options,
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => splitLines(value), [value]);
  const limit = choose ?? 0;
  const limitLabel = limit > 0 ? limit : "∞";

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

  const toggleOption = (option: string) => {
    const exists = selected.includes(option);
    let next: string[];
    if (exists) {
      next = selected.filter((s) => s !== option);
    } else if (limit > 0 && selected.length >= limit) {
      next = [...selected.slice(0, limit - 1), option];
    } else {
      next = [...selected, option];
    }
    onChange(next.join("\n"));
  };

  return (
    <div className="suggestion-picker" ref={containerRef}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>{label} (choose {limitLabel})</span>
        <button
          type="button"
          className="btn-frame btn-frame--sm"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          {selected.length}/{limitLabel} selected
        </button>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map((opt) => (
            <span key={opt} className="choice-chip chip-sm truncate-1" title={opt}>
              {opt}
            </span>
          ))}
        </div>
      )}
      {open && (
        <div className="popover" role="dialog" aria-label={`${label} options`}>
          <div className="popover-list">
            {options.map((opt) => {
              const isActive = selected.includes(opt);
              const disabled = !isActive && limit > 0 && selected.length >= limit;
              return (
                <button
                  type="button"
                  key={opt}
                  className={`suggestion-option ${isActive ? "is-active" : ""}`}
                  onClick={() => toggleOption(opt)}
                  disabled={disabled}
                >
                  {opt}
                </button>
              );
            })}
            {options.length === 0 && (
              <div className="text-sm text-muted">No suggestions available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
