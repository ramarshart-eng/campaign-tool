import React from "react";
import { SRD_MONSTER_SUMMARIES, SRD_MONSTERS_BY_ID } from "@/lib/data/srdMonsters";

export interface SrdMonsterSearchProps {
  /** Called when a monster is selected */
  onSelectMonster: (monsterId: string) => void;
  /** Called to close the search UI */
  onClose?: () => void;
  /** Show the full detail view (for dm-play style) */
  showDetailView?: boolean;
  /** Custom class for the root container */
  className?: string;
  /** Search input placeholder */
  placeholder?: string;
  /** Max results to show */
  maxResults?: number;
}

/**
 * Shared SRD Monster search component for DM pages.
 * Allows searching and selecting from the SRD monster database.
 */
const SrdMonsterSearch: React.FC<SrdMonsterSearchProps> = ({
  onSelectMonster,
  onClose,
  showDetailView = false,
  className = "",
  placeholder = "Search monsters by name, type, or CR",
  maxResults = 50,
}) => {
  const [query, setQuery] = React.useState("");
  const [selectedMonsterId, setSelectedMonsterId] = React.useState<string | null>(null);

  const filteredMonsters = React.useMemo(() => {
    if (!query.trim()) return SRD_MONSTER_SUMMARIES.slice(0, Math.min(25, maxResults));
    const term = query.toLowerCase();
    return SRD_MONSTER_SUMMARIES.filter(
      (monster) =>
        monster.name.toLowerCase().includes(term) ||
        monster.type.toLowerCase().includes(term) ||
        monster.cr.toLowerCase().includes(term)
    ).slice(0, maxResults);
  }, [query, maxResults]);

  const selectedMonster =
    selectedMonsterId ? SRD_MONSTERS_BY_ID.get(selectedMonsterId) ?? null : null;

  React.useEffect(() => {
    if (!filteredMonsters.length) {
      setSelectedMonsterId(null);
      return;
    }
    if (
      selectedMonsterId &&
      filteredMonsters.some((m) => m.id === selectedMonsterId)
    ) {
      return;
    }
    setSelectedMonsterId(filteredMonsters[0]?.id ?? null);
  }, [filteredMonsters, selectedMonsterId]);

  const handleSelectAndClose = (monsterId: string) => {
    onSelectMonster(monsterId);
    setQuery("");
    setSelectedMonsterId(null);
  };

  if (showDetailView) {
    // dm-play style: list on left, details on right
    return (
      <div className={`srd-monster-search srd-monster-search--detail ${className}`}>
        <div className="srd-monster-search__search">
          <label className="label">
            SRD search
            <input
              type="search"
              className="input input--sm"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
            />
          </label>
          <span className="text-sm text-muted">
            Showing {filteredMonsters.length} of {SRD_MONSTER_SUMMARIES.length}
          </span>
        </div>
        <div className="srd-monster-search__grid">
          <div className="srd-monster-search__list no-scrollbar">
            {filteredMonsters.map((monster) => (
              <button
                key={monster.id}
                type="button"
                className={`srd-monster-search__row${
                  monster.id === selectedMonsterId ? " is-active" : ""
                }`}
                onClick={() => setSelectedMonsterId(monster.id)}
              >
                <div>
                  <strong>{monster.name}</strong>
                  <small>CR {monster.cr}</small>
                </div>
                <span>{monster.type}</span>
              </button>
            ))}
            {filteredMonsters.length === 0 && (
              <p className="srd-monster-search__empty">No monsters found.</p>
            )}
          </div>
          <div className="srd-monster-search__detail">
            {selectedMonster ? (
              <>
                <header>
                  <div>
                    <h5>{selectedMonster.name}</h5>
                    <p>
                      {selectedMonster.size} {selectedMonster.type}
                      {selectedMonster.subtype ? ` (${selectedMonster.subtype})` : ""},{" "}
                      {selectedMonster.alignment || "unaligned"}
                    </p>
                  </div>
                  <div className="srd-monster-search__basics">
                    <span>CR {selectedMonster.challenge_rating}</span>
                    <span>{selectedMonster.armor_class} AC</span>
                    <span>{selectedMonster.hit_points} HP</span>
                  </div>
                </header>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => handleSelectAndClose(selectedMonster.id)}
                >
                  Add to Encounter
                </button>
              </>
            ) : (
              <p className="text-muted">Select a monster to view details</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // dm-encounters style: simple modal/list
  return (
    <div className={`srd-monster-search ${className}`}>
      <div className="srd-monster-search__header">
        <h3>SRD Monsters</h3>
        {onClose && (
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      <input
        type="text"
        className="input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="srd-monster-search__list">
        {filteredMonsters.map((monster) => (
          <button
            type="button"
            key={monster.id}
            className="srd-monster-search__row"
            onClick={() => handleSelectAndClose(monster.id)}
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
          <p className="srd-monster-search__empty">No monsters found.</p>
        )}
      </div>
    </div>
  );
};

export default SrdMonsterSearch;
