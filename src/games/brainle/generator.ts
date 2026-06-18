import { bankIndex } from "@/lib/daily";
import { ANSWERS, hintFor, type BrainlePuzzle } from "./engine";

const cache = new Map<string, BrainlePuzzle>();

/**
 * Deterministic daily puzzle for a date (memoised per date). The answer walks
 * the bank by day number (via `bankIndex`) so consecutive days never repeat
 * until the whole bank has been used.
 */
export function getDailyPuzzle(dateISO: string): BrainlePuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;
  const index = bankIndex("brainle", ANSWERS.length, dateISO);
  const answer = ANSWERS[index];
  const puzzle: BrainlePuzzle = { answer, hint: hintFor(answer), index };
  cache.set(dateISO, puzzle);
  return puzzle;
}
