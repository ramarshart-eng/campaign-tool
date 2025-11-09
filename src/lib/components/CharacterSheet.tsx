import React, { useState } from "react";
import type { Character } from "@/lib/types/Character";
import type { Item } from "@/lib/types/Item";
import { abilityMod, computeAbilityMods } from "@/lib/rules/computeModifiers";
import { rollDice } from "@/lib/rules/rollDice";
import type { AdvantageState, RollResult } from "@/lib/rules/rollDice";
import type { ActionButton } from "@/lib/types/ActionButton";
import { isConsumable } from "@/lib/utils/itemHelpers";
import Panel from "./Panel";
import { deriveActionsFromCharacter } from "@/lib/utils/deriveActions";

interface CharacterSheetProps {
  character: Character;
  advState: AdvantageState;
  onRoll: (result: RollResult, action: ActionButton) => void;
  onHpChange?: (newHp: number) => void;
}

interface CharacterRollPanelsProps {
  character: Character;
  advState: AdvantageState;
  onRoll: (result: RollResult, action: ActionButton) => void;
}

// Removed FitText; all text uses default size

// Canonical 5e skill list
const SKILL_DEFS: { name: string; ability: keyof Character["abilities"] }[] = [
  { name: "Acrobatics", ability: "DEX" },
  { name: "Animal Handling", ability: "WIS" },
  { name: "Arcana", ability: "INT" },
  { name: "Athletics", ability: "STR" },
  { name: "Deception", ability: "CHA" },
  { name: "History", ability: "INT" },
  { name: "Insight", ability: "WIS" },
  { name: "Intimidation", ability: "CHA" },
  { name: "Investigation", ability: "INT" },
  { name: "Medicine", ability: "WIS" },
  { name: "Nature", ability: "INT" },
  { name: "Perception", ability: "WIS" },
  { name: "Performance", ability: "CHA" },
  { name: "Persuasion", ability: "CHA" },
  { name: "Religion", ability: "INT" },
  { name: "Sleight of Hand", ability: "DEX" },
  { name: "Stealth", ability: "DEX" },
  { name: "Survival", ability: "WIS" },
];

// Styles centralized in globals.css

const GRID_COLS = 4;
const GRID_ROWS = 12;

const CharacterSheet: React.FC<CharacterSheetProps> = ({
  character,
  advState,
  onRoll,
  onHpChange,
}) => {
  const [showInventory, setShowInventory] = useState(false);
  const mods = computeAbilityMods(character.abilities);

  // Helper to build the inventory grid from character inventory
  const buildInventoryGrid = (items: Item[] | undefined): (Item | null)[] => {
    const grid: (Item | null)[] = Array(GRID_COLS * GRID_ROWS).fill(null);
    const source = items ?? [];
    let slotIndex = 0;
    source.forEach((item) => {
      for (let i = 0; i < item.quantity && slotIndex < grid.length; i++) {
        grid[slotIndex] = { ...item, quantity: 1 };
        slotIndex++;
      }
    });
    return grid;
  };

  // Initialize inventory grid - flatten inventory items into individual slots
  const [inventoryGrid, setInventoryGrid] = useState<(Item | null)[]>(() =>
    buildInventoryGrid(character.inventory)
  );

  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    itemIndex: number;
  } | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    item: Item;
    showOnLeft: boolean;
  } | null>(null);

  // Rebuild inventory grid when the character (or their inventory) changes,
  // to avoid stale grids when loading from context/localStorage.
  React.useEffect(() => {
    setInventoryGrid(buildInventoryGrid(character.inventory));
    setDraggedItemIndex(null);
    setContextMenu(null);
    setTooltip(null);
  }, [character.id, character.inventory]);

  // Close context menu when clicking anywhere
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Clicking an ability square = generic ability check, not a save
  const handleAbilityCheckClick = (
    ability: keyof Character["abilities"]
  ): void => {
    const bonus = mods[ability];
    const formula =
      bonus === 0 ? "1d20" : `1d20${bonus >= 0 ? "+" : ""}${bonus}`;

    const action: ActionButton = {
      id: `ability-${ability.toLowerCase()}`,
      label: `${ability} Check`,
      kind: "skill",
      formula,
      advantageAllowed: true,
    };

    const result = rollDice(formula, advState);
    onRoll(result, action);
  };

  const handleDragStart = (index: number) => {
    if (inventoryGrid[index]) {
      setDraggedItemIndex(index);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedItemIndex === null) return;

    const newGrid = [...inventoryGrid];
    // Swap items
    const temp = newGrid[targetIndex];
    newGrid[targetIndex] = newGrid[draggedItemIndex];
    newGrid[draggedItemIndex] = temp;

    setInventoryGrid(newGrid);
    setDraggedItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    if (inventoryGrid[index]) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        itemIndex: index,
      });
    }
  };

  const handleEquipToggle = (index: number) => {
    const newGrid = [...inventoryGrid];
    const item = newGrid[index];
    if (item) {
      newGrid[index] = {
        ...item,
        equipped: !item.equipped,
      };
      setInventoryGrid(newGrid);
    }
    setContextMenu(null);
  };

  const handleDeleteItem = (index: number) => {
    const newGrid = [...inventoryGrid];
    newGrid[index] = null;
    setInventoryGrid(newGrid);
    setContextMenu(null);
  };

  const handleUseItem = (index: number) => {
    // Using an item removes it from inventory
    const newGrid = [...inventoryGrid];
    newGrid[index] = null;
    setInventoryGrid(newGrid);
    setContextMenu(null);

    // TODO: In the future, we could trigger effects here (e.g., healing from potions)
  };

  const handleMouseEnter = (e: React.MouseEvent, item: Item, index: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Calculate which column the item is in (0-3)
    const column = index % GRID_COLS;
    // Show tooltip on left for right two columns (2, 3), on right for left two columns (0, 1)
    const showOnLeft = column >= 2;

    setTooltip({
      x: showOnLeft ? rect.left - 10 : rect.right + 10,
      y: rect.top,
      item,
      showOnLeft,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="h-full">
      {/* styles centralized in globals.css */}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {inventoryGrid[contextMenu.itemIndex]?.equipmentSlot && (
            <button
              type="button"
              onClick={() => handleEquipToggle(contextMenu.itemIndex)}
              className="context-menu__item"
            >
              {inventoryGrid[contextMenu.itemIndex]?.equipped ? "Unequip" : "Equip"}
            </button>
          )}
          {inventoryGrid[contextMenu.itemIndex] && isConsumable(inventoryGrid[contextMenu.itemIndex]!) && (
            <button
              type="button"
              onClick={() => handleUseItem(contextMenu.itemIndex)}
              className="context-menu__item"
            >
              Use
            </button>
          )}
          <button
            type="button"
            onClick={() => handleDeleteItem(contextMenu.itemIndex)}
            className="context-menu__item"
          >
            Delete
          </button>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="tooltip"
          style={{
            left: tooltip.showOnLeft ? undefined : tooltip.x,
            right: tooltip.showOnLeft ? `calc(100vw - ${tooltip.x}px)` : undefined,
            top: tooltip.y,
          }}
        >
          <div className=" mb-1">{tooltip.item.name}</div>
          {tooltip.item.category && (
            <div className=" mb-2">{tooltip.item.category}</div>
          )}
          {tooltip.item.description && (
            <div className="mb-2">{tooltip.item.description}</div>
          )}
          <div className=" space-y-0.5">
            {tooltip.item.weight !== undefined && (
              <div>Weight: {tooltip.item.weight} lb</div>
            )}
            {tooltip.item.equipmentSlot && (
              <div>Slot: {tooltip.item.equipmentSlot}</div>
            )}
            {tooltip.item.equipped && (
              <div className="">Equipped</div>
            )}
            {isConsumable(tooltip.item) && (
              <div className="">Consumable</div>
            )}
          </div>
        </div>
      )}

      {/* Character panel */}
      <Panel title="" collapsible={false}>
        {/* Wrapper */}
        <div className="flex flex-col h-full">
          {/* Top row: AC, Character Info, HP */}
          <div className="flex gap-2 mb-3">
            {/* AC & PROF */}
            <div className="stat-card">
              <span className="mb-2">AC</span>
              <span className=" mb-3">
                {character.armorClass}
              </span>
              <span className="mb-2">PROF</span>
              <span className="">
                {character.proficiencyBonus >= 0 ? "+" : ""}
                {character.proficiencyBonus}
              </span>
            </div>

            {/* Character Name / Level / Class */}
            <div className="stat-card flex-1">
              <span className=" mb-1">{character.level}</span>
              <span className=" mb-1">{character.name}</span>
              {character.raceName && (
                <span >{character.raceName}</span>
              )}
              <span >{character.className}</span>
            </div>

            {/* HP */}
            <div className="stat-card">
              <span className="mb-2">HP</span>
              <span className=" mb-2">
                {character.currentHp}/{character.maxHp}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn-frame btn-frame--sm"
                  onClick={() =>
                    onHpChange &&
                    onHpChange(Math.max(0, character.currentHp - 1))
                  }
                >
                  -
                </button>
                <button
                  type="button"
                  className="btn-frame btn-frame--sm"
                  onClick={() =>
                    onHpChange &&
                    onHpChange(
                      Math.min(character.maxHp, character.currentHp + 1)
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Inventory Toggle Button */}
          <button
            type="button"
            onClick={() => setShowInventory(!showInventory)}
            className="w-full btn-frame mb-3"
            
            
          >
            Inventory {showInventory ? "Hide" : "Show"}
          </button>

          {/* Portrait / Inventory area */}
          <div className="mb-3 flex-1 w-full frame overflow-hidden relative">
            {!showInventory ? (
              <div className="flex items-center justify-center h-full">
                Character portrait area
              </div>
            ) : (
              <div className="absolute inset-0 overflow-y-auto no-scrollbar p-2">
                <div
                  className="grid w-full h-full box-border gap-0 border-l border-t border-dotted border-black"
                  style={{
                    gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${GRID_ROWS}, 60px)`,
                  }}
                >
                  {inventoryGrid.map((item, index) => (
                    <div
                      key={index}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(index)}
                      className="border-r border-b border-dotted border-black p-1 box-border"
                    >
                      {item ? (
                        <div
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragEnd={handleDragEnd}
                          onContextMenu={(e) => handleContextMenu(e, index)}
                          onMouseEnter={(e) => handleMouseEnter(e, item, index)}
                          onMouseLeave={handleMouseLeave}
                          className={`h-full w-full border-2 box-border flex items-center justify-center cursor-move px-1 relative ${
                            draggedItemIndex === index ? "opacity-50" : ""
                          } ${
                            item.equipped
                              ? "border-green-600 bg-green-50"
                              : "border-black bg-white"
                          }`}
                        >
                          <span className="line-clamp-2 ">
                            {item.name}
                          </span>
                          {item.equipped && (
                            <span className="absolute top-0 right-0  p-0.5">
                              âœ“
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="h-full w-full" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Grid: 6 ability squares (scores + mods) */}
          <div className="grid grid-cols-3 gap-2">
            {/* Abilities: show scores + mods, click to roll ability checks */}
            {(
              Object.entries(character.abilities) as Array<
                [keyof Character["abilities"], number]
              >
            ).map(([ability, score]) => {
              const mod = mods[ability];
              const diceText =
                mod === 0 ? "1d20" : `1d20${mod >= 0 ? "+" : ""}${mod}`;
              return (
                <button
                  key={ability}
                  type="button"
                  onClick={() => handleAbilityCheckClick(ability)}
                  className="dice-btn px-2 py-1"
                >
                  <span className="btn-default column">
                    <span>{ability}</span>
                    <span className=" mt-0.5">
                      {mod >= 0 ? "+" : ""}
                      {mod}
                    </span>
                    <span className="mt-0.5">{score}</span>
                  </span>

                  <span className="btn-dice">
                    {diceText}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
};

// Skills panel for right-hand column (full list)
export const SkillsPanel: React.FC<CharacterRollPanelsProps> = ({
  character,
  advState,
  onRoll,
}) => {
  const skillButtons: ActionButton[] = SKILL_DEFS.map((skill) => {
    const skillDef = character.skills[skill.name];
    const proficient = skillDef?.proficient ?? false;
    const abilityScore = character.abilities[skill.ability];
    const abilityBonus = abilityMod(abilityScore);
    const totalBonus =
      abilityBonus + (proficient ? character.proficiencyBonus : 0);
    const formula =
      totalBonus === 0
        ? "1d20"
        : `1d20${totalBonus >= 0 ? "+" : ""}${totalBonus}`;

    return {
      id: `skill-${skill.name.toLowerCase().replace(/\s+/g, "-")}`,
      label: skill.name,
      kind: "skill",
      formula,
      advantageAllowed: true,
    };
  });

  return (
    <Panel title="Skills">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {skillButtons.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              const result = rollDice(action.formula, advState);
              onRoll(result, action);
            }}
            className="dice-btn px-2 py-1"
          >
            <span className="btn-default flex justify-between items-center w-full">
              <span>{action.label}</span>
              <span className="">
                {(() => {
                  const match = action.formula.match(/[+-]\d+$/)?.[0];
                  return match || "+0";
                })()}
              </span>
            </span>
            <span className="btn-dice">
              {action.formula}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
};

export const SavingThrowsPanel: React.FC<CharacterRollPanelsProps> = ({
  character,
  advState,
  onRoll,
}) => {
  const abilities: (keyof Character["abilities"])[] = [
    "STR",
    "DEX",
    "CON",
    "INT",
    "WIS",
    "CHA",
  ];

  const saveButtons: ActionButton[] = abilities.map((ability) => {
    const baseMod = abilityMod(character.abilities[ability]);
    const proficient = character.savingThrows[ability]?.proficient ?? false;
    const bonus = baseMod + (proficient ? character.proficiencyBonus : 0);
    const formula =
      bonus === 0 ? "1d20" : `1d20${bonus >= 0 ? "+" : ""}${bonus}`;

    return {
      id: `save-${ability.toLowerCase()}`,
      label: `${ability} Save`,
      kind: "save",
      formula,
      advantageAllowed: true,
    };
  });

  return (
    <Panel title="Saving Throws">
      <div className="grid grid-cols-2 gap-1">
        {saveButtons.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              const result = rollDice(action.formula, advState);
              onRoll(result, action);
            }}
            className="dice-btn px-2 py-1"
          >
            <span className="btn-default flex justify-between items-center w-full">
              <span>{action.label}</span>
              <span className="">
                {(() => {
                  const match = action.formula.match(/[+-]\d+$/)?.[0];
                  return match || "+0";
                })()}
              </span>
            </span>
            <span className="btn-dice">
              {action.formula}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
};

// Actions panel as bottom hotbar (used in overlay) with tabs for Actions / Spells
export const ActionsPanel: React.FC<CharacterRollPanelsProps> = ({
  character,
  advState,
  onRoll,
}) => {
  const [activeTab, setActiveTab] = React.useState<"actions" | "spells" | "cantrips">(
    "actions"
  );

  const manualActions = character.actions ?? [];
  const derivedActions = deriveActionsFromCharacter(character);
  const baseActions = mergeActions(manualActions, derivedActions);
  const actionButtons = baseActions.filter((a) => a.kind !== "spell" && a.kind !== "cantrip");
  const spellButtons = baseActions.filter((a) => a.kind === "spell");
  const cantripButtons = baseActions.filter((a) => a.kind === "cantrip");

  const currentList =
    activeTab === "actions" ? actionButtons : activeTab === "spells" ? spellButtons : cantripButtons;

  return (
    <div className="relative pt-8">
      {/* Tabs overlaid above hotbar, styled like PlayArea */}
      <div className="tab-bar hotbar-tabs-overlay">
        <button
          type="button"
          onClick={() => setActiveTab("actions")}
          className={`tab-btn ${activeTab === "actions" ? "is-active" : ""}`}
        >
          <span className="tab-label">Actions</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("spells")}
          className={`tab-btn ${activeTab === "spells" ? "is-active" : ""}`}
        >
          <span className="tab-label">Spells</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("cantrips")}
          className={`tab-btn ${activeTab === "cantrips" ? "is-active" : ""}`}
        >
          <span className="tab-label">Cantrips</span>
        </button>
      </div>

      {/* Hotbar buttons */}
      <div className="flex flex-row flex-wrap items-center justify-center gap-2 px-3 pb-2 pt-4">
        {currentList.length === 0 ? (
          <span>
            No {activeTab === "actions" ? "actions" : "spells"} configured.
          </span>
        ) : (
          currentList.map((action) => {
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  const result = rollDice(action.formula, advState);
                  onRoll(result, action);
                }}
                className="dice-btn w-20 h-20 px-2 py-1"
              >
                <span className="btn-default column">
                  <span>{action.label}</span>
                  <span className="">
                    {(() => {
                      const m = action.formula.match(/[+\-]?\d+$/)?.[0] ?? "";
                      return m.startsWith("+") || m.startsWith("-")
                        ? m
                        : `+${m}`;
                    })()}
                  </span>
                </span>

                <span className="btn-dice">
                  {action.formula}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CharacterSheet;

function mergeActions(...lists: ActionButton[][]): ActionButton[] {
  const map = new Map<string, ActionButton>();
  for (const list of lists) {
    for (const action of list) {
      if (!map.has(action.id)) {
        map.set(action.id, action);
      }
    }
  }
  return Array.from(map.values());
}













