import type { Difficulty } from "@/lib/types";
import { makeRng } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import {
  N,
  GLYPHS,
  deriveRowClues,
  deriveColClues,
  countSolutions,
  countFilled,
  type ForgeSize,
  type ForgePuzzle,
  type SolutionGrid,
} from "./engine";

/** Per-tier grid + density parameters. */
interface TierParams {
  /** Grid edge length. */
  size: ForgeSize;
  /** Random fill density window for the procedural generator. */
  density: [number, number];
  /** Acceptable filled-cell window (keeps puzzles non-trivial + pleasant). */
  fill: [number, number];
}

/**
 * Difficulty → grid size + density. Escalates by BOTH grid size (4 → 5 → 7) and
 * fill density (sparser easy boards, denser hard boards):
 *   easy   = 4×4, light fill
 *   medium = 5×5, the historical default (curated glyphs + procedural)
 *   hard   = 7×7, denser fill
 */
export const TIER_PARAMS: Record<Difficulty, TierParams> = {
  easy: { size: 4, density: [0.4, 0.55], fill: [4, 11] },
  medium: { size: 5, density: [0.4, 0.6], fill: [6, 19] },
  hard: { size: 7, density: [0.5, 0.66], fill: [18, 38] },
};

const cache = new Map<string, ForgePuzzle>();

/** Build a ForgePuzzle from a binary grid + glyph metadata. */
function buildPuzzle(
  grid: SolutionGrid,
  name: string,
  symbol: string,
): ForgePuzzle {
  return {
    solution: grid.map((row) => row.slice()),
    rowClues: deriveRowClues(grid),
    colClues: deriveColClues(grid),
    size: grid.length,
    glyphName: name,
    glyphSymbol: symbol,
    filled: countFilled(grid),
  };
}

/** Is this grid a good, unique, non-trivial puzzle within the tier window? */
function isGoodGrid(grid: SolutionGrid, fill: [number, number]): boolean {
  const size = grid.length;
  const filled = countFilled(grid);
  if (filled < fill[0] || filled > fill[1]) return false;
  // reject any fully empty / fully full line (keeps clues interesting)
  for (let r = 0; r < size; r++) {
    const sum = grid[r].reduce((a, b) => a + b, 0);
    if (sum === 0 || sum === size) return false;
  }
  for (let c = 0; c < size; c++) {
    let sum = 0;
    for (let r = 0; r < size; r++) sum += grid[r][c];
    if (sum === 0 || sum === size) return false;
  }
  const rowClues = deriveRowClues(grid);
  const colClues = deriveColClues(grid);
  return countSolutions(rowClues, colClues, 2, size) === 1;
}

/** Generate a random binary grid biased toward connected, balanced shapes. */
function randomGrid(rng: Rng, params: TierParams): SolutionGrid {
  const { size, density } = params;
  const d = rng.float(density[0], density[1]);
  const grid: SolutionGrid = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) row.push(rng.chance(d) ? 1 : 0);
    grid.push(row);
  }
  return grid;
}

/** Symmetrise a grid horizontally for a more glyph-like look. */
function mirrorH(grid: SolutionGrid): SolutionGrid {
  const size = grid.length;
  return grid.map((row) => {
    const out = row.slice();
    for (let c = 0; c < size; c++) out[c] = row[Math.min(c, size - 1 - c)];
    return out;
  });
}

/**
 * Deterministic daily puzzle for a date AND difficulty (memoised per both).
 *
 * Strategy: seed an RNG from difficultySeed("forge", date, tier) so each tier
 * gets its own independent puzzle. The MEDIUM (5×5) tier preserves the original
 * behaviour: roughly half the days draw from the curated GLYPH set (verified
 * unique), otherwise it procedurally generates a symmetric grid. The EASY (4×4)
 * and HARD (7×7) tiers are procedurally generated at their tier density until
 * the clues yield a UNIQUE solution.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): ForgePuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const params = TIER_PARAMS[difficulty];
  const rng = makeRng(difficultySeed("forge", dateISO, difficulty));

  let result: ForgePuzzle | null = null;

  // Medium keeps the curated 5×5 glyphs (these only exist at 5×5).
  if (params.size === N && rng.chance(0.5)) {
    const order = rng.shuffle(GLYPHS.map((_, i) => i));
    for (const gi of order) {
      const g = GLYPHS[gi];
      if (isGoodGrid(g.grid, params.fill)) {
        result = buildPuzzle(g.grid, g.name, g.symbol);
        break;
      }
    }
  }

  // Procedural: try symmetric then plain grids until unique.
  if (!result) {
    for (let attempt = 0; attempt < 1200 && !result; attempt++) {
      let grid = randomGrid(rng, params);
      if (rng.chance(0.6)) grid = mirrorH(grid);
      if (isGoodGrid(grid, params.fill)) {
        result = buildPuzzle(grid, "Forge Glyph", "◈");
      }
    }
  }

  // Absolute fallback (should never trigger for medium): the curated diamond is unique.
  if (!result) {
    const g = GLYPHS[0];
    result = buildPuzzle(g.grid, g.name, g.symbol);
  }

  cache.set(key, result);
  return result;
}
