/**
 * Mental Math Sprint engine — pure, deterministic logic for a rapid-fire
 * arithmetic drill. One problem shows at a time; the player types the answer.
 * A fixed countdown bounds the round, so play length is unbounded — the problem
 * stream is generated lazily by ordinal via `problemAt`, never stored in bulk.
 *
 * No React, no DOM, no globals: fully unit-testable. Crucially, the stream is
 * keyed by (seed, ordinal) only — elapsed time NEVER leaks into generation, so a
 * replay always reproduces the same sequence for leaderboard fairness.
 */

import { rngFromString, type Rng } from "@/lib/rng";
import type { Difficulty } from "@/lib/types";

/** The four arithmetic operations. `x` = multiply, `/` = divide (display ×/÷). */
export type Op = "+" | "-" | "x" | "/";

export interface Problem {
  /** Left operand. */
  a: number;
  /** Right operand. */
  b: number;
  op: Op;
  /** Canonical integer answer (always exact). */
  answer: number;
  /** Display string, e.g. "7 × 8" (× and ÷ glyphs for display). */
  prompt: string;
}

/**
 * Difficulty knobs for the sprint. The tier controls which operations appear,
 * the operand ranges, the round length, and the clear goal.
 *
 * Escalation invariants (asserted in tests):
 *   operand max:  non-decreasing easy → hard
 *   ops.length:   non-decreasing easy → hard
 *   goal:         non-decreasing easy → hard
 *   durationSec:  increases with difficulty (more time offsets harder problems)
 */
export interface SprintParams {
  /** Operator pool for this tier. */
  ops: Op[];
  /** Weight per op (parallel to `ops`); need not sum to 1. */
  opWeights: number[];
  /** Operand range for + / -. */
  addSubMin: number;
  addSubMax: number;
  /** May subtraction produce a negative answer? */
  allowNegative: boolean;
  /** Factor range for ×. */
  mulMin: number;
  mulMax: number;
  /** Quotient range for ÷ (the exact answer). */
  divQMin: number;
  divQMax: number;
  /** Divisor range for ÷ (exact: dividend = q·d). */
  divDMin: number;
  divDMax: number;
  /** Round length in seconds. */
  durationSec: number;
  /** Correct answers needed to win the tier (and unlock the next). */
  goal: number;
}

export const PARAMS_BY_DIFFICULTY: Record<Difficulty, SprintParams> = {
  easy: {
    ops: ["+", "-"],
    opWeights: [1, 1],
    addSubMin: 1,
    addSubMax: 12,
    allowNegative: false,
    mulMin: 2,
    mulMax: 12,
    divQMin: 2,
    divQMax: 12,
    divDMin: 2,
    divDMax: 12,
    durationSec: 60,
    goal: 12,
  },
  medium: {
    ops: ["+", "-", "x"],
    opWeights: [4, 3, 3],
    addSubMin: 1,
    addSubMax: 30,
    allowNegative: true,
    mulMin: 2,
    mulMax: 12,
    divQMin: 2,
    divQMax: 12,
    divDMin: 2,
    divDMax: 12,
    durationSec: 75,
    goal: 12,
  },
  hard: {
    ops: ["+", "-", "x", "/"],
    opWeights: [3, 2.5, 2.5, 2],
    addSubMin: 1,
    addSubMax: 50,
    allowNegative: true,
    mulMin: 2,
    mulMax: 15,
    divQMin: 2,
    divQMax: 12,
    divDMin: 2,
    divDMax: 12,
    durationSec: 90,
    goal: 14,
  },
};

/** The default tier used when a caller omits difficulty. */
export const DEFAULT_PARAMS = PARAMS_BY_DIFFICULTY.medium;

/** Resolve the params for a difficulty, defaulting to medium. */
export function paramsFor(difficulty: Difficulty = "medium"): SprintParams {
  return PARAMS_BY_DIFFICULTY[difficulty] ?? DEFAULT_PARAMS;
}

export interface MathSprintPuzzle {
  /** Daily/tier salt for the deterministic problem stream. */
  seed: number;
  difficulty: Difficulty;
  params: SprintParams;
  /** Problem at ordinal 0 (so the idle screen can preview the shape). */
  first: Problem;
}

/** Display glyph for an operator (× and ÷ for multiply/divide). */
export function opGlyph(op: Op): string {
  switch (op) {
    case "+":
      return "+";
    case "-":
      return "−";
    case "x":
      return "×";
    case "/":
      return "÷";
  }
}

/** Compute the exact integer result of applying `op` to `a` and `b`. */
export function applyOp(a: number, b: number, op: Op): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "x":
      return a * b;
    case "/":
      return a / b;
  }
}

/**
 * Weighted pick of an op from a parallel (ops, weights) pair. Deterministic
 * given the `rng`. Falls back to the last op if rounding leaves a remainder.
 */
export function weightedPick(rng: Rng, ops: Op[], weights: number[]): Op {
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng.float(0, total);
  for (let i = 0; i < ops.length; i++) {
    roll -= weights[i];
    if (roll < 0) return ops[i];
  }
  return ops[ops.length - 1];
}

/**
 * The deterministic problem at a given ordinal in the stream. Same seed +
 * ordinal always yields the same Problem — this is the crux that lets play be
 * unbounded while staying reproducible for replay/leaderboard fairness.
 *
 * Operands are built per-op so the answer is ALWAYS an exact integer:
 *   +  : a,b in [addSubMin, addSubMax]
 *   -  : a,b in range; if !allowNegative, order so a >= b
 *   x  : a in [mulMin, mulMax], b in [mulMin, mulMax]
 *   /  : q in [divQMin, divQMax], d in [divDMin, divDMax]; a = q·d, b = d, answer = q
 */
export function problemAt(seed: number, ordinal: number, params: SprintParams): Problem {
  const rng = rngFromString(`mathsprint-q:${seed}:${ordinal}`);
  const op = weightedPick(rng, params.ops, params.opWeights);

  let a: number;
  let b: number;
  let answer: number;

  switch (op) {
    case "+": {
      a = rng.int(params.addSubMin, params.addSubMax);
      b = rng.int(params.addSubMin, params.addSubMax);
      answer = a + b;
      break;
    }
    case "-": {
      a = rng.int(params.addSubMin, params.addSubMax);
      b = rng.int(params.addSubMin, params.addSubMax);
      if (!params.allowNegative && b > a) {
        const t = a;
        a = b;
        b = t;
      }
      answer = a - b;
      break;
    }
    case "x": {
      a = rng.int(params.mulMin, params.mulMax);
      b = rng.int(params.mulMin, params.mulMax);
      answer = a * b;
      break;
    }
    case "/": {
      const q = rng.int(params.divQMin, params.divQMax);
      const d = rng.int(params.divDMin, params.divDMax);
      a = q * d;
      b = d;
      answer = q;
      break;
    }
  }

  const prompt = `${a} ${opGlyph(op)} ${b}`;
  return { a, b, op, answer, prompt };
}

/**
 * Map a final score (correct answers) to a normalised 0–100 cross-game score.
 * Calibrated so the hard goal (14) lands comfortably high and ~24 correct
 * approaches the ceiling. Monotonic non-decreasing, capped at 100.
 */
export function scoreToNormalised(score: number): number {
  if (score <= 0) return 0;
  // 24 correct ≈ 100. Keeps 100 reachable but earned for a fast clean run.
  return Math.max(1, Math.min(100, Math.round((score / 24) * 100)));
}

/** Did the player answer enough problems to win this tier (and unlock the next)? */
export function isWin(score: number, params: SprintParams = DEFAULT_PARAMS): boolean {
  return score >= params.goal;
}

/** Title shown on the completion modal, scaled to performance. */
export function tierTitle(score: number): string {
  if (score >= 24) return "Lightning recall.";
  if (score >= 16) return "Sharp arithmetic.";
  if (score >= 10) return "Solid sprint.";
  if (score >= 5) return "Warming up.";
  return "Time's up.";
}

/** Emoji bar share grid (capped at 20 squares). */
export function shareGrid(score: number): string {
  return "🟧".repeat(Math.max(1, Math.min(20, score)));
}

/** Full share string (CompletionModal auto-appends the tier label). */
export function buildShareText(
  score: number,
  bestStreak: number,
  params: SprintParams = DEFAULT_PARAMS,
): string {
  return (
    `BrainTap · Mental Math Sprint\n` +
    `${score} correct in ${params.durationSec}s · best streak ${bestStreak}\n\n` +
    `${shareGrid(score)}\nbraintap.app`
  );
}

/**
 * Validate a generated puzzle: params well-formed (ranges min ≤ max, weights
 * length matches ops, durationSec > 0, goal > 0, ops ⊆ {+,-,x,/}) and that
 * `first` is a valid exact problem.
 */
export function validateMathSprint(p: MathSprintPuzzle): boolean {
  if (!p || typeof p.seed !== "number") return false;
  const params = p.params;
  if (!params) return false;
  const valid: Op[] = ["+", "-", "x", "/"];
  if (!Array.isArray(params.ops) || params.ops.length === 0) return false;
  if (!params.ops.every((o) => valid.includes(o))) return false;
  if (!Array.isArray(params.opWeights) || params.opWeights.length !== params.ops.length) {
    return false;
  }
  if (!params.opWeights.every((w) => w > 0)) return false;
  if (params.addSubMin > params.addSubMax) return false;
  if (params.mulMin > params.mulMax) return false;
  if (params.divQMin > params.divQMax) return false;
  if (params.divDMin > params.divDMax) return false;
  if (params.divDMin < 1) return false; // never divide by zero
  if (params.durationSec <= 0) return false;
  if (params.goal <= 0) return false;
  return isValidProblem(p.first, params);
}

/** True when a problem's operands lie in range and its answer is exact. */
export function isValidProblem(prob: Problem, params: SprintParams): boolean {
  if (!prob || typeof prob.prompt !== "string" || prob.prompt.length === 0) return false;
  if (!params.ops.includes(prob.op)) return false;
  if (!Number.isInteger(prob.a) || !Number.isInteger(prob.b)) return false;
  if (!Number.isInteger(prob.answer)) return false;
  if (applyOp(prob.a, prob.b, prob.op) !== prob.answer) return false;

  switch (prob.op) {
    case "+":
    case "-": {
      // Both operands must lie in the add/sub range (subtraction may reorder).
      if (prob.a < params.addSubMin || prob.a > params.addSubMax) return false;
      if (prob.b < params.addSubMin || prob.b > params.addSubMax) return false;
      if (prob.op === "-" && !params.allowNegative && prob.answer < 0) return false;
      break;
    }
    case "x": {
      if (prob.a < params.mulMin || prob.a > params.mulMax) return false;
      if (prob.b < params.mulMin || prob.b > params.mulMax) return false;
      break;
    }
    case "/": {
      // Divisor in range, quotient in range, and exact: a === b * answer.
      if (prob.b < params.divDMin || prob.b > params.divDMax) return false;
      if (prob.answer < params.divQMin || prob.answer > params.divQMax) return false;
      if (prob.a !== prob.b * prob.answer) return false;
      break;
    }
  }
  return true;
}
