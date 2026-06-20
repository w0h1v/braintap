"use client";

import { useEffect, useState } from "react";
import type { Accent } from "@/lib/types";

/** Radial spark directions (evenly spaced), precomputed once. */
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { dx: Math.round(Math.cos(a) * 150), dy: Math.round(Math.sin(a) * 150) };
});

const DURATION_MS = 900;

/**
 * A brief (<1s) win "beat" — expanding rings + a radial spark burst from the
 * centre — played the instant a game is won, just before the completion modal
 * rises over it (the overlay sits at z-90, below the modal's z-100, so the
 * modal naturally covers it as it appears). Purely decorative, non-blocking,
 * and renders nothing when reduced motion is requested. Re-fires whenever
 * `trigger` increments.
 */
export function WinCelebration({
  trigger,
  accent,
  reducedMotion,
}: {
  trigger: number;
  accent: Accent;
  reducedMotion?: boolean;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (trigger <= 0 || reducedMotion) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), DURATION_MS);
    return () => clearTimeout(t);
    // Fire only when a new win is signalled (not when reducedMotion toggles).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[90] grid place-items-center overflow-hidden"
      aria-hidden
    >
      <span className="bt-win-ring" style={{ borderColor: accent.solid }} />
      <span className="bt-win-ring bt-win-ring--2" style={{ borderColor: accent.soft }} />
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="bt-win-spark"
          style={{
            background: i % 2 ? accent.from : accent.to,
            ["--dx" as string]: `${s.dx}px`,
            ["--dy" as string]: `${s.dy}px`,
          }}
        />
      ))}
      <style>{`
        .bt-win-ring {
          position: absolute;
          width: 200px;
          height: 200px;
          border-radius: 9999px;
          border: 2.5px solid;
          opacity: 0;
          animation: btWinRing ${DURATION_MS}ms cubic-bezier(.2,.7,.2,1) both;
        }
        .bt-win-ring--2 { animation-delay: 90ms; width: 120px; height: 120px; }
        @keyframes btWinRing {
          0% { transform: scale(0.2); opacity: 0.85; }
          70% { opacity: 0.35; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        .bt-win-spark {
          position: absolute;
          width: 9px;
          height: 9px;
          border-radius: 9999px;
          opacity: 0;
          animation: btWinSpark ${DURATION_MS}ms cubic-bezier(.15,.7,.3,1) both;
        }
        @keyframes btWinSpark {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          80% { opacity: 0.9; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
