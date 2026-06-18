/**
 * Sum Sprint engine — pure, deterministic logic for a 60-second mental-math
 * sprint. The player taps cells in a 4×4 grid of digits 1–9 whose values sum to
 * the current target; each cleared target refreshes the tapped cells and issues
 * a new target. No React, no globals: fully unit-testable.
 */

import type { Rng } from "@/lib/rng";
import type { Difficulty } from "@/lib/types";

/** Side length of the grid (4×4). */
export const GRID_SIZE = 4;
/** Total cells in the grid. */
export const CELLS = GRID_SIZE * GRID_SIZE;
/** Round length in seconds. */
export const DURATION_SEC = 60;
/** Round length in milliseconds. */
export const DURATION_MS = DURATION_SEC * 1000;
/** Minimum digit value possible in a cell (across all tiers). */
export const MIN_CELL = 1;
/** Maximum digit value possible in a cell (across all tiers). */
export const MAX_CELL = 12;

/**
 * Difficulty knobs for the math sprint. The tier controls the digit range that
 * fills the grid, how many cells a target is composed from, and the clear goal
 * the player must hit to "win" the round (and unlock the next tier).
 *
 * - easy   — small numbers (1–6), always 2-cell targets, modest goal.
 * - medium — mid numbers (1–9), 2–3 cell targets, a stiffer goal.
 * - hard   — larger numbers (2–12), 2–4 cell targets, the highest goal.
 *
 * Escalation invariants (asserted in tests):
 *   maxDigit:  easy < medium < hard
 *   maxCells:  easy ≤ medium < hard
 *   goal:      easy < medium < hard
 */
export interface SprintParams {
  /** Lowest digit a cell can hold for this tier. */
  minDigit: number;
  /** Highest digit a cell can hold for this tier. */
  maxDigit: number;
  /** Smallest number of cells a target is built from. */
  minTargetCells: number;
  /** Largest number of cells a target is built from. */
  maxTargetCells: number;
  /** Targets that must be cleared in the round to count as a win. */
  goal: number;
}

export const PARAMS_BY_DIFFICULTY: Record<Difficulty, SprintParams> = {
  easy: { minDigit: 1, maxDigit: 6, minTargetCells: 2, maxTargetCells: 2, goal: 3 },
  medium: { minDigit: 1, maxDigit: 9, minTargetCells: 2, maxTargetCells: 3, goal: 5 },
  hard: { minDigit: 2, maxDigit: 12, minTargetCells: 2, maxTargetCells: 4, goal: 7 },
};

/** The default tier used when a caller omits difficulty (legacy single puzzle). */
export const DEFAULT_PARAMS = PARAMS_BY_DIFFICULTY.medium;

/** Resolve the params for a difficulty, defaulting to medium. */
export function paramsFor(difficulty: Difficulty = "medium"): SprintParams {
  return PARAMS_BY_DIFFICULTY[difficulty] ?? DEFAULT_PARAMS;
}

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
  /** Initial 16 digits (within the tier's digit range). */
  grid: number[];
  /** Opening target sum (sum of cells in `grid`). */
  firstTarget: number;
  /** Indices in `grid` that compose `firstTarget` (a guaranteed solution). */
  firstTargetCells: number[];
  /** Deterministic replacement digits, consumed in order as cells refresh. */
  refill: number[];
  /** Deterministic salt used to pick targets reproducibly during play. */
  seed: number;
  /** The tier this puzzle was generated for. */
  difficulty: Difficulty;
  /** The resolved tier parameters (digit range, target sizes, goal). */
  params: SprintParams;
}

/** A uniformly random digit in the tier's range (defaults to the legacy 1–9). */
export function randDigit(rng: Rng, params: SprintParams = DEFAULT_PARAMS): number {
  return rng.int(params.minDigit, params.maxDigit);
}

/** Sum a set of cell indices over a grid. */
export function sumOf(grid: readonly number[], indices: Iterable<number>): number {
  let s = 0;
  for (const i of indices) s += grid[i];
  return s;
}

/**
 * Pick a fresh target from the *current* grid: a sum of k distinct cells, where
 * k is drawn from the tier's [minTargetCells, maxTargetCells] range. Returns
 * both the value and the contributing cells, guaranteeing the target is
 * achievable from the board as it stands. Defaults to the legacy 2–3 range.
 */
export function pickTarget(
  grid: readonly number[],
  rng: Rng,
  params: SprintParams = DEFAULT_PARAMS,
): { target: number; cells: number[] } {
  const lo = Math.max(1, Math.min(params.minTargetCells, grid.length));
  const hi = Math.max(lo, Math.min(params.maxTargetCells, grid.length));
  const k = rng.int(lo, hi);
  const order = rng.shuffle([...Array(grid.length).keys()]);
  const cells = order.slice(0, k);
  return { target: sumOf(grid, cells), cells };
}

/**
 * Does any subset of size in [minK, maxK] of `grid` sum exactly to `target`?
 * Used to prove every issued target is solvable. The defaults (2..3) preserve
 * the original O(n³) behaviour; larger maxK uses a bounded recursive search,
 * trivial over 16 cells.
 */
export function hasSubsetSum(
  grid: readonly number[],
  target: number,
  minK = 2,
  maxK = 3,
): boolean {
  const n = grid.length;
  // Depth-limited subset search: pick from index `start`, accumulating `count`
  // chosen cells and `sum` so far. Succeeds when count ∈ [minK,maxK] hits target.
  const search = (start: number, count: number, sum: number): boolean => {
    if (count >= minK && sum === target) return true;
    if (count >= maxK) return false;
    for (let i = start; i < n; i++) {
      if (search(i + 1, count + 1, sum + grid[i])) return true;
    }
    return false;
  };
  return search(0, 0, 0);
}

/** Build the deterministic daily puzzle from a seeded RNG for a tier. */
export function generatePuzzle(
  rng: Rng,
  seed: number,
  difficulty: Difficulty = "medium",
): SprintPuzzle {
  const params = paramsFor(difficulty);
  const grid = Array.from({ length: CELLS }, () => randDigit(rng, params));
  const { target, cells } = pickTarget(grid, rng, params);
  // Pre-roll a generous deterministic refill stream. Each cleared target
  // replaces ≤maxTargetCells cells; 60s of fast play stays well under this many.
  const refill = Array.from({ length: 512 }, () => randDigit(rng, params));
  return {
    grid,
    firstTarget: target,
    firstTargetCells: cells,
    refill,
    seed,
    difficulty,
    params,
  };
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

/**
 * Did the player clear enough targets to win this tier (and unlock the next)?
 * The threshold is the tier's `goal`.
 */
export function isWin(score: number, params: SprintParams = DEFAULT_PARAMS): boolean {
  return score >= params.goal;
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
  // Tolerate older saved/serialized puzzles without a params field by falling
  // back to the default (medium) range, which spans 1–9 within the global bounds.
  const params = p.params ?? DEFAULT_PARAMS;
  if (params.minDigit < MIN_CELL || params.maxDigit > MAX_CELL) return false;
  if (!p.grid.every((v) => Number.isInteger(v) && v >= params.minDigit && v <= params.maxDigit)) {
    return false;
  }
  if (!Array.isArray(p.refill) || p.refill.length === 0) return false;
  if (!p.refill.every((v) => Number.isInteger(v) && v >= params.minDigit && v <= params.maxDigit)) {
    return false;
  }
  // First target must come from real cells and be reachable within tier bounds.
  const minCells = params.minTargetCells;
  const maxCells = params.maxTargetCells;
  if (p.firstTarget < params.minDigit * minCells || p.firstTarget > params.maxDigit * maxCells) {
    return false;
  }
  if (p.firstTargetCells.length < minCells || p.firstTargetCells.length > maxCells) return false;
  if (sumOf(p.grid, p.firstTargetCells) !== p.firstTarget) return false;
  if (!hasSubsetSum(p.grid, p.firstTarget, minCells, maxCells)) return false;
  return true;
}
