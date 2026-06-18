import type { Difficulty } from "@/lib/types";
import { rngFromString } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import {
  generatePuzzle,
  DIFFICULTY_CONFIG,
  type PipsPuzzle,
  type PipsDifficulty,
} from "./engine";

/** Memoised per (date, difficulty) — never key on date alone. */
const cache = new Map<string, PipsPuzzle>();

/**
 * Deterministic daily Pips puzzle for a date and difficulty tier. The tier
 * selects the board shape (easy = 4 cols/2 dominoes, medium = the historical
 * 4-domino 2×2 board, hard = 6 cols/6 dominoes) and seeds the procedural
 * generator via {@link difficultySeed} so each (game, date, tier) yields its
 * own independent puzzle. Omitting the difficulty yields the medium board.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): PipsPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cfg = DIFFICULTY_CONFIG[difficulty as PipsDifficulty];
  const rng = rngFromString(`pips:${difficultySeed("pips", dateISO, difficulty)}`);
  const puzzle = generatePuzzle(rng, cfg);
  cache.set(key, puzzle);
  return puzzle;
}
