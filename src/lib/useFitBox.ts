"use client";

import { useEffect, useRef, useState } from "react";

export interface FitSize {
  /** Box width in px. */
  w: number;
  /** Box height in px. */
  h: number;
}

/**
 * Size a `cols × rows`-aspect board to the largest box that fits its container,
 * by BOTH width and height. Pure CSS aspect-fit through a flex/grid chain is
 * unreliable when the board has no intrinsic size (1fr tracks collapse), so we
 * measure the container with a ResizeObserver and return explicit pixels.
 *
 * Usage: put `ref` on a height-bounded container (e.g. a `flex-1 min-h-0`
 * region between fixed header/controls), and apply `{ width, height }` from
 * `size` to the board. The board then fits the viewport on phones without
 * scrolling, and grows to `maxW` on larger screens.
 *
 * @param cols  board columns (width units)
 * @param rows  board rows (height units)
 * @param maxW  optional cap on width (px), e.g. desktop max board size
 */
export function useFitBox<T extends HTMLElement = HTMLDivElement>(
  cols: number,
  rows: number,
  maxW = Number.POSITIVE_INFINITY,
) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<FitSize | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const availW = el.clientWidth;
      const availH = el.clientHeight;
      if (!availW || !availH) return;
      // Largest cols×rows box fitting both dimensions.
      const w = Math.min(availW, (availH * cols) / rows, maxW);
      const next = { w, h: (w * rows) / cols };
      setSize((prev) =>
        prev && Math.abs(prev.w - next.w) < 0.5 ? prev : next,
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [cols, rows, maxW]);

  return { ref, size };
}
