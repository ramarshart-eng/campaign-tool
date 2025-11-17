import React, { useEffect, useRef, useState } from "react";

type Props = {
  frameRef: React.RefObject<HTMLElement>;
  leftRef: React.RefObject<HTMLElement>;
  rightRef: React.RefObject<HTMLElement>;
  placeholder?: string;
};

const TwoColumnOverlayEditor: React.FC<Props> = ({ frameRef, leftRef, rightRef, placeholder = "Start typing..." }) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  // Position and size overlay to cover both pages' content areas
  const positionOverlay = () => {
    const frame = frameRef.current as HTMLElement | null;
    const left = leftRef.current as HTMLElement | null;
    const right = rightRef.current as HTMLElement | null;
    const overlay = overlayRef.current as HTMLDivElement | null;
    if (!frame || !left || !right || !overlay) return;

    const fRect = frame.getBoundingClientRect();
    const lRect = left.getBoundingClientRect();
    const rRect = right.getBoundingClientRect();

    const top = lRect.top - fRect.top;
    const leftPx = lRect.left - fRect.left;
    const width = rRect.right - lRect.left;
    const height = Math.min(lRect.height, rRect.height);
    const columnGap = Math.max(0, rRect.left - lRect.right);

    Object.assign(overlay.style, {
      position: "absolute",
      top: `${top}px`,
      left: `${leftPx}px`,
      width: `${width}px`,
      height: `${height}px`,
      zIndex: "5",
      pointerEvents: "auto",
      // Transparent overlay above pages
      background: "transparent",
      // Split into two columns matching pages
      columnCount: "2",
      columnGap: `${columnGap}px`,
      // Typography follows book content; fallback line-height
      lineHeight: "var(--rlh, 1.5rem)",
    } as CSSStyleDeclaration);
  };

  useEffect(() => {
    setMounted(true);
    positionOverlay();
    const onResize = () => positionOverlay();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => positionOverlay());
    if (frameRef.current) ro.observe(frameRef.current);
    if (leftRef.current) ro.observe(leftRef.current);
    if (rightRef.current) ro.observe(rightRef.current);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={overlayRef} aria-label="Two-column overlay editor">
      {/* Editable root spanning both columns */}
      <div
        className="two-col-editor"
        contentEditable
        suppressContentEditableWarning
        style={{
          minHeight: "100%",
          outline: "none",
          // Match editor inner padding with book content padding vars
          paddingTop: "var(--extra-top-pad, 1lh)",
          paddingBottom: "calc(var(--line-reserve-lines, 1) * var(--rlh, 1.5rem))",
          paddingLeft: "0",
          paddingRight: "0",
          // Use body font/color
          background: "transparent",
        }}
        aria-label={placeholder}
        data-placeholder={placeholder}
      />
    </div>
  );
};

export default TwoColumnOverlayEditor;
