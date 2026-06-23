import type { Difficulty } from "@/lib/types";
import { rngFromString, type Rng } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import { BOARDS } from "./boards";
import {
  buildAdjacency,
  regionCells,
  solve,
  MIN_FACE,
  MAX_FACE,
  type Cell,
  type Constraint,
  type Domino,
  type PipsDifficulty,
  type PipsPuzzle,
} from "./engine";

/**
 * Per-tier generation spec. `dominoes` (and therefore cell count = 2×) strictly
 * escalates easy < medium < hard; the region-size band controls how finely the
 * board is carved into constraints (smaller bands → more, tighter regions).
 */
export interface DifficultySpec {
  dominoes: number;
  minRegion: number;
  maxRegion: number;
}

export const DIFFICULTY_SPEC: Record<PipsDifficulty, DifficultySpec> = {
  easy: { dominoes: 3, minRegion: 2, maxRegion: 3 },
  medium: { dominoes: 5, minRegion: 1, maxRegion: 3 },
  hard: { dominoes: 6, minRegion: 1, maxRegion: 3 },
};

/** Find a perfect matching (domino tiling) of the board, randomised via rng. */
function findTiling(rng: Rng, cells: Cell[]): [number, number][] | null {
  const N = cells.length;
  const adj = buildAdjacency(cells);
  const covered = new Array(N).fill(false);
  const pairs: [number, number][] = [];

  function rec(): boolean {
    let a = -1;
    for (let i = 0; i < N; i++) {
      if (!covered[i]) {
        a = i;
        break;
      }
    }
    if (a < 0) return true;
    for (const b of rng.shuffle(adj[a])) {
      if (covered[b]) continue;
      covered[a] = covered[b] = true;
      pairs.push([a, b]);
      if (rec()) return true;
      pairs.pop();
      covered[a] = covered[b] = false;
    }
    return false;
  }

  return rec() ? pairs : null;
}

/**
 * Carve the board into contiguous regions by repeatedly seeding from a random
 * unassigned cell and BFS-growing to a random target size. Every cell ends up
 * in exactly one region; region ids are contiguous 0..K-1.
 */
function partitionRegions(
  rng: Rng,
  cells: Cell[],
  minSize: number,
  maxSize: number,
): number[] {
  const N = cells.length;
  const adj = buildAdjacency(cells);
  const region = new Array(N).fill(-1);
  let rid = 0;

  while (region.some((g) => g < 0)) {
    const unassigned: number[] = [];
    for (let i = 0; i < N; i++) if (region[i] < 0) unassigned.push(i);
    const seed = rng.pick(unassigned);
    const target = rng.int(minSize, maxSize);

    region[seed] = rid;
    let count = 1;
    const frontier: number[] = adj[seed].filter((n) => region[n] < 0);
    while (count < target && frontier.length > 0) {
      const idx = rng.int(0, frontier.length - 1);
      const next = frontier.splice(idx, 1)[0];
      if (region[next] >= 0) continue;
      region[next] = rid;
      count += 1;
      for (const n of adj[next]) {
        if (region[n] < 0 && !frontier.includes(n)) frontier.push(n);
      }
    }
    rid += 1;
  }

  return region;
}

function sum(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0);
}

/**
 * Starting from maximally-constraining `eq(sum)` on every region, relax each
 * region (in random order) to a looser / different constraint kind, keeping the
 * change only while the puzzle stays uniquely solvable. This trades surplus
 * constraint for variety — the board ends up with a believable mix of `=N`,
 * `<N`, `>N`, `=`(all-equal), `≠`(all-different) and blank regions.
 */
function relaxConstraints(rng: Rng, puzzle: PipsPuzzle, value: number[]): void {
  const byRegion = regionCells(puzzle);
  for (const g of rng.shuffle(byRegion.map((_, i) => i))) {
    const vals = byRegion[g].map((cell) => value[cell]);
    const size = vals.length;
    const s = sum(vals);

    const candidates: Constraint[] = [];
    if (size >= 2 && vals.every((v) => v === vals[0])) candidates.push({ kind: "equal" });
    if (size >= 2 && new Set(vals).size === size) candidates.push({ kind: "ne" });
    const ltMax = MAX_FACE * size;
    if (s + 1 <= ltMax) candidates.push({ kind: "lt", value: Math.min(ltMax, s + rng.int(1, 2)) });
    if (s - 1 >= 0) candidates.push({ kind: "gt", value: Math.max(0, s - rng.int(1, 2)) });
    candidates.push({ kind: "empty" });
    if (candidates.length === 0) continue;

    const cand = rng.pick(candidates);
    const prev = puzzle.constraints[g];
    puzzle.constraints[g] = cand;
    if (solve(puzzle, 2).count !== 1) puzzle.constraints[g] = prev; // revert if ambiguous
  }
}

/** Build one uniquely-solvable region-constraint puzzle for a tier. */
export function generatePuzzle(rng: Rng, difficulty: PipsDifficulty): PipsPuzzle {
  const spec = DIFFICULTY_SPEC[difficulty];

  for (let attempt = 0; attempt < 2000; attempt++) {
    const cells = rng.pick(BOARDS[difficulty]);
    const tiling = findTiling(rng, cells);
    if (!tiling) continue;

    const dominoes: Domino[] = tiling.map(() => [
      rng.int(MIN_FACE, MAX_FACE),
      rng.int(MIN_FACE, MAX_FACE),
    ]);
    const solution = tiling.map(([a, b]) => ({ a, b, flip: false }));

    // Canonical value grid implied by the tiling + faces (flip=false).
    const value = new Array(cells.length).fill(0);
    tiling.forEach(([a, b], i) => {
      value[a] = dominoes[i][0];
      value[b] = dominoes[i][1];
    });

    const regionOf = partitionRegions(rng, cells, spec.minRegion, spec.maxRegion);
    const regionCount = Math.max(...regionOf) + 1;
    const byRegion: number[][] = Array.from({ length: regionCount }, () => []);
    regionOf.forEach((g, cell) => byRegion[g].push(cell));

    // Base: pin every region to its exact sum (maximally constraining).
    const constraints: Constraint[] = byRegion.map((members) => ({
      kind: "eq",
      value: sum(members.map((cell) => value[cell])),
    }));

    const puzzle: PipsPuzzle = {
      difficulty,
      cells,
      regionOf,
      constraints,
      dominoes,
      solution,
    };

    // Keep only a uniquely-solvable board; an ambiguous one is never returned.
    if (solve(puzzle, 2).count !== 1) continue;

    relaxConstraints(rng, puzzle, value);
    return puzzle;
  }

  // Unreachable in practice for these small, hand-tileable boards (the all-`eq`
  // base is almost always unique within a handful of attempts). Fail loud rather
  // than ship a null or ambiguous puzzle that would violate the solvability contract.
  throw new Error(`pips: no uniquely-solvable ${difficulty} puzzle after 2000 attempts`);
}

/** Memoised per (date, difficulty) — never key on date alone. */
const cache = new Map<string, PipsPuzzle>();

/**
 * Deterministic daily Pips puzzle for a date and difficulty tier. The tier
 * selects the board-shape pool + region granularity and seeds the procedural
 * generator via {@link difficultySeed} so each (game, date, tier) yields its own
 * independent puzzle. Omitting the difficulty yields the medium board.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): PipsPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = rngFromString(`pips:${difficultySeed("pips", dateISO, difficulty)}`);
  const puzzle = generatePuzzle(rng, difficulty as PipsDifficulty);
  cache.set(key, puzzle);
  return puzzle;
}
