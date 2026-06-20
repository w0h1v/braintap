"use client";

import { createContext, useContext } from "react";
import type { Difficulty } from "@/lib/types";

/**
 * Tier navigation for the currently-hosted game. Provided by GameHost (which
 * owns tier state) and consumed by CompletionModal so the completion card can
 * name the tier, tag the share text, and offer a "play the next tier" CTA —
 * without every one of the 15 games having to thread props down. `null` for
 * games that don't use tiers.
 */
export interface TierNav {
  /** The tier that was just played. */
  difficulty: Difficulty;
  /** The next tier in the unlock chain, or null at the top tier (Hard). */
  next: Difficulty | null;
  /** Switch the host to the next tier (no-op at the top tier). */
  goNext: () => void;
  /** Normalised 0–100 score of the most recent completion, for the rank reveal. */
  lastScore: number | null;
}

export const DifficultyContext = createContext<TierNav | null>(null);

export function useTierNav(): TierNav | null {
  return useContext(DifficultyContext);
}

/** Convenience: just the active tier (undefined when the game has no tiers). */
export function useActiveDifficulty(): Difficulty | undefined {
  return useContext(DifficultyContext)?.difficulty;
}
