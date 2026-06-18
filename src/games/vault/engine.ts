/**
 * Memory Vault engine — pure, deterministic logic for a spatial working-memory
 * recall game. The player watches a set of cells light up on a grid, then
 * rebuilds the pattern from memory. Each cleared round adds one more cell.
 *
 * No React, no DOM, no globals: fully unit-testable. Patterns are derived from
 * the daily seed so every player sees the same sequence on a given date.
 *
 * Difficulty tiers scale three independent knobs — the grid edge length, the
 * starting pattern size, and the number of rounds — so a harder vault is both
 * physically larger and demands a longer recall chain. The legacy single-tier
 * constants below remain the "medium" defaults so existing callers and tests
 * keep their behaviour.
 */

import type { Rng } from "@/lib/rng";
import type { Difficulty } from "@/lib/types";

/** Default (medium) grid edge length. */
export const GRID = 5;
/** Total cells in the default 5×5 grid. */
export const CELLS = GRID * GRID; // 25
/** Default (medium) pattern size at round 1. */
export const INITIAL_LEVEL = 3;
/** Default (medium) highest round number; clearing it wins the vault. */
export const MAX_ROUNDS = 8;
/** Default (medium) level reached on the final round. */
export const MAX_LEVEL = INITIAL_LEVEL + MAX_ROUNDS - 1; // 10

/** Presentation timing. */
export const SHOW_DURATION_BASE = 900;
export const SHOW_DURATION_PER_LEVEL = 350;
export const LOSS_DELAY = 900;

/**
 * Per-tier vault parameters. Every knob escalates monotonically from easy → hard:
 *   - grid:        edge length of the square board (more cells to scan)
 *   - initialLevel: pattern size at round 1 (longer starting recall chain)
 *   - maxRounds:   number of rounds to clear to win (longer overall run)
 */
export interface VaultParams {
  grid: number;
  initialLevel: number;
  maxRounds: number;
}

export const PARAMS_BY_DIFFICULTY: Record<Difficulty, VaultParams> = {
  easy: { grid: 4, initialLevel: 2, maxRounds: 6 },
  medium: { grid: GRID, initialLevel: INITIAL_LEVEL, maxRounds: MAX_ROUNDS },
  hard: { grid: 6, initialLevel: 4, maxRounds: 10 },
};

/** Resolve the parameters for a difficulty tier (defaults to medium). */
export function paramsFor(difficulty: Difficulty = "medium"): VaultParams {
  return PARAMS_BY_DIFFICULTY[difficulty] ?? PARAMS_BY_DIFFICULTY.medium;
}

/** Number of cells on a grid of the given edge length. */
export function cellsFor(grid: number): number {
  return grid * grid;
}

/** The set of lit cell indices for a single round. */
export type Pattern = number[];

export interface VaultPuzzle {
  /**
   * One pattern per round (index 0 = round 1). Each pattern is a list of unique
   * in-bounds cell indices [0, cells). Pattern length grows with the round.
   */
  rounds: Pattern[];
  /** Grid edge length for this puzzle (4 / 5 / 6 by tier). */
  grid: number;
  /** Pattern size at round 1. */
  initialLevel: number;
  /** Difficulty tier this puzzle was generated for. */
  difficulty: Difficulty;
}

/**
 * Number of cells in the pattern for a given round (1-indexed). `initialLevel`
 * defaults to the medium starting size for backward-compatibility.
 */
export function levelForRound(round: number, initialLevel: number = INITIAL_LEVEL): number {
  return initialLevel + (round - 1);
}

/** Presentation duration (ms) for a level (number of cells). */
export function showDuration(level: number): number {
  return SHOW_DURATION_BASE + level * SHOW_DURATION_PER_LEVEL;
}

/**
 * Build the deterministic pattern for one round. A Fisher-Yates shuffle of all
 * grid cells, taking the first `level` indices, guarantees uniqueness and that
 * every index is in-bounds. `cells` defaults to the medium 25-cell board.
 */
export function patternForRound(rng: Rng, level: number, cells: number = CELLS): Pattern {
  const shuffled = rng.shuffle([...Array(cells).keys()]);
  return shuffled.slice(0, level).sort((a, b) => a - b);
}

/**
 * Generate the full sequence of round patterns for a day at the given tier
 * parameters. Omitting `params` reproduces the legacy medium vault.
 */
export function generateRounds(
  rng: Rng,
  params: VaultParams = PARAMS_BY_DIFFICULTY.medium,
): VaultPuzzle {
  const { grid, initialLevel, maxRounds } = params;
  const cells = cellsFor(grid);
  const rounds: Pattern[] = [];
  for (let round = 1; round <= maxRounds; round++) {
    rounds.push(patternForRound(rng, levelForRound(round, initialLevel), cells));
  }
  // Resolve which tier these params correspond to (for puzzle metadata).
  const difficulty =
    (Object.keys(PARAMS_BY_DIFFICULTY) as Difficulty[]).find(
      (d) =>
        PARAMS_BY_DIFFICULTY[d].grid === grid &&
        PARAMS_BY_DIFFICULTY[d].initialLevel === initialLevel &&
        PARAMS_BY_DIFFICULTY[d].maxRounds === maxRounds,
    ) ?? "medium";
  return { rounds, grid, initialLevel, difficulty };
}

/** Is a single pattern well-formed: non-empty, in-bounds, no duplicates? */
export function isValidPattern(pattern: Pattern, cells: number = CELLS): boolean {
  if (pattern.length === 0) return false;
  const seen = new Set<number>();
  for (const idx of pattern) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= cells) return false;
    if (seen.has(idx)) return false;
    seen.add(idx);
  }
  return true;
}

/**
 * Evaluate a tap against the current pattern given the already-picked set.
 * Returns the outcome so the UI can render feedback. A tap is "correct" when
 * the cell is in the pattern and not yet picked; "wrong" otherwise.
 */
export function evaluateTap(
  pattern: Pattern,
  picked: ReadonlySet<number>,
  cell: number,
): "correct" | "wrong" | "duplicate" {
  if (picked.has(cell)) return "duplicate";
  return pattern.includes(cell) ? "correct" : "wrong";
}

/** True when every cell in the pattern has been picked. */
export function isRoundComplete(pattern: Pattern, picked: ReadonlySet<number>): boolean {
  return pattern.every((c) => picked.has(c));
}

/**
 * Validate a generated puzzle: correct number of rounds, growing level sizes,
 * and every round a valid in-bounds, duplicate-free pattern. Reads the tier
 * parameters from the puzzle itself so any tier validates; falls back to the
 * medium defaults for older puzzle shapes that omitted the metadata.
 */
export function validateVault(p: VaultPuzzle): boolean {
  if (!p || !Array.isArray(p.rounds)) return false;
  const grid = typeof p.grid === "number" ? p.grid : GRID;
  const initialLevel = typeof p.initialLevel === "number" ? p.initialLevel : INITIAL_LEVEL;
  const cells = cellsFor(grid);
  const maxRounds = p.rounds.length;
  if (maxRounds <= 0) return false;
  // The final pattern must fit on the board.
  if (levelForRound(maxRounds, initialLevel) > cells) return false;
  for (let r = 0; r < p.rounds.length; r++) {
    const pattern = p.rounds[r];
    if (!isValidPattern(pattern, cells)) return false;
    if (pattern.length !== levelForRound(r + 1, initialLevel)) return false;
  }
  return true;
}
