/**
 * Pips engine — pure, deterministic logic for an NYT-Pips-style domino balance
 * puzzle. No React, no DOM, no globals: fully unit-testable.
 *
 * Board: a grid of `rows` × `pairs` slots. Each "pair" owns two adjacent
 * columns; a slot in that pair holds one horizontal domino contributing `left`
 * pips to its left column and `right` pips to its right column. The number of
 * columns is `2 * pairs`, the number of slots/dominoes is `rows * pairs`.
 *
 *   pair p owns columns 2p, 2p+1
 *   slot index = row * pairs + pair
 *
 * The default board is 2 rows × 2 pairs → 4 columns, 4 slots, 4 dominoes; the
 * legacy constants below describe exactly that shape so existing callers and
 * tests keep working unchanged. Difficulty tiers vary `rows`/`pairs` additively
 * (see {@link DIFFICULTY_CONFIG}).
 *
 * The player places all dominoes (flipping freely) so every column's pip total
 * equals its target.
 */

import type { Rng } from "@/lib/rng";

/** Legacy default-board constants (2 rows × 2 pairs). Kept for back-compat. */
export const COLS = 4;
export const SLOTS = 4;
export const DOMINOES = 4;
export const MIN_FACE = 0;
export const MAX_FACE = 6;

export type PipsDifficulty = "easy" | "medium" | "hard";

/**
 * Board shape for a difficulty tier. `pairs` = number of column-pairs (columns
 * = 2*pairs); `rows` = slots stacked per pair (slots = rows*pairs). Escalating
 * board size + constraint count is the difficulty knob:
 *   easy   → 4 columns, 2 dominoes  (single row, lightly constrained)
 *   medium → 4 columns, 4 dominoes  (the historical default board)
 *   hard   → 6 columns, 6 dominoes  (wider board, more constraints)
 */
export interface PipsConfig {
  pairs: number;
  rows: number;
}

export const DIFFICULTY_CONFIG: Record<PipsDifficulty, PipsConfig> = {
  easy: { pairs: 2, rows: 1 },
  medium: { pairs: 2, rows: 2 },
  hard: { pairs: 3, rows: 2 },
};

/** Column count for a config. */
export function colsFor(cfg: PipsConfig): number {
  return cfg.pairs * 2;
}

/** Slot/domino count for a config. */
export function slotsFor(cfg: PipsConfig): number {
  return cfg.rows * cfg.pairs;
}

/** A domino tile: two faces, each showing 0..6 pips. */
export type Domino = [number, number];

export interface PipsPuzzle {
  /** Target pip total for each column (length = 2*pairs). */
  targets: number[];
  /** The dominoes available in the tray, each [a, b] (length = rows*pairs). */
  bank: Domino[];
  /**
   * The canonical solution: for each domino id, the slot it belongs in and
   * whether it is flipped (swapping its two faces). Used by the validator and
   * tests; the player never sees it.
   */
  solution: { slot: number; flip: boolean }[];
  difficulty: PipsDifficulty;
  /** Board shape. Optional for back-compat with legacy 2×2 saves/puzzles. */
  config?: PipsConfig;
}

/** Resolve a puzzle's board shape, defaulting to the legacy 2×2 board. */
export function configOf(p: { config?: PipsConfig }): PipsConfig {
  return p.config ?? { pairs: 2, rows: 2 };
}

/**
 * Pair start column for a slot at the given pair count. Slots feeding pair `p`
 * start at column `2p`. The 1-arg overload assumes the legacy 2-pair board.
 */
export function pairStart(slot: number, pairs = 2): number {
  return (slot % pairs) * 2;
}

/** Faces shown for a domino given its flip state. */
export function halves(d: Domino, flip: boolean): { left: number; right: number } {
  return flip ? { left: d[1], right: d[0] } : { left: d[0], right: d[1] };
}

/**
 * A placement maps each slot index to a tray domino id (or null) plus the flip
 * state of each domino id.
 */
export interface Placement {
  /** slots[slot] = domino id placed there, or null. */
  slots: (number | null)[];
  /** flips[dominoId] = whether that domino is flipped. */
  flips: boolean[];
}

/**
 * Column sums for a placement. The board shape is inferred from `cfg` (defaults
 * to the legacy 2×2 board so old callers keep working).
 */
export function colSums(
  bank: Domino[],
  placement: Placement,
  cfg: PipsConfig = { pairs: 2, rows: 2 },
): number[] {
  const cols = colsFor(cfg);
  const slots = slotsFor(cfg);
  const s = new Array(cols).fill(0);
  for (let slot = 0; slot < slots; slot++) {
    const id = placement.slots[slot];
    if (id == null) continue;
    const { left, right } = halves(bank[id], placement.flips[id]);
    const ps = pairStart(slot, cfg.pairs);
    s[ps] += left;
    s[ps + 1] += right;
  }
  return s;
}

/** True when all slots are filled and every column matches its target. */
export function isSolved(puzzle: PipsPuzzle, placement: Placement): boolean {
  const cfg = configOf(puzzle);
  const slots = slotsFor(cfg);
  for (let slot = 0; slot < slots; slot++) {
    if (placement.slots[slot] == null) return false;
  }
  const s = colSums(puzzle.bank, placement, cfg);
  return s.every((v, i) => v === puzzle.targets[i]);
}

/** All permutations of [0..n-1]. */
function permutations(n: number): number[][] {
  const result: number[][] = [];
  const used = new Array(n).fill(false);
  const cur: number[] = [];
  const recurse = () => {
    if (cur.length === n) {
      result.push(cur.slice());
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(i);
      recurse();
      cur.pop();
      used[i] = false;
    }
  };
  recurse();
  return result;
}

/** Cached permutation tables keyed by element count (board sizes are small). */
const PERM_CACHE = new Map<number, number[][]>();
function permsFor(n: number): number[][] {
  let p = PERM_CACHE.get(n);
  if (!p) {
    p = permutations(n);
    PERM_CACHE.set(n, p);
  }
  return p;
}

export interface SolveReport {
  solvable: boolean;
  unique: boolean;
  /** Number of DISTINCT solutions, counted up to the row symmetry below. */
  solutionCount: number;
  /** First solution found, expressed as a Placement. */
  solution: Placement | null;
}

/**
 * Two placements are the "same" solution when they put the same dominoes (with
 * the same faces) into the same column pairs, regardless of which physical row
 * they occupy — rows within a pair feed identical columns, so shuffling them is
 * not a meaningfully different answer. We canonicalise per pair by the sorted
 * multiset of (leftPips, rightPips) contributions plus the sorted domino ids
 * assigned to that pair.
 */
function canonicalKey(bank: Domino[], placement: Placement, cfg: PipsConfig): string {
  const slots = slotsFor(cfg);
  const ids: number[][] = Array.from({ length: cfg.pairs }, () => []);
  const contrib: string[][] = Array.from({ length: cfg.pairs }, () => []);
  for (let slot = 0; slot < slots; slot++) {
    const id = placement.slots[slot];
    if (id == null) continue;
    const { left, right } = halves(bank[id], placement.flips[id]);
    const pair = slot % cfg.pairs;
    ids[pair].push(id);
    contrib[pair].push(`${left},${right}`);
  }
  const parts: string[] = [];
  for (let pair = 0; pair < cfg.pairs; pair++) {
    ids[pair].sort((a, b) => a - b);
    contrib[pair].sort();
    parts.push(`${ids[pair].join("-")}|${contrib[pair].join("/")}`);
  }
  return parts.join("||");
}

/**
 * Exhaustively count DISTINCT solutions (see {@link canonicalKey}). For N
 * dominoes there are N! orderings × 2^N flip combinations — tiny for the board
 * sizes used (≤ 6! × 2^6 = 46 080), so brute force and dedupe by canonical key.
 *
 * The board shape is inferred from the bank length unless `cfg` is supplied.
 */
export function solve(
  targets: number[],
  bank: Domino[],
  limit = 2,
  cfg: PipsConfig = inferConfig(bank.length, targets.length),
): SolveReport {
  const n = slotsFor(cfg);
  const seen = new Set<string>();
  let first: Placement | null = null;
  for (const ordering of permsFor(n)) {
    // ordering[slot] = domino id placed in `slot`.
    for (let flipBits = 0; flipBits < 1 << n; flipBits++) {
      const slots: (number | null)[] = new Array(n).fill(null);
      const flips = new Array(n).fill(false);
      for (let slot = 0; slot < n; slot++) {
        const id = ordering[slot];
        slots[slot] = id;
        flips[id] = (flipBits & (1 << slot)) !== 0;
      }
      const placement: Placement = { slots, flips };
      const s = colSums(bank, placement, cfg);
      if (s.every((v, i) => v === targets[i])) {
        if (first === null) first = placement;
        seen.add(canonicalKey(bank, placement, cfg));
        if (seen.size >= limit) {
          return {
            solvable: true,
            unique: seen.size === 1,
            solutionCount: seen.size,
            solution: first,
          };
        }
      }
    }
  }
  return {
    solvable: seen.size > 0,
    unique: seen.size === 1,
    solutionCount: seen.size,
    solution: first,
  };
}

/**
 * Best-effort recovery of the board shape from sizes alone. Columns fix `pairs`
 * (cols / 2); the dominoes-per-pair fix `rows`. Falls back to the legacy 2×2.
 */
function inferConfig(bankLen: number, colLen: number): PipsConfig {
  const pairs = Math.max(1, Math.floor(colLen / 2));
  const rows = Math.max(1, Math.round(bankLen / pairs));
  if (pairs * rows === bankLen) return { pairs, rows };
  return { pairs: 2, rows: 2 };
}

/**
 * Generate a puzzle by tiling first (guarantees a solution): draw N dominoes,
 * assign each to a slot with a random flip, derive the column targets from that
 * arrangement, then keep it only if the resulting puzzle has a UNIQUE solution.
 * Retries with fresh draws until unique (bounded), falling back to the last
 * non-unique attempt if needed (still always solvable).
 *
 * `cfg` selects the board shape; it defaults to the legacy 2×2 board so callers
 * that omit it reproduce the original behaviour shape.
 */
export function generatePuzzle(
  rng: Rng,
  cfg: PipsConfig = { pairs: 2, rows: 2 },
): PipsPuzzle {
  const n = slotsFor(cfg);
  let fallback: PipsPuzzle | null = null;

  for (let attempt = 0; attempt < 600; attempt++) {
    // Draw N dominoes (faces 0..6). Duplicates allowed (like a real set draw).
    const bank: Domino[] = [];
    for (let i = 0; i < n; i++) {
      bank.push([rng.int(MIN_FACE, MAX_FACE), rng.int(MIN_FACE, MAX_FACE)]);
    }

    // Assign each domino to a distinct slot, each with a random flip.
    const slotForId = rng.shuffle(Array.from({ length: n }, (_, i) => i)); // slotForId[id] = slot
    const flips = Array.from({ length: n }, () => rng.chance(0.5));

    const slots: (number | null)[] = new Array(n).fill(null);
    for (let id = 0; id < n; id++) slots[slotForId[id]] = id;

    const placement: Placement = { slots, flips };
    const targets = colSums(bank, placement, cfg);

    const solution: PipsPuzzle["solution"] = [];
    for (let id = 0; id < n; id++) {
      solution.push({ slot: slotForId[id], flip: flips[id] });
    }

    const puzzle: PipsPuzzle = {
      targets,
      bank,
      solution,
      difficulty: difficultyFor(cfg),
      config: cfg,
    };

    const report = solve(targets, bank, 2, cfg);
    if (report.unique) return puzzle;
    if (report.solvable && fallback === null) fallback = puzzle;
  }

  // Should essentially never happen; the construction guarantees solvability.
  return fallback as PipsPuzzle;
}

/** The difficulty tier whose board shape matches `cfg` (defaults to medium). */
function difficultyFor(cfg: PipsConfig): PipsDifficulty {
  for (const k of Object.keys(DIFFICULTY_CONFIG) as PipsDifficulty[]) {
    const c = DIFFICULTY_CONFIG[k];
    if (c.pairs === cfg.pairs && c.rows === cfg.rows) return k;
  }
  return "medium";
}

/**
 * A hint reveals one domino from the stored solution: which domino id belongs
 * in which slot, with which flip. Returns the FIRST (lowest id) domino that is
 * not yet correctly placed in `current` (right slot AND right flip). Returns
 * null when every domino already matches the solution (nothing left to reveal).
 *
 * Pure: depends only on the puzzle's stored solution and the current placement.
 */
export interface PipsHint {
  /** Domino id to reveal. */
  id: number;
  /** Slot it belongs in. */
  slot: number;
  /** Whether it should be flipped. */
  flip: boolean;
}

export function getHint(puzzle: PipsPuzzle, current: Placement): PipsHint | null {
  const n = puzzle.solution.length;
  for (let id = 0; id < n; id++) {
    const { slot, flip } = puzzle.solution[id];
    const placedHere = current.slots[slot] === id;
    const flipMatches = (current.flips[id] ?? false) === flip;
    if (!placedHere || !flipMatches) {
      return { id, slot, flip };
    }
  }
  return null;
}

/** Validate that a puzzle is well-formed and its stored solution is correct. */
export function validatePips(p: PipsPuzzle): boolean {
  if (!p) return false;
  const cfg = configOf(p);
  const cols = colsFor(cfg);
  const n = slotsFor(cfg);
  if (p.targets.length !== cols) return false;
  if (p.bank.length !== n) return false;
  if (p.solution.length !== n) return false;

  // Faces in range.
  for (const d of p.bank) {
    if (d.length !== 2) return false;
    for (const f of d) {
      if (!Number.isInteger(f) || f < MIN_FACE || f > MAX_FACE) return false;
    }
  }
  // Targets are non-negative integers within the achievable range. A column can
  // receive at most `rows` faces, each ≤ MAX_FACE.
  for (const t of p.targets) {
    if (!Number.isInteger(t) || t < 0 || t > MAX_FACE * cfg.rows) return false;
  }

  // The stored solution must use every slot exactly once.
  const usedSlots = new Set<number>();
  const slots: (number | null)[] = new Array(n).fill(null);
  const flips = new Array(n).fill(false);
  for (let id = 0; id < n; id++) {
    const { slot, flip } = p.solution[id];
    if (slot < 0 || slot >= n || usedSlots.has(slot)) return false;
    usedSlots.add(slot);
    slots[slot] = id;
    flips[id] = flip;
  }
  // The stored solution must actually satisfy the targets.
  if (!isSolved(p, { slots, flips })) return false;

  // And the puzzle must be solvable (at least one solution exists).
  return solve(p.targets, p.bank, 1, cfg).solvable;
}
