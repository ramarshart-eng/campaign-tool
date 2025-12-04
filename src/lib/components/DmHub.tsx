import React from "react";
import Link from "next/link";
import { useDmContext } from "@/lib/context/DmContext";
import { useWorkingSession } from "@/lib/hooks/useWorkingSession";

const DmHub: React.FC = () => {
  const {
    state,
    currentCampaign,
    sessionsForCurrent,
    currentSession,
    notesForCurrent,
    setCurrentCampaignId,
    setCurrentSessionId,
    createCampaign,
    createSession,
    deleteCampaign,
  } = useDmContext();
  const { buildUrl } = useWorkingSession();
  const [campaignDeleteModalOpen, setCampaignDeleteModalOpen] = React.useState(false);

  const campaignNotes = notesForCurrent.filter(
    (n) => n.scopeType === "campaign"
  );
  const sessionNotes = currentSession
    ? notesForCurrent.filter(
        (n) => n.scopeType === "session" && n.scopeId === currentSession.id
      )
    : [];
  const recentNotes = [...notesForCurrent]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 3);

  const handleCreateCampaign = () => {
    const name = prompt("Campaign name?", "New Campaign");
    if (!name) return;
    const mode =
      prompt("Mode? (campaign/one-shot)", "campaign") === "one-shot"
        ? "one-shot"
        : "campaign";
    const { id } = createCampaign(name, mode);
    setCurrentCampaignId(id);
  };

  const handleCreateSession = () => {
    const count = sessionsForCurrent.length + 1;
    const name = prompt("Session name?", `Session ${count}`) || `Session ${count}`;
    const session = createSession(name);
    if (session) setCurrentSessionId(session.id);
  };

  const featureTiles = [
    {
      title: "Notes Book",
      description: "Write and organize campaign and session notes.",
      href: buildUrl("/prototype/dm-notes"),
      action: "Open Notes",
  },
  {
    title: "Session Planner",
    description: "Outline scenes, pacing, and prep for the next session.",
    href: buildUrl("/prototype/dm-session-planner"),
    action: "Open Planner",
  },
  {
    title: "Play Screen",
    description: "Run the session with live notes and encounters.",
    href: buildUrl("/prototype/dm-play"),
    action: "Open Play Screen",
  },
  {
    title: "Campaign Planner",
    description: "Track arcs, factions, and long-term story beats.",
      href: buildUrl("/prototype/dm-campaign"),
      action: "Open Campaign Planner",
    },
    {
      title: "Encounters",
      description: "Design combat or social encounters for upcoming sessions.",
      href: buildUrl("/prototype/dm-encounters"),
      action: "View Encounters",
    },
    {
      title: "Maps & Locations",
      description: "Manage battle maps and key world locations.",
      href: buildUrl("/prototype/dm-maps"),
      action: "Open Maps",
    },
    {
      title: "Player View",
      description: "See what players can access right now.",
      href: buildUrl("/prototype/player-notes"),
      action: "Open Player View",
    },
  ];

  if (!currentCampaign) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="empty-state__title">Loading DM workspace...</span>
        </div>
      </div>
    );
  }

  const campaignDeleteSummary = React.useMemo(() => {
    const id = currentCampaign.id;
    const sessionCount = state.sessionsByCampaignId[id]?.length ?? 0;
    const arcCount = state.arcsByCampaignId[id]?.length ?? 0;
    const noteCount = state.notesByCampaignId[id]?.length ?? 0;
    const beatCount = state.beatsByCampaignId[id]?.length ?? 0;
    const entities = state.entitiesByCampaignId[id] ?? [];
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
    currentCampaign.id,
    state.sessionsByCampaignId,
    state.arcsByCampaignId,
    state.notesByCampaignId,
    state.beatsByCampaignId,
    state.entitiesByCampaignId,
  ]);

  return (
    <>
      <div className="page">
        {/* Header */}
        <header className="card flex items-center justify-between">
          <div>
            <h1 className="page__title">DM Dashboard</h1>
            <p className="text-muted text-sm mt-sm">Manage your campaign from one central place.</p>
          </div>
          <div className="flex items-center gap-sm">
            <label className="flex items-center gap-xs text-sm">
              Campaign:
              <select
                className="select"
                value={currentCampaign.id}
                onChange={(e) => setCurrentCampaignId(e.target.value)}
              >
                {state.campaigns.map((camp) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn--primary" onClick={handleCreateCampaign}>
              New Campaign
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setCampaignDeleteModalOpen(true)}
              disabled={!state.campaigns.length}
            >
              Delete
            </button>
          </div>
        </header>

        {/* Session Bar */}
        <section className="card flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <label className="flex items-center gap-xs text-sm">
              Session:
              <select
                className="select"
                value={currentSession?.id || ""}
                onChange={(e) => setCurrentSessionId(e.target.value)}
              >
                {sessionsForCurrent.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn"
              onClick={handleCreateSession}
            >
              New Session
            </button>
          </div>
          <div className="text-sm text-muted">
            <span>
              {notesForCurrent.length} notes total · {campaignNotes.length} campaign · {sessionNotes.length} session
            </span>
          </div>
        </section>

        {/* Main Body */}
        <div className="page__body">
          {/* Left Column - Summary Cards */}
          <section className="page__sidebar">
            <article className="card">
              <div className="card__header">
                <h2 className="card__title">{currentCampaign.name}</h2>
                <span className="badge badge--muted">
                  {currentCampaign.mode === "one-shot" ? "One-shot" : "Campaign"}
                </span>
              </div>
              <div className="card__body">
                <div className="grid-3">
                  <div className="text-center">
                    <strong className="text-lg">{sessionsForCurrent.length}</strong>
                    <span className="text-xs text-muted block">Sessions</span>
                  </div>
                  <div className="text-center">
                    <strong className="text-lg">{campaignNotes.length}</strong>
                    <span className="text-xs text-muted block">Camp. Notes</span>
                  </div>
                  <div className="text-center">
                    <strong className="text-lg">{sessionNotes.length}</strong>
                    <span className="text-xs text-muted block">Sess. Notes</span>
                  </div>
                </div>
              </div>
            </article>

            <article className="card">
              <div className="card__header">
                <h3 className="card__title">Recent Notes</h3>
              </div>
              <div className="card__body">
                <ul className="list">
                  {recentNotes.length === 0 && (
                    <li className="text-muted text-sm">No notes yet.</li>
                  )}
                  {recentNotes.map((note) => (
                    <li key={note.id} className="list-item">
                      <div className="flex-1">
                        <div className="flex items-center gap-xs">
                          <strong className="text-sm">{note.title || "Untitled"}</strong>
                          <span className="badge badge--muted">{note.scopeType}</span>
                        </div>
                        <small className="text-xs text-muted">
                          Updated {new Date(note.updatedAt).toLocaleString()}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link className="btn btn--full mt-sm" href={buildUrl("/prototype/dm-notes")}>
                  View all notes
                </Link>
              </div>
            </article>

            <article className="card">
              <div className="card__header">
                <h3 className="card__title">Quick Actions</h3>
              </div>
              <div className="card__body">
                <div className="flex flex-col gap-xs">
                  <Link href={buildUrl("/prototype/dm-notes")} className="btn btn--full">
                    Open Notes Book
                  </Link>
                  <Link href={buildUrl("/prototype/player-notes")} className="btn btn--full">
                    Open Player View
                  </Link>
                </div>
              </div>
            </article>
          </section>

          {/* Right Column - Feature Tiles */}
          <section className="page__main">
            <div className="grid-auto">
              {featureTiles.map((tile) => (
                <Link key={tile.title} href={tile.href} className="card card--interactive">
                  <h4 className="font-semibold">{tile.title}</h4>
                  <p className="text-sm text-muted">{tile.description}</p>
                  <span className="text-sm font-medium mt-sm" style={{ color: 'var(--focus-color)' }}>
                    {tile.action} →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
      {campaignDeleteModalOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content card">
            <h3 className="card__title mb-md">Delete Campaign</h3>
            <p className="text-sm mb-sm">
              Delete <strong>{currentCampaign.name}</strong>? This removes all data for
              the campaign.
            </p>
            <ul className="list mb-md">
              <li className="list-item text-sm">
                {campaignDeleteSummary.arcs} arc{campaignDeleteSummary.arcs === 1 ? "" : "s"}
              </li>
              <li className="list-item text-sm">
                {campaignDeleteSummary.sessions} session{campaignDeleteSummary.sessions === 1 ? "" : "s"}
              </li>
              <li className="list-item text-sm">
                {campaignDeleteSummary.notes} note{campaignDeleteSummary.notes === 1 ? "" : "s"}
              </li>
              <li className="list-item text-sm">
                {campaignDeleteSummary.encounters} encounter{campaignDeleteSummary.encounters === 1 ? "" : "s"}
              </li>
              <li className="list-item text-sm">
                {campaignDeleteSummary.maps} map{campaignDeleteSummary.maps === 1 ? "" : "s"}
              </li>
              <li className="list-item text-sm">
                {campaignDeleteSummary.beats} beat{campaignDeleteSummary.beats === 1 ? "" : "s"}
              </li>
            </ul>
            <div className="flex gap-sm justify-end">
              <button type="button" className="btn" onClick={() => setCampaignDeleteModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  deleteCampaign(currentCampaign.id);
                  setCampaignDeleteModalOpen(false);
                }}
              >
                Delete Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DmHub;
