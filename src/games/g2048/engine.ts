/**
 * 2048 engine — pure, deterministic logic for a classic 4×4 sliding-tile merge
 * game. No React, no DOM, no globals: fully unit-testable.
 *
 * The board is a flat array of 16 numbers (0 = empty). Moves slide + merge in
 * one of four directions; a single tile merges at most once per move. The daily
 * spawn sequence (which value, which empty cell) is driven by the seeded Rng so
 * the start state and every spawn after a move are reproducible for a date.
 */

import type { Rng } from "@/lib/rng";
import type { Difficulty } from "@/lib/types";

export const SIZE = 4;
export const CELLS = SIZE * SIZE; // 16
export const WIN_TILE = 2048;

/**
 * The target tile required to WIN, per difficulty tier. Lower tiers win sooner.
 * easy=256, medium=512, hard=1024 — the classic 2048 remains reachable on every
 * tier (the player may keep playing past the target for a higher score), but
 * only reaching the *target* counts as a clear for unlock purposes.
 */
export const TARGET_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 256,
  medium: 512,
  hard: 1024,
};

/** The default win target when a puzzle omits one (legacy puzzles → medium). */
export const DEFAULT_TARGET = TARGET_BY_DIFFICULTY.medium;

/** Valid target tiles a puzzle may declare. */
export const TARGETS = [256, 512, 1024] as const;

export type Direction = "U" | "D" | "L" | "R";
export type Grid = number[]; // length 16, 0 = empty

export const idx = (r: number, c: number): number => r * SIZE + c;

/** A scripted spawn: the value placed and the rank of the empty cell to use. */
export interface Spawn {
  /** Tile value (2 or 4). */
  value: number;
  /**
   * Which empty cell to fill, expressed as an index into the *current* list of
   * empty cells (row-major). Stored as a fraction in [0,1) so it stays valid no
   * matter how many cells happen to be empty at spawn time.
   */
  pick: number;
}

export interface G2048Puzzle {
  /** The starting 4×4 board (two tiles already placed). */
  start: Grid;
  /**
   * Pre-computed spawn script for tiles added after each valid move. Long enough
   * to outlast any realistic game; the component cycles through it in order.
   */
  spawns: Spawn[];
  /**
   * The tile value that counts as a WIN for this puzzle's difficulty tier
   * (256/512/1024). Optional for backward-compatibility with legacy puzzles,
   * which default to {@link DEFAULT_TARGET}.
   */
  target?: number;
}

/** Indices of all empty (0) cells, row-major. */
export function emptyCells(g: Grid): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i++) if (g[i] === 0) out.push(i);
  return out;
}

/** A fresh tile value: 90% → 2, 10% → 4. */
export function spawnValue(rng: Rng): number {
  return rng.next() < 0.9 ? 2 : 4;
}

/** Build a Spawn descriptor from the rng (value + relative empty-cell pick). */
export function makeSpawn(rng: Rng): Spawn {
  const value = spawnValue(rng);
  const pick = rng.next(); // resolved against the empty list at spawn time
  return { value, pick };
}

/** Resolve a Spawn against a board: returns the concrete empty cell index, or -1. */
export function resolveSpawnCell(g: Grid, spawn: Spawn): number {
  const empties = emptyCells(g);
  if (empties.length === 0) return -1;
  const k = Math.min(empties.length - 1, Math.floor(spawn.pick * empties.length));
  return empties[k];
}

/** Apply a spawn to a *copy* of the grid; returns the new grid (or same if full). */
export function applySpawn(g: Grid, spawn: Spawn): Grid {
  const cell = resolveSpawnCell(g, spawn);
  if (cell < 0) return g.slice();
  const next = g.slice();
  next[cell] = spawn.value;
  return next;
}

/**
 * Slide + merge a single line (length 4) toward index 0 (the "left" of the line).
 * Returns the resulting line and the score gained from merges. A tile merges at
 * most once per move (no chaining).
 */
export function slideLine(line: number[]): { line: number[]; gained: number } {
  const tiles = line.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      const merged = tiles[i] * 2;
      out.push(merged);
      gained += merged;
      i++; // skip the consumed partner — prevents double-merge
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { line: out, gained };
}

/** Extract the cells of a line for a direction, ordered toward the move target. */
function lineIndices(dir: Direction, k: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < SIZE; i++) {
    switch (dir) {
      case "L":
        out.push(idx(k, i));
        break;
      case "R":
        out.push(idx(k, SIZE - 1 - i));
        break;
      case "U":
        out.push(idx(i, k));
        break;
      case "D":
        out.push(idx(SIZE - 1 - i, k));
        break;
    }
  }
  return out;
}

export interface MoveResult {
  grid: Grid;
  gained: number;
  /** True if the board changed (a valid move). */
  moved: boolean;
}

/**
 * Apply a directional move to a grid WITHOUT spawning a new tile. Pure: returns
 * a new grid, points gained, and whether anything moved.
 */
export function move(g: Grid, dir: Direction): MoveResult {
  const next = g.slice();
  let gained = 0;
  let moved = false;
  for (let k = 0; k < SIZE; k++) {
    const indices = lineIndices(dir, k);
    const line = indices.map((i) => g[i]);
    const res = slideLine(line);
    for (let i = 0; i < SIZE; i++) {
      if (next[indices[i]] !== res.line[i]) moved = true;
      next[indices[i]] = res.line[i];
    }
    gained += res.gained;
  }
  return { grid: next, gained, moved };
}

/**
 * Per-tile movement metadata for one move, used by the UI to animate tiles
 * sliding/merging. Pure: derives from the same slide+merge rules as `move`,
 * but additionally records, for each resulting tile, which source cell(s) it
 * came from. Does NOT spawn a new tile.
 *
 * - `from` is the source cell index a surviving tile slides out of.
 * - `to` is the destination cell index.
 * - `merged` is true when two tiles combined into this destination; in that
 *   case `mergedFrom` carries the *second* source cell (the one that slides on
 *   top), so both inbound tiles can be animated before the pop.
 */
export interface TilePath {
  from: number;
  to: number;
  value: number; // resulting value at `to`
  merged: boolean;
  mergedFrom?: number; // the partner source cell when merged
}

export interface MovePaths {
  grid: Grid;
  gained: number;
  moved: boolean;
  paths: TilePath[];
}

/**
 * Like `move`, but also returns the slide/merge path for every tile so the UI
 * can animate the transition. The resulting `grid` and `gained` are identical
 * to `move(g, dir)`.
 */
export function moveWithPaths(g: Grid, dir: Direction): MovePaths {
  const next = g.slice();
  let gained = 0;
  let moved = false;
  const paths: TilePath[] = [];

  for (let k = 0; k < SIZE; k++) {
    const indices = lineIndices(dir, k);
    const line = indices.map((i) => g[i]);

    // Replicate slideLine, but track the source cell positions along the line.
    const tiles: { value: number; cell: number }[] = [];
    for (let i = 0; i < SIZE; i++) {
      if (line[i] !== 0) tiles.push({ value: line[i], cell: indices[i] });
    }

    const out: number[] = [];
    let slot = 0; // position along this line for the result tile
    for (let i = 0; i < tiles.length; i++) {
      const destCell = indices[slot];
      if (i + 1 < tiles.length && tiles[i].value === tiles[i + 1].value) {
        const mergedValue = tiles[i].value * 2;
        out.push(mergedValue);
        gained += mergedValue;
        paths.push({
          from: tiles[i].cell,
          to: destCell,
          value: mergedValue,
          merged: true,
          mergedFrom: tiles[i + 1].cell,
        });
        i++; // consume partner
      } else {
        out.push(tiles[i].value);
        paths.push({
          from: tiles[i].cell,
          to: destCell,
          value: tiles[i].value,
          merged: false,
        });
      }
      slot++;
    }
    while (out.length < SIZE) out.push(0);

    for (let i = 0; i < SIZE; i++) {
      if (next[indices[i]] !== out[i]) moved = true;
      next[indices[i]] = out[i];
    }
  }

  return { grid: next, gained, moved, paths };
}

/** True if any of the four moves would change the board. */
export function canMove(g: Grid): boolean {
  if (emptyCells(g).length > 0) return true;
  const dirs: Direction[] = ["U", "D", "L", "R"];
  return dirs.some((d) => move(g, d).moved);
}

/**
 * True once any tile has reached the win value. `target` defaults to the classic
 * 2048 tile so existing callers (and tests) keep their behaviour; per-tier daily
 * play passes the puzzle's lower target (256/512/1024).
 */
export function hasWon(g: Grid, target: number = WIN_TILE): boolean {
  return g.some((v) => v >= target);
}

/** Resolve a puzzle's win target, falling back to the medium default. */
export function targetOf(p: G2048Puzzle): number {
  return p.target ?? DEFAULT_TARGET;
}

/** The largest tile currently on the board. */
export function maxTile(g: Grid): number {
  return g.reduce((m, v) => (v > m ? v : m), 0);
}

/**
 * Build the deterministic starting board: two tiles placed via the rng. Returns
 * the board plus the two spawns consumed (kept for transparency/testing).
 */
export function makeStart(rng: Rng): Grid {
  let g: Grid = new Array(CELLS).fill(0);
  g = applySpawn(g, makeSpawn(rng));
  g = applySpawn(g, makeSpawn(rng));
  return g;
}

/** How many spawns to pre-generate. A 4×4 game rarely exceeds a few hundred moves. */
export const SPAWN_SCRIPT_LENGTH = 1024;

/**
 * Validate a puzzle is well-formed: a 16-cell start with exactly two non-zero
 * tiles (each 2 or 4), an empty-aware spawn script, and a legal opening (the
 * board is not already stuck). Solvability for 2048 means "the opening always
 * has a legal move" — with 14 empty cells that is guaranteed, but we assert it.
 */
export function validateG2048(p: G2048Puzzle): boolean {
  if (!p || !Array.isArray(p.start) || p.start.length !== CELLS) return false;
  const nonZero = p.start.filter((v) => v !== 0);
  if (nonZero.length !== 2) return false;
  if (!nonZero.every((v) => v === 2 || v === 4)) return false;
  if (emptyCells(p.start).length !== CELLS - 2) return false;
  if (!Array.isArray(p.spawns) || p.spawns.length < 16) return false;
  for (const s of p.spawns) {
    if (s.value !== 2 && s.value !== 4) return false;
    if (typeof s.pick !== "number" || s.pick < 0 || s.pick >= 1) return false;
  }
  // A declared target must be one of the supported tier targets (legacy puzzles
  // omit it and default to the medium target).
  if (p.target !== undefined && !(TARGETS as readonly number[]).includes(p.target)) {
    return false;
  }
  // The opening must be playable (a legal move exists).
  return canMove(p.start);
}
