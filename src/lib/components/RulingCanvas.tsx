import React, { useEffect, useRef } from "react";

type RulingCanvasProps = {
  anchorRef: React.RefObject<HTMLElement | null>;
  version?: number; // bump to force redraws when content changes
  bottomTrimLines?: number; // default 1 line trimmed at bottom
};

const pf = (v: string) => parseFloat(v) || 0;

const RulingCanvas: React.FC<RulingCanvasProps> = ({ anchorRef, version = 0, bottomTrimLines = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    const canvas = canvasRef.current;
    if (!anchor || !canvas) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = anchor.clientWidth;
      const h = anchor.clientHeight;
      if (w <= 0 || h <= 0) return;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;

      const anchorRect = anchor.getBoundingClientRect();
      const csA = getComputedStyle(anchor);
      const padTop = pf(csA.paddingTop);
      const padBottom = pf(csA.paddingBottom);
      const padLeft = pf(csA.paddingLeft);
      const padRight = pf(csA.paddingRight);
      const drawX0 = padLeft;
      const drawX1 = Math.max(drawX0, w - padRight);
      const biasVar = csA.getPropertyValue("--rule-bias");
      const bias = parseFloat(biasVar) || 0; // exact alignment by default

      // Determine step using first text line (fallback to 1.5em)
      const ft = anchor.querySelector("p, li") as HTMLElement | null;
      let fs = 16,
        lh = 24;
      if (ft) {
        const csT = getComputedStyle(ft);
        fs = pf(csT.fontSize) || fs;
        const lhRaw = parseFloat(csT.lineHeight);
        lh = isFinite(lhRaw) && lhRaw > 0 ? lhRaw : fs * 1.5;
      } else {
        const csT = getComputedStyle(anchor);
        fs = pf(csT.fontSize) || fs;
        lh = fs * 1.5;
      }
      const step = Math.max(1, Math.round(lh * dpr)) / dpr;
      const bottomLimit = h - padBottom - bottomTrimLines * step;

      // Clip to inner content box
      ctx.save();
      ctx.beginPath();
      ctx.rect(drawX0, padTop, Math.max(0, drawX1 - drawX0), Math.max(0, h - padTop - padBottom));
      ctx.clip();

      // Draw lines for each text baseline
      const blocks = anchor.querySelectorAll("p");
      let lastY = -1;
      blocks.forEach((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = Array.from(range.getClientRects());
        rects.forEach((r) => {
          if (r.height < 1) return;
          const y = r.bottom - anchorRect.top; // relative to anchor top
          const yAdj = y - bias;
          const ySnap = Math.round(yAdj * dpr) / dpr;
          if (ySnap > bottomLimit) return; // trim bottom lines
          if (lastY >= 0 && Math.abs(ySnap - lastY) < 0.5) return; // de-dupe
          ctx.beginPath();
          ctx.moveTo(drawX0, ySnap - 0.5);
          ctx.lineTo(drawX1, ySnap - 0.5);
          ctx.stroke();
          lastY = ySnap;
        });
      });

      // Draw only at the text line positions; do not synthesize extra lines

      ctx.restore();
    };

    const ro = new ResizeObserver(draw);
    ro.observe(anchor);
    draw();
    window.addEventListener("resize", draw);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [anchorRef, version, bottomTrimLines]);

  return <canvas ref={canvasRef} className="ruling-canvas" aria-hidden="true" />;
};

export default RulingCanvas;
