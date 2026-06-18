/**
 * Synapse Wordle ("Brainle") engine — pure, deterministic Wordle logic. No
 * React, no DOM, no globals: fully unit-testable.
 *
 * The player guesses a 5-letter brain/cognition-themed answer in up to 6 tries.
 * Each guess is scored letter-by-letter as correct / present / absent, with the
 * standard duplicate-letter handling (a guessed letter only counts "present" as
 * many times as it remains in the answer after exact matches are removed).
 */

import { VALID, ANSWERS, HINTS, GENERIC_HINT } from "./words";

export const WORD_LEN = 5;
export const MAX_ROWS = 6;

/** Feedback verdict for a single tile. */
export type Verdict = "correct" | "present" | "absent";

export interface BrainlePuzzle {
  /** The 5-letter uppercase answer for the day. */
  answer: string;
  /** The themed hint for this answer (falls back to a generic one). */
  hint: string;
  /** Index into the answer bank (for analytics / debugging). */
  index: number;
}

/** Is a string a well-formed candidate (5 uppercase A–Z letters)? */
export function isWellFormed(word: string): boolean {
  return typeof word === "string" && word.length === WORD_LEN && /^[A-Z]+$/.test(word);
}

/** Is `word` an accepted guess (well-formed AND in the dictionary)? */
export function isValidGuess(word: string): boolean {
  return isWellFormed(word) && VALID.has(word);
}

/** Look up the hint for an answer word. */
export function hintFor(answer: string): string {
  return HINTS[answer] ?? GENERIC_HINT;
}

/**
 * Score a guess against the answer, returning a 5-length verdict array.
 *
 * Two-pass algorithm with a letter pool so duplicate letters are handled
 * correctly: exact matches are consumed first, then remaining occurrences are
 * spent on "present" tiles left-to-right.
 */
export function evaluateGuess(guess: string, answer: string): Verdict[] {
  const res: Verdict[] = new Array(WORD_LEN).fill("absent");
  const pool: Record<string, number> = {};

  for (let i = 0; i < WORD_LEN; i++) {
    const a = answer[i];
    pool[a] = (pool[a] ?? 0) + 1;
  }

  // Pass 1: exact position matches.
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === answer[i]) {
      res[i] = "correct";
      pool[guess[i]]--;
    }
  }

  // Pass 2: present-but-misplaced, limited by remaining pool count.
  for (let i = 0; i < WORD_LEN; i++) {
    if (res[i] === "correct") continue;
    const g = guess[i];
    if ((pool[g] ?? 0) > 0) {
      res[i] = "present";
      pool[g]--;
    }
  }

  return res;
}

/** True when the guess exactly equals the answer (all-correct). */
export function isWin(verdicts: Verdict[]): boolean {
  return verdicts.length === WORD_LEN && verdicts.every((v) => v === "correct");
}

/** Merge a row's verdicts into the keyboard colour map (correct beats present beats absent). */
export function mergeKeyStates(
  keys: Record<string, Verdict>,
  guess: string,
  verdicts: Verdict[],
): Record<string, Verdict> {
  const rank: Record<Verdict, number> = { absent: 0, present: 1, correct: 2 };
  const next = { ...keys };
  for (let i = 0; i < WORD_LEN; i++) {
    const letter = guess[i];
    const v = verdicts[i];
    const cur = next[letter];
    if (cur === undefined || rank[v] > rank[cur]) next[letter] = v;
  }
  return next;
}

/** One verdict row → its emoji line (🟦 correct, 🟧 present, ⬛ absent). */
export function rowToEmoji(verdicts: Verdict[]): string {
  return verdicts
    .map((v) => (v === "correct" ? "🟦" : v === "present" ? "🟧" : "⬛"))
    .join("");
}

/** Build the shareable result string in the BrainTap house style. */
export function buildShareText(
  won: boolean,
  guesses: string[],
  answer: string,
): string {
  const count = won ? `${guesses.length}/${MAX_ROWS}` : `X/${MAX_ROWS}`;
  const grid = guesses
    .map((g) => rowToEmoji(evaluateGuess(g, answer)))
    .join("\n");
  return `BrainTap · Synapse Wordle\n${count}\n\n${grid}\n\nbraintap.app`;
}

/**
 * Score 0–100 for the cross-game leaderboard. Win in fewer guesses scores
 * higher; a loss yields a small participation score.
 */
export function computeScore(won: boolean, guessCount: number): number {
  if (!won) return 20;
  // 1 guess → 100, 2 → 92, 3 → 84, ... 6 → 60.
  return Math.max(60, 100 - (guessCount - 1) * 8);
}

/**
 * Validate a daily puzzle: 5 uppercase letters, present in the valid-guess set,
 * and equipped with a hint. (Required by the GameModule contract.)
 */
export function validateBrainle(p: BrainlePuzzle): boolean {
  if (!p || typeof p.answer !== "string") return false;
  if (!isWellFormed(p.answer)) return false;
  if (!VALID.has(p.answer)) return false;
  if (typeof p.hint !== "string" || p.hint.length === 0) return false;
  return true;
}

// Re-export bank data for tests/components.
export { VALID, ANSWERS, HINTS };
