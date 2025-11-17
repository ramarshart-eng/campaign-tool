import React from "react";
import { createPortal } from "react-dom";
import { TextFlowProvider } from "@/lib/components/TextFlowProvider";
import TextFlowPage from "@/lib/components/TextFlowPage";
import type { BookShellSlots } from "@/lib/components/BookShell";

type EntryLite = { id: string; title: string };
type Props = Pick<BookShellSlots, "leftRef" | "rightRef" | "spreadStart" | "setSpreadStart"> & {
  value?: string;
  onChange?: (text: string) => void;
  entries?: EntryLite[];
  activeId?: string;
  onSelectEntry?: (id: string) => void;
  onNewEntry?: () => void;
  onRenameEntry?: (title: string) => void;
  firstSpreadOnRight?: boolean;
};

const NotesPages: React.FC<Props> = ({
  leftRef,
  rightRef,
  spreadStart,
  setSpreadStart,
  value,
  onChange,
  entries = [],
  activeId,
  onSelectEntry,
  onNewEntry,
  onRenameEntry,
  firstSpreadOnRight = false,
}) => {
  const [text, setText] = React.useState<string>("");
  const [pageWidth, setPageWidth] = React.useState<number>(0);

  // Keep content containers configured and track width changes to trigger repagination
  React.useEffect(() => {
    const headerRows = 3; // header height in lines
    const apply = () => {
      const l = leftRef.current; const r = rightRef.current;
      if (l) l.classList.add("reserve-lines-1");
      if (r) r.classList.add("reserve-lines-1");
      if (spreadStart === 0) {
        if (firstSpreadOnRight) {
          if (r) { r.style.setProperty("--header-rows", String(headerRows)); r.style.setProperty("--extra-top-pad", `calc(var(--header-rows, ${headerRows}) * 1lh)`); }
          if (l) { l.style.setProperty("--extra-top-pad", "0px"); }
        } else {
          if (l) { l.style.setProperty("--header-rows", String(headerRows)); l.style.setProperty("--extra-top-pad", `calc(var(--header-rows, ${headerRows}) * 1lh)`); }
          if (r) { r.style.setProperty("--extra-top-pad", "0px"); }
        }
      } else {
        if (l) l.style.setProperty("--extra-top-pad", "0px");
        if (r) r.style.setProperty("--extra-top-pad", "0px");
      }
      if (leftRef.current) setPageWidth(leftRef.current.clientWidth);
    };
    apply();
    const ro = new ResizeObserver(() => apply());
    if (leftRef.current) ro.observe(leftRef.current);
    if (rightRef.current) ro.observe(rightRef.current);
    const onWin = () => apply();
    window.addEventListener("resize", onWin);
    return () => { ro.disconnect(); window.removeEventListener("resize", onWin); };
  }, [leftRef, rightRef, spreadStart, firstSpreadOnRight]);

  const v = value !== undefined ? value : text;
  const setV = (t: string) => { if (onChange) onChange(t); else setText(t); };

  const isFirstSpread = spreadStart === 0;

  return (
    <TextFlowProvider
      leftContentRef={leftRef}
      rightContentRef={rightRef}
      spreadStart={spreadStart}
      setSpreadStart={setSpreadStart}
      pageWidth={pageWidth}
      value={v}
      onChange={setV}
      reservedTopLines={3}
    >
      {/* Title overlay: left by default; right when first spread is on right */}
      {isFirstSpread && (
        firstSpreadOnRight
          ? (rightRef.current ? createPortal(
              <div style={{ position: "absolute", top: "var(--content-pad-y)", left: 0, right: 0, height: "calc(var(--header-rows, 3) * var(--rlh, 1.5rem))", display: "flex", alignItems: "center", gap: ".5rem", paddingLeft: "var(--page-side-pad)", paddingRight: "var(--page-side-pad)", background: "transparent", zIndex: 2 }}>
                <input className="border-b-2 border-black bg-transparent flex-1 min-w-0" placeholder="Title" value={entries.find((e) => e.id === (activeId || ""))?.title ?? ""} onChange={(e) => onRenameEntry?.(e.target.value)} aria-label="Entry title" />
              </div>, rightRef.current) : null)
          : (
              <div style={{ position: "absolute", top: "var(--content-pad-y)", left: 0, right: 0, height: "calc(var(--header-rows, 3) * var(--rlh, 1.5rem))", display: "flex", alignItems: "center", gap: ".5rem", paddingLeft: "var(--page-side-pad)", paddingRight: "var(--page-side-pad)", background: "transparent", zIndex: 2 }}>
                <input className="border-b-2 border-black bg-transparent flex-1 min-w-0" placeholder="Title" value={entries.find((e) => e.id === (activeId || ""))?.title ?? ""} onChange={(e) => onRenameEntry?.(e.target.value)} aria-label="Entry title" />
              </div>
            )
      )}

      {/* Swap pages only on first spread when requested */}
      {isFirstSpread && firstSpreadOnRight ? (
        <>
          {/* Only render page 1 into the RIGHT container; no left textarea when index is open */}
          {rightRef.current ? createPortal(<TextFlowPage side="left" advanceOnPage2 />, rightRef.current) : null}
        </>
      ) : (
        <>
          <TextFlowPage side="left" />
          {rightRef.current ? createPortal(<TextFlowPage side="right" />, rightRef.current) : null}
        </>
      )}
    </TextFlowProvider>
  );
};

export default NotesPages;







