import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import type { Difficulty as Tier } from "@/lib/types";
import {
  YOU,
  AI,
  tierToDifficulty,
  type ReversiPuzzle,
  type Player,
} from "./engine";

const cache = new Map<string, ReversiPuzzle>();

/**
 * Deterministic daily Reversi config (memoised per date AND difficulty tier).
 *
 * The daily board stays canonical across every tier: the standard opening, who
 * moves first, and the AI aggressiveness are all derived from the SAME daily
 * seed regardless of tier — so the puzzle "feel" is identical day to day. The
 * difficulty tier only sets the AI strength (search depth / heuristics):
 *   easy   → weak  (greedy + noise)
 *   medium → normal (greedy positional — the historical default)
 *   hard   → strong (minimax look-ahead)
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Tier = "medium",
): ReversiPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Canonical daily seed — NOT tier-scoped — so the board is the same per tier.
  const rng = rngFromString(`reversi:${dailySeed("reversi", dateISO)}`);

  // The human always plays the cyan "YOU" discs; the seed decides who opens.
  const playerColor: Player = YOU;
  const firstTurn: Player = rng.chance(0.5) ? YOU : AI;
  // Aggressiveness 0.2..0.9 — keeps the AI competent but varied day to day.
  const aggressiveness = Math.round(rng.float(0.2, 0.9) * 100) / 100;

  const puzzle: ReversiPuzzle = {
    playerColor,
    firstTurn,
    aggressiveness,
    aiDifficulty: tierToDifficulty(difficulty),
  };
  cache.set(key, puzzle);
  return puzzle;
}
