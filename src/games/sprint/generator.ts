import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import { generatePuzzle, type SprintPuzzle } from "./engine";

const cache = new Map<string, SprintPuzzle>();

/** Deterministic daily Sum Sprint puzzle for a date (memoised per date). */
export function getDailyPuzzle(dateISO: string): SprintPuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;
  const seed = dailySeed("sprint", dateISO);
  const rng = rngFromString(`sprint:${seed}`);
  const puzzle = generatePuzzle(rng, seed);
  cache.set(dateISO, puzzle);
  return puzzle;
}
