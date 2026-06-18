"use client";

import { useEffect, useState } from "react";
import { msUntilMidnight } from "@/lib/daily";

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor(s / 60) % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${ss}`;
}

export function ResetCountdown() {
  const [label, setLabel] = useState<string>("--:--:--");
  useEffect(() => {
    const tick = () => setLabel(fmt(msUntilMidnight()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-cyan">{label}</span>;
}
