import type { Note } from "@/lib/types/notes";
import type { EntityKind } from "@/lib/types/entityKinds";
export type { EntityKind } from "@/lib/types/entityKinds";

export type CampaignMode = "campaign" | "one-shot";

export interface Campaign {
  id: string;
  name: string;
  mode: CampaignMode;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  campaignId: string;
  name: string;
  arcId?: string | null;
  primaryNoteId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignArc {
  id: string;
  campaignId: string;
  name: string;
  summary?: string;
  color?: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface BaseEntity {
  id: string;
  kind: EntityKind;
  campaignId: string;
  name: string;
  summary?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NpcEntity extends BaseEntity {
  kind: "npc";
  locationId?: string | null;
  factionId?: string | null;
  srdMonsterId?: string | null;
  role?: string | null;
  sex?: "male" | "female" | "none" | "other";
  importance?: "minor" | "supporting" | "major";
  visibility?: "dmOnly" | "player";
  portraitUrl?: string | null;
}

export interface LocationEntity extends BaseEntity {
  kind: "location";
  parentLocationId?: string | null;
}

export interface EncounterCreatureSlot {
  id: string;
  srdMonsterId?: string | null;
  name: string;
  count: number;
  xpEach?: number | null;
}

export interface EncounterEntity extends BaseEntity {
  kind: "encounter";
  sessionId?: string | null;
  sceneNoteId?: string | null;
  summary?: string;
  environment?: "dungeon" | "wilderness" | "urban" | "planar" | "other" | null;
  difficulty?: "trivial" | "easy" | "medium" | "hard" | "deadly" | null;
  xpBudget?: number | null;
  creatures?: EncounterCreatureSlot[];
  npcIds?: string[];
}

export type EncounterCombatantKind = "pc" | "monster" | "other";

export interface EncounterCombatant {
  id: string;
  name: string;
  kind: EncounterCombatantKind;
  sourceSlotId?: string | null;
  count?: number;
  initiative: number | null;
  maxHp?: number | null;
  currentHp?: number | null;
  isDefeated?: boolean;
}

export interface EncounterRunState {
  encounterId: string;
  isActive: boolean;
  round: number;
  currentIndex: number;
  combatants: EncounterCombatant[];
}

export interface MapEntity extends BaseEntity {
  kind: "map";
  locationId?: string | null;
}

export interface FactionEntity extends BaseEntity {
  kind: "faction";
  scope?: "local" | "regional" | "global";
  alignment?: string | null;
  baseLocationId?: string | null;
  attitude?: "ally" | "neutral" | "hostile" | null;
  visibility?: "dmOnly" | "player";
}

export type DmEntity =
  | NpcEntity
  | LocationEntity
  | EncounterEntity
  | MapEntity
  | FactionEntity;

export type CampaignBeatStatus = "planned" | "in-progress" | "done";

export interface CampaignBeat {
  id: string;
  campaignId: string;
  title: string;
  summary?: string;
  arcId?: string | null;
  sessionId?: string | null;
  noteId?: string | null;
  sceneNoteId?: string | null;
  encounterId?: string | null;
  status: CampaignBeatStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface DmState {
  campaigns: Campaign[];
  currentCampaignId: string | null;
  notesByCampaignId: Record<string, Note[]>;
  sessionsByCampaignId: Record<string, Session[]>;
  arcsByCampaignId: Record<string, CampaignArc[]>;
  currentSessionIdByCampaignId: Record<string, string | null>;
  entitiesByCampaignId: Record<string, DmEntity[]>;
  beatsByCampaignId: Record<string, CampaignBeat[]>;
  encounterRunStateById: Record<string, EncounterRunState | undefined>;
}

export interface DeleteCascadeResult {
  campaignsDeleted: number;
  arcsDeleted: number;
  sessionsDeleted: number;
  notesDeleted: number;
  encountersDeleted: number;
  beatsDeleted: number;
  mapsDeleted: number;
}
