import React from "react";
import { createPortal } from "react-dom";
import { TextFlowProvider } from "@/lib/components/TextFlowProvider";
import TextFlowPage from "@/lib/components/TextFlowPage";
import type { BookShellSlots } from "@/lib/components/BookShell";

type Props = Pick<BookShellSlots, "leftRef" | "rightRef" | "spreadStart" | "setSpreadStart"> & {
  value?: string;
  onChange?: (text: string) => void;
  reservedTopLines?: number; // visual header space on first page only (defaults to 0)
};

const FlowEditor: React.FC<Props> = ({
  leftRef,
  rightRef,
  spreadStart,
  setSpreadStart,
  value,
  onChange,
  reservedTopLines = 0,
}) => {
  const [text, setText] = React.useState("");
  const [pageWidth, setPageWidth] = React.useState(0);

  // Keep a local controlled/uncontrolled bridge
  const v = value !== undefined ? value : text;
  const setV = (t: string) => (onChange ? onChange(t) : setText(t));

  // Apply shared bottom reserve and track width for pagination
  React.useEffect(() => {
    const apply = () => {
      const l = leftRef.current;
      const r = rightRef.current;
      if (l) l.classList.add("reserve-lines-1");
      if (r) r.classList.add("reserve-lines-1");
      if (l) setPageWidth(l.clientWidth);
    };
    apply();
    const ro = new ResizeObserver(() => apply());
    if (leftRef.current) ro.observe(leftRef.current);
    if (rightRef.current) ro.observe(rightRef.current);
    const onWin = () => apply();
    window.addEventListener("resize", onWin);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
    };
  }, [leftRef, rightRef]);

  return (
    <TextFlowProvider
      leftContentRef={leftRef}
      rightContentRef={rightRef}
      spreadStart={spreadStart}
      setSpreadStart={setSpreadStart}
      pageWidth={pageWidth}
      value={v}
      onChange={setV}
      reservedTopLines={reservedTopLines}
    >
      <TextFlowPage side="left" />
      {rightRef.current
        ? createPortal(<TextFlowPage side="right" />, rightRef.current)
        : null}
    </TextFlowProvider>
  );
};

export default FlowEditor;

