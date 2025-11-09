// src/components/Panel.tsx

import React, { useState, type ReactNode } from "react";

interface PanelProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
}

const Panel: React.FC<PanelProps> = ({
  title,
  children,
  defaultOpen = true,
  collapsible = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = open || !collapsible;

  const headerClass = [
    "panel__header",
    isOpen ? "panel__header--border" : "",
    collapsible ? "panel__header--collapsible" : "panel__header--static",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={`panel ${isOpen ? "panel--open" : ""}`}>
      <header
        className={headerClass}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
      >
        <h2 className="panel__title">{title}</h2>
        {collapsible && <span className="panel__toggle">{open ? "-" : "+"}</span>}
      </header>
      {isOpen && <div className="panel__content">{children}</div>}
    </section>
  );
};

export default Panel;

