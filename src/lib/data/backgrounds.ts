/**
 * Local background data
 *
 * Contains basic background information compatible with SRD.
 * Backgrounds provide skill proficiencies and tool proficiencies.
 * Feature descriptions are intentionally kept minimal to avoid copyright issues.
 */

export interface LocalBackground {
  index: string;
  name: string;
  skillProficiencies: string[]; // skill names
  toolProficiencies?: string[];
  languages?: number; // number of language choices
  featureName: string;
  featureDescription: string; // kept generic
}

export const LOCAL_BACKGROUNDS: LocalBackground[] = [
  {
    index: "acolyte",
    name: "Acolyte",
    skillProficiencies: ["Insight", "Religion"],
    languages: 2,
    featureName: "Shelter of the Faithful",
    featureDescription: "You have a connection to temples and religious communities.",
  },
  {
    index: "criminal",
    name: "Criminal",
    skillProficiencies: ["Deception", "Stealth"],
    toolProficiencies: ["Thieves' Tools", "Gaming Set"],
    featureName: "Criminal Contact",
    featureDescription: "You have connections to the criminal underworld.",
  },
  {
    index: "folk-hero",
    name: "Folk Hero",
    skillProficiencies: ["Animal Handling", "Survival"],
    toolProficiencies: ["Artisan's Tools", "Vehicles (Land)"],
    featureName: "Rustic Hospitality",
    featureDescription: "Common folk provide you with shelter and assistance.",
  },
  {
    index: "noble",
    name: "Noble",
    skillProficiencies: ["History", "Persuasion"],
    toolProficiencies: ["Gaming Set"],
    languages: 1,
    featureName: "Position of Privilege",
    featureDescription: "You are welcomed in high society and among nobility.",
  },
  {
    index: "sage",
    name: "Sage",
    skillProficiencies: ["Arcana", "History"],
    languages: 2,
    featureName: "Researcher",
    featureDescription: "You know how to obtain information and research lore.",
  },
  {
    index: "soldier",
    name: "Soldier",
    skillProficiencies: ["Athletics", "Intimidation"],
    toolProficiencies: ["Gaming Set", "Vehicles (Land)"],
    featureName: "Military Rank",
    featureDescription: "You have rank and authority among military organizations.",
  },
  {
    index: "charlatan",
    name: "Charlatan",
    skillProficiencies: ["Deception", "Sleight of Hand"],
    toolProficiencies: ["Disguise Kit", "Forgery Kit"],
    featureName: "False Identity",
    featureDescription: "You have created a false identity for yourself.",
  },
  {
    index: "entertainer",
    name: "Entertainer",
    skillProficiencies: ["Acrobatics", "Performance"],
    toolProficiencies: ["Disguise Kit", "Musical Instrument"],
    featureName: "By Popular Demand",
    featureDescription: "You can find a place to perform and receive hospitality.",
  },
  {
    index: "guild-artisan",
    name: "Guild Artisan",
    skillProficiencies: ["Insight", "Persuasion"],
    toolProficiencies: ["Artisan's Tools"],
    languages: 1,
    featureName: "Guild Membership",
    featureDescription: "You are a member of a trade guild with benefits.",
  },
  {
    index: "hermit",
    name: "Hermit",
    skillProficiencies: ["Medicine", "Religion"],
    toolProficiencies: ["Herbalism Kit"],
    languages: 1,
    featureName: "Discovery",
    featureDescription: "You have learned something unique during your isolation.",
  },
  {
    index: "outlander",
    name: "Outlander",
    skillProficiencies: ["Athletics", "Survival"],
    toolProficiencies: ["Musical Instrument"],
    languages: 1,
    featureName: "Wanderer",
    featureDescription: "You excel at finding food, water, and shelter in the wild.",
  },
  {
    index: "sailor",
    name: "Sailor",
    skillProficiencies: ["Athletics", "Perception"],
    toolProficiencies: ["Navigator's Tools", "Vehicles (Water)"],
    featureName: "Ship's Passage",
    featureDescription: "You can secure free passage on sailing vessels.",
  },
  {
    index: "urchin",
    name: "Urchin",
    skillProficiencies: ["Sleight of Hand", "Stealth"],
    toolProficiencies: ["Disguise Kit", "Thieves' Tools"],
    featureName: "City Secrets",
    featureDescription: "You know the streets and can navigate cities quickly.",
  },
];

/**
 * Get all available backgrounds
 */
export function getAllBackgrounds(): LocalBackground[] {
  return LOCAL_BACKGROUNDS;
}

/**
 * Get a specific background by index
 */
export function getBackgroundByIndex(index: string): LocalBackground | undefined {
  return LOCAL_BACKGROUNDS.find((bg) => bg.index === index);
}
