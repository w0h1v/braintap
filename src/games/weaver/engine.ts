/**
 * Idea Weaver engine — pure, deterministic spelling-bee logic. No React, no DOM,
 * no globals: fully unit-testable. A "hive" is 7 distinct uppercase letters: one
 * required center letter plus 6 outer letters. Players find every dictionary word
 * (>= 4 letters) that uses only hive letters and includes the center.
 */

import { WORD_SET } from "./dictionary";

export const HIVE_SIZE = 7;
export const OUTER_SIZE = 6;
export const MIN_WORD_LEN = 4;
/** A puzzle must surface at least this many findable words to ship. */
export const MIN_WORDS = 15;

export interface WeaverPuzzle {
  /** The single required center letter (uppercase A–Z). */
  center: string;
  /** The 6 outer letters (uppercase A–Z, sorted, no duplicates). */
  outer: string[];
  /** Every findable word for this hive, uppercase, sorted alphabetically. */
  valid: string[];
  /** Sum of scoreOf(word) over `valid` — the maximum attainable score. */
  totalScore: number;
  /** The shortest pangram word (uses all 7 letters). */
  pangram: string;
}

/** Rank thresholds as a fraction of totalScore (ascending). */
export const RANKS: ReadonlyArray<readonly [number, string]> = [
  [0, "Novice"],
  [0.05, "Spark"],
  [0.15, "Thinker"],
  [0.3, "Sharp"],
  [0.5, "Brilliant"],
  [0.7, "Genius"],
  [0.9, "Mastermind"],
];

/** The complete set of hive letters (center + outer). */
export function hiveLetters(p: WeaverPuzzle): Set<string> {
  return new Set([p.center, ...p.outer]);
}

/** True when `word` uses every hive letter at least once (a pangram). */
export function isPangram(word: string, hive: Set<string>): boolean {
  const w = new Set(word);
  for (const l of hive) if (!w.has(l)) return false;
  return true;
}

/** Points for a single found word given the hive. */
export function scoreOf(word: string, hive: Set<string>): number {
  const base = word.length === MIN_WORD_LEN ? 1 : word.length;
  return base + (isPangram(word, hive) ? 7 : 0);
}

/** Total points for a set of found words. */
export function scoreWords(words: Iterable<string>, hive: Set<string>): number {
  let s = 0;
  for (const w of words) s += scoreOf(w, hive);
  return s;
}

/** The rank label for a score relative to a puzzle's max. */
export function rankFor(score: number, totalScore: number): string {
  const pct = totalScore > 0 ? score / totalScore : 0;
  let rank = RANKS[0][1];
  for (const [threshold, label] of RANKS) {
    if (pct >= threshold) rank = label;
  }
  return rank;
}

export type SubmitError =
  | "short"
  | "center"
  | "alien"
  | "duplicate"
  | "unknown";

export type SubmitResult =
  | { ok: true; word: string; points: number; pangram: boolean }
  | { ok: false; reason: SubmitError };

/**
 * Validate and (conceptually) submit `raw` against the puzzle, given the set of
 * already-found words. Pure: returns the outcome without mutating anything.
 */
export function evaluateWord(
  raw: string,
  puzzle: WeaverPuzzle,
  found: ReadonlySet<string>,
): SubmitResult {
  const word = raw.trim().toUpperCase();
  const hive = hiveLetters(puzzle);

  if (word.length < MIN_WORD_LEN) return { ok: false, reason: "short" };
  if (!word.includes(puzzle.center)) return { ok: false, reason: "center" };
  for (const ch of word) {
    if (!hive.has(ch)) return { ok: false, reason: "alien" };
  }
  if (found.has(word)) return { ok: false, reason: "duplicate" };
  // dictionary check uses the puzzle's own list so archive puzzles stay stable
  if (!puzzle.valid.includes(word)) return { ok: false, reason: "unknown" };

  const pangram = isPangram(word, hive);
  return { ok: true, word, points: scoreOf(word, hive), pangram };
}

/**
 * Compute the full set of findable words for a hive from the bundled dictionary.
 * A word qualifies when it is >= 4 letters, contains the center, and uses only
 * hive letters. Returns them sorted alphabetically.
 */
export function findValidWords(center: string, outer: readonly string[]): string[] {
  const hive = new Set([center, ...outer]);
  const out: string[] = [];
  for (const word of WORD_SET) {
    if (word.length < MIN_WORD_LEN) continue;
    if (!word.includes(center)) continue;
    let ok = true;
    for (const ch of word) {
      if (!hive.has(ch)) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(word);
  }
  out.sort();
  return out;
}

/**
 * Pick the best word to reveal as a hint, given the words already found.
 * Deterministic and pure: prefers a "medium-length" unfound word (closest to
 * the midpoint of the puzzle's word-length range) so a hint never just hands
 * over the pangram or a trivial 4-letter filler. Ties break alphabetically.
 * Returns null when every valid word has already been found.
 */
export function getHint(
  puzzle: WeaverPuzzle,
  found: ReadonlySet<string>,
): { word: string; points: number; prefix: string } | null {
  const remaining = puzzle.valid.filter((w) => !found.has(w.toUpperCase()));
  if (remaining.length === 0) return null;

  const lens = remaining.map((w) => w.length);
  const mid = (Math.min(...lens) + Math.max(...lens)) / 2;

  let best = remaining[0];
  let bestDist = Math.abs(best.length - mid);
  for (const w of remaining) {
    const dist = Math.abs(w.length - mid);
    if (dist < bestDist || (dist === bestDist && w < best)) {
      best = w;
      bestDist = dist;
    }
  }

  const hive = hiveLetters(puzzle);
  return {
    word: best,
    points: scoreOf(best, hive),
    prefix: best.slice(0, 2),
  };
}

/**
 * Validate a puzzle is well-formed and playable:
 *  - 7 distinct uppercase letters (1 center + 6 outer),
 *  - the center appears in every valid word and every valid word stays in-hive,
 *  - at least one pangram exists in the valid list,
 *  - the word count clears the minimum,
 *  - totalScore is internally consistent.
 */
export function validateWeaver(p: WeaverPuzzle): boolean {
  if (typeof p.center !== "string" || p.center.length !== 1) return false;
  if (!/^[A-Z]$/.test(p.center)) return false;
  if (!Array.isArray(p.outer) || p.outer.length !== OUTER_SIZE) return false;
  for (const l of p.outer) if (!/^[A-Z]$/.test(l)) return false;

  const hive = hiveLetters(p);
  if (hive.size !== HIVE_SIZE) return false; // no duplicates between center/outer

  if (new Set(p.valid).size !== p.valid.length) return false; // no dup words
  if (p.valid.length < MIN_WORDS) return false;

  let pangrams = 0;
  for (const w of p.valid) {
    if (w.length < MIN_WORD_LEN) return false;
    if (!w.includes(p.center)) return false;
    for (const ch of w) if (!hive.has(ch)) return false;
    if (isPangram(w, hive)) pangrams++;
  }
  if (pangrams < 1) return false;

  if (!p.pangram || !p.valid.includes(p.pangram)) return false;
  if (!isPangram(p.pangram, hive)) return false;

  const calc = scoreWords(p.valid, hive);
  if (calc !== p.totalScore) return false;

  return true;
}
