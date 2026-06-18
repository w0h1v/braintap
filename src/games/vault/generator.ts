import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import { generateRounds, type VaultPuzzle } from "./engine";

const cache = new Map<string, VaultPuzzle>();

/** Deterministic daily Memory Vault sequence for a date (memoised per date). */
export function getDailyPuzzle(dateISO: string): VaultPuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;
  const rng = rngFromString(`vault:${dailySeed("vault", dateISO)}`);
  const puzzle = generateRounds(rng);
  cache.set(dateISO, puzzle);
  return puzzle;
}
