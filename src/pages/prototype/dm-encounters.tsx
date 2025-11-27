import React from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDmContext } from "@/lib/context/DmContext";
import type { EncounterEntity, NpcEntity } from "@/lib/types/dm";
import {
  SRD_MONSTER_SUMMARIES,
  SRD_MONSTERS_BY_ID,
} from "@/lib/data/srdMonsters";
import DmLayout from "@/lib/components/layout/DmLayout";

const DmEncountersPage: NextPage = () => {
  const router = useRouter();
  const {
    currentSession,
    sessionsForCurrent,
    notesForCurrent,
    encountersForCurrent,
    npcsForCurrent,
    createEncounterForCurrentSession,
    updateEncounterForCurrent,
    deleteEncounterForCurrent,
    addEncounterCreatureSlot,
    addSrdMonsterToEncounter,
    updateEncounterCreatureSlot,
    removeEncounterCreatureSlot,
  } = useDmContext();

  const npcOptions = React.useMemo<NpcEntity[]>(() => {
    return [...npcsForCurrent].sort((a, b) => a.name.localeCompare(b.name));
  }, [npcsForCurrent]);

  const [selectedEncounterId, setSelectedEncounterId] =
    React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [showMonsterSearch, setShowMonsterSearch] = React.useState(false);
  const [monsterQuery, setMonsterQuery] = React.useState("");
  const [selectedSlotId, setSelectedSlotId] = React.useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = React.useState<"creatures" | "npcs">(
    "creatures"
  );

  React.useEffect(() => {
    const queryEncounter = router.query.encounterId;
    if (
      typeof queryEncounter === "string" &&
      encountersForCurrent.some((enc) => enc.id === queryEncounter)
    ) {
      setSelectedEncounterId(queryEncounter);
      return;
    }

    if (!selectedEncounterId && encountersForCurrent.length > 0) {
      setSelectedEncounterId(encountersForCurrent[0].id);
    } else if (
      selectedEncounterId &&
      !encountersForCurrent.some((enc) => enc.id === selectedEncounterId)
    ) {
      setSelectedEncounterId(encountersForCurrent[0]?.id ?? null);
    }
  }, [router.query.encounterId, encountersForCurrent, selectedEncounterId]);

  const selectedEncounter: EncounterEntity | null =
    encountersForCurrent.find((enc) => enc.id === selectedEncounterId) ?? null;

  React.useEffect(() => {
    setDeleteConfirm(false);
  }, [selectedEncounterId]);

  React.useEffect(() => {
    if (selectedEncounter?.creatures?.length) {
      setSelectedSlotId(selectedEncounter.creatures[0].id);
    } else {
      setSelectedSlotId(null);
    }
  }, [selectedEncounter?.id, selectedEncounter?.creatures?.length]);

  const encountersBySession = React.useMemo(() => {
    const map = new Map<string | null, EncounterEntity[]>();
    encountersForCurrent.forEach((encounter) => {
      const key = encounter.sessionId ?? null;
      const existing = map.get(key) ?? [];
      existing.push(encounter);
      map.set(key, existing);
    });
    return map;
  }, [encountersForCurrent]);

  const sceneNotesForSelectedSession = React.useMemo(() => {
    if (!selectedEncounter?.sessionId) {
      return notesForCurrent.filter((note) => note.scopeType === "scene");
    }
    return notesForCurrent.filter(
      (note) =>
        note.scopeType === "scene" && note.scopeId === selectedEncounter.sessionId
    );
  }, [selectedEncounter?.sessionId, notesForCurrent]);

  const handleEncounterUpdate = (
    updater: (encounter: EncounterEntity) => EncounterEntity
  ) => {
    if (!selectedEncounter) return;
    updateEncounterForCurrent(selectedEncounter.id, updater);
  };

  const handleNewEncounter = () => {
    const created = createEncounterForCurrentSession({
      name: "New Encounter",
    });
    if (created) {
      setSelectedEncounterId(created.id);
      router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, encounterId: created.id },
        },
        undefined,
        { shallow: true }
      );
    }
  };

  const selectedSessionEncounters = React.useMemo(() => {
    if (!currentSession) return [];
    return encountersBySession.get(currentSession.id) ?? [];
  }, [currentSession, encountersBySession]);

  const selectedSlot =
    selectedEncounter?.creatures?.find((slot) => slot.id === selectedSlotId) ??
    null;

  const selectedSlotMonster =
    selectedSlot?.srdMonsterId && selectedSlot.srdMonsterId.length
      ? SRD_MONSTERS_BY_ID.get(selectedSlot.srdMonsterId) ?? null
      : null;

  const filteredMonsters = React.useMemo(() => {
    if (!monsterQuery.trim()) return SRD_MONSTER_SUMMARIES;
    const term = monsterQuery.toLowerCase();
    return SRD_MONSTER_SUMMARIES.filter(
      (monster) =>
        monster.name.toLowerCase().includes(term) ||
        monster.type.toLowerCase().includes(term) ||
        monster.cr.toLowerCase().includes(term)
    );
  }, [monsterQuery]);

  const handleAddNpcToEncounter = (npcId: string) => {
    if (!selectedEncounter) return;
    if (!npcId) return;
    if (selectedEncounter.npcIds?.includes(npcId)) return;
    handleEncounterUpdate((enc) => ({
      ...enc,
      npcIds: [...(enc.npcIds ?? []), npcId],
    }));
  };

  const handleRemoveNpcFromEncounter = (npcId: string) => {
    if (!selectedEncounter) return;
    handleEncounterUpdate((enc) => ({
      ...enc,
      npcIds: (enc.npcIds ?? []).filter((id) => id !== npcId),
    }));
  };

  const handleSelectMonster = (monsterId: string) => {
    if (!selectedEncounter) return;
    addSrdMonsterToEncounter(selectedEncounter.id, monsterId);
    setShowMonsterSearch(false);
    setMonsterQuery("");
  };

  return (
    <DmLayout title="Encounters" activePage="encounters">
      <div className="dm-encounters">
        <div className="dm-encounters__grid">
          {/* Left: encounters by session */}
          <section className="dm-encounters__panel dm-encounters__panel--list">
            <div className="dm-encounters__panel-header">
              <h2>Encounters</h2>
              <button
                type="button"
                className="btn-primary"
                onClick={handleNewEncounter}
              >
                New Encounter
              </button>
            </div>
            {sessionsForCurrent.length === 0 ? (
              <p>No sessions yet. Create one from the DM Hub.</p>
            ) : (
              <div className="dm-encounters__session-groups">
                {sessionsForCurrent.map((session) => {
                  const list = encountersBySession.get(session.id) ?? [];
                  return (
                    <div
                      key={session.id}
                      className="dm-encounters__session-group"
                    >
                      <h3>
                        {session.name}{" "}
                        <span>
                          ({list.length} encounter
                          {list.length === 1 ? "" : "s"})
                        </span>
                      </h3>
                      {list.length === 0 ? (
                        <p className="dm-encounters__empty">
                          No encounters yet.
                        </p>
                      ) : (
                        <ul>
                          {list.map((encounter) => (
                            <li
                              key={encounter.id}
                              className={
                                encounter.id === selectedEncounterId
                                  ? "is-active"
                                  : undefined
                              }
                              onClick={() => {
                                setSelectedEncounterId(encounter.id);
                                router.replace(
                                  {
                                    pathname: router.pathname,
                                    query: {
                                      ...router.query,
                                      encounterId: encounter.id,
                                    },
                                  },
                                  undefined,
                                  { shallow: true }
                                );
                              }}
                            >
                              <strong>{encounter.name}</strong>
                              <span className="dm-encounters__pill">
                                {encounter.difficulty ?? "-"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {encountersBySession.get(null)?.length ? (
                  <div className="dm-encounters__session-group">
                    <h3>
                      Unassigned{" "}
                      <span>
                        ({encountersBySession.get(null)!.length} encounter
                        {encountersBySession.get(null)!.length === 1 ? ""
                          : "s"}
                        )
                      </span>
                    </h3>
                    <ul>
                      {encountersBySession.get(null)!.map((encounter) => (
                        <li
                          key={encounter.id}
                          className={
                            encounter.id === selectedEncounterId
                              ? "is-active"
                              : undefined
                          }
                          onClick={() => setSelectedEncounterId(encounter.id)}
                        >
                          <strong>{encounter.name}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
            {currentSession && (
              <div className="dm-encounters__current-session">
                <h3>Current session: {currentSession.name}</h3>
                <p>
                  {selectedSessionEncounters.length} encounter
                  {selectedSessionEncounters.length === 1 ? "" : "s"} ready.
                </p>
              </div>
            )}
          </section>

          {/* Middle: encounter details / summary */}
          <section className="dm-encounters__panel">
            <div className="dm-encounters__panel-header">
              <h2>Details</h2>
              {selectedEncounter?.sessionId && (
                <Link
                  className="btn-primary"
                  href={`/prototype/dm-play?sessionId=${selectedEncounter.sessionId}${
                    selectedEncounter.sceneNoteId
                      ? `&sceneId=${selectedEncounter.sceneNoteId}`
                      : ""
                  }`}
                >
                  Open Play Screen
                </Link>
              )}
            </div>
            {selectedEncounter ? (
              <form
                className="dm-encounters__form"
                onSubmit={(e) => e.preventDefault()}
              >
                <label className="field-label">
                  Name
                  <input
                    type="text"
                    className="field-input"
                    value={selectedEncounter.name}
                    onChange={(e) =>
                      handleEncounterUpdate((enc) => ({
                        ...enc,
                        name: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field-label">
                  Summary
                  <textarea
                    className="field-textarea"
                    rows={3}
                    value={selectedEncounter.summary ?? ""}
                    onChange={(e) =>
                      handleEncounterUpdate((enc) => ({
                        ...enc,
                        summary: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field-label">
                  Session
                  <select
                    className="field-select"
                    value={selectedEncounter.sessionId ?? ""}
                    onChange={(e) =>
                      handleEncounterUpdate((enc) => ({
                        ...enc,
                        sessionId: e.target.value || null,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {sessionsForCurrent.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Scene note
                  <select
                    className="field-select"
                    value={selectedEncounter.sceneNoteId ?? ""}
                    onChange={(e) =>
                      handleEncounterUpdate((enc) => ({
                        ...enc,
                        sceneNoteId: e.target.value || null,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {sceneNotesForSelectedSession.map((note) => (
                      <option key={note.id} value={note.id}>
                        {note.title || "Untitled"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Environment
                  <select
                    className="field-select"
                    value={selectedEncounter.environment ?? ""}
                    onChange={(e) =>
                      handleEncounterUpdate((enc) => ({
                        ...enc,
                        environment: (e.target.value ||
                          null) as EncounterEntity["environment"],
                      }))
                    }
                  >
                    <option value="">Unset</option>
                    <option value="dungeon">Dungeon</option>
                    <option value="wilderness">Wilderness</option>
                    <option value="urban">Urban</option>
                    <option value="planar">Planar</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="field-label">
                  Tags (comma separated)
                  <input
                    className="field-input"
                    type="text"
                    value={(selectedEncounter.tags ?? []).join(", ")}
                    onChange={(e) => {
                      const tags = e.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean);
                      handleEncounterUpdate((enc) => ({ ...enc, tags }));
                    }}
                  />
                </label>
                <div className="dm-encounters__metrics">
                  <div>
                    <span>XP Budget</span>
                    <strong>
                      {typeof selectedEncounter.xpBudget === "number"
                        ? selectedEncounter.xpBudget
                        : "-"}
                    </strong>
                  </div>
                  <div>
                    <span>Difficulty</span>
                    <strong>{selectedEncounter.difficulty ?? "-"}</strong>
                  </div>
                  <div>
                    <span>Slots</span>
                    <strong>{selectedEncounter.creatures?.length ?? 0}</strong>
                  </div>
                  <div>
                    <span>NPCs</span>
                    <strong>{selectedEncounter.npcIds?.length ?? 0}</strong>
                  </div>
                </div>
                <div className="dm-encounters__delete">
                  <button
                    type="button"
                    className={`btn-primary${
                      deleteConfirm ? " is-danger" : ""
                    }`}
                    onClick={() => {
                      if (!deleteConfirm) {
                        setDeleteConfirm(true);
                        return;
                      }
                      deleteEncounterForCurrent(selectedEncounter.id);
                      setSelectedEncounterId(null);
                      setDeleteConfirm(false);
                    }}
                  >
                    {deleteConfirm
                      ? "Click again to confirm"
                      : "Delete encounter"}
                  </button>
                </div>
              </form>
            ) : (
              <p>Select an encounter to edit.</p>
            )}
          </section>

          {/* Right: creatures / NPCs tabs */}
          <section className="dm-encounters__panel">
            <div className="dm-encounters__panel-header">
              <h2>Participants</h2>
              {activeTab === "creatures" && selectedEncounter && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowMonsterSearch(true)}
                >
                  Add from SRD
                </button>
              )}
            </div>
            {selectedEncounter ? (
              <>
                <div className="dm-encounters__tabs">
                  <button
                    type="button"
                    className={`dm-encounters__tab${
                      activeTab === "creatures" ? " is-active" : ""
                    }`}
                    onClick={() => setActiveTab("creatures")}
                  >
                    Creatures
                  </button>
                  <button
                    type="button"
                    className={`dm-encounters__tab${
                      activeTab === "npcs" ? " is-active" : ""
                    }`}
                    onClick={() => setActiveTab("npcs")}
                  >
                    NPCs
                  </button>
                </div>

                <div className="dm-encounters__tab-panels">
                  {activeTab === "creatures" && (
                    <>
                      {selectedEncounter.creatures?.length ? (
                        <ul className="dm-encounters__creature-list">
                          {selectedEncounter.creatures.map((slot) => {
                            const slotMonster =
                              slot.srdMonsterId && slot.srdMonsterId.length
                                ? SRD_MONSTERS_BY_ID.get(slot.srdMonsterId) ??
                                  null
                                : null;
                            const isExpanded =
                              selectedSlotId === slot.id && !!slotMonster;

                            return (
                              <li
                                key={slot.id}
                                className={isExpanded ? "is-active" : undefined}
                              >
                                <div className="dm-encounters__creature-card">
                                  <div
                                    className="dm-encounters__creature-row"
                                    onClick={() =>
                                      setSelectedSlotId(
                                        isExpanded ? null : slot.id
                                      )
                                    }
                                  >
                                    <div className="dm-encounters__creature-main">
                                      <span className="dm-encounters__creature-toggle">
                                        {isExpanded ? "▾" : "▸"}
                                      </span>
                                      <div>
                                        <strong>{slot.name}</strong>
                                        {slot.srdMonsterId && (
                                          <span className="dm-encounters__pill">
                                            {slot.srdMonsterId}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeEncounterCreatureSlot(
                                          selectedEncounter.id,
                                          slot.id
                                        );
                                      }}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <div className="dm-encounters__creature-inputs">
                                    <label>
                                      Count
                                      <input
                                        type="number"
                                        min={1}
                                        value={slot.count}
                                        onChange={(e) =>
                                          updateEncounterCreatureSlot(
                                            selectedEncounter.id,
                                            slot.id,
                                            (prev) => ({
                                              ...prev,
                                              count: Math.max(
                                                1,
                                                Number(e.target.value) || 1
                                              ),
                                            })
                                          )
                                        }
                                      />
                                    </label>
                                    <label>
                                      XP each
                                      <input
                                        type="number"
                                        min={0}
                                        value={slot.xpEach ?? 0}
                                        onChange={(e) =>
                                          updateEncounterCreatureSlot(
                                            selectedEncounter.id,
                                            slot.id,
                                            (prev) => ({
                                              ...prev,
                                              xpEach: Math.max(
                                                0,
                                                Number(e.target.value) || 0
                                              ),
                                            })
                                          )
                                        }
                                      />
                                    </label>
                                    <div className="dm-encounters__creature-total">
                                      Total XP:{" "}
                                      {(slot.xpEach ?? 0) * slot.count}
                                    </div>
                                  </div>

                                  {isExpanded && slotMonster && (
                                    <div className="dm-encounters__monster-stats">
                                      <h3>{slotMonster.name}</h3>
                                      <p>
                                        {slotMonster.size} {slotMonster.type},{" "}
                                        {slotMonster.alignment || "unaligned"}
                                      </p>
                                      <div className="dm-encounters__monster-stats-grid">
                                        <div>
                                          <span>Armor Class</span>
                                          <strong>
                                            {slotMonster.armor_class}
                                          </strong>
                                        </div>
                                        <div>
                                          <span>Hit Points</span>
                                          <strong>
                                            {slotMonster.hit_points} (
                                            {slotMonster.hit_dice})
                                          </strong>
                                        </div>
                                        <div>
                                          <span>Speed</span>
                                          <strong>{slotMonster.speed}</strong>
                                        </div>
                                        <div>
                                          <span>CR</span>
                                          <strong>
                                            {slotMonster.challenge_rating} (
                                            {slotMonster.xp} XP)
                                          </strong>
                                        </div>
                                      </div>
                                      <div className="dm-encounters__ability-table">
                                        {Object.entries(
                                          slotMonster.ability_scores
                                        ).map(([ability, score]) => (
                                          <div key={ability}>
                                            <span>
                                              {ability.toUpperCase()}
                                            </span>
                                            <strong>{score}</strong>
                                          </div>
                                        ))}
                                      </div>
                                      {slotMonster.actions && (
                                        <div className="dm-encounters__monster-actions">
                                          <h4>Actions</h4>
                                          <ul>
                                            {slotMonster.actions.map(
                                              (action) => (
                                                <li key={action.name}>
                                                  <strong>
                                                    {action.name}.
                                                  </strong>{" "}
                                                  {action.desc}
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="dm-encounters__empty">
                          No creatures yet. Add enemies or NPCs below.
                        </p>
                      )}

                    </>
                  )}

                  {activeTab === "npcs" && (
                    <div className="dm-encounters__npc-tab">
                      <div className="dm-encounters__npc-header">
                        <h3>NPC Participants</h3>
                        <select
                          onChange={(event) => {
                            handleAddNpcToEncounter(event.target.value);
                            event.currentTarget.value = "";
                          }}
                          defaultValue=""
                        >
                          <option value="">Add NPC…</option>
                          {npcOptions.map((npc) => (
                            <option key={npc.id} value={npc.id}>
                              {npc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="dm-encounters__npc-list">
                        {(selectedEncounter.npcIds ?? []).length === 0 ? (
                          <p>No NPCs assigned to this encounter.</p>
                        ) : (
                          selectedEncounter.npcIds!.map((npcId) => {
                            const npc = npcOptions.find((n) => n.id === npcId);
                            if (!npc) return null;
                            return (
                              <div
                                key={npc.id}
                                className="dm-encounters__npc-row"
                              >
                                <div>
                                  <strong>{npc.name}</strong>
                                  {npc.role && <small>{npc.role}</small>}
                                </div>
                                <div className="dm-encounters__npc-actions">
                                  <Link
                                    href={{
                                      pathname: "/prototype/dm-roster",
                                      query: { entityId: npc.id },
                                    }}
                                    className="btn-primary"
                                  >
                                    Roster
                                  </Link>
                                  <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() =>
                                      handleRemoveNpcFromEncounter(npc.id)
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p>Select an encounter to edit.</p>
            )}
          </section>
        </div>

        {showMonsterSearch && (
          <div className="modal">
            <div className="modal__content dm-encounters__monster-modal">
              <div className="dm-encounters__monster-modal-header">
                <h3>SRD Monsters</h3>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowMonsterSearch(false)}
                >
                  Close
                </button>
              </div>
              <input
                type="text"
                placeholder="Search monsters by name, type, or CR"
                value={monsterQuery}
                onChange={(e) => setMonsterQuery(e.target.value)}
              />
              <div className="dm-encounters__monster-list">
                {filteredMonsters.map((monster) => (
                  <button
                    type="button"
                    key={monster.id}
                    className="dm-encounters__monster-row"
                    onClick={() => handleSelectMonster(monster.id)}
                  >
                    <span>
                      <strong>{monster.name}</strong>
                      <small>
                        CR {monster.cr} · {monster.type}
                      </small>
                    </span>
                    <span>{monster.xp} XP</span>
                  </button>
                ))}
                {filteredMonsters.length === 0 && (
                  <p className="dm-encounters__empty">No monsters found.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DmLayout>
  );
};

export default DmEncountersPage;
