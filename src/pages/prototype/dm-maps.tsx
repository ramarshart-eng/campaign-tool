import React from "react";
import type { NextPage } from "next";
import DmLayout from "@/lib/components/layout/DmLayout";
import BattlemapWorkbench from "@/lib/components/battlemap/BattlemapWorkbench";
import { useDmContext } from "@/lib/context/DmContext";

const DmMapsPage: NextPage = () => {
  const { mapsForCurrent } = useDmContext();
  const [selectedMapId, setSelectedMapId] = React.useState<string | null>(
    () => mapsForCurrent[0]?.id ?? null
  );

  return (
    <DmLayout title="Maps & Locations" activePage="maps">
      <div className="dm-maps">
        <div className="dm-maps__body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {selectedMapId && <BattlemapWorkbench mapId={selectedMapId} />}
        </div>
      </div>
    </DmLayout>
  );
};

export default DmMapsPage;
