/**
 * Mind Strands engine — pure, deterministic logic for a themed word-search on a
 * 6-wide × 8-tall grid (48 cells). Every theme word and the spangram is laid as
 * a connected 8-directional path; together they cover all 48 cells exactly. The
 * spangram touches both the top and bottom edges.
 *
 * No React, no DOM, no globals: fully unit-testable.
 */

import type { Rng } from "@/lib/rng";

export const COLS = 6;
export const ROWS = 8;
export const CELLS = COLS * ROWS; // 48

/** A grid cell coordinate. */
export type Cell = [number, number]; // [row, col]

/** 8-directional neighbour deltas. */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/** A raw theme definition in the bank (before packing). */
export interface ThemeEntry {
  /** Category title, e.g. "BRAIN ANATOMY". */
  name: string;
  /** Pool of on-theme words (uppercase A–Z, length 4–9). */
  words: string[];
  /** The spangram (uppercase, length 7–12). Spans the grid. */
  spangram: string;
  /** One-sentence brain-science insight for the completion modal. */
  insight: string;
}

/** Where a single found word lives in the grid. */
export interface Placement {
  /** The word in its canonical (theme list) orientation. */
  word: string;
  /** Ordered cells spelling the word. */
  path: Cell[];
  /** True for the spangram. */
  spangram: boolean;
}

/** A fully-packed, playable puzzle. */
export interface StrandsPuzzle {
  /** Theme title. */
  theme: string;
  /** The theme words the player must find (the spangram is listed separately). */
  words: string[];
  /** The spangram. */
  spangram: string;
  /** Brain-science insight. */
  insight: string;
  /** ROWS × COLS letters, row-major. grid[r][c]. */
  grid: string[][];
  /** Solution paths keyed by word (includes the spangram). */
  placements: Record<string, Placement>;
  /**
   * Hint generosity for this puzzle, set by the difficulty tier: how many hints
   * the player may spend. Easy is generous, hard offers none. Optional so older
   * saved/built shapes (without the field) still type-check; the component
   * falls back to a sane default when it is missing.
   */
  maxHints?: number;
}

/** Hints available per difficulty tier: easy generous, hard none. */
export const MAX_HINTS_BY_DIFFICULTY: Record<string, number> = {
  easy: 3,
  medium: 1,
  hard: 0,
};

export const idx = (r: number, c: number): number => r * COLS + c;
export const inBounds = (r: number, c: number): boolean =>
  r >= 0 && r < ROWS && c >= 0 && c < COLS;
export const cellKey = (r: number, c: number): string => `${r},${c}`;

/** Are two cells 8-directionally adjacent (and distinct)? */
export function adjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a[0] - b[0]);
  const dc = Math.abs(a[1] - b[1]);
  return (dr | dc) !== 0 && dr <= 1 && dc <= 1;
}

/** Is a path a valid connected, non-self-intersecting chain of in-bounds cells? */
export function isConnectedPath(path: Cell[]): boolean {
  if (path.length === 0) return false;
  const seen = new Set<string>();
  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    if (!inBounds(r, c)) return false;
    const k = cellKey(r, c);
    if (seen.has(k)) return false;
    seen.add(k);
    if (i > 0 && !adjacent(path[i - 1], path[i])) return false;
  }
  return true;
}

/** The word spelled by reading a path off the grid. */
export function readPath(grid: string[][], path: Cell[]): string {
  let s = "";
  for (const [r, c] of path) s += grid[r][c];
  return s;
}

/** Does the spangram path touch both opposite edges (top↔bottom or left↔right)? */
export function spangramSpans(path: Cell[]): boolean {
  let top = false;
  let bottom = false;
  let left = false;
  let right = false;
  for (const [r, c] of path) {
    if (r === 0) top = true;
    if (r === ROWS - 1) bottom = true;
    if (c === 0) left = true;
    if (c === COLS - 1) right = true;
  }
  return (top && bottom) || (left && right);
}

/**
 * The grid packer. Lay every word in `words` plus `spangram` as connected
 * 8-directional paths that together fill all 48 cells exactly with no reuse,
 * and where the spangram path spans the grid. Deterministic given `rng`.
 *
 * Returns the placements map (keyed by word) or null if packing failed within
 * the attempt budget.
 */
export function packGrid(
  words: string[],
  spangram: string,
  rng: Rng,
): Record<string, Placement> | null {
  // Spangram first; remaining words longest-first (easier to seat early).
  const rest = words.slice().sort((a, b) => b.length - a.length);
  const all = [spangram, ...rest];
  const total = all.reduce((n, w) => n + w.length, 0);
  if (total !== CELLS) return null;

  // occupancy: which word index owns each cell (-1 = free)
  const owner = new Int8Array(CELLS).fill(-1);

  type Found = { word: string; path: Cell[]; spangram: boolean };
  const placements: Found[] = [];

  /** All free cells as [r,c]. */
  function freeCells(): Cell[] {
    const out: Cell[] = [];
    for (let i = 0; i < CELLS; i++) {
      if (owner[i] === -1) out.push([Math.floor(i / COLS), i % COLS]);
    }
    return out;
  }

  /** Number of free 8-neighbours of a cell (used to pick constrained starts). */
  function freeDegree(r: number, c: number): number {
    let n = 0;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && owner[idx(nr, nc)] === -1) n++;
    }
    return n;
  }

  /**
   * Prune: every connected component of free cells must have a size that can be
   * exactly composed from a subset of the remaining word lengths. Cheap, strong.
   */
  function feasibleRemainder(remainingLens: number[]): boolean {
    const seen = new Uint8Array(CELLS);
    const compSizes: number[] = [];
    for (let i = 0; i < CELLS; i++) {
      if (owner[i] !== -1 || seen[i]) continue;
      // BFS flood the component
      let size = 0;
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const cur = stack.pop()!;
        size++;
        const r = Math.floor(cur / COLS);
        const c = cur % COLS;
        for (const [dr, dc] of DIRS) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const ni = idx(nr, nc);
          if (owner[ni] === -1 && !seen[ni]) {
            seen[ni] = 1;
            stack.push(ni);
          }
        }
      }
      compSizes.push(size);
    }
    if (compSizes.length === 0) return true;
    // Each component size must be reachable as a subset-sum of remaining lengths.
    const maxSum = remainingLens.reduce((a, b) => a + b, 0);
    const reach = new Uint8Array(maxSum + 1);
    reach[0] = 1;
    for (const len of remainingLens) {
      for (let s = maxSum; s >= len; s--) if (reach[s - len]) reach[s] = 1;
    }
    for (const size of compSizes) {
      if (size > maxSum || !reach[size]) return false;
    }
    return true;
  }

  /**
   * Try to grow a path of length `len` starting from `start`, only using free
   * cells (not in `used`). `requireSpan` enforces the spangram edge rule for the
   * completed path. Returns the path or null.
   */
  function growPath(start: Cell, len: number, requireSpan: boolean): Cell[] | null {
    const used = new Set<string>();
    const path: Cell[] = [];

    function dfs(cell: Cell): boolean {
      const k = cellKey(cell[0], cell[1]);
      used.add(k);
      path.push(cell);
      if (path.length === len) {
        if (!requireSpan || spangramSpans(path)) return true;
        path.pop();
        used.delete(k);
        return false;
      }
      const dirs = rng.shuffle(DIRS);
      for (const [dr, dc] of dirs) {
        const nr = cell[0] + dr;
        const nc = cell[1] + dc;
        if (!inBounds(nr, nc)) continue;
        const ni = idx(nr, nc);
        if (owner[ni] !== -1) continue;
        const nk = cellKey(nr, nc);
        if (used.has(nk)) continue;
        if (dfs([nr, nc])) return true;
      }
      path.pop();
      used.delete(k);
      return false;
    }

    return dfs(start) ? path : null;
  }

  /** Place word index `wi`; backtrack on failure. */
  function place(wi: number): boolean {
    if (wi >= all.length) return true;
    const word = all[wi];
    const isSpan = wi === 0;
    const remainingLens = all.slice(wi + 1).map((w) => w.length);
    // Candidate start cells: for the spangram bias to an edge row to span fast;
    // otherwise grow from the most-constrained free cell first to avoid
    // stranding isolated regions.
    let starts = freeCells();
    if (isSpan) {
      const edge = starts.filter(([r]) => r === 0 || r === ROWS - 1);
      starts = rng.shuffle(edge.length ? edge : starts);
    } else {
      starts = rng
        .shuffle(starts)
        .sort((a, b) => freeDegree(a[0], a[1]) - freeDegree(b[0], b[1]));
    }
    // Cap attempts per word to keep packing bounded.
    const cap = isSpan ? starts.length : Math.min(starts.length, 18);
    for (let s = 0; s < cap; s++) {
      const path = growPath(starts[s], word.length, isSpan);
      if (!path) continue;
      // claim cells + write the word's letters
      path.forEach(([r, c]) => (owner[idx(r, c)] = wi));
      // Prune dead-end remainders before recursing.
      if (feasibleRemainder(remainingLens) && place(wi + 1)) {
        placements.push({ word, path, spangram: isSpan });
        return true;
      }
      path.forEach(([r, c]) => (owner[idx(r, c)] = -1));
    }
    return false;
  }

  // Outer retry loop: a handful of full restarts using the same rng stream.
  for (let attempt = 0; attempt < 40; attempt++) {
    owner.fill(-1);
    placements.length = 0;
    if (place(0)) {
      const grid: string[][] = Array.from({ length: ROWS }, () =>
        new Array<string>(COLS).fill(""),
      );
      const map: Record<string, Placement> = {};
      for (const p of placements) {
        p.path.forEach(([r, c], i) => (grid[r][c] = p.word[i]));
        map[p.word] = { word: p.word, path: p.path, spangram: p.spangram };
      }
      // sanity: grid must be fully filled
      let filled = true;
      for (let r = 0; r < ROWS && filled; r++)
        for (let c = 0; c < COLS; c++) if (!grid[r][c]) filled = false;
      if (filled) return map;
    }
  }
  return null;
}

/** What a hint reveals: the word to expose and its solution placement. */
export interface StrandsHint {
  /** The word being revealed. */
  word: string;
  /** Whether it is the spangram. */
  spangram: boolean;
  /** Ordered solution cells for the word. */
  path: Cell[];
}

/**
 * Pick the next word to reveal as a hint. Pure + deterministic.
 *
 * Prefers revealing a full short word so the player still does most of the
 * work: among not-yet-found theme words it returns the shortest (ties broken by
 * dictionary order for determinism). The spangram is only offered as a last
 * resort, when it is the only remaining target. Returns null when nothing is
 * left to reveal.
 */
export function getHint(puzzle: StrandsPuzzle, found: string[]): StrandsHint | null {
  const have = new Set(found);
  const candidates = puzzle.words
    .filter((w) => !have.has(w))
    .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  let word = candidates[0];
  // Only fall back to the spangram if no plain theme words remain.
  if (!word && !have.has(puzzle.spangram)) word = puzzle.spangram;
  if (!word) return null;
  const pl = puzzle.placements[word];
  if (!pl) return null;
  return { word, spangram: word === puzzle.spangram, path: pl.path };
}

/** Find every connected-path occurrence of `word` in the grid (forward only). */
export function findWordPaths(grid: string[][], word: string): Cell[][] {
  const results: Cell[][] = [];
  const target = word.toUpperCase();
  const path: Cell[] = [];
  const used = new Set<string>();

  function dfs(r: number, c: number, depth: number) {
    if (grid[r][c] !== target[depth]) return;
    const k = cellKey(r, c);
    if (used.has(k)) return;
    used.add(k);
    path.push([r, c]);
    if (depth === target.length - 1) {
      results.push(path.map((p) => [p[0], p[1]] as Cell));
    } else {
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) dfs(nr, nc, depth + 1);
      }
    }
    path.pop();
    used.delete(k);
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === target[0]) dfs(r, c, 0);
    }
  }
  return results;
}

/**
 * Validate that a packed puzzle is well-formed and fully solvable:
 * - grid is ROWS×COLS, all A–Z;
 * - every theme word + spangram has a placement that reads correctly and is a
 *   valid connected path; the spangram spans the grid;
 * - placements collectively cover all 48 cells with no overlap;
 * - every target word is actually findable as a connected path in the grid.
 */
export function validatePuzzle(p: StrandsPuzzle): boolean {
  if (!p || !p.grid || p.grid.length !== ROWS) return false;
  for (let r = 0; r < ROWS; r++) {
    if (p.grid[r].length !== COLS) return false;
    for (let c = 0; c < COLS; c++) {
      if (!/^[A-Z]$/.test(p.grid[r][c])) return false;
    }
  }

  const targets = [p.spangram, ...p.words];
  if (new Set(targets).size !== targets.length) return false;

  const cover = new Set<string>();
  for (const w of targets) {
    const pl = p.placements[w];
    if (!pl) return false;
    if (pl.word !== w) return false;
    if (pl.path.length !== w.length) return false;
    if (!isConnectedPath(pl.path)) return false;
    if (readPath(p.grid, pl.path) !== w) return false;
    if (w === p.spangram) {
      if (!pl.spangram) return false;
      if (!spangramSpans(pl.path)) return false;
    }
    for (const [r, c] of pl.path) {
      const k = cellKey(r, c);
      if (cover.has(k)) return false; // overlap
      cover.add(k);
    }
  }
  if (cover.size !== CELLS) return false; // full coverage

  // Each target is findable as a connected path (forward or reversed).
  for (const w of targets) {
    const fwd = findWordPaths(p.grid, w);
    const rev = findWordPaths(p.grid, w.split("").reverse().join(""));
    if (fwd.length + rev.length < 1) return false;
  }

  return true;
}
