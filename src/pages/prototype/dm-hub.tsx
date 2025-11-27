import React from "react";
import type { NextPage } from "next";
import dynamic from "next/dynamic";
import DmLayout from "@/lib/components/layout/DmLayout";

const DmHub = dynamic(() => import("@/lib/components/DmHub"), {
  ssr: false,
});

const DmHubPage: NextPage = () => {
  return (
    <DmLayout title="DM Hub" activePage="hub">
      <DmHub />
    </DmLayout>
  );
};

export default DmHubPage;
