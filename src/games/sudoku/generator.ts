import { rngFromString } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";
import { generateSolved, makePuzzle, type SudokuPuzzle } from "./engine";

const cache = new Map<string, SudokuPuzzle>();

/**
 * How many cells to remove for each tier. More removed = fewer clues = harder.
 * easy=14, medium=20, hard=26.
 */
const TARGET_REMOVED: Record<Difficulty, number> = {
  easy: 14,
  medium: 20,
  hard: 26,
};

/** Deterministic daily puzzle for a date + tier (memoised per date:difficulty). */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): SudokuPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = rngFromString(`sudoku:${difficultySeed("sudoku", dateISO, difficulty)}`);
  const solution = generateSolved(rng);
  const puzzle = makePuzzle(solution, rng, TARGET_REMOVED[difficulty]);
  cache.set(key, puzzle);
  return puzzle;
}
