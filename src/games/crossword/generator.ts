import { rngFromString } from "@/lib/rng";
import { bankIndex } from "@/lib/daily";
import { difficultySeed } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";
import { BANK } from "./bank";
import { buildPuzzle, type CrosswordEntry, type CrosswordPuzzle } from "./engine";

const cache = new Map<string, CrosswordPuzzle>();

/** The tier sub-bank for a difficulty. */
export function poolFor(difficulty: Difficulty): CrosswordEntry[] {
  return BANK.filter((e) => e.difficulty === difficulty);
}

/**
 * Deterministic daily puzzle for a date + tier (memoised per date:difficulty).
 *
 * Each tier draws from its own difficulty-tagged sub-bank via a tier-scoped
 * `bankIndex`, so consecutive days walk the bank without repeats and the three
 * tiers show different puzzles on any given day. No runtime grid construction:
 * the chosen bank entry is compiled by the pure `buildPuzzle`.
 *
 * The rng below is derived from the daily/difficulty seed for parity with the
 * other games (and available for cosmetic tie-breaks); selection itself is
 * fully deterministic through `bankIndex`.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): CrosswordPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Derived for parity / future cosmetic use; selection is via bankIndex.
  void rngFromString(`crossword:${difficultySeed("crossword", dateISO, difficulty)}`);

  const pool = poolFor(difficulty);
  if (pool.length === 0) {
    throw new Error(`crossword: empty sub-bank for tier "${difficulty}"`);
  }
  const start = bankIndex(`crossword#${difficulty}`, pool.length, dateISO);
  const entry = pool[start];
  const puzzle = buildPuzzle(entry, difficulty);
  cache.set(key, puzzle);
  return puzzle;
}
