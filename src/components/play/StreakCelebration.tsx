"use client";

import { useEffect, useState } from "react";

/**
 * The streak-increment "moment". Win celebration (confetti + rings) already
 * fires on every win; this is the missing beat the day a streak actually grows.
 * A top-centred amber pill pops in, holds, and floats away (~2s) so it reads as
 * a distinct reward — extending the streak — layered above the completion modal.
 *
 * Fires whenever `trigger` increments. Under reduced motion it shows the same
 * pill briefly without the pop/float animation.
 */
export function StreakCelebration({
  trigger,
  streak,
  reducedMotion,
}: {
  trigger: number;
  streak: number;
  reducedMotion?: boolean;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (trigger <= 0) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), reducedMotion ? 1500 : 2200);
    return () => clearTimeout(t);
    // Fire only on a fresh streak signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(1.25rem,env(safe-area-inset-top))] z-[210] grid place-items-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={reducedMotion ? "" : "bt-streak"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          borderRadius: "100px",
          padding: "0.6rem 1.1rem",
          fontWeight: 700,
          color: "#1a1003",
          background: "linear-gradient(118deg, #ffb020, #ff7a18)",
          boxShadow: "0 12px 40px -8px rgba(255,176,32,0.55), inset 0 0 0 1px rgba(255,255,255,0.25)",
        }}
      >
        <span aria-hidden style={{ fontSize: "1.15rem", lineHeight: 1 }}>🔥</span>
        <span className="font-display" style={{ fontSize: "0.95rem", letterSpacing: "-0.01em" }}>
          {streak}-day streak!
        </span>
      </div>
      <style>{`
        .bt-streak {
          animation: btStreak 2200ms cubic-bezier(.2,.7,.2,1) both;
        }
        @keyframes btStreak {
          0%   { transform: translateY(-8px) scale(0.6); opacity: 0; }
          14%  { transform: translateY(0) scale(1.08); opacity: 1; }
          24%  { transform: scale(1); }
          78%  { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-14px) scale(0.96); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
