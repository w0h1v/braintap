/**
 * Pips engine — pure, deterministic logic for an NYT-Pips-style domino balance
 * puzzle. No React, no DOM, no globals: fully unit-testable.
 *
 * Board: 4 columns (each with a target sum 0..12) and 4 slots laid out in a
 * 2x2 grid. Each slot holds one horizontal domino contributing `left` pips to
 * its left column and `right` pips to its right column.
 *
 *   slot 0 -> columns 0,1     slot 1 -> columns 2,3
 *   slot 2 -> columns 0,1     slot 3 -> columns 2,3
 *
 * The player places all four dominoes (flipping freely) so every column's pip
 * total equals its target.
 */

import type { Rng } from "@/lib/rng";

export const COLS = 4;
export const SLOTS = 4;
export const DOMINOES = 4;
export const MIN_FACE = 0;
export const MAX_FACE = 6;

/** A domino tile: two faces, each showing 0..6 pips. */
export type Domino = [number, number];

export interface PipsPuzzle {
  /** Target pip total for each of the 4 columns. */
  targets: number[];
  /** The 4 dominoes available in the tray, each [a, b]. */
  bank: Domino[];
  /**
   * The canonical solution: for each domino id (0..3), the slot it belongs in
   * and whether it is flipped (swapping its two faces). Used by the validator
   * and tests; the player never sees it.
   */
  solution: { slot: number; flip: boolean }[];
  difficulty: "easy" | "medium" | "hard";
}

/** Pair start column for a slot: slots 0/2 -> col 0, slots 1/3 -> col 2. */
export function pairStart(slot: number): number {
  return (slot % 2) * 2;
}

/** Faces shown for a domino given its flip state. */
export function halves(d: Domino, flip: boolean): { left: number; right: number } {
  return flip ? { left: d[1], right: d[0] } : { left: d[0], right: d[1] };
}

/**
 * A placement maps each slot index (0..3) to a tray domino id (or null) plus
 * the flip state of each domino id.
 */
export interface Placement {
  /** slots[slot] = domino id placed there, or null. */
  slots: (number | null)[];
  /** flips[dominoId] = whether that domino is flipped. */
  flips: boolean[];
}

/** Column sums for a placement against a bank of dominoes. */
export function colSums(bank: Domino[], placement: Placement): number[] {
  const s = [0, 0, 0, 0];
  for (let slot = 0; slot < SLOTS; slot++) {
    const id = placement.slots[slot];
    if (id == null) continue;
    const { left, right } = halves(bank[id], placement.flips[id]);
    const ps = pairStart(slot);
    s[ps] += left;
    s[ps + 1] += right;
  }
  return s;
}

/** True when all 4 slots are filled and every column matches its target. */
export function isSolved(puzzle: PipsPuzzle, placement: Placement): boolean {
  for (let slot = 0; slot < SLOTS; slot++) {
    if (placement.slots[slot] == null) return false;
  }
  const s = colSums(puzzle.bank, placement);
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

const PERMS = permutations(DOMINOES);

export interface SolveReport {
  solvable: boolean;
  unique: boolean;
  /** Number of DISTINCT solutions, counted up to the slot symmetry below. */
  solutionCount: number;
  /** First solution found, expressed as a Placement. */
  solution: Placement | null;
}

/**
 * Two placements are the "same" solution when they put the same dominoes (with
 * the same faces) into the same column pairs, regardless of which physical row
 * they occupy. That's because slots 0 and 2 both feed columns 0/1, and slots 1
 * and 3 both feed columns 2/3 — swapping the two dominoes between those rows is
 * not a meaningfully different answer. We canonicalise by, per pair, taking the
 * sorted multiset of (leftPips, rightPips) contributions plus the sorted domino
 * ids assigned to that pair.
 */
function canonicalKey(bank: Domino[], placement: Placement): string {
  const leftIds: number[] = [];
  const rightIds: number[] = [];
  const leftContrib: string[] = [];
  const rightContrib: string[] = [];
  for (let slot = 0; slot < SLOTS; slot++) {
    const id = placement.slots[slot];
    if (id == null) continue;
    const { left, right } = halves(bank[id], placement.flips[id]);
    if (pairStart(slot) === 0) {
      leftIds.push(id);
      leftContrib.push(`${left},${right}`);
    } else {
      rightIds.push(id);
      rightContrib.push(`${left},${right}`);
    }
  }
  leftIds.sort((a, b) => a - b);
  rightIds.sort((a, b) => a - b);
  leftContrib.sort();
  rightContrib.sort();
  return `${leftIds.join("-")}|${leftContrib.join("/")}||${rightIds.join("-")}|${rightContrib.join("/")}`;
}

/**
 * Exhaustively count DISTINCT solutions (see {@link canonicalKey}). There are
 * 4! orderings times 2^4 flip combinations = 384 raw configs — tiny, so brute
 * force and dedupe by canonical key.
 */
export function solve(targets: number[], bank: Domino[], limit = 2): SolveReport {
  const seen = new Set<string>();
  let first: Placement | null = null;
  for (const ordering of PERMS) {
    // ordering[slot] = domino id placed in `slot`.
    for (let flipBits = 0; flipBits < 1 << DOMINOES; flipBits++) {
      const slots: (number | null)[] = [null, null, null, null];
      const flips = [false, false, false, false];
      for (let slot = 0; slot < DOMINOES; slot++) {
        const id = ordering[slot];
        slots[slot] = id;
        flips[id] = (flipBits & (1 << slot)) !== 0;
      }
      const placement: Placement = { slots, flips };
      const s = colSums(bank, placement);
      if (s.every((v, i) => v === targets[i])) {
        if (first === null) first = placement;
        seen.add(canonicalKey(bank, placement));
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

function classify(targets: number[]): PipsPuzzle["difficulty"] {
  const total = targets.reduce((a, b) => a + b, 0);
  // Average per column. Extreme low/high totals tend to be more forced (easy),
  // mid-range balanced totals leave more ambiguity (harder).
  const avg = total / COLS;
  if (avg <= 3 || avg >= 9) return "easy";
  if (avg <= 4.5 || avg >= 7.5) return "medium";
  return "hard";
}

/**
 * Generate a puzzle by tiling first (guarantees a solution): draw 4 random
 * dominoes, assign each to a slot with a random flip, derive the column targets
 * from that arrangement, then keep it only if the resulting puzzle has a UNIQUE
 * solution. Retries with fresh draws until unique (bounded), falling back to the
 * last non-unique attempt if needed (still always solvable).
 */
export function generatePuzzle(rng: Rng): PipsPuzzle {
  let fallback: PipsPuzzle | null = null;

  for (let attempt = 0; attempt < 400; attempt++) {
    // Draw 4 dominoes (faces 0..6). Duplicates allowed (like a real set draw).
    const bank: Domino[] = [];
    for (let i = 0; i < DOMINOES; i++) {
      bank.push([rng.int(MIN_FACE, MAX_FACE), rng.int(MIN_FACE, MAX_FACE)]);
    }

    // Assign each domino to a distinct slot, each with a random flip.
    const slotForId = rng.shuffle([0, 1, 2, 3]); // slotForId[id] = slot
    const flips = [rng.chance(0.5), rng.chance(0.5), rng.chance(0.5), rng.chance(0.5)];

    const slots: (number | null)[] = [null, null, null, null];
    for (let id = 0; id < DOMINOES; id++) slots[slotForId[id]] = id;

    const placement: Placement = { slots, flips };
    const targets = colSums(bank, placement);

    const solution: PipsPuzzle["solution"] = [];
    for (let id = 0; id < DOMINOES; id++) {
      solution.push({ slot: slotForId[id], flip: flips[id] });
    }

    const puzzle: PipsPuzzle = {
      targets,
      bank,
      solution,
      difficulty: classify(targets),
    };

    const report = solve(targets, bank, 2);
    if (report.unique) return puzzle;
    if (report.solvable && fallback === null) fallback = puzzle;
  }

  // Should essentially never happen; the construction guarantees solvability.
  return fallback as PipsPuzzle;
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
  for (let id = 0; id < DOMINOES; id++) {
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
  if (p.targets.length !== COLS) return false;
  if (p.bank.length !== DOMINOES) return false;
  if (p.solution.length !== DOMINOES) return false;

  // Faces in range.
  for (const d of p.bank) {
    if (d.length !== 2) return false;
    for (const f of d) {
      if (!Number.isInteger(f) || f < MIN_FACE || f > MAX_FACE) return false;
    }
  }
  // Targets are non-negative integers within the achievable range.
  for (const t of p.targets) {
    if (!Number.isInteger(t) || t < 0 || t > MAX_FACE * 2) return false;
  }

  // The stored solution must use every slot exactly once.
  const usedSlots = new Set<number>();
  const slots: (number | null)[] = [null, null, null, null];
  const flips = [false, false, false, false];
  for (let id = 0; id < DOMINOES; id++) {
    const { slot, flip } = p.solution[id];
    if (slot < 0 || slot >= SLOTS || usedSlots.has(slot)) return false;
    usedSlots.add(slot);
    slots[slot] = id;
    flips[id] = flip;
  }
  // The stored solution must actually satisfy the targets.
  if (!isSolved(p, { slots, flips })) return false;

  // And the puzzle must be solvable (at least one solution exists).
  return solve(p.targets, p.bank, 1).solvable;
}
