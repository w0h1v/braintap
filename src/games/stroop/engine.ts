/**
 * Stroop Rush engine — pure, deterministic logic for a timed Stroop task. Each
 * trial shows one colour WORD rendered in an INK colour; the player must tap the
 * swatch matching the INK, not the word's meaning. The engine pre-rolls a long
 * deterministic stream of trials per (date, tier) and exposes scoring helpers.
 * No React, no DOM, no globals: fully unit-testable.
 */

import type { Rng } from "@/lib/rng";
import type { Difficulty } from "@/lib/types";

/** A canonical colour available to the game. */
export interface CanonicalColor {
  /** Stable key. */
  key: string;
  /** Display label (also the word's spelling), e.g. "RED". */
  label: string;
  /** Accessible hex used for ink + swatch fill. */
  hex: string;
}

/**
 * The fixed master palette. Every tier's `colorSet` indexes into this array, so
 * swatch hit-testing and contrast checks are tier-agnostic. Hues are spaced and
 * tuned for legibility on the dark glass background.
 */
export const CANONICAL_COLORS: readonly CanonicalColor[] = [
  { key: "red", label: "RED", hex: "#ff5470" },
  { key: "green", label: "GREEN", hex: "#3ddc84" },
  { key: "blue", label: "BLUE", hex: "#4d9bff" },
  { key: "yellow", label: "YELLOW", hex: "#ffd23f" },
  { key: "orange", label: "ORANGE", hex: "#ff9e3d" },
  { key: "purple", label: "PURPLE", hex: "#b388ff" },
  { key: "pink", label: "PINK", hex: "#ff7ad9" },
] as const;

/** A single Stroop trial. */
export interface Trial {
  /** Index into the tier's active colour set — the word's MEANING (its spelling). */
  wordIdx: number;
  /** Index into the active set — the rendered INK colour (the correct answer). */
  inkIdx: number;
  /** True when wordIdx === inkIdx (the word matches its ink). */
  congruent: boolean;
}

/** Resolved tier parameters. */
export interface StroopParams {
  /** Indices into CANONICAL_COLORS forming the active set (length = setSize). */
  colorSet: number[];
  /** Round length in seconds. */
  durationSec: number;
  /** Round length in milliseconds. */
  durationMs: number;
  /** Correct trials needed to win the round (and unlock the next tier). */
  goal: number;
  /** Time penalty (ms) deducted from the clock on a wrong tap. */
  penaltyMs: number;
  /** Target fraction of trials that are congruent (word == ink). */
  congruentRate: number;
}

/** The deterministic daily puzzle for a (date, tier). */
export interface StroopPuzzle {
  /** Pre-rolled deterministic trial stream (length far beyond reachable count). */
  trials: Trial[];
  /** Deterministic seed used to build the stream. */
  seed: number;
  /** The tier this puzzle was generated for. */
  difficulty: Difficulty;
  /** The resolved tier parameters. */
  params: StroopParams;
}

/** How many trials to pre-roll — comfortably beyond any human's reach in a round. */
export const TRIAL_COUNT = 400;

/**
 * Per-tier knobs.
 *
 * Escalation invariants (asserted in tests):
 *   setSize:       easy < medium < hard   (4 < 6 < 7)
 *   durationSec:   easy > medium > hard
 *   congruentRate: easy > medium > hard
 *   goal:          easy < medium < hard
 *   penaltyMs:     easy < medium < hard
 */
export const PARAMS_BY_DIFFICULTY: Record<Difficulty, StroopParams> = {
  easy: {
    colorSet: [0, 1, 2, 3], // red, green, blue, yellow
    durationSec: 45,
    durationMs: 45_000,
    goal: 12,
    penaltyMs: 1000,
    congruentRate: 0.35,
  },
  medium: {
    colorSet: [0, 1, 2, 3, 4, 5], // + orange, purple
    durationSec: 40,
    durationMs: 40_000,
    goal: 18,
    penaltyMs: 1500,
    congruentRate: 0.25,
  },
  hard: {
    colorSet: [0, 1, 2, 3, 4, 5, 6], // + pink
    durationSec: 35,
    durationMs: 35_000,
    goal: 24,
    penaltyMs: 2000,
    congruentRate: 0.15,
  },
};

/** The default tier used when a caller omits difficulty (legacy single puzzle). */
export const DEFAULT_PARAMS = PARAMS_BY_DIFFICULTY.medium;

/** Resolve the params for a difficulty, defaulting to medium. */
export function paramsFor(difficulty: Difficulty = "medium"): StroopParams {
  return PARAMS_BY_DIFFICULTY[difficulty] ?? DEFAULT_PARAMS;
}

/**
 * Roll a single trial from a seeded RNG. `prev` (when supplied) is the
 * immediately-preceding trial: if the freshly rolled pair would duplicate it,
 * we re-roll once to break trivial streaks (still fully deterministic).
 */
function rollTrial(rng: Rng, setSize: number, congruentRate: number, prev?: Trial): Trial {
  const make = (): Trial => {
    const inkIdx = rng.int(0, setSize - 1);
    const congruent = rng.chance(congruentRate);
    let wordIdx: number;
    if (congruent) {
      wordIdx = inkIdx;
    } else {
      // Pick a DIFFERENT index so the word genuinely mismatches the ink.
      const offset = rng.int(1, setSize - 1);
      wordIdx = (inkIdx + offset) % setSize;
    }
    return { wordIdx, inkIdx, congruent: wordIdx === inkIdx };
  };
  let trial = make();
  if (prev && trial.wordIdx === prev.wordIdx && trial.inkIdx === prev.inkIdx) {
    trial = make(); // one re-roll to avoid back-to-back repeats
  }
  return trial;
}

/** Build the deterministic daily puzzle from a seeded RNG for a tier. */
export function generatePuzzle(
  rng: Rng,
  seed: number,
  difficulty: Difficulty = "medium",
): StroopPuzzle {
  const params = paramsFor(difficulty);
  const setSize = params.colorSet.length;
  const trials: Trial[] = [];
  for (let i = 0; i < TRIAL_COUNT; i++) {
    trials.push(rollTrial(rng, setSize, params.congruentRate, trials[i - 1]));
  }
  return { trials, seed, difficulty, params };
}

/**
 * Map a final score (correct trials) to a normalised 0–100 cross-game score.
 * Calibrated so the hard tier's goal (24) maps near the ceiling, keeping 100
 * reachable but earned across tiers.
 */
export const SCORE_CEILING = 24;

export function scoreToNormalised(correct: number): number {
  if (correct <= 0) return 0;
  return Math.max(1, Math.min(100, Math.round((correct / SCORE_CEILING) * 100)));
}

/** Did the player reach the tier goal (and so unlock the next tier)? */
export function isWin(correct: number, params: StroopParams = DEFAULT_PARAMS): boolean {
  return correct >= params.goal;
}

/**
 * Star rating from correct trials vs the tier goal: 3 stars at/over goal,
 * 2 at ≥⅔ of goal, 1 at ≥⅓, else 1 (a played round still earns a star).
 */
export function starsFor(correct: number, params: StroopParams = DEFAULT_PARAMS): 1 | 2 | 3 {
  if (correct >= params.goal) return 3;
  if (correct >= Math.ceil((params.goal * 2) / 3)) return 2;
  return 1;
}

/** Title tier shown on the completion modal, scaled to the tier goal. */
export function tierTitle(correct: number, params: StroopParams = DEFAULT_PARAMS): string {
  if (correct >= params.goal) return "Unshakeable focus.";
  if (correct >= Math.ceil((params.goal * 2) / 3)) return "Sharp inhibition.";
  if (correct >= Math.ceil(params.goal / 3)) return "Steady control.";
  return "Warm-up done.";
}

/** Emoji bar share grid (capped at 12 squares). */
export function shareGrid(correct: number): string {
  return "🟪".repeat(Math.max(1, Math.min(12, correct)));
}

/** Full share string. */
export function buildShareText(correct: number, params: StroopParams = DEFAULT_PARAMS): string {
  return `BrainTap · Stroop Rush\n${correct} correct in ${params.durationSec}s\n\n${shareGrid(correct)}\nbraintap.app`;
}

/**
 * Validate a generated puzzle. Asserts the trial stream is well-formed and the
 * CORE SOLVABILITY INVARIANT: for every trial the ink index is a valid index
 * into the active colour set (the correct answer always corresponds to a swatch
 * that exists on screen), and incongruent trials are genuinely mismatched.
 */
export function validateStroop(p: StroopPuzzle): boolean {
  const params = p.params ?? DEFAULT_PARAMS;
  // Params bounds.
  const setSize = params.colorSet.length;
  if (setSize < 2 || setSize > CANONICAL_COLORS.length) return false;
  if (!params.colorSet.every((c) => Number.isInteger(c) && c >= 0 && c < CANONICAL_COLORS.length)) {
    return false;
  }
  if (new Set(params.colorSet).size !== setSize) return false; // unique indices
  if (!(params.durationMs > 0)) return false;
  if (!(params.goal > 0)) return false;
  if (params.penaltyMs < 0) return false;
  if (params.congruentRate < 0 || params.congruentRate > 1) return false;

  // Stream must be long enough that a perfect player never exhausts it.
  if (!Array.isArray(p.trials)) return false;
  if (p.trials.length < params.goal * 8) return false;

  // Core solvability: every trial is answerable by a present swatch.
  for (const t of p.trials) {
    if (!Number.isInteger(t.inkIdx) || t.inkIdx < 0 || t.inkIdx >= setSize) return false;
    if (!Number.isInteger(t.wordIdx) || t.wordIdx < 0 || t.wordIdx >= setSize) return false;
    if (t.congruent !== (t.wordIdx === t.inkIdx)) return false;
    if (!t.congruent && t.wordIdx === t.inkIdx) return false;
  }
  return true;
}
