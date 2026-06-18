import type { Difficulty } from "@/lib/types";
import { rngFromString } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import {
  scramble,
  solvedBoard,
  isSolved,
  type SlideSize,
  type SlidePuzzle,
} from "./engine";

const cache = new Map<string, SlidePuzzle>();

/** Difficulty → grid edge length: easy=3×3, medium=4×4, hard=5×5. */
const SIZE_BY_DIFFICULTY: Record<Difficulty, SlideSize> = {
  easy: 3,
  medium: 4,
  hard: 5,
};

/** Scramble depth scales with the grid so larger boards start further from solved. */
const STEPS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 80,
  medium: 200,
  hard: 320,
};

/**
 * Deterministic daily sliding-tile puzzle for a date and difficulty tier. The
 * tier selects the grid size (easy=3×3, medium=4×4, hard=5×5) and the scramble
 * depth. Procedural: the rng is seeded via difficultySeed so each (date, tier)
 * pair yields its own puzzle. A random walk from the solved state always lands
 * in the solvable group, so the result is guaranteed solvable. Memoised per
 * (date, difficulty). Omitting the difficulty yields the medium 4×4 puzzle.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): SlidePuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = SIZE_BY_DIFFICULTY[difficulty];
  const steps = STEPS_BY_DIFFICULTY[difficulty];
  const rng = rngFromString(`slide:${difficultySeed("slide", dateISO, difficulty)}`);

  let start = scramble(rng, steps, size);
  // A random walk can (rarely) return to solved — keep walking until it isn't.
  while (isSolved(start)) {
    start = scramble(rng, steps, size);
  }

  const puzzle: SlidePuzzle = {
    start,
    goal: solvedBoard(size),
    size,
    scrambleSteps: steps,
  };
  cache.set(key, puzzle);
  return puzzle;
}
