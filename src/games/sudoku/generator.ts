import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import { generateSolved, makePuzzle, type SudokuPuzzle } from "./engine";

const cache = new Map<string, SudokuPuzzle>();

/** Deterministic daily puzzle for a date (memoised per date). */
export function getDailyPuzzle(dateISO: string): SudokuPuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;
  const rng = rngFromString(`sudoku:${dailySeed("sudoku", dateISO)}`);
  const solution = generateSolved(rng);
  const puzzle = makePuzzle(solution, rng, 22);
  cache.set(dateISO, puzzle);
  return puzzle;
}
