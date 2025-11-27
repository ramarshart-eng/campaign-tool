import React from "react";
import type { NextPage } from "next";
import PlayerLayout from "@/lib/components/layout/PlayerLayout";
import { useDmContext } from "@/lib/context/DmContext";
import NoteDocRenderer from "@/lib/components/NoteDocRenderer";
import type { NoteBlock } from "@/lib/types/notes";

const PlayerNotesPage: NextPage = () => {
  const { currentCampaign, notesForCurrent, sessionsForCurrent } =
    useDmContext();

  const sessionIdSet = React.useMemo(
    () => new Set(sessionsForCurrent.map((session) => session.id)),
    [sessionsForCurrent]
  );

  const blockHasPlayerContent = React.useCallback((block: NoteBlock): boolean => {
    // A block explicitly marked as DM-only should never be counted as player content,
    // regardless of whether it has nested child nodes (e.g., list items).
    if (block.visibility === "dmOnly") {
      return false;
    }
    // Per-player visibility isn't supported on the player view yet, so we also treat it as hidden.
    if (block.visibility === "perPlayer") {
      return false;
    }
    // If the block has children (lists, boxed sections), ensure at least one child is player-visible.
    if (Array.isArray(block.children) && block.children.length > 0) {
      return block.children.some((child) => blockHasPlayerContent(child));
    }
    // Default (player or undefined visibility) counts as player content.
    return true;
  }, []);

  const playerVisibleNotes = React.useMemo(() => {
    return notesForCurrent.filter((note) => {
      if (
        (note.scopeType === "session" || note.scopeType === "scene") &&
        (!note.scopeId || !sessionIdSet.has(note.scopeId))
      ) {
        return false;
      }
      if (!note.doc?.blocks?.length) return false;
      return note.doc.blocks.some((block) => blockHasPlayerContent(block));
    });
  }, [notesForCurrent, sessionIdSet, blockHasPlayerContent]);

  if (!currentCampaign) {
    return <div className="p-8">Loading campaign...</div>;
  }

  return (
    <PlayerLayout title="Player Notes" activePage="player-notes">
      <div className="player-notes">
        <header className="player-notes__header">
          <h1>{currentCampaign.name} - Player Notes</h1>
          <p>Showing all notes shared with players.</p>
        </header>
        <div className="player-notes__list">
          {playerVisibleNotes.map((note) => (
            <article key={note.id} className="player-notes__entry">
              <h2>{note.title || "Untitled"}</h2>
              <NoteDocRenderer doc={note.doc} mode="player" />
            </article>
          ))}
          {playerVisibleNotes.length === 0 && (
            <p>No player-visible notes have been created yet.</p>
          )}
        </div>
      </div>
    </PlayerLayout>
  );
};

export default PlayerNotesPage;
