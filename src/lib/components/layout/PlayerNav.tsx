import React from "react";
import Link from "next/link";

export type PlayerPageId = "player-notes" | "player-characters" | "player-play";

interface PlayerNavProps {
  active: PlayerPageId;
}

const navItems: { id: PlayerPageId; label: string; href: string }[] = [
  { id: "player-notes", label: "Notes", href: "/prototype/player-notes" },
  { id: "player-characters", label: "Characters", href: "/prototype/player-characters" },
  { id: "player-play", label: "Play", href: "/prototype/player-play" },
];

const PlayerNav: React.FC<PlayerNavProps> = ({ active }) => {
  return (
    <nav className="dm-nav">
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
    </nav>
  );
};

export default PlayerNav;
