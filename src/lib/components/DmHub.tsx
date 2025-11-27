import React from "react";
import Link from "next/link";
import { useDmContext } from "@/lib/context/DmContext";

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
      href: "/prototype/dm-notes",
      action: "Open Notes",
  },
  {
    title: "Session Planner",
    description: "Outline scenes, pacing, and prep for the next session.",
    href: "/prototype/dm-session-planner",
    action: "Open Planner",
  },
  {
    title: "Play Screen",
    description: "Run the session with live notes and encounters.",
    href: "/prototype/dm-play",
    action: "Open Play Screen",
  },
  {
    title: "Campaign Planner",
    description: "Track arcs, factions, and long-term story beats.",
      href: "/prototype/dm-campaign",
      action: "Open Campaign Planner",
    },
    {
      title: "Encounters",
      description: "Design combat or social encounters for upcoming sessions.",
      href: "/prototype/dm-encounters",
      action: "View Encounters",
    },
    {
      title: "Maps & Locations",
      description: "Manage battle maps and key world locations.",
      href: "/prototype/dm-maps",
      action: "Open Maps",
    },
    {
      title: "Player View",
      description: "See what players can access right now.",
      href: "/prototype/player-notes",
      action: "Open Player View",
    },
  ];

  if (!currentCampaign) {
    return <div className="dm-hub loading">Loading DM workspace...</div>;
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
      <div className="dm-hub">
      <header className="dm-hub__header">
        <div>
          <h1>DM Dashboard</h1>
          <p>Manage your campaign from one central place.</p>
        </div>
        <div className="dm-hub__header-actions">
          <label>
            Campaign:
            <select
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
          <button type="button" className="btn-primary" onClick={handleCreateCampaign}>
            New Campaign
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setCampaignDeleteModalOpen(true)}
            disabled={!state.campaigns.length}
          >
            Delete Campaign
          </button>
        </div>
      </header>

      <section className="dm-hub__session-bar">
        <div className="dm-hub__session-info">
          <label>
            Session:
            <select
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
            className="btn-primary"
            onClick={handleCreateSession}
          >
            New Session
          </button>
        </div>
        <div>
          <span>
            Total notes: {notesForCurrent.length} • Campaign notes:{" "}
            {campaignNotes.length} • Session notes: {sessionNotes.length}
          </span>
        </div>
      </section>

      <div className="dm-hub__body">
        <section className="dm-hub__column">
          <article className="dm-hub__card">
            <div>
              <h2>{currentCampaign.name}</h2>
              <p>{currentCampaign.mode === "one-shot" ? "One-shot" : "Campaign"} mode</p>
            </div>
            <div className="dm-hub__stats">
              <div>
                <strong>{sessionsForCurrent.length}</strong>
                <span>Sessions</span>
              </div>
              <div>
                <strong>{campaignNotes.length}</strong>
                <span>Campaign notes</span>
              </div>
              <div>
                <strong>{sessionNotes.length}</strong>
                <span>Session notes</span>
              </div>
            </div>
          </article>

          <article className="dm-hub__card">
            <h3>Recent Notes</h3>
            <ul>
              {recentNotes.length === 0 && <li>No notes yet.</li>}
              {recentNotes.map((note) => (
                <li key={note.id}>
                  <div>
                    <strong>{note.title || "Untitled"}</strong>{" "}
                    <span className="dm-hub__badge">{note.scopeType}</span>
                  </div>
                  <small>
                    Updated {new Date(note.updatedAt).toLocaleString()}
                  </small>
                </li>
              ))}
            </ul>
            <Link className="btn-primary" href="/prototype/dm-notes">
              View all notes
            </Link>
          </article>

          <article className="dm-hub__card">
            <h3>Quick Actions</h3>
            <div className="dm-hub__quick-actions">
              <Link href="/prototype/dm-notes" className="btn-primary">
                Open Notes Book
              </Link>
              <Link href="/prototype/player-notes" className="btn-primary">
                Open Player View
              </Link>
            </div>
          </article>
        </section>

        <section className="dm-hub__column">
          <div className="dm-hub__tiles">
            {featureTiles.map((tile) => (
              <Link key={tile.title} href={tile.href} className="dm-hub__tile">
                <h4>{tile.title}</h4>
                <p>{tile.description}</p>
                <span>{tile.action}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      </div>
      {campaignDeleteModalOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content">
            <h3>Delete Campaign</h3>
            <p>
              Delete <strong>{currentCampaign.name}</strong>? This removes all data for
              the campaign.
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
              <button type="button" onClick={() => setCampaignDeleteModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
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
