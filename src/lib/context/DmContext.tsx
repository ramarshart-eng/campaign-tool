import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  DmState,
  Campaign,
  Session,
  CampaignArc,
  DmEntity,
  EntityKind,
  CampaignBeat,
  EncounterEntity,
  EncounterCreatureSlot,
  EncounterRunState,
  EncounterCombatantKind,
  EncounterCombatant,
  NpcEntity,
  FactionEntity,
  MapEntity,
  DeleteCascadeResult,
} from "@/lib/types/dm";
import type { Note, NoteDoc, NoteScopeType, EntityRef } from "@/lib/types/notes";
import { noteDocToPlainText } from "@/lib/utils/noteDocText";
import { SRD_MONSTERS_BY_ID } from "@/lib/data/srdMonsters";

interface DmContextValue {
  state: DmState;
  currentCampaign: Campaign | null;
  arcsForCurrent: CampaignArc[];
  notesForCurrent: Note[];
  sessionsForCurrent: Session[];
  currentSession: Session | null;
  npcsForCurrent: NpcEntity[];
  factionsForCurrent: FactionEntity[];
  mapsForCurrent: MapEntity[];
  entitiesForCurrent: DmEntity[];
  beatsForCurrent: CampaignBeat[];
  encountersForCurrent: EncounterEntity[];
  npcMapForCurrent: Map<string, NpcEntity>;
  getEncounterRunState: (id: string) => EncounterRunState | null;
  startEncounterRun: (id: string) => EncounterRunState | null;
  updateEncounterRunState: (
    id: string,
    updater: (state: EncounterRunState) => EncounterRunState
  ) => void;
  endEncounterRun: (id: string) => void;
  setCurrentCampaignId: (id: string) => void;
  setCurrentSessionId: (id: string) => void;
  createCampaign: (name: string, mode?: Campaign["mode"]) => Campaign;
  deleteCampaign: (
    id: string,
    options?: { removeChildren?: boolean }
  ) => DeleteCascadeResult;
  updateCampaign: (
    id: string,
    updater: (campaign: Campaign) => Campaign
  ) => void;
  createSession: (name: string) => Session | null;
  setPrimarySessionNote: (sessionId: string, noteId: string | null) => void;
  deleteSession: (
    id: string,
    options?: { removeChildren?: boolean }
  ) => DeleteCascadeResult;
  createArcForCurrent: (name?: string) => CampaignArc | null;
  updateArcForCurrent: (
    id: string,
    updater: (arc: CampaignArc) => CampaignArc
  ) => void;
  deleteArcForCurrent: (
    id: string,
    options?: { removeChildren?: boolean }
  ) => DeleteCascadeResult;
  assignSessionToArc: (sessionId: string, arcId: string | null) => void;
  createEntity: (
    kind: EntityKind,
    name: string,
    extra?: Partial<DmEntity>
  ) => DmEntity | null;
  updateEntity: (id: string, updater: (entity: DmEntity) => DmEntity) => void;
  deleteEntity: (id: string) => void;
  createNoteForCurrent: (options?: {
    scopeType?: NoteScopeType;
    scopeId?: string | null;
  }) => Note | null;
  updateNoteForCurrent: (id: string, updater: (note: Note) => Note) => void;
  deleteNoteForCurrent: (id: string) => void;
  createBeatForCurrent: (input: {
    title: string;
    summary?: string;
    arcId?: string | null;
    sessionId?: string | null;
    noteId?: string | null;
    sceneNoteId?: string | null;
    encounterId?: string | null;
  }) => CampaignBeat | null;
  updateBeatForCurrent: (
    id: string,
    updater: (beat: CampaignBeat) => CampaignBeat
  ) => void;
  deleteBeatForCurrent: (id: string) => void;
  createEncounterForCurrentSession: (input: {
    name: string;
    sessionId?: string | null;
    sceneNoteId?: string | null;
    summary?: string;
  }) => EncounterEntity | null;
  updateEncounterForCurrent: (
    id: string,
    updater: (encounter: EncounterEntity) => EncounterEntity
  ) => void;
  deleteEncounterForCurrent: (id: string) => void;
  addEncounterCreatureSlot: (
    encounterId: string,
    slot: {
      id?: string;
      name: string;
      count: number;
      xpEach?: number | null;
      srdMonsterId?: string | null;
    }
  ) => void;
  addSrdMonsterToEncounter: (
    encounterId: string,
    monsterId: string,
    options?: { count?: number }
  ) => void;
  updateEncounterCreatureSlot: (
    encounterId: string,
    slotId: string,
    updater: (slot: EncounterCreatureSlot) => EncounterCreatureSlot
  ) => void;
  removeEncounterCreatureSlot: (encounterId: string, slotId: string) => void;
  addEncounterCombatant: (
    encounterId: string,
    combatant: {
      name: string;
      kind: EncounterCombatantKind;
      initiative?: number | null;
      maxHp?: number | null;
      currentHp?: number | null;
    }
  ) => void;
  updateEncounterCombatant: (
    encounterId: string,
    combatantId: string,
    updater: (combatant: EncounterCombatant) => EncounterCombatant
  ) => void;
  removeEncounterCombatant: (encounterId: string, combatantId: string) => void;
  // Map CRUD
  createMapForCurrent: (input: {
    name: string;
    gridWidth?: number;
    gridHeight?: number;
    environmentId?: string | null;
    locationId?: string | null;
  }) => MapEntity | null;
  updateMapForCurrent: (
    id: string,
    updater: (map: MapEntity) => MapEntity
  ) => void;
  deleteMapForCurrent: (id: string) => void;
  getMapById: (id: string) => MapEntity | null;
}

const STORAGE_KEY = "dmState";

const defaultState: DmState = {
  campaigns: [],
  currentCampaignId: null,
  notesByCampaignId: {},
  sessionsByCampaignId: {},
  arcsByCampaignId: {},
  currentSessionIdByCampaignId: {},
  entitiesByCampaignId: {},
  beatsByCampaignId: {},
  encounterRunStateById: {},
};

const createSessionRecord = (
  campaignId: string,
  name = "Session 1",
  arcId: string | null = null
): Session => {
  const now = new Date().toISOString();
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return {
    id: `sess-${unique}`,
    campaignId,
    name,
    arcId,
    primaryNoteId: null,
    createdAt: now,
    updatedAt: now,
  };
};

const createArcRecord = (
  campaignId: string,
  name = "Arc 1",
  orderIndex = 0
): CampaignArc => {
  const now = new Date().toISOString();
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return {
    id: `arc-${unique}`,
    campaignId,
    name,
    summary: "",
    color: null,
    orderIndex,
    createdAt: now,
    updatedAt: now,
  };
};

const collectEntityRefsFromDoc = (doc?: NoteDoc | null): EntityRef[] => {
  if (!doc) return [];
  const refs: EntityRef[] = [];
  const visitBlock = (block: NoteDoc["blocks"][number]) => {
    block.content?.forEach((node) => {
      if (node.type === "entityLink") refs.push(node.entity);
    });
    block.children?.forEach(visitBlock);
  };
  doc.blocks.forEach(visitBlock);
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.source}:${ref.kind}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const hydrateNote = (note: Note): Note => ({
  ...note,
  plainText: noteDocToPlainText(note.doc),
  entityRefs: collectEntityRefsFromDoc(note.doc),
});

const calculateEncounterMetrics = (slots?: EncounterCreatureSlot[]) => {
  if (!slots || slots.length === 0) {
    return { xpBudget: null, difficulty: null as EncounterEntity["difficulty"] };
  }
  const xpBudget = slots.reduce((total, slot) => {
    const xp = slot.xpEach ?? 0;
    return total + xp * slot.count;
  }, 0);
  let difficulty: EncounterEntity["difficulty"] = null;
  if (xpBudget > 0) {
    if (xpBudget <= 25) difficulty = "trivial";
    else if (xpBudget <= 100) difficulty = "easy";
    else if (xpBudget <= 300) difficulty = "medium";
    else if (xpBudget <= 700) difficulty = "hard";
    else difficulty = "deadly";
  }
  return { xpBudget, difficulty };
};

const createCascadeResult = (): DeleteCascadeResult => ({
  campaignsDeleted: 0,
  arcsDeleted: 0,
  sessionsDeleted: 0,
  notesDeleted: 0,
  encountersDeleted: 0,
  beatsDeleted: 0,
  mapsDeleted: 0,
});

const addCascadeResults = (
  base: DeleteCascadeResult,
  delta: DeleteCascadeResult
): DeleteCascadeResult => ({
  campaignsDeleted: base.campaignsDeleted + delta.campaignsDeleted,
  arcsDeleted: base.arcsDeleted + delta.arcsDeleted,
  sessionsDeleted: base.sessionsDeleted + delta.sessionsDeleted,
  notesDeleted: base.notesDeleted + delta.notesDeleted,
  encountersDeleted: base.encountersDeleted + delta.encountersDeleted,
  beatsDeleted: base.beatsDeleted + delta.beatsDeleted,
  mapsDeleted: base.mapsDeleted + delta.mapsDeleted,
});

const applySessionRemoval = (
  state: DmState,
  campaignId: string,
  sessionId: string,
  removeChildren: boolean
): { state: DmState; result: DeleteCascadeResult } => {
  const sessions = state.sessionsByCampaignId[campaignId] ?? [];
  if (!sessions.some((session) => session.id === sessionId)) {
    return { state, result: createCascadeResult() };
  }
  const result = createCascadeResult();
  result.sessionsDeleted = 1;
  const nextSessions = sessions.filter((session) => session.id !== sessionId);
  const now = new Date().toISOString();

  const notes = state.notesByCampaignId[campaignId] ?? [];
  let nextNotes = notes;
  if (removeChildren) {
    const filtered = notes.filter(
      (note) =>
        !(
          note.scopeId === sessionId &&
          (note.scopeType === "session" || note.scopeType === "scene")
        )
    );
    result.notesDeleted += notes.length - filtered.length;
    nextNotes = filtered;
  } else {
    nextNotes = notes.map((note) => {
      if (
        note.scopeId === sessionId &&
        (note.scopeType === "session" || note.scopeType === "scene")
      ) {
        return {
          ...note,
          scopeId: null,
          updatedAt: now,
        };
      }
      return note;
    });
  }

  let nextEntities = state.entitiesByCampaignId[campaignId] ?? [];
  if (removeChildren) {
    const filtered = nextEntities.filter(
      (entity) => !(entity.kind === "encounter" && entity.sessionId === sessionId)
    );
    result.encountersDeleted += nextEntities.length - filtered.length;
    nextEntities = filtered;
  } else {
    nextEntities = nextEntities.map((entity) => {
      if (entity.kind === "encounter" && entity.sessionId === sessionId) {
        return {
          ...entity,
          sessionId: null,
          sceneNoteId: nextNotes.some((note) => note.id === entity.sceneNoteId)
            ? entity.sceneNoteId ?? null
            : null,
          updatedAt: now,
        };
      }
      return entity;
    });
  }

  let nextBeats = state.beatsByCampaignId[campaignId] ?? [];
  if (removeChildren) {
    const filtered = nextBeats.filter((beat) => beat.sessionId !== sessionId);
    result.beatsDeleted += nextBeats.length - filtered.length;
    nextBeats = filtered;
  } else {
    nextBeats = nextBeats.map((beat) =>
      beat.sessionId === sessionId ? { ...beat, sessionId: null, updatedAt: now } : beat
    );
  }

  const currentSessionId = state.currentSessionIdByCampaignId[campaignId];
  const resolvedSessionId =
    currentSessionId === sessionId
      ? nextSessions[0]?.id ?? null
      : currentSessionId ?? null;

  const nextState: DmState = {
    ...state,
    sessionsByCampaignId: {
      ...state.sessionsByCampaignId,
      [campaignId]: nextSessions,
    },
    notesByCampaignId: {
      ...state.notesByCampaignId,
      [campaignId]: nextNotes,
    },
    entitiesByCampaignId: {
      ...state.entitiesByCampaignId,
      [campaignId]: nextEntities,
    },
    beatsByCampaignId: {
      ...state.beatsByCampaignId,
      [campaignId]: nextBeats,
    },
    currentSessionIdByCampaignId: {
      ...state.currentSessionIdByCampaignId,
      [campaignId]: resolvedSessionId,
    },
  };

  return { state: nextState, result };
};

const applyArcRemoval = (
  state: DmState,
  campaignId: string,
  arcId: string,
  removeChildren: boolean
): { state: DmState; result: DeleteCascadeResult } => {
  const arcs = state.arcsByCampaignId[campaignId] ?? [];
  if (!arcs.some((arc) => arc.id === arcId)) {
    return { state, result: createCascadeResult() };
  }
  const result = createCascadeResult();
  result.arcsDeleted = 1;
  const remaining = arcs.filter((arc) => arc.id !== arcId);
  const reindexed = remaining.map((arc, index) => ({
    ...arc,
    orderIndex: index,
  }));

  let nextState: DmState = {
    ...state,
    arcsByCampaignId: {
      ...state.arcsByCampaignId,
      [campaignId]: reindexed,
    },
  };

  if (removeChildren) {
    const sessions = nextState.sessionsByCampaignId[campaignId] ?? [];
    const sessionsForArc = sessions.filter((session) => session.arcId === arcId);
    let aggregated = result;
    sessionsForArc.forEach((session) => {
      const removal = applySessionRemoval(nextState, campaignId, session.id, true);
      nextState = removal.state;
      aggregated = addCascadeResults(aggregated, removal.result);
    });
    const beats = nextState.beatsByCampaignId[campaignId] ?? [];
    const filteredBeats = beats.filter(
      (beat) => !(beat.arcId === arcId && !beat.sessionId)
    );
    aggregated.beatsDeleted += beats.length - filteredBeats.length;
    nextState = {
      ...nextState,
      beatsByCampaignId: {
        ...nextState.beatsByCampaignId,
        [campaignId]: filteredBeats,
      },
    };
    return { state: nextState, result: aggregated };
  }

  const fallbackArcId = reindexed[0]?.id ?? null;
  const sessions = nextState.sessionsByCampaignId[campaignId] ?? [];
  const reassignedSessions = sessions.map((session) =>
    session.arcId === arcId
      ? { ...session, arcId: fallbackArcId, updatedAt: new Date().toISOString() }
      : session
  );
  const beats = nextState.beatsByCampaignId[campaignId] ?? [];
  const reassignedBeats = beats.map((beat) =>
    beat.arcId === arcId ? { ...beat, arcId: fallbackArcId } : beat
  );
  nextState = {
    ...nextState,
    sessionsByCampaignId: {
      ...nextState.sessionsByCampaignId,
      [campaignId]: reassignedSessions,
    },
    beatsByCampaignId: {
      ...nextState.beatsByCampaignId,
      [campaignId]: reassignedBeats,
    },
  };

  return { state: nextState, result };
};

const applyCampaignRemoval = (
  state: DmState,
  campaignId: string
): { state: DmState; result: DeleteCascadeResult } => {
  if (!state.campaigns.some((campaign) => campaign.id === campaignId)) {
    return { state, result: createCascadeResult() };
  }
  const result = createCascadeResult();
  result.campaignsDeleted = 1;

  const nextCampaigns = state.campaigns.filter((campaign) => campaign.id !== campaignId);
  const sessions = state.sessionsByCampaignId[campaignId] ?? [];
  result.sessionsDeleted += sessions.length;

  const arcs = state.arcsByCampaignId[campaignId] ?? [];
  result.arcsDeleted += arcs.length;

  const notes = state.notesByCampaignId[campaignId] ?? [];
  result.notesDeleted += notes.length;

  const beats = state.beatsByCampaignId[campaignId] ?? [];
  result.beatsDeleted += beats.length;

  const entities = state.entitiesByCampaignId[campaignId] ?? [];
  const encounterIds = new Set<string>();
  entities.forEach((entity) => {
    if (entity.kind === "encounter") {
      result.encountersDeleted += 1;
      encounterIds.add(entity.id);
    } else if (entity.kind === "map") {
      result.mapsDeleted += 1;
    }
  });

  const { [campaignId]: _sessions, ...sessionsByCampaignId } = state.sessionsByCampaignId;
  const { [campaignId]: _arcs, ...arcsByCampaignId } = state.arcsByCampaignId;
  const { [campaignId]: _notes, ...notesByCampaignId } = state.notesByCampaignId;
  const { [campaignId]: _beats, ...beatsByCampaignId } = state.beatsByCampaignId;
  const { [campaignId]: _entities, ...entitiesByCampaignId } = state.entitiesByCampaignId;
  const {
    [campaignId]: _sessionPointer,
    ...currentSessionIdByCampaignId
  } = state.currentSessionIdByCampaignId;

  const nextEncounterRunStateById: DmState["encounterRunStateById"] = {};
  Object.entries(state.encounterRunStateById).forEach(([encounterId, runState]) => {
    if (!encounterIds.has(encounterId) && runState) {
      nextEncounterRunStateById[encounterId] = runState;
    }
  });

  const nextState: DmState = {
    ...state,
    campaigns: nextCampaigns,
    currentCampaignId:
      state.currentCampaignId === campaignId
        ? nextCampaigns[0]?.id ?? null
        : state.currentCampaignId,
    sessionsByCampaignId,
    arcsByCampaignId,
    notesByCampaignId,
    beatsByCampaignId,
    entitiesByCampaignId,
    currentSessionIdByCampaignId,
    encounterRunStateById: nextEncounterRunStateById,
  };

  return { state: nextState, result };
};

const DmContext = createContext<DmContextValue | undefined>(undefined);

export const DmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DmState>(defaultState);

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DmState;
      if (parsed && typeof parsed === "object") {
        const campaigns = parsed.campaigns ?? [];
        const notesByCampaignIdEntries = Object.entries(
          parsed.notesByCampaignId ?? {}
        );
        const notesByCampaignId: Record<string, Note[]> = {};
        notesByCampaignIdEntries.forEach(([campId, list]) => {
          notesByCampaignId[campId] = Array.isArray(list)
            ? (list as Note[]).map((note) => hydrateNote(note))
            : [];
        });
        const entitiesByCampaignIdEntries = Object.entries(
          parsed.entitiesByCampaignId ?? {}
        );
        const entitiesByCampaignId: Record<string, DmEntity[]> = {};
        entitiesByCampaignIdEntries.forEach(([campId, list]) => {
          entitiesByCampaignId[campId] = Array.isArray(list)
            ? (list as DmEntity[]).map((entity) => ({
                ...entity,
              }))
            : [];
        });
        const beatsByCampaignIdEntries = Object.entries(
          parsed.beatsByCampaignId ?? {}
        );
        const beatsByCampaignId: Record<string, CampaignBeat[]> = {};
        beatsByCampaignIdEntries.forEach(([campId, list]) => {
          beatsByCampaignId[campId] = Array.isArray(list)
            ? (list as CampaignBeat[]).map((beat) => ({
                ...beat,
              }))
            : [];
        });
        const arcsByCampaignIdEntries = Object.entries(
          parsed.arcsByCampaignId ?? {}
        );
        const arcsByCampaignId: Record<string, CampaignArc[]> = {};
        arcsByCampaignIdEntries.forEach(([campId, list]) => {
          arcsByCampaignId[campId] = Array.isArray(list)
            ? (list as CampaignArc[]).map((arc) => ({
                ...arc,
              }))
            : [];
        });
        const sessionsByCampaignId = { ...parsed.sessionsByCampaignId };
        const currentSessionIdByCampaignId = {
          ...parsed.currentSessionIdByCampaignId,
        };
        campaigns.forEach((camp) => {
          if (!arcsByCampaignId[camp.id]) {
            const defaultArc = createArcRecord(camp.id, "Arc 1", 0);
            arcsByCampaignId[camp.id] = [defaultArc];
          }
          const arcList = arcsByCampaignId[camp.id] ?? [];
          arcsByCampaignId[camp.id] = arcList;
          if (!sessionsByCampaignId[camp.id] || sessionsByCampaignId[camp.id].length === 0) {
            const session = createSessionRecord(
              camp.id,
              "Session 1",
              arcList[0]?.id ?? null
            );
            sessionsByCampaignId[camp.id] = [session];
            currentSessionIdByCampaignId[camp.id] = session.id;
          } else if (!currentSessionIdByCampaignId[camp.id]) {
            currentSessionIdByCampaignId[camp.id] =
              sessionsByCampaignId[camp.id][0]?.id ?? null;
          }
          const fallbackArcId = arcList[0]?.id ?? null;
          sessionsByCampaignId[camp.id] = sessionsByCampaignId[camp.id].map(
            (session) => ({
              ...session,
              arcId: session.arcId ?? fallbackArcId,
              primaryNoteId: session.primaryNoteId ?? null,
            })
          );
          if (!beatsByCampaignId[camp.id]) {
            beatsByCampaignId[camp.id] = [];
          }
          beatsByCampaignId[camp.id] = beatsByCampaignId[camp.id].map(
            (beat) => ({
              ...beat,
              arcId: beat.arcId ?? fallbackArcId,
              sceneNoteId: beat.sceneNoteId ?? null,
              encounterId: beat.encounterId ?? null,
            })
          );
          if (!entitiesByCampaignId[camp.id]) {
            entitiesByCampaignId[camp.id] = [];
          }
        });
        setState({
          campaigns,
          currentCampaignId:
            parsed.currentCampaignId ?? campaigns[0]?.id ?? defaultState.currentCampaignId,
          notesByCampaignId,
          sessionsByCampaignId,
          arcsByCampaignId: {
            ...defaultState.arcsByCampaignId,
            ...arcsByCampaignId,
          },
          currentSessionIdByCampaignId,
          entitiesByCampaignId,
          encounterRunStateById: parsed.encounterRunStateById ?? {},
          beatsByCampaignId,
        });
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  // Ensure at least one default campaign exists
  useEffect(() => {
    setState((prev) => {
      if (prev.campaigns.length > 0) {
        // Ensure currentCampaignId points to an existing campaign
        if (
          !prev.currentCampaignId ||
          !prev.campaigns.some((c) => c.id === prev.currentCampaignId)
        ) {
          return {
            ...prev,
            currentCampaignId: prev.campaigns[0].id,
          };
        }
        return prev;
      }
      const now = new Date().toISOString();
      const id = `camp-${Date.now()}`;
      const campaign: Campaign = {
        id,
        name: "Sandbox Campaign",
        mode: "campaign",
        createdAt: now,
        updatedAt: now,
      };
      const arc = createArcRecord(id, "Act I", 0);
      const session = createSessionRecord(id, "Session 1", arc.id);
      return {
        campaigns: [campaign],
        currentCampaignId: id,
        notesByCampaignId: {},
        sessionsByCampaignId: { [id]: [session] },
        arcsByCampaignId: { [id]: [arc] },
        currentSessionIdByCampaignId: { [id]: session.id },
        entitiesByCampaignId: { [id]: [] },
        beatsByCampaignId: { [id]: [] },
        encounterRunStateById: {},
      };
    });
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const currentCampaign: Campaign | null = useMemo(() => {
    if (!state.currentCampaignId) return null;
    return (
      state.campaigns.find((c) => c.id === state.currentCampaignId) ?? null
    );
  }, [state.campaigns, state.currentCampaignId]);

  const notesForCurrent: Note[] = useMemo(() => {
    if (!currentCampaign) return [];
    return state.notesByCampaignId[currentCampaign.id] ?? [];
  }, [state.notesByCampaignId, currentCampaign]);

  const arcsForCurrent: CampaignArc[] = useMemo(() => {
    if (!currentCampaign) return [];
    const arcs = state.arcsByCampaignId[currentCampaign.id] ?? [];
    return [...arcs].sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [state.arcsByCampaignId, currentCampaign]);

  const sessionsForCurrent: Session[] = useMemo(() => {
    if (!currentCampaign) return [];
    return state.sessionsByCampaignId[currentCampaign.id] ?? [];
  }, [state.sessionsByCampaignId, currentCampaign]);

  const currentSessionId = currentCampaign
    ? state.currentSessionIdByCampaignId[currentCampaign.id] ?? null
    : null;

  const currentSession: Session | null = useMemo(() => {
    if (!currentCampaign) return null;
    if (!sessionsForCurrent.length) return null;
    if (currentSessionId) {
      const found = sessionsForCurrent.find((s) => s.id === currentSessionId);
      if (found) return found;
    }
    return sessionsForCurrent[0] ?? null;
  }, [sessionsForCurrent, currentSessionId, currentCampaign]);

  const entitiesForCurrent: DmEntity[] = useMemo(() => {
    if (!currentCampaign) return [];
    return state.entitiesByCampaignId[currentCampaign.id] ?? [];
  }, [state.entitiesByCampaignId, currentCampaign]);

  const npcsForCurrent: NpcEntity[] = useMemo(() => {
    return entitiesForCurrent.filter(
      (entity): entity is NpcEntity => entity.kind === "npc"
    );
  }, [entitiesForCurrent]);

  const npcMapForCurrent = useMemo(() => {
    const map = new Map<string, NpcEntity>();
    npcsForCurrent.forEach((npc) => map.set(npc.id, npc));
    return map;
  }, [npcsForCurrent]);

  const factionsForCurrent: FactionEntity[] = useMemo(() => {
    return entitiesForCurrent.filter(
      (entity): entity is FactionEntity => entity.kind === "faction"
    );
  }, [entitiesForCurrent]);

  const mapsForCurrent: MapEntity[] = useMemo(() => {
    return entitiesForCurrent.filter(
      (entity): entity is MapEntity => entity.kind === "map"
    );
  }, [entitiesForCurrent]);

  const encountersForCurrent: EncounterEntity[] = useMemo(() => {
    return entitiesForCurrent.filter(
      (entity): entity is EncounterEntity => entity.kind === "encounter"
    );
  }, [entitiesForCurrent]);

  const beatsForCurrent: CampaignBeat[] = useMemo(() => {
    if (!currentCampaign) return [];
    const list = state.beatsByCampaignId[currentCampaign.id] ?? [];
    return [...list].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [state.beatsByCampaignId, currentCampaign]);

  const setCurrentCampaignId = (id: string) => {
    setState((prev) => {
      const target = prev.campaigns.find((c) => c.id === id);
      if (!target) return prev;
      let sessionsByCampaignId = prev.sessionsByCampaignId;
      let arcsByCampaignId = prev.arcsByCampaignId;
      let currentSessionIdByCampaignId = prev.currentSessionIdByCampaignId;
      if (!arcsByCampaignId[id]) {
        const defaultArc = createArcRecord(id, "Arc 1", 0);
        arcsByCampaignId = {
          ...arcsByCampaignId,
          [id]: [defaultArc],
        };
      }
      const fallbackArcId = arcsByCampaignId[id]?.[0]?.id ?? null;
      if (!sessionsByCampaignId[id] || sessionsByCampaignId[id].length === 0) {
        const session = createSessionRecord(id, "Session 1", fallbackArcId);
        sessionsByCampaignId = {
          ...sessionsByCampaignId,
          [id]: [session],
        };
        currentSessionIdByCampaignId = {
          ...currentSessionIdByCampaignId,
          [id]: session.id,
        };
      } else if (!currentSessionIdByCampaignId[id]) {
        currentSessionIdByCampaignId = {
          ...currentSessionIdByCampaignId,
          [id]: sessionsByCampaignId[id][0]?.id ?? null,
        };
      } else if (fallbackArcId) {
        sessionsByCampaignId = {
          ...sessionsByCampaignId,
          [id]: sessionsByCampaignId[id].map((session) => ({
            ...session,
            arcId: session.arcId ?? fallbackArcId,
          })),
        };
      }
      return {
        ...prev,
        currentCampaignId: id,
        sessionsByCampaignId,
        arcsByCampaignId,
        currentSessionIdByCampaignId,
      };
    });
  };

  const setCurrentSessionId = (id: string) => {
    if (!currentCampaign) return;
    setState((prev) => ({
      ...prev,
      currentSessionIdByCampaignId: {
        ...prev.currentSessionIdByCampaignId,
        [currentCampaign.id]: id,
      },
    }));
  };

  const createSession = (name: string) => {
    if (!currentCampaign) return null;
    const defaultArcId =
      state.arcsByCampaignId[currentCampaign.id]?.[0]?.id ?? null;
    const session = createSessionRecord(currentCampaign.id, name, defaultArcId);
    setState((prev) => {
      const existing = prev.sessionsByCampaignId[currentCampaign.id] ?? [];
      return {
        ...prev,
        sessionsByCampaignId: {
          ...prev.sessionsByCampaignId,
          [currentCampaign.id]: [...existing, session],
        },
        currentSessionIdByCampaignId: {
          ...prev.currentSessionIdByCampaignId,
          [currentCampaign.id]: session.id,
        },
      };
    });
    return session;
  };

  const setPrimarySessionNote = (sessionId: string, noteId: string | null) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const sessions = prev.sessionsByCampaignId[currentCampaign.id] ?? [];
      const nextSessions = sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              primaryNoteId: noteId,
              updatedAt: new Date().toISOString(),
            }
          : session
      );
      return {
        ...prev,
        sessionsByCampaignId: {
          ...prev.sessionsByCampaignId,
          [currentCampaign.id]: nextSessions,
        },
      };
    });
  };

  const deleteSession = (
    sessionId: string,
    options: { removeChildren?: boolean } = {}
  ): DeleteCascadeResult => {
    if (!currentCampaign) return createCascadeResult();
    const removeChildren = options.removeChildren ?? false;
    let cascade = createCascadeResult();
    setState((prev) => {
      const { state: nextState, result } = applySessionRemoval(
        prev,
        currentCampaign.id,
        sessionId,
        removeChildren
      );
      cascade = result;
      return nextState;
    });
    return cascade;
  };

  const createArcForCurrent = (name = "") => {
    if (!currentCampaign) return null;
    let created: CampaignArc | null = null;
    setState((prev) => {
      const arcs = prev.arcsByCampaignId[currentCampaign.id] ?? [];
      const arcName = name.trim() || `Arc ${arcs.length + 1}`;
      const arc = createArcRecord(
        currentCampaign.id,
        arcName,
        arcs.length
      );
      created = arc;
      return {
        ...prev,
        arcsByCampaignId: {
          ...prev.arcsByCampaignId,
          [currentCampaign.id]: [...arcs, arc],
        },
      };
    });
    return created;
  };

  const updateArcForCurrent = (
    id: string,
    updater: (arc: CampaignArc) => CampaignArc
  ) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const arcs = prev.arcsByCampaignId[currentCampaign.id] ?? [];
      const next = arcs.map((arc) =>
        arc.id === id
          ? {
              ...updater(arc),
              updatedAt: new Date().toISOString(),
            }
          : arc
      );
      return {
        ...prev,
        arcsByCampaignId: {
          ...prev.arcsByCampaignId,
          [currentCampaign.id]: next,
        },
      };
    });
  };

  const deleteArcForCurrent = (
    id: string,
    options: { removeChildren?: boolean } = {}
  ): DeleteCascadeResult => {
    if (!currentCampaign) return createCascadeResult();
    const removeChildren = options.removeChildren ?? false;
    let cascade = createCascadeResult();
    setState((prev) => {
      const { state: nextState, result } = applyArcRemoval(
        prev,
        currentCampaign.id,
        id,
        removeChildren
      );
      cascade = result;
      return nextState;
    });
    return cascade;
  };

  const assignSessionToArc = (sessionId: string, arcId: string | null) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const sessions = prev.sessionsByCampaignId[currentCampaign.id] ?? [];
      const next = sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              arcId,
              updatedAt: new Date().toISOString(),
            }
          : session
      );
      return {
        ...prev,
        sessionsByCampaignId: {
          ...prev.sessionsByCampaignId,
          [currentCampaign.id]: next,
        },
      };
    });
  };

  const createEntity = (
    kind: EntityKind,
    name: string,
    extra: Partial<DmEntity> = {}
  ) => {
    if (!currentCampaign) return null;
    const now = new Date().toISOString();
    const entity: DmEntity = {
      id: `entity-${kind}-${Date.now()}`,
      kind,
      campaignId: currentCampaign.id,
      name,
      tags: [],
      summary: "",
      createdAt: now,
      updatedAt: now,
      ...extra,
    } as DmEntity;
    setState((prev) => {
      const existing = prev.entitiesByCampaignId[currentCampaign.id] ?? [];
      return {
        ...prev,
        entitiesByCampaignId: {
          ...prev.entitiesByCampaignId,
          [currentCampaign.id]: [...existing, entity],
        },
      };
    });
    return entity;
  };

  const updateEntity = (id: string, updater: (entity: DmEntity) => DmEntity) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const list = prev.entitiesByCampaignId[currentCampaign.id] ?? [];
      const next = list.map((entity) =>
        entity.id === id
          ? {
              ...updater(entity),
              updatedAt: new Date().toISOString(),
            }
          : entity
      );
      return {
        ...prev,
        entitiesByCampaignId: {
          ...prev.entitiesByCampaignId,
          [currentCampaign.id]: next,
        },
      };
    });
  };

  const deleteEntity = (id: string) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const list = prev.entitiesByCampaignId[currentCampaign.id] ?? [];
      return {
        ...prev,
        entitiesByCampaignId: {
          ...prev.entitiesByCampaignId,
          [currentCampaign.id]: list.filter((entity) => entity.id !== id),
        },
      };
    });
  };

  const createEncounterForCurrentSession = (input: {
    name: string;
    sessionId?: string | null;
    sceneNoteId?: string | null;
    summary?: string;
  }): EncounterEntity | null => {
    if (!currentCampaign) return null;
    const now = new Date().toISOString();
    const encounter: EncounterEntity = {
      id: `encounter-${Date.now()}`,
      kind: "encounter",
      campaignId: currentCampaign.id,
      name: input.name,
      sessionId: input.sessionId ?? currentSession?.id ?? null,
      sceneNoteId: input.sceneNoteId ?? null,
      summary: input.summary ?? "",
      environment: null,
      difficulty: null,
      xpBudget: null,
      creatures: [],
      npcIds: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    setState((prev) => {
      const existing = prev.entitiesByCampaignId[currentCampaign.id] ?? [];
      return {
        ...prev,
        entitiesByCampaignId: {
          ...prev.entitiesByCampaignId,
          [currentCampaign.id]: [...existing, encounter],
        },
      };
    });
    return encounter;
  };

  const updateEncounterForCurrent = (
    id: string,
    updater: (encounter: EncounterEntity) => EncounterEntity
  ) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const list = prev.entitiesByCampaignId[currentCampaign.id] ?? [];
      const next = list.map((entity) => {
        if (entity.id !== id || entity.kind !== "encounter") return entity;
        const updated = updater(entity as EncounterEntity);
        return {
          ...updated,
          updatedAt: new Date().toISOString(),
        };
      });
      return {
        ...prev,
        entitiesByCampaignId: {
          ...prev.entitiesByCampaignId,
          [currentCampaign.id]: next,
        },
      };
    });
  };

  const deleteEncounterForCurrent = (id: string) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const list = prev.entitiesByCampaignId[currentCampaign.id] ?? [];
      return {
        ...prev,
        entitiesByCampaignId: {
          ...prev.entitiesByCampaignId,
          [currentCampaign.id]: list.filter(
            (entity) => !(entity.kind === "encounter" && entity.id === id)
          ),
        },
      };
    });
  };

  // ── Map CRUD ─────────────────────────────────────────────────────────────────
  const createMapForCurrent = (input: {
    name: string;
    gridWidth?: number;
    gridHeight?: number;
    environmentId?: string | null;
    locationId?: string | null;
  }): MapEntity | null => {
    if (!currentCampaign) return null;
    const now = new Date().toISOString();
    const map: MapEntity = {
      id: `map-${Date.now()}`,
      kind: "map",
      campaignId: currentCampaign.id,
      name: input.name,
      gridWidth: input.gridWidth ?? 20,
      gridHeight: input.gridHeight ?? 20,
      environmentId: input.environmentId ?? null,
      locationId: input.locationId ?? null,
      layerData: null,
      tileData: null,
      tags: [],
      summary: "",
      createdAt: now,
      updatedAt: now,
    };
    setState((prev) => {
      const existing = prev.entitiesByCampaignId[currentCampaign.id] ?? [];
      return {
        ...prev,
        entitiesByCampaignId: {
          ...prev.entitiesByCampaignId,
          [currentCampaign.id]: [...existing, map],
        },
      };
    });
    return map;
  };

  const updateMapForCurrent = (
    id: string,
    updater: (map: MapEntity) => MapEntity
  ) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const list = prev.entitiesByCampaignId[currentCampaign.id] ?? [];
      const next = list.map((entity) => {
        if (entity.id !== id || entity.kind !== "map") return entity;
        const updated = updater(entity as MapEntity);
        return {
          ...updated,
          updatedAt: new Date().toISOString(),
        };
      });
      return {
        ...prev,
        entitiesByCampaignId: {
          ...prev.entitiesByCampaignId,
          [currentCampaign.id]: next,
        },
      };
    });
  };

  const deleteMapForCurrent = (id: string) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const list = prev.entitiesByCampaignId[currentCampaign.id] ?? [];
      return {
        ...prev,
        entitiesByCampaignId: {
          ...prev.entitiesByCampaignId,
          [currentCampaign.id]: list.filter(
            (entity) => !(entity.kind === "map" && entity.id === id)
          ),
        },
      };
    });
  };

  const getMapById = (id: string): MapEntity | null => {
    return mapsForCurrent.find((m) => m.id === id) ?? null;
  };

  const withUpdatedSlots = (
    encounter: EncounterEntity,
    slots: EncounterCreatureSlot[]
  ): EncounterEntity => {
    const { xpBudget, difficulty } = calculateEncounterMetrics(slots);
    return {
      ...encounter,
      creatures: slots,
      xpBudget,
      difficulty,
    };
  };

  const addEncounterCreatureSlot = (
    encounterId: string,
    slot: {
      id?: string;
      name: string;
      count: number;
      xpEach?: number | null;
      srdMonsterId?: string | null;
    }
  ) => {
    updateEncounterForCurrent(encounterId, (encounter) => {
      const slots = [...(encounter.creatures ?? [])];
      slots.push({
        id: slot.id ?? `slot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: slot.name,
        count: slot.count,
        xpEach: slot.xpEach ?? null,
        srdMonsterId: slot.srdMonsterId ?? null,
      });
      return withUpdatedSlots(encounter, slots);
    });
  };

  const updateEncounterCreatureSlot = (
    encounterId: string,
    slotId: string,
    updater: (slot: EncounterCreatureSlot) => EncounterCreatureSlot
  ) => {
    updateEncounterForCurrent(encounterId, (encounter) => {
      const slots = (encounter.creatures ?? []).map((slot) =>
        slot.id === slotId ? updater(slot) : slot
      );
      return withUpdatedSlots(encounter, slots);
    });
  };

  const removeEncounterCreatureSlot = (encounterId: string, slotId: string) => {
    updateEncounterForCurrent(encounterId, (encounter) => {
      const slots = (encounter.creatures ?? []).filter(
        (slot) => slot.id !== slotId
      );
      return withUpdatedSlots(encounter, slots);
    });
  };

  const buildCombatantsFromEncounter = (
    encounter: EncounterEntity
  ): EncounterCombatant[] => {
    const combatants: EncounterCombatant[] = [];
    (encounter.creatures ?? []).forEach((slot) => {
      const monster = slot.srdMonsterId
        ? SRD_MONSTERS_BY_ID.get(slot.srdMonsterId) ?? null
        : null;
      const hp = monster?.hit_points ?? null;
      const count = Math.max(1, slot.count || 1);
      for (let i = 1; i <= count; i += 1) {
        combatants.push({
          id: `cmb-${slot.id}-${i}`,
          name: count > 1 ? `${slot.name} #${i}` : slot.name,
          kind: "monster",
          sourceSlotId: slot.id,
          initiative: null,
          maxHp: hp,
          currentHp: hp,
          isDefeated: false,
        });
      }
    });
    return combatants;
  };

  const getEncounterRunState = (encounterId: string) => {
    return state.encounterRunStateById[encounterId] ?? null;
  };

  const startEncounterRun = (encounterId: string) => {
    if (!currentCampaign) return null;
    const encounter = encountersForCurrent.find((enc) => enc.id === encounterId);
    if (!encounter) return null;
    const combatants = buildCombatantsFromEncounter(encounter);
    const runState: EncounterRunState = {
      encounterId,
      isActive: true,
      round: 1,
      currentIndex: 0,
      combatants,
    };
    setState((prev) => ({
      ...prev,
      encounterRunStateById: {
        ...prev.encounterRunStateById,
        [encounterId]: runState,
      },
    }));
    return runState;
  };

  const updateEncounterRunState = (
    encounterId: string,
    updater: (runState: EncounterRunState) => EncounterRunState
  ) => {
    setState((prev) => {
      const current = prev.encounterRunStateById[encounterId];
      if (!current) return prev;
      return {
        ...prev,
        encounterRunStateById: {
          ...prev.encounterRunStateById,
          [encounterId]: updater(current),
        },
      };
    });
  };

  const endEncounterRun = (encounterId: string) => {
    setState((prev) => {
      const current = prev.encounterRunStateById[encounterId];
      if (!current) return prev;
      return {
        ...prev,
        encounterRunStateById: {
          ...prev.encounterRunStateById,
          [encounterId]: { ...current, isActive: false },
        },
      };
    });
  };

  const createBeatForCurrent = (input: {
    title: string;
    summary?: string;
    arcId?: string | null;
    sessionId?: string | null;
    noteId?: string | null;
    sceneNoteId?: string | null;
    encounterId?: string | null;
  }): CampaignBeat | null => {
    if (!currentCampaign) return null;
    const now = new Date().toISOString();
    let createdBeat: CampaignBeat | null = null;
    setState((prev) => {
      const existing = prev.beatsByCampaignId[currentCampaign.id] ?? [];
      const sessions = prev.sessionsByCampaignId[currentCampaign.id] ?? [];
      const arcs = prev.arcsByCampaignId[currentCampaign.id] ?? [];
      const resolvedArcId =
        input.arcId ??
        (input.sessionId
          ? sessions.find((session) => session.id === input.sessionId)?.arcId ??
            null
          : arcs[0]?.id ?? null);
      const maxOrder = existing.reduce(
        (max, beat) => (beat.order > max ? beat.order : max),
        0
      );
      const beat: CampaignBeat = {
        id: `beat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        campaignId: currentCampaign.id,
        title: input.title,
        summary: input.summary,
        arcId: resolvedArcId ?? null,
        sessionId: input.sessionId ?? null,
        noteId: input.noteId ?? null,
         sceneNoteId: input.sceneNoteId ?? null,
         encounterId: input.encounterId ?? null,
        status: "planned",
        order: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      };
      createdBeat = beat;
      return {
        ...prev,
        beatsByCampaignId: {
          ...prev.beatsByCampaignId,
          [currentCampaign.id]: [...existing, beat],
        },
      };
    });
    return createdBeat;
  };

  const updateBeatForCurrent = (
    id: string,
    updater: (beat: CampaignBeat) => CampaignBeat
  ) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const list = prev.beatsByCampaignId[currentCampaign.id] ?? [];
      const next = list.map((beat) =>
        beat.id === id
          ? {
              ...updater(beat),
              updatedAt: new Date().toISOString(),
            }
          : beat
      );
      return {
        ...prev,
        beatsByCampaignId: {
          ...prev.beatsByCampaignId,
          [currentCampaign.id]: next,
        },
      };
    });
  };

  const deleteBeatForCurrent = (id: string) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const list = prev.beatsByCampaignId[currentCampaign.id] ?? [];
      return {
        ...prev,
        beatsByCampaignId: {
          ...prev.beatsByCampaignId,
          [currentCampaign.id]: list.filter((beat) => beat.id !== id),
        },
      };
    });
  };

  const addSrdMonsterToEncounter = (
    encounterId: string,
    monsterId: string,
    options?: { count?: number }
  ) => {
    const monster = SRD_MONSTERS_BY_ID.get(monsterId);
    if (!monster) return;
    const count = Math.max(1, options?.count ?? 1);
    const slotId = `slot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    addEncounterCreatureSlot(encounterId, {
      id: slotId,
      name: monster.name,
      count,
      xpEach: monster.xp,
      srdMonsterId: monster.id,
    });

    const runState = getEncounterRunState(encounterId);
    if (!runState) return;

    const hp = monster.hit_points ?? null;
    const newCombatants: EncounterCombatant[] = [];
    for (let i = 1; i <= count; i += 1) {
      newCombatants.push({
        id: `cmb-${slotId}-${i}`,
        name: count > 1 ? `${monster.name} #${i}` : monster.name,
        kind: "monster",
        sourceSlotId: slotId,
        initiative: null,
        maxHp: hp,
        currentHp: hp,
        isDefeated: false,
      });
    }

    updateEncounterRunState(encounterId, (state) => {
      const combatants = [...state.combatants, ...newCombatants];
      const currentIndex =
        state.combatants.length === 0
          ? 0
          : Math.min(state.currentIndex, combatants.length - 1);
      return { ...state, combatants, currentIndex };
    });
  };

  const deleteCampaign = (
    id: string,
    _options: { removeChildren?: boolean } = {}
  ): DeleteCascadeResult => {
    let cascade = createCascadeResult();
    setState((prev) => {
      const { state: nextState, result } = applyCampaignRemoval(prev, id);
      cascade = result;
      return nextState;
    });
    return cascade;
  };

  const updateCampaign = (
    id: string,
    updater: (campaign: Campaign) => Campaign
  ) => {
    setState((prev) => {
      const nextCampaigns = prev.campaigns.map((campaign) =>
        campaign.id === id
          ? { ...updater(campaign), updatedAt: new Date().toISOString() }
          : campaign
      );
      return {
        ...prev,
        campaigns: nextCampaigns,
      };
    });
  };

  const createCampaign = (name: string, mode: Campaign["mode"] = "campaign") => {
    const now = new Date().toISOString();
    const id = `camp-${Date.now()}`;
    const campaign: Campaign = {
      id,
      name,
      mode,
      createdAt: now,
      updatedAt: now,
    };
    const defaultArc = createArcRecord(id, "Act I", 0);
    const defaultSession = createSessionRecord(id, "Session 1", defaultArc.id);
    setState((prev) => ({
      ...prev,
      campaigns: [...prev.campaigns, campaign],
      currentCampaignId: id,
      sessionsByCampaignId: {
        ...prev.sessionsByCampaignId,
        [id]: [defaultSession],
      },
      arcsByCampaignId: {
        ...prev.arcsByCampaignId,
        [id]: [defaultArc],
      },
      currentSessionIdByCampaignId: {
        ...prev.currentSessionIdByCampaignId,
        [id]: defaultSession.id,
      },
      entitiesByCampaignId: {
        ...prev.entitiesByCampaignId,
        [id]: [],
      },
      beatsByCampaignId: {
        ...prev.beatsByCampaignId,
        [id]: [],
      },
    }));
    return campaign;
  };

  const createNoteForCurrent = (options?: {
    scopeType?: NoteScopeType;
    scopeId?: string | null;
  }) => {
    if (!currentCampaign) return null;
    const now = new Date().toISOString();
    const id = `note-${Date.now()}`;
    const emptyDoc: NoteDoc = { version: 1, blocks: [] };
    const scopeType = options?.scopeType ?? "campaign";
    let scopeId: string | null = null;
    if (scopeType === "campaign") {
      scopeId = currentCampaign.id;
    } else if (scopeType === "session") {
      scopeId =
        options?.scopeId ||
        state.currentSessionIdByCampaignId[currentCampaign.id] ||
        state.sessionsByCampaignId[currentCampaign.id]?.[0]?.id ||
        null;
      if (!scopeId) return null;
    } else {
      scopeId = options?.scopeId ?? null;
    }

    let order: number | null = null;
    if (scopeType === "scene" && scopeId) {
      const existingScenes =
        state.notesByCampaignId[currentCampaign.id]?.filter(
          (note) => note.scopeType === "scene" && note.scopeId === scopeId
        ) ?? [];
      let maxOrder = -1;
      existingScenes.forEach((scene) => {
        const value = typeof scene.order === "number" ? scene.order : -1;
        if (value > maxOrder) maxOrder = value;
      });
      order = maxOrder + 1;
    }

    const noteBase: Note = {
      id,
      title: "Untitled",
      campaignId: currentCampaign.id,
      scopeType,
      scopeId,
      tags: [],
      doc: emptyDoc,
      entityRefs: [],
      order,
      createdAt: now,
      updatedAt: now,
    };
    const note = hydrateNote(noteBase);
    setState((prev) => {
      const existing = prev.notesByCampaignId[currentCampaign.id] ?? [];
      return {
        ...prev,
        notesByCampaignId: {
          ...prev.notesByCampaignId,
          [currentCampaign.id]: [...existing, note],
        },
      };
    });
    return note;
  };

  const updateNoteForCurrent = (id: string, updater: (note: Note) => Note) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const list = prev.notesByCampaignId[currentCampaign.id] ?? [];
      const nextList = list.map((n) =>
        n.id === id
          ? {
              ...hydrateNote(updater(n)),
              updatedAt: new Date().toISOString(),
            }
          : n
      );
      return {
        ...prev,
        notesByCampaignId: {
          ...prev.notesByCampaignId,
          [currentCampaign.id]: nextList,
        },
      };
    });
  };

  const deleteNoteForCurrent = (id: string) => {
    if (!currentCampaign) return;
    setState((prev) => {
      const list = prev.notesByCampaignId[currentCampaign.id] ?? [];
      const targetNote = list.find((n) => n.id === id);
      if (!targetNote) return prev;
      let nextNotes = list.filter((n) => n.id !== id);
      let nextEntities = prev.entitiesByCampaignId[currentCampaign.id] ?? [];
      let nextBeats = prev.beatsByCampaignId[currentCampaign.id] ?? [];
      let nextSessions = prev.sessionsByCampaignId[currentCampaign.id] ?? [];

      if (targetNote.scopeType === "scene") {
        nextEntities = nextEntities.map((entity) =>
          entity.kind === "encounter" && entity.sceneNoteId === id
            ? { ...entity, sceneNoteId: null, updatedAt: new Date().toISOString() }
            : entity
        );
        nextBeats = nextBeats.map((beat) => {
          if (beat.sceneNoteId === id || beat.noteId === id) {
            return {
              ...beat,
              sceneNoteId: beat.sceneNoteId === id ? null : beat.sceneNoteId ?? null,
              noteId: beat.noteId === id ? null : beat.noteId ?? null,
              updatedAt: new Date().toISOString(),
            };
          }
          return beat;
        });
        if (targetNote.scopeId) {
          const remainingScenes = nextNotes
            .filter(
              (note) =>
                note.scopeType === "scene" && note.scopeId === targetNote.scopeId
            )
            .sort((a, b) => {
              const orderA =
                typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
              const orderB =
                typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
              if (orderA !== orderB) return orderA - orderB;
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            });
          const orderMap = new Map<string, number>();
          remainingScenes.forEach((scene, index) => {
            orderMap.set(scene.id, index);
          });
          nextNotes = nextNotes.map((note) =>
            orderMap.has(note.id)
              ? { ...note, order: orderMap.get(note.id)! }
              : note
          );
        }
      } else {
        nextBeats = nextBeats.map((beat) =>
          beat.noteId === id ? { ...beat, noteId: null, updatedAt: new Date().toISOString() } : beat
        );
      }

      if (targetNote.scopeType === "session" && targetNote.scopeId) {
        nextSessions = nextSessions.map((session) =>
          session.id === targetNote.scopeId && session.primaryNoteId === id
            ? { ...session, primaryNoteId: null, updatedAt: new Date().toISOString() }
            : session
        );
      }

      return {
        ...prev,
        notesByCampaignId: {
          ...prev.notesByCampaignId,
          [currentCampaign.id]: nextNotes,
        },
        entitiesByCampaignId: {
          ...prev.entitiesByCampaignId,
          [currentCampaign.id]: nextEntities,
        },
        beatsByCampaignId: {
          ...prev.beatsByCampaignId,
          [currentCampaign.id]: nextBeats,
        },
        sessionsByCampaignId: {
          ...prev.sessionsByCampaignId,
          [currentCampaign.id]: nextSessions,
        },
      };
    });
  };

  const value: DmContextValue = {
    state,
    currentCampaign,
    arcsForCurrent,
    notesForCurrent,
    sessionsForCurrent,
    currentSession,
    npcsForCurrent,
    factionsForCurrent,
    mapsForCurrent,
    entitiesForCurrent,
    beatsForCurrent,
    encountersForCurrent,
    npcMapForCurrent,
    getEncounterRunState,
    startEncounterRun,
    updateEncounterRunState,
    endEncounterRun,
    setCurrentCampaignId,
    setCurrentSessionId,
    createCampaign,
    deleteCampaign,
    updateCampaign,
    createSession,
    setPrimarySessionNote,
    deleteSession,
    createArcForCurrent,
    updateArcForCurrent,
    deleteArcForCurrent,
    assignSessionToArc,
    createEntity,
    updateEntity,
    deleteEntity,
    createNoteForCurrent,
    updateNoteForCurrent,
    deleteNoteForCurrent,
    createBeatForCurrent,
    updateBeatForCurrent,
    deleteBeatForCurrent,
    createEncounterForCurrentSession,
    updateEncounterForCurrent,
    deleteEncounterForCurrent,
    addEncounterCreatureSlot,
    addSrdMonsterToEncounter,
    updateEncounterCreatureSlot,
    removeEncounterCreatureSlot,
    createMapForCurrent,
    updateMapForCurrent,
    deleteMapForCurrent,
    getMapById,
    addEncounterCombatant: (
      encounterId,
      combatantInput
    ) => {
      const runState =
        getEncounterRunState(encounterId) ?? startEncounterRun(encounterId);
      if (!runState) return;
      updateEncounterRunState(encounterId, (state) => {
        const combatants = [
          ...state.combatants,
          {
            id: `cmb-pc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: combatantInput.name,
            kind: combatantInput.kind,
            initiative: combatantInput.initiative ?? null,
            maxHp: combatantInput.maxHp ?? null,
            currentHp:
              combatantInput.currentHp ?? combatantInput.maxHp ?? null,
            isDefeated: false,
          },
        ];
        return { ...state, combatants };
      });
    },
    updateEncounterCombatant: (encounterId, combatantId, updater) => {
      updateEncounterRunState(encounterId, (state) => {
        const combatants = state.combatants.map((combatant) =>
          combatant.id === combatantId ? updater(combatant) : combatant
        );
        return { ...state, combatants };
      });
    },
    removeEncounterCombatant: (encounterId, combatantId) => {
      updateEncounterRunState(encounterId, (state) => {
        const combatants = state.combatants.filter(
          (combatant) => combatant.id !== combatantId
        );
        let currentIndex = state.currentIndex;
        if (currentIndex >= combatants.length) {
          currentIndex = Math.max(0, combatants.length - 1);
        }
        return { ...state, combatants, currentIndex };
      });
    },
  };

  return <DmContext.Provider value={value}>{children}</DmContext.Provider>;
};

export const useDmContext = () => {
  const ctx = useContext(DmContext);
  if (!ctx) {
    throw new Error("useDmContext must be used within a DmProvider");
  }
  return ctx;
};

