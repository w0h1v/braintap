import { difficultySeed } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";
import { paramsFor, problemAt, type MathSprintPuzzle } from "./engine";

const cache = new Map<string, MathSprintPuzzle>();

/** Deterministic daily puzzle for a date + tier (memoised per date:difficulty). */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): MathSprintPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // difficultySeed namespaces per (game, date, tier) so tiers differ on the
  // same day. The whole problem stream is derived from this single seed.
  const seed = difficultySeed("mathsprint", dateISO, difficulty);
  const params = paramsFor(difficulty);
  const first = problemAt(seed, 0, params);
  const puzzle: MathSprintPuzzle = { seed, difficulty, params, first };
  cache.set(key, puzzle);
  return puzzle;
}
