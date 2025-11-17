import React, { useEffect, useRef } from "react";
import type { NextPage } from "next";
import TwoColumnOverlayEditor from "@/lib/components/TwoColumnOverlayEditor";

// Simple prototype page that renders the book layout and overlays
// a single editable surface split into two columns.
const EditorColumnsPrototype: NextPage = () => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const leftContentRef = useRef<HTMLDivElement | null>(null);
  const rightContentRef = useRef<HTMLDivElement | null>(null);

  // Ensure the content containers use expected padding vars
  useEffect(() => {
    if (leftContentRef.current) {
      leftContentRef.current.style.setProperty("--extra-top-pad", "1lh");
      leftContentRef.current.style.setProperty("--line-reserve-lines", "1");
    }
    if (rightContentRef.current) {
      rightContentRef.current.style.setProperty("--extra-top-pad", "1lh");
      rightContentRef.current.style.setProperty("--line-reserve-lines", "1");
    }
  }, []);

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-app">
      <div className="w-full px-8 py-8 flex-1 min-h-0 flex items-center justify-center">
        <div
          ref={frameRef}
          className="frame pad-4 inline-block overflow-hidden book-wrap"
          style={{ ["--page-width"]: `560px` } as React.CSSProperties}
        >
          <div className="book">
            {/* Left page */}
            <div className="book__page book__page--left">
              <div className="book__paper">
                <div className="book__content" ref={leftContentRef}>
                  {/* Empty on purpose; overlay will span both pages */}
                </div>
                <div className="book__page-num left">1</div>
              </div>
            </div>

            {/* Right page */}
            <div className="book__page book__page--right">
              <div className="book__paper">
                <div className="book__content" ref={rightContentRef}>
                  {/* Empty on purpose; overlay will span both pages */}
                </div>
                <div className="book__page-num right">2</div>
              </div>
            </div>
          </div>

          {/* The two-column overlay spanning both pages */}
          <TwoColumnOverlayEditor
            frameRef={frameRef as React.RefObject<HTMLElement>}
            leftRef={leftContentRef as React.RefObject<HTMLElement>}
            rightRef={rightContentRef as React.RefObject<HTMLElement>}
            placeholder="Type here — single editor split into two columns"
          />
        </div>
      </div>
    </main>
  );
};

export default EditorColumnsPrototype;

