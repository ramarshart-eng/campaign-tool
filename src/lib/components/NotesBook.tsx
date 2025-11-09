import React from "react";
import type { Character } from "@/lib/types/Character";
import { useCharacter } from "@/lib/context/CharacterContext";

const NotesBook: React.FC = () => {
  const { character, setCharacter } = useCharacter();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const currentCharacter = character as Character | null;

  const updateField = <K extends keyof Character>(key: K, value: Character[K]) => {
    if (!currentCharacter) return;
    const updated: Character = { ...currentCharacter, [key]: value } as Character;
    setCharacter(updated);
  };

  const [spreadStart, setSpreadStart] = React.useState(0);
  React.useEffect(() => {
    setSpreadStart(0);
  }, [currentCharacter?.id]);

  if (!mounted) {
    return null; // avoid SSR/localStorage quirks during hydration
  }

  if (!currentCharacter) {
    return (
      <div className="h-full flex items-center justify-center text-center px-4">
        No character selected. Load a character to take notes.
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* Two facing pages inside a single book frame */}
      <div className="frame pad-4 flex-1 min-h-0 overflow-hidden book-wrap">
        <div className="book h-full">
          {/* Left page */}
          {(() => {
            const pageIndex = spreadStart + 0;
            const notes = currentCharacter.notes ?? [];
            const pageValue = notes[pageIndex] ?? "";
            const titles = currentCharacter.notesTitles ?? [];
            const titleValue = titles[pageIndex] ?? "";
            return (
              <div key={`notes-page-${pageIndex}`} className="book__page book__page--left">
                <div className="book__paper">
                  {/* Overlay prev button over outer border, aligned with title */}
                  {spreadStart > 0 && (
                    <button
                      type="button"
                      className="book__nav-btn book__nav-btn--prev"
                      aria-label="Previous pages"
                      onClick={() => setSpreadStart(Math.max(0, spreadStart - 2))}
                    />
                  )}
                  {/* Index page when viewing page 1 (no lines) */}
                  {pageIndex === 0 && spreadStart === 0 ? (
                    <div className="book__content">
                      <div className="book__title">Index</div>
                      <div className="book__index">
                        {(() => {
                          const items = (currentCharacter.notesTitles ?? [])
                            .map((t, idx) => ({ idx, t: (t || "").trim() }))
                            .filter((x) => x.t && x.idx !== 0);
                          if (items.length === 0) {
                            return <div className="book__index-empty">Add page titles to build an index.</div>;
                          }
                          return (
                            <ul className="book__index-list">
                              {items.map(({ idx, t }) => {
                                const parts = t.split(">").map((s) => s.trim()).filter(Boolean);
                                const depth = Math.max(0, parts.length - 1);
                                const label = parts[parts.length - 1] || t;
                                return (
                                  <li key={`ix-${idx}`} style={{ paddingLeft: `${depth}rem` }}>
                                    <span className="book__index-label">{label}</span>
                                    <span className="book__index-page">{idx + 1}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="book__content">
                      <input
                        type="text"
                        className="book__title-input"
                        value={titleValue}
                        placeholder="Title"
                        onChange={(e) => {
                          const existing = currentCharacter.notesTitles ?? [];
                          const next = existing.slice();
                          if (next.length <= pageIndex) {
                            next.length = pageIndex + 1;
                            for (let i = 0; i < next.length; i++) if (typeof next[i] !== "string") next[i] = "";
                          }
                          next[pageIndex] = e.target.value;
                          updateField("notesTitles", next);
                        }}
                      />
                      <textarea
                        className="book__textarea w-full bg-transparent textarea-lined"
                        value={pageValue}
                        onChange={(e) => {
                          const existing = currentCharacter.notes ?? [];
                          const next = existing.slice();
                          if (next.length <= pageIndex) {
                            next.length = pageIndex + 1;
                            for (let i = 0; i < next.length; i++) if (typeof next[i] !== "string") next[i] = "";
                          }
                          next[pageIndex] = e.target.value;
                          updateField("notes", next);
                        }}
                        placeholder="Write your notes here..."
                      />
                    </div>
                  )}
                  <div className="book__page-num left">{pageIndex + 1}</div>
                </div>
              </div>
            );
          })()}

          {/* Right page */}
          {(() => {
            const pageIndex = spreadStart + 1;
            const notes = currentCharacter.notes ?? [];
            const pageValue = notes[pageIndex] ?? "";
            const titles = currentCharacter.notesTitles ?? [];
            const titleValue = titles[pageIndex] ?? "";
            return (
              <div key={`notes-page-${pageIndex}`} className="book__page book__page--right">
                <div className="book__paper">
                  {/* Overlay next button over outer border, aligned with title */}
                  <button
                    type="button"
                    className="book__nav-btn book__nav-btn--next"
                    aria-label="Next pages"
                    onClick={() => {
                      const notes = currentCharacter.notes ?? [];
                      const nextStart = spreadStart + 2;
                      const required = nextStart + 2;
                      if (notes.length < required) {
                        const toAdd = required - notes.length;
                        updateField("notes", [...notes, ...Array(toAdd).fill("")]);
                      }
                      setSpreadStart(nextStart);
                    }}
                  />
                  <div className="book__content">
                    <input
                      type="text"
                      className="book__title-input"
                      value={titleValue}
                      placeholder="Title"
                      onChange={(e) => {
                        const existing = currentCharacter.notesTitles ?? [];
                        const next = existing.slice();
                        if (next.length <= pageIndex) {
                          next.length = pageIndex + 1;
                          for (let i = 0; i < next.length; i++) if (typeof next[i] !== "string") next[i] = "";
                        }
                        next[pageIndex] = e.target.value;
                        updateField("notesTitles", next);
                      }}
                    />
                    <textarea
                      className="book__textarea w-full bg-transparent textarea-lined"
                      value={pageValue}
                      onChange={(e) => {
                        const existing = currentCharacter.notes ?? [];
                        const next = existing.slice();
                        if (next.length <= pageIndex) {
                          next.length = pageIndex + 1;
                          for (let i = 0; i < next.length; i++) if (typeof next[i] !== "string") next[i] = "";
                        }
                        next[pageIndex] = e.target.value;
                        updateField("notes", next);
                      }}
                      placeholder="Write your notes here..."
                    />
                  </div>
                  <div className="book__page-num right">{pageIndex + 1}</div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default NotesBook;
