import type { Difficulty } from "@/lib/types";
import { rngFromString } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import { generatePuzzle, type StroopPuzzle } from "./engine";

const cache = new Map<string, StroopPuzzle>();

/**
 * Deterministic daily Stroop Rush puzzle for a date and difficulty tier.
 *
 * The tier is a procedural knob: it seeds the RNG via `difficultySeed` so each
 * (date, tier) gets its own independent trial stream, and it selects the colour
 * set, round duration, congruent rate, win goal, and wrong-tap penalty in the
 * engine. Memoised per (date, tier). Omitting the difficulty yields the medium
 * tier, preserving the default daily.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): StroopPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const seed = difficultySeed("stroop", dateISO, difficulty);
  const rng = rngFromString(`stroop:${difficulty}:${seed}`);
  const puzzle = generatePuzzle(rng, seed, difficulty);
  cache.set(key, puzzle);
  return puzzle;
}
