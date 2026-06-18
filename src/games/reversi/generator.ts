import { rngFromString } from "@/lib/rng";
import { dailySeed } from "@/lib/daily";
import { YOU, AI, type ReversiPuzzle, type Player } from "./engine";

const cache = new Map<string, ReversiPuzzle>();

/**
 * Deterministic daily Reversi config (memoised per date). The board itself is
 * always the standard opening; the seed selects who moves first and how
 * aggressive the AI plays, so each day feels a little different.
 */
export function getDailyPuzzle(dateISO: string): ReversiPuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;

  const rng = rngFromString(`reversi:${dailySeed("reversi", dateISO)}`);

  // The human always plays the cyan "YOU" discs; the seed decides who opens.
  const playerColor: Player = YOU;
  const firstTurn: Player = rng.chance(0.5) ? YOU : AI;
  // Aggressiveness 0.2..0.9 — keeps the AI competent but varied day to day.
  const aggressiveness = Math.round(rng.float(0.2, 0.9) * 100) / 100;

  const puzzle: ReversiPuzzle = { playerColor, firstTurn, aggressiveness };
  cache.set(dateISO, puzzle);
  return puzzle;
}
