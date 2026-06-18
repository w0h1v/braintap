import type { Difficulty } from "@/lib/types";
import { bankIndex } from "@/lib/daily";
import { PANGRAMS } from "./pangrams";
import {
  findValidWords,
  scoreWords,
  isPangram,
  hiveLetters,
  goalForWords,
  type WeaverPuzzle,
} from "./engine";

const cache = new Map<string, WeaverPuzzle>();

/**
 * Build a hive from a pangram word: its 7 distinct letters become the hive, and
 * the center is the letter that yields the richest findable-word list (ties
 * broken alphabetically so the choice is deterministic). The tier sets the
 * word-count goal needed to win — easy asks for a shallow dip, hard a deep clear.
 */
function buildPuzzle(pangram: string, difficulty: Difficulty): WeaverPuzzle {
  const letters = [...new Set(pangram)].sort();

  let best: WeaverPuzzle | null = null;
  for (const center of letters) {
    const outer = letters.filter((l) => l !== center);
    const valid = findValidWords(center, outer);
    if (!valid.length) continue;
    if (!best || valid.length > best.valid.length) {
      const hive = new Set(letters);
      const pangrams = valid.filter((w) => isPangram(w, hive));
      if (!pangrams.length) continue;
      pangrams.sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
      best = {
        center,
        outer,
        valid,
        totalScore: scoreWords(valid, hive),
        pangram: pangrams[0],
        difficulty,
        goal: goalForWords(valid.length, difficulty),
      };
    }
  }

  // Every bank pangram is validated to produce a usable hive; fall back defensively.
  if (!best) {
    const center = letters[0];
    const outer = letters.slice(1);
    const valid = findValidWords(center, outer);
    const hive = hiveLetters({ center, outer } as WeaverPuzzle);
    best = {
      center,
      outer,
      valid,
      totalScore: scoreWords(valid, hive),
      pangram: pangram.toUpperCase(),
      difficulty,
      goal: goalForWords(valid.length, difficulty),
    };
  }

  return best;
}

/**
 * Deterministic daily puzzle for a date and difficulty tier (memoised per
 * date AND tier). Each tier draws a DIFFERENT pangram from the bank via a
 * tier-scoped bank index, then scales its win goal to the tier: easy needs a
 * low fraction of the findable words, medium more, hard the most. Omitting the
 * difficulty yields the medium tier.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): WeaverPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // A tier-scoped bank key walks each tier through the pangram bank
  // independently, so the three tiers serve different hives on the same day.
  const index = bankIndex(`weaver#${difficulty}`, PANGRAMS.length, dateISO);
  const puzzle = buildPuzzle(PANGRAMS[index], difficulty);
  cache.set(key, puzzle);
  return puzzle;
}
