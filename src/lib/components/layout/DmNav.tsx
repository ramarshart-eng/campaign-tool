import React from "react";
import Link from "next/link";
import { useDmContext } from "@/lib/context/DmContext";

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
  } = useDmContext();

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

  return (
    <nav className="dm-nav">
      <div className="dm-nav__side dm-nav__side--left">
        <div className="dm-nav__context-group">
          <span className="dm-nav__context-label">Campaign</span>
          <div className="dm-nav__context-value-row">
            <span className="dm-nav__context-value">
              {currentCampaign?.name ?? "None selected"}
            </span>
            {campaignStats ? (
              <span className="dm-nav__context-stats">
                Arcs {campaignStats.arcs} | Sessions {campaignStats.sessions} | Beats {campaignStats.beats}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="dm-nav__inner">
        {navItems.map((item) => (
          <Link
            key={item.id}
            className={`dm-nav__link${item.id === active ? " is-active" : ""}`}
            href={item.href}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="dm-nav__side dm-nav__side--right">
        <div className="dm-nav__context-group">
          <span className="dm-nav__context-label">Session</span>
          <span className="dm-nav__context-value">
            {currentSession?.name ?? "None selected"}
          </span>
        </div>
        <div className="dm-nav__context-group">
          <span className="dm-nav__context-label">Scene</span>
          <span className="dm-nav__context-value">
            {sceneTitle ?? "Not focused"}
          </span>
        </div>
      </div>
    </nav>
  );
};

export default DmNav;
