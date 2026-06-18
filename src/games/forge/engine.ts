/**
 * Focus Forge engine — pure, deterministic logic for an N×N nonogram (picross).
 * No React, no DOM, no globals: fully unit-testable.
 *
 * Cell states in the *player* grid:
 *   0 = empty/unknown
 *   1 = filled
 *   2 = marked-empty (player's "✕", treated as 0 for solving)
 *
 * The solution grid is binary (0 | 1). Clues are contiguous runs of filled
 * cells per row / column; an empty line is represented by `[0]`.
 *
 * The grid edge length is variable: the default daily picross is 5×5, but
 * difficulty tiers serve 4×4 (easy), 5×5 (medium) and 7×7 (hard) grids. Every
 * size-aware helper takes an optional `size` argument that DEFAULTS to the
 * legacy 5, so existing callers keep their behaviour unchanged. Each puzzle also
 * carries its own `size` so the component and validator never need to guess.
 */

import type { Rng } from "@/lib/rng";

/** Default grid side length (the historical 5×5 daily picross). */
export const N = 5;
export const CELLS = N * N;

/** Supported grid edge lengths across the difficulty tiers. */
export const SIZES = [4, 5, 7] as const;
export type ForgeSize = (typeof SIZES)[number];
export const DEFAULT_SIZE: ForgeSize = N;

/** True when `n` is one of the supported grid sizes. */
export function isForgeSize(n: unknown): n is ForgeSize {
  return typeof n === "number" && (SIZES as readonly number[]).includes(n);
}

/** Number of cells for a given edge length. */
export const cellsFor = (size: number): number => size * size;

export type Cell = 0 | 1 | 2;
/** Flattened player grid, length size*size. */
export type State = Cell[];
/** A solution row/grid of 0|1. */
export type SolutionGrid = number[][];
export type Clue = number[];

export interface ForgePuzzle {
  /** size×size binary solution grid. */
  solution: SolutionGrid;
  /** One clue array per row (top → bottom). */
  rowClues: Clue[];
  /** One clue array per column (left → right). */
  colClues: Clue[];
  /** Grid edge length (4, 5 or 7). */
  size: number;
  /** Name of the hidden glyph revealed on solve. */
  glyphName: string;
  /** Single character/emoji shown in the completion modal. */
  glyphSymbol: string;
  /** Number of filled cells (informational). */
  filled: number;
}

/** Flattened index for (r, c) within a grid of edge length `size` (default 5). */
export const cellIndex = (r: number, c: number, size: number = N): number =>
  r * size + c;

/** Contiguous runs of 1s in a line; `[0]` when the line is empty. */
export function lineClue(line: number[]): Clue {
  const out: number[] = [];
  let run = 0;
  for (const v of line) {
    if (v) {
      run++;
    } else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out.length ? out : [0];
}

export function rowOf(grid: SolutionGrid, r: number): number[] {
  return grid[r].slice();
}

export function colOf(grid: SolutionGrid, c: number): number[] {
  return grid.map((row) => row[c]);
}

/** Derive row clues for a solution grid. */
export function deriveRowClues(grid: SolutionGrid): Clue[] {
  return grid.map((row) => lineClue(row));
}

/** Derive column clues for a solution grid. */
export function deriveColClues(grid: SolutionGrid): Clue[] {
  const size = grid.length;
  const out: Clue[] = [];
  for (let c = 0; c < size; c++) out.push(lineClue(colOf(grid, c)));
  return out;
}

function cluesEqual(a: Clue, b: Clue): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Enumerate every placement of a single line of length `len` that satisfies
 * `clue`. Each placement is a 0|1 array. `[0]` means the all-empty line.
 */
export function linePlacements(clue: Clue, len: number): number[][] {
  const runs = clue.length === 1 && clue[0] === 0 ? [] : clue;
  const results: number[][] = [];
  const total = runs.reduce((a, b) => a + b, 0);
  const gaps = runs.length; // minimum separators (each run needs ≥1 before, except first 0)
  // slack = free spaces to distribute
  const minLen = total + (runs.length > 0 ? runs.length - 1 : 0);
  if (minLen > len) return results;

  const line = new Array(len).fill(0);

  const place = (runIdx: number, pos: number) => {
    if (runIdx === runs.length) {
      results.push(line.slice());
      return;
    }
    const runLen = runs[runIdx];
    // remaining minimum length needed after this run
    let remainAfter = 0;
    for (let k = runIdx; k < runs.length; k++) remainAfter += runs[k];
    remainAfter += runs.length - 1 - runIdx; // separators between remaining runs
    const maxStart = len - remainAfter;
    for (let start = pos; start <= maxStart; start++) {
      for (let i = start; i < start + runLen; i++) line[i] = 1;
      place(runIdx + 1, start + runLen + 1);
      for (let i = start; i < start + runLen; i++) line[i] = 0;
    }
  };

  void gaps;
  place(0, 0);
  return results;
}

/**
 * Count solutions (up to `limit`) of a nonogram given its row/col clues,
 * via row-by-row backtracking with column-prefix pruning. `size` defaults to
 * the legacy 5×5 grid; pass the puzzle's size for other tiers.
 */
export function countSolutions(
  rowClues: Clue[],
  colClues: Clue[],
  limit = 2,
  size: number = N,
): number {
  const rowOptions = rowClues.map((clue) => linePlacements(clue, size));
  if (rowOptions.some((opts) => opts.length === 0)) return 0;

  const grid: number[][] = [];
  let count = 0;

  // For pruning: max column total and per-column ability to still match clue.
  const colTotals = colClues.map((clue) =>
    clue.length === 1 && clue[0] === 0 ? 0 : clue.reduce((a, b) => a + b, 0),
  );

  const colPrefixOk = (placedRows: number): boolean => {
    for (let c = 0; c < size; c++) {
      let sum = 0;
      for (let r = 0; r < placedRows; r++) sum += grid[r][c];
      if (sum > colTotals[c]) return false;
      // remaining rows can supply at most (size - placedRows) more
      if (sum + (size - placedRows) < colTotals[c]) return false;
    }
    return true;
  };

  const colFinalOk = (): boolean => {
    for (let c = 0; c < size; c++) {
      const actual = lineClue(grid.map((row) => row[c]));
      if (!cluesEqual(actual, colClues[c])) return false;
    }
    return true;
  };

  const backtrack = (r: number): void => {
    if (count >= limit) return;
    if (r === size) {
      if (colFinalOk()) count++;
      return;
    }
    for (const opt of rowOptions[r]) {
      grid[r] = opt;
      if (colPrefixOk(r + 1)) backtrack(r + 1);
      if (count >= limit) return;
    }
    grid.length = r;
  };

  backtrack(0);
  return count;
}

/** Grid edge length of a player state given the puzzle's grid size. */
function stateSize(solution: SolutionGrid): number {
  return solution.length;
}

/** True when the player state exactly matches the solution. */
export function isSolved(state: State, solution: SolutionGrid): boolean {
  const size = stateSize(solution);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const want = solution[r][c];
      const got = state[cellIndex(r, c, size)] === 1 ? 1 : 0;
      if (want !== got) return false;
    }
  }
  return true;
}

/** Number of filled cells in a binary grid. */
export function countFilled(grid: SolutionGrid): number {
  return grid.reduce((a, row) => a + row.reduce((b, v) => b + v, 0), 0);
}

/** A single hint: the cell to reveal and the correct state it should hold. */
export interface ForgeHint {
  /** Flattened cell index (0..size²-1). */
  index: number;
  /** Grid row. */
  r: number;
  /** Grid column. */
  c: number;
  /** Correct player-cell state: 1 (filled) when the solution fills it, else 2 (marked-empty). */
  value: 1 | 2;
}

/**
 * Pick ONE still-incorrect cell to reveal as a hint, scanning the grid in a
 * deterministic order (top-left → bottom-right). A cell is "wrong" when its
 * current player state does not match the solution:
 *   - solution fills it (1) but the player hasn't filled it → reveal as filled (1)
 *   - solution leaves it empty (0) but the player hasn't marked it (2) → reveal as marked-empty (2)
 * Returns `null` when every cell already matches the solution.
 *
 * Pure + deterministic: no globals, no randomness.
 */
export function getHint(
  solution: SolutionGrid,
  state: State,
): ForgeHint | null {
  const size = stateSize(solution);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = cellIndex(r, c, size);
      const cur = state[i];
      if (solution[r][c] === 1) {
        if (cur !== 1) return { index: i, r, c, value: 1 };
      } else {
        // empty in solution: "correct" means marked-empty (2)
        if (cur !== 2) return { index: i, r, c, value: 2 };
      }
    }
  }
  return null;
}

/**
 * Validate a puzzle: clues are consistent with the solution AND the clues yield
 * exactly one solution (unique). Also rejects trivial all-empty / all-full.
 * Works for any supported grid size; falls back to the puzzle's own `size`
 * (defaulting to 5 for older puzzles that lack the field).
 */
export function validateForge(p: ForgePuzzle): boolean {
  const size = isForgeSize(p.size) ? p.size : N;
  if (!p.solution || p.solution.length !== size) return false;
  for (const row of p.solution) {
    if (row.length !== size) return false;
    for (const v of row) if (v !== 0 && v !== 1) return false;
  }
  if (p.rowClues.length !== size || p.colClues.length !== size) return false;

  // clues match solution
  const dr = deriveRowClues(p.solution);
  const dc = deriveColClues(p.solution);
  for (let i = 0; i < size; i++) {
    if (!cluesEqual(dr[i], p.rowClues[i])) return false;
    if (!cluesEqual(dc[i], p.colClues[i])) return false;
  }

  // not trivial
  const filled = countFilled(p.solution);
  if (filled === 0 || filled === cellsFor(size)) return false;

  // unique
  return countSolutions(p.rowClues, p.colClues, 2, size) === 1;
}

/**
 * Curated set of pleasing 5×5 glyph solutions. Each is binary; many double as
 * recognisable shapes. The generator seeds from these and verifies uniqueness,
 * falling back to procedural generation when a curated glyph is ambiguous.
 *
 * These are 5×5 glyphs used by the medium tier (and legacy single daily). The
 * easy (4×4) and hard (7×7) tiers are generated procedurally.
 */
export const GLYPHS: { name: string; symbol: string; grid: SolutionGrid }[] = [
  {
    name: "Diamond",
    symbol: "◆",
    grid: [
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
  },
  {
    name: "Heart",
    symbol: "♥",
    grid: [
      [0, 1, 0, 1, 0],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
  },
  {
    name: "Arrow",
    symbol: "➤",
    grid: [
      [0, 0, 1, 0, 0],
      [0, 0, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 0, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ],
  },
  {
    name: "Anchor",
    symbol: "⚓",
    grid: [
      [0, 0, 1, 0, 0],
      [0, 1, 0, 1, 0],
      [0, 0, 1, 0, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 1, 1, 0],
    ],
  },
  {
    name: "Spark",
    symbol: "✦",
    grid: [
      [0, 0, 1, 0, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 1, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 0, 1, 0, 0],
    ],
  },
  {
    name: "Crown",
    symbol: "♛",
    grid: [
      [1, 0, 1, 0, 1],
      [1, 0, 1, 0, 1],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1],
    ],
  },
  {
    name: "Key",
    symbol: "⚷",
    grid: [
      [0, 1, 1, 0, 0],
      [0, 1, 1, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 1, 1, 0],
      [0, 0, 1, 1, 0],
    ],
  },
  {
    name: "Bolt",
    symbol: "⚡",
    grid: [
      [0, 0, 1, 1, 0],
      [0, 1, 1, 0, 0],
      [1, 1, 1, 1, 0],
      [0, 0, 1, 1, 0],
      [0, 1, 1, 0, 0],
    ],
  },
];
