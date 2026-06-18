import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import { generatePuzzle, type PipsPuzzle } from "./engine";

const cache = new Map<string, PipsPuzzle>();

/** Deterministic daily puzzle for a date (memoised per date). */
export function getDailyPuzzle(dateISO: string): PipsPuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;
  const rng = rngFromString(`pips:${dailySeed("pips", dateISO)}`);
  const puzzle = generatePuzzle(rng);
  cache.set(dateISO, puzzle);
  return puzzle;
}
