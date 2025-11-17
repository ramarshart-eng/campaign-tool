import React, { useMemo, useState } from "react";
import type { Character } from "@/lib/types/Character";
import { useCharacter } from "@/lib/context/CharacterContext";
import NotesBook from "@/lib/components/NotesBook";
import BookShell from "@/lib/components/BookShell";
// import FlowEditor from "@/lib/components/FlowEditor";

/**
 * Player Play Area Tabs
 * Tabs: Map | Party | The Table | Character | Notes
 */
interface PlayAreaProps {
  character?: Character;
  onTabChange?: (
    tab: "Map" | "Party" | "The Table" | "Character" | "Notes"
  ) => void;
}

const PlayArea: React.FC<PlayAreaProps> = ({ character: propCharacter, onTabChange }) => {
  const tabs = ["Map", "Party", "The Table", "Character", "Notes"] as const;
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("The Table");

  const { character: contextCharacter, setCharacter } = useCharacter();
  const currentCharacter = useMemo(
    () => contextCharacter ?? propCharacter ?? null,
    [propCharacter, contextCharacter]
  );

  const updateField = <K extends keyof Character>(key: K, value: Character[K]) => {
    if (!currentCharacter) return;
    const updated: Character = { ...currentCharacter, [key]: value } as Character;
    setCharacter(updated);
  };

  return (
    <div className="relative flex flex-col h-full w-full">
      <div className="top-tabs-wrap">
        <div className="tab-bar tabs-interactive">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); onTabChange?.(tab); }}
              className={`tab-btn ${tab === "The Table" ? "tab-btn--lg" : ""} ${activeTab === tab ? "is-active" : ""}`}
            >
              <span className="tab-label">{tab}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "The Table" && null}
        {activeTab === "Map" && <MapBook />}
        {activeTab === "Party" && <PartyBook />}
        {activeTab === "Character" && (
          <CharacterBook character={currentCharacter} updateField={updateField} />
        )}
        {activeTab === "Notes" && <NotesBook />}
      </div>
    </div>
  );
};

// Simple shells for Map/Party placeholders
const MapBook: React.FC = () => (
  <BookShell
    renderSpread={() => ({
      left: (
        <div className="book__content">
          <div className="book__title">Map</div>
          <div className="mt-4 text-center text-muted">Map view coming soon.</div>
        </div>
      ),
      right: (
        <div className="book__content">
          <div className="book__title">Details</div>
          <div className="mt-4 text-center text-muted">Select an item on the map.</div>
        </div>
      ),
    })}
  />
);

const PartyBook: React.FC = () => (
  <BookShell
    renderSpread={() => ({
      left: (
        <div className="book__content">
          <div className="book__title">Party Roster</div>
          <div className="mt-4 text-center text-muted">Party roster functionality coming soon.</div>
        </div>
      ),
      right: (
        <div className="book__content">
          <div className="book__title">Member Details</div>
          <div className="mt-4 text-center text-muted">Select a party member to view details.</div>
        </div>
      ),
    })}
  />
);

interface CharacterBookProps {
  character: Character | null;
  updateField: <K extends keyof Character>(key: K, value: Character[K]) => void;
}

const CharacterBook: React.FC<CharacterBookProps> = ({ character, updateField }) => {
  if (!character) {
    return (
      <div className="h-full flex items-center justify-center text-center px-4">
        No character selected. Create or load a character to view details.
      </div>
    );
  }
  return (
    <BookShell
      renderSpread={() => ({
        left: (
          <div className="book__content" style={{ overflowY: "auto" }}>
            <div className="book__title">Character Details</div>
            <div className="mt-2">
              <div className="mb-1 text-sm font-bold">Background</div>
              <textarea className="book__textarea w-full bg-transparent textarea-lined" placeholder="Add background..." value={character.background || ""} onChange={(e) => updateField("background", e.target.value)} />
            </div>
            <div className="mt-2">
              <div className="mb-1 text-sm font-bold">Personality Traits</div>
              <textarea className="book__textarea w-full bg-transparent textarea-lined" placeholder="Add personality traits..." value={character.personalityTraits || ""} onChange={(e) => updateField("personalityTraits", e.target.value)} />
            </div>
            <div className="mt-2">
              <div className="mb-1 text-sm font-bold">Ideals</div>
              <textarea className="book__textarea w-full bg-transparent textarea-lined" placeholder="Add ideals..." value={character.ideals || ""} onChange={(e) => updateField("ideals", e.target.value)} />
            </div>
            <div className="mt-2">
              <div className="mb-1 text-sm font-bold">Bonds</div>
              <textarea className="book__textarea w-full bg-transparent textarea-lined" placeholder="Add bonds..." value={character.bonds || ""} onChange={(e) => updateField("bonds", e.target.value)} />
            </div>
            <div className="mt-2">
              <div className="mb-1 text-sm font-bold">Flaws</div>
              <textarea className="book__textarea w-full bg-transparent textarea-lined" placeholder="Add flaws..." value={character.flaws || ""} onChange={(e) => updateField("flaws", e.target.value)} />
            </div>
          </div>
        ),
        right: (
          <div className="book__content" style={{ overflowY: "auto" }}>
            <div className="book__title">Features</div>
            {character.features?.length ? (
              <ul className="mt-2 book__index-list">
                {character.features.map((f, i) => (
                  <li key={i} className="book__index-row">
                    <span className="book__index-label">{f}</span>
                    <span className="book__index-page">&nbsp;</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 text-center text-muted">No features listed.</div>
            )}
          </div>
        ),
      })}
    />
  );
};

export default PlayArea;



