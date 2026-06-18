import type { Difficulty } from "@/lib/types";
import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import { generateGrid, DEFAULT_SIZE, type SchulteSize, type SchultePuzzle } from "./engine";

const cache = new Map<string, SchultePuzzle>();

/** Difficulty → grid edge length: easy=3×3, medium=5×5, hard=7×7. */
const SIZE_BY_DIFFICULTY: Record<Difficulty, SchulteSize> = {
  easy: 3,
  medium: 5,
  hard: 7,
};

/**
 * Deterministic Schulte table for a date and grid size (memoised). The grid is
 * regenerated per (date, size) from the seeded Rng, so a date always yields the
 * same table at each size and different sizes are independent.
 */
export function getDailyPuzzleForSize(
  dateISO: string,
  size: number = DEFAULT_SIZE,
): SchultePuzzle {
  const key = `${dateISO}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // The default 5×5 keeps its historical seed (no size segment) so the daily
  // table is unchanged; other sizes get a size-scoped, independent seed.
  const seed =
    size === DEFAULT_SIZE
      ? `schulte:${dailySeed("schulte", dateISO)}`
      : `schulte:${size}:${dailySeed("schulte", dateISO)}`;
  const rng = rngFromString(seed);
  const grid = generateGrid(rng, size);
  const puzzle: SchultePuzzle = { grid, size };
  cache.set(key, puzzle);
  return puzzle;
}

/**
 * Deterministic daily Schulte table for a date and difficulty tier. The tier
 * selects the grid size — easy=3×3, medium=5×5, hard=7×7 — and the table is
 * deterministic per (date, size). Omitting the difficulty yields the medium 5×5
 * table, preserving the historical daily puzzle.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): SchultePuzzle {
  return getDailyPuzzleForSize(dateISO, SIZE_BY_DIFFICULTY[difficulty]);
}
