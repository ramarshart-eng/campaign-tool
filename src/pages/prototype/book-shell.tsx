// src/pages/prototype/book-shell.tsx

import React from "react";
import type { NextPage } from "next";
import dynamic from "next/dynamic";

// Point the prototype at the classic (pre-PlayArea) book shell for verification
const BookShell = dynamic(() => import("@/lib/components/BookShell"), { ssr: false });

const BookShellPrototypePage: NextPage = () => {
  return (
    <main>
      <BookShell />
    </main>
  );
};

export default BookShellPrototypePage;
