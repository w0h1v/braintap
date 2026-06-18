import type { Difficulty } from "@/lib/types";
import { rngFromString } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import { generatePuzzle, type SprintPuzzle } from "./engine";

const cache = new Map<string, SprintPuzzle>();

/**
 * Deterministic daily Sum Sprint puzzle for a date and difficulty tier.
 *
 * The tier is a procedural knob: it seeds the RNG via `difficultySeed` so each
 * (date, tier) gets its own independent stream, and it selects the digit range,
 * target subset sizes, and clear goal in the engine. Memoised per (date, tier).
 * Omitting the difficulty yields the medium tier, preserving the default daily.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): SprintPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const seed = difficultySeed("sprint", dateISO, difficulty);
  const rng = rngFromString(`sprint:${difficulty}:${seed}`);
  const puzzle = generatePuzzle(rng, seed, difficulty);
  cache.set(key, puzzle);
  return puzzle;
}
