import React from "react";
import Head from "next/head";
import PlayerNav, { PlayerPageId } from "@/lib/components/layout/PlayerNav";

interface PlayerLayoutProps {
  title: string;
  activePage: PlayerPageId;
  children: React.ReactNode;
}

const PlayerLayout: React.FC<PlayerLayoutProps> = ({
  title,
  activePage,
  children,
}) => {
  return (
    <div className="player-layout">
      <Head>
        <title>{`${title} - Player View`}</title>
      </Head>
      <PlayerNav active={activePage} />
      <main className="player-layout__main">{children}</main>
    </div>
  );
};

export default PlayerLayout;
