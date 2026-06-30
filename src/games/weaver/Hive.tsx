"use client";

import { cn } from "@/lib/cn";
import type { Accent } from "@/lib/types";

/** Hexagon cell positions in a 260×280 coordinate space (center first). */
const POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [130, 140],
  [130, 42],
  [214, 91],
  [214, 189],
  [130, 238],
  [46, 189],
  [46, 91],
];

const HEX_CLIP = "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)";

interface HiveProps {
  /** Letters with the center first, then the (possibly shuffled) outer letters. */
  cells: string[];
  accent: Accent;
  /** Letter currently animating a press, or null. */
  popLetter: string | null;
  /** Whether the spin-shuffle animation is active. */
  spinning: boolean;
  reducedMotion?: boolean;
  disabled?: boolean;
  onTap: (letter: string) => void;
  /**
   * Explicit hive width in px. When provided (from a fit-to-height measurement),
   * it overrides the default responsive `min(82vw, 296px)` so the hive scales to
   * fit the available vertical space on small phones. Height follows the fixed
   * 260/280 aspect ratio.
   */
  width?: number;
}

/**
 * The 7-cell letter hive. Purely presentational: positioning, the neon center
 * gem, press/spin micro-interactions, and accessible per-letter buttons.
 */
export function Hive({
  cells,
  accent,
  popLetter,
  spinning,
  reducedMotion,
  disabled,
  onTap,
  width,
}: HiveProps) {
  return (
    <div
      className="relative"
      style={{
        width: width != null ? width : "min(82vw, 296px)",
        aspectRatio: "260 / 280",
        transition: reducedMotion ? "none" : "transform 0.32s cubic-bezier(.2,.7,.2,1)",
        transform: spinning && !reducedMotion ? "rotate(360deg)" : "rotate(0deg)",
      }}
      role="group"
      aria-label="Letter hive — tap letters to build a word"
    >
      {cells.map((letter, i) => {
        const [x, y] = POSITIONS[i];
        const isCenter = i === 0;
        const popping = popLetter === letter;
        return (
          <button
            key={`${letter}-${i}`}
            type="button"
            onClick={() => onTap(letter)}
            disabled={disabled}
            aria-label={
              isCenter
                ? `Center letter ${letter}, required in every word`
                : `Letter ${letter}`
            }
            className={cn(
              "absolute flex select-none items-center justify-center font-display font-bold outline-none",
              "transition-[transform,background,box-shadow] duration-100",
              "active:scale-90 disabled:cursor-default",
              "focus-visible:z-10 focus-visible:scale-110 focus-visible:brightness-110",
            )}
            style={{
              left: `${(x / 260) * 100}%`,
              top: `${(y / 280) * 100}%`,
              width: "31%",
              height: "32.4%",
              minWidth: 40,
              minHeight: 40,
              transform: `translate(-50%, -50%)${popping && !reducedMotion ? " scale(0.9)" : ""}`,
              clipPath: HEX_CLIP,
              fontSize: "clamp(22px, 7.4vw, 28px)",
              background: isCenter
                ? `linear-gradient(160deg, ${accent.from}, ${accent.to})`
                : popping
                  ? "rgba(255,255,255,0.16)"
                  : "rgba(255,255,255,0.07)",
              color: isCenter ? "#04060f" : "#eafcff",
              boxShadow: isCenter
                ? `0 0 26px ${accent.solid}66, inset 0 0 12px rgba(255,255,255,0.35)`
                : "inset 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
