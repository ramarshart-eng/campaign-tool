import React from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import DmLayout from "@/lib/components/layout/DmLayout";
import { useDmContext } from "@/lib/context/DmContext";
import { useWorkingSession } from "@/lib/hooks/useWorkingSession";
import type { NpcEntity, FactionEntity, LocationEntity } from "@/lib/types/dm";
import { SRD_MONSTER_SUMMARIES } from "@/lib/data/srdMonsters";

type RosterTab = "npc" | "faction";

const emptyNpc: Partial<NpcEntity> = {
  role: "",
  summary: "",
  importance: "minor",
  visibility: "dmOnly",
};

const emptyFaction: Partial<FactionEntity> = {
  summary: "",
  scope: "local",
  visibility: "dmOnly",
  attitude: "neutral",
};

const DmRosterPage: NextPage = () => {
  const router = useRouter();
  const { buildUrl } = useWorkingSession();
  const {
    currentCampaign,
    npcsForCurrent,
    factionsForCurrent,
    entitiesForCurrent,
    createEntity,
    updateEntity,
  } = useDmContext();

  const locations = React.useMemo(
    () =>
      entitiesForCurrent.filter(
        (entity): entity is LocationEntity => entity.kind === "location"
      ),
    [entitiesForCurrent]
  );

  const [activeTab, setActiveTab] = React.useState<RosterTab>("npc");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterImportance, setFilterImportance] = React.useState<
    NpcEntity["importance"] | "all"
  >("all");
  const [filterFaction, setFilterFaction] = React.useState<string | "all">("all");
  const [filterLocation, setFilterLocation] = React.useState<string | "all">("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const filteredNpcs = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    return npcsForCurrent.filter((npc) => {
      const matchesTerm =
        npc.name.toLowerCase().includes(term) ||
        (npc.summary?.toLowerCase().includes(term) ?? false);
      const matchesImportance =
        filterImportance === "all" || (npc.importance ?? "minor") === filterImportance;
      const matchesFaction =
        filterFaction === "all" || (npc.factionId ?? "") === filterFaction;
      const matchesLocation =
        filterLocation === "all" || (npc.locationId ?? "") === filterLocation;
      return matchesTerm && matchesImportance && matchesFaction && matchesLocation;
    });
  }, [filterFaction, filterImportance, filterLocation, npcsForCurrent, searchTerm]);

  const filteredFactions = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    return factionsForCurrent.filter(
      (faction) =>
        faction.name.toLowerCase().includes(term) ||
        (faction.summary?.toLowerCase().includes(term) ?? false)
    );
  }, [factionsForCurrent, searchTerm]);

  React.useEffect(() => {
    const list =
      activeTab === "npc" ? filteredNpcs : filteredFactions;
    if (list.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !list.some((entity) => entity.id === selectedId)) {
      setSelectedId(list[0].id);
    }
  }, [activeTab, filteredNpcs, filteredFactions, selectedId]);

  React.useEffect(() => {
    const { entityId } = router.query;
    if (!entityId || typeof entityId !== "string") return;
    const npcMatch = npcsForCurrent.find((npc) => npc.id === entityId);
    if (npcMatch) {
      setActiveTab("npc");
      setSelectedId(npcMatch.id);
      return;
    }
    const factionMatch = factionsForCurrent.find((faction) => faction.id === entityId);
    if (factionMatch) {
      setActiveTab("faction");
      setSelectedId(factionMatch.id);
    }
  }, [router.query.entityId, npcsForCurrent, factionsForCurrent]);

  const selectedEntity =
    activeTab === "npc"
      ? filteredNpcs.find((npc) => npc.id === selectedId) ?? null
      : filteredFactions.find((faction) => faction.id === selectedId) ?? null;

  const handleCreateEntity = (kind: RosterTab) => {
    const name =
      kind === "npc"
        ? `New NPC ${npcsForCurrent.length + 1}`
        : `New Faction ${factionsForCurrent.length + 1}`;
    const created = createEntity(
      kind === "npc" ? "npc" : "faction",
      name,
      kind === "npc" ? emptyNpc : emptyFaction
    );
    if (created) {
      setActiveTab(kind);
      setSelectedId(created.id);
      setSearchTerm("");
    }
  };

  const handleNpcChange = <K extends keyof NpcEntity>(
    field: K,
    value: NpcEntity[K]
  ) => {
    if (!selectedEntity || selectedEntity.kind !== "npc") return;
    updateEntity(selectedEntity.id, (entity) => {
      if (entity.kind !== "npc") return entity;
      return {
        ...entity,
        [field]: value,
      };
    });
  };

  const handleFactionChange = <K extends keyof FactionEntity>(
    field: K,
    value: FactionEntity[K]
  ) => {
    if (!selectedEntity || selectedEntity.kind !== "faction") return;
    updateEntity(selectedEntity.id, (entity) => {
      if (entity.kind !== "faction") return entity;
      return {
        ...entity,
        [field]: value,
      };
    });
  };

  if (!currentCampaign) {
    return null;
  }

  return (
    <DmLayout title="NPCs & Factions" activePage="roster">
      <div className="page">
        <div className="page__body">
          {/* Left sidebar: list */}
          <div className="page__sidebar">
            <div className="card">
              <div className="card__header">
                <div>
                  <h3 className="card__title">
                    {activeTab === "npc" ? "NPCs" : "Factions"}
                  </h3>
                </div>
              </div>
              <div className="card__body gap-sm">
                <input
                  type="search"
                  className="input input--sm"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {activeTab === "npc" && (
                  <div className="flex flex-col gap-sm">
                    <label className="label">
                      Importance
                      <select
                        className="select"
                        value={filterImportance}
                        onChange={(event) =>
                          setFilterImportance(event.target.value as typeof filterImportance)
                        }
                      >
                        <option value="all">All</option>
                        <option value="major">Major</option>
                        <option value="supporting">Supporting</option>
                        <option value="minor">Minor</option>
                      </select>
                    </label>
                    <label className="label">
                      Faction
                      <select
                        className="select"
                        value={filterFaction}
                        onChange={(event) =>
                          setFilterFaction(
                            event.target.value === "all" ? "all" : event.target.value
                          )
                        }
                      >
                        <option value="all">All</option>
                        {factionsForCurrent.map((faction) => (
                          <option key={faction.id} value={faction.id}>
                            {faction.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="label">
                      Location
                      <select
                        className="select"
                        value={filterLocation}
                        onChange={(event) =>
                          setFilterLocation(
                            event.target.value === "all" ? "all" : event.target.value
                          )
                        }
                      >
                        <option value="all">All</option>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => handleCreateEntity(activeTab)}
                >
                  New {activeTab === "npc" ? "NPC" : "Faction"}
                </button>
              </div>
              <div className="flex gap-xs mb-sm">
                <button
                  type="button"
                  className={`btn btn--sm ${activeTab === "npc" ? "btn--primary" : "btn--ghost"}`}
                  onClick={() => setActiveTab("npc")}
                >
                  NPCs ({npcsForCurrent.length})
                </button>
                <button
                  type="button"
                  className={`btn btn--sm ${activeTab === "faction" ? "btn--primary" : "btn--ghost"}`}
                  onClick={() => setActiveTab("faction")}
                >
                  Factions ({factionsForCurrent.length})
                </button>
              </div>
              <ul className="list">
                {(activeTab === "npc" ? filteredNpcs : filteredFactions).map(
                  (entity) => (
                    <li key={entity.id}>
                      <button
                        type="button"
                        className={`list-item list-item--interactive${
                          entity.id === selectedId ? " is-active" : ""
                        }`}
                        onClick={() => setSelectedId(entity.id)}
                      >
                        <div className="flex-1">
                          <strong>{entity.name}</strong>
                          {entity.summary && <small className="block text-xs text-muted">{entity.summary}</small>}
                        </div>
                        <div className="flex gap-xs">
                          {entity.kind === "npc" && (
                            <>
                              <span className="badge badge--muted text-xs">
                                {entity.importance ?? "minor"}
                              </span>
                              {entity.factionId && (
                                <span className="badge badge--muted text-xs">
                                  Faction
                                </span>
                              )}
                              {entity.locationId && (
                                <span className="badge badge--muted text-xs">
                                  Location
                                </span>
                              )}
                            </>
                          )}
                          {entity.kind === "faction" && (
                            <>
                              <span className="badge badge--muted text-xs">
                                {entity.scope ?? "local"}
                              </span>
                              <span className="badge badge--muted text-xs">
                                {entity.attitude ?? "neutral"}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                )}
                {((activeTab === "npc" && filteredNpcs.length === 0) ||
                  (activeTab === "faction" && filteredFactions.length === 0)) && (
                  <li className="text-center text-muted">No results.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Right main: detail */}
          <div className="page__main">
            {selectedEntity ? (
              selectedEntity.kind === "npc" ? (
                <div className="card">
                  <div className="card__header">
                    <h3 className="card__title">{selectedEntity.name}</h3>
                  </div>
                  <div className="card__body gap-md">
                    <label className="label">
                      Visibility
                      <select
                        className="select"
                        value={selectedEntity.visibility ?? "dmOnly"}
                        onChange={(event) =>
                          handleNpcChange(
                            "visibility",
                            event.target.value as NpcEntity["visibility"]
                          )
                        }
                      >
                        <option value="dmOnly">DM Only</option>
                        <option value="player">Player Visible</option>
                      </select>
                    </label>
                    <label className="label">
                      Role / Title
                      <input
                        type="text"
                        className="input"
                        value={selectedEntity.role ?? ""}
                        onChange={(event) =>
                          handleNpcChange("role", event.target.value)
                        }
                      />
                    </label>
                    <label className="label">
                      Summary
                      <textarea
                        rows={4}
                        className="field-textarea"
                        value={selectedEntity.summary ?? ""}
                        onChange={(event) =>
                          handleNpcChange("summary", event.target.value)
                        }
                      />
                    </label>
                    <div className="dm-roster__field-grid">
                      <label className="label">
                        Sex
                        <select
                          className="select"
                          value={selectedEntity.sex ?? "none"}
                          onChange={(event) =>
                            handleNpcChange(
                              "sex",
                              event.target.value as NpcEntity["sex"]
                            )
                          }
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="none">None</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label className="label">
                        Importance
                        <select
                          className="select"
                          value={selectedEntity.importance ?? "minor"}
                          onChange={(event) =>
                            handleNpcChange(
                              "importance",
                              event.target.value as NpcEntity["importance"]
                            )
                          }
                        >
                          <option value="minor">Minor</option>
                          <option value="supporting">Supporting</option>
                          <option value="major">Major</option>
                        </select>
                      </label>
                    </div>
                    <div className="dm-roster__field-grid">
                      <label className="label">
                        Location
                        <select
                          className="select"
                          value={selectedEntity.locationId ?? ""}
                          onChange={(event) =>
                            handleNpcChange(
                              "locationId",
                              event.target.value || null
                            )
                          }
                        >
                          <option value="">Unassigned</option>
                          {locations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="label">
                        Faction
                        <select
                          className="select"
                          value={selectedEntity.factionId ?? ""}
                          onChange={(event) =>
                            handleNpcChange(
                              "factionId",
                              event.target.value || null
                            )
                          }
                        >
                          <option value="">Unaffiliated</option>
                          {factionsForCurrent.map((faction) => (
                            <option key={faction.id} value={faction.id}>
                              {faction.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="label">
                      SRD Reference
                      <select
                        className="select"
                        value={selectedEntity.srdMonsterId ?? ""}
                        onChange={(event) =>
                          handleNpcChange(
                            "srdMonsterId",
                            event.target.value ? event.target.value : null
                          )
                        }
                      >
                        <option value="">None</option>
                        {SRD_MONSTER_SUMMARIES.slice(0, 200).map((monster) => (
                          <option key={monster.id} value={monster.id}>
                            {monster.name} (CR {monster.cr})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div className="card__header">
                    <h3 className="card__title">{selectedEntity.name}</h3>
                  </div>
                  <div className="card__body gap-md">
                    <header className="flex gap-sm items-center">
                      <input
                        type="text"
                        className="input"
                        value={selectedEntity.name}
                        onChange={(event) =>
                          handleFactionChange("name", event.target.value)
                        }
                      />
                      <select
                        className="select"
                        value={selectedEntity.visibility ?? "dmOnly"}
                        onChange={(event) =>
                          handleFactionChange(
                            "visibility",
                            event.target.value as FactionEntity["visibility"]
                          )
                        }
                      >
                        <option value="dmOnly">DM Only</option>
                        <option value="player">Player Visible</option>
                      </select>
                    </header>
                    <label className="label">
                      Summary
                      <textarea
                        rows={4}
                        className="field-textarea"
                        value={selectedEntity.summary ?? ""}
                        onChange={(event) =>
                          handleFactionChange("summary", event.target.value)
                        }
                      />
                    </label>
                    <div className="dm-roster__field-grid">
                      <label className="label">
                        Scope
                        <select
                          className="select"
                          value={selectedEntity.scope ?? "local"}
                          onChange={(event) =>
                            handleFactionChange(
                              "scope",
                              event.target.value as FactionEntity["scope"]
                            )
                          }
                        >
                          <option value="local">Local</option>
                          <option value="regional">Regional</option>
                          <option value="global">Global</option>
                        </select>
                      </label>
                      <label className="label">
                        Attitude
                        <select
                          className="select"
                          value={selectedEntity.attitude ?? "neutral"}
                          onChange={(event) =>
                            handleFactionChange(
                              "attitude",
                              event.target.value as FactionEntity["attitude"]
                            )
                          }
                        >
                          <option value="ally">Ally</option>
                          <option value="neutral">Neutral</option>
                          <option value="hostile">Hostile</option>
                        </select>
                      </label>
                    </div>
                    <label className="label">
                      Alignment / Ideals
                      <input
                        type="text"
                        className="input"
                        value={selectedEntity.alignment ?? ""}
                        onChange={(event) =>
                          handleFactionChange("alignment", event.target.value)
                        }
                      />
                    </label>
                    <label className="label">
                      Base of Operations
                      <select
                        className="select"
                        value={selectedEntity.baseLocationId ?? ""}
                        onChange={(event) =>
                          handleFactionChange(
                            "baseLocationId",
                            event.target.value || null
                          )
                        }
                      >
                        <option value="">Unassigned</option>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )
            ) : (
              <div className="dm-roster__detail dm-roster__detail--empty">
                <p>
                  {activeTab === "npc"
                    ? "Select an NPC to view details."
                    : "Select a faction to view details."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DmLayout>
  );
};

export default DmRosterPage;
