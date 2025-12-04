import React from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import DmLayout from "@/lib/components/layout/DmLayout";
import NoteDocRenderer from "@/lib/components/NoteDocRenderer";
import EncounterRunPanel from "@/lib/components/EncounterRunPanel";
import { useDmContext } from "@/lib/context/DmContext";
import { useWorkingSession } from "@/lib/hooks/useWorkingSession";
import type { CampaignBeat, EncounterEntity, NpcEntity } from "@/lib/types/dm";
import {
  SRD_MONSTER_SUMMARIES,
  SRD_MONSTERS_BY_ID,
} from "@/lib/data/srdMonsters";
import type { Note } from "@/lib/types/notes";

const SRD_ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"] as const;
const SRD_ABILITY_LABELS: Record<(typeof SRD_ABILITY_ORDER)[number], string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

const formatAbilityModifier = (score: number) => {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const DmPlayPage: NextPage = () => {
  const router = useRouter();
  const { workingSession, setWorkingSession, buildUrl } = useWorkingSession();
  const {
    currentCampaign,
    currentSession,
    sessionsForCurrent,
    notesForCurrent,
    encountersForCurrent,
    beatsForCurrent,
    startEncounterRun,
    updateBeatForCurrent,
    npcsForCurrent,
    deleteEncounterForCurrent,
    npcMapForCurrent,
    addSrdMonsterToEncounter,
  } = useDmContext();

  const [focusedSessionId, setFocusedSessionId] = React.useState<string | null>(
    () =>
      workingSession.sessionId ??
      currentSession?.id ??
      sessionsForCurrent[0]?.id ??
      null
  );
  React.useEffect(() => {
    if (workingSession.sessionId && workingSession.sessionId !== focusedSessionId) {
      setFocusedSessionId(workingSession.sessionId);
    }
  }, [workingSession.sessionId]);

  const focusedSession =
    sessionsForCurrent.find((session) => session.id === focusedSessionId) ??
    null;

  const sceneNotesForSession: Note[] = React.useMemo(() => {
    if (!focusedSessionId) return [];
    return notesForCurrent.filter(
      (note) => note.scopeType === "scene" && note.scopeId === focusedSessionId
    );
  }, [focusedSessionId, notesForCurrent]);

  const npcById = React.useMemo(() => {
    const map = new Map<string, NpcEntity>();
    npcsForCurrent.forEach((npc) => map.set(npc.id, npc));
    return map;
  }, [npcsForCurrent]);

  const [activeSceneId, setActiveSceneId] = React.useState<string | null>(() => {
    if (workingSession.sceneId && sceneNotesForSession.some((scene) => scene.id === workingSession.sceneId)) {
      return workingSession.sceneId;
    }
    return sceneNotesForSession[0]?.id ?? null;
  });
  React.useEffect(() => {
    if (!sceneNotesForSession.length) {
      setActiveSceneId(null);
      return;
    }
    if (
      activeSceneId &&
      !sceneNotesForSession.some((scene) => scene.id === activeSceneId)
    ) {
      setActiveSceneId(sceneNotesForSession[0].id);
      return;
    }
    if (!activeSceneId) {
      setActiveSceneId(sceneNotesForSession[0].id);
    }
  }, [sceneNotesForSession, activeSceneId]);

  const activeScene =
    sceneNotesForSession.find((scene) => scene.id === activeSceneId) ?? null;

  const activeSceneNpcs = React.useMemo(() => {
    if (!activeScene?.entityRefs) return [];
    const seen = new Set<string>();
    const list: NpcEntity[] = [];
    activeScene.entityRefs.forEach((ref) => {
      if (ref.kind !== "npc") return;
      if (seen.has(ref.id)) return;
      const npc = npcById.get(ref.id);
      if (!npc) return;
      seen.add(ref.id);
      list.push(npc);
    });
    return list;
  }, [activeScene?.entityRefs, npcById]);

  const encountersForSession = React.useMemo(() => {
    if (!focusedSessionId) return [];
    return encountersForCurrent.filter(
      (encounter) => encounter.sessionId === focusedSessionId
    );
  }, [focusedSessionId, encountersForCurrent]);

  const encountersByScene = React.useMemo(() => {
    const map = new Map<string | null, EncounterEntity[]>();
    encountersForSession.forEach((encounter) => {
      const key = encounter.sceneNoteId ?? null;
      const existing = map.get(key) ?? [];
      existing.push(encounter);
      map.set(key, existing);
    });
    return map;
  }, [encountersForSession]);

  const sceneEncounterCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    encountersForSession.forEach((encounter) => {
      if (!encounter.sceneNoteId) return;
      counts.set(
        encounter.sceneNoteId,
        (counts.get(encounter.sceneNoteId) ?? 0) + 1
      );
    });
    return counts;
  }, [encountersForSession]);

  const encountersCountBySession = React.useMemo(() => {
    const map = new Map<string, number>();
    encountersForCurrent.forEach((encounter) => {
      if (!encounter.sessionId) return;
      map.set(
        encounter.sessionId,
        (map.get(encounter.sessionId) ?? 0) + 1
      );
    });
    return map;
  }, [encountersForCurrent]);

  const [runEncounterId, setRunEncounterId] = React.useState<string | null>(null);
  const runEncounter = React.useMemo(() => {
    if (!runEncounterId) return null;
    return encountersForCurrent.find((enc) => enc.id === runEncounterId) ?? null;
  }, [runEncounterId, encountersForCurrent]);

  const beatsForSession: CampaignBeat[] = React.useMemo(() => {
    if (!focusedSessionId) return [];
    return beatsForCurrent.filter(
      (beat) => beat.sessionId === focusedSessionId
    );
  }, [beatsForCurrent, focusedSessionId]);

  const handleChooseSession = (sessionId: string) => {
    setFocusedSessionId(sessionId);
    setWorkingSession({ sessionId, sceneId: undefined, encounterId: undefined });
    const firstScene = notesForCurrent.find(
      (note) => note.scopeType === "scene" && note.scopeId === sessionId
    );
    setActiveSceneId(firstScene?.id ?? null);
    setRunEncounterId(null);
  };

  const handleSelectScene = (sceneId: string) => {
    setActiveSceneId(sceneId);
    setWorkingSession({ sceneId });
  };

  const handleRunEncounter = (encounterId: string) => {
    startEncounterRun(encounterId);
    setRunEncounterId(encounterId);
  };

  const handleAddSelectedMonsterToEncounter = () => {
    if (!runEncounter || !selectedSrdMonsterId) return;
    addSrdMonsterToEncounter(runEncounter.id, selectedSrdMonsterId);
  };

  const handleCycleBeatStatus = (beatId: string) => {
    const beat = beatsForSession.find((b) => b.id === beatId);
    if (!beat) return;
    const nextStatus: CampaignBeat["status"] =
      beat.status === "planned"
        ? "in-progress"
        : beat.status === "in-progress"
        ? "done"
        : "planned";
    updateBeatForCurrent(beatId, (prev) => ({ ...prev, status: nextStatus }));
  };

  const [showSrdReference, setShowSrdReference] = React.useState(false);
  const [srdQuery, setSrdQuery] = React.useState("");
  const [selectedSrdMonsterId, setSelectedSrdMonsterId] = React.useState<string | null>(null);
  const [encounterDeleteModal, setEncounterDeleteModal] = React.useState<{
    open: boolean;
    encounter: EncounterEntity | null;
  }>({ open: false, encounter: null });
  const [encounterPickerOpen, setEncounterPickerOpen] = React.useState(false);

  const handleOpenEncounterDelete = (encounter: EncounterEntity) => {
    setEncounterDeleteModal({ open: true, encounter });
  };

  const handleCloseEncounterDelete = () => {
    setEncounterDeleteModal({ open: false, encounter: null });
  };

  const handleConfirmEncounterDelete = () => {
    if (!encounterDeleteModal.encounter) return;
    deleteEncounterForCurrent(encounterDeleteModal.encounter.id);
    if (runEncounterId === encounterDeleteModal.encounter.id) {
      setRunEncounterId(null);
    }
    handleCloseEncounterDelete();
  };

  const filteredSrdMonsters = React.useMemo(() => {
    if (!srdQuery.trim()) return SRD_MONSTER_SUMMARIES.slice(0, 25);
    const term = srdQuery.toLowerCase();
    return SRD_MONSTER_SUMMARIES.filter(
      (monster) =>
        monster.name.toLowerCase().includes(term) ||
        monster.type.toLowerCase().includes(term) ||
        monster.cr.toLowerCase().includes(term)
    ).slice(0, 50);
  }, [srdQuery]);

  const selectedSrdMonster =
    selectedSrdMonsterId
      ? SRD_MONSTERS_BY_ID.get(selectedSrdMonsterId) ?? null
      : null;

  React.useEffect(() => {
    if (!filteredSrdMonsters.length) {
      setSelectedSrdMonsterId(null);
      return;
    }
    if (
      selectedSrdMonsterId &&
      !filteredSrdMonsters.some((monster) => monster.id === selectedSrdMonsterId)
    ) {
      setSelectedSrdMonsterId(filteredSrdMonsters[0]?.id ?? null);
      return;
    }
    if (!selectedSrdMonsterId) {
      setSelectedSrdMonsterId(filteredSrdMonsters[0]?.id ?? null);
    }
  }, [filteredSrdMonsters, selectedSrdMonsterId]);

  React.useEffect(() => {
    const { srdMonsterId } = router.query;
    if (typeof srdMonsterId === "string") {
      setSelectedSrdMonsterId(srdMonsterId);
    }
  }, [router.query.srdMonsterId]);

  const sceneHeader = (scene: Note) => (
    <div className="dm-play__scene-header">
      <strong>{scene.title || "Untitled Scene"}</strong>
      <div className="dm-play__scene-meta">
        <span>
          Updated {new Date(scene.updatedAt).toLocaleDateString()}
        </span>
        {scene.tags?.[0] && (
          <span className="session-planner__badge">{scene.tags[0]}</span>
        )}
        {sceneEncounterCounts.get(scene.id) ? (
          <span className="dm-play__scene-encounter-count">
            {sceneEncounterCounts.get(scene.id)} encounter
            {sceneEncounterCounts.get(scene.id) === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <DmLayout
      title="DM Play Screen"
      activePage="play"
      sceneTitle={activeScene?.title || undefined}
    >
      <div className="dm-play">
        <div className="dm-play__grid">
          <section className="dm-play__column dm-play__column--left">
            <header className="dm-play__section-header">
              <h2>{currentCampaign?.name ?? "Campaign"}</h2>
              <p>Focus Session</p>
            </header>
            <div className="dm-play__sessions dm-panel dm-panel--list">
              {sessionsForCurrent.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={`dm-play__session${
                    session.id === focusedSessionId ? " is-active" : ""
                  }`}
                  onClick={() => handleChooseSession(session.id)}
                >
                  <div>
                    <strong>{session.name}</strong>
                    <small>
                      {notesForCurrent.filter(
                        (note) =>
                          note.scopeType === "scene" &&
                          note.scopeId === session.id
                      ).length}{" "}
                      scenes · {encountersCountBySession.get(session.id) ?? 0}{" "}
                      encounters
                    </small>
                  </div>
                </button>
              ))}
            </div>
            <div className="dm-play__scenes dm-panel dm-panel--list">
              <h3>Scenes</h3>
              {sceneNotesForSession.length === 0 ? (
                <p>No scenes for this session yet.</p>
              ) : (
                <ul>
                  {sceneNotesForSession.map((scene) => (
                    <li
                      key={scene.id}
                      className={`dm-play__scene${
                        scene.id === activeSceneId ? " is-active" : ""
                      }`}
                      onClick={() => handleSelectScene(scene.id)}
                    >
                      {sceneHeader(scene)}
                      {encountersByScene.get(scene.id)?.length ? (
                        <div className="session-planner__scene-encounters">
                          {encountersByScene.get(scene.id)!.map((encounter) => (
                            <Link
                              key={encounter.id}
                              href={buildUrl("/prototype/dm-encounters", { encounterId: encounter.id })}
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
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="dm-play__beats dm-panel dm-panel--list">
              <h3>Beats</h3>
              {beatsForSession.length === 0 ? (
                <p>No beats linked to this session yet.</p>
              ) : (
                <ul>
                  {beatsForSession.map((beat) => (
                    <li key={beat.id} className="dm-play__beat">
                      <button
                        type="button"
                        className={`dm-play__beat-status dm-play__beat-status--${beat.status}`}
                        onClick={() => handleCycleBeatStatus(beat.id)}
                      >
                        {beat.status}
                      </button>
                      <div className="dm-play__beat-main">
                        <strong>{beat.title}</strong>
                        {beat.noteId && (
                          <Link
                            href={buildUrl(`/prototype/dm-notes`, { noteId: beat.noteId })}
                            className="dm-play__beat-link"
                          >
                            Open note
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="dm-play__column dm-play__column--center">
            {activeScene ? (
              <div className="dm-play__scene-view">
                <header className="dm-play__scene-view-header">
                  <div>
                    <h2>{activeScene.title || "Untitled Scene"}</h2>
                    <small>
                      Session: {focusedSession?.name ?? "Unknown session"}
                    </small>
                  </div>
                  <Link
                    className="btn"
                    href={buildUrl("/prototype/dm-notes", { noteId: activeScene.id })}
                  >
                    Edit in Notes Book
                  </Link>
                </header>
                <NoteDocRenderer doc={activeScene.doc} mode="dm" />
                {activeSceneNpcs.length > 0 && (
                  <div className="dm-play__npc-chips">
                    <h4>Scene NPCs</h4>
                    <div>
                      {activeSceneNpcs.map((npc) => (
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
                <div className="dm-play__scene-links">
                  <Link
                    href={buildUrl("/prototype/dm-session-planner")}
                    className="btn"
                  >
                    Open Session Planner
                  </Link>
                </div>
              </div>
            ) : (
              <div className="dm-play__scene-empty">
                <p>Select a scene from the left to view its notes.</p>
              </div>
            )}
          </section>

          <section className="dm-play__column dm-play__column--right">
            <header className="dm-play__section-header">
              <div>
                <h3>Encounters</h3>
                {runEncounter && (
                  <small className="dm-play__encounter-current">
                    Running: {runEncounter.name}
                  </small>
                )}
              </div>
              <div className="dm-play__encounter-header-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setEncounterPickerOpen(true)}
                >
                  Choose encounter
                </button>
                <Link className="btn" href={buildUrl("/prototype/dm-encounters")}>
                  Open Designer
                </Link>
              </div>
            </header>
            {runEncounter && (
              <EncounterRunPanel
                encounter={runEncounter}
                onClose={() => setRunEncounterId(null)}
              />
            )}
            {!runEncounter && (
              <p className="dm-play__muted">
                No encounter running. Click “Choose encounter” to start one.
              </p>
            )}
            <div className="dm-play__srd">
              <div className="dm-play__srd-header">
                <h4>SRD Quick Reference</h4>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setShowSrdReference((prev) => !prev)}
                >
                  {showSrdReference ? "Hide" : "Show"}
                </button>
              </div>
              {showSrdReference && (
                <>
                  <div className="dm-play__srd-search">
                    <label className="label">
                      SRD search
                      <input
                        type="search"
                        className="input input--sm"
                        value={srdQuery}
                        onChange={(event) => setSrdQuery(event.target.value)}
                        placeholder="Search monsters by name, CR, or type"
                      />
                    </label>
                    <span>
                      Showing {filteredSrdMonsters.length} of {SRD_MONSTER_SUMMARIES.length}
                    </span>
                  </div>
                  <div className="dm-play__srd-grid">
                    <div className="dm-play__srd-list no-scrollbar">
                      {filteredSrdMonsters.map((monster) => (
                        <button
                          key={monster.id}
                          type="button"
                          className={`dm-play__srd-row${
                            monster.id === selectedSrdMonsterId ? " is-active" : ""
                          }`}
                          onClick={() => setSelectedSrdMonsterId(monster.id)}
                        >
                          <div>
                            <strong>{monster.name}</strong>
                            <small>CR {monster.cr}</small>
                          </div>
                          <span>{monster.type}</span>
                        </button>
                      ))}
                      {filteredSrdMonsters.length === 0 && (
                        <p className="dm-play__srd-empty">No monsters found.</p>
                      )}
                    </div>
                    <div className="dm-play__srd-detail">
                      {selectedSrdMonster ? (
                        <>
                          <header>
                            <div>
                              <h5>{selectedSrdMonster.name}</h5>
                              <p>
                                {selectedSrdMonster.size} {selectedSrdMonster.type}
                                {selectedSrdMonster.subtype ? ` (${selectedSrdMonster.subtype})` : ""},{" "}
                                {selectedSrdMonster.alignment || "unaligned"}
                              </p>
                            </div>
                            <div className="dm-play__srd-basics">
                              <span>CR {selectedSrdMonster.challenge_rating}</span>
                              <span>{selectedSrdMonster.xp.toLocaleString()} XP</span>
                            </div>
                          </header>
                          <div className="dm-play__srd-add">
                            <button
                              type="button"
                              className="btn btn--primary btn--full"
                              disabled={!runEncounter}
                              onClick={handleAddSelectedMonsterToEncounter}
                            >
                              {runEncounter
                                ? "Add to current encounter"
                                : "Start an encounter to add"}
                            </button>
                          </div>
                          <dl className="dm-play__srd-stats">
                            <div>
                              <dt>Armor Class</dt>
                              <dd>{selectedSrdMonster.armor_class}</dd>
                            </div>
                            <div>
                              <dt>Hit Points</dt>
                              <dd>
                                {selectedSrdMonster.hit_points} ({selectedSrdMonster.hit_dice})
                              </dd>
                            </div>
                            <div>
                              <dt>Speed</dt>
                              <dd>{selectedSrdMonster.speed}</dd>
                            </div>
                            {selectedSrdMonster.senses && (
                              <div>
                                <dt>Senses</dt>
                                <dd>{selectedSrdMonster.senses}</dd>
                              </div>
                            )}
                            {selectedSrdMonster.languages && (
                              <div>
                                <dt>Languages</dt>
                                <dd>{selectedSrdMonster.languages}</dd>
                              </div>
                            )}
                          </dl>
                          <div className="dm-play__srd-abilities">
                            {SRD_ABILITY_ORDER.map((ability) => (
                              <div key={ability}>
                                <span>{SRD_ABILITY_LABELS[ability]}</span>
                                <strong>
                                  {selectedSrdMonster.ability_scores[ability]} (
                                  {formatAbilityModifier(
                                    selectedSrdMonster.ability_scores[ability]
                                  )}
                                  )
                                </strong>
                              </div>
                            ))}
                          </div>
                          <div className="dm-play__srd-actions">
                            {selectedSrdMonster.special_abilities?.length ? (
                              <section>
                                <h6>Traits</h6>
                                {selectedSrdMonster.special_abilities.map((trait) => (
                                  <article key={trait.name}>
                                    <strong>{trait.name}.</strong> {trait.desc}
                                  </article>
                                ))}
                              </section>
                            ) : null}
                            {selectedSrdMonster.actions?.length ? (
                              <section>
                                <h6>Actions</h6>
                                {selectedSrdMonster.actions.map((action) => (
                                  <article key={action.name}>
                                    <strong>{action.name}.</strong> {action.desc}
                                  </article>
                                ))}
                              </section>
                            ) : null}
                            {selectedSrdMonster.legendary_actions?.length ? (
                              <section>
                                <h6>Legendary Actions</h6>
                                {selectedSrdMonster.legendary_actions.map((action) => (
                                  <article key={action.name}>
                                    <strong>{action.name}.</strong> {action.desc}
                                  </article>
                                ))}
                              </section>
                            ) : null}
                            {selectedSrdMonster.reactions?.length ? (
                              <section>
                                <h6>Reactions</h6>
                                {selectedSrdMonster.reactions.map((reaction) => (
                                  <article key={reaction.name}>
                                    <strong>{reaction.name}.</strong> {reaction.desc}
                                  </article>
                                ))}
                              </section>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <p className="dm-play__srd-empty">
                          Select a monster to view full statistics.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </DmLayout>
      {encounterDeleteModal.open && encounterDeleteModal.encounter && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content">
            <h3>Delete Encounter</h3>
            <p>
              Delete <strong>{encounterDeleteModal.encounter.name}</strong>? This action cannot be undone.
            </p>
            <div className="modal__actions">
              <button type="button" className="btn" onClick={handleCloseEncounterDelete}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleConfirmEncounterDelete}
              >
                Delete Encounter
              </button>
            </div>
          </div>
        </div>
      )}
      {encounterPickerOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content">
            <h3>Select encounter to run</h3>
            {encountersForSession.length === 0 ? (
              <p>No encounters linked to this session yet.</p>
            ) : (
              <div className="dm-play__encounter-picker">
                {Array.from(encountersByScene.entries()).map(([sceneId, encounters]) => (
                  <div key={sceneId ?? "none"}>
                    <h4>
                      {sceneId
                        ? sceneNotesForSession.find((scene) => scene.id === sceneId)?.title ||
                          "Untitled Scene"
                        : "Unassigned"}
                    </h4>
                    <ul>
                      {encounters.map((encounter) => (
                        <li key={encounter.id}>
                          <div className="dm-play__encounter-picker-row">
                            <div>
                              <strong>{encounter.name}</strong>
                              {encounter.difficulty && (
                                <span className="dm-play__encounter-pill">
                                  {encounter.difficulty}
                                </span>
                              )}
                              <small>
                                {(encounter.creatures?.length ?? 0)} creature
                                {(encounter.creatures?.length ?? 0) === 1 ? "" : "s"}
                              </small>
                            </div>
                            <div className="dm-play__encounter-actions">
                              <button
                                type="button"
                                className="btn btn--primary btn--sm"
                                onClick={() => {
                                  handleRunEncounter(encounter.id);
                                  setEncounterPickerOpen(false);
                                }}
                              >
                                Run
                              </button>
                              <Link
                                className="btn btn--sm"
                                href={buildUrl("/prototype/dm-encounters", { encounterId: encounter.id })}
                              >
                                Open
                              </Link>
                              <button
                                type="button"
                                className="btn btn--danger btn--sm"
                                onClick={() => {
                                  handleOpenEncounterDelete(encounter);
                                  setEncounterPickerOpen(false);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <div className="modal__actions">
              <button type="button" onClick={() => setEncounterPickerOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DmPlayPage;
