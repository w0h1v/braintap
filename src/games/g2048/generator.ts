import { rngFromString } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";
import {
  makeStart,
  makeSpawn,
  SPAWN_SCRIPT_LENGTH,
  TARGET_BY_DIFFICULTY,
  type G2048Puzzle,
} from "./engine";

const cache = new Map<string, G2048Puzzle>();

/**
 * Deterministic daily 2048 puzzle for a date + tier (memoised per
 * date:difficulty). The tier sets the win `target` (easy=256, medium=512,
 * hard=1024) AND seeds the initial spawns via difficultySeed so each tier opens
 * with a different board.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): G2048Puzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rng = rngFromString(`g2048:${difficultySeed("g2048", dateISO, difficulty)}`);
  const start = makeStart(rng);
  const spawns = Array.from({ length: SPAWN_SCRIPT_LENGTH }, () => makeSpawn(rng));

  const puzzle: G2048Puzzle = {
    start,
    spawns,
    target: TARGET_BY_DIFFICULTY[difficulty],
  };
  cache.set(key, puzzle);
  return puzzle;
}
