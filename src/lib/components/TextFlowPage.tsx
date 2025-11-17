import React from "react";
import { useTextFlow } from "@/lib/components/TextFlowProvider";

type Props = { side: "left" | "right"; advanceOnPage2?: boolean };

const TextFlowPage: React.FC<Props> = ({ side, advanceOnPage2 = false }) => {
  const {
    fullText,
    cuts,
    leftTextareaRef,
    rightTextareaRef,
    spreadStart,
    setSpreadStart,
    setFullText,
    computeCutsFor,
  } = useTextFlow();

  const leftStart = spreadStart > 0 ? (cuts[spreadStart - 1] ?? 0) : 0;
  const leftEnd = cuts[spreadStart] ?? 0;
  const rightEnd = cuts[spreadStart + 1] ?? leftEnd;

  if (side === "left") {
    return (
      <textarea
        ref={leftTextareaRef as React.RefObject<HTMLTextAreaElement>}
        className="book__textarea w-full bg-transparent textarea-lined"
        value={fullText.slice(leftStart, leftEnd)}
        onChange={(e) => {
          const before = fullText.slice(0, leftStart);
          const after = fullText.slice(leftEnd);
          const nextText = before + e.target.value + after;
          const localCaret = e.target.selectionStart ?? e.target.value.length;
          const globalCaret = leftStart + localCaret;
          const nextCuts = computeCutsFor(nextText);
          setFullText(nextText);
          Promise.resolve().then(() => {
            // Right-first mode: advance to pages 2–3 when page 2 exists
            const p1 = nextCuts[0] ?? 0;
            const p2 = nextCuts[1] ?? 0;
            if (spreadStart === 0 && p2 > p1) {
              setSpreadStart(1);
              requestAnimationFrame(() => {
                const ta = leftTextareaRef.current; if (ta) {
                  const off = Math.max(0, globalCaret - p1);
                  ta.focus(); ta.selectionStart = off; ta.selectionEnd = off;
                }
              });
              return;
            }
            // If typing on page 1 caused content to extend to a 3rd page,
            // advance to the next spread immediately (pages 3â€“4).
            if (nextCuts[spreadStart + 2] !== undefined) {
              const ns = spreadStart + 2;
              const nextLeftStart = ns > 0 ? (nextCuts[ns - 1] ?? 0) : 0;
              setSpreadStart(ns);
              requestAnimationFrame(() => {
                const ta = leftTextareaRef.current; if (ta) {
                  const off = Math.max(0, globalCaret - nextLeftStart);
                  ta.focus(); ta.selectionStart = off; ta.selectionEnd = off;
                }
              });
              return;
            }
            const ls = spreadStart > 0 ? (nextCuts[spreadStart - 1] ?? 0) : 0;
            const le = nextCuts[spreadStart] ?? ls;
            const re = nextCuts[spreadStart + 1] ?? le;
            // Backward auto-advance: if caret moved before this spread, flip to previous
            if (spreadStart > 0 && globalCaret <= ls) {
              const prevSpread = Math.max(0, spreadStart - 2);
              const prevRightStart = nextCuts[prevSpread] ?? 0;
              setSpreadStart(prevSpread);
              requestAnimationFrame(() => {
                const ta = rightTextareaRef.current; if (ta) {
                  const off = Math.max(0, globalCaret - prevRightStart);
                  ta.focus(); ta.selectionStart = off; ta.selectionEnd = off;
                }
              });
              return;
            }
            if (globalCaret <= le) {
              const off = Math.max(0, globalCaret - ls);
              const ta = leftTextareaRef.current; if (ta) { ta.focus(); ta.selectionStart = off; ta.selectionEnd = off; }
            } else if (globalCaret <= re) {
              const off = Math.max(0, globalCaret - le);
              const ta = rightTextareaRef.current; if (ta) { ta.focus(); ta.selectionStart = off; ta.selectionEnd = off; }
            } else {
              const ns = spreadStart + 2;
              const nextLeftStart = ns > 0 ? (nextCuts[ns - 1] ?? 0) : 0;
              setSpreadStart(ns);
              requestAnimationFrame(() => {
                const ta = leftTextareaRef.current; if (ta) {
                  const off = Math.max(0, globalCaret - nextLeftStart);
                  ta.focus(); ta.selectionStart = off; ta.selectionEnd = off;
                }
              });
            }
          });
        }}
        placeholder="Start typing..."
        aria-label={`Left page text`}
        autoFocus
      />
    );
  }

  return (
    <textarea
      ref={rightTextareaRef as React.RefObject<HTMLTextAreaElement>}
      className="book__textarea w-full bg-transparent textarea-lined"
      value={fullText.slice(leftEnd, rightEnd)}
      onChange={(e) => {
        const before = fullText.slice(0, leftEnd);
        const after = fullText.slice(rightEnd);
        const nextText = before + e.target.value + after;
        const localCaret = e.target.selectionStart ?? e.target.value.length;
        const globalCaret = leftEnd + localCaret;
        const nextCuts = computeCutsFor(nextText);
        setFullText(nextText);
        Promise.resolve().then(() => {
          const ls = spreadStart > 0 ? (nextCuts[spreadStart - 1] ?? 0) : 0;
          const le = nextCuts[spreadStart] ?? ls;
          const re = nextCuts[spreadStart + 1] ?? le;
          // Backward auto-advance if caret moved before this spread's start
          if (spreadStart > 0 && globalCaret <= ls) {
            const prevSpread = Math.max(0, spreadStart - 2);
            const prevRightStart = nextCuts[prevSpread] ?? 0;
            setSpreadStart(prevSpread);
            requestAnimationFrame(() => {
              const ta = rightTextareaRef.current; if (ta) {
                const off = Math.max(0, globalCaret - prevRightStart);
                ta.focus(); ta.selectionStart = off; ta.selectionEnd = off;
              }
            });
            return;
          }
          if (globalCaret <= le) {
            const off = Math.max(0, globalCaret - ls);
            const ta = leftTextareaRef.current; if (ta) { ta.focus(); ta.selectionStart = off; ta.selectionEnd = off; }
          } else if (globalCaret <= re) {
            const off = Math.max(0, globalCaret - le);
            const ta = rightTextareaRef.current; if (ta) { ta.focus(); ta.selectionStart = off; ta.selectionEnd = off; }
          } else {
            const ns = spreadStart + 2;
            const nextLeftStart = ns > 0 ? (nextCuts[ns - 1] ?? 0) : 0;
            setSpreadStart(ns);
            requestAnimationFrame(() => {
              const ta = leftTextareaRef.current; if (ta) {
                const off = Math.max(0, globalCaret - nextLeftStart);
                ta.focus(); ta.selectionStart = off; ta.selectionEnd = off;
              }
            });
          }
        });
      }}
      placeholder="Continue typing..."
      aria-label={`Right page text`}
    />
  );
};

export default TextFlowPage;

