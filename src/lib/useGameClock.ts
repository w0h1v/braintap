"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A simple wall-clock game timer. Returns elapsed ms and controls.
 * Pass `autostart` to begin immediately on mount.
 */
export function useGameClock(autostart = true, initialMs = 0) {
  const [ms, setMs] = useState(initialMs);
  const [running, setRunning] = useState(autostart);
  const startRef = useRef<number>(0);
  const baseRef = useRef<number>(initialMs);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const tick = () => setMs(baseRef.current + (Date.now() - startRef.current));
    tick();
    const t = setInterval(tick, 250);
    return () => {
      clearInterval(t);
      baseRef.current = baseRef.current + (Date.now() - startRef.current);
    };
  }, [running]);

  const start = useCallback(() => setRunning(true), []);
  const stop = useCallback(() => setRunning(false), []);
  const reset = useCallback((to = 0) => {
    baseRef.current = to;
    setMs(to);
  }, []);

  return { ms, running, start, stop, reset };
}
