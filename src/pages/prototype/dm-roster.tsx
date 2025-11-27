import React from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import DmLayout from "@/lib/components/layout/DmLayout";
import { useDmContext } from "@/lib/context/DmContext";
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
      <div className="dm-roster dm-roster--grid">
        <section className="dm-roster__column dm-roster__column--list dm-panel">
          <header className="dm-roster__header">
            <div>
              <p className="dm-roster__eyebrow">Campaign</p>
              <h1>{currentCampaign.name}</h1>
            </div>
            <div className="dm-roster__tabs">
            <button
              type="button"
              className={activeTab === "npc" ? "is-active" : ""}
              onClick={() => setActiveTab("npc")}
            >
              NPCs ({npcsForCurrent.length})
            </button>
            <button
              type="button"
              className={activeTab === "faction" ? "is-active" : ""}
              onClick={() => setActiveTab("faction")}
            >
              Factions ({factionsForCurrent.length})
            </button>
            </div>
          </header>
          <div className="dm-roster__controls">
            <input
              type="search"
              className="field-input field-input--compact"
              placeholder="Search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {activeTab === "npc" && (
              <div className="dm-roster__filters">
                <label className="field-label">
                  Importance
                  <select
                    className="field-select field-select--compact"
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
                <label className="field-label">
                  Faction
                  <select
                    className="field-select field-select--compact"
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
                <label className="field-label">
                  Location
                  <select
                    className="field-select field-select--compact"
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
              className="btn-primary"
              onClick={() => handleCreateEntity(activeTab)}
            >
              New {activeTab === "npc" ? "NPC" : "Faction"}
            </button>
          </div>
          <ul className="dm-roster__list dm-list-reset">
            {(activeTab === "npc" ? filteredNpcs : filteredFactions).map(
              (entity) => (
                <li key={entity.id}>
                  <button
                    type="button"
                    className={`dm-roster__list-item${
                      entity.id === selectedId ? " is-active" : ""
                    }`}
                    onClick={() => setSelectedId(entity.id)}
                  >
                    <strong>{entity.name}</strong>
                    {entity.summary && <small>{entity.summary}</small>}
                    {entity.kind === "npc" && (
                      <div className="dm-roster__list-meta">
                        <span className="dm-roster__badge">
                          {entity.importance ?? "minor"}
                        </span>
                        {entity.factionId && (
                          <span className="dm-roster__badge dm-roster__badge--muted">
                            Faction
                          </span>
                        )}
                        {entity.locationId && (
                          <span className="dm-roster__badge dm-roster__badge--muted">
                            Location
                          </span>
                        )}
                      </div>
                    )}
                    {entity.kind === "faction" && (
                      <div className="dm-roster__list-meta">
                        <span className="dm-roster__badge">
                          {entity.scope ?? "local"}
                        </span>
                        <span className="dm-roster__badge dm-roster__badge--muted">
                          {entity.attitude ?? "neutral"}
                        </span>
                      </div>
                    )}
                  </button>
                </li>
              )
            )}
            {((activeTab === "npc" && filteredNpcs.length === 0) ||
              (activeTab === "faction" && filteredFactions.length === 0)) && (
              <li className="dm-roster__empty">No results.</li>
            )}
          </ul>
        </section>

        <section className="dm-roster__column dm-roster__column--detail">
          <div className="dm-panel dm-panel--detail">
          {selectedEntity ? (
            selectedEntity.kind === "npc" ? (
              <div className="dm-roster__detail">
                <header className="dm-roster__detail-header">
                  <input
                    type="text"
                    className="field-input"
                    value={selectedEntity.name}
                    onChange={(event) =>
                      handleNpcChange("name", event.target.value)
                    }
                  />
                  <select
                    className="field-select"
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
                </header>
                <label className="field-label">
                  Role / Title
                  <input
                    type="text"
                    className="field-input"
                    value={selectedEntity.role ?? ""}
                    onChange={(event) =>
                      handleNpcChange("role", event.target.value)
                    }
                  />
                </label>
                <label className="field-label">
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
                  <label className="field-label">
                    Sex
                    <select
                      className="field-select"
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
                  <label className="field-label">
                    Importance
                    <select
                      className="field-select"
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
                  <label className="field-label">
                    Location
                    <select
                      className="field-select"
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
                  <label className="field-label">
                    Faction
                    <select
                      className="field-select"
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
                <label className="field-label">
                  SRD Reference
                  <select
                    className="field-select"
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
            ) : (
              <div className="dm-roster__detail">
                <header>
                  <input
                    type="text"
                    className="field-input"
                    value={selectedEntity.name}
                    onChange={(event) =>
                      handleFactionChange("name", event.target.value)
                    }
                  />
                  <select
                    className="field-select"
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
                <label className="field-label">
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
                  <label className="field-label">
                    Scope
                    <select
                      className="field-select"
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
                  <label className="field-label">
                    Attitude
                    <select
                      className="field-select"
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
                <label className="field-label">
                  Alignment / Ideals
                  <input
                    type="text"
                    className="field-input"
                    value={selectedEntity.alignment ?? ""}
                    onChange={(event) =>
                      handleFactionChange("alignment", event.target.value)
                    }
                  />
                </label>
                <label className="field-label">
                  Base of Operations
                  <select
                    className="field-select"
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
        </section>

        <section className="dm-roster__column dm-roster__column--context">
          <div className="dm-panel dm-panel--context">
            <header>
              <h2>Context</h2>
              <p>
                Linked notes and encounters will appear here as this feature
                expands.
              </p>
            </header>
            <div className="dm-roster__context-empty">
              <p>More tools coming soon.</p>
            </div>
          </div>
        </section>
      </div>
    </DmLayout>
  );
};

export default DmRosterPage;
