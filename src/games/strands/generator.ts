import { rngFromString } from "@/lib/rng";
import { bankIndex } from "@/lib/daily";
import { difficultySeed } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";
import type { Rng } from "@/lib/rng";
import { BANK } from "./bank";
import {
  CELLS,
  packGrid,
  MAX_HINTS_BY_DIFFICULTY,
  type StrandsPuzzle,
  type ThemeEntry,
  type Placement,
} from "./engine";

const cache = new Map<string, StrandsPuzzle>();

/**
 * Choose a subset of `pool` (4–6 words) whose lengths sum to exactly `target`.
 * Deterministic given `rng`. Returns the chosen words, or null if no subset of
 * a reasonable size hits the target.
 */
function chooseWords(pool: string[], target: number, rng: Rng): string[] | null {
  // De-dupe and keep only sanely-sized words.
  const words = Array.from(new Set(pool.map((w) => w.toUpperCase()))).filter(
    (w) => w.length >= 3 && w.length <= 9,
  );

  // We want between 4 and 9 theme words for a good puzzle. Longer words pack
  // more easily, so we bias the subset search toward fewer, longer words first.
  const MIN = 4;
  const MAX = 9;

  // Try several shuffles, each time doing a length-targeted subset search.
  for (let attempt = 0; attempt < 24; attempt++) {
    const order = rng.shuffle(words);
    const found = subsetSum(order, target, MIN, MAX);
    if (found) return found;
  }
  // Fallback: exhaustive (deterministic order) — guarantees a hit if one exists.
  return subsetSum(words, target, MIN, MAX);
}

/**
 * Find an ordered subset of `words` of size in [minCount,maxCount] whose lengths
 * sum to exactly `target`. Backtracking over the given word order.
 */
function subsetSum(
  words: string[],
  target: number,
  minCount: number,
  maxCount: number,
): string[] | null {
  const chosen: string[] = [];

  function dfs(start: number, remaining: number): boolean {
    if (remaining === 0 && chosen.length >= minCount && chosen.length <= maxCount) {
      return true;
    }
    if (chosen.length >= maxCount) return false;
    if (remaining < 0) return false;
    for (let i = start; i < words.length; i++) {
      const w = words[i];
      if (w.length > remaining) continue;
      chosen.push(w);
      if (dfs(i + 1, remaining - w.length)) return true;
      chosen.pop();
    }
    return false;
  }

  return dfs(0, target) ? chosen.slice() : null;
}

/**
 * Build a packed puzzle for a single theme entry deterministically. `maxHints`
 * (default 1) sets the tier's hint generosity on the resulting puzzle.
 */
export function buildPuzzle(
  entry: ThemeEntry,
  rng: Rng,
  maxHints = 1,
): StrandsPuzzle | null {
  const spangram = entry.spangram.toUpperCase();
  const target = CELLS - spangram.length;
  const words = chooseWords(entry.words, target, rng);
  if (!words) return null;

  const placements = packGrid(words, spangram, rng);
  if (!placements) return null;

  const grid: string[][] = Array.from({ length: 8 }, () =>
    new Array<string>(6).fill(""),
  );
  const map: Record<string, Placement> = {};
  for (const w of [spangram, ...words]) {
    const pl = placements[w];
    pl.path.forEach(([r, c], i) => (grid[r][c] = w[i]));
    map[w] = pl;
  }

  return {
    theme: entry.name,
    words,
    spangram,
    insight: entry.insight,
    grid,
    placements: map,
    maxHints,
  };
}

/**
 * Deterministic daily puzzle for a date AND difficulty tier (memoised per
 * date+tier). The tier selects:
 *  - a DIFFERENT board, via a tier-scoped bank index ("strands#<tier>"), so each
 *    tier shows its own theme on a given day; and
 *  - hint generosity (maxHints): easy=3, medium=1, hard=0.
 * Omitting the difficulty yields the medium puzzle.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): StrandsPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rng = rngFromString(`strands:${difficultySeed("strands", dateISO, difficulty)}`);
  const maxHints = MAX_HINTS_BY_DIFFICULTY[difficulty];

  // Walk the bank from the tier-scoped daily index so each tier surfaces a
  // different board; if a particular theme fails to pack on this seed, advance
  // to the next theme so every (date, tier) yields a puzzle.
  const start = bankIndex(`strands#${difficulty}`, BANK.length, dateISO);
  let puzzle: StrandsPuzzle | null = null;
  for (let off = 0; off < BANK.length; off++) {
    const entry = BANK[(start + off) % BANK.length];
    puzzle = buildPuzzle(entry, rng, maxHints);
    if (puzzle) break;
  }
  if (!puzzle) {
    throw new Error(`strands: failed to build a puzzle for ${dateISO} (${difficulty})`);
  }

  cache.set(key, puzzle);
  return puzzle;
}
