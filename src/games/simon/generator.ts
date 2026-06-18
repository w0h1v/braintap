import type { Difficulty } from "@/lib/types";
import { rngFromString } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import { generateSequence, tierParams, type SimonPuzzle } from "./engine";

const cache = new Map<string, SimonPuzzle>();

/**
 * Deterministic daily Simon puzzle for a date AND difficulty tier (memoised per
 * date+difficulty). The sequence is seeded via difficultySeed so each tier gets
 * its own independent daily sequence; the tier also selects the playback speed
 * and the target length the player must recall to win. Omitting the difficulty
 * yields the medium puzzle.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): SimonPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rng = rngFromString(`simon:${difficultySeed("simon", dateISO, difficulty)}`);
  const { speed, target } = tierParams(difficulty);
  const puzzle: SimonPuzzle = {
    sequence: generateSequence(rng),
    difficulty,
    speed,
    target,
  };
  cache.set(key, puzzle);
  return puzzle;
}
