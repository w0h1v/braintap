/**
 * Mini Sudoku engine — pure, deterministic logic for a 6×6 grid composed of
 * 2-row × 3-col boxes, digits 1–6. No React, no globals: fully unit-testable.
 */

import type { Rng } from "@/lib/rng";

export const N = 6;
export const BOX_ROWS = 2; // a box spans 2 rows
export const BOX_COLS = 3; // ...and 3 columns
export const CELLS = N * N;

export type Grid = number[]; // length 36, 0 = empty, 1..6 filled

export interface SudokuPuzzle {
  /** Fully solved grid (36 cells, 1..6). */
  solution: Grid;
  /** Starting grid (36 cells, 0 = empty). */
  puzzle: Grid;
  /** given[i] = true when cell i is a locked clue. */
  given: boolean[];
  /** Number of starting clues. */
  clues: number;
  difficulty: "easy" | "medium" | "hard";
}

export const idx = (r: number, c: number): number => r * N + c;

/** Can digit `n` be placed at (r,c) without violating row/col/box? */
export function okAt(g: Grid, r: number, c: number, n: number): boolean {
  for (let i = 0; i < N; i++) {
    if (g[idx(r, i)] === n) return false;
    if (g[idx(i, c)] === n) return false;
  }
  const br = Math.floor(r / BOX_ROWS) * BOX_ROWS;
  const bc = Math.floor(c / BOX_COLS) * BOX_COLS;
  for (let i = 0; i < BOX_ROWS; i++) {
    for (let j = 0; j < BOX_COLS; j++) {
      if (g[idx(br + i, bc + j)] === n) return false;
    }
  }
  return true;
}

/** Fill the first empty cell with shuffled candidates (randomised solve). */
export function solveFill(g: Grid, rng: Rng): boolean {
  const p = g.indexOf(0);
  if (p < 0) return true;
  const r = Math.floor(p / N);
  const c = p % N;
  for (const n of rng.shuffle([1, 2, 3, 4, 5, 6])) {
    if (okAt(g, r, c, n)) {
      g[p] = n;
      if (solveFill(g, rng)) return true;
      g[p] = 0;
    }
  }
  return false;
}

/** Count solutions up to `limit` (used to verify uniqueness cheaply). */
export function countSolutions(g: Grid, limit = 2): number {
  const p = g.indexOf(0);
  if (p < 0) return 1;
  const r = Math.floor(p / N);
  const c = p % N;
  let count = 0;
  for (let n = 1; n <= 6; n++) {
    if (okAt(g, r, c, n)) {
      g[p] = n;
      count += countSolutions(g, limit);
      g[p] = 0;
      if (count >= limit) break;
    }
  }
  return count;
}

/** Generate a complete, valid solution grid. */
export function generateSolved(rng: Rng): Grid {
  const g: Grid = new Array(CELLS).fill(0);
  solveFill(g, rng);
  return g;
}

function classify(clues: number): SudokuPuzzle["difficulty"] {
  if (clues >= 18) return "easy";
  if (clues >= 14) return "medium";
  return "hard";
}

/**
 * Build a puzzle from a solution by removing clues while keeping a unique
 * solution. Removal is symmetric (180° rotation) for aesthetic balance.
 */
export function makePuzzle(solution: Grid, rng: Rng, targetRemoved = 22): SudokuPuzzle {
  const puzzle = solution.slice();
  const order = rng.shuffle([...Array(CELLS).keys()]);
  let removed = 0;
  for (const p of order) {
    if (removed >= targetRemoved) break;
    const mirror = CELLS - 1 - p;
    const cells = mirror === p ? [p] : [p, mirror];
    if (cells.some((cc) => puzzle[cc] === 0)) continue;
    const backup = cells.map((cc) => puzzle[cc]);
    cells.forEach((cc) => (puzzle[cc] = 0));
    if (countSolutions(puzzle.slice(), 2) === 1) {
      removed += cells.length;
    } else {
      cells.forEach((cc, i) => (puzzle[cc] = backup[i]));
    }
  }
  const given = puzzle.map((v) => v !== 0);
  const clues = given.filter(Boolean).length;
  return { solution, puzzle, given, clues, difficulty: classify(clues) };
}

/** Indices of cells whose current value conflicts with a peer. */
export function findConflicts(grid: Grid): boolean[] {
  const conflicts = new Array<boolean>(CELLS).fill(false);
  const mark = (a: number, b: number) => {
    if (grid[a] !== 0 && grid[a] === grid[b]) {
      conflicts[a] = true;
      conflicts[b] = true;
    }
  };
  for (let r = 0; r < N; r++) {
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        mark(idx(r, i), idx(r, j)); // row
        mark(idx(i, r), idx(j, r)); // col
      }
    }
  }
  for (let br = 0; br < N; br += BOX_ROWS) {
    for (let bc = 0; bc < N; bc += BOX_COLS) {
      const cells: number[] = [];
      for (let i = 0; i < BOX_ROWS; i++)
        for (let j = 0; j < BOX_COLS; j++) cells.push(idx(br + i, bc + j));
      for (let i = 0; i < cells.length; i++)
        for (let j = i + 1; j < cells.length; j++) mark(cells[i], cells[j]);
    }
  }
  return conflicts;
}

/** True when every cell is filled and matches the solution. */
export function isSolved(grid: Grid, solution: Grid): boolean {
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] === 0 || grid[i] !== solution[i]) return false;
  }
  return true;
}

/** Peers (same row, col, or box) of a cell index, excluding itself. */
export function peersOf(cell: number): Set<number> {
  const r = Math.floor(cell / N);
  const c = cell % N;
  const peers = new Set<number>();
  for (let i = 0; i < N; i++) {
    peers.add(idx(r, i));
    peers.add(idx(i, c));
  }
  const br = Math.floor(r / BOX_ROWS) * BOX_ROWS;
  const bc = Math.floor(c / BOX_COLS) * BOX_COLS;
  for (let i = 0; i < BOX_ROWS; i++)
    for (let j = 0; j < BOX_COLS; j++) peers.add(idx(br + i, bc + j));
  peers.delete(cell);
  return peers;
}

/** A revealable hint: which empty cell to fill and its correct value. */
export interface SudokuHint {
  /** Cell index (0..35) to reveal. */
  cell: number;
  /** Correct solution value (1..6). */
  value: number;
  /** True when only one digit was legally possible (naked single). */
  forced: boolean;
}

/**
 * Pick a cell to reveal as a hint. Prefers a logically-forced "naked single"
 * — an empty cell with exactly one legal candidate given the current grid —
 * and falls back to any empty cell. Returns null when nothing is empty.
 *
 * `current` is the working grid (givens + the player's entries); the revealed
 * value always comes from `solution` so a hint can never be wrong even if the
 * player has placed conflicting digits.
 */
export function getHint(current: Grid, solution: Grid): SudokuHint | null {
  let fallback = -1;
  for (let cell = 0; cell < CELLS; cell++) {
    if (current[cell] !== 0) continue;
    if (fallback < 0) fallback = cell;
    const r = Math.floor(cell / N);
    const c = cell % N;
    let candidates = 0;
    for (let n = 1; n <= 6; n++) {
      if (okAt(current, r, c, n)) candidates += 1;
      if (candidates > 1) break;
    }
    if (candidates === 1) {
      return { cell, value: solution[cell], forced: true };
    }
  }
  if (fallback < 0) return null;
  return { cell: fallback, value: solution[fallback], forced: false };
}

/** Validate that a puzzle is well-formed and uniquely solvable. */
export function validateSudoku(p: SudokuPuzzle): boolean {
  if (p.puzzle.length !== CELLS || p.solution.length !== CELLS) return false;
  // givens must match solution
  for (let i = 0; i < CELLS; i++) {
    if (p.given[i] && p.puzzle[i] !== p.solution[i]) return false;
    if (!p.given[i] && p.puzzle[i] !== 0) return false;
  }
  // solution must be a valid full grid
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = p.solution[idx(r, c)];
      if (v < 1 || v > 6) return false;
    }
  }
  if (findConflicts(p.solution).some(Boolean)) return false;
  // exactly one solution
  return countSolutions(p.puzzle.slice(), 2) === 1;
}
