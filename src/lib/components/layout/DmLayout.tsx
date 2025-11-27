import React from "react";
import Head from "next/head";
import DmNav, { DmPageId } from "@/lib/components/layout/DmNav";

interface DmLayoutProps {
  title: string;
  activePage: DmPageId;
  sceneTitle?: string;
  children: React.ReactNode;
}

const DmLayout: React.FC<DmLayoutProps> = ({
  title,
  activePage,
  sceneTitle,
  children,
}) => {
  return (
    <div className="dm-layout">
      <Head>
        <title>{`${title} - DM Tools`}</title>
      </Head>
      <DmNav active={activePage} sceneTitle={sceneTitle} />
      <main className="dm-layout__main">
        <div className="dm-layout__content">{children}</div>
      </main>
    </div>
  );
};

export default DmLayout;
