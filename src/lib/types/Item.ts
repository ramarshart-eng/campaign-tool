// src/lib/types/Item.ts

export type EquipmentSlot =
  | "head"
  | "chest"
  | "hands"
  | "legs"
  | "feet"
  | "mainHand"
  | "offHand"
  | "neck"
  | "ring1"
  | "ring2";

export type EquipmentCategory =
  | "Weapon"
  | "Armor"
  | "Potion"
  | "Scroll"
  | "Ammunition"
  | "Adventuring Gear"
  | "Tools"
  | "Kit"
  | "Wondrous Item"
  | "Food"
  | "Light Source";

export interface Item {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  weight?: number;
  equipped?: boolean;
  equipmentSlot?: EquipmentSlot;
  category?: EquipmentCategory; // Item category, used to determine if consumable
}
