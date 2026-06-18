import type { Difficulty } from "@/lib/types";
import { rngFromString } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import { buildPuzzle, type ConnectionsPuzzle } from "./engine";

const cache = new Map<string, ConnectionsPuzzle>();

/**
 * Deterministic daily Neural Connections puzzle for a date + difficulty tier
 * (memoised per `${dateISO}:${difficulty}`). Each tier draws a distinct daily
 * board via a tier-specific seed, and applies that tier's leniency rules.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): ConnectionsPuzzle {
  const cacheKey = `${dateISO}:${difficulty}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const seed = difficultySeed("connections", dateISO, difficulty);
  const rng = rngFromString(`connections:${seed}`);
  const puzzle = buildPuzzle(rng, difficulty);
  cache.set(cacheKey, puzzle);
  return puzzle;
}
