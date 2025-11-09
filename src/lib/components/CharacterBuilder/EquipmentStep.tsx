/**
 * Step 6: Equipment Selection
 */

import React, { useState } from "react";
import type { CharacterBuilderState } from "./CharacterBuilder";
import type { Item } from "@/lib/types/Item";

interface EquipmentStepProps {
  state: CharacterBuilderState;
  updateState: (updates: Partial<CharacterBuilderState>) => void;
  onNext: () => void;
  onPrevious: () => void;
}

// Basic starting equipment based on class
const CLASS_STARTING_EQUIPMENT: Record<string, Item[]> = {
  barbarian: [
    { id: "greataxe", name: "Greataxe", description: "2d12 slashing", quantity: 1, weight: 7, equipped: true, equipmentSlot: "mainHand", category: "Weapon" },
    { id: "javelin", name: "Javelin (4)", description: "1d6 piercing", quantity: 4, weight: 2, category: "Weapon" },
    { id: "explorers-pack", name: "Explorer's Pack", description: "Adventuring gear", quantity: 1, weight: 59, category: "Kit" },
  ],
  bard: [
    { id: "rapier", name: "Rapier", description: "1d8 piercing", quantity: 1, weight: 2, equipped: true, equipmentSlot: "mainHand", category: "Weapon" },
    { id: "lute", name: "Lute", description: "Musical instrument", quantity: 1, weight: 2, category: "Tools" },
    { id: "leather-armor", name: "Leather Armor", description: "AC 11", quantity: 1, weight: 10, equipped: true, equipmentSlot: "chest", category: "Armor" },
    { id: "dagger", name: "Dagger", description: "1d4 piercing", quantity: 1, weight: 1, category: "Weapon" },
  ],
  cleric: [
    { id: "mace", name: "Mace", description: "1d6 bludgeoning", quantity: 1, weight: 4, equipped: true, equipmentSlot: "mainHand", category: "Weapon" },
    { id: "shield", name: "Shield", description: "+2 AC", quantity: 1, weight: 6, equipped: true, equipmentSlot: "offHand", category: "Armor" },
    { id: "scale-mail", name: "Scale Mail", description: "AC 14", quantity: 1, weight: 45, equipped: true, equipmentSlot: "chest", category: "Armor" },
    { id: "holy-symbol", name: "Holy Symbol", description: "Divine focus", quantity: 1, weight: 1, category: "Wondrous Item" },
  ],
  druid: [
    { id: "quarterstaff", name: "Quarterstaff", description: "1d6 bludgeoning", quantity: 1, weight: 4, equipped: true, equipmentSlot: "mainHand", category: "Weapon" },
    { id: "leather-armor", name: "Leather Armor", description: "AC 11", quantity: 1, weight: 10, equipped: true, equipmentSlot: "chest", category: "Armor" },
    { id: "druidic-focus", name: "Druidic Focus", description: "Nature focus", quantity: 1, weight: 1, category: "Wondrous Item" },
    { id: "explorers-pack", name: "Explorer's Pack", description: "Adventuring gear", quantity: 1, weight: 59, category: "Kit" },
  ],
  fighter: [
    { id: "longsword", name: "Longsword", description: "1d8 slashing", quantity: 1, weight: 3, equipped: true, equipmentSlot: "mainHand", category: "Weapon" },
    { id: "shield", name: "Shield", description: "+2 AC", quantity: 1, weight: 6, equipped: true, equipmentSlot: "offHand", category: "Armor" },
    { id: "chain-mail", name: "Chain Mail", description: "AC 16", quantity: 1, weight: 55, equipped: true, equipmentSlot: "chest", category: "Armor" },
    { id: "handaxe", name: "Handaxe (2)", description: "1d6 slashing", quantity: 2, weight: 2, category: "Weapon" },
  ],
  monk: [
    { id: "shortsword", name: "Shortsword", description: "1d6 piercing", quantity: 1, weight: 2, equipped: true, equipmentSlot: "mainHand", category: "Weapon" },
    { id: "dart", name: "Dart (10)", description: "1d4 piercing", quantity: 10, weight: 0.25, category: "Ammunition" },
    { id: "explorers-pack", name: "Explorer's Pack", description: "Adventuring gear", quantity: 1, weight: 59, category: "Kit" },
  ],
  paladin: [
    { id: "longsword", name: "Longsword", description: "1d8 slashing", quantity: 1, weight: 3, equipped: true, equipmentSlot: "mainHand", category: "Weapon" },
    { id: "shield", name: "Shield", description: "+2 AC", quantity: 1, weight: 6, equipped: true, equipmentSlot: "offHand", category: "Armor" },
    { id: "chain-mail", name: "Chain Mail", description: "AC 16", quantity: 1, weight: 55, equipped: true, equipmentSlot: "chest", category: "Armor" },
    { id: "holy-symbol", name: "Holy Symbol", description: "Divine focus", quantity: 1, weight: 1, category: "Wondrous Item" },
  ],
  ranger: [
    { id: "longbow", name: "Longbow", description: "1d8 piercing", quantity: 1, weight: 2, equipped: true, equipmentSlot: "mainHand", category: "Weapon" },
    { id: "arrow", name: "Arrows (20)", description: "Ammunition", quantity: 20, weight: 0.05, category: "Ammunition" },
    { id: "shortsword", name: "Shortsword (2)", description: "1d6 piercing", quantity: 2, weight: 2, category: "Weapon" },
    { id: "leather-armor", name: "Leather Armor", description: "AC 11", quantity: 1, weight: 10, equipped: true, equipmentSlot: "chest", category: "Armor" },
  ],
  rogue: [
    { id: "rapier", name: "Rapier", description: "1d8 piercing", quantity: 1, weight: 2, equipped: true, equipmentSlot: "mainHand", category: "Weapon" },
    { id: "shortbow", name: "Shortbow", description: "1d6 piercing", quantity: 1, weight: 2, category: "Weapon" },
    { id: "arrow", name: "Arrows (20)", description: "Ammunition", quantity: 20, weight: 0.05, category: "Ammunition" },
    { id: "leather-armor", name: "Leather Armor", description: "AC 11", quantity: 1, weight: 10, equipped: true, equipmentSlot: "chest", category: "Armor" },
    { id: "thieves-tools", name: "Thieves' Tools", description: "For lockpicking", quantity: 1, weight: 1, category: "Tools" },
  ],
  sorcerer: [
    { id: "dagger", name: "Dagger (2)", description: "1d4 piercing", quantity: 2, weight: 1, category: "Weapon" },
    { id: "arcane-focus", name: "Arcane Focus", description: "Spellcasting focus", quantity: 1, weight: 1, category: "Wondrous Item" },
    { id: "explorers-pack", name: "Explorer's Pack", description: "Adventuring gear", quantity: 1, weight: 59, category: "Kit" },
  ],
  warlock: [
    { id: "dagger", name: "Dagger (2)", description: "1d4 piercing", quantity: 2, weight: 1, category: "Weapon" },
    { id: "arcane-focus", name: "Arcane Focus", description: "Spellcasting focus", quantity: 1, weight: 1, category: "Wondrous Item" },
    { id: "leather-armor", name: "Leather Armor", description: "AC 11", quantity: 1, weight: 10, equipped: true, equipmentSlot: "chest", category: "Armor" },
    { id: "scholars-pack", name: "Scholar's Pack", description: "Academic gear", quantity: 1, weight: 10, category: "Kit" },
  ],
  wizard: [
    { id: "quarterstaff", name: "Quarterstaff", description: "1d6 bludgeoning", quantity: 1, weight: 4, equipped: true, equipmentSlot: "mainHand", category: "Weapon" },
    { id: "spellbook", name: "Spellbook", description: "Contains spells", quantity: 1, weight: 3, category: "Adventuring Gear" },
    { id: "arcane-focus", name: "Arcane Focus", description: "Spellcasting focus", quantity: 1, weight: 1, category: "Wondrous Item" },
    { id: "scholars-pack", name: "Scholar's Pack", description: "Academic gear", quantity: 1, weight: 10, category: "Kit" },
  ],
};

// Common adventuring items
const COMMON_ITEMS: Item[] = [
  { id: "backpack", name: "Backpack", description: "Storage", quantity: 1, weight: 5, category: "Adventuring Gear" },
  { id: "bedroll", name: "Bedroll", description: "For sleeping", quantity: 1, weight: 7, category: "Adventuring Gear" },
  { id: "rope", name: "Hempen Rope (50 ft)", description: "Utility rope", quantity: 1, weight: 10, category: "Adventuring Gear" },
  { id: "rations", name: "Rations (10 days)", description: "Food", quantity: 10, weight: 2, category: "Food" },
  { id: "waterskin", name: "Waterskin", description: "Water container", quantity: 1, weight: 5, category: "Adventuring Gear" },
  { id: "torch", name: "Torch (10)", description: "Light source", quantity: 10, weight: 1, category: "Light Source" },
  { id: "tinderbox", name: "Tinderbox", description: "Fire starter", quantity: 1, weight: 1, category: "Adventuring Gear" },
  { id: "potion-healing", name: "Potion of Healing", description: "Restores 2d4+2 HP", quantity: 2, weight: 0.5, category: "Potion" },
];

const EquipmentStep: React.FC<EquipmentStepProps> = ({
  state,
  updateState,
  onNext,
  onPrevious,
}) => {
  // Get starting equipment for the selected class
  const classEquipment = state.selectedClass
    ? CLASS_STARTING_EQUIPMENT[state.selectedClass.index] || []
    : [];

  const [selectedItems] = useState<Item[]>(() => {
    // Include class equipment and all common items by default (no per-item selection)
    return [...classEquipment, ...COMMON_ITEMS];
  });

  const handleNext = () => {
    updateState({ inventory: selectedItems });
    onNext();
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div>
        <h2 className=" mb-2">Select Your Equipment</h2>
        <p className="text-muted">
          Your class provides starting equipment. You can also add additional common items.
        </p>
      </div>

      {/* Class Equipment */}
      <div>
        <h3 className=" mb-2">
          {state.selectedClass?.name} Starting Equipment
        </h3>
        <div className="frame surface-muted pad-4">
          {classEquipment.length > 0 ? (
            <ul className="space-y-2">
              {classEquipment.map((item) => (
                <li key={item.id} className="flex justify-between items-center">
                  <div>
                    <span className="">{item.name}</span>
                    {item.description && (
                      <span className=" text-muted ml-2">
                        - {item.description}
                      </span>
                    )}
                  </div>
                  {/* quantity already shown in name when applicable (e.g., "(2)") */}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No class equipment available</p>
          )}
        </div>
      </div>

      {/* Additional Common Items (included by default) */}
      <div>
        <h3 className=" mb-2">Additional Adventuring Gear (included)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {COMMON_ITEMS.map((item) => (
            <div key={item.id} className="frame pad-2">
              <div className="">{item.name}</div>
              {item.description && (
                <div className=" text-muted">{item.description}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="frame surface-info pad-4">
        <div className=" mb-2">Selected Items Summary</div>
        <div className="">
          Total Items: {selectedItems.reduce((sum, item) => sum + item.quantity, 0)}
        </div>
      </div>

      <div className="flex justify-between pt-4 mt-auto">
        <button
          type="button"
          onClick={onPrevious}
          className="btn-frame btn-frame--lg"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="btn-frame btn-frame--lg"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default EquipmentStep;


