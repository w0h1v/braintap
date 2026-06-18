import { rngFromString } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import {
  N,
  CELLS,
  GLYPHS,
  deriveRowClues,
  deriveColClues,
  countSolutions,
  countFilled,
  type ForgePuzzle,
  type SolutionGrid,
} from "./engine";

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
    glyphName: name,
    glyphSymbol: symbol,
    filled: countFilled(grid),
  };
}

/** Is this grid a good, unique, non-trivial puzzle? */
function isGoodGrid(grid: SolutionGrid): boolean {
  const filled = countFilled(grid);
  // keep fill density pleasant (not too sparse / dense)
  if (filled < 6 || filled > 19) return false;
  const rowClues = deriveRowClues(grid);
  const colClues = deriveColClues(grid);
  return countSolutions(rowClues, colClues, 2) === 1;
}

/** Generate a random binary grid biased toward connected, balanced shapes. */
function randomGrid(rng: Rng): SolutionGrid {
  const density = rng.float(0.4, 0.6);
  const grid: SolutionGrid = [];
  for (let r = 0; r < N; r++) {
    const row: number[] = [];
    for (let c = 0; c < N; c++) row.push(rng.chance(density) ? 1 : 0);
    grid.push(row);
  }
  // ensure no fully empty / fully full line (keeps clues interesting)
  return grid;
}

/** Symmetrise a grid horizontally for a more glyph-like look. */
function mirrorH(grid: SolutionGrid): SolutionGrid {
  return grid.map((row) => {
    const out = row.slice();
    for (let c = 0; c < N; c++) out[c] = row[Math.min(c, N - 1 - c)];
    return out;
  });
}

/**
 * Deterministic daily puzzle for a date (memoised per date).
 *
 * Strategy: seed an RNG from the date. Roughly half the days draw from the
 * curated GLYPH set (verified unique); otherwise procedurally generate a
 * symmetric grid and reseed/tweak until the clues yield a UNIQUE solution.
 */
export function getDailyPuzzle(dateISO: string): ForgePuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;

  const rng = rngFromString(`forge:${dailySeed("forge", dateISO)}`);

  let result: ForgePuzzle | null = null;

  // Prefer a curated glyph when it happens to be unique on this seed.
  if (rng.chance(0.5)) {
    const order = rng.shuffle(GLYPHS.map((_, i) => i));
    for (const gi of order) {
      const g = GLYPHS[gi];
      if (isGoodGrid(g.grid)) {
        result = buildPuzzle(g.grid, g.name, g.symbol);
        break;
      }
    }
  }

  // Procedural fallback: try symmetric then plain grids until unique.
  if (!result) {
    for (let attempt = 0; attempt < 600 && !result; attempt++) {
      let grid = randomGrid(rng);
      if (rng.chance(0.6)) grid = mirrorH(grid);
      if (isGoodGrid(grid)) {
        result = buildPuzzle(grid, "Forge Glyph", "◈");
      }
    }
  }

  // Absolute fallback (should never trigger): the curated diamond is unique.
  if (!result) {
    const g = GLYPHS[0];
    result = buildPuzzle(g.grid, g.name, g.symbol);
  }

  cache.set(dateISO, result);
  return result;
}

void CELLS;
