/**
 * Shared performance ranks, surfaced on the completion modal so every game with
 * a normalised 0–100 score gets a tier reveal (VIS-3) — the same ladder idea
 * Idea Weaver uses live, broadened suite-wide. Tuned for game scores where a
 * solid win lands in the 60–100 band, so the top tiers stay aspirational.
 */

/** Rank tiers as `[minScore (0–100), label]`, ascending. */
export const RANK_TIERS: ReadonlyArray<readonly [number, string]> = [
  [0, "Novice"],
  [20, "Spark"],
  [40, "Thinker"],
  [60, "Sharp"],
  [75, "Brilliant"],
  [88, "Genius"],
  [97, "Mastermind"],
];

export interface Rank {
  label: string;
  /** 0-based position in RANK_TIERS. */
  index: number;
  /** Total number of tiers. */
  total: number;
}

/** The rank for a normalised 0–100 score. */
export function rankForScore(score: number): Rank {
  let index = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (score >= RANK_TIERS[i][0]) index = i;
  }
  return { label: RANK_TIERS[index][1], index, total: RANK_TIERS.length };
}
