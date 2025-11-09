// src/lib/data/weapons.ts

export interface WeaponProperties {
  damageDice: string; // e.g., "1d8", "2d6"
  damageType: string; // e.g., "slashing", "piercing", "bludgeoning"
  properties: string[]; // e.g., ["versatile", "finesse"]
  range?: string; // e.g., "5 ft", "80/320 ft"
  ability: "STR" | "DEX"; // Primary ability for attack rolls
}

/**
 * Weapon database with basic 5e properties
 * Based on D&D 5e SRD weapons
 */
export const WEAPON_DATA: Record<string, WeaponProperties> = {
  // Simple Melee Weapons
  club: { damageDice: "1d4", damageType: "bludgeoning", properties: ["light"], range: "5 ft", ability: "STR" },
  dagger: { damageDice: "1d4", damageType: "piercing", properties: ["finesse", "light", "thrown"], range: "5 ft/20/60 ft", ability: "DEX" },
  greatclub: { damageDice: "1d8", damageType: "bludgeoning", properties: ["two-handed"], range: "5 ft", ability: "STR" },
  handaxe: { damageDice: "1d6", damageType: "slashing", properties: ["light", "thrown"], range: "5 ft/20/60 ft", ability: "STR" },
  javelin: { damageDice: "1d6", damageType: "piercing", properties: ["thrown"], range: "5 ft/30/120 ft", ability: "STR" },
  mace: { damageDice: "1d6", damageType: "bludgeoning", properties: [], range: "5 ft", ability: "STR" },
  quarterstaff: { damageDice: "1d6", damageType: "bludgeoning", properties: ["versatile (1d8)"], range: "5 ft", ability: "STR" },
  sickle: { damageDice: "1d4", damageType: "slashing", properties: ["light"], range: "5 ft", ability: "STR" },
  spear: { damageDice: "1d6", damageType: "piercing", properties: ["thrown", "versatile (1d8)"], range: "5 ft/20/60 ft", ability: "STR" },

  // Simple Ranged Weapons
  crossbow: { damageDice: "1d8", damageType: "piercing", properties: ["ammunition", "loading", "two-handed"], range: "80/320 ft", ability: "DEX" },
  dart: { damageDice: "1d4", damageType: "piercing", properties: ["finesse", "thrown"], range: "20/60 ft", ability: "DEX" },
  shortbow: { damageDice: "1d6", damageType: "piercing", properties: ["ammunition", "two-handed"], range: "80/320 ft", ability: "DEX" },
  sling: { damageDice: "1d4", damageType: "bludgeoning", properties: ["ammunition"], range: "30/120 ft", ability: "DEX" },

  // Martial Melee Weapons
  battleaxe: { damageDice: "1d8", damageType: "slashing", properties: ["versatile (1d10)"], range: "5 ft", ability: "STR" },
  flail: { damageDice: "1d8", damageType: "bludgeoning", properties: [], range: "5 ft", ability: "STR" },
  glaive: { damageDice: "1d10", damageType: "slashing", properties: ["heavy", "reach", "two-handed"], range: "10 ft", ability: "STR" },
  greataxe: { damageDice: "1d12", damageType: "slashing", properties: ["heavy", "two-handed"], range: "5 ft", ability: "STR" },
  greatsword: { damageDice: "2d6", damageType: "slashing", properties: ["heavy", "two-handed"], range: "5 ft", ability: "STR" },
  halberd: { damageDice: "1d10", damageType: "slashing", properties: ["heavy", "reach", "two-handed"], range: "10 ft", ability: "STR" },
  lance: { damageDice: "1d12", damageType: "piercing", properties: ["reach", "special"], range: "10 ft", ability: "STR" },
  longsword: { damageDice: "1d8", damageType: "slashing", properties: ["versatile (1d10)"], range: "5 ft", ability: "STR" },
  maul: { damageDice: "2d6", damageType: "bludgeoning", properties: ["heavy", "two-handed"], range: "5 ft", ability: "STR" },
  morningstar: { damageDice: "1d8", damageType: "piercing", properties: [], range: "5 ft", ability: "STR" },
  pike: { damageDice: "1d10", damageType: "piercing", properties: ["heavy", "reach", "two-handed"], range: "10 ft", ability: "STR" },
  rapier: { damageDice: "1d8", damageType: "piercing", properties: ["finesse"], range: "5 ft", ability: "DEX" },
  scimitar: { damageDice: "1d6", damageType: "slashing", properties: ["finesse", "light"], range: "5 ft", ability: "DEX" },
  shortsword: { damageDice: "1d6", damageType: "piercing", properties: ["finesse", "light"], range: "5 ft", ability: "DEX" },
  trident: { damageDice: "1d6", damageType: "piercing", properties: ["thrown", "versatile (1d8)"], range: "5 ft/20/60 ft", ability: "STR" },
  warhammer: { damageDice: "1d8", damageType: "bludgeoning", properties: ["versatile (1d10)"], range: "5 ft", ability: "STR" },
  whip: { damageDice: "1d4", damageType: "slashing", properties: ["finesse", "reach"], range: "10 ft", ability: "DEX" },

  // Martial Ranged Weapons
  blowgun: { damageDice: "1", damageType: "piercing", properties: ["ammunition", "loading"], range: "25/100 ft", ability: "DEX" },
  "hand-crossbow": { damageDice: "1d6", damageType: "piercing", properties: ["ammunition", "light", "loading"], range: "30/120 ft", ability: "DEX" },
  "heavy-crossbow": { damageDice: "1d10", damageType: "piercing", properties: ["ammunition", "heavy", "loading", "two-handed"], range: "100/400 ft", ability: "DEX" },
  longbow: { damageDice: "1d8", damageType: "piercing", properties: ["ammunition", "heavy", "two-handed"], range: "150/600 ft", ability: "DEX" },
  net: { damageDice: "0", damageType: "special", properties: ["special", "thrown"], range: "5/15 ft", ability: "DEX" },
};

/**
 * Try to match an item name to a weapon in our database
 * Handles variations like "Longsword +1" or "Magical Dagger"
 */
export function matchWeapon(itemName: string): WeaponProperties | null {
  const normalized = itemName.toLowerCase().trim();

  // Direct match
  if (WEAPON_DATA[normalized]) {
    return WEAPON_DATA[normalized];
  }

  // Try to find weapon name within the item name
  for (const [weaponName, weaponData] of Object.entries(WEAPON_DATA)) {
    if (normalized.includes(weaponName)) {
      return weaponData;
    }
  }

  return null;
}
