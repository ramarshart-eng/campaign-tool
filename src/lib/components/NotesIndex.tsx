import React from "react";
import { createPortal } from "react-dom";
import type { BookShellSlots } from "@/lib/components/BookShell";

type EntryLite = { id: string; title: string; categoryPath?: string };

type Props = Pick<BookShellSlots, "leftRef" | "rightRef" | "spreadStart" | "setSpreadStart"> & {
  entries: EntryLite[];
  activeId?: string;
  onSelectEntry: (id: string) => void;
  onNewEntry: () => void;
  onDeleteEntry?: (id: string) => void;
  categories: string[];
  onAddCategory: (path: string) => void;
  onRenameCategory: (oldPath: string, newLeaf: string) => void;
  onDeleteCategoryRequest: (path: string) => void;
  onAssignEntry: (id: string, path: string) => void;
  onClearEntryCategory: (id: string) => void;
  onRenameEntry: (id: string, title: string) => void;
  asOverlay?: boolean; // when true, do not mutate leftRef padding variables
};

type CatNode = { name: string; path: string; children: CatNode[] };

const buildTree = (paths: string[]): CatNode[] => {
  const root: CatNode[] = [];
  const map = new Map<string, CatNode>();
  const getOrCreate = (path: string, name: string): CatNode => {
    if (!map.has(path)) {
      const node: CatNode = { name, path, children: [] };
      map.set(path, node);
      if (path.includes(" > ")) {
        const parent = path.substring(0, path.lastIndexOf(" > "));
        const parentNode = map.get(parent);
        if (parentNode) parentNode.children.push(node);
      } else {
        root.push(node);
      }
    }
    return map.get(path)!;
  };
  paths
    .slice()
    .sort()
    .forEach((p) => {
      const parts = p.split(" > ");
      let currPath = "";
      parts.forEach((part, idx) => {
        currPath = idx === 0 ? part : `${currPath} > ${part}`;
        getOrCreate(currPath, part);
      });
    });
  return root;
};

const NotesIndex: React.FC<Props> = ({ leftRef, entries, activeId, onSelectEntry, onNewEntry, onDeleteEntry, categories, onAddCategory, onRenameCategory, onDeleteCategoryRequest, onAssignEntry, onClearEntryCategory, onRenameEntry, asOverlay = false }) => {
  React.useEffect(() => {
    if (leftRef.current) {
      leftRef.current.classList.add("reserve-lines-1");
      if (!asOverlay) leftRef.current.style.setProperty("--extra-top-pad", "0px");
    }
  }, [leftRef, asOverlay]);

  const [menu, setMenu] = React.useState<{ open: boolean; x: number; y: number; id: string | null }>({ open: false, x: 0, y: 0, id: null });
  React.useEffect(() => {
    const onDocClick: EventListener = () => setMenu((m) => ({ ...m, open: false }));
    if (menu.open) {
      document.addEventListener("click", onDocClick, { once: true });
    }
    return () => {
      document.removeEventListener("click", onDocClick);
    };
  }, [menu.open]);

  const [catMenu, setCatMenu] = React.useState<{ open: boolean; x: number; y: number; path: string | null }>({ open: false, x: 0, y: 0, path: null });
  React.useEffect(() => {
    const onDocClick: EventListener = () => setCatMenu((m) => ({ ...m, open: false }));
    if (catMenu.open) {
      document.addEventListener("click", onDocClick, { once: true });
    }
    return () => document.removeEventListener("click", onDocClick);
  }, [catMenu.open]);

  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  const [newSubFor, setNewSubFor] = React.useState<string | null>(null);
  const [newSubName, setNewSubName] = React.useState("");
  const [renameFor, setRenameFor] = React.useState<string | null>(null);
  const [renameName, setRenameName] = React.useState("");
  const [renEntryId, setRenEntryId] = React.useState<string | null>(null);
  const [renEntryName, setRenEntryName] = React.useState("");

  const listRef = React.useRef<HTMLUListElement | null>(null);
  const tree = React.useMemo(() => buildTree(categories), [categories]);
  const uncategorized = React.useMemo(() => entries.filter((e) => !e.categoryPath), [entries]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderEntry = (e: EntryLite, depth: number) => (
    <li key={e.id} className="book__index-row">
      <div style={{ paddingLeft: `${depth * 0.75}rem` }}>
        <button
          type="button"
          className="book__index-label"
          onClick={() => onSelectEntry(e.id)}
          onContextMenu={(ev) => {
            ev.preventDefault();
            setMenu({ open: true, x: ev.clientX, y: ev.clientY, id: e.id });
          }}
          aria-current={activeId === e.id ? "page" : undefined}
          style={{ background: "transparent", border: 0, textAlign: "left", cursor: "pointer" }}
        >
          {e.title || "Untitled"}
        </button>
        {renEntryId === e.id && (
          <div style={{ marginTop: 0 }}>
            <input
              type="text"
              className="book__title-input"
              value={renEntryName}
              onChange={(ev) => setRenEntryName(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  onRenameEntry(e.id, renEntryName.trim());
                  setRenEntryId(null); setRenEntryName("");
                } else if (ev.key === "Escape") {
                  setRenEntryId(null); setRenEntryName("");
                }
              }}
              autoFocus
              aria-label="Rename entry title"
            />
          </div>
        )}
      </div>
      <span className="book__index-page">&nbsp;</span>
    </li>
  );

  const renderCat = (node: CatNode, depth = 0): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const hasEntriesHere = entries.some((e) => (e.categoryPath || "") === node.path);
    const showToggle = hasChildren || hasEntriesHere;
    const isExpanded = expanded.has(node.path);
    return (
      <li key={`cat-${node.path}`} className="book__index-row" style={{ display: "block" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", paddingLeft: `${depth * 0.75}rem` }}>
          {showToggle ? (
            <button type="button" onClick={() => toggle(node.path)} aria-label={isExpanded ? "Collapse" : "Expand"} style={{ width: "1rem" }}>
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : (
            <span style={{ width: "1rem" }} />
          )}
          <button
            type="button"
            className="book__index-label"
            onClick={() => showToggle && toggle(node.path)}
            onContextMenu={(ev) => {
              ev.preventDefault();
              setCatMenu({ open: true, x: ev.clientX, y: ev.clientY, path: node.path });
            }}
            style={{ background: "transparent", border: 0, cursor: "context-menu", textAlign: "left" }}
          >
            {node.name}
          </button>
        </div>
        {renameFor === node.path && (
          <div style={{ paddingLeft: `${(depth + 1) * 0.75}rem`, marginTop: 0 }}>
            <input
              type="text"
              className="book__title-input"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onRenameCategory(node.path, renameName);
                  setRenameFor(null); setRenameName("");
                } else if (e.key === "Escape") {
                  setRenameFor(null); setRenameName("");
                }
              }}
              autoFocus
              aria-label="Rename category"
            />
          </div>
        )}
        {newSubFor === node.path && (
          <div style={{ paddingLeft: `${(depth + 1) * 0.75}rem`, marginTop: 0 }}>
            <input
              type="text"
              className="book__title-input"
              placeholder="New subcategory name"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const parent = node.path;
                  const child = newSubName.trim();
                  if (child) onAddCategory(`${parent} > ${child}`);
                  setNewSubFor(null); setNewSubName("");
                } else if (e.key === "Escape") {
                  setNewSubFor(null); setNewSubName("");
                }
              }}
              autoFocus
              aria-label="New subcategory"
            />
          </div>
        )}
        {showToggle && isExpanded && (
          <ul className="book__index-list" style={{ marginTop: 0 }}>
            {/* Subcategories */}
            {hasChildren && node.children
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => renderCat(c, depth + 1))}
            {/* Entries directly under this category */}
            {entries
              .filter((e) => (e.categoryPath || "") === node.path)
              .map((e) => renderEntry(e, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="book__title">Index</div>
      <div className="book__index-bar mt-1 flex gap-sm items-center">
        <input
          type="text"
          className="input flex-1 min-w-0"
          placeholder="New category (use '>' for subcategories)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = (e.target as HTMLInputElement).value;
              onAddCategory(v);
              (e.target as HTMLInputElement).value = "";
            }
          }}
          aria-label="Add category"
        />
        <button type="button" className="btn btn--primary" onClick={onNewEntry}>New Entry</button>
      </div>
      <div className="book__index">
        <ul
          className="book__index-list"
          style={{ position: "relative" }}
          ref={listRef}
        >
          {/* Categories section (left-aligned header) */}
          <li className="book__index-row">
            <span className="book__index-label" style={{ fontWeight: 600 }}>Categories</span>
            <span className="book__index-page">&nbsp;</span>
          </li>
          {tree.sort((a, b) => a.name.localeCompare(b.name)).map((n) => renderCat(n, 1))}

          {/* Uncategorised section (only when entries exist) */}
          {uncategorized.length > 0 && (
            <>
              <li className="book__index-row">
                <span className="book__index-label" style={{ fontWeight: 600 }}>Uncategorised</span>
                <span className="book__index-page">&nbsp;</span>
              </li>
              {uncategorized.map((e) => renderEntry(e, 1))}
            </>
          )}
          {menu.open && menu.id && createPortal(
            <div
              className="context-menu card"
              style={{ top: `${menu.y}px`, left: `${menu.x}px` }}
              role="menu"
              onContextMenu={(e) => e.preventDefault()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="context-menu__item btn btn--ghost"
                onClick={() => {
                  const id = menu.id as string;
                  setMenu({ open: false, x: 0, y: 0, id: null });
                  const cur = entries.find((en) => en.id === id);
                  setRenEntryId(id);
                  setRenEntryName(cur?.title || "");
                }}
              >
                Rename
              </button>
              <hr />
              <div className="context-menu__item" style={{ fontWeight: 600 }}>Assign to…</div>
              {categories.length === 0 && (
                <div className="context-menu__item" style={{ opacity: 0.7 }}>No categories</div>
              )}
              {categories.map((c) => (
                <button
                  key={`assign-${c}`}
                  type="button"
                  className="context-menu__item btn btn--ghost"
                  onClick={() => {
                    setMenu({ open: false, x: 0, y: 0, id: null });
                    if (menu.id) onAssignEntry(menu.id, c);
                  }}
                >
                  {c}
                </button>
              ))}
              <hr />
              <button
                type="button"
                className="context-menu__item btn btn--ghost"
                onClick={() => {
                  setMenu({ open: false, x: 0, y: 0, id: null });
                  if (menu.id) onClearEntryCategory(menu.id);
                }}
              >
                Remove category
              </button>
              <hr />
              <button
                type="button"
                className="context-menu__item btn btn--danger"
                onClick={() => {
                  setMenu({ open: false, x: 0, y: 0, id: null });
                  if (onDeleteEntry && menu.id) onDeleteEntry(menu.id);
                }}
              >
                Delete
              </button>
            </div>,
            document.body
          )}
          {catMenu.open && catMenu.path && createPortal(
            <div
              className="context-menu card"
              style={{ top: `${catMenu.y}px`, left: `${catMenu.x}px` }}
              role="menu"
              onContextMenu={(e) => e.preventDefault()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="context-menu__item btn btn--ghost"
                onClick={() => { const p = catMenu.path as string; setCatMenu({ open: false, x: 0, y: 0, path: null }); setNewSubFor(p); setNewSubName(""); }}
              >
                New subcategory
              </button>
              <button
                type="button"
                className="context-menu__item btn btn--ghost"
                onClick={() => { const p = catMenu.path as string; setCatMenu({ open: false, x: 0, y: 0, path: null }); setRenameFor(p); setRenameName(p.split(" > ").pop() || ""); }}
              >
                Rename
              </button>
              <hr />
              <button
                type="button"
                className="context-menu__item btn btn--danger"
                onClick={() => { const p = catMenu.path as string; setCatMenu({ open: false, x: 0, y: 0, path: null }); onDeleteCategoryRequest(p); }}
              >
                Delete
              </button>
            </div>,
            document.body
          )}
        </ul>
      </div>
    </div>
  );
};

export default NotesIndex;
