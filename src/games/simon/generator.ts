import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import { generateSequence, type SimonPuzzle } from "./engine";

const cache = new Map<string, SimonPuzzle>();

/** Deterministic daily Simon sequence for a date (memoised per date). */
export function getDailyPuzzle(dateISO: string): SimonPuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;
  const rng = rngFromString(`simon:${dailySeed("simon", dateISO)}`);
  const puzzle: SimonPuzzle = { sequence: generateSequence(rng) };
  cache.set(dateISO, puzzle);
  return puzzle;
}
