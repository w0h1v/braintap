"use client";

import { createContext, useContext } from "react";
import type { Difficulty } from "@/lib/types";

/**
 * The active difficulty tier for the currently-hosted game. Provided by GameHost
 * (which owns tier state) and consumed by CompletionModal so the completion card
 * and share text can name the tier — without every one of the 15 games having to
 * thread the prop down. `undefined` for games that don't use tiers.
 */
export const DifficultyContext = createContext<Difficulty | undefined>(undefined);

export function useActiveDifficulty(): Difficulty | undefined {
  return useContext(DifficultyContext);
}
