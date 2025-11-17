import React, { useEffect, useRef, useState } from "react";

type BookTextEditorProps = {
  initialValue?: string;
  reserveLines?: number; // bottom reserve in lines
};

const BookTextEditor: React.FC<BookTextEditorProps> = ({ initialValue = "", reserveLines = 1 }) => {
  const [spreadStart, setSpreadStart] = useState<number>(0);
  const [text, setText] = useState<string>(initialValue);
  const [cuts, setCuts] = useState<number[]>([]);

  const leftContentRef = useRef<HTMLDivElement | null>(null);
  const rightContentRef = useRef<HTMLDivElement | null>(null);
  const leftTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const rightTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const measureRef = useRef<HTMLTextAreaElement | null>(null);

  // Create hidden measurement textarea once
  useEffect(() => {
    if (measureRef.current) return;
    const ta = document.createElement("textarea");
    ta.setAttribute("wrap", "soft");
    ta.style.position = "fixed";
    ta.style.left = "-10000px";
    ta.style.top = "0";
    ta.style.visibility = "hidden";
    ta.style.pointerEvents = "none";
    ta.style.whiteSpace = "pre-wrap";
    ta.style.overflow = "hidden";
    ta.style.border = "0";
    ta.style.resize = "none";
    document.body.appendChild(ta);
    measureRef.current = ta;
    return () => {
      if (measureRef.current && measureRef.current.parentElement) {
        measureRef.current.parentElement.removeChild(measureRef.current);
      }
      measureRef.current = null;
    };
  }, []);

  // Compute page cuts for provided text based on left textarea metrics
  const computeCutsFor = (t: string): number[] => {
    const leftTA = leftTextareaRef.current;
    const measureTA = measureRef.current;
    if (!leftTA || !measureTA) return cuts;
    const cs = getComputedStyle(leftTA);
    const padT = parseFloat(cs.paddingTop) || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const contentW = Math.max(0, leftTA.clientWidth - padL - padR);
    const contentH = Math.max(0, leftTA.clientHeight - padT - padB);
    measureTA.style.width = `${contentW}px`;
    measureTA.style.height = `${contentH}px`;
    measureTA.style.fontFamily = cs.fontFamily;
    measureTA.style.fontSize = cs.fontSize;
    measureTA.style.lineHeight = cs.lineHeight;
    measureTA.style.letterSpacing = cs.letterSpacing;
    measureTA.style.fontWeight = cs.fontWeight as string;
    measureTA.style.padding = "0";

    // Sync reserve line-height var on containers
    if (leftContentRef.current) leftContentRef.current.style.setProperty("--rlh", cs.lineHeight);
    if (rightContentRef.current) rightContentRef.current.style.setProperty("--rlh", cs.lineHeight);

    const out: number[] = [];
    let start = 0;
    while (start < t.length || out.length === 0) {
      let low = start;
      let high = t.length;
      let best = start;
      while (low <= high) {
        const mid = (low + high) >> 1;
        measureTA.value = t.slice(start, mid);
        const fits = measureTA.scrollHeight <= measureTA.clientHeight;
        if (fits) { best = mid; low = mid + 1; } else { high = mid - 1; }
      }
      if (best === start) best = Math.min(t.length, start + 1);
      out.push(best);
      start = best;
      if (start >= t.length) break;
    }
    return out;
  };

  // Recompute on text or size changes
  useEffect(() => {
    const nextCuts = computeCutsFor(text);
    setCuts((prev) => (prev.length === nextCuts.length && prev.every((v, i) => v === nextCuts[i]) ? prev : nextCuts));
    const ro = new ResizeObserver(() => setCuts(computeCutsFor(text)));
    if (leftContentRef.current) ro.observe(leftContentRef.current);
    if (rightContentRef.current) ro.observe(rightContentRef.current);
    window.addEventListener("resize", () => setCuts(computeCutsFor(text)));
    return () => ro.disconnect();
  }, [text]);

  const handleLeftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const start = spreadStart > 0 ? (cuts[spreadStart - 1] ?? 0) : 0;
    const end = cuts[spreadStart] ?? 0;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const nextText = before + e.target.value + after;
    const localCaret = e.target.selectionStart ?? e.target.value.length;
    const globalCaret = start + localCaret;
    const nextCuts = computeCutsFor(nextText);
    setCuts(nextCuts);
    setText(nextText);
    Promise.resolve().then(() => {
      const ls = spreadStart > 0 ? (nextCuts[spreadStart - 1] ?? 0) : 0;
      const le = nextCuts[spreadStart] ?? ls;
      const re = nextCuts[spreadStart + 1] ?? le;
      if (globalCaret <= le) {
        const off = Math.max(0, globalCaret - ls);
        const ta = leftTextareaRef.current;
        if (ta) { ta.focus(); ta.selectionStart = off; ta.selectionEnd = off; }
      } else if (globalCaret <= re) {
        const off = Math.max(0, globalCaret - le);
        const ta = rightTextareaRef.current;
        if (ta) { ta.focus(); ta.selectionStart = off; ta.selectionEnd = off; }
      }
    });
  };

  const handleRightChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const leftEnd = cuts[spreadStart] ?? 0;
    const rightEnd = cuts[spreadStart + 1] ?? leftEnd;
    const before = text.slice(0, leftEnd);
    const after = text.slice(rightEnd);
    const nextText = before + e.target.value + after;
    const localCaret = e.target.selectionStart ?? e.target.value.length;
    const globalCaret = leftEnd + localCaret;
    const nextCuts = computeCutsFor(nextText);
    setCuts(nextCuts);
    setText(nextText);
    Promise.resolve().then(() => {
      const ls = spreadStart > 0 ? (nextCuts[spreadStart - 1] ?? 0) : 0;
      const le = nextCuts[spreadStart] ?? ls;
      const re = nextCuts[spreadStart + 1] ?? le;
      if (globalCaret <= le) {
        const off = Math.max(0, globalCaret - ls);
        const ta = leftTextareaRef.current;
        if (ta) { ta.focus(); ta.selectionStart = off; ta.selectionEnd = off; }
      } else if (globalCaret <= re) {
        const off = Math.max(0, globalCaret - le);
        const ta = rightTextareaRef.current;
        if (ta) { ta.focus(); ta.selectionStart = off; ta.selectionEnd = off; }
      } else {
        // Auto-advance to next spread
        const nextSpread = spreadStart + 2;
        const nextLeftStart = nextSpread > 0 ? (nextCuts[nextSpread - 1] ?? 0) : 0;
        setSpreadStart(nextSpread);
        requestAnimationFrame(() => {
          const ta = leftTextareaRef.current;
          if (ta) {
            const off = Math.max(0, globalCaret - nextLeftStart);
            ta.focus();
            ta.selectionStart = off;
            ta.selectionEnd = off;
          }
        });
      }
    });
  };

  const leftStart = spreadStart > 0 ? (cuts[spreadStart - 1] ?? 0) : 0;
  const leftEnd = cuts[spreadStart] ?? 0;
  const rightEnd = cuts[spreadStart + 1] ?? leftEnd;

  return (
    <div className="book">
      <div className="book__page book__page--left">
        <div className="book__paper">
          {spreadStart > 0 && (
            <button
              type="button"
              className="book__nav-btn book__nav-btn--prev book__nav-btn--tall"
              aria-label="Previous pages"
              onClick={() => setSpreadStart(Math.max(0, spreadStart - 2))}
            />
          )}
          <div
            className="book__content"
            ref={leftContentRef}
            style={{ ["--line-reserve-lines"]: reserveLines } as React.CSSProperties}
          >
            <textarea
              ref={leftTextareaRef}
              className="book__textarea w-full bg-transparent textarea-lined"
              value={text.slice(leftStart, leftEnd)}
              onChange={handleLeftChange}
              placeholder="Start typing..."
              aria-label={`Left page text`}
              autoFocus
            />
          </div>
          <div className="book__page-num left">{spreadStart + 1}</div>
        </div>
      </div>

      <div className="book__page book__page--right">
        <div className="book__paper">
          <button
            type="button"
            className="book__nav-btn book__nav-btn--next book__nav-btn--tall"
            aria-label="Next pages"
            onClick={() => setSpreadStart(spreadStart + 2)}
          />
          <div
            className="book__content"
            ref={rightContentRef}
            style={{ ["--line-reserve-lines"]: reserveLines } as React.CSSProperties}
          >
            <textarea
              ref={rightTextareaRef}
              className="book__textarea w-full bg-transparent textarea-lined"
              value={text.slice(leftEnd, rightEnd)}
              onChange={handleRightChange}
              placeholder="Continue typing..."
              aria-label={`Right page text`}
            />
          </div>
          <div className="book__page-num right">{spreadStart + 2}</div>
        </div>
      </div>
    </div>
  );
};

export default BookTextEditor;

