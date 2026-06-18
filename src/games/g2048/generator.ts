import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import {
  makeStart,
  makeSpawn,
  SPAWN_SCRIPT_LENGTH,
  type G2048Puzzle,
} from "./engine";

const cache = new Map<string, G2048Puzzle>();

/** Deterministic daily 2048 puzzle for a date (memoised per date). */
export function getDailyPuzzle(dateISO: string): G2048Puzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;

  const rng = rngFromString(`g2048:${dailySeed("g2048", dateISO)}`);
  const start = makeStart(rng);
  const spawns = Array.from({ length: SPAWN_SCRIPT_LENGTH }, () => makeSpawn(rng));

  const puzzle: G2048Puzzle = { start, spawns };
  cache.set(dateISO, puzzle);
  return puzzle;
}
