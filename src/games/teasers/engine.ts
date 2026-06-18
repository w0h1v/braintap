/**
 * Tap Teasers engine — pure, deterministic logic for a lateral-thinking
 * multiple-choice riddle quiz. No React, no DOM, no globals.
 *
 * Difficulty controls how many riddles are served per day (and, via the
 * generator, which slice of the bank they come from):
 *   easy = 3, medium = 5, hard = 7.
 */

import type { Difficulty } from "@/lib/types";

/** A single lateral-thinking riddle. */
export interface Riddle {
  /** The riddle prompt. */
  question: string;
  /** Exactly four answer choices. */
  choices: [string, string, string, string];
  /** Index (0–3) of the correct choice. */
  answerIndex: number;
  /** The "aha" — explains why the answer is correct. */
  aha: string;
}

/** The daily puzzle: a tier-sized set of distinct riddles. */
export interface TeasersPuzzle {
  riddles: Riddle[];
  /** The tier this puzzle was generated for (optional for legacy shapes). */
  difficulty?: Difficulty;
}

/** Number of riddles served per day for the default (medium) tier. */
export const RIDDLES_PER_DAY = 5;
/** Number of choices per riddle. */
export const CHOICES = 4;

/** Riddles served per day by difficulty tier: easy=3, medium=5, hard=7. */
export const RIDDLE_COUNT_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 3,
  medium: 5,
  hard: 7,
};

/** How many riddles a tier serves (defaults to the medium count). */
export function riddleCountFor(difficulty: Difficulty = "medium"): number {
  return RIDDLE_COUNT_BY_DIFFICULTY[difficulty] ?? RIDDLES_PER_DAY;
}

/** True when a single riddle is structurally well-formed. */
export function validateRiddle(r: Riddle): boolean {
  if (!r || typeof r !== "object") return false;
  if (typeof r.question !== "string" || r.question.trim().length === 0) return false;
  if (!Array.isArray(r.choices) || r.choices.length !== CHOICES) return false;
  for (const c of r.choices) {
    if (typeof c !== "string" || c.trim().length === 0) return false;
  }
  // four unique choices
  const lowered = r.choices.map((c) => c.trim().toLowerCase());
  if (new Set(lowered).size !== CHOICES) return false;
  // valid answer index
  if (
    typeof r.answerIndex !== "number" ||
    !Number.isInteger(r.answerIndex) ||
    r.answerIndex < 0 ||
    r.answerIndex >= CHOICES
  ) {
    return false;
  }
  // non-empty aha
  if (typeof r.aha !== "string" || r.aha.trim().length === 0) return false;
  return true;
}

/** The set of riddle counts any valid tier may produce. */
const VALID_COUNTS = new Set<number>(Object.values(RIDDLE_COUNT_BY_DIFFICULTY));

/**
 * Validate a daily puzzle: a tier-sized set of distinct, well-formed riddles.
 *
 * When the puzzle carries a `difficulty`, the count must match that tier
 * exactly; otherwise any recognised tier count (3/5/7) is accepted so legacy
 * (count-only) puzzles still validate.
 */
export function validateTeasers(p: TeasersPuzzle): boolean {
  if (!p || !Array.isArray(p.riddles)) return false;
  const n = p.riddles.length;
  if (p.difficulty) {
    if (n !== riddleCountFor(p.difficulty)) return false;
  } else if (!VALID_COUNTS.has(n)) {
    return false;
  }
  for (const r of p.riddles) {
    if (!validateRiddle(r)) return false;
  }
  // distinct questions within the day
  const qs = p.riddles.map((r) => r.question.trim().toLowerCase());
  if (new Set(qs).size !== n) return false;
  return true;
}

/** Score the run: number correct -> 0..100. */
export function scoreFromCorrect(correct: number, total = RIDDLES_PER_DAY): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

/**
 * End-screen verdict copy for a given correct count out of `total`.
 *
 * Thresholds scale with the tier size: a perfect run is "flawless", >=60% is
 * "sharp", below that needs practice. The default `total` keeps the historical
 * 5-riddle behaviour for legacy callers.
 */
export function verdict(correct: number, total: number = RIDDLES_PER_DAY): string {
  if (total > 0 && correct >= total) return "Flawless lateral thinking.";
  if (total > 0 && correct / total >= 0.6) return "Sharp instincts.";
  return "The aha takes practice.";
}
