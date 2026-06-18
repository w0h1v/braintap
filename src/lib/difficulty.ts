import type { Difficulty } from "./types";
import { dailySeed } from "./daily";

/** Tiers in unlock order. */
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"] as const;

/** The default tier used when a caller omits difficulty (legacy single puzzle). */
export const DEFAULT_DIFFICULTY: Difficulty = "medium";

export interface DifficultyMeta {
  id: Difficulty;
  label: string;
  /** Short one-word badge. */
  short: string;
  /** Accent colour for chips / rings. */
  color: string;
  /** 0-based position in the unlock chain. */
  order: number;
}

export const DIFFICULTY_META: Record<Difficulty, DifficultyMeta> = {
  easy: { id: "easy", label: "Easy", short: "E", color: "#7CF5C4", order: 0 },
  medium: { id: "medium", label: "Medium", short: "M", color: "#ffb020", order: 1 },
  hard: { id: "hard", label: "Hard", short: "H", color: "#ff2bd6", order: 2 },
};

/** The tier that must be solved before `d` unlocks (null for easy). */
export function prevDifficulty(d: Difficulty): Difficulty | null {
  const i = DIFFICULTY_META[d].order;
  return i <= 0 ? null : DIFFICULTIES[i - 1];
}

/** The next tier after `d` (null after hard). */
export function nextDifficulty(d: Difficulty): Difficulty | null {
  const i = DIFFICULTY_META[d].order;
  return i >= DIFFICULTIES.length - 1 ? null : DIFFICULTIES[i + 1];
}

export function isDifficulty(v: unknown): v is Difficulty {
  return v === "easy" || v === "medium" || v === "hard";
}

/**
 * A deterministic integer seed for a game on a date AT a difficulty. Distinct
 * per (game, date, tier) so each tier gets its own puzzle. Falls back to the
 * plain daily seed for the default tier so legacy puzzles stay stable.
 */
export function difficultySeed(
  gameId: string,
  dateISO: string,
  difficulty: Difficulty = DEFAULT_DIFFICULTY,
): number {
  return dailySeed(`${gameId}#${difficulty}`, dateISO);
}
