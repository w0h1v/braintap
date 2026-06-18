import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import { buildPuzzle, type ConnectionsPuzzle } from "./engine";

const cache = new Map<string, ConnectionsPuzzle>();

/** Deterministic daily Neural Connections puzzle for a date (memoised). */
export function getDailyPuzzle(dateISO: string): ConnectionsPuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;
  const rng = rngFromString(`connections:${dailySeed("connections", dateISO)}`);
  const puzzle = buildPuzzle(rng);
  cache.set(dateISO, puzzle);
  return puzzle;
}
