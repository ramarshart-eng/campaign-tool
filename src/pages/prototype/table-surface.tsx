// src/pages/prototype/table-surface.tsx

import React, { useRef } from "react";
import type { NextPage } from "next";
import dynamic from "next/dynamic";
const BookShell = dynamic(() => import("@/lib/components/BookShell"), { ssr: false });

const TableSurfacePrototype: NextPage = () => {
  return (
    <BookShell />
  );
};

export default TableSurfacePrototype;
