import type { Difficulty } from "@/lib/types";
import { rngFromString } from "@/lib/rng";
import { dailySeed, bankIndex } from "@/lib/daily";
import { RIDDLE_BANK } from "./bank";
import { RIDDLES_PER_DAY, riddleCountFor, type TeasersPuzzle } from "./engine";

const cache = new Map<string, TeasersPuzzle>();

/**
 * Deterministic daily puzzle for a date AND difficulty tier (memoised per
 * date+tier).
 *
 * Each tier serves a DIFFERENT set of riddles and a different count:
 *   easy = 3 riddles, medium = 5, hard = 7.
 *
 * We anchor on a tier-scoped `bankIndex` ("teasers#<tier>") so each tier walks
 * the bank from its own offset — guaranteeing distinct daily entries across
 * tiers — then pick a contiguous, non-repeating window of `count` riddles and
 * lightly shuffle the selection with a tier-scoped per-date seed. The same
 * (date, tier) always yields the same riddles for every player.
 */
export function getDailyPuzzle(
  dateISO: string,
  difficulty: Difficulty = "medium",
): TeasersPuzzle {
  const key = `${dateISO}:${difficulty}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const count = riddleCountFor(difficulty);
  const rng = rngFromString(
    `teasers#${difficulty}:${dailySeed(`teasers#${difficulty}`, dateISO)}`,
  );
  const len = RIDDLE_BANK.length;
  // Tier-scoped anchor: each tier indexes the bank from its own key so the
  // daily windows for easy/medium/hard land on different riddles.
  const anchor = bankIndex(`teasers#${difficulty}`, len, dateISO);

  // Build a contiguous, non-repeating window of `count` entries.
  const picked: number[] = [];
  for (let step = 0; picked.length < count && step < len; step++) {
    const i = (anchor + step) % len;
    if (!picked.includes(i)) picked.push(i);
  }

  // Shuffle the order so it isn't always the same daily sequence.
  const riddles = rng.shuffle(picked).map((i) => RIDDLE_BANK[i]);

  const puzzle: TeasersPuzzle = { riddles, difficulty };
  cache.set(key, puzzle);
  return puzzle;
}

// Re-export so legacy callers that relied on the default count keep working.
export { RIDDLES_PER_DAY };
