import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import { scramble, solvedBoard, isSolved, type SlidePuzzle } from "./engine";

const cache = new Map<string, SlidePuzzle>();

const SCRAMBLE_STEPS = 200;

/** Deterministic daily 15-puzzle for a date (memoised per date). */
export function getDailyPuzzle(dateISO: string): SlidePuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;

  const rng = rngFromString(`slide:${dailySeed("slide", dateISO)}`);
  let start = scramble(rng, SCRAMBLE_STEPS);
  // A random walk can (rarely) return to solved — keep walking until it isn't.
  while (isSolved(start)) {
    start = scramble(rng, SCRAMBLE_STEPS);
  }

  const puzzle: SlidePuzzle = {
    start,
    goal: solvedBoard(),
    scrambleSteps: SCRAMBLE_STEPS,
  };
  cache.set(dateISO, puzzle);
  return puzzle;
}
