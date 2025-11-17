import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export type BookShellSlots = {
  leftRef: React.RefObject<HTMLDivElement>;
  rightRef: React.RefObject<HTMLDivElement>;
  spreadStart: number;
  setSpreadStart: React.Dispatch<React.SetStateAction<number>>;
  pageLeft: number;
  pageRight: number;
};

export interface BookShellProps {
  renderSpread?: (slots: BookShellSlots) => { left?: React.ReactNode; right?: React.ReactNode };
  renderHeader?: (slots: BookShellSlots) => React.ReactNode;
  renderOverlay?: (slots: BookShellSlots) => React.ReactNode;
  getPageNumbers?: (args: { spreadStart: number; pageLeft: number; pageRight: number }) => { left?: React.ReactNode; right?: React.ReactNode };
  canGoPrev?: (args: { spreadStart: number; pageLeft: number; pageRight: number }) => boolean;
  canGoNext?: (args: { spreadStart: number; pageLeft: number; pageRight: number }) => boolean;
}

// Portrait A4 page aspect (width / height)
const PORTRAIT_ASPECT = 210 / 297;

const BookShell: React.FC<BookShellProps> = ({ renderSpread, renderHeader, renderOverlay, getPageNumbers, canGoPrev, canGoNext }) => {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(560);
  const [spreadStart, setSpreadStart] = useState<number>(0);
  const leftContentRef = useRef<HTMLDivElement | null>(null);
  const rightContentRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
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

  // Shell only: no text flow here. Modules mount inside .book__content.

  // Determine nav visibility based on optional gating
  const navArgs = { spreadStart, pageLeft: spreadStart + 1, pageRight: spreadStart + 2 };
  const prevVisible = spreadStart > 0 && (canGoPrev ? canGoPrev(navArgs) : true);
  const nextVisible = canGoNext ? canGoNext(navArgs) : true;

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-app">
      {/* Shell header sits outside the measured layout; safe for toolbars */}
      <div className="w-full px-8 pt-4 pb-2">
        {typeof renderHeader === "function"
          ? renderHeader({
              leftRef: leftContentRef as React.RefObject<HTMLDivElement>,
              rightRef: rightContentRef as React.RefObject<HTMLDivElement>,
              spreadStart,
              setSpreadStart,
              pageLeft: spreadStart + 1,
              pageRight: spreadStart + 2,
            })
          : null}
      </div>
      <div className="w-full px-8 py-8 flex-1 min-h-0 flex items-center justify-center" ref={layoutRef}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <div
            ref={frameRef}
            className="frame pad-4 inline-block overflow-hidden book-wrap"
            style={{ ["--page-width"]: `${pageWidth}px` } as React.CSSProperties}
          >
            <div className="book">
              {/* Left page */}
              <div className="book__page book__page--left">
                <div className="book__paper">
                  {prevVisible && (
                  <button
                    type="button"
                    className="book__nav-btn book__nav-btn--prev book__nav-btn--tall"
                    aria-label="Previous pages"
                    disabled={canGoPrev ? !canGoPrev(navArgs) : false}
                    onClick={() => setSpreadStart(Math.max(0, spreadStart - 2))}
                  />
                )}
                <div className="book__content" ref={leftContentRef}>
                  {typeof renderSpread === "function"
                    ? renderSpread({
                        leftRef: leftContentRef as React.RefObject<HTMLDivElement>,
                        rightRef: rightContentRef as React.RefObject<HTMLDivElement>,
                        spreadStart,
                        setSpreadStart,
                        pageLeft: spreadStart + 1,
                        pageRight: spreadStart + 2,
                      }).left
                    : null}
                </div>
              <div className="book__page-num left">{
                (() => {
                  const pn = getPageNumbers?.({ spreadStart, pageLeft: spreadStart + 1, pageRight: spreadStart + 2 });
                  return pn && pn.left !== undefined ? pn.left : (spreadStart + 1);
                })()
              }</div>
              </div>
            </div>

            {/* Right page */}
            <div className="book__page book__page--right">
              <div className="book__paper">
                {nextVisible && (
                  <button
                    type="button"
                    className="book__nav-btn book__nav-btn--next book__nav-btn--tall"
                    aria-label="Next pages"
                    disabled={canGoNext ? !canGoNext(navArgs) : false}
                    onClick={() => setSpreadStart(spreadStart + 2)}
                  />
                )}
                <div className="book__content" ref={rightContentRef}>
                  {typeof renderSpread === "function"
                    ? renderSpread({
                        leftRef: leftContentRef as React.RefObject<HTMLDivElement>,
                        rightRef: rightContentRef as React.RefObject<HTMLDivElement>,
                        spreadStart,
                        setSpreadStart,
                        pageLeft: spreadStart + 1,
                        pageRight: spreadStart + 2,
                      }).right
                    : null}
                </div>
                <div className="book__page-num right">{
                  (() => {
                    const pn = getPageNumbers?.({ spreadStart, pageLeft: spreadStart + 1, pageRight: spreadStart + 2 });
                    return pn && pn.right !== undefined ? pn.right : (spreadStart + 2);
                  })()
                }</div>
              </div>
            </div>
            </div>
          </div>
          {typeof renderOverlay === "function" ? (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <div style={{ position: "absolute", top: 0, left: 0, pointerEvents: "auto" }}>
                {renderOverlay({
                  leftRef: leftContentRef as React.RefObject<HTMLDivElement>,
                  rightRef: rightContentRef as React.RefObject<HTMLDivElement>,
                  spreadStart,
                  setSpreadStart,
                  pageLeft: spreadStart + 1,
                  pageRight: spreadStart + 2,
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
};

export default BookShell;
