
import React from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDmContext } from "@/lib/context/DmContext";
import { useWorkingSession } from "@/lib/hooks/useWorkingSession";
import NoteDocRenderer from "@/lib/components/NoteDocRenderer";
import DmLayout from "@/lib/components/layout/DmLayout";
import type { CampaignBeat, EncounterEntity, NpcEntity } from "@/lib/types/dm";
import type { Note } from "@/lib/types/notes";

const sceneCategories = [
  "Intro",
  "Exploration",
  "Social",
  "Combat",
  "Puzzle",
  "Downtime",
  "Boss",
];

const DmSessionPlannerPage: NextPage = () => {
  const router = useRouter();
  const { workingSession, setWorkingSession, buildUrl } = useWorkingSession();
  const {
    currentCampaign,
    currentSession,
    notesForCurrent,
    encountersForCurrent,
    npcsForCurrent,
    beatsForCurrent,
    createNoteForCurrent,
    updateNoteForCurrent,
    deleteNoteForCurrent,
    createEncounterForCurrentSession,
    deleteSession,
    createBeatForCurrent,
    updateBeatForCurrent,
    setCurrentSessionId,
    setPrimarySessionNote,
  } = useDmContext();

  React.useEffect(() => {
    if (workingSession.sessionId) {
      setCurrentSessionId(workingSession.sessionId);
    }
  }, [workingSession.sessionId, setCurrentSessionId]);

  const sessionId = currentSession?.id ?? null;

  const sceneNotes = React.useMemo(() => {
    if (!sessionId) return [];
    return notesForCurrent.filter(
      (note) => note.scopeType === "scene" && note.scopeId === sessionId
    );
  }, [notesForCurrent, sessionId]);

  const orderedScenes = React.useMemo(() => {
    return [...sceneNotes].sort((a, b) => {
      const orderA =
        typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB =
        typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, [sceneNotes]);

  const sessionNotes = React.useMemo(() => {
    if (!sessionId) return [];
    return notesForCurrent.filter(
      (note) => note.scopeType === "session" && note.scopeId === sessionId
    );
  }, [notesForCurrent, sessionId]);

  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    if (
      workingSession.sceneId &&
      orderedScenes.some((scene) => scene.id === workingSession.sceneId)
    ) {
      setSelectedSceneId(workingSession.sceneId);
      return;
    }
    if (!selectedSceneId && orderedScenes.length > 0) {
      setSelectedSceneId(orderedScenes[0].id);
    } else if (
      selectedSceneId &&
      !orderedScenes.some((scene) => scene.id === selectedSceneId)
    ) {
      setSelectedSceneId(orderedScenes[0]?.id ?? null);
    }
  }, [orderedScenes, workingSession.sceneId, selectedSceneId]);

  const selectedScene =
    orderedScenes.find((scene) => scene.id === selectedSceneId) ?? null;

  const npcMap = React.useMemo(() => {
    const map = new Map<string, NpcEntity>();
    npcsForCurrent.forEach((npc) => map.set(npc.id, npc));
    return map;
  }, [npcsForCurrent]);

  const selectedSceneNpcs = React.useMemo(() => {
    if (!selectedScene?.entityRefs) return [];
    const seen = new Set<string>();
    const list: NpcEntity[] = [];
    selectedScene.entityRefs.forEach((ref) => {
      if (ref.kind !== "npc") return;
      if (seen.has(ref.id)) return;
      const npc = npcMap.get(ref.id);
      if (!npc) return;
      seen.add(ref.id);
      list.push(npc);
    });
    return list;
  }, [npcMap, selectedScene?.entityRefs]);

  const encountersForSession = React.useMemo(() => {
    if (!sessionId) return [];
    return encountersForCurrent
      .filter((encounter) => encounter.sessionId === sessionId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }, [encountersForCurrent, sessionId]);

  const encountersByScene = React.useMemo(() => {
    const map = new Map<string, EncounterEntity[]>();
    encountersForSession.forEach((encounter) => {
      if (!encounter.sceneNoteId) return;
      const list = map.get(encounter.sceneNoteId) ?? [];
      list.push(encounter);
      map.set(encounter.sceneNoteId, list);
    });
    return map;
  }, [encountersForSession]);

  const beatsForSession = React.useMemo(() => {
    if (!sessionId) return [];
    return beatsForCurrent
      .filter((beat) => beat.sessionId === sessionId)
      .slice()
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
  }, [beatsForCurrent, sessionId]);

  const [sessionDeleteModal, setSessionDeleteModal] = React.useState<{
    open: boolean;
    removeChildren: boolean;
  }>({ open: false, removeChildren: true });

  const [sceneDeleteModal, setSceneDeleteModal] = React.useState<{
    scene: Note | null;
  }>({ scene: null });

  const [newBeat, setNewBeat] = React.useState<{
    title: string;
    summary: string;
    sceneNoteId: string;
    encounterId: string;
  }>({ title: "", summary: "", sceneNoteId: "", encounterId: "" });
  const persistSceneOrder = React.useCallback(
    (scenes: Note[]) => {
      scenes.forEach((scene, index) => {
        updateNoteForCurrent(scene.id, (prev) => ({ ...prev, order: index }));
      });
    },
    [updateNoteForCurrent]
  );

  const handleMoveScene = (sceneId: string, direction: "up" | "down") => {
    const list = [...orderedScenes];
    const index = list.findIndex((scene) => scene.id === sceneId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const temp = list[targetIndex];
    list[targetIndex] = list[index];
    list[index] = temp;
    persistSceneOrder(list);
  };

  const handleSelectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    setWorkingSession({ sceneId });
  };

  const handleCreateScene = () => {
    if (!sessionId) return;
    const created = createNoteForCurrent({
      scopeType: "scene",
      scopeId: sessionId,
    });
    if (created) {
      setSelectedSceneId(created.id);
      setWorkingSession({ sceneId: created.id });
    }
  };

  const handleCreateSessionNote = () => {
    if (!sessionId) return;
    createNoteForCurrent({
      scopeType: "session",
      scopeId: sessionId,
    });
  };

  const handleSceneCategoryChange = (sceneId: string, value: string) => {
    updateNoteForCurrent(sceneId, (note) => {
      const tags = [...(note.tags ?? [])];
      if (value) {
        tags[0] = value;
        return { ...note, tags };
      }
      tags.shift();
      return { ...note, tags };
    });
  };

  const handleSceneTitleChange = (sceneId: string, title: string) => {
    updateNoteForCurrent(sceneId, (note) => ({ ...note, title }));
  };

  const handleCreateEncounterForScene = (
    sceneId: string,
    sceneTitle: string
  ) => {
    if (!sessionId) return;
    const encounter = createEncounterForCurrentSession({
      name: sceneTitle || "Untitled Encounter",
      sessionId,
      sceneNoteId: sceneId,
    });
    if (encounter) {
      router.push(buildUrl("/prototype/dm-encounters", { encounterId: encounter.id }));
    }
  };

  const closeSessionDeleteModal = () =>
    setSessionDeleteModal((prev) => ({ ...prev, open: false }));

  const handleDeleteSession = () => {
    if (!currentSession) return;
    deleteSession(currentSession.id, {
      removeChildren: sessionDeleteModal.removeChildren,
    });
    setSessionDeleteModal({ open: false, removeChildren: true });
    setSelectedSceneId(null);
  };

  const openSceneDeleteModal = (scene: Note) => setSceneDeleteModal({ scene });

  const closeSceneDeleteModal = () => setSceneDeleteModal({ scene: null });

  const handleDeleteScene = () => {
    if (!sceneDeleteModal.scene) return;
    deleteNoteForCurrent(sceneDeleteModal.scene.id);
    if (selectedSceneId === sceneDeleteModal.scene.id) {
      setSelectedSceneId(null);
    }
    closeSceneDeleteModal();
  };

  const handleSetPrimaryNote = (noteId: string | null) => {
    if (!currentSession) return;
    setPrimarySessionNote(currentSession.id, noteId);
  };

  const handleAddBeat = () => {
    if (!sessionId || !newBeat.title.trim()) return;
    createBeatForCurrent({
      title: newBeat.title.trim(),
      summary: newBeat.summary.trim() || undefined,
      arcId: currentSession?.arcId ?? null,
      sessionId,
      noteId: newBeat.sceneNoteId || null,
      sceneNoteId: newBeat.sceneNoteId || null,
      encounterId: newBeat.encounterId || null,
    });
    setNewBeat({ title: "", summary: "", sceneNoteId: "", encounterId: "" });
  };

  const handleCycleBeatStatus = (beat: CampaignBeat) => {
    const nextStatus: CampaignBeat["status"] =
      beat.status === "planned"
        ? "in-progress"
        : beat.status === "in-progress"
        ? "done"
        : "planned";
    updateBeatForCurrent(beat.id, (prev) => ({ ...prev, status: nextStatus }));
  };

  const persistBeatOrder = React.useCallback(
    (beats: CampaignBeat[]) => {
      beats.forEach((beat, index) => {
        updateBeatForCurrent(beat.id, (prev) => ({ ...prev, order: index }));
      });
    },
    [updateBeatForCurrent]
  );

  const handleMoveBeat = (beatId: string, direction: "up" | "down") => {
    const list = [...beatsForSession];
    const index = list.findIndex((beat) => beat.id === beatId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const temp = list[targetIndex];
    list[targetIndex] = list[index];
    list[index] = temp;
    persistBeatOrder(list);
  };

  const selectedSceneEncounters =
    selectedScene?.id ? encountersByScene.get(selectedScene.id) ?? [] : [];
  const sceneList = (
    <aside className="session-planner__rail">
      <header className="session-planner__header">
        <div>
          <h1>Session Planner</h1>
          <p>
            Campaign: {currentCampaign?.name ?? "Loading..."} | Session: {" "}
            {currentSession?.name ?? "None selected"}
          </p>
          <div className="session-planner__counts">
            <span>{orderedScenes.length} scenes</span>
            <span>{sessionNotes.length} session notes</span>
            <span>{beatsForSession.length} beats</span>
          </div>
        </div>
        <div className="session-planner__actions">
          {currentSession && (
            <Link
              className="btn"
              href={`/prototype/dm-play?sessionId=${currentSession.id}${
                selectedScene ? `&sceneId=${selectedScene.id}` : ""
              }`}
            >
              Open Play Screen
            </Link>
          )}
          <button
            type="button"
            className="btn"
            onClick={handleCreateScene}
            disabled={!sessionId}
          >
            New Scene
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleCreateSessionNote}
            disabled={!sessionId}
          >
            New Session Note
          </button>
          {currentSession && (
            <button
              type="button"
              className="btn"
              onClick={() =>
                setSessionDeleteModal({ open: true, removeChildren: true })
              }
            >
              Delete Session
            </button>
          )}
        </div>
      </header>
      <div className="session-planner__panel session-planner__scenes">
        {orderedScenes.length === 0 ? (
          <p>No scenes yet. Create your first scene to start planning.</p>
        ) : (
          <ul>
            {orderedScenes.map((scene, index) => (
              <li
                key={scene.id}
                className={`session-planner__scene${
                  scene.id === selectedSceneId ? " is-active" : ""
                }`}
                onClick={() => handleSelectScene(scene.id)}
              >
                <div className="session-planner__scene-body">
                  <input
                    type="text"
                    className="session-planner__scene-title input"
                    value={scene.title || ""}
                    onChange={(event) =>
                      handleSceneTitleChange(scene.id, event.target.value)
                    }
                    placeholder="Scene title"
                  />
                  <div className="session-planner__scene-meta">
                    <select
                      className="session-planner__badge-select select"
                      value={scene.tags?.[0] || ""}
                      onChange={(event) => {
                        event.stopPropagation();
                        handleSceneCategoryChange(scene.id, event.target.value);
                      }}
                    >
                      <option value="">Uncategorized</option>
                      {sceneCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <div className="session-planner__scene-move">
                      <button
                        type="button"
                        className="btn"
                        aria-label="Move scene up"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleMoveScene(scene.id, "up");
                        }}
                        disabled={index === 0}
                      >
                        ?
                      </button>
                      <button
                        type="button"
                        className="btn"
                        aria-label="Move scene down"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleMoveScene(scene.id, "down");
                        }}
                        disabled={index === orderedScenes.length - 1}
                      >
                        ?
                      </button>
                    </div>
                  </div>
                  {encountersByScene.get(scene.id)?.length ? (
                    <div className="session-planner__scene-encounters">
                      {encountersByScene.get(scene.id)!.map((encounter) => (
                        <Link
                          key={encounter.id}
                          href={`/prototype/dm-encounters?encounterId=${encounter.id}`}
                          className="session-planner__scene-encounter-chip"
                        >
                          {encounter.name}
                          {encounter.difficulty && (
                            <span className="session-planner__scene-encounter-diff">
                              {encounter.difficulty}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="session-planner__scene-actions" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
  const scenePreview = selectedScene ? (
    <div className="session-planner__panel session-planner__preview">
      <div className="session-planner__preview-header">
        <div>
          <h2>{selectedScene.title || "Untitled Scene"}</h2>
          <div className="session-planner__preview-meta">
            <span>{selectedScene.tags?.[0] || "Uncategorized"}</span>
            <span>
              Updated {new Date(selectedScene.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="session-planner__preview-actions">
          <Link
            className="btn"
            href={`/prototype/dm-notes?noteId=${selectedScene.id}`}
          >
            Open Note
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() =>
              handleCreateEncounterForScene(
                selectedScene.id,
                selectedScene.title
              )
            }
          >
            New Encounter
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => openSceneDeleteModal(selectedScene)}
          >
            Delete Scene
          </button>
        </div>
      </div>
      <NoteDocRenderer doc={selectedScene.doc} mode="dm" />
      {selectedScene.entityRefs?.length ? (
        <div className="session-planner__entities">
          <h4>Entities</h4>
          <div>
            {selectedScene.entityRefs.map((ref) => (
              <span
                className="note-entity-chip"
                key={`${ref.source}:${ref.kind}:${ref.id}`}
              >
                <span className="note-entity-chip__kind">{ref.kind}</span>
                <span>{ref.label || ref.id}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {selectedSceneNpcs.length > 0 && (
        <div className="session-planner__entities">
          <h4>NPCs in this scene</h4>
          <div>
            {selectedSceneNpcs.map((npc) => (
              <Link
                key={npc.id}
                href={{
                  pathname: "/prototype/dm-roster",
                  query: { entityId: npc.id },
                }}
                className="note-entity-chip"
              >
                <span className="note-entity-chip__kind">NPC</span>
                <span>{npc.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {selectedSceneEncounters.length > 0 && (
        <div className="session-planner__encounters">
          <h4>Encounters in this scene</h4>
          <ul>
            {selectedSceneEncounters.map((encounter) => (
              <li key={encounter.id}>
                <Link
                  href={`/prototype/dm-encounters?encounterId=${encounter.id}`}
                >
                  <strong>{encounter.name}</strong>
                  {encounter.difficulty && (
                    <span className="session-planner__scene-encounter-diff">
                      {encounter.difficulty}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  ) : (
    <div className="session-planner__panel session-planner__preview">
      <p>Select a scene from the left to preview it.</p>
    </div>
  );
  const sessionNotesPanel = (
    <div className="session-planner__panel session-planner__session-notes">
      <h3>Session Notes</h3>
      {sessionNotes.length === 0 ? (
        <p>No session-level notes yet.</p>
      ) : (
        <ul>
          {sessionNotes.map((note) => (
            <li key={note.id} className="session-planner__session-note-row">
              <div>
                <strong>{note.title || "Untitled"}</strong>
                {currentSession?.primaryNoteId === note.id && (
                  <span className="session-planner__badge">Primary</span>
                )}
              </div>
              <div className="session-planner__session-note-actions">
                <Link
                  className="btn"
                  href={`/prototype/dm-notes?noteId=${note.id}`}
                >
                  Open
                </Link>
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    handleSetPrimaryNote(
                      currentSession?.primaryNoteId === note.id ? null : note.id
                    )
                  }
                >
                  {currentSession?.primaryNoteId === note.id
                    ? "Clear Primary"
                    : "Make Primary"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const beatsPanel = (
    <div className="session-planner__panel session-planner__beats-panel">
      <div className="session-planner__beats-header">
        <h3>Beats</h3>
        <span>{beatsForSession.length} linked</span>
      </div>
      <div className="session-planner__beats-form">
        <input
          type="text"
          className="input"
          placeholder="Beat title"
          value={newBeat.title}
          onChange={(event) =>
            setNewBeat((prev) => ({ ...prev, title: event.target.value }))
          }
        />
        <input
          type="text"
          className="input"
          placeholder="Summary (optional)"
          value={newBeat.summary}
          onChange={(event) =>
            setNewBeat((prev) => ({ ...prev, summary: event.target.value }))
          }
        />
        <select
          className="select"
          value={newBeat.sceneNoteId}
          onChange={(event) =>
            setNewBeat((prev) => ({
              ...prev,
              sceneNoteId: event.target.value,
            }))
          }
        >
          <option value="">No linked scene</option>
          {orderedScenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.title || "Untitled Scene"}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={newBeat.encounterId}
          onChange={(event) =>
            setNewBeat((prev) => ({
              ...prev,
              encounterId: event.target.value,
            }))
          }
        >
          <option value="">No linked encounter</option>
          {encountersForSession.map((encounter) => (
            <option key={encounter.id} value={encounter.id}>
              {encounter.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          onClick={handleAddBeat}
          disabled={!newBeat.title.trim()}
        >
          Add Beat
        </button>
      </div>
      {beatsForSession.length === 0 ? (
        <p>No beats linked to this session yet.</p>
      ) : (
        <ul className="session-planner__beats-list">
          {beatsForSession.map((beat, index) => (
            <li key={beat.id} className="session-planner__beat-row">
              <div className="session-planner__beat-status">
                <button
                  type="button"
                  className={`dm-play__beat-status dm-play__beat-status--${beat.status}`}
                  onClick={() => handleCycleBeatStatus(beat)}
                >
                  {beat.status}
                </button>
                <div className="session-planner__beat-order">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleMoveBeat(beat.id, "up")}
                    disabled={index === 0}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleMoveBeat(beat.id, "down")}
                    disabled={index === beatsForSession.length - 1}
                  >
                    Down
                  </button>
                </div>
              </div>
              <div className="session-planner__beat-main">
                <strong>{beat.title}</strong>
                {beat.summary && <p>{beat.summary}</p>}
                <div className="session-planner__beat-links">
                  {beat.sceneNoteId && (
                    <span className="session-planner__badge">
                      Scene: {" "}
                      {orderedScenes.find((scene) => scene.id === beat.sceneNoteId)
                        ?.title || "Untitled"}
                    </span>
                  )}
                  {beat.encounterId && (
                    <span className="session-planner__badge">
                      Encounter: {" "}
                      {
                        encountersForSession.find(
                          (encounter) => encounter.id === beat.encounterId
                        )?.name
                      }
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  const sessionEncounterPanel = (
    <div className="session-planner__panel session-planner__encounters-panel">
      <h3>Session Encounters</h3>
      {encountersForSession.length === 0 ? (
        <p>No encounters prepared for this session.</p>
      ) : (
        <div className="session-planner__encounters">
          <ul>
            {encountersForSession.map((encounter) => (
              <li key={encounter.id}>
                <Link
                  href={`/prototype/dm-encounters?encounterId=${encounter.id}`}
                >
                  <strong>{encounter.name}</strong>
                  {encounter.difficulty && (
                    <span className="session-planner__scene-encounter-diff">
                      {encounter.difficulty}
                    </span>
                  )}
                </Link>
                {encounter.sceneNoteId && (
                  <span>
                    {" "}
                    � Scene: {" "}
                    {
                      orderedScenes.find(
                        (scene) => scene.id === encounter.sceneNoteId
                      )?.title
                    }
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
  return (
    <>
      <DmLayout
        title="Session Planner"
        activePage="session-planner"
        sceneTitle={selectedScene?.title || undefined}
      >
        <div className="session-planner">
          {sceneList}
          <div className="session-planner__main">
            {scenePreview}
            {sessionNotesPanel}
          </div>
          <div className="session-planner__sidebar">
            {beatsPanel}
            {sessionEncounterPanel}
          </div>
        </div>
      </DmLayout>
      {sessionDeleteModal.open && currentSession && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content">
            <h3>Delete Session</h3>
            <p>
              Delete <strong>{currentSession.name}</strong>? This can also remove
              linked notes, scenes, encounters, and beats.
            </p>
            <ul>
              <li>
                {orderedScenes.length} scene note
                {orderedScenes.length === 1 ? "" : "s"}
              </li>
              <li>
                {sessionNotes.length} session note
                {sessionNotes.length === 1 ? "" : "s"}
              </li>
              <li>
                {encountersForSession.length} encounter
                {encountersForSession.length === 1 ? "" : "s"}
              </li>
              <li>
                {beatsForSession.length} beat
                {beatsForSession.length === 1 ? "" : "s"}
              </li>
            </ul>
            <label className="modal__field modal__field--inline">
              <input
                type="checkbox"
                checked={sessionDeleteModal.removeChildren}
                onChange={(event) =>
                  setSessionDeleteModal((prev) => ({
                    ...prev,
                    removeChildren: event.target.checked,
                  }))
                }
              />
              <span>Also delete linked items</span>
            </label>
            <div className="modal__actions">
              <button type="button" onClick={closeSessionDeleteModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleDeleteSession}
              >
                Delete Session
              </button>
            </div>
          </div>
        </div>
      )}
      {sceneDeleteModal.scene && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content">
            <h3>Delete Scene</h3>
            <p>
              Delete {" "}
              <strong>{sceneDeleteModal.scene.title || "Untitled Scene"}</strong>?
            </p>
            <ul>
              <li>
                {(encountersByScene.get(sceneDeleteModal.scene.id)?.length ?? 0)}
                {" "}
                linked encounter
                {(encountersByScene.get(sceneDeleteModal.scene.id)?.length ?? 0) ===
                1
                  ? ""
                  : "s"}
              </li>
              <li>
                {
                  beatsForSession.filter(
                    (beat) =>
                      beat.sceneNoteId === sceneDeleteModal.scene?.id ||
                      beat.noteId === sceneDeleteModal.scene?.id
                  ).length
                }{" "}
                linked beat
                {beatsForSession.filter(
                  (beat) =>
                    beat.sceneNoteId === sceneDeleteModal.scene?.id ||
                    beat.noteId === sceneDeleteModal.scene?.id
                ).length === 1
                  ? ""
                  : "s"}
              </li>
            </ul>
            <div className="modal__actions">
              <button type="button" onClick={closeSceneDeleteModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleDeleteScene}
              >
                Delete Scene
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DmSessionPlannerPage;

