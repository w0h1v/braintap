/**
 * Tile Slide engine — pure, deterministic logic for a 4×4 fifteen-puzzle.
 * No React, no DOM, no globals: fully unit-testable.
 *
 * Board representation: a length-16 array of numbers. 1..15 are the numbered
 * tiles, 0 is the blank. Index = row * N + col (row 0 = top).
 */

import type { Rng } from "@/lib/rng";

export const N = 4;
export const CELLS = N * N; // 16
export const BLANK = 0;

/** A 4×4 board: 16 entries, values 0..15, 0 = blank. */
export type Board = number[];

export interface SlidePuzzle {
  /** The scrambled starting board (length 16, 0 = blank). */
  start: Board;
  /** The goal board: [1,2,...,15,0]. */
  goal: Board;
  /** Number of random walk steps used to scramble (informational). */
  scrambleSteps: number;
}

/** Cell index from row/col. */
export const idx = (r: number, c: number): number => r * N + c;

/** The solved board: [1,2,...,15,0]. */
export function solvedBoard(): Board {
  const b: Board = [];
  for (let i = 1; i < CELLS; i++) b.push(i);
  b.push(BLANK);
  return b;
}

/** Index of the blank (0) cell. */
export function blankPos(board: Board): number {
  return board.indexOf(BLANK);
}

/** Cell indices orthogonally adjacent to position `p` (up/down/left/right). */
export function neighbors(p: number): number[] {
  const r = Math.floor(p / N);
  const c = p % N;
  const out: number[] = [];
  if (r > 0) out.push(p - N);
  if (r < N - 1) out.push(p + N);
  if (c > 0) out.push(p - 1);
  if (c < N - 1) out.push(p + 1);
  return out;
}

/** True when position `p` is orthogonally adjacent to the blank. */
export function canMove(board: Board, p: number): boolean {
  if (p < 0 || p >= CELLS || board[p] === BLANK) return false;
  return neighbors(blankPos(board)).includes(p);
}

/**
 * Slide the tile at position `p` into the blank, returning a NEW board.
 * If the move is illegal (not adjacent to blank), returns the board unchanged.
 */
export function applyMove(board: Board, p: number): Board {
  if (!canMove(board, p)) return board;
  const b = board.slice();
  const blank = blankPos(b);
  [b[blank], b[p]] = [b[p], b[blank]];
  return b;
}

/** True when the board equals the solved state [1,2,...,15,0]. */
export function isSolved(board: Board): boolean {
  for (let i = 0; i < CELLS - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[CELLS - 1] === BLANK;
}

/** Count inversions among the numbered tiles (blank excluded). */
export function countInversions(board: Board): number {
  let inv = 0;
  for (let i = 0; i < CELLS; i++) {
    if (board[i] === BLANK) continue;
    for (let j = i + 1; j < CELLS; j++) {
      if (board[j] === BLANK) continue;
      if (board[i] > board[j]) inv++;
    }
  }
  return inv;
}

/**
 * Whether a 4×4 board is solvable to the goal state.
 *
 * For an even board width (4), a configuration is solvable iff:
 *   - the blank is on an even row counting from the bottom (1-indexed) AND
 *     the inversion count is odd, OR
 *   - the blank is on an odd row from the bottom AND inversions are even.
 */
export function isBoardSolvable(board: Board): boolean {
  const blankRow = Math.floor(blankPos(board) / N); // 0 = top
  const blankRowFromBottom = N - blankRow; // 1-indexed from bottom
  const inversions = countInversions(board);
  const blankRowFromBottomEven = blankRowFromBottom % 2 === 0;
  const inversionsOdd = inversions % 2 === 1;
  return blankRowFromBottomEven === inversionsOdd;
}

/**
 * Sum of Manhattan distances of each tile from its goal cell (blank excluded).
 * A lower bound on the number of moves required — handy for heuristics/tests.
 */
export function manhattan(board: Board): number {
  let total = 0;
  for (let i = 0; i < CELLS; i++) {
    const v = board[i];
    if (v === BLANK) continue;
    const goal = v - 1; // tile v belongs at index v-1
    const dr = Math.abs(Math.floor(i / N) - Math.floor(goal / N));
    const dc = Math.abs((i % N) - (goal % N));
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
export function scramble(rng: Rng, steps = 200): Board {
  let board = solvedBoard();
  let prev = -1;
  for (let i = 0; i < steps; i++) {
    const blank = blankPos(board);
    const opts = neighbors(blank).filter((x) => x !== prev);
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
export function nextBestMove(board: Board, avoidPrev = -1): number {
  if (isSolved(board)) return -1;
  const blank = blankPos(board);
  const opts = neighbors(blank); // these are tile cells adjacent to the blank
  if (opts.length === 0) return -1;

  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const p of opts) {
    const after = applyMove(board, p);
    // After sliding, the moved tile ends up at the blank's old cell; the blank
    // ends up at p. Penalise undoing the previous move slightly so a tie does
    // not bounce the blank back where it came from.
    const score = manhattan(after) * 100 + (p === avoidPrev ? 50 : 0) + p;
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
  if (start.length !== CELLS || goal.length !== CELLS) return false;
  // start must be a permutation of 0..15
  const seen = new Array(CELLS).fill(false);
  for (const v of start) {
    if (!Number.isInteger(v) || v < 0 || v >= CELLS || seen[v]) return false;
    seen[v] = true;
  }
  // goal must be the canonical solved board
  const solved = solvedBoard();
  for (let i = 0; i < CELLS; i++) if (goal[i] !== solved[i]) return false;
  // must be solvable and non-trivial
  if (!isBoardSolvable(start)) return false;
  if (isSolved(start)) return false;
  return true;
}
