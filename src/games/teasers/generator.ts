import { rngFromString } from "@/lib/rng";
import { dailySeed, bankIndex } from "@/lib/daily";
import { RIDDLE_BANK } from "./bank";
import { RIDDLES_PER_DAY, type TeasersPuzzle } from "./engine";

const cache = new Map<string, TeasersPuzzle>();

/**
 * Deterministic daily puzzle for a date (memoised per date).
 *
 * We anchor on `bankIndex` so consecutive days walk the bank in order, then
 * pick five *distinct* riddles starting at that anchor and lightly shuffle the
 * selection with the per-date seed for variety. The same date always yields
 * the same five riddles for every player.
 */
export function getDailyPuzzle(dateISO: string): TeasersPuzzle {
  const hit = cache.get(dateISO);
  if (hit) return hit;

  const rng = rngFromString(`teasers:${dailySeed("teasers", dateISO)}`);
  const len = RIDDLE_BANK.length;
  const anchor = bankIndex("teasers", len, dateISO);

  // Build a contiguous, non-repeating window of RIDDLES_PER_DAY entries.
  const picked: number[] = [];
  for (let step = 0; picked.length < RIDDLES_PER_DAY && step < len; step++) {
    const i = (anchor + step) % len;
    if (!picked.includes(i)) picked.push(i);
  }

  // Shuffle the order so it isn't always the same daily sequence.
  const riddles = rng.shuffle(picked).map((i) => RIDDLE_BANK[i]);

  const puzzle: TeasersPuzzle = { riddles };
  cache.set(dateISO, puzzle);
  return puzzle;
}
