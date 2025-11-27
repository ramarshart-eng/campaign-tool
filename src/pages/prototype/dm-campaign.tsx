import React from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { useDmContext } from "@/lib/context/DmContext";
import DmLayout from "@/lib/components/layout/DmLayout";
import type { CampaignArc, CampaignBeat, Session } from "@/lib/types/dm";

const DmCampaignPlannerPage: NextPage = () => {
  const {
    state,
    currentCampaign,
    arcsForCurrent,
    sessionsForCurrent,
    beatsForCurrent,
    createArcForCurrent,
    updateArcForCurrent,
    deleteArcForCurrent,
    assignSessionToArc,
    createSession,
    createBeatForCurrent,
    updateBeatForCurrent,
    updateCampaign,
    deleteCampaign,
  } = useDmContext();

  const [selectedArcId, setSelectedArcId] = React.useState<string | null>(null);
  const [newBeatTitle, setNewBeatTitle] = React.useState("");
  const [newBeatSummary, setNewBeatSummary] = React.useState("");
  const [campaignDeleteModalOpen, setCampaignDeleteModalOpen] = React.useState(false);
  const [arcDeleteModal, setArcDeleteModal] = React.useState<{
    arcId: string | null;
    removeChildren: boolean;
  }>({ arcId: null, removeChildren: false });

  React.useEffect(() => {
    if (!arcsForCurrent.length) {
      setSelectedArcId(null);
      return;
    }
    if (
      selectedArcId &&
      arcsForCurrent.some((arc) => arc.id === selectedArcId)
    ) {
      return;
    }
    setSelectedArcId(arcsForCurrent[0].id);
  }, [arcsForCurrent, selectedArcId]);

  const selectedArc =
    arcsForCurrent.find((arc) => arc.id === selectedArcId) ?? null;

  const {
    arcsByCampaignId,
    sessionsByCampaignId,
    notesByCampaignId,
    entitiesByCampaignId,
    beatsByCampaignId,
  } = state;

  const campaignDeleteSummary = React.useMemo(() => {
    if (!currentCampaign) return null;
    const id = currentCampaign.id;
    const sessionCount = sessionsByCampaignId[id]?.length ?? 0;
    const arcCount = arcsByCampaignId[id]?.length ?? 0;
    const noteCount = notesByCampaignId[id]?.length ?? 0;
    const beatCount = beatsByCampaignId[id]?.length ?? 0;
    const entities = entitiesByCampaignId[id] ?? [];
    const encounterCount = entities.filter((entity) => entity.kind === "encounter").length;
    const mapCount = entities.filter((entity) => entity.kind === "map").length;
    return {
      sessions: sessionCount,
      arcs: arcCount,
      notes: noteCount,
      beats: beatCount,
      encounters: encounterCount,
      maps: mapCount,
    };
  }, [
    currentCampaign?.id,
    arcsByCampaignId,
    beatsByCampaignId,
    entitiesByCampaignId,
    notesByCampaignId,
    sessionsByCampaignId,
  ]);

  const beatsByArc = React.useMemo(() => {
    const map = new Map<string, CampaignBeat[]>();
    beatsForCurrent.forEach((beat) => {
      if (!beat.arcId) return;
      const list = map.get(beat.arcId) ?? [];
      list.push(beat);
      map.set(beat.arcId, list);
    });
    return map;
  }, [beatsForCurrent]);

  const sessionsByArc = React.useMemo(() => {
    const map = new Map<string, Session[]>();
    sessionsForCurrent.forEach((session) => {
      const key = session.arcId ?? "__unassigned__";
      const list = map.get(key) ?? [];
      list.push(session);
      map.set(key, list);
    });
    return map;
  }, [sessionsForCurrent]);

  const arcDeleteDetails = React.useMemo(() => {
    if (!arcDeleteModal.arcId) return null;
    const sessionCount = sessionsForCurrent.filter(
      (session) => session.arcId === arcDeleteModal.arcId
    ).length;
    const beatCount = beatsForCurrent.filter(
      (beat) => beat.arcId === arcDeleteModal.arcId && !beat.sessionId
    ).length;
    const arcName =
      arcsForCurrent.find((arc) => arc.id === arcDeleteModal.arcId)?.name ??
      "this arc";
    return { sessionCount, beatCount, arcName };
  }, [arcDeleteModal.arcId, arcsForCurrent, beatsForCurrent, sessionsForCurrent]);

  const arcBeats = React.useMemo(() => {
    if (!selectedArcId) return [];
    return (beatsByArc.get(selectedArcId) ?? []).filter(
      (beat) => !beat.sessionId
    );
  }, [beatsByArc, selectedArcId]);

  const handleCreateArc = () => {
    const created = createArcForCurrent();
    if (created) {
      setSelectedArcId(created.id);
    }
  };

  const handleUpdateArc = (updater: (arc: CampaignArc) => CampaignArc) => {
    if (!selectedArc) return;
    updateArcForCurrent(selectedArc.id, updater);
  };

  const handleOpenArcDeleteModal = () => {
    if (!selectedArc) return;
    setArcDeleteModal({ arcId: selectedArc.id, removeChildren: false });
  };

  const handleCloseArcDeleteModal = () => {
    setArcDeleteModal({ arcId: null, removeChildren: false });
  };

  const handleConfirmArcDelete = () => {
    if (!arcDeleteModal.arcId) return;
    deleteArcForCurrent(arcDeleteModal.arcId, {
      removeChildren: arcDeleteModal.removeChildren,
    });
    if (arcDeleteModal.arcId === selectedArcId) {
      setSelectedArcId(null);
    }
    handleCloseArcDeleteModal();
  };

  const handleCreateSession = () => {
    const sessionNumber = sessionsForCurrent.length + 1;
    createSession(`Session ${sessionNumber}`);
  };

  const handleAddArcBeat = () => {
    if (!selectedArcId || !newBeatTitle.trim()) return;
    const created = createBeatForCurrent({
      title: newBeatTitle.trim(),
      summary: newBeatSummary.trim() || undefined,
      arcId: selectedArcId,
      sessionId: null,
    });
    if (created) {
      setNewBeatTitle("");
      setNewBeatSummary("");
    }
  };

  const handleCycleBeatStatus = (beatId: string) => {
    const beat = beatsForCurrent.find((b) => b.id === beatId);
    if (!beat) return;
    const nextStatus: CampaignBeat["status"] =
      beat.status === "planned"
        ? "in-progress"
        : beat.status === "in-progress"
        ? "done"
        : "planned";
    updateBeatForCurrent(beatId, (prev) => ({
      ...prev,
      status: nextStatus,
    }));
  };

  const handleConfirmCampaignDelete = () => {
    if (!currentCampaign) return;
    deleteCampaign(currentCampaign.id);
    setCampaignDeleteModalOpen(false);
    setSelectedArcId(null);
  };

  if (!currentCampaign) {
    return (
      <DmLayout title="Campaign Planner" activePage="campaign">
        <div className="dm-campaign dm-campaign--empty">
          <p>No campaign selected.</p>
        </div>
      </DmLayout>
    );
  }

  return (
    <>
      <DmLayout title="Campaign Planner" activePage="campaign">
      <div className="dm-campaign">

        <div className="dm-campaign__grid">
          <section className="dm-campaign__column dm-campaign__column--left">
            <div className="dm-campaign__column-header">
              <h3>Story Arcs</h3>
              <button type="button" className="btn-primary" onClick={handleCreateArc}>
                New Arc
              </button>
            </div>
            <ul className="dm-campaign__arc-list">
              {arcsForCurrent.map((arc) => (
                <li key={arc.id}>
                  <button
                    type="button"
                    className={`dm-campaign__arc${
                      arc.id === selectedArcId ? " is-active" : ""
                    }`}
                    onClick={() => setSelectedArcId(arc.id)}
                  >
                    <div>
                      <strong>{arc.name}</strong>
                      <small>
                        {(sessionsByArc.get(arc.id)?.length ?? 0)} sessions ·{" "}
                        {(beatsByArc.get(arc.id)?.length ?? 0)} beats
                      </small>
                    </div>
                  </button>
                </li>
              ))}
              {arcsForCurrent.length === 0 && (
                <li>
                  <p>No arcs yet. Create one to begin organizing.</p>
                </li>
              )}
            </ul>
          </section>

          <section className="dm-campaign__column dm-campaign__column--center">
            <div className="dm-campaign__column-header">
              <h3>Sessions Timeline</h3>
              <button type="button" className="btn-primary" onClick={handleCreateSession}>
                New Session
              </button>
            </div>
            <div className="dm-campaign__timeline">
              {arcsForCurrent.map((arc) => {
                const sessions = sessionsByArc.get(arc.id) ?? [];
                return (
                  <article key={arc.id} className="dm-campaign__timeline-section">
                    <div className="dm-campaign__timeline-header">
                      <div>
                        <h4>{arc.name}</h4>
                        <small>
                          {sessions.length} session{sessions.length === 1 ? "" : "s"}
                        </small>
                      </div>
                    </div>
                    <div className="dm-campaign__session-grid">
                      {sessions.length === 0 && (
                        <p className="dm-campaign__session-empty">
                          No sessions in this arc yet.
                        </p>
                      )}
                      {sessions.map((session) => (
                        <article key={session.id} className="dm-campaign__session-card">
                          <header className="dm-campaign__session-header">
                            <strong>{session.name}</strong>
                            <select
                              value={session.arcId ?? ""}
                              onChange={(event) =>
                                assignSessionToArc(
                                  session.id,
                                  event.target.value || null
                                )
                              }
                            >
                              {arcsForCurrent.map((arcOption) => (
                                <option key={arcOption.id} value={arcOption.id}>
                                  {arcOption.name}
                                </option>
                              ))}
                              <option value="">Unassigned</option>
                            </select>
                          </header>
                          <div className="dm-campaign__session-meta">
                            Updated{" "}
                            {new Date(session.updatedAt).toLocaleDateString()}
                          </div>
                          <div className="dm-campaign__session-links">
                            <Link
                              href={`/prototype/dm-session-planner?sessionId=${session.id}`}
                              className="btn-primary"
                            >
                              Planner
                            </Link>
                            <Link
                              href={`/prototype/dm-play?sessionId=${session.id}`}
                              className="btn-primary"
                            >
                              Play
                            </Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  </article>
                );
              })}
              {(sessionsByArc.get("__unassigned__")?.length ?? 0) > 0 && (
                <article className="dm-campaign__timeline-section">
                  <div className="dm-campaign__timeline-header">
                    <div>
                      <h4>Unassigned</h4>
                      <small>
                        {sessionsByArc.get("__unassigned__")?.length} session
                        {sessionsByArc.get("__unassigned__")?.length === 1 ? "" : "s"}
                      </small>
                    </div>
                  </div>
                  <div className="dm-campaign__session-grid">
                    {sessionsByArc.get("__unassigned__")?.map((session) => (
                      <article key={session.id} className="dm-campaign__session-card">
                        <header className="dm-campaign__session-header">
                          <strong>{session.name}</strong>
                          <select
                            value={session.arcId ?? ""}
                            onChange={(event) =>
                              assignSessionToArc(
                                session.id,
                                event.target.value || null
                              )
                            }
                          >
                            <option value="">Unassigned</option>
                            {arcsForCurrent.map((arcOption) => (
                              <option key={arcOption.id} value={arcOption.id}>
                                {arcOption.name}
                              </option>
                            ))}
                          </select>
                        </header>
                        <div className="dm-campaign__session-meta">
                          Updated{" "}
                          {new Date(session.updatedAt).toLocaleDateString()}
                        </div>
                        <div className="dm-campaign__session-links">
                          <Link
                            href={`/prototype/dm-session-planner?sessionId=${session.id}`}
                            className="btn-primary"
                          >
                            Planner
                          </Link>
                          <Link
                            href={`/prototype/dm-play?sessionId=${session.id}`}
                            className="btn-primary"
                          >
                            Play
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </article>
              )}
            </div>
          </section>

          <section className="dm-campaign__column dm-campaign__column--right">
            {selectedArc ? (
              <div className="dm-campaign__arc-detail">
                <label>
                  Arc name
                  <input
                    type="text"
                    value={selectedArc.name}
                    onChange={(event) =>
                      handleUpdateArc((arc) => ({ ...arc, name: event.target.value }))
                    }
                    placeholder="Act I: The Call"
                  />
                </label>
                <label>
                  Summary
                  <textarea
                    rows={3}
                    value={selectedArc.summary ?? ""}
                    onChange={(event) =>
                      handleUpdateArc((arc) => ({
                        ...arc,
                        summary: event.target.value,
                      }))
                    }
                    placeholder="Overall goals, tone, and stakes."
                  />
                </label>
                <label>
                  Color
                  <input
                    type="color"
                    value={selectedArc.color ?? "#bfbfbf"}
                    onChange={(event) =>
                      handleUpdateArc((arc) => ({
                        ...arc,
                        color: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="dm-campaign__arc-stats">
                  <span>
                    {(sessionsByArc.get(selectedArc.id)?.length ?? 0)} sessions
                  </span>
                  <span>
                    {(beatsByArc.get(selectedArc.id)?.length ?? 0)} beats
                  </span>
                </div>
                <div className="dm-campaign__arc-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleOpenArcDeleteModal}
                  >
                    Delete arc
                  </button>
                </div>
                <div className="dm-campaign__beats">
                  <div className="dm-campaign__beats-header">
                    <h4>Arc beats</h4>
                    <div className="dm-campaign__beats-form">
                      <input
                        type="text"
                        value={newBeatTitle}
                        placeholder="Introduce the prophecy"
                        onChange={(event) => setNewBeatTitle(event.target.value)}
                      />
                      <input
                        type="text"
                        value={newBeatSummary}
                        placeholder="Optional summary"
                        onChange={(event) => setNewBeatSummary(event.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleAddArcBeat}
                        disabled={!newBeatTitle.trim()}
                      >
                        Add beat
                      </button>
                    </div>
                  </div>
                  {arcBeats.length === 0 ? (
                    <p className="dm-campaign__session-empty">
                      No arc-level beats yet.
                    </p>
                  ) : (
                    <ul className="dm-campaign__beat-list">
                      {arcBeats.map((beat) => (
                        <li key={beat.id} className="dm-campaign__beat-row">
                          <button
                            type="button"
                            className={`dm-campaign__beat-status dm-campaign__beat-status--${beat.status}`}
                            onClick={() => handleCycleBeatStatus(beat.id)}
                          >
                            {beat.status}
                          </button>
                          <div>
                            <strong>{beat.title}</strong>
                            {beat.summary && <p>{beat.summary}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="dm-campaign__arc-detail">
                <p>Select an arc to edit its details.</p>
              </div>
            )}
          </section>
        </div>
      </div>
      </DmLayout>
      {campaignDeleteModalOpen && campaignDeleteSummary && currentCampaign && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content">
            <h3>Delete Campaign</h3>
            <p>
              Delete <strong>{currentCampaign.name}</strong>? This will remove all
              related data.
            </p>
            <ul>
              <li>
                {campaignDeleteSummary.arcs} arc
                {campaignDeleteSummary.arcs === 1 ? "" : "s"}
              </li>
              <li>
                {campaignDeleteSummary.sessions} session
                {campaignDeleteSummary.sessions === 1 ? "" : "s"}
              </li>
              <li>
                {campaignDeleteSummary.notes} note
                {campaignDeleteSummary.notes === 1 ? "" : "s"}
              </li>
              <li>
                {campaignDeleteSummary.encounters} encounter
                {campaignDeleteSummary.encounters === 1 ? "" : "s"}
              </li>
              <li>
                {campaignDeleteSummary.maps} map
                {campaignDeleteSummary.maps === 1 ? "" : "s"}
              </li>
              <li>
                {campaignDeleteSummary.beats} beat
                {campaignDeleteSummary.beats === 1 ? "" : "s"}
              </li>
            </ul>
            <div className="modal__actions">
              <button
                type="button"
                onClick={() => setCampaignDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmCampaignDelete}
              >
                Delete Campaign
              </button>
            </div>
          </div>
        </div>
      )}
      {arcDeleteModal.arcId && arcDeleteDetails && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content">
            <h3>Delete Arc</h3>
            <p>
              Delete <strong>{arcDeleteDetails.arcName}</strong>? You can optionally
              cascade remove any sessions under it.
            </p>
            <ul>
              <li>
                {arcDeleteDetails.sessionCount} session
                {arcDeleteDetails.sessionCount === 1 ? "" : "s"}
              </li>
              <li>
                {arcDeleteDetails.beatCount} arc-level beat
                {arcDeleteDetails.beatCount === 1 ? "" : "s"}
              </li>
            </ul>
            <label className="modal__field modal__field--inline">
              <input
                type="checkbox"
                checked={arcDeleteModal.removeChildren}
                onChange={(event) =>
                  setArcDeleteModal((prev) => ({
                    ...prev,
                    removeChildren: event.target.checked,
                  }))
                }
              />
              <span>Also delete sessions, scenes, notes, and encounters tied to this arc.</span>
            </label>
            <div className="modal__actions">
              <button type="button" onClick={handleCloseArcDeleteModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmArcDelete}
              >
                Delete Arc
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DmCampaignPlannerPage;
