import type { Difficulty } from "@/lib/types";
import { rngFromString } from "@/lib/rng";
import { difficultySeed } from "@/lib/difficulty";
import { generateRounds, paramsFor, type VaultPuzzle } from "./engine";

const cache = new Map<string, VaultPuzzle>();

/**
 * Deterministic daily Memory Vault sequence for a date and difficulty tier
 * (memoised per date AND tier). The tier selects the grid size, starting
 * pattern length and round count via {@link paramsFor}, and seeds the rng with
 * a tier-scoped daily seed so each tier yields an independent sequence.
 * Omitting the difficulty yields the medium vault, preserving the legacy daily.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): VaultPuzzle {
  const key = `${dateISO}#${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = rngFromString(`vault:${difficultySeed("vault", dateISO, difficulty)}`);
  const puzzle = generateRounds(rng, paramsFor(difficulty));
  cache.set(key, puzzle);
  return puzzle;
}
