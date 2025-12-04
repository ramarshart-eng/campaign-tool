import React from "react";
import Link from "next/link";
import { useDmContext } from "@/lib/context/DmContext";
import { useWorkingSession } from "@/lib/hooks/useWorkingSession";

export type DmPageId =
  | "hub"
  | "notes"
  | "session-planner"
  | "play"
  | "campaign"
  | "encounters"
  | "maps"
  | "roster"
  | "player";

interface DmNavProps {
  active: DmPageId;
  sceneTitle?: string;
}

const navItems: { id: DmPageId; label: string; href: string }[] = [
  { id: "hub", label: "Hub", href: "/prototype/dm-hub" },
  { id: "notes", label: "Notes", href: "/prototype/dm-notes" },
  {
    id: "session-planner",
    label: "Session Planner",
    href: "/prototype/dm-session-planner",
  },
  { id: "play", label: "Play Screen", href: "/prototype/dm-play" },
  { id: "campaign", label: "Campaign Planner", href: "/prototype/dm-campaign" },
  { id: "roster", label: "NPCs & Factions", href: "/prototype/dm-roster" },
  { id: "encounters", label: "Encounters", href: "/prototype/dm-encounters" },
  { id: "maps", label: "Maps", href: "/prototype/dm-maps" },
  { id: "player", label: "Player View", href: "/prototype/player-notes" },
];

const DmNav: React.FC<DmNavProps> = ({ active, sceneTitle }) => {
  const {
    currentCampaign,
    currentSession,
    arcsForCurrent,
    sessionsForCurrent,
    beatsForCurrent,
    notesForCurrent,
    setCurrentSessionId,
  } = useDmContext();

  const { buildUrl, setWorkingSession } = useWorkingSession();

  const campaignStats = React.useMemo(() => {
    if (!currentCampaign) return null;
    return {
      arcs: arcsForCurrent.length,
      sessions: sessionsForCurrent.length,
      beats: beatsForCurrent.length,
    };
  }, [
    currentCampaign?.id,
    arcsForCurrent.length,
    sessionsForCurrent.length,
    beatsForCurrent.length,
  ]);

  // Find scene note title if we have a sceneId in URL
  const resolvedSceneTitle = React.useMemo(() => {
    if (sceneTitle) return sceneTitle;
    return null;
  }, [sceneTitle]);

  // Breadcrumb click handlers
  const handleCampaignClick = React.useCallback(() => {
    // Clear session and scene focus, go to hub
    setWorkingSession({ sessionId: undefined, sceneId: undefined, encounterId: undefined });
  }, [setWorkingSession]);

  const handleSessionClick = React.useCallback(() => {
    // Clear scene focus but keep session
    setWorkingSession({ sceneId: undefined, encounterId: undefined });
  }, [setWorkingSession]);

  return (
    <nav className="dm-nav">
      {/* Compact breadcrumb on left */}
      <div className="dm-nav__context">
        <button
          className="dm-nav__crumb"
          onClick={handleCampaignClick}
          title="Go to campaign overview"
        >
          {currentCampaign?.name ?? "No Campaign"}
        </button>
        {currentSession && (
          <>
            <span className="dm-nav__sep">›</span>
            <button
              className="dm-nav__crumb"
              onClick={handleSessionClick}
              title="Go to session overview"
            >
              {currentSession.name}
            </button>
          </>
        )}
        {resolvedSceneTitle && (
          <>
            <span className="dm-nav__sep">›</span>
            <span className="dm-nav__crumb dm-nav__crumb--static">
              {resolvedSceneTitle}
            </span>
          </>
        )}
        {campaignStats && (
          <span className="dm-nav__stats">
            {campaignStats.arcs} arcs · {campaignStats.sessions} sessions · {campaignStats.beats} beats
          </span>
        )}
      </div>

      {/* Centered nav links */}
      <div className="dm-nav__links">
        {navItems.map((item) => (
          <Link
            key={item.id}
            className={`dm-nav__link${item.id === active ? " is-active" : ""}`}
            href={buildUrl(item.href)}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Spacer for centering */}
      <div className="dm-nav__spacer" />
    </nav>
  );
};

export default DmNav;
