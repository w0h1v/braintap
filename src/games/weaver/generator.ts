import { bankIndex } from "@/lib/daily";
import { PANGRAMS } from "./pangrams";
import {
  findValidWords,
  scoreWords,
  isPangram,
  hiveLetters,
  type WeaverPuzzle,
} from "./engine";

const cache = new Map<string, WeaverPuzzle>();

/**
 * Build a hive from a pangram word: its 7 distinct letters become the hive, and
 * the center is the letter that yields the richest findable-word list (ties
 * broken alphabetically so the choice is deterministic).
 */
function buildPuzzle(pangram: string): WeaverPuzzle {
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
    };
  }

  return best;
}

/** Deterministic daily puzzle for a date (memoised per date). */
export function getDailyPuzzle(dateISO: string): WeaverPuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;

  // bankIndex walks consecutive days through the pangram bank without repeats.
  const index = bankIndex("weaver", PANGRAMS.length, dateISO);
  const puzzle = buildPuzzle(PANGRAMS[index]);
  cache.set(dateISO, puzzle);
  return puzzle;
}
