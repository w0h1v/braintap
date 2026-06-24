"use client";

import { ACHIEVEMENTS } from "@/lib/achievements";
import { useProgress } from "@/lib/progress";
import { cn } from "@/lib/cn";

/**
 * The full achievement catalogue with earned ones lit and the rest shown dim
 * (so they read as goals, not blanks). Earned state comes straight from the
 * persisted progress store; locked entries still show how to earn them.
 */
export function AchievementsGrid() {
  const hydrated = useProgress((s) => s.hydrated);
  const earned = useProgress((s) => s.achievements);
  const earnedSet = new Set(hydrated ? earned : []);

  return (
    <section aria-label="Achievements">
      <div className="flex items-end justify-between">
        <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">ACHIEVEMENTS</div>
        <div className="font-mono text-[11px] text-ink-mute tabular-nums">
          {earnedSet.size}/{ACHIEVEMENTS.length}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ACHIEVEMENTS.map((a) => {
          const got = earnedSet.has(a.id);
          return (
            <div
              key={a.id}
              className={cn(
                "rounded-2xl border p-3.5",
                got ? "border-line-strong bg-white/[0.04]" : "border-line bg-white/[0.015] opacity-60",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn("grid h-8 w-8 place-items-center rounded-xl text-[17px]", !got && "grayscale")}
                  style={{ background: got ? "rgba(124,245,196,0.14)" : "rgba(255,255,255,0.04)" }}
                  aria-hidden
                >
                  {a.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[13.5px] font-semibold text-ink">{a.title}</div>
                </div>
                {got ? (
                  <span className="font-mono text-[9px] tracking-[0.14em] text-mint">EARNED</span>
                ) : null}
              </div>
              <div className="mt-2 text-[11.5px] leading-snug text-ink-mute">{a.description}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
