"use client";

import type { Accent } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Shared hint control used across games for a consistent look + behaviour.
 * Games own the hint *logic*; this is the presentational trigger that shows
 * how many hints remain. Using a hint should reduce the game's score.
 */
export function HintButton({
  used,
  max,
  onHint,
  accent,
  disabled,
  className,
  label = "Hint",
}: {
  used: number;
  max: number;
  onHint: () => void;
  accent: Accent;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const left = Math.max(0, max - used);
  const out = left <= 0;
  return (
    <button
      type="button"
      onClick={onHint}
      disabled={disabled || out}
      aria-label={out ? "No hints left" : `Use a hint, ${left} of ${max} remaining`}
      className={cn(
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border px-4 py-2.5",
        "font-display text-[13.5px] transition-colors active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      style={{
        background: "rgba(255,255,255,0.04)",
        borderColor: out ? "rgba(255,255,255,0.14)" : `${accent.solid}66`,
        color: out ? "rgba(226,234,255,0.45)" : accent.soft,
      }}
    >
      <span aria-hidden>💡</span>
      {label}
      <span className="font-mono text-[11px] opacity-80">
        {left}/{max}
      </span>
    </button>
  );
}
