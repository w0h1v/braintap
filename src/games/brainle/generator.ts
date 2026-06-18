import type { Difficulty } from "@/lib/types";
import { bankIndex } from "@/lib/daily";
import {
  ANSWERS,
  hintFor,
  MAX_ROWS_BY_DIFFICULTY,
  type BrainlePuzzle,
} from "./engine";
import { THEMED } from "./words";

// Memoise per (date, difficulty) — never per date alone — so each tier keeps its
// own stable daily puzzle.
const cache = new Map<string, BrainlePuzzle>();

/**
 * Pick the answer-bank index for a date AND difficulty. Each tier walks the bank
 * from its own tier-scoped offset (`bankIndex("brainle#<diff>", …)`) so the three
 * tiers land on different words on any given day. Hard is biased toward the
 * later, less-common pool (the curated brain-themed words lead the bank), so its
 * index is taken over the common-word region only.
 */
function answerIndexFor(dateISO: string, difficulty: Difficulty): number {
  const n = ANSWERS.length;
  if (difficulty === "hard") {
    // Restrict hard to the common-word pool that follows the themed lead-in.
    const start = Math.min(THEMED.length, n - 1);
    const span = n - start;
    return start + bankIndex("brainle#hard", span, dateISO);
  }
  return bankIndex(`brainle#${difficulty}`, n, dateISO);
}

/**
 * Deterministic daily puzzle for a date and difficulty tier (memoised per
 * date+tier). The tier sets the guess allowance (easy 7 / medium 6 / hard 5) and
 * selects a tier-distinct answer; omitting the difficulty yields the medium
 * puzzle. No Math.random / Date.now — fully reproducible.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): BrainlePuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const index = answerIndexFor(dateISO, difficulty);
  const answer = ANSWERS[index];
  const puzzle: BrainlePuzzle = {
    answer,
    hint: hintFor(answer),
    index,
    maxGuesses: MAX_ROWS_BY_DIFFICULTY[difficulty],
  };
  cache.set(key, puzzle);
  return puzzle;
}
