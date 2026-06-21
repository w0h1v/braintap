import type { Difficulty } from "@/lib/types";
import { rngFromString } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import {
  generateRounds,
  paramsFor,
  PALETTE,
  type SpotChangePuzzle,
} from "./engine";

const cache = new Map<string, SpotChangePuzzle>();

/**
 * Deterministic daily Spot the Change run for a date and difficulty tier
 * (memoised per date AND tier). The tier selects the grid size, palette size,
 * flash duration and round count via {@link paramsFor}, and seeds the rng with a
 * tier-scoped daily seed so each tier yields an independent run. Omitting the
 * difficulty yields the medium puzzle, preserving the legacy single-puzzle daily.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): SpotChangePuzzle {
  const key = `${dateISO}#${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const params = paramsFor(difficulty);
  const rng = rngFromString(`spotchange:${difficultySeed("spotchange", dateISO, difficulty)}`);
  const palette = PALETTE.slice(0, params.paletteSize);
  const rounds = generateRounds(rng, params);

  const puzzle: SpotChangePuzzle = {
    grid: params.grid,
    palette,
    rounds,
    flashMs: params.flashMs,
    difficulty,
  };
  cache.set(key, puzzle);
  return puzzle;
}
