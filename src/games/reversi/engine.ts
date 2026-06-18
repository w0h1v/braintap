/**
 * Reversi / Othello engine — pure, deterministic logic for an 8×8 board.
 * No React, no DOM, no globals: fully unit-testable. The AI is deterministic
 * given a seed (positional-weight heuristic with optional aggressiveness).
 */

import type { Rng } from "@/lib/rng";

export const SIZE = 8;
export const CELLS = SIZE * SIZE;

export const EMPTY = 0;
export const YOU = 1;
export const AI = 2;

export type Cell = 0 | 1 | 2;
export type Player = 1 | 2;
export type Board = Cell[]; // length 64, row-major

/** All 8 directions (orthogonal + diagonal). */
export const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/**
 * Positional weight matrix used by the AI heuristic. Corners are most
 * valuable; cells adjacent to corners are penalised. (From the design spec.)
 */
export const WEIGHTS: ReadonlyArray<ReadonlyArray<number>> = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120],
];

export interface ReversiPuzzle {
  /** Which colour the human plays (YOU is always disc 1, but seed may give AI the first move). */
  playerColor: Player;
  /** Who moves first (standard Reversi: dark/AI-equivalent). */
  firstTurn: Player;
  /** AI aggressiveness 0..1 — weights flip-count more heavily when high. */
  aggressiveness: number;
}

export const idx = (r: number, c: number): number => r * SIZE + c;
export const rowOf = (i: number): number => Math.floor(i / SIZE);
export const colOf = (i: number): number => i % SIZE;
export const inBounds = (r: number, c: number): boolean =>
  r >= 0 && r < SIZE && c >= 0 && c < SIZE;

export const opponent = (p: Player): Player => (p === YOU ? AI : YOU);

/**
 * AI difficulty levels. The DAILY seed stays canonical — difficulty only tunes
 * how strongly the AI plays, never the board or who moves first.
 *
 *  - easy:   shallow (greedy) play with extra randomness, corner-weighting muted.
 *  - normal: greedy positional play (the historical default behaviour).
 *  - hard:   minimax look-ahead with full corner-weighting and no randomness.
 */
export type Difficulty = "easy" | "normal" | "hard";

export const DIFFICULTIES: ReadonlyArray<Difficulty> = ["easy", "normal", "hard"];

export const DEFAULT_DIFFICULTY: Difficulty = "normal";

export const isDifficulty = (v: unknown): v is Difficulty =>
  v === "easy" || v === "normal" || v === "hard";

interface StrengthProfile {
  /** Minimax search depth (1 = greedy, no look-ahead). */
  depth: number;
  /** Multiplier applied to positional WEIGHTS (corner emphasis). */
  positionWeight: number;
  /** Amplitude of deterministic seed jitter added to each candidate score. */
  jitter: number;
}

const PROFILES: Record<Difficulty, StrengthProfile> = {
  easy: { depth: 1, positionWeight: 0.35, jitter: 6 },
  normal: { depth: 1, positionWeight: 1, jitter: 0.5 },
  hard: { depth: 3, positionWeight: 1, jitter: 0 },
};

export const profileFor = (d: Difficulty): StrengthProfile => PROFILES[d];

/** The standard Othello starting position. */
export function initialBoard(): Board {
  const b: Board = new Array<Cell>(CELLS).fill(EMPTY);
  b[idx(3, 3)] = YOU;
  b[idx(3, 4)] = AI;
  b[idx(4, 3)] = AI;
  b[idx(4, 4)] = YOU;
  return b;
}

/**
 * Discs that would be flipped if `player` placed a disc at (r,c).
 * Returns [] if the move is illegal (cell occupied or flips nothing).
 */
export function flipsFor(board: Board, r: number, c: number, player: Player): number[] {
  if (!inBounds(r, c) || board[idx(r, c)] !== EMPTY) return [];
  const foe = opponent(player);
  const captured: number[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line: number[] = [];
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc) && board[idx(nr, nc)] === foe) {
      line.push(idx(nr, nc));
      nr += dr;
      nc += dc;
    }
    // Must terminate on one of the player's own discs to capture the line.
    if (line.length > 0 && inBounds(nr, nc) && board[idx(nr, nc)] === player) {
      captured.push(...line);
    }
  }
  return captured;
}

/** Is placing at (r,c) a legal move for `player`? */
export function isLegalMove(board: Board, r: number, c: number, player: Player): boolean {
  return flipsFor(board, r, c, player).length > 0;
}

/** All legal move cell indices for `player`, sorted ascending (deterministic). */
export function legalMoves(board: Board, player: Player): number[] {
  const moves: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (board[i] !== EMPTY) continue;
    if (isLegalMove(board, rowOf(i), colOf(i), player)) moves.push(i);
  }
  return moves;
}

/**
 * Apply a move at (r,c) for `player`, returning a NEW board with all captures
 * flipped. Assumes the move is legal; if it flips nothing the board is returned
 * unchanged (callers should validate with `isLegalMove` first).
 */
export function applyMove(board: Board, r: number, c: number, player: Player): Board {
  const captured = flipsFor(board, r, c, player);
  if (captured.length === 0) return board.slice();
  const next = board.slice();
  next[idx(r, c)] = player;
  for (const cell of captured) next[cell] = player;
  return next;
}

/** Count discs by colour. */
export function score(board: Board): { you: number; ai: number; empty: number } {
  let you = 0;
  let ai = 0;
  let empty = 0;
  for (const v of board) {
    if (v === YOU) you++;
    else if (v === AI) ai++;
    else empty++;
  }
  return { you, ai, empty };
}

/** The game is over when neither player has a legal move. */
export function isGameOver(board: Board): boolean {
  return legalMoves(board, YOU).length === 0 && legalMoves(board, AI).length === 0;
}

/**
 * Static board evaluation from `player`'s perspective: positional weights
 * (scaled by the difficulty profile) plus a flip/aggressiveness term.
 */
function evaluate(
  board: Board,
  player: Player,
  aggressiveness: number,
  positionWeight: number,
): number {
  const foe = opponent(player);
  const flipWeight = 2 + Math.round(aggressiveness * 4); // 2..6
  let mine = 0;
  let theirs = 0;
  let pos = 0;
  for (let i = 0; i < CELLS; i++) {
    const v = board[i];
    if (v === EMPTY) continue;
    const w = WEIGHTS[rowOf(i)][colOf(i)];
    if (v === player) {
      mine++;
      pos += w;
    } else if (v === foe) {
      theirs++;
      pos -= w;
    }
  }
  return pos * positionWeight + (mine - theirs) * flipWeight;
}

/**
 * Negamax search (no pruning needed at these tiny depths) returning the best
 * achievable static score for `player` from `board`, searching `depth` plies.
 * Fully deterministic — used by the "hard" profile for look-ahead.
 */
function negamax(
  board: Board,
  player: Player,
  depth: number,
  aggressiveness: number,
  positionWeight: number,
): number {
  if (depth <= 0 || isGameOver(board)) {
    return evaluate(board, player, aggressiveness, positionWeight);
  }
  const moves = legalMoves(board, player);
  if (moves.length === 0) {
    // Pass: opponent moves, negate their best from our perspective.
    return -negamax(board, opponent(player), depth - 1, aggressiveness, positionWeight);
  }
  let best = -Infinity;
  for (const m of moves) {
    const next = applyMove(board, rowOf(m), colOf(m), player);
    const s = -negamax(next, opponent(player), depth - 1, aggressiveness, positionWeight);
    if (s > best) best = s;
  }
  return best;
}

/**
 * Deterministic AI move selection. Scores every legal move by positional
 * weight plus flip count (weighted by aggressiveness). Ties broken by the
 * lowest cell index for full determinism. The seed (rng) nudges tie-breaks so
 * the daily seed can vary AI behaviour without ever returning an illegal move.
 *
 * `difficulty` (optional, additive — defaults to the historical "normal"
 * greedy behaviour) tunes search depth, corner-weighting, and randomness. It
 * never changes the board or which moves are legal, so the daily seed stays
 * canonical; it only changes how strongly the AI plays.
 *
 * Returns the chosen cell index, or -1 when the AI has no legal move.
 */
export function chooseAiMove(
  board: Board,
  player: Player,
  aggressiveness: number,
  rng: Rng,
  difficulty: Difficulty = DEFAULT_DIFFICULTY,
): number {
  const moves = legalMoves(board, player);
  if (moves.length === 0) return -1;

  const { depth, positionWeight, jitter } = PROFILES[difficulty];
  const flipWeight = 2 + Math.round(aggressiveness * 4); // 2..6
  let best = -1;
  let bestScore = -Infinity;
  for (const m of moves) {
    const r = rowOf(m);
    const c = colOf(m);
    let s: number;
    if (depth > 1) {
      const next = applyMove(board, r, c, player);
      s = -negamax(next, opponent(player), depth - 1, aggressiveness, positionWeight);
    } else {
      const flips = flipsFor(board, r, c, player).length;
      s = WEIGHTS[r][c] * positionWeight + flips * flipWeight;
    }
    // deterministic jitter in [0, jitter) keyed off the seed + cell
    s += rng.next() * jitter;
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

export type Outcome = "won" | "tie" | "lost";

/** Determine the human player's outcome from a finished board. */
export function outcomeFor(board: Board): Outcome {
  const { you, ai } = score(board);
  if (you > ai) return "won";
  if (you < ai) return "lost";
  return "tie";
}

/**
 * Simulate a full game where both sides use the AI heuristic. Used by tests to
 * prove the game always terminates and stays well-formed. Returns the final
 * board and the number of plies played.
 */
export function simulateGame(puzzle: ReversiPuzzle, rng: Rng): { board: Board; plies: number } {
  let board = initialBoard();
  let turn: Player = puzzle.firstTurn;
  let plies = 0;
  // 64 cells max; with passes, bound generously to guarantee termination.
  for (let guard = 0; guard < CELLS * 2 + 4; guard++) {
    if (isGameOver(board)) break;
    const moves = legalMoves(board, turn);
    if (moves.length === 0) {
      turn = opponent(turn);
      continue;
    }
    const m = chooseAiMove(board, turn, puzzle.aggressiveness, rng);
    board = applyMove(board, rowOf(m), colOf(m), turn);
    plies++;
    turn = opponent(turn);
  }
  return { board, plies };
}

/**
 * Validate a puzzle: well-formed config and the opening position is "gameable"
 * (both players have legal first moves) and a full simulated game terminates
 * with a sensible disc total.
 */
export function validateReversi(puzzle: ReversiPuzzle): boolean {
  if (puzzle.playerColor !== YOU && puzzle.playerColor !== AI) return false;
  if (puzzle.firstTurn !== YOU && puzzle.firstTurn !== AI) return false;
  if (puzzle.aggressiveness < 0 || puzzle.aggressiveness > 1) return false;

  const start = initialBoard();
  // Both sides must have an opening move (standard Othello guarantees this).
  if (legalMoves(start, YOU).length === 0) return false;
  if (legalMoves(start, AI).length === 0) return false;

  // A self-played game must terminate and fill a plausible number of cells.
  const rng = makeStubRng();
  const { board, plies } = simulateGame(puzzle, rng);
  if (!isGameOver(board)) return false;
  const { you, ai, empty } = score(board);
  if (you + ai + empty !== CELLS) return false;
  if (you + ai < 4) return false; // at least the opening discs remain
  if (plies < 1) return false;
  return true;
}

/** A minimal deterministic Rng for validation that needs no external seed. */
function makeStubRng(): Rng {
  let a = 0x9e3779b9 >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    float: (min, max) => next() * (max - min) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => arr.slice(),
    chance: (p) => next() < p,
  };
}
