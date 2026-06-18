/**
 * Tap Teasers engine — pure, deterministic logic for a 5-riddle
 * lateral-thinking multiple-choice quiz. No React, no DOM, no globals.
 */

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

/** The daily puzzle: five distinct riddles. */
export interface TeasersPuzzle {
  riddles: Riddle[];
}

/** Number of riddles served per day. */
export const RIDDLES_PER_DAY = 5;
/** Number of choices per riddle. */
export const CHOICES = 4;

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

/** Validate a daily puzzle: 5 distinct, well-formed riddles. */
export function validateTeasers(p: TeasersPuzzle): boolean {
  if (!p || !Array.isArray(p.riddles)) return false;
  if (p.riddles.length !== RIDDLES_PER_DAY) return false;
  for (const r of p.riddles) {
    if (!validateRiddle(r)) return false;
  }
  // distinct questions within the day
  const qs = p.riddles.map((r) => r.question.trim().toLowerCase());
  if (new Set(qs).size !== RIDDLES_PER_DAY) return false;
  return true;
}

/** Score the run: number correct -> 0..100. */
export function scoreFromCorrect(correct: number, total = RIDDLES_PER_DAY): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

/** End-screen verdict copy for a given correct count. */
export function verdict(correct: number): string {
  if (correct >= 5) return "Flawless lateral thinking.";
  if (correct >= 3) return "Sharp instincts.";
  return "The aha takes practice.";
}
