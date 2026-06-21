/**
 * Pattern Matrix engine — pure, deterministic logic for an abstract 3×3
 * progressive-matrix reasoning puzzle. No React, no DOM, no globals: fully
 * unit-testable.
 *
 * A tile is a fixed-key vector of small non-negative ints indexing palettes:
 *   shape:0-4, count:0-3 (=>1-4 reps), rotation:0-3 (=>*90deg), fill:0-3,
 *   color:0-(paletteSize-1)
 * The 3×3 grid is governed by one or more deterministic RULES that transform an
 * attribute across rows and/or columns. The player infers the rules and picks
 * the tile that completes cell 8 (the missing bottom-right cell).
 */

import type { Rng } from "@/lib/rng";
import type { Difficulty } from "@/lib/types";

export type AttrKey = "shape" | "count" | "rotation" | "fill" | "color";

/** Fixed, deterministic attribute ordering — locked by the determinism test. */
export const ATTR_KEYS: readonly AttrKey[] = [
  "shape",
  "count",
  "rotation",
  "fill",
  "color",
] as const;

/** Domain (number of distinct values) for each attribute. `color` is overridden by paletteSize. */
export const ATTR_DOMAIN: Record<AttrKey, number> = {
  shape: 5, // triangle / circle / square / diamond / hex
  count: 4, // 1..4 repeats
  rotation: 4, // 0/90/180/270
  fill: 4, // outline / solid / striped / dotted
  color: 4, // palette slots (capped per tier by paletteSize)
};

/** A tile is a value for every attribute. */
export type Tile = Record<AttrKey, number>;

export type RuleKind = "constant" | "progression" | "distinct" | "arithmetic";

export interface Rule {
  attr: AttrKey;
  kind: RuleKind;
  axis: "row" | "col";
  /** progression step (per cell along the axis); unused for other kinds. */
  step?: number;
  /** modulo wrap for the attribute domain. */
  modulo: number;
}

export interface MatrixPuzzle {
  difficulty: Difficulty;
  /** length 9, index 8 is the "missing" tile (stored = the canonical answer). */
  cells: Tile[];
  /** the active generating rules (for hint text + validation). */
  rules: Rule[];
  /** length N (4/6/8); shuffled. */
  options: Tile[];
  /** index into options of the canonical tile (=== cells[8]). */
  answerIndex: number;
  /** 4 | 6 | 8 */
  optionCount: number;
  /** allowed wrong picks before round ends (3/2/1). */
  strikes: number;
  /** palette size used for the color attribute on this puzzle. */
  paletteSize: number;
}

export const GRID = 9;
export const ROWS = 3;
export const COLS = 3;

/** row/col helpers (0..2). */
export const rowOf = (i: number): number => Math.floor(i / COLS);
export const colOf = (i: number): number => i % COLS;
export const cellIdx = (r: number, c: number): number => r * COLS + c;

/** Deep-equality of two tiles across every attribute. */
export function tilesEqual(a: Tile, b: Tile): boolean {
  return ATTR_KEYS.every((k) => a[k] === b[k]);
}

/** A fresh tile with every attribute set to 0. */
export function emptyTile(): Tile {
  return { shape: 0, count: 0, rotation: 0, fill: 0, color: 0 };
}

/**
 * Tier configuration. Tier = rule complexity × option count.
 *   easy:   1-2 rules / 4 opts / 3 strikes
 *   medium: 2-3 rules / 6 opts / 2 strikes
 *   hard:   3-4 rules / 8 opts / 1 strike
 */
export interface TierConfig {
  minRules: number;
  maxRules: number;
  optionCount: number;
  strikes: number;
  paletteSize: number;
  allowedRuleKinds: RuleKind[];
  /** hard guarantees at least one column-axis rule. */
  requireColAxis: boolean;
  /** hard adds one "swap trap" distractor. */
  swapTrap: boolean;
}

export const TIERS: Record<Difficulty, TierConfig> = {
  easy: {
    minRules: 1,
    maxRules: 2,
    optionCount: 4,
    strikes: 3,
    paletteSize: 3,
    allowedRuleKinds: ["constant", "progression"],
    requireColAxis: false,
    swapTrap: false,
  },
  medium: {
    minRules: 2,
    maxRules: 3,
    optionCount: 6,
    strikes: 2,
    paletteSize: 4,
    allowedRuleKinds: ["constant", "progression", "distinct"],
    requireColAxis: false,
    swapTrap: false,
  },
  hard: {
    minRules: 3,
    maxRules: 4,
    optionCount: 8,
    strikes: 1,
    paletteSize: 4,
    allowedRuleKinds: ["constant", "progression", "distinct", "arithmetic"],
    requireColAxis: true,
    swapTrap: true,
  },
};

/** Effective domain for an attribute on a puzzle (color is capped by paletteSize). */
export function domainOf(attr: AttrKey, paletteSize: number): number {
  return attr === "color" ? paletteSize : ATTR_DOMAIN[attr];
}

/**
 * Compute the value of `attr` at cell `i` from a base value, for a given rule.
 *
 * - constant: value is held constant along the rule axis (varies freely on the
 *   other axis — but the generator picks the same base for the whole grid, so a
 *   constant rule means the attribute is uniform across the grid).
 * - progression: v = (base + step * position) % modulo, where position is the
 *   column index (row axis) or the row index (col axis).
 * - distinct: a Latin-square rule — each line along the axis contains each of the
 *   first `modulo` values exactly once. Realised by `v = (base + r + c) % modulo`
 *   which guarantees every row and every column is a permutation.
 * - arithmetic (count only): handled separately in the generator (depends on two
 *   sibling cells), not by this per-cell function.
 */
export function applyRule(rule: Rule, base: number, r: number, c: number): number {
  const m = rule.modulo;
  switch (rule.kind) {
    case "constant":
      return ((base % m) + m) % m;
    case "progression": {
      const pos = rule.axis === "row" ? c : r;
      const step = rule.step ?? 1;
      return (((base + step * pos) % m) + m) % m;
    }
    case "distinct":
      // Latin square: independent of axis (rows AND cols are permutations).
      return (((base + r + c) % m) + m) % m;
    case "arithmetic":
      // Resolved at grid-build time; per-cell form not meaningful here.
      return ((base % m) + m) % m;
    default:
      return base;
  }
}

/**
 * Recompute every cell's value for `attr` from the grid's base cell(s) +
 * the rule, and return the expected full attribute layer (length 9). Used by
 * both the generator (to build the grid) and validation (to prove the grid is
 * rule-faithful and the answer is genuinely entailed).
 *
 * `bases` provides the base value for the layer: for arithmetic we need the two
 * source columns' counts from the grid itself, so the caller supplies the
 * current grid; for the rest we use a single base.
 */
export function computeLayer(rule: Rule, base: number, grid?: Tile[]): number[] {
  const m = rule.modulo;
  const out = new Array<number>(GRID).fill(0);
  if (rule.kind === "arithmetic") {
    // count[col 2] = (count[col 0] + count[col 1]) % m, per row.
    // Requires an existing grid with cols 0 & 1 already populated for `attr`.
    if (!grid) throw new Error("arithmetic layer needs grid");
    for (let r = 0; r < ROWS; r++) {
      const a = grid[cellIdx(r, 0)][rule.attr];
      const b = grid[cellIdx(r, 1)][rule.attr];
      out[cellIdx(r, 0)] = ((a % m) + m) % m;
      out[cellIdx(r, 1)] = ((b % m) + m) % m;
      out[cellIdx(r, 2)] = (((a + b) % m) + m) % m;
    }
    return out;
  }
  for (let i = 0; i < GRID; i++) {
    out[i] = applyRule(rule, base, rowOf(i), colOf(i));
  }
  return out;
}

/**
 * Does `candidate` (as the value at cell 8) satisfy `rule` given the rest of the
 * derived grid (cells 0-7)? This is the per-rule check that powers the
 * "exactly one option satisfies all rules" uniqueness guarantee.
 */
export function candidateSatisfiesRule(
  rule: Rule,
  grid: Tile[],
  candidate: Tile,
): boolean {
  const m = rule.modulo;
  const v = ((candidate[rule.attr] % m) + m) % m;
  const r = ROWS - 1;
  const c = COLS - 1;
  if (rule.kind === "arithmetic") {
    const a = grid[cellIdx(r, 0)][rule.attr];
    const b = grid[cellIdx(r, 1)][rule.attr];
    return v === (((a + b) % m) + m) % m;
  }
  if (rule.kind === "constant") {
    // value is uniform across the grid: must equal cell 0's value.
    return v === ((grid[0][rule.attr] % m) + m) % m;
  }
  if (rule.kind === "progression") {
    if (rule.axis === "row") {
      // last row: base = cell (2,0), step along columns.
      const base = grid[cellIdx(r, 0)][rule.attr];
      return v === applyRule(rule, base, r, c);
    }
    // col axis: last col, base = cell (0,2), step along rows.
    const base = grid[cellIdx(0, c)][rule.attr];
    return v === applyRule(rule, base, r, c);
  }
  // distinct (Latin): cell 8 must complete both its row and its column so each
  // is a permutation of the first `modulo` values.
  const rowVals = [grid[cellIdx(r, 0)][rule.attr], grid[cellIdx(r, 1)][rule.attr]];
  const colVals = [grid[cellIdx(0, c)][rule.attr], grid[cellIdx(1, c)][rule.attr]];
  if (rowVals.includes(v) || colVals.includes(v)) return false;
  return v >= 0 && v < m;
}

/** Does a full candidate tile satisfy ALL rules at cell 8? */
export function satisfiesAllRules(rules: Rule[], grid: Tile[], candidate: Tile): boolean {
  return rules.every((rule) => candidateSatisfiesRule(rule, grid, candidate));
}

/** Plain-language description of a rule (for hints). */
export function describeRule(rule: Rule): string {
  const axis = rule.axis === "row" ? "across each row" : "down each column";
  const attr = rule.attr;
  switch (rule.kind) {
    case "constant":
      return `The ${attr} stays the same across the whole grid.`;
    case "progression": {
      const step = rule.step ?? 1;
      const dir = step === 1 ? "advances by one step" : `advances by ${step} steps`;
      return `The ${attr} ${dir} ${axis}.`;
    }
    case "distinct":
      return `Each row and each column contains every ${attr} value exactly once.`;
    case "arithmetic":
      return `The count in the third column equals the first plus the second, ${axis}.`;
    default:
      return `A rule governs ${attr}.`;
  }
}

/**
 * Validate a Pattern Matrix puzzle: well-formed + uniquely winnable. Used by
 * index.ts and the test suite. Returns true only when:
 *  - cells.length === 9 and every tile is in-domain
 *  - options.length === optionCount matching the tier; answerIndex valid and
 *    options[answerIndex] deep-equals cells[8]
 *  - all options are pairwise DISTINCT
 *  - EXACTLY ONE option satisfies ALL rules (the core "uniquely winnable" check)
 *  - rules well-formed (non-empty, unique attribute per rule, arithmetic only on
 *    count) and the derived grid is self-consistent (applying rules to cells 0-7
 *    reproduces every non-base cell — the answer is genuinely entailed).
 */
export function validateMatrix(p: MatrixPuzzle): boolean {
  if (!p || p.cells?.length !== GRID) return false;
  if (!Array.isArray(p.rules) || p.rules.length === 0) return false;
  if (!Array.isArray(p.options)) return false;

  // tier shape
  const tier = TIERS[p.difficulty];
  if (!tier) return false;
  if (p.optionCount !== tier.optionCount) return false;
  if (p.options.length !== p.optionCount) return false;
  if (p.strikes !== tier.strikes) return false;
  if (p.paletteSize !== tier.paletteSize) return false;

  // every tile in-domain
  const inDomain = (t: Tile): boolean =>
    ATTR_KEYS.every((k) => {
      const v = t[k];
      return Number.isInteger(v) && v >= 0 && v < domainOf(k, p.paletteSize);
    });
  if (!p.cells.every(inDomain)) return false;
  if (!p.options.every(inDomain)) return false;

  // rules: unique attribute, arithmetic only on count
  const seen = new Set<AttrKey>();
  for (const rule of p.rules) {
    if (seen.has(rule.attr)) return false;
    seen.add(rule.attr);
    if (rule.kind === "arithmetic" && rule.attr !== "count") return false;
    if (!Number.isInteger(rule.modulo) || rule.modulo < 1) return false;
  }

  // answer integrity
  if (p.answerIndex < 0 || p.answerIndex >= p.options.length) return false;
  if (!tilesEqual(p.options[p.answerIndex], p.cells[GRID - 1])) return false;

  // options pairwise distinct
  for (let i = 0; i < p.options.length; i++) {
    for (let j = i + 1; j < p.options.length; j++) {
      if (tilesEqual(p.options[i], p.options[j])) return false;
    }
  }

  // grid is rule-faithful: every ruled attribute layer matches what the rule
  // produces from the grid's base cell(s). Non-base cells must be reproduced.
  for (const rule of p.rules) {
    let base: number;
    if (rule.kind === "arithmetic") base = 0; // grid-driven
    else if (rule.kind === "progression")
      base = rule.axis === "row" ? p.cells[cellIdx(0, 0)][rule.attr] : p.cells[cellIdx(0, 0)][rule.attr];
    else base = p.cells[0][rule.attr];
    const layer = computeLayer(rule, base, p.cells);
    for (let i = 0; i < GRID; i++) {
      if (p.cells[i][rule.attr] !== layer[i]) return false;
    }
  }

  // EXACTLY ONE option satisfies all rules.
  let satCount = 0;
  for (const opt of p.options) {
    if (satisfiesAllRules(p.rules, p.cells, opt)) satCount += 1;
  }
  if (satCount !== 1) return false;

  // and that one is the canonical answer
  if (!satisfiesAllRules(p.rules, p.cells, p.cells[GRID - 1])) return false;

  return true;
}
