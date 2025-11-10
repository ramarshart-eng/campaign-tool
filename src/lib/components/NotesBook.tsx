import React from "react";
import type { Character } from "@/lib/types/Character";
import { useCharacter } from "@/lib/context/CharacterContext";

// Simple two-page A4 notes book (no dynamic resizing yet)
// Uses existing global styles: .book, .book__page, .book__paper, .book__content, etc.

const DEFAULT_PAGE_WIDTH = 560; // px; adjust if needed

const NotesBook: React.FC = () => {
  const { character, setCharacter } = useCharacter();
  const currentCharacter = character as Character | null;

  const [spreadStart, setSpreadStart] = React.useState(0);
  React.useEffect(() => {
    setSpreadStart(0);
  }, [currentCharacter?.id]);

  const updateField = <K extends keyof Character>(key: K, value: Character[K]) => {
    if (!currentCharacter) return;
    const updated: Character = { ...(currentCharacter as Character), [key]: value } as Character;
    setCharacter(updated);
  };

  const setPageTitle = (pageIndex: number, value: string) => {
    const existing = currentCharacter?.notesTitles ?? [];
    const next = existing.slice();
    if (next.length <= pageIndex) {
      next.length = pageIndex + 1;
      for (let i = 0; i < next.length; i++) if (typeof next[i] !== "string") next[i] = "";
    }
    next[pageIndex] = value;
    updateField("notesTitles", next);
  };

  const setPageText = (pageIndex: number, value: string) => {
    const existing = currentCharacter?.notes ?? [];
    const next = existing.slice();
    if (next.length <= pageIndex) {
      next.length = pageIndex + 1;
      for (let i = 0; i < next.length; i++) if (typeof next[i] !== "string") next[i] = "";
    }
    next[pageIndex] = value;
    updateField("notes", next);
  };

  const notes = currentCharacter?.notes ?? [];
  const titles = currentCharacter?.notesTitles ?? [];
  const catSel = currentCharacter?.notesCategory ?? [];
  

  const normalizePath = (raw: string): string => {
    return raw
      .split(">")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(">");
  };
  const normalizedCatList = React.useMemo(() => {
    const list = currentCharacter?.notesCategoryList ?? [];
    return Array.from(new Set(list.map((c) => normalizePath(c)))).filter(Boolean);
  }, [currentCharacter?.notesCategoryList]);

  const addCategory = (path: string) => {
    const p = normalizePath(path);
    if (!p) return;
    const list = (currentCharacter?.notesCategoryList ?? []).slice();
    if (!list.includes(p)) {
      list.push(p);
      updateField("notesCategoryList", list);
    }
  };
  const setPageCategory = (pageIndex: number, path: string) => {
    const existing = currentCharacter?.notesCategory ?? [];
    const next = existing.slice();
    if (next.length <= pageIndex) next.length = pageIndex + 1;
    next[pageIndex] = normalizePath(path);
    updateField("notesCategory", next);
  };

  const deleteCategory = (path: string) => {
    if (!currentCharacter) return;
    const target = normalizePath(path);
    const targetLower = target.toLowerCase();
    const list = (currentCharacter.notesCategoryList ?? []).slice();
    const prefix = target + ">";
    const prefixLower = targetLower + ">";
    const filtered = list
      .map(normalizePath)
      .filter((c) => {
        const cl = c.toLowerCase();
        return c !== target && cl !== targetLower && !c.startsWith(prefix) && !cl.startsWith(prefixLower);
      });
    // clear assignments on pages that use this category or its descendants
    const assigned = (currentCharacter.notesCategory ?? []).slice();
    for (let i = 0; i < assigned.length; i++) {
      const pth = normalizePath(assigned[i] || "").toLowerCase();
      if (pth === targetLower || pth.startsWith(prefixLower)) assigned[i] = "";
    }
    const updated: Character = { ...(currentCharacter as Character), notesCategoryList: filtered, notesCategory: assigned } as Character;
    setCharacter(updated);
  };

  type CatNode = { name: string; path: string; explicit: boolean; children: CatNode[]; pages: { idx: number; t: string }[] };

  const buildTree = (): { roots: CatNode[]; uncategorized: { idx: number; t: string }[] } => {
    const roots: CatNode[] = [];
    const map = new Map<string, CatNode>();
    const ensureNode = (path: string): CatNode => {
      if (map.has(path)) return map.get(path)!;
      const parts = path.split(">").map((s) => s.trim()).filter(Boolean);
      const name = parts[parts.length - 1] || path;
      const node: CatNode = { name, path, explicit: false, children: [], pages: [] };
      map.set(path, node);
      if (parts.length === 1) {
        roots.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join(">");
        const parent = ensureNode(parentPath);
        if (!parent.children.find((c) => c.path === path)) parent.children.push(node);
      }
      return node;
    };
    // build nodes from category list and mark explicit ones
    const explicitList = normalizedCatList;
    for (const c of explicitList) {
      const n = ensureNode(c);
      n.explicit = true;
    }
    // assign pages to nodes
    const uncategorized: { idx: number; t: string }[] = [];
    for (let idx = 1; idx < titles.length; idx++) {
      const t = (titles[idx] || "").trim();
      if (!t) continue;
      const catPath = normalizePath(catSel[idx] || "");
      if (catPath && map.has(catPath)) {
        map.get(catPath)!.pages.push({ idx, t });
      } else {
        uncategorized.push({ idx, t });
      }
    }
    // prune non-explicit empty nodes
    const prune = (nodes: CatNode[]): CatNode[] => {
      const pruned: CatNode[] = [];
      for (const n of nodes) {
        n.children = prune(n.children);
        if (n.explicit || n.pages.length > 0 || n.children.length > 0) {
          pruned.push(n);
        }
      }
      return pruned;
    };
    const prunedRoots = prune(roots);
    return { roots: prunedRoots, uncategorized };
  };

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const toggle = (path: string) => setExpanded((e) => ({ ...e, [path]: !e[path] }));

  // Normalize and de-duplicate existing categories so delete works reliably
  React.useEffect(() => {
    if (!currentCharacter) return;
    const list = currentCharacter.notesCategoryList ?? [];
    // Normalize, de-dupe, and remove case-duplicate entries while preserving first occurrence
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const raw of list) {
      const n = normalizePath(raw);
      if (!n) continue;
      const key = n.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(n);
    }
    if (normalized.length !== list.length || normalized.some((v, i) => v !== list[i])) {
      const updated: Character = { ...(currentCharacter as Character), notesCategoryList: normalized } as Character;
      setCharacter(updated);
    }
  }, [currentCharacter?.notesCategoryList, setCharacter, currentCharacter]);

  const ensureLength = (required: number) => {
    const ensure = (arr: string[] | undefined) => {
      const a = (arr ?? []).slice();
      if (a.length < required) a.length = required;
      for (let i = 0; i < a.length; i++) if (typeof a[i] !== "string") a[i] = "";
      return a;
    };
    if ((currentCharacter?.notes ?? []).length < required) {
      updateField("notes", ensure(currentCharacter?.notes));
    }
    if ((currentCharacter?.notesTitles ?? []).length < required) {
      updateField("notesTitles", ensure(currentCharacter?.notesTitles));
    }
  };

  const goPrev = () => setSpreadStart(Math.max(0, spreadStart - 2));
  const goNext = () => {
    const nextStart = spreadStart + 2;
    const required = nextStart + 2;
    ensureLength(required);
    setSpreadStart(nextStart);
  };

  const page = (pageIndex: number, side: "left" | "right") => {
    const titleValue = titles[pageIndex] ?? "";
    const textValue = notes[pageIndex] ?? "";
    const isIndex = pageIndex === 0; // page 1 is the Index
    return (
      <div key={`page-${pageIndex}`} className={`book__page book__page--${side}`}>
        <div className="book__paper">
          {/* Overlay nav buttons at outer edges near the title line */}
          {side === "left" && spreadStart > 0 && (
            <button
              type="button"
              className="book__nav-btn book__nav-btn--prev"
              aria-label="Previous pages"
              onClick={goPrev}
            />
          )}
          {side === "right" && (
            <button
              type="button"
              className="book__nav-btn book__nav-btn--next"
              aria-label="Next pages"
              onClick={goNext}
            />
          )}
          <div className="book__content">
            {isIndex ? (
              <>
                <div className="book__title">Index</div>
                {/* Categories input sits directly under Index title */}
                <div className="book__index-bar mt-1">
                  <input
                    type="text"
                    className="book__title-input book__title-input--grow"
                    placeholder="New category (use '>' for subcategories)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = (e.target as HTMLInputElement).value;
                        addCategory(v);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    aria-label="Add category"
                  />
                </div>
                {/* Categories tree with pages under each category */}

                <div className="book__index">
                  {(() => {
                    const { roots, uncategorized } = buildTree();
                    const goTo = (idx: number) => setSpreadStart(idx & ~1);
                    const renderNode = (node: CatNode, depth: number): React.ReactNode => (
                      <React.Fragment key={`node-${node.path}`}>
                        <li
                          className="book__index-row book__indent"
                          style={{ '--index-depth': depth } as IndexStyle}
                        >
                          <div>
                            {node.children.length > 0 || node.pages.length > 0 ? (
                              <button type="button" className="book__index-label" onClick={() => toggle(node.path)}>
                                {expanded[node.path] ? '?' : '?'} {node.name}
                              </button>
                            ) : (
                              <span className="book__index-label">{node.name}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="book__index-page btn-icon"
                            onClick={() => deleteCategory(node.path)}
                            aria-label={`Delete ${node.path}`}
                          >
                            ?
                          </button>
                        </li>
                        {expanded[node.path] && (
                          <>
                            {node.pages.map(({ idx, t }) => (
                              <li
                                key={`page-${idx}`}
                                className="book__index-row book__indent"
                                style={{ '--index-depth': depth + 1 } as IndexStyle}
                              >
                                <button type="button" className="book__index-label" onClick={() => goTo(idx)}>{t}</button>
                                <button type="button" className="book__index-page" onClick={() => goTo(idx)}>{idx}</button>
                              </li>
                            ))}
                            {node.children.map((child) => renderNode(child, depth + 1))}
                          </>
                        )}
                      </React.Fragment>
                    );
                    return (
                      <ul className="book__index-list">
                        {roots.map((n) => renderNode(n, 0))}
                        {uncategorized.length > 0 && (
                          <>
                            <li className="book__index-row">
                              <span className="book__index-label">Uncategorized</span>
                              <span className="book__index-page">&nbsp;</span>
                            </li>
                            {uncategorized.map(({ idx, t }) => (
                              <li
                                key={`uncat-${idx}`}
                                className="book__index-row book__indent"
                                style={{ '--index-depth': 1 } as IndexStyle}
                              >
                                <button type="button" className="book__index-label" onClick={() => goTo(idx)}>{t}</button>
                                <button type="button" className="book__index-page" onClick={() => goTo(idx)}>{idx}</button>
                              </li>
                            ))}
                          </>
                        )}
                      </ul>
                    );
                  })()}
                </div>
              </>
            ) : (
              <>
                <div className="book__index-bar">
                  <input
                    type="text"
                    className="book__title-input book__title-input--grow"
                    value={titleValue}
                    placeholder="Title"
                    onChange={(e) => setPageTitle(pageIndex, e.target.value)}
                    aria-label={`Page ${pageIndex + 1} title`}
                  />
                  <select
                    className="book__title-input min-w-40"
                    aria-label={`Category for page ${pageIndex + 1}`}
                    value={catSel[pageIndex] ?? ''}
                    onChange={(e) => setPageCategory(pageIndex, e.target.value)}
                  >
                    <option value="">No category</option>
                    {normalizedCatList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  className="book__textarea w-full bg-transparent textarea-lined"
                  value={textValue}
                  onChange={(e) => setPageText(pageIndex, e.target.value)}
                  placeholder="Write your notes here..."
                  aria-label={`Notes page ${pageIndex + 1}`}
                />
              </>
            )}
          </div>
          {/* Start page numbering after the index (page 1 shows as 1) */}
          {pageIndex > 0 && (
            <div className={`book__page-num ${side === "left" ? "left" : "right"}`}>{pageIndex}</div>
          )}
        </div>
      </div>
    );
  };

  // allow custom CSS variables on style (e.g., --page-width)
  type PageStyle = React.CSSProperties & { ['--page-width']?: string };
  type IndexStyle = React.CSSProperties & { ['--index-depth']?: number };

  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      // Subtract horizontal paddings (container + outer page paddings)
      const ecs = getComputedStyle(el);
      const padL = parseFloat(ecs.paddingLeft) || 0;
      const padR = parseFloat(ecs.paddingRight) || 0;
      const leftPage = el.querySelector('.book__page--left') as HTMLElement | null;
      const rightPage = el.querySelector('.book__page--right') as HTMLElement | null;
      const leftOuter = leftPage ? (parseFloat(getComputedStyle(leftPage).paddingLeft) || 0) : 0;
      const rightOuter = rightPage ? (parseFloat(getComputedStyle(rightPage).paddingRight) || 0) : 0;
      const avail = Math.max(0, cw - padL - padR - leftOuter - rightOuter);
      const pageFromWidth = Math.floor(avail / 2);
      const pageFromHeight = Math.floor(ch * (210 / 297));
      const pageWidth = Math.max(0, Math.min(pageFromWidth, pageFromHeight));
      el.style.setProperty("--page-width", `${pageWidth}px`);
    };
    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!currentCharacter) {
    return (
      <div className="h-full flex items-center justify-center text-center px-4">
        No character selected. Load a character to take notes.
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div
        ref={wrapRef}
        className="frame pad-4 flex-1 min-h-0 overflow-hidden book-wrap"
        style={{ ['--page-width']: `${DEFAULT_PAGE_WIDTH}px` } as PageStyle}
      >
        <div className="book">
          {page(spreadStart + 0, "left")}
          {page(spreadStart + 1, "right")}
        </div>
      </div>
    </div>
  );
};

export default NotesBook;
