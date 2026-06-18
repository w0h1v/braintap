/**
 * Tile Slide engine — pure, deterministic logic for an N×N sliding-tile puzzle
 * (the 15-puzzle family). No React, no DOM, no globals: fully unit-testable.
 *
 * Board representation: a length-(N²) array of numbers. 1..N²-1 are the numbered
 * tiles, 0 is the blank. Index = row * size + col (row 0 = top).
 *
 * The default daily size is 4×4 (a classic fifteen-puzzle). The difficulty tier
 * selects the grid edge length: easy=3×3, medium=4×4, hard=5×5. Every engine
 * helper accepts an optional `size` so legacy callers that omit it keep the 4×4
 * behaviour, while the daily generator passes the active tier's size.
 */

import type { Rng } from "@/lib/rng";

/** Default grid edge length (a classic fifteen-puzzle). */
export const N = 4;
/** Default cell count (N²) for back-compat callers. */
export const CELLS = N * N; // 16
export const BLANK = 0;

/** Supported grid edge lengths (easy=3, medium=4, hard=5). */
export const SIZES = [3, 4, 5] as const;
export type SlideSize = (typeof SIZES)[number];
export const DEFAULT_SIZE: SlideSize = N;

/** True when `n` is one of the supported grid sizes. */
export function isSlideSize(n: unknown): n is SlideSize {
  return typeof n === "number" && (SIZES as readonly number[]).includes(n);
}

/** Cell count (== N²) for a given edge length. */
export function cellsFor(size: number): number {
  return size * size;
}

/** An N×N board: size² entries, values 0..size²-1, 0 = blank. */
export type Board = number[];

export interface SlidePuzzle {
  /** The scrambled starting board (length size², 0 = blank). */
  start: Board;
  /** The goal board: [1,2,...,size²-1,0]. */
  goal: Board;
  /**
   * Grid edge length (3, 4 or 5). Optional for back-compat with legacy puzzle
   * literals that omit it; the size is then inferred from the board length.
   */
  size?: number;
  /** Number of random walk steps used to scramble (informational). */
  scrambleSteps: number;
}

/** Cell index from row/col for the given grid size. */
export const idx = (r: number, c: number, size: number = N): number => r * size + c;

/** The solved board: [1,2,...,size²-1,0]. */
export function solvedBoard(size: number = N): Board {
  const cells = cellsFor(size);
  const b: Board = [];
  for (let i = 1; i < cells; i++) b.push(i);
  b.push(BLANK);
  return b;
}

/** Index of the blank (0) cell. */
export function blankPos(board: Board): number {
  return board.indexOf(BLANK);
}

/**
 * Cell indices orthogonally adjacent to position `p` (up/down/left/right).
 * The grid size defaults to N (4) for legacy callers; pass `size` to operate on
 * other grids. (`size` is inferred from the board length when omitted is not
 * possible here, so callers on non-default grids must supply it.)
 */
export function neighbors(p: number, size: number = N): number[] {
  const r = Math.floor(p / size);
  const c = p % size;
  const out: number[] = [];
  if (r > 0) out.push(p - size);
  if (r < size - 1) out.push(p + size);
  if (c > 0) out.push(p - 1);
  if (c < size - 1) out.push(p + 1);
  return out;
}

/** Edge length inferred from a board's length (sqrt of cell count). */
export function sizeOf(board: Board): number {
  return Math.round(Math.sqrt(board.length));
}

/** True when position `p` is orthogonally adjacent to the blank. */
export function canMove(board: Board, p: number, size: number = sizeOf(board)): boolean {
  if (p < 0 || p >= board.length || board[p] === BLANK) return false;
  return neighbors(blankPos(board), size).includes(p);
}

/**
 * Slide the tile at position `p` into the blank, returning a NEW board.
 * If the move is illegal (not adjacent to blank), returns the board unchanged.
 */
export function applyMove(board: Board, p: number, size: number = sizeOf(board)): Board {
  if (!canMove(board, p, size)) return board;
  const b = board.slice();
  const blank = blankPos(b);
  [b[blank], b[p]] = [b[p], b[blank]];
  return b;
}

/** True when the board equals the solved state [1,2,...,size²-1,0]. */
export function isSolved(board: Board): boolean {
  const cells = board.length;
  for (let i = 0; i < cells - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[cells - 1] === BLANK;
}

/** Count inversions among the numbered tiles (blank excluded). */
export function countInversions(board: Board): number {
  const cells = board.length;
  let inv = 0;
  for (let i = 0; i < cells; i++) {
    if (board[i] === BLANK) continue;
    for (let j = i + 1; j < cells; j++) {
      if (board[j] === BLANK) continue;
      if (board[i] > board[j]) inv++;
    }
  }
  return inv;
}

/**
 * Whether a board is solvable to the goal state, for any grid edge length.
 *
 * - Odd width (e.g. 3, 5): solvable iff the inversion count is even.
 * - Even width (e.g. 4): solvable iff the blank is on an even row from the
 *   bottom (1-indexed) with odd inversions, or an odd row from the bottom with
 *   even inversions.
 */
export function isBoardSolvable(board: Board, size: number = sizeOf(board)): boolean {
  const inversions = countInversions(board);
  if (size % 2 === 1) {
    // Odd width: parity of inversions alone decides solvability.
    return inversions % 2 === 0;
  }
  // Even width: combine inversion parity with the blank's row from the bottom.
  const blankRow = Math.floor(blankPos(board) / size); // 0 = top
  const blankRowFromBottom = size - blankRow; // 1-indexed from bottom
  const blankRowFromBottomEven = blankRowFromBottom % 2 === 0;
  const inversionsOdd = inversions % 2 === 1;
  return blankRowFromBottomEven === inversionsOdd;
}

/**
 * Sum of Manhattan distances of each tile from its goal cell (blank excluded).
 * A lower bound on the number of moves required — handy for heuristics/tests.
 */
export function manhattan(board: Board, size: number = sizeOf(board)): number {
  const cells = board.length;
  let total = 0;
  for (let i = 0; i < cells; i++) {
    const v = board[i];
    if (v === BLANK) continue;
    const goal = v - 1; // tile v belongs at index v-1
    const dr = Math.abs(Math.floor(i / size) - Math.floor(goal / size));
    const dc = Math.abs((i % size) - (goal % size));
    total += dr + dc;
  }
  return total;
}

/**
 * Scramble the solved board with a deterministic random walk of the blank.
 * Each step slides a random neighbour into the blank, avoiding immediately
 * undoing the previous step. A random walk from the solved state always lands
 * in the solvable group, so the result is guaranteed solvable.
 */
export function scramble(rng: Rng, steps = 200, size: number = N): Board {
  let board = solvedBoard(size);
  let prev = -1;
  for (let i = 0; i < steps; i++) {
    const blank = blankPos(board);
    const opts = neighbors(blank, size).filter((x) => x !== prev);
    const pick = opts[rng.int(0, opts.length - 1)];
    [board[blank], board[pick]] = [board[pick], board[blank]];
    prev = blank;
  }
  return board;
}

/**
 * Suggest the next tile to slide that makes progress toward the solved board.
 *
 * Pure and deterministic. Returns the *cell index of a tile* (adjacent to the
 * blank) that should be slid into the blank, or -1 when the board is already
 * solved or no legal move exists.
 *
 * Heuristic: among the tiles currently adjacent to the blank, prefer the move
 * that yields the lowest Manhattan distance after the slide. Ties are broken
 * deterministically by lowest resulting cell index, so the same board always
 * yields the same hint. A guard avoids immediately undoing `avoidPrev` (the
 * blank's previous cell) when an equally-good alternative exists, which keeps
 * the greedy walk from oscillating.
 */
export function nextBestMove(board: Board, avoidPrev = -1, size: number = sizeOf(board)): number {
  if (isSolved(board)) return -1;
  const blank = blankPos(board);
  const opts = neighbors(blank, size); // these are tile cells adjacent to the blank
  if (opts.length === 0) return -1;

  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const p of opts) {
    const after = applyMove(board, p, size);
    // After sliding, the moved tile ends up at the blank's old cell; the blank
    // ends up at p. Penalise undoing the previous move slightly so a tie does
    // not bounce the blank back where it came from.
    const score = manhattan(after, size) * 100 + (p === avoidPrev ? 50 : 0) + p;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** Validate a puzzle: well-formed, solvable, and not already solved. */
export function validateSlide(p: SlidePuzzle): boolean {
  const { start, goal } = p;
  // Determine the size: prefer the declared size, fall back to the board length.
  const size = isSlideSize(p.size) ? p.size : sizeOf(start);
  if (!isSlideSize(size)) return false;
  const cells = cellsFor(size);
  if (start.length !== cells || goal.length !== cells) return false;
  // start must be a permutation of 0..cells-1
  const seen = new Array(cells).fill(false);
  for (const v of start) {
    if (!Number.isInteger(v) || v < 0 || v >= cells || seen[v]) return false;
    seen[v] = true;
  }
  // goal must be the canonical solved board for this size
  const solved = solvedBoard(size);
  for (let i = 0; i < cells; i++) if (goal[i] !== solved[i]) return false;
  // must be solvable and non-trivial
  if (!isBoardSolvable(start, size)) return false;
  if (isSolved(start)) return false;
  return true;
}
