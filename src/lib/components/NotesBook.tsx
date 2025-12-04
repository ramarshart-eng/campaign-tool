import React from "react";
import BookShell from "@/lib/components/BookShell";
import NotesPages from "@/lib/components/NotesPages";
import NotesIndex from "@/lib/components/NotesIndex";
import { useCharacter } from "@/lib/context/CharacterContext";
import type { Character } from "@/lib/types/Character";

type Entry = { id: string; title: string; text: string; categoryPath?: string };

const NotesBook: React.FC = () => {
  const { character } = useCharacter();
  const currentCharacter = character as Character | null;

  // Entries per character
  const [entries, setEntries] = React.useState<Entry[]>([
    { id: "e1", title: "Untitled", text: "" },
  ]);
  const [activeId, setActiveId] = React.useState<string>("e1");
  const activeIdx = Math.max(
    0,
    entries.findIndex((e) => e.id === activeId)
  );
  const active = entries[activeIdx] ?? entries[0];

  const entriesKey = currentCharacter?.id
    ? `notes:entries:${currentCharacter.id}`
    : undefined;
  const activeKey = currentCharacter?.id
    ? `notes:active:${currentCharacter.id}`
    : undefined;
  const categoriesKey = currentCharacter?.id
    ? `notes:categories:${currentCharacter.id}`
    : undefined;

  // Categories as normalized paths, e.g., "World > City > Inn"
  const [categories, setCategories] = React.useState<string[]>([]);
  const normalizePath = (raw: string): string =>
    raw
      .split(">")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" > ");

  // Category helpers
  const addCategory = (path: string) => {
    const p = normalizePath(path);
    if (!p) return;
    setCategories((prev) => (prev.includes(p) ? prev : [...prev, p]));
  };

  const renameCategory = (oldPath: string, newLeafName: string) => {
    const src = normalizePath(oldPath);
    const parts = src.split(" > ");
    if (parts.length === 0) return;
    const parent = parts.slice(0, -1).join(" > ");
    const newLeaf = normalizePath(newLeafName).replace(/\s*>\s*.*/, "");
    const dst = normalizePath(parent ? `${parent} > ${newLeaf}` : newLeaf);
    if (!dst) return;

    setCategories((prev) => {
      const next = new Set<string>();
      const prefix = src + " > ";
      prev.forEach((c) => {
        if (c === src) next.add(dst);
        else if (c.startsWith(prefix)) next.add(dst + c.substring(src.length));
        else next.add(c);
      });
      return Array.from(next);
    });
    setEntries((prev) => {
      const prefix = src + " > ";
      return prev.map((e) => {
        const cp = e.categoryPath || "";
        if (!cp) return e;
        if (cp === src) return { ...e, categoryPath: dst };
        if (cp.startsWith(prefix))
          return { ...e, categoryPath: dst + cp.substring(src.length) };
        return e;
      });
    });
  };

  const deleteCategoryCascade = (path: string) => {
    const target = normalizePath(path);
    if (!target) return;
    setCategories((prev) =>
      prev.filter((c) => c !== target && !c.startsWith(target + " > "))
    );

    setEntries((prev) =>
      prev.map((e) => {
        const cp = e.categoryPath || "";
        if (!cp) return e;
        if (cp === target || cp.startsWith(target + " > "))
          return { ...e, categoryPath: "" };
        return e;
      })
    );
  };

  // Load on character change
  React.useEffect(() => {
    if (!entriesKey) return;
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem(entriesKey)
          : null;
      const saved: Entry[] | null = raw ? JSON.parse(raw) : null;
      if (saved && Array.isArray(saved) && saved.length > 0)
        setEntries(saved.map((e) => ({ categoryPath: "", ...e })));
      const aid =
        typeof window !== "undefined"
          ? window.localStorage.getItem(activeKey!)
          : null;
      if (aid && saved && saved.some((e) => e.id === aid)) setActiveId(aid);
      else setActiveId((saved && saved[0]?.id) || "e1");
    } catch {}
  }, [entriesKey, activeKey]);

  // Load categories
  React.useEffect(() => {
    if (!categoriesKey) return;
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem(categoriesKey)
          : null;
      const saved: string[] | null = raw ? JSON.parse(raw) : null;
      if (saved && Array.isArray(saved))
        setCategories(Array.from(new Set(saved.map(normalizePath))));
    } catch {}
  }, [categoriesKey]);

  // Load expanded state for category tree

  // Persist on change
  React.useEffect(() => {
    if (!entriesKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(entriesKey, JSON.stringify(entries));
    } catch {}
  }, [entries, entriesKey]);
  React.useEffect(() => {
    if (!activeKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(activeKey, activeId);
    } catch {}
  }, [activeId, activeKey]);
  React.useEffect(() => {
    if (!categoriesKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(categoriesKey, JSON.stringify(categories));
    } catch {}
  }, [categories, categoriesKey]);

  const newEntry = () => {
    const id = `e${Date.now()}`;
    setEntries((prev) => [
      ...prev,
      { id, title: "Untitled", text: "", categoryPath: "" },
    ]);
    setActiveId(id);
  };
  const rename = (title: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === activeId ? { ...e, title } : e))
    );
  };
  const renameById = (id: string, title: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, title } : e)));
  };
  const updateText = (t: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === activeId ? { ...e, text: t } : e))
    );
  };

  // Toast + confirm state
  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    undo?: { entry: Entry; index: number; prevActiveId: string };
  }>({ show: false, message: "" });
  const [confirmDel, setConfirmDel] = React.useState<{
    show: boolean;
    id: string | null;
    title: string;
  }>({ show: false, id: null, title: "" });

  // Category delete confirm
  const [confirmCatDel, setConfirmCatDel] = React.useState<{
    show: boolean;
    path: string | null;
  }>({ show: false, path: null });

  const deleteEntry = (id: string) => {
    const target = entries.find((e) => e.id === id);
    setConfirmDel({ show: true, id, title: target?.title || "Untitled" });
  };

  const performDelete = (id: string) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return prev;
      const target = prev[idx];
      const next = prev.filter((e) => e.id !== id);
      setToast({
        show: true,
        message: `Deleted "${target.title || "Untitled"}"`,
        undo: { entry: target, index: idx, prevActiveId: activeId },
      });
      if (next.length === 0) {
        const nid = `e${Date.now()}`;
        setActiveId(nid);
        return [{ id: nid, title: "Untitled", text: "" }];
      }
      if (id === activeId) {
        const newIdx = Math.max(0, idx - 1);
        setActiveId(next[newIdx].id);
      }
      return next;
    });
    setConfirmDel({ show: false, id: null, title: "" });
  };

  const [showIndex, setShowIndex] = React.useState(true);
  React.useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(() => setToast((s) => ({ ...s, show: false })), 4000);
    return () => clearTimeout(t);
  }, [toast.show]);

  const undoDelete = () => {
    const u = toast.undo;
    if (!u) return;
    setEntries((prev) => {
      const next = prev.slice();
      next.splice(Math.min(Math.max(u.index, 0), next.length), 0, u.entry);
      return next;
    });
    setActiveId(u.entry.id);
    setToast({ show: false, message: "" });
  };

  // Bridge component to keep overlay side-effects out of render
  const Bridge: React.FC<{
    showIndex: boolean;
    spreadStart: number;
    setShowIndex: React.Dispatch<React.SetStateAction<boolean>>;
    setSpreadStart: React.Dispatch<React.SetStateAction<number>>;
  }> = ({ showIndex, spreadStart, setShowIndex, setSpreadStart }) => {
    React.useEffect(() => {
      // If Index is open and user hits Next (spread jumps to 2), flip to spread 1 and close Index
      if (showIndex && spreadStart === 2) {
        setShowIndex(false);
        setSpreadStart(1);
      }
    }, [showIndex, spreadStart, setShowIndex, setSpreadStart]);
    React.useEffect(() => {
      // If returning to spread 0 while not showing Index, reopen Index
      if (!showIndex && spreadStart === 0) {
        setShowIndex(true);
      }
    }, [showIndex, spreadStart, setShowIndex]);
    return null;
  };

  return (
    <BookShell
      getPageNumbers={({ spreadStart }) =>
        spreadStart === 0
          ? showIndex
            ? { left: null, right: 1 }
            : { left: 1, right: 2 }
          : { left: spreadStart + 1, right: spreadStart + 2 }
      }
      renderOverlay={({ spreadStart, setSpreadStart }) => (
        <>
          {/* Bridge effects */}
          <Bridge
            showIndex={showIndex}
            spreadStart={spreadStart}
            setShowIndex={setShowIndex}
            setSpreadStart={setSpreadStart}
          />
          {/* Index toggle tab */}
          <button
            type="button"
            onClick={() => setShowIndex((v) => !v)}
            aria-label="Open index"
            className="index-tab"
          >
            Index
          </button>
          {confirmDel.show && (
            <div className="overlay-center card" role="dialog" aria-modal="true">
              <div className="card__body gap-sm">
              <span>Delete &quot;{confirmDel.title}&quot;?</span>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => confirmDel.id && performDelete(confirmDel.id)}
              >
                Delete
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() =>
                  setConfirmDel({ show: false, id: null, title: "" })
                }
              >
                Cancel
              </button>
              </div>
            </div>
          )}
          {toast.show && (
            <div className="overlay-center card" role="status">
              <div className="card__body gap-sm">
              <span>{toast.message}</span>
              {toast.undo && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={undoDelete}
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setToast({ show: false, message: "" })}
              >
                Dismiss
              </button>
              </div>
            </div>
          )}
          {confirmCatDel.show && (
            <div className="overlay-center card" role="dialog" aria-modal="true">
              <div className="card__body gap-sm">
              <span>
                Delete category &quot;{confirmCatDel.path}&quot; and its
                subcategories?
              </span>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  if (confirmCatDel.path)
                    deleteCategoryCascade(confirmCatDel.path);
                  setConfirmCatDel({ show: false, path: null });
                }}
              >
                Delete
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setConfirmCatDel({ show: false, path: null })}
              >
                Cancel
              </button>
              </div>
            </div>
          )}
        </>
      )}
      renderSpread={({ leftRef, rightRef, spreadStart, setSpreadStart }) => ({
        left: (
          <>
            {/* Always mount the editor for correct pagination and caret behaviour */}
            <NotesPages
              leftRef={leftRef}
              rightRef={rightRef}
              spreadStart={spreadStart}
              setSpreadStart={setSpreadStart}
              value={active?.text ?? ""}
              onChange={updateText}
              entries={entries.map(({ id, title }) => ({ id, title }))}
              activeId={activeId}
              onSelectEntry={(id) => setActiveId(id)}
              onRenameEntry={rename}
              firstSpreadOnRight={showIndex}
            />
            {showIndex && spreadStart === 0 && (
              <div className="book__index-overlay">
                <NotesIndex
                  leftRef={leftRef}
                  rightRef={rightRef}
                  spreadStart={spreadStart}
                  setSpreadStart={setSpreadStart}
                  entries={entries.map(({ id, title, categoryPath }) => ({
                    id,
                    title,
                    categoryPath,
                  }))}
                  activeId={activeId}
                  onSelectEntry={(id) => {
                    setActiveId(id);
                    setShowIndex(false);
                    setSpreadStart(0);
                  }}
                  onNewEntry={() => {
                    newEntry();
                    setShowIndex(false);
                    setSpreadStart(0);
                  }}
                  onDeleteEntry={(id) => {
                    deleteEntry(id);
                  }}
                  categories={categories}
                  onAddCategory={addCategory}
                  onRenameCategory={(oldPath, newLeaf) =>
                    renameCategory(oldPath, newLeaf)
                  }
                  onDeleteCategoryRequest={(path) =>
                    setConfirmCatDel({ show: true, path })
                  }
                  onAssignEntry={(entryId, path) => {
                    const p = normalizePath(path);
                    setEntries((prev) =>
                      prev.map((e) =>
                        e.id === entryId ? { ...e, categoryPath: p } : e
                      )
                    );
                  }}
                  onClearEntryCategory={(entryId) =>
                    setEntries((prev) =>
                      prev.map((e) =>
                        e.id === entryId ? { ...e, categoryPath: "" } : e
                      )
                    )
                  }
                  onRenameEntry={(id, title) => renameById(id, title)}
                  asOverlay
                />
              </div>
            )}
          </>
        ),
        right: null,
      })}
    />
  );
};

export default NotesBook;
