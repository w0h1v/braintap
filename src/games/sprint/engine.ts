/**
 * Sum Sprint engine — pure, deterministic logic for a 60-second mental-math
 * sprint. The player taps cells in a 4×4 grid of digits 1–9 whose values sum to
 * the current target; each cleared target refreshes the tapped cells and issues
 * a new target. No React, no globals: fully unit-testable.
 */

import type { Rng } from "@/lib/rng";

/** Side length of the grid (4×4). */
export const GRID_SIZE = 4;
/** Total cells in the grid. */
export const CELLS = GRID_SIZE * GRID_SIZE;
/** Hard round length in seconds. */
export const DURATION_SEC = 60;
/** Round length in milliseconds. */
export const DURATION_MS = DURATION_SEC * 1000;
/** Minimum digit value in a cell. */
export const MIN_CELL = 1;
/** Maximum digit value in a cell. */
export const MAX_CELL = 9;

/**
 * The daily puzzle is a deterministic stream of grid digits plus a stable
 * starting target. Because the live game mutates cells as targets are cleared,
 * we expose a small deterministic API the component drives instead of a single
 * static board:
 *
 * - `grid`        — the initial 16 digits.
 * - `firstTarget` — the opening target sum.
 * - `nextDigit`   — deterministic replacement digits drawn in order.
 *
 * Targets are always derived from currently-visible cells (see `pickTarget`),
 * so every issued target is reachable by tapping the subset it was built from.
 */
export interface SprintPuzzle {
  /** Initial 16 digits (1–9). */
  grid: number[];
  /** Opening target sum (sum of 2–3 cells in `grid`). */
  firstTarget: number;
  /** Indices in `grid` that compose `firstTarget` (a guaranteed solution). */
  firstTargetCells: number[];
  /** Deterministic replacement digits, consumed in order as cells refresh. */
  refill: number[];
  /** Deterministic salt used to pick targets reproducibly during play. */
  seed: number;
}

/** A uniformly random digit in [MIN_CELL, MAX_CELL]. */
export function randDigit(rng: Rng): number {
  return rng.int(MIN_CELL, MAX_CELL);
}

/** Sum a set of cell indices over a grid. */
export function sumOf(grid: readonly number[], indices: Iterable<number>): number {
  let s = 0;
  for (const i of indices) s += grid[i];
  return s;
}

/**
 * Pick a fresh target from the *current* grid: a sum of k ∈ {2,3} distinct
 * cells. Returns both the value and the contributing cells, guaranteeing the
 * target is achievable from the board as it stands.
 */
export function pickTarget(
  grid: readonly number[],
  rng: Rng,
): { target: number; cells: number[] } {
  const k = rng.int(2, 3);
  const order = rng.shuffle([...Array(grid.length).keys()]);
  const cells = order.slice(0, k);
  return { target: sumOf(grid, cells), cells };
}

/**
 * Does any subset of size 2 or 3 of `grid` sum exactly to `target`?
 * Used to prove every issued target is solvable. O(n³) over 16 cells — trivial.
 */
export function hasSubsetSum(grid: readonly number[], target: number): boolean {
  const n = grid.length;
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      if (grid[a] + grid[b] === target) return true;
      for (let c = b + 1; c < n; c++) {
        if (grid[a] + grid[b] + grid[c] === target) return true;
      }
    }
  }
  return false;
}

/** Build the deterministic daily puzzle from a seeded RNG. */
export function generatePuzzle(rng: Rng, seed: number): SprintPuzzle {
  const grid = Array.from({ length: CELLS }, () => randDigit(rng));
  const { target, cells } = pickTarget(grid, rng);
  // Pre-roll a generous deterministic refill stream. Each cleared target
  // replaces ≤3 cells; 60s of fast play tops out well under this many digits.
  const refill = Array.from({ length: 512 }, () => randDigit(rng));
  return { grid, firstTarget: target, firstTargetCells: cells, refill, seed };
}

/**
 * Map a final score (targets cleared) to a normalised 0–100 cross-game score.
 * Calibrated so a "Solid run" (3) is respectable and "Lightning math" (12+)
 * approaches the ceiling.
 */
export function scoreToNormalised(score: number): number {
  if (score <= 0) return 0;
  // 12 cleared targets ≈ 100. Sub-linear above to keep 100 reachable but earned.
  return Math.max(1, Math.min(100, Math.round((score / 12) * 100)));
}

/** Title tier shown on the completion modal. */
export function tierTitle(score: number): string {
  if (score >= 12) return "Lightning math.";
  if (score >= 7) return "Quick thinker.";
  if (score >= 3) return "Solid run.";
  return "Warm-up done.";
}

/** Emoji bar share grid (capped at 12 squares). */
export function shareGrid(score: number): string {
  return "🟩".repeat(Math.max(1, Math.min(12, score)));
}

/** Full share string. */
export function buildShareText(score: number): string {
  return `BrainTap · Sum Sprint\n${score} target${score === 1 ? "" : "s"} in 60s\n\n${shareGrid(score)}\nbraintap.app`;
}

/**
 * Validate a generated puzzle: well-formed grid, valid digits, and a starting
 * target that is genuinely achievable from the grid (the core solvability
 * invariant for this game).
 */
export function validateSprint(p: SprintPuzzle): boolean {
  if (!Array.isArray(p.grid) || p.grid.length !== CELLS) return false;
  if (!p.grid.every((v) => Number.isInteger(v) && v >= MIN_CELL && v <= MAX_CELL)) {
    return false;
  }
  if (!Array.isArray(p.refill) || p.refill.length === 0) return false;
  if (!p.refill.every((v) => Number.isInteger(v) && v >= MIN_CELL && v <= MAX_CELL)) {
    return false;
  }
  // First target must come from real cells and be reachable.
  if (p.firstTarget < MIN_CELL * 2 || p.firstTarget > MAX_CELL * 3) return false;
  if (p.firstTargetCells.length < 2 || p.firstTargetCells.length > 3) return false;
  if (sumOf(p.grid, p.firstTargetCells) !== p.firstTarget) return false;
  if (!hasSubsetSum(p.grid, p.firstTarget)) return false;
  return true;
}
