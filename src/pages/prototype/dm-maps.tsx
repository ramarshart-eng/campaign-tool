import React from "react";
import type { NextPage } from "next";
import DmLayout from "@/lib/components/layout/DmLayout";
import BattlemapWorkbench from "@/lib/components/battlemap/BattlemapWorkbench";

const DmMapsPage: NextPage = () => {
  return (
    <DmLayout title="Maps & Locations" activePage="maps">
      <div className="dm-maps">
        <div className="dm-maps__body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <BattlemapWorkbench />
        </div>
      </div>
    </DmLayout>
  );
};

export default DmMapsPage;
