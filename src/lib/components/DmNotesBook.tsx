import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { NoteDoc } from "@/lib/types/notes";
import type { EntityKind, DmEntity } from "@/lib/types/dm";
import RichNotesEditor, {
  RichNotesEditorMode,
} from "@/lib/components/RichNotesEditor";
import { useDmContext } from "@/lib/context/DmContext";

const DmNotesBook: React.FC = () => {
  const {
    currentCampaign,
    notesForCurrent: notes,
    sessionsForCurrent,
    currentSession,
    entitiesForCurrent,
    encountersForCurrent,
    createNoteForCurrent,
    updateNoteForCurrent,
    deleteNoteForCurrent,
    setCurrentSessionId,
    createSession,
    createEntity,
  } = useDmContext();

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<RichNotesEditorMode>("dm");
  const [scopeFilter, setScopeFilter] = React.useState<"campaign" | "session">(
    "campaign"
  );
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [entityModal, setEntityModal] = React.useState<{
    open: boolean;
    kind: EntityKind | null;
    name: string;
    summary: string;
    onCreated?: (entity: DmEntity) => void;
  }>({
    open: false,
    kind: null,
    name: "",
    summary: "",
  });
  const entityMap = React.useMemo(() => {
    const map = new Map<string, DmEntity>();
    entitiesForCurrent.forEach((entity) => map.set(entity.id, entity));
    return map;
  }, [entitiesForCurrent]);

  const insertEntityChip = React.useCallback((entity: DmEntity) => {
    // With the current RichNotesEditor implementation, inserting entities
    // is handled via the dropdown inside the editor, so this is a no-op.
    // We keep the function to avoid changing existing call sites.
    void entity;
  }, []);

  const handleInsertEntity = React.useCallback(
    (entityId: string) => {
      const entity = entityMap.get(entityId);
      if (entity) insertEntityChip(entity);
    },
    [entityMap, insertEntityChip]
  );

  const scopedNotes = React.useMemo(() => {
    if (scopeFilter === "campaign") {
      return notes.filter((n) => n.scopeType === "campaign");
    }
    if (!currentSession) return [];
    return notes.filter(
      (n) => n.scopeType === "session" && n.scopeId === currentSession.id
    );
  }, [scopeFilter, currentSession, notes]);

  const filteredNotes = React.useMemo(() => {
    if (!searchTerm.trim()) return scopedNotes;
    const term = searchTerm.toLowerCase();
    return scopedNotes.filter((n) => {
      const title = (n.title || "").toLowerCase();
      const body = (n.plainText || "").toLowerCase();
      return title.includes(term) || body.includes(term);
    });
  }, [scopedNotes, searchTerm]);

  const active = React.useMemo(() => {
    if (!filteredNotes.length) return undefined;
    if (activeId) {
      return filteredNotes.find((n) => n.id === activeId) ?? filteredNotes[0];
    }
    return filteredNotes[0];
  }, [filteredNotes, activeId]);

  const handleDocChange = (doc: NoteDoc) => {
    if (!active) return;
    updateNoteForCurrent(active.id, (note) => ({ ...note, doc }));
  };

  const handleTitleChange = (title: string) => {
    if (!active) return;
    updateNoteForCurrent(active.id, (note) => ({ ...note, title }));
  };

  const handleNewNote = () => {
    if (!currentCampaign) return;
    if (scopeFilter === "session" && !currentSession) return;
    const note = createNoteForCurrent({
      scopeType: scopeFilter,
      scopeId:
        scopeFilter === "campaign"
          ? currentCampaign.id
          : currentSession?.id ?? null,
    });
    if (note) setActiveId(note.id);
  };

  const handleCreateCampaignOverview = () => {
    if (!currentCampaign) return;
    const note = createNoteForCurrent({
      scopeType: "campaign",
      scopeId: currentCampaign.id,
    });
    if (note) {
      updateNoteForCurrent(note.id, (prev) => ({
        ...prev,
        title: "Campaign Overview",
      }));
      setScopeFilter("campaign");
      setActiveId(note.id);
    }
  };

  const handleDeleteNote = (id: string) => {
    deleteNoteForCurrent(id);
    setActiveId((prevId) => (prevId === id ? null : prevId));
  };

  const handleCreateSession = () => {
    const nextIndex = sessionsForCurrent.length + 1;
    const session = createSession(`Session ${nextIndex}`);
    if (session) {
      setCurrentSessionId(session.id);
      setScopeFilter("session");
      setActiveId(null);
    }
  };
  const referenceData = React.useMemo(() => {
    if (!active?.entityRefs) return [];
    return active.entityRefs.map((ref) => {
      const count = notes.filter((note) =>
        note.entityRefs?.some(
          (r) =>
            r.kind === ref.kind && r.id === ref.id && r.source === ref.source
        )
      ).length;
      return { ref, count };
    });
  }, [active, notes]);

  const encountersForActive = React.useMemo(() => {
    if (!active) return [];
    return encountersForCurrent.filter(
      (encounter) => encounter.sceneNoteId === active.id
    );
  }, [active, encountersForCurrent]);

  React.useEffect(() => {
    if (filteredNotes.length === 0) {
      setActiveId(null);
    } else if (!active) {
      setActiveId(filteredNotes[0].id);
    }
  }, [filteredNotes, active]);

  React.useEffect(() => {
    if (!currentCampaign) return;
    setSearchTerm("");
  }, [scopeFilter, currentCampaign?.id]);

  React.useEffect(() => {
    const noteId = router.query.noteId;
    if (typeof noteId !== "string") return;
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    if (note.scopeType === "session" && note.scopeId) {
      setScopeFilter("session");
      if (note.scopeId !== currentSession?.id) {
        setCurrentSessionId(note.scopeId);
      }
    } else {
      setScopeFilter("campaign");
    }
    setActiveId(noteId);
  }, [router.query.noteId, notes, currentSession?.id, setCurrentSessionId]);

  if (!currentCampaign) return null;

  const canCreateNote =
    scopeFilter === "campaign" ||
    (scopeFilter === "session" && !!currentSession);

  return (
    <div className="dm-notesbook">
      <div className="dm-notesbook__body">
        <aside className="dm-notesbook__toolbar">
          <div className="dm-notesbook__section">
            <p className="dm-notesbook__section-title">Notes Scope</p>
            <div className="dm-notesbook__button-stack">
              <button
                type="button"
                className={`btn-primary${
                  scopeFilter === "campaign" ? " is-active" : ""
                }`}
                onClick={() => {
                  setScopeFilter("campaign");
                  setActiveId(null);
                }}
              >
                Campaign notes
              </button>
              <button
                type="button"
                className={`btn-primary${
                  scopeFilter === "session" ? " is-active" : ""
                }`}
                onClick={() => {
                  if (!sessionsForCurrent.length) return;
                  setScopeFilter("session");
                  setActiveId(null);
                }}
                disabled={!sessionsForCurrent.length}
              >
                Session notes
              </button>
            </div>
            {scopeFilter === "session" && (
              <div className="dm-notesbook__session-controls">
                <label htmlFor="session-select">Session</label>
                <select
                  id="session-select"
                  className="field-select field-select--compact"
                  value={currentSession?.id ?? ""}
                  onChange={(e) => setCurrentSessionId(e.target.value)}
                  disabled={!sessionsForCurrent.length}
                >
                  {sessionsForCurrent.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCreateSession}
                >
                  New session
                </button>
              </div>
            )}
            <div className="dm-notesbook__search">
              <input
                type="text"
                className="field-input field-input--compact"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search notes"
              />
            </div>
          </div>
          <div className="dm-notesbook__section">
            <p className="dm-notesbook__section-title">Editor Mode</p>
            <div className="dm-notesbook__button-stack">
              <button
                type="button"
                className={`btn-primary${mode === "dm" ? " is-active" : ""}`}
                onClick={() => setMode("dm")}
              >
                Edit (DM)
              </button>
              <button
                type="button"
                className={`btn-primary${
                  mode === "playerPreview" ? " is-active" : ""
                }`}
                onClick={() => setMode("playerPreview")}
              >
                Player preview
              </button>
            </div>
          </div>
          <div className="dm-notesbook__section">
            <p className="dm-notesbook__section-title">Entities</p>
            <select
              className="field-select field-select--compact"
              onChange={(e) => {
                if (!e.target.value) return;
                handleInsertEntity(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Insert entity…</option>
              {entitiesForCurrent.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.kind})
                </option>
              ))}
            </select>
            <div className="dm-notesbook__entity-buttons">
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  setEntityModal({
                    open: true,
                    kind: "npc",
                    name: "",
                    summary: "",
                    onCreated: (entity) => insertEntityChip(entity),
                  })
                }
              >
                + NPC
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  setEntityModal({
                    open: true,
                    kind: "location",
                    name: "",
                    summary: "",
                    onCreated: (entity) => insertEntityChip(entity),
                  })
                }
              >
                + Location
              </button>
            </div>
          </div>
        </aside>
        <section className="dm-notesbook__main">
          {active ? (
            <div className="dm-notesbook__editor">
              <RichNotesEditor
                doc={active.doc}
                onChange={handleDocChange}
                title={active.title}
                onTitleChange={handleTitleChange}
                mode={mode}
                readOnly={false}
                titleActions={
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleNewNote}
                    disabled={!canCreateNote}
                  >
                    New note
                  </button>
                }
              />
            </div>
          ) : (
            <div className="dm-notesbook__empty dm-notesbook__empty--standalone">
              {filteredNotes.length === 0 ? (
                scopeFilter === "campaign" ? (
                  <>
                    <p>
                      No campaign notes yet. Start with a{" "}
                      <strong>Campaign Overview</strong> to anchor prep.
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleCreateCampaignOverview}
                    >
                      Create Campaign Overview
                    </button>
                  </>
                ) : !currentSession ? (
                  <p>Create a session to start taking notes.</p>
                ) : (
                  <>
                    <p>No notes for this session yet.</p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleNewNote}
                      disabled={!canCreateNote}
                    >
                      New note
                    </button>
                  </>
                )
              ) : (
                <p>Select a note to begin editing.</p>
              )}
            </div>
          )}
          {referenceData.length > 0 && (
            <div className="dm-notesbook__refs">
              <h4>References</h4>
              <ul>
                {referenceData.map(({ ref, count }) => (
                  <li key={`${ref.source}:${ref.kind}:${ref.id}`}>
                    <span className="note-entity-chip">
                      <span className="note-entity-chip__kind">{ref.kind}</span>
                      <span>{ref.label || ref.id}</span>
                    </span>
                    <span className="dm-notesbook__refs-count">
                      {count} note{count === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {encountersForActive.length > 0 && (
            <div className="dm-notesbook__encounters">
              <h4>Encounters</h4>
              <ul>
                {encountersForActive.map((encounter) => (
                  <li key={encounter.id}>
                    <div>
                      <strong>{encounter.name}</strong>
                      {encounter.difficulty && (
                        <span className="dm-notesbook__encounter-diff">
                          {encounter.difficulty}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/prototype/dm-encounters?encounterId=${encounter.id}`}
                      className="dm-notesbook__encounter-link"
                    >
                      Open encounter
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        <aside className="dm-notesbook__note-sidebar">
          <div className="dm-notesbook__note-sidebar-header">
            <h3>Notes</h3>
            <button
              type="button"
              className="btn-primary"
              onClick={() => active && handleDeleteNote(active.id)}
              disabled={!active}
            >
              Delete
            </button>
          </div>
          <ul className="dm-notesbook__note-list">
            {filteredNotes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className={`dm-notesbook__note-link${
                    active && active.id === note.id ? " is-active" : ""
                  }`}
                  onClick={() => setActiveId(note.id)}
                >
                  <strong>{note.title || "Untitled"}</strong>
                  <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                </button>
              </li>
            ))}
            {filteredNotes.length === 0 && (
              <li className="dm-notesbook__note-empty">
                <p>No notes available for this scope.</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleNewNote}
                  disabled={!canCreateNote}
                >
                  Create note
                </button>
              </li>
            )}
          </ul>
        </aside>
      </div>
      {entityModal.open && (
        <div className="modal">
          <div className="modal__content">
            <h3>Create {entityModal.kind}</h3>
            <label className="modal__field field-label">
              Name
              <input
                type="text"
                className="field-input"
                value={entityModal.name}
                onChange={(e) =>
                  setEntityModal((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </label>
            <label className="modal__field field-label">
              Summary
              <textarea
                rows={3}
                className="field-textarea"
                value={entityModal.summary}
                onChange={(e) =>
                  setEntityModal((prev) => ({
                    ...prev,
                    summary: e.target.value,
                  }))
                }
              />
            </label>
            <div className="modal__actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (!entityModal.kind || !entityModal.name.trim()) return;
                  const entity = createEntity(
                    entityModal.kind,
                    entityModal.name.trim(),
                    {
                      summary: entityModal.summary.trim(),
                    }
                  );
                  if (entity && entityModal.onCreated) {
                    entityModal.onCreated(entity);
                  }
                  setEntityModal({
                    open: false,
                    kind: null,
                    name: "",
                    summary: "",
                  });
                }}
              >
                Create
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  setEntityModal({
                    open: false,
                    kind: null,
                    name: "",
                    summary: "",
                  })
                }
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DmNotesBook;
