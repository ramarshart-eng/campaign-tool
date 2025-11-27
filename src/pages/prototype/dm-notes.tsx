import React from "react";
import type { NextPage } from "next";
import DmNotesBook from "@/lib/components/DmNotesBook";
import DmLayout from "@/lib/components/layout/DmLayout";

const DmNotesPrototypePage: NextPage = () => {
  return (
    <DmLayout title="Notes Book" activePage="notes">
      <DmNotesBook />
    </DmLayout>
  );
};

export default DmNotesPrototypePage;
