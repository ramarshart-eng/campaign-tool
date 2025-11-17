import React, { useEffect, useRef, useState } from "react";
import { TextFlowProvider } from "@/lib/components/TextFlowProvider";
import TextFlowPage from "@/lib/components/TextFlowPage";

// Portrait A4 page aspect (width / height)
const PORTRAIT_ASPECT = 210 / 297;

const BookShellClassic: React.FC = () => {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(560);
  const [spreadStart, setSpreadStart] = useState<number>(0);
  const leftContentRef = useRef<HTMLDivElement | null>(null);
  const rightContentRef = useRef<HTMLDivElement | null>(null);

  // Simple notebook entries state (non-persistent for now)
  const [entries, setEntries] = useState<
    { id: string; title: string; text: string }[]
  >([{ id: "e1", title: "Untitled", text: "" }]);
  const [activeEntryId, setActiveEntryId] = useState<string>("e1");
  const activeIdx = Math.max(
    0,
    entries.findIndex((e) => e.id === activeEntryId)
  );
  const active = entries[activeIdx] ?? entries[0];
  const setActiveText = (text: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === activeIdx ? { ...e, text } : e))
    );
  };
  const setActiveTitle = (title: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === activeIdx ? { ...e, title } : e))
    );
  };
  const newEntry = () => {
    const nid = `e${Date.now()}`;
    setEntries((prev) => [...prev, { id: nid, title: "Untitled", text: "" }]);
    setActiveEntryId(nid);
    setSpreadStart(0);
  };
  const selectEntry = (id: string) => {
    setActiveEntryId(id);
    setSpreadStart(0);
  };

  useEffect(() => {
    const layout = layoutRef.current;
    const frame = frameRef.current;
    if (!layout || !frame) return;

    const compute = () => {
      const lcs = getComputedStyle(layout);
      const padT = parseFloat(lcs.paddingTop) || 0;
      const padB = parseFloat(lcs.paddingBottom) || 0;
      const padL = parseFloat(lcs.paddingLeft) || 0;
      const padR = parseFloat(lcs.paddingRight) || 0;
      let heightAvail = Math.max(0, layout.clientHeight - padT - padB);
      let widthAvail = Math.max(0, layout.clientWidth - padL - padR);

      const fcs = getComputedStyle(frame);
      const fPadT = parseFloat(fcs.paddingTop) || 0;
      const fPadB = parseFloat(fcs.paddingBottom) || 0;
      const fPadL = parseFloat(fcs.paddingLeft) || 0;
      const fPadR = parseFloat(fcs.paddingRight) || 0;
      const fBrdT = parseFloat(fcs.borderTopWidth) || 0;
      const fBrdB = parseFloat(fcs.borderBottomWidth) || 0;
      const fBrdL = parseFloat(fcs.borderLeftWidth) || 0;
      const fBrdR = parseFloat(fcs.borderRightWidth) || 0;
      heightAvail = Math.max(0, heightAvail - fPadT - fPadB - fBrdT - fBrdB);
      widthAvail = Math.max(0, widthAvail - fPadL - fPadR - fBrdL - fBrdR);

      const pageFromHeight = Math.floor(heightAvail * PORTRAIT_ASPECT);
      const pageFromWidth = Math.floor(widthAvail / 2);
      setPageWidth(Math.max(0, Math.min(pageFromHeight, pageFromWidth)));
    };

    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(layout);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, []);

  // Pagination runs in TextFlowProvider; observe only layout size above

  // (text flow test removed)

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-app">
      {/* Notebook toolbar (kept outside layoutRef to avoid affecting sizing) */}
      <div className="w-full px-8 pt-4 pb-2 flex items-center gap-2">
        <label style={{ fontWeight: 600 }}>Entry:</label>
        <select
          value={activeEntryId}
          onChange={(e) => selectEntry(e.target.value)}
          className="border border-black bg-transparent"
        >
          {entries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title || "Untitled"}
            </option>
          ))}
        </select>
        <input
          className="border-b-2 border-black bg-transparent flex-1 min-w-0"
          placeholder="Title"
          value={active?.title ?? ""}
          onChange={(e) => setActiveTitle(e.target.value)}
        />
        <button type="button" className="btn-primary" onClick={newEntry}>
          New Entry
        </button>
      </div>
      <div
        className="w-full px-8 py-8 flex-1 min-h-0 flex items-center justify-center"
        ref={layoutRef}
      >
        <div
          ref={frameRef}
          className="frame pad-4 inline-block overflow-hidden book-wrap"
          style={{ ["--page-width"]: `${pageWidth}px` } as React.CSSProperties}
        >
          <TextFlowProvider
            leftContentRef={leftContentRef}
            rightContentRef={rightContentRef}
            spreadStart={spreadStart}
            setSpreadStart={setSpreadStart}
            pageWidth={pageWidth}
            value={active?.text ?? ""}
            onChange={setActiveText}
          >
            <div className="book">
              {/* Left page */}
              <div className="book__page book__page--left">
                <div className="book__paper">
                  {spreadStart > 0 && (
                    <button
                      type="button"
                      className="book__nav-btn book__nav-btn--prev book__nav-btn--tall"
                      aria-label="Previous pages"
                      onClick={() =>
                        setSpreadStart(Math.max(0, spreadStart - 2))
                      }
                    />
                  )}
                  <div
                    className="book__content reserve-lines-1"
                    ref={leftContentRef}
                  >
                    <TextFlowPage side="left" />
                  </div>
                  <div className="book__page-num left">{spreadStart + 1}</div>
                </div>
              </div>

              {/* Right page */}
              <div className="book__page book__page--right">
                <div className="book__paper">
                  <button
                    type="button"
                    className="book__nav-btn book__nav-btn--next book__nav-btn--tall"
                    aria-label="Next pages"
                    onClick={() => setSpreadStart(spreadStart + 2)}
                  />
                  <div
                    className="book__content reserve-lines-1"
                    ref={rightContentRef}
                  >
                    <TextFlowPage side="right" />
                  </div>
                  <div className="book__page-num right">{spreadStart + 2}</div>
                </div>
              </div>
            </div>
          </TextFlowProvider>
          {/* measure box handled by TextFlowProvider */}
        </div>
      </div>
    </main>
  );
};

export default BookShellClassic;
