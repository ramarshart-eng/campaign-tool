import React, { useMemo, useState } from "react";
import type { Character } from "@/lib/types/Character";
import { useCharacter } from "@/lib/context/CharacterContext";
import NotesBook from "@/lib/components/NotesBook";

/**
 * Player Play Area Tabs
 * Tabs: Map | Party | The Table | Character | Notes
 */
interface PlayAreaProps {
  character?: Character;
  onTabChange?: (tab: "Map" | "Party" | "The Table" | "Character" | "Notes") => void;
}

const PlayArea: React.FC<PlayAreaProps> = ({ character: propCharacter, onTabChange }) => {
  const tabs = ["Map", "Party", "The Table", "Character", "Notes"] as const;
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("The Table");

  // Local visual mode just for layout purposes:
  // Later this will be driven by the DM (battlemap vs handout).
  const [tableMode, setTableMode] = useState<"battlemap" | "handout">("battlemap");

  // Prefer prop from Prototype page if provided; otherwise use context character
  const { character: contextCharacter, setCharacter } = useCharacter();
  const currentCharacter = useMemo(
    () => contextCharacter ?? propCharacter ?? null,
    [propCharacter, contextCharacter]
  );

  // Generic updater for character fields (used by Character tab editors)
  const updateField = <K extends keyof Character>(key: K, value: Character[K]) => {
    if (!currentCharacter) return;
    const updated: Character = { ...currentCharacter, [key]: value } as Character;
    setCharacter(updated);
  };

  return (
    <div className="relative flex flex-col h-full w-full">
      {/* Tab bar - fixed to top of screen */}
      <div className="top-tabs-wrap">
        <div className="tab-bar tabs-interactive">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                onTabChange?.(tab);
              }}
              className={`tab-btn ${tab === "The Table" ? "tab-btn--lg" : ""} ${
                activeTab === tab ? "is-active" : ""
              }`}
            >
              <span className="tab-label">{tab}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active view */}
      <div className="flex-1 px-3 pt-3 pb-3 space-y-2 overflow-hidden frame">
        {activeTab === "The Table" && (
          <div className="flex flex-col h-full">
            {/* Header row: scene title + mode indicator */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col">
                <span>Scene</span>
                <span>Current Table View</span>
              </div>

              {/* Mode toggle - purely visual for now */}
              <div className="toggle">
                <button
                  type="button"
                  onClick={() => setTableMode("battlemap")}
                  className={`toggle__btn ${tableMode === "battlemap" ? "is-active" : ""}`}
                >
                  Battlemap
                </button>
                <button
                  type="button"
                  onClick={() => setTableMode("handout")}
                  className={`toggle__btn ${tableMode === "handout" ? "is-active" : ""}`}
                >
                  Handout
                </button>
              </div>
            </div>

            {/* Main framed content area */}
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-3xl mx-auto aspect-video frame flex items-center justify-center">
                <div className="text-center">
                  {tableMode === "battlemap" ? (
                    <>
                      <div className="mb-1">Battlemap</div>
                      <div>Map / grid / tokens will be displayed here.</div>
                    </>
                  ) : (
                    <>
                      <div className="mb-1">Handout</div>
                      <div>Letters, art, or other handouts will be displayed here.</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Map" && (
          <div className="h-full flex items-center justify-center">World Map placeholder</div>
        )}

        {activeTab === "Party" && (
          <div className="h-full flex items-center justify-center">{/* Empty Party tab */}</div>
        )}

        {activeTab === "Character" && (
          <div className="h-full w-full overflow-auto">
            {!currentCharacter ? (
              <div className="h-full flex items-center justify-center text-center px-4">
                No character selected. Create or load a character to view details.
              </div>
            ) : (
              <div className="w-full space-y-3">
                {/* Background */}
                <div className="frame pad-4">
                  <div className="mb-2">Background</div>
                  <textarea
                    className="w-full min-h-20 border-2 border-black p-2 bg-transparent textarea-lined"
                    value={currentCharacter.background ?? ""}
                    onChange={(e) => updateField("background", e.target.value)}
                    placeholder="Enter your character background"
                  />
                </div>

                {/* Personality / Background Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="frame pad-4">
                    <div className="mb-2">Personality Traits</div>
                    <textarea
                      className="w-full min-h-24 border-2 border-black p-2 bg-transparent text-sm textarea-lined"
                      value={currentCharacter.personalityTraits ?? ""}
                      onChange={(e) => updateField("personalityTraits", e.target.value)}
                      placeholder="Describe your personality traits"
                    />
                  </div>
                  <div className="frame pad-4">
                    <div className="mb-2">Ideals</div>
                    <textarea
                      className="w-full min-h-24 border-2 border-black p-2 bg-transparent text-sm textarea-lined"
                      value={currentCharacter.ideals ?? ""}
                      onChange={(e) => updateField("ideals", e.target.value)}
                      placeholder="What ideals drive your character?"
                    />
                  </div>
                  <div className="frame pad-4">
                    <div className="mb-2">Bonds</div>
                    <textarea
                      className="w-full min-h-24 border-2 border-black p-2 bg-transparent text-sm textarea-lined"
                      value={currentCharacter.bonds ?? ""}
                      onChange={(e) => updateField("bonds", e.target.value)}
                      placeholder="What bonds does your character have?"
                    />
                  </div>
                  <div className="frame pad-4">
                    <div className="mb-2">Flaws</div>
                    <textarea
                      className="w-full min-h-24 border-2 border-black p-2 bg-transparent text-sm textarea-lined"
                      value={currentCharacter.flaws ?? ""}
                      onChange={(e) => updateField("flaws", e.target.value)}
                      placeholder="What flaws does your character have?"
                    />
                  </div>
                </div>

                {/* Features */}
                <div className="frame pad-4">
                  <div className="mb-2">Features</div>
                  <textarea
                    className="w-full min-h-32 border-2 border-black p-2 bg-transparent text-sm textarea-lined"
                    value={(currentCharacter.features ?? []).join("\n")}
                    onChange={(e) =>
                      updateField(
                        "features",
                        e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0)
                      )
                    }
                    placeholder={"One feature per line"}
                  />
                </div>
              </div>
            )}
          </div>
        )}


        {activeTab === "Notes" && (
          <div className="h-full w-full flex flex-col min-h-0">
            <NotesBook />
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayArea;

