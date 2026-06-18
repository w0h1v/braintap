/**
 * Memory Vault engine — pure, deterministic logic for a spatial working-memory
 * recall game. The player watches a set of cells light up on a 5×5 grid, then
 * rebuilds the pattern from memory. Each cleared round adds one more cell.
 *
 * No React, no DOM, no globals: fully unit-testable. Patterns are derived from
 * the daily seed so every player sees the same sequence on a given date.
 */

import type { Rng } from "@/lib/rng";

/** Grid dimensions. */
export const GRID = 5;
/** Total cells in the 5×5 grid. */
export const CELLS = GRID * GRID; // 25
/** Pattern size at round 1. */
export const INITIAL_LEVEL = 3;
/** Highest round number; clearing round MAX_ROUNDS wins the vault. */
export const MAX_ROUNDS = 10;
/** Level reached after clearing the final round (INITIAL_LEVEL + MAX_ROUNDS - 1 cleared = 12, win at 13). */
export const MAX_LEVEL = INITIAL_LEVEL + MAX_ROUNDS - 1; // 12 — the final round's level

/** Presentation timing. */
export const SHOW_DURATION_BASE = 900;
export const SHOW_DURATION_PER_LEVEL = 350;
export const LOSS_DELAY = 900;

/** The set of lit cell indices for a single round. */
export type Pattern = number[];

export interface VaultPuzzle {
  /**
   * One pattern per round (index 0 = round 1). Each pattern is a list of unique
   * in-bounds cell indices [0, CELLS). Pattern length grows with the round.
   */
  rounds: Pattern[];
}

/** Number of cells in the pattern for a given round (1-indexed). */
export function levelForRound(round: number): number {
  return INITIAL_LEVEL + (round - 1);
}

/** Presentation duration (ms) for a level (number of cells). */
export function showDuration(level: number): number {
  return SHOW_DURATION_BASE + level * SHOW_DURATION_PER_LEVEL;
}

/**
 * Build the deterministic pattern for one round. A Fisher-Yates shuffle of all
 * 25 cells, taking the first `level` indices, guarantees uniqueness and that
 * every index is in-bounds.
 */
export function patternForRound(rng: Rng, level: number): Pattern {
  const shuffled = rng.shuffle([...Array(CELLS).keys()]);
  return shuffled.slice(0, level).sort((a, b) => a - b);
}

/** Generate the full sequence of round patterns for a day. */
export function generateRounds(rng: Rng): VaultPuzzle {
  const rounds: Pattern[] = [];
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    rounds.push(patternForRound(rng, levelForRound(round)));
  }
  return { rounds };
}

/** Is a single pattern well-formed: non-empty, in-bounds, no duplicates? */
export function isValidPattern(pattern: Pattern): boolean {
  if (pattern.length === 0) return false;
  const seen = new Set<number>();
  for (const idx of pattern) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= CELLS) return false;
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
 * and every round a valid in-bounds, duplicate-free pattern.
 */
export function validateVault(p: VaultPuzzle): boolean {
  if (!p || !Array.isArray(p.rounds)) return false;
  if (p.rounds.length !== MAX_ROUNDS) return false;
  for (let r = 0; r < p.rounds.length; r++) {
    const pattern = p.rounds[r];
    if (!isValidPattern(pattern)) return false;
    if (pattern.length !== levelForRound(r + 1)) return false;
  }
  return true;
}
