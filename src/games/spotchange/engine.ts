/**
 * Spot the Change engine — pure, deterministic logic for a visual
 * change-detection game. Each ROUND shows a square grid of coloured cells; after
 * a brief mask, the grid reappears with exactly ONE cell swapped to a different
 * palette colour. The player taps the cell they believe changed.
 *
 * No React, no DOM, no globals: fully unit-testable. Every choice flows from the
 * seeded rng in a fixed order, so the same date + tier always reproduces the
 * same run for every player.
 *
 * Difficulty tiers scale four knobs. Three escalate monotonically (grid edge,
 * palette size, rounds); flashMs is the single INVERTED knob (shorter flash =
 * less encoding time = harder). Timing is presentation-only and never seeded.
 */

import type { Rng } from "@/lib/rng";
import type { Difficulty } from "@/lib/types";

/** Per-tier parameters. */
export interface SpotChangeParams {
  /** Edge length of the square grid (cells = grid*grid). */
  grid: number;
  /** Number of distinct palette colours in play. */
  paletteSize: number;
  /** How long the SHOW phase displays the grid, in ms. */
  flashMs: number;
  /** Number of change-detection rounds in the run. */
  rounds: number;
}

/**
 * Three knobs escalate easy → hard (grid, paletteSize, rounds) while flashMs
 * DECREASES — the only inverted knob, asserted in tests.
 */
export const PARAMS_BY_DIFFICULTY: Record<Difficulty, SpotChangeParams> = {
  easy: { grid: 3, paletteSize: 4, flashMs: 2200, rounds: 5 },
  medium: { grid: 4, paletteSize: 5, flashMs: 1600, rounds: 6 },
  hard: { grid: 5, paletteSize: 6, flashMs: 1100, rounds: 7 },
};

/** Resolve parameters for a tier (defaults to medium for legacy callers). */
export function paramsFor(difficulty: Difficulty = "medium"): SpotChangeParams {
  return PARAMS_BY_DIFFICULTY[difficulty] ?? PARAMS_BY_DIFFICULTY.medium;
}

/**
 * A named neon palette colour. Lightness varies as well as hue so the colours
 * stay separable for colour-blind users, and each carries a human name (a
 * non-colour cue for screen readers) and a glyph (a non-colour visual cue, so
 * colour is never the sole channel — WCAG 1.4.1).
 */
export interface PaletteColor {
  hex: string;
  name: string;
  glyph: string;
}

/**
 * Fixed, ordered palette chosen for high mutual contrast and colour-blind
 * separability (distinct lightness, not just hue). Constant per build — never
 * seeded — so it is stable and testable. Each tier slices the first N.
 */
export const PALETTE: readonly PaletteColor[] = [
  { hex: "#ff9e3d", name: "amber", glyph: "▲" },
  { hex: "#00e5ff", name: "cyan", glyph: "●" },
  { hex: "#ff2bd6", name: "magenta", glyph: "◆" },
  { hex: "#7cf5c4", name: "mint", glyph: "■" },
  { hex: "#9b8cff", name: "violet", glyph: "✦" },
  { hex: "#ffe066", name: "lemon", glyph: "✚" },
] as const;

/** The neutral colour cells are painted during the BLANK (mask) phase. */
export const MASK_COLOR = "rgba(255,255,255,0.05)";

/** Floor the flash duration is clamped to when reducedMotion is on. */
export const REDUCED_MOTION_FLASH_FLOOR = 1500;
/** Interstimulus blank-mask interval, in ms (presentation-only). */
export const BLANK_MS = 500;
/** Shortened blank when reducedMotion is on (presentation-only). */
export const BLANK_MS_REDUCED = 250;

/** One change-detection trial. */
export interface Round {
  /** Colour index (into the palette) for each cell of the SHOW grid. */
  base: number[];
  /** Index of the single cell whose colour is swapped in the TEST grid. */
  changedCell: number;
  /** The palette index the changed cell takes in the TEST grid (≠ old). */
  newColor: number;
}

export interface SpotChangePuzzle {
  /** Edge length of the square grid. */
  grid: number;
  /** The palette colours in play for this tier (length === paletteSize). */
  palette: PaletteColor[];
  /** The change-detection rounds, one per trial. */
  rounds: Round[];
  /** SHOW-phase flash duration in ms. */
  flashMs: number;
  /** Difficulty tier this puzzle was generated for. */
  difficulty: Difficulty;
}

/**
 * Build the TEST grid for a round: a copy of `base` with the single changed
 * cell repainted to `newColor`. This is the grid shown in the TEST phase and is
 * guaranteed to differ from `base` at exactly one index.
 */
export function testGrid(round: Round): number[] {
  const grid = round.base.slice();
  grid[round.changedCell] = round.newColor;
  return grid;
}

/**
 * Generate one change-detection round. Every choice flows from the seeded rng in
 * a fixed order, so generation is fully deterministic.
 *
 * The change is always a COLOUR swap of one cell (never add/remove a cell):
 * `newColor` is picked from the palette indices EXCLUDING the cell's current
 * colour, so the change is real and the answer is unique (paletteSize ≥ 2 always
 * holds). A degenerate uniform-colour base is re-rolled (bounded, deterministic)
 * so the scene is never trivial.
 */
export function generateRound(rng: Rng, grid: number, paletteSize: number): Round {
  const cells = grid * grid;
  let base = Array.from({ length: cells }, () => rng.int(0, paletteSize - 1));
  // Avoid a degenerate uniform scene: re-roll (bounded) if every cell is equal.
  // Uniqueness doesn't depend on this, but it keeps the trial non-trivial.
  for (let tries = 0; tries < 8 && base.every((c) => c === base[0]); tries++) {
    base = Array.from({ length: cells }, () => rng.int(0, paletteSize - 1));
  }
  const changedCell = rng.int(0, cells - 1);
  const others: number[] = [];
  for (let i = 0; i < paletteSize; i++) {
    if (i !== base[changedCell]) others.push(i);
  }
  const newColor = rng.pick(others);
  return { base, changedCell, newColor };
}

/** Generate the full run of rounds for a tier from the seeded rng. */
export function generateRounds(rng: Rng, params: SpotChangeParams): Round[] {
  const out: Round[] = [];
  for (let r = 0; r < params.rounds; r++) {
    out.push(generateRound(rng, params.grid, params.paletteSize));
  }
  return out;
}

/**
 * Evaluate a tap during the TEST phase. The tap is "correct" iff it lands on the
 * cell whose colour changed; any other cell is "wrong".
 */
export function evaluateTap(round: Round, cell: number): "correct" | "wrong" {
  return cell === round.changedCell ? "correct" : "wrong";
}

/**
 * Score a run from its per-round correctness flags. Accuracy is the primary
 * signal: round(correct / total * 100). A perfect run is exactly 100; a faster
 * perfect run can be given a tie-break elsewhere but is still capped at 100. A
 * non-perfect run never reaches 100.
 */
export function scoreRun(results: readonly boolean[]): number {
  if (results.length === 0) return 0;
  const correct = results.filter(Boolean).length;
  return Math.round((correct / results.length) * 100);
}

/** How many cells differ between two equal-length grids. */
function diffCount(a: readonly number[], b: readonly number[]): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

/**
 * Validate a generated puzzle. Returns true iff the puzzle is well-formed AND
 * every round encodes a real, unique change:
 *  - grid ≥ 2; palette a non-empty array of distinct hex strings; rounds a
 *    non-empty array whose length matches the tier's expected round count;
 *    flashMs > 0; difficulty a valid tier.
 *  - for every round: base.length === grid*grid; every base[i] an integer in
 *    [0, palette.length); changedCell in [0, cells); newColor in [0,
 *    palette.length); newColor !== base[changedCell] (the change is real).
 *  - uniqueness: the TEST grid differs from base in EXACTLY one cell, at index
 *    changedCell — one and only one correct answer (the heart of solvability).
 */
export function validateSpotChange(p: SpotChangePuzzle): boolean {
  if (!p || typeof p !== "object") return false;
  if (!Number.isInteger(p.grid) || p.grid < 2) return false;
  if (typeof p.flashMs !== "number" || !(p.flashMs > 0)) return false;
  if (p.difficulty !== "easy" && p.difficulty !== "medium" && p.difficulty !== "hard") {
    return false;
  }

  if (!Array.isArray(p.palette) || p.palette.length === 0) return false;
  const hexes = new Set<string>();
  for (const c of p.palette) {
    if (!c || typeof c.hex !== "string" || c.hex.length === 0) return false;
    if (typeof c.name !== "string" || typeof c.glyph !== "string") return false;
    if (hexes.has(c.hex)) return false; // distinct colours
    hexes.add(c.hex);
  }

  const expectedRounds = paramsFor(p.difficulty).rounds;
  if (!Array.isArray(p.rounds) || p.rounds.length === 0) return false;
  if (p.rounds.length !== expectedRounds) return false;

  const cells = p.grid * p.grid;
  const palN = p.palette.length;

  for (const round of p.rounds) {
    if (!round || !Array.isArray(round.base)) return false;
    if (round.base.length !== cells) return false;
    for (const v of round.base) {
      if (!Number.isInteger(v) || v < 0 || v >= palN) return false;
    }
    if (!Number.isInteger(round.changedCell) || round.changedCell < 0 || round.changedCell >= cells) {
      return false;
    }
    if (!Number.isInteger(round.newColor) || round.newColor < 0 || round.newColor >= palN) {
      return false;
    }
    if (round.newColor === round.base[round.changedCell]) return false; // change must be real

    // Uniqueness: exactly one cell differs, and it is the changed cell.
    const test = testGrid(round);
    if (diffCount(round.base, test) !== 1) return false;
    if (test[round.changedCell] === round.base[round.changedCell]) return false;
  }

  return true;
}
