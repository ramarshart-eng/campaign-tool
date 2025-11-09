// src/lib/utils/itemHelpers.ts

import type { Item, EquipmentCategory } from "@/lib/types/Item";

/**
 * Categories that represent consumable items
 */
const CONSUMABLE_CATEGORIES: EquipmentCategory[] = [
  "Potion",
  "Scroll",
  "Ammunition",
  "Food",
  "Light Source",
];

/**
 * Determines if an item is consumable based on its category
 */
export function isConsumable(item: Item): boolean {
  if (!item.category) return false;
  return CONSUMABLE_CATEGORIES.includes(item.category);
}
