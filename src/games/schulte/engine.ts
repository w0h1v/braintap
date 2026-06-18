/**
 * Schulte Table engine — pure, deterministic logic for an N×N grid containing a
 * shuffled permutation of the numbers 1..N². The player taps the numbers in
 * ascending order (1 → N²) as fast as possible. There is no solvability
 * constraint: every permutation is trivially completable. No React, no DOM, no
 * globals — fully unit-testable.
 *
 * The default daily table is 5×5; 3×3 and 7×7 are additive practice variants.
 */

import type { Rng } from "@/lib/rng";

export const SIZE = 5; // default 5×5 grid
export const CELLS = SIZE * SIZE; // 25 cells
export const MAX = CELLS; // numbers run 1..25

/** Supported grid edge lengths. The daily table uses DEFAULT_SIZE (5). */
export const SIZES = [3, 5, 7] as const;
export type SchulteSize = (typeof SIZES)[number];
export const DEFAULT_SIZE: SchulteSize = SIZE;

/** True when `n` is one of the supported grid sizes. */
export function isSchulteSize(n: unknown): n is SchulteSize {
  return typeof n === "number" && (SIZES as readonly number[]).includes(n);
}

/** Number of cells (== highest number) for a given edge length. */
export function cellsFor(size: number): number {
  return size * size;
}

export interface SchultePuzzle {
  /** Row-major grid of size² cells, a permutation of 1..size². */
  grid: number[];
  /** Grid edge length (3, 5 or 7). */
  size: number;
}

/**
 * Build a grid for the given edge length: a Fisher-Yates shuffle of
 * [1..size²] from the seeded Rng. Defaults to the 5×5 daily size.
 */
export function generateGrid(rng: Rng, size: number = SIZE): number[] {
  const cells = cellsFor(size);
  const base = Array.from({ length: cells }, (_, i) => i + 1);
  return rng.shuffle(base);
}

/** Index of a value within the grid, or -1 if absent. */
export function cellOf(grid: number[], value: number): number {
  return grid.indexOf(value);
}

/** True when `value` is the number the player should tap next given progress. */
export function isCorrectTap(value: number, next: number): boolean {
  return value === next;
}

/**
 * True when the player has tapped through the final number. `max` defaults to
 * the 5×5 high number (25) for backward-compatibility with callers that omit it.
 */
export function isComplete(next: number, max: number = MAX): boolean {
  return next > max;
}

/**
 * Map a finish time (ms) to a normalised 0–100 score for cross-game
 * leaderboards. Faster is better. The thresholds scale with the grid: a smaller
 * table is expected to be faster, a larger one slower, so the "perfect" and
 * "floor" times are stretched proportionally to the number count.
 *
 * `size` defaults to the daily 5×5 so existing callers keep their behaviour.
 */
export function scoreForTime(timeMs: number, size: number = SIZE): number {
  const sec = timeMs / 1000;
  // Scale the 5×5 reference window (perfect <=15s, floor at 75s) by cell count.
  const scale = cellsFor(size) / CELLS;
  const perfect = 15 * scale;
  const span = 60 * scale;
  const raw = 100 - (Math.max(0, sec - perfect) / span) * 60;
  return Math.max(20, Math.min(100, Math.round(raw)));
}

/**
 * A short, time-based title for the completion modal. Thresholds scale with the
 * grid size; `size` defaults to 5×5 for backward-compatibility.
 */
export function titleForTime(timeMs: number, size: number = SIZE): string {
  const scale = cellsFor(size) / CELLS;
  if (timeMs < 18000 * scale) return "Eagle eyes.";
  if (timeMs < 30000 * scale) return "Sharp focus.";
  return "Locked in.";
}

/** Star rating for a clear time at the given grid size (3, 2 or 1 stars). */
export function starsForTime(timeMs: number, size: number = SIZE): number {
  const scale = cellsFor(size) / CELLS;
  return timeMs < 18000 * scale ? 3 : timeMs < 30000 * scale ? 2 : 1;
}

/**
 * Validate that a puzzle is a well-formed permutation of 1..size² for a
 * supported size. Accepts any of the supported grid sizes (3/5/7).
 */
export function validateSchulte(p: SchultePuzzle): boolean {
  if (!p || !isSchulteSize(p.size)) return false;
  const cells = cellsFor(p.size);
  if (!Array.isArray(p.grid) || p.grid.length !== cells) return false;
  const seen = new Array<boolean>(cells + 1).fill(false);
  for (const v of p.grid) {
    if (!Number.isInteger(v) || v < 1 || v > cells) return false;
    if (seen[v]) return false; // duplicate
    seen[v] = true;
  }
  // every number 1..cells present exactly once
  for (let n = 1; n <= cells; n++) if (!seen[n]) return false;
  return true;
}
