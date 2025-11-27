import React from "react";
import type { EncounterEntity, EncounterCombatant } from "@/lib/types/dm";
import { useDmContext } from "@/lib/context/DmContext";

interface EncounterRunPanelProps {
  encounter: EncounterEntity;
  onClose?: () => void;
}

const EncounterRunPanel: React.FC<EncounterRunPanelProps> = ({
  encounter,
  onClose,
}) => {
  const {
    getEncounterRunState,
    startEncounterRun,
    updateEncounterRunState,
    endEncounterRun,
    removeEncounterCombatant,
  } = useDmContext();

  const runState = getEncounterRunState(encounter.id);

  const handleStart = () => {
    startEncounterRun(encounter.id);
  };

  const handleReset = () => {
    startEncounterRun(encounter.id);
  };

  const handleEnd = () => {
    endEncounterRun(encounter.id);
    onClose?.();
  };

  const handleAdvance = (direction: 1 | -1) => {
    updateEncounterRunState(encounter.id, (state) => {
      const max = state.combatants.length;
      if (!max) return state;
      let currentIndex = state.currentIndex;
      let round = state.round;
      let attempts = 0;
      do {
        currentIndex += direction;
        if (currentIndex >= max) {
          currentIndex = 0;
          round += 1;
        } else if (currentIndex < 0) {
          currentIndex = max - 1;
          round = Math.max(1, round - 1);
        }
        attempts += 1;
      } while (
        attempts <= max &&
        state.combatants[currentIndex]?.isDefeated
      );
      return { ...state, currentIndex, round };
    });
  };

  const handleNextRound = () => {
    updateEncounterRunState(encounter.id, (state) => {
      if (!state.combatants.length) return state;
      const nextRound = state.round + 1;
      const firstAlive =
        state.combatants.findIndex((combatant) => !combatant.isDefeated) ?? 0;
      const currentIndex = firstAlive === -1 ? 0 : firstAlive;
      return { ...state, round: nextRound, currentIndex };
    });
  };

  const handleRollInitiative = () => {
    updateEncounterRunState(encounter.id, (state) => {
      const combatants = [...state.combatants].map((combatant) => ({
        ...combatant,
        initiative: Math.floor(Math.random() * 20) + 1,
      }));
      combatants.sort((a, b) => {
        const initA = a.initiative ?? -Infinity;
        const initB = b.initiative ?? -Infinity;
        if (initA === initB) return a.name.localeCompare(b.name);
        return initB - initA;
      });
      return { ...state, combatants, currentIndex: 0, round: 1 };
    });
  };

  const handleSortByInitiative = () => {
    const existing = runState ?? startEncounterRun(encounter.id);
    if (!existing) return;
    updateEncounterRunState(encounter.id, (state) => {
      if (!state.combatants.length) return state;
      const combatants = [...state.combatants].sort((a, b) => {
        const initA = a.initiative ?? -Infinity;
        const initB = b.initiative ?? -Infinity;
        if (initA === initB) return a.name.localeCompare(b.name);
        return initB - initA;
      });
      const nextIndex =
        combatants.findIndex((combatant) => !combatant.isDefeated) !== -1
          ? combatants.findIndex((combatant) => !combatant.isDefeated)
          : 0;
      return { ...state, combatants, currentIndex: nextIndex };
    });
  };

  const adjustHp = (combatantId: string, delta: number) => {
    updateEncounterRunState(encounter.id, (state) => {
      const combatants = state.combatants.map((combatant) => {
        if (combatant.id !== combatantId) return combatant;
        const current = combatant.currentHp ?? combatant.maxHp ?? 0;
        const max = combatant.maxHp ?? Infinity;
        const next = Math.max(0, Math.min(max, current + delta));
        return {
          ...combatant,
          currentHp: next,
          isDefeated: combatant.isDefeated || next <= 0,
        };
      });
      return { ...state, combatants };
    });
  };

  const toggleDefeated = (combatantId: string) => {
    updateEncounterRunState(encounter.id, (state) => {
      const combatants = state.combatants.map((combatant) =>
        combatant.id === combatantId
          ? { ...combatant, isDefeated: !combatant.isDefeated }
          : combatant
      );
      return { ...state, combatants };
    });
  };

  const updateInitiative = (combatantId: string, value: number | null) => {
    updateEncounterRunState(encounter.id, (state) => {
      const combatants = state.combatants.map((combatant) =>
        combatant.id === combatantId
          ? { ...combatant, initiative: value }
          : combatant
      );
      return { ...state, combatants };
    });
  };

  const updateHp = (
    combatantId: string,
    field: "currentHp" | "maxHp",
    value: number | null
  ) => {
    updateEncounterRunState(encounter.id, (state) => {
      const combatants = state.combatants.map((combatant) =>
        combatant.id === combatantId
          ? {
              ...combatant,
              [field]: value,
              currentHp:
                field === "maxHp" && value != null && combatant.currentHp == null
                  ? value
                  : combatant.currentHp,
            }
          : combatant
      );
      return { ...state, combatants };
    });
  };

  if (!runState) {
    return (
      <div className="encounter-run-panel">
        <div className="encounter-run-panel__summary">
          <div>
            <h3>{encounter.name}</h3>
            <p className="encounter-run-panel__muted">
              No run state yet. Start the encounter to track initiative.
            </p>
          </div>
          <div className="encounter-run-panel__actions">
            <button type="button" className="btn-primary" onClick={handleStart}>
              Start Encounter
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeCombatant =
    runState.combatants[runState.currentIndex] ?? undefined;

  return (
    <div className="encounter-run-panel">
      <div className="encounter-run-panel__summary">
        <div className="encounter-run-panel__title-line">
          <h3>{encounter.name}</h3>
          <span className="encounter-run-panel__muted">
            Round {runState.round}
            {activeCombatant ? ` • Active: ${activeCombatant.name}` : ""}
          </span>
        </div>
        <div className="encounter-run-panel__actions">
          <button type="button" className="btn-primary" onClick={() => handleAdvance(1)}>
            Next turn
          </button>
          <button type="button" className="btn-primary" onClick={handleNextRound}>
            Next round
          </button>
          <button type="button" className="btn-primary" onClick={handleReset}>
            Restart
          </button>
          <button type="button" className="btn-primary" onClick={handleEnd}>
            End
          </button>
        </div>
      </div>

      <div className="encounter-run-panel__grid encounter-run-panel__grid--single">
        <div className="encounter-run-panel__col encounter-run-panel__col--center">
          <div className="encounter-run-panel__card encounter-run-panel__card--fill">
            <div className="encounter-run-panel__card-header">
              <h4>Combatants</h4>
              <small>Edit HP, initiative, and status</small>
            </div>
            <div className="encounter-run-panel__list">
              {runState.combatants.length === 0 ? (
                <p className="encounter-run-panel__muted">
                  No combatants yet. Add creatures to the encounter to seed them.
                </p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Init</th>
                      <th>HP</th>
                      <th>Status</th>
                      <th>Adjust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runState.combatants.map((combatant, index) => (
                      <tr
                        key={combatant.id}
                        className={
                          index === runState.currentIndex
                            ? "is-active"
                            : combatant.isDefeated
                            ? "is-defeated"
                            : undefined
                        }
                      >
                        <td>
                          <div className="encounter-run-panel__name">
                            <span>{combatant.name}</span>
                            {combatant.kind !== "monster" && (
                              <span className="encounter-run-panel__tag">
                                {combatant.kind}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="encounter-run-panel__init-input"
                            value={combatant.initiative ?? ""}
                            onChange={(e) =>
                              updateInitiative(
                                combatant.id,
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value)
                              )
                            }
                          />
                        </td>
                        <td>
                          <div className="encounter-run-panel__hp-inputs">
                            <input
                              type="number"
                              value={combatant.currentHp ?? ""}
                              onChange={(e) =>
                                updateHp(
                                  combatant.id,
                                  "currentHp",
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value)
                                )
                              }
                            />
                            <span>/</span>
                            <input
                              type="number"
                              value={combatant.maxHp ?? ""}
                              placeholder="max"
                              onChange={(e) =>
                                updateHp(
                                  combatant.id,
                                  "maxHp",
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value)
                                )
                              }
                            />
                          </div>
                        </td>
                        <td className="encounter-run-panel__status-cell">
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => toggleDefeated(combatant.id)}
                          >
                            {combatant.isDefeated ? "Revive" : "Defeat"}
                          </button>
                          {combatant.kind !== "monster" && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() =>
                                removeEncounterCombatant(encounter.id, combatant.id)
                              }
                            >
                              Remove
                            </button>
                          )}
                        </td>
                        <td>
                          <div className="encounter-run-panel__hp-buttons">
                            <button
                              type="button"
                              onClick={() => adjustHp(combatant.id, -5)}
                            >
                              -5
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustHp(combatant.id, -1)}
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustHp(combatant.id, 1)}
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustHp(combatant.id, 5)}
                            >
                              +5
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

       
      </div>
    </div>
  );
};

export default EncounterRunPanel;

