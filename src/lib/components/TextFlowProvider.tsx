import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type ProviderProps = {
  leftContentRef: React.RefObject<HTMLDivElement | null>;
  rightContentRef: React.RefObject<HTMLDivElement | null>;
  spreadStart: number;
  setSpreadStart: React.Dispatch<React.SetStateAction<number>>;
  pageWidth: number;
  initialValue?: string;
  value?: string; // optional controlled value
  onChange?: (text: string) => void; // optional controlled change handler
  reservedTopLines?: number; // lines reserved only on the first page (visual header)
};

type Ctx = {
  fullText: string;
  cuts: number[];
  leftTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  rightTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  spreadStart: number;
  setSpreadStart: React.Dispatch<React.SetStateAction<number>>;
  setFullText: (text: string) => void;
  computeCutsFor: (text: string) => number[];
};

const TextFlowContext = createContext<Ctx | undefined>(undefined);

export const useTextFlow = () => {
  const ctx = useContext(TextFlowContext);
  if (!ctx) throw new Error("useTextFlow must be used within TextFlowProvider");
  return ctx;
};

export const TextFlowProvider: React.FC<React.PropsWithChildren<ProviderProps>> = ({
  leftContentRef,
  rightContentRef,
  spreadStart,
  setSpreadStart,
  pageWidth,
  initialValue = "",
  value,
  onChange,
  reservedTopLines = 0,
  children,
}) => {
  const [internalText, setInternalText] = useState<string>(initialValue);
  const fullText = value !== undefined ? value : internalText;
  const [cuts, setCuts] = useState<number[]>([]);

  const leftTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const rightTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const measureRef = useRef<HTMLTextAreaElement | null>(null);

  // Hidden measurement textarea (content-box only)
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

  const computeCutsFor = (text: string): number[] => {
    const ta = leftTextareaRef.current;
    const measureTA = measureRef.current;
    if (!ta || !measureTA) return cuts;
    const cs = getComputedStyle(ta);
    const padT = parseFloat(cs.paddingTop) || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const contentW = Math.max(0, ta.clientWidth - padL - padR);
    const contentH = Math.max(0, ta.clientHeight - padT - padB);
    const lineH = parseFloat(cs.lineHeight) || 0;
    const reservePx = Math.max(0, reservedTopLines) * lineH;
    // Base height corresponds to later-page capacity; when on first spread, add reserved space back
    const baseH = spreadStart === 0 ? contentH + reservePx : contentH;
    measureTA.style.width = `${contentW}px`;
    measureTA.style.fontFamily = cs.fontFamily;
    measureTA.style.fontSize = cs.fontSize;
    measureTA.style.lineHeight = cs.lineHeight;
    measureTA.style.letterSpacing = cs.letterSpacing;
    measureTA.style.fontWeight = cs.fontWeight as string;
    measureTA.style.padding = "0";
    // Keep visual reserves aligned
    if (leftContentRef.current) leftContentRef.current.style.setProperty("--rlh", cs.lineHeight);
    if (rightContentRef.current) rightContentRef.current.style.setProperty("--rlh", cs.lineHeight);

    const newCuts: number[] = [];
    let start = 0;
    let pageIndex = 0;
    while (start < text.length || newCuts.length === 0) {
      const effH = Math.max(0, baseH - (pageIndex === 0 ? reservePx : 0));
      measureTA.style.height = `${effH}px`;
      let low = start;
      let high = text.length;
      let best = start;
      while (low <= high) {
        const mid = (low + high) >> 1;
        measureTA.value = text.slice(start, mid);
        const fits = measureTA.scrollHeight <= measureTA.clientHeight;
        if (fits) { best = mid; low = mid + 1; }
        else { high = mid - 1; }
      }
      if (best === start) best = Math.min(text.length, start + 1);
      newCuts.push(best);
      start = best;
      pageIndex += 1;
      if (start >= text.length) break;
    }
    return newCuts;
  };

  // Repaginate when text or page size changes
  useEffect(() => {
    const next = computeCutsFor(fullText);
    setCuts((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, pageWidth]);

  const ctxValue: Ctx = useMemo(
    () => ({
      fullText,
      cuts,
      leftTextareaRef,
      rightTextareaRef,
      spreadStart,
      setSpreadStart,
      setFullText: (txt: string) => {
        if (onChange) onChange(txt);
        else setInternalText(txt);
      },
      computeCutsFor,
    }),
    [fullText, cuts, spreadStart, setSpreadStart, onChange]
  );

  return <TextFlowContext.Provider value={ctxValue}>{children}</TextFlowContext.Provider>;
};

export default TextFlowProvider;
