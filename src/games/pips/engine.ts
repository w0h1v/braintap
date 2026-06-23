/**
 * Pips engine — pure, deterministic logic for a region-constraint domino puzzle
 * (the NYT-Pips family). No React, no DOM, no globals: fully unit-testable.
 *
 * Mechanic
 * --------
 * The board is an arbitrary set of grid cells, grouped into coloured **regions**.
 * Each region carries a **constraint** on the pip values that end up inside it:
 *
 *   • `eq N`     — the dots in the region sum to exactly N
 *   • `lt N`     — the dots sum to less than N
 *   • `gt N`     — the dots sum to more than N
 *   • `equal`    — every cell in the region shows the same number
 *   • `ne`       — every cell in the region shows a different number
 *   • `empty`    — no constraint
 *
 * The player is given a tray of dominoes (each [a,b], faces 0..6) and must tile
 * the whole board — every cell covered by exactly one domino half — so that
 * every region's constraint is satisfied.
 *
 * A puzzle is *uniquely solvable* when exactly one distinct value-grid (the pip
 * number on every cell) satisfies all constraints; two tilings that paint the
 * identical grid are the same answer to the player and counted once.
 */

import type { Rng } from "@/lib/rng";

export const MIN_FACE = 0;
export const MAX_FACE = 6;

export type PipsDifficulty = "easy" | "medium" | "hard";

/** A domino tile: two faces, each showing 0..6 pips. */
export type Domino = [number, number];

/** A board cell at grid coordinate (row, col). */
export interface Cell {
  r: number;
  c: number;
}

export type ConstraintKind = "empty" | "eq" | "lt" | "gt" | "equal" | "ne";

/**
 * A region rule. `value` is only meaningful for the numeric kinds (`eq`/`lt`/
 * `gt`); `equal`/`ne`/`empty` ignore it.
 */
export interface Constraint {
  kind: ConstraintKind;
  /** Threshold for eq/lt/gt; unused otherwise. */
  value?: number;
}

/**
 * Where one domino sits in the canonical solution: it covers the two adjacent
 * cells `a` and `b`. `flip` selects which face lands on `a` — unflipped puts
 * `domino[0]` on `a` and `domino[1]` on `b`; flipped swaps them.
 */
export interface SolvedPlacement {
  a: number;
  b: number;
  flip: boolean;
}

export interface PipsPuzzle {
  difficulty: PipsDifficulty;
  /** Board cells in fixed order; a cell's index is its position here. */
  cells: Cell[];
  /** Region id for each cell (parallel to `cells`). */
  regionOf: number[];
  /** One constraint per region (index = region id). */
  constraints: Constraint[];
  /** The tray dominoes the player must place (faces 0..6). */
  dominoes: Domino[];
  /**
   * The canonical solution: for each domino id, which two cells it covers and
   * its flip. Used by hints, the validator and tests; the player never sees it.
   */
  solution: SolvedPlacement[];
}

/** A player placement: per domino id, the cells it covers + flip, or null (tray). */
export type Placed = { a: number; b: number; flip: boolean } | null;
export type Placement = Placed[];

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Stable key for a coordinate. */
function ck(r: number, c: number): string {
  return `${r},${c}`;
}

/**
 * Orthogonal adjacency list: `neighbors[i]` is the list of cell indices sharing
 * an edge with cell `i`. Computed from coordinates alone.
 */
export function buildAdjacency(cells: Cell[]): number[][] {
  const index = new Map<string, number>();
  cells.forEach((cell, i) => index.set(ck(cell.r, cell.c), i));
  return cells.map(({ r, c }) => {
    const out: number[] = [];
    const around: [number, number][] = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ];
    for (const [nr, nc] of around) {
      const j = index.get(ck(nr, nc));
      if (j !== undefined) out.push(j);
    }
    return out;
  });
}

/** Faces shown for a domino given its flip state. */
export function faces(d: Domino, flip: boolean): { a: number; b: number } {
  return flip ? { a: d[1], b: d[0] } : { a: d[0], b: d[1] };
}

/** Cell indices belonging to each region id. */
export function regionCells(puzzle: PipsPuzzle): number[][] {
  const regionCount = puzzle.constraints.length;
  const out: number[][] = Array.from({ length: regionCount }, () => []);
  puzzle.regionOf.forEach((g, cell) => out[g].push(cell));
  return out;
}

// ---------------------------------------------------------------------------
// Constraint evaluation
// ---------------------------------------------------------------------------

/** Whether a fully-known set of region values satisfies a constraint. */
export function evalConstraint(values: number[], c: Constraint): boolean {
  switch (c.kind) {
    case "empty":
      return true;
    case "eq":
      return sum(values) === c.value;
    case "lt":
      return sum(values) < (c.value ?? 0);
    case "gt":
      return sum(values) > (c.value ?? 0);
    case "equal":
      return values.every((v) => v === values[0]);
    case "ne":
      return new Set(values).size === values.length;
  }
}

function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

/** Render a constraint as a short badge label (e.g. "2", "<7", ">5", "=", "≠"). */
export function constraintLabel(c: Constraint): string {
  switch (c.kind) {
    case "empty":
      return "";
    case "eq":
      return String(c.value);
    case "lt":
      return `<${c.value}`;
    case "gt":
      return `>${c.value}`;
    case "equal":
      return "=";
    case "ne":
      return "≠";
  }
}

/** A spoken description used for accessibility labels. */
export function constraintDescription(c: Constraint): string {
  switch (c.kind) {
    case "empty":
      return "no constraint";
    case "eq":
      return `dots sum to ${c.value}`;
    case "lt":
      return `dots sum to less than ${c.value}`;
    case "gt":
      return `dots sum to more than ${c.value}`;
    case "equal":
      return "all dots equal";
    case "ne":
      return "all dots different";
  }
}

// ---------------------------------------------------------------------------
// Player-facing board evaluation
// ---------------------------------------------------------------------------

/**
 * The pip value on each cell for a placement, or null where uncovered. Throws
 * nothing; ignores out-of-range placements defensively.
 */
export function gridValues(puzzle: PipsPuzzle, placement: Placement): (number | null)[] {
  const grid: (number | null)[] = new Array(puzzle.cells.length).fill(null);
  placement.forEach((p, id) => {
    if (!p) return;
    const d = puzzle.dominoes[id];
    if (!d) return;
    const f = faces(d, p.flip);
    grid[p.a] = f.a;
    grid[p.b] = f.b;
  });
  return grid;
}

/** True when every cell is covered and every region constraint is satisfied. */
export function isSolved(puzzle: PipsPuzzle, placement: Placement): boolean {
  const grid = gridValues(puzzle, placement);
  if (grid.some((v) => v == null)) return false;
  const cells = regionCells(puzzle);
  for (let g = 0; g < puzzle.constraints.length; g++) {
    const values = cells[g].map((cell) => grid[cell] as number);
    if (!evalConstraint(values, puzzle.constraints[g])) return false;
  }
  return true;
}

/** Per-region satisfaction snapshot for the UI (covered + currently met). */
export function regionStatus(
  puzzle: PipsPuzzle,
  placement: Placement,
): { covered: boolean; met: boolean }[] {
  const grid = gridValues(puzzle, placement);
  const cells = regionCells(puzzle);
  return puzzle.constraints.map((c, g) => {
    const vals = cells[g].map((cell) => grid[cell]);
    const covered = vals.every((v) => v != null);
    const met = covered && evalConstraint(vals as number[], c);
    return { covered, met };
  });
}

// ---------------------------------------------------------------------------
// Solver — exhaustive, with region pruning, counting DISTINCT value-grids
// ---------------------------------------------------------------------------

export interface SolveReport {
  solvable: boolean;
  unique: boolean;
  /** Number of distinct value-grids found, capped at the supplied limit. */
  count: number;
  /** First solving value-grid (length = cells), or null. */
  grid: number[] | null;
}

/**
 * Exhaustively search domino tilings of the board that satisfy every region
 * constraint, counting *distinct value-grids* up to `limit`.
 *
 * Strategy: always extend from the lowest-index uncovered cell, trying every
 * unplaced domino (deduped by the (faceOnAnchor,faceOnNeighbour) pair so two
 * identical dominoes aren't explored twice from the same spot) in both
 * orientations onto each uncovered neighbour. Each placement updates the two
 * affected regions and is pruned by an admissible feasibility test (treating
 * still-uncovered region cells as free 0..6) — so a real solution is never
 * discarded, and completed regions are checked exactly.
 */
export function solve(puzzle: PipsPuzzle, limit = 2): SolveReport {
  const { cells, dominoes, regionOf, constraints } = puzzle;
  const N = cells.length;
  const adj = buildAdjacency(cells);
  const regionCount = constraints.length;

  // Per-region incremental aggregates.
  const size = new Array(regionCount).fill(0);
  regionOf.forEach((g) => (size[g] += 1));
  const cnt = new Array(regionCount).fill(0);
  const rsum = new Array(regionCount).fill(0);
  const eqRef = new Array(regionCount).fill(-1); // first value seen, or -1
  const eqBroken = new Array(regionCount).fill(false);
  const neMask = new Array(regionCount).fill(0); // bitmask of values present
  const neBroken = new Array(regionCount).fill(false);

  const value = new Array(N).fill(-1);
  const covered = new Array(N).fill(false);
  const used = new Array(dominoes.length).fill(false);
  const found = new Set<string>();

  function feasible(g: number): boolean {
    const c = constraints[g];
    const remaining = size[g] - cnt[g];
    switch (c.kind) {
      case "empty":
        return true;
      case "eq": {
        const v = c.value ?? 0;
        return rsum[g] <= v && rsum[g] + MAX_FACE * remaining >= v;
      }
      case "lt":
        // Min achievable final sum is the current sum (remaining cells can be 0
        // under the admissible relaxation); feasible while still under value.
        return rsum[g] < (c.value ?? 0);
      case "gt":
        return rsum[g] + MAX_FACE * remaining > (c.value ?? 0);
      case "equal":
        return !eqBroken[g];
      case "ne":
        return !neBroken[g];
    }
  }

  interface RegionSnap {
    g: number;
    cnt: number;
    sum: number;
    eqRef: number;
    eqBroken: boolean;
    neMask: number;
    neBroken: boolean;
  }
  function snap(g: number): RegionSnap {
    return {
      g,
      cnt: cnt[g],
      sum: rsum[g],
      eqRef: eqRef[g],
      eqBroken: eqBroken[g],
      neMask: neMask[g],
      neBroken: neBroken[g],
    };
  }
  function restore(s: RegionSnap) {
    cnt[s.g] = s.cnt;
    rsum[s.g] = s.sum;
    eqRef[s.g] = s.eqRef;
    eqBroken[s.g] = s.eqBroken;
    neMask[s.g] = s.neMask;
    neBroken[s.g] = s.neBroken;
  }
  function addToRegion(cell: number, v: number) {
    const g = regionOf[cell];
    cnt[g] += 1;
    rsum[g] += v;
    if (eqRef[g] === -1) eqRef[g] = v;
    else if (v !== eqRef[g]) eqBroken[g] = true;
    const bit = 1 << v;
    if (neMask[g] & bit) neBroken[g] = true;
    neMask[g] |= bit;
  }

  function firstUncovered(): number {
    for (let i = 0; i < N; i++) if (!covered[i]) return i;
    return -1;
  }

  function recurse() {
    if (found.size >= limit) return;
    const a = firstUncovered();
    if (a < 0) {
      found.add(value.join(","));
      return;
    }
    for (const b of adj[a]) {
      if (covered[b]) continue;
      const tried = new Set<string>();
      for (let id = 0; id < dominoes.length; id++) {
        if (used[id]) continue;
        const [x, y] = dominoes[id];
        const orientations: [number, number][] = x === y ? [[x, y]] : [[x, y], [y, x]];
        for (const [fa, fb] of orientations) {
          const key = `${fa},${fb}`;
          if (tried.has(key)) continue; // identical placement via a twin domino
          tried.add(key);

          // Place.
          const ga = regionOf[a];
          const gb = regionOf[b];
          const snaps = ga === gb ? [snap(ga)] : [snap(ga), snap(gb)];
          covered[a] = covered[b] = true;
          value[a] = fa;
          value[b] = fb;
          used[id] = true;
          addToRegion(a, fa);
          addToRegion(b, fb);

          if (feasible(ga) && (ga === gb || feasible(gb))) recurse();

          // Unplace.
          used[id] = false;
          value[a] = value[b] = -1;
          covered[a] = covered[b] = false;
          for (const s of snaps) restore(s);

          if (found.size >= limit) return;
        }
      }
    }
  }

  recurse();
  const arr = [...found];
  return {
    solvable: arr.length > 0,
    unique: arr.length === 1,
    count: arr.length,
    grid: arr.length > 0 ? arr[0].split(",").map(Number) : null,
  };
}

// ---------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------

export interface PipsHint {
  /** Domino id to reveal. */
  id: number;
  a: number;
  b: number;
  flip: boolean;
}

/**
 * Reveal the first (lowest-id) domino whose *painted result* doesn't yet match
 * the canonical solution. A domino counts as correct when it covers the same two
 * cells and shows the solution's value on each — independent of how the
 * placement is encoded (a/b order + flip). This keeps `getHint` consistent with
 * `isSolved`/`gridValues`, which are order-agnostic: a value-identical reversed
 * placement is recognised as solved and never re-hinted. Returns null when every
 * domino already matches.
 */
export function getHint(puzzle: PipsPuzzle, placement: Placement): PipsHint | null {
  for (let id = 0; id < puzzle.solution.length; id++) {
    const sol = puzzle.solution[id];
    const cur = placement[id];
    if (!cur) return { id, a: sol.a, b: sol.b, flip: sol.flip };
    const sf = faces(puzzle.dominoes[id], sol.flip);
    const cf = faces(puzzle.dominoes[id], cur.flip);
    const painted: Record<number, number> = { [cur.a]: cf.a, [cur.b]: cf.b };
    const sameCells =
      (cur.a === sol.a && cur.b === sol.b) || (cur.a === sol.b && cur.b === sol.a);
    const matches = sameCells && painted[sol.a] === sf.a && painted[sol.b] === sf.b;
    if (!matches) return { id, a: sol.a, b: sol.b, flip: sol.flip };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate a puzzle is well-formed and its stored solution is correct + solvable. */
export function validatePips(p: PipsPuzzle): boolean {
  if (!p || !Array.isArray(p.cells) || p.cells.length === 0) return false;
  const N = p.cells.length;
  if (N % 2 !== 0) return false; // dominoes must tile it
  if (p.dominoes.length !== N / 2) return false;
  if (p.solution.length !== N / 2) return false;
  if (p.regionOf.length !== N) return false;

  // Faces in range.
  for (const d of p.dominoes) {
    if (d.length !== 2) return false;
    for (const f of d) {
      if (!Number.isInteger(f) || f < MIN_FACE || f > MAX_FACE) return false;
    }
  }

  // Region ids are contiguous 0..K-1 with one constraint each.
  const regionCount = p.constraints.length;
  if (regionCount < 1) return false;
  for (const g of p.regionOf) {
    if (!Number.isInteger(g) || g < 0 || g >= regionCount) return false;
  }
  const usedRegions = new Set(p.regionOf);
  if (usedRegions.size !== regionCount) return false; // no empty/undefined regions

  // Constraints well-formed.
  for (const c of p.constraints) {
    if (c.kind === "eq" || c.kind === "lt" || c.kind === "gt") {
      if (!Number.isInteger(c.value) || (c.value as number) < 0) return false;
    }
  }

  // Adjacency map for solution validity.
  const adj = buildAdjacency(p.cells);
  const cover = new Array(N).fill(0);
  for (let id = 0; id < p.solution.length; id++) {
    const { a, b } = p.solution[id];
    if (a < 0 || a >= N || b < 0 || b >= N || a === b) return false;
    if (!adj[a].includes(b)) return false; // must be adjacent cells
    cover[a] += 1;
    cover[b] += 1;
  }
  if (cover.some((n) => n !== 1)) return false; // exact tiling

  // Stored solution actually satisfies every constraint.
  const placement: Placement = p.solution.map((s) => ({ a: s.a, b: s.b, flip: s.flip }));
  if (!isSolved(p, placement)) return false;

  // And the puzzle is solvable.
  return solve(p, 1).solvable;
}
