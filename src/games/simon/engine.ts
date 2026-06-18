/**
 * Sequence Echo (Simon) engine — pure, deterministic logic for a growing
 * colour/tone memory game. No React, no DOM, no globals: fully unit-testable.
 *
 * The game uses 4 pads (indices 0–3). Each day has a single deterministic
 * master sequence; round `k` reveals the first `k` pads of it. Because every
 * round is a prefix of the next, the sequence is "prefix-stable": the colours
 * a player memorises never change underneath them as the game grows.
 */

import type { Rng } from "@/lib/rng";

/** Number of pads / distinct colours & tones. */
export const PADS = 4;

/**
 * Length of the master daily sequence. The game is endless in practice —
 * reaching round 64 (recalling 64 steps) is far beyond human working memory,
 * so this is an effectively-unreachable safety cap, not a win condition.
 */
export const MAX_ROUNDS = 64;

/** Playback timing constants (ported 1:1 from the prototype). */
export const GAP_START = 620; // ms between tone onsets at round 1
export const GAP_STEP = 22; // ms shaved off the gap each round
export const GAP_FLOOR = 280; // minimum gap, no matter how high the round

/** Pad colours: [bright, dim]. Indices map to pads 0–3. */
export const PAD_COLORS: ReadonlyArray<readonly [string, string]> = [
  ["#00e5ff", "rgba(0,229,255,.18)"], // 0 cyan
  ["#ff2bd6", "rgba(255,43,214,.18)"], // 1 magenta
  ["#9b8cff", "rgba(155,140,255,.18)"], // 2 purple
  ["#7CF5C4", "rgba(124,245,196,.18)"], // 3 green
] as const;

/** Human-readable colour names (for ARIA labels). */
export const PAD_NAMES: ReadonlyArray<string> = ["cyan", "magenta", "purple", "green"] as const;

/** Tone frequencies in Hz, one per pad (E4, G#4, B4, D5). */
export const PAD_TONES: ReadonlyArray<number> = [329.63, 415.3, 493.88, 587.33] as const;

export interface SimonPuzzle {
  /** The master sequence of pad indices (0–3), length MAX_ROUNDS. */
  sequence: number[];
}

/**
 * Build the master daily sequence from a seeded RNG. The same seed always
 * produces the same sequence, and any prefix is itself a valid sub-sequence.
 */
export function generateSequence(rng: Rng): number[] {
  const seq: number[] = [];
  for (let i = 0; i < MAX_ROUNDS; i++) seq.push(rng.int(0, PADS - 1));
  return seq;
}

/**
 * The sequence the player must echo at a given round. Round `k` (1-based)
 * returns the first `k` pads. Clamped to [0, MAX_ROUNDS].
 */
export function sequenceForRound(puzzle: SimonPuzzle, round: number): number[] {
  const n = Math.max(0, Math.min(round, MAX_ROUNDS));
  return puzzle.sequence.slice(0, n);
}

/**
 * Difficulty / speed levels. These ONLY scale playback timing — they never
 * touch the deterministic daily sequence, so a player's recall count stays
 * comparable in kind (steps recalled) across speeds.
 */
export type SimonSpeed = "slow" | "normal" | "fast";

export const SPEEDS: ReadonlyArray<SimonSpeed> = ["slow", "normal", "fast"] as const;

/** Human-readable labels for the speed selector. */
export const SPEED_LABELS: Record<SimonSpeed, string> = {
  slow: "Slow",
  normal: "Normal",
  fast: "Fast",
};

/** Playback-gap multipliers per speed. >1 is slower, <1 is faster. */
export const SPEED_FACTORS: Record<SimonSpeed, number> = {
  slow: 1.35,
  normal: 1,
  fast: 0.7,
};

/** Normalise an arbitrary value to a valid speed, defaulting to "normal". */
export function normalizeSpeed(value: unknown): SimonSpeed {
  return value === "slow" || value === "fast" ? value : "normal";
}

/**
 * Playback gap (ms between tone onsets) for a given round and speed. The base
 * curve shrinks each round (floored at GAP_FLOOR); the speed factor then scales
 * the whole curve. Speed never alters the sequence, only its tempo.
 */
export function gapForRound(round: number, speed: SimonSpeed = "normal"): number {
  const base = Math.max(GAP_FLOOR, GAP_START - round * GAP_STEP);
  return Math.round(base * SPEED_FACTORS[speed]);
}

/** Contextual modal title based on how many steps the player recalled. */
export function titleForRounds(rounds: number): string {
  if (rounds >= 12) return "Photographic.";
  if (rounds >= 8) return "Steel-trap memory.";
  if (rounds >= 4) return "Solid recall.";
  return "Warm-up done.";
}

/**
 * Map a recalled-step count to a normalised 0–100 score for cross-game
 * leaderboards. Recalling ~14 steps (well past the classic "7 ± 2" span)
 * tops out at 100; the curve front-loads reward for early progress.
 */
export function scoreForRounds(rounds: number): number {
  if (rounds <= 0) return 0;
  // 14 steps ⇒ 100. Diminishing returns are unnecessary; linear+cap is fair.
  return Math.max(0, Math.min(100, Math.round((rounds / 14) * 100)));
}

/**
 * Validate that a tap is correct at the given step of the round's sequence.
 * Returns true when `pad` equals the expected pad at position `step`.
 */
export function isCorrectTap(
  puzzle: SimonPuzzle,
  round: number,
  step: number,
  pad: number,
): boolean {
  const seq = sequenceForRound(puzzle, round);
  if (step < 0 || step >= seq.length) return false;
  return seq[step] === pad;
}

/** Validate that a puzzle is well-formed: full length, all pads in range. */
export function validateSimon(p: SimonPuzzle): boolean {
  if (!p || !Array.isArray(p.sequence)) return false;
  if (p.sequence.length !== MAX_ROUNDS) return false;
  return p.sequence.every((v) => Number.isInteger(v) && v >= 0 && v < PADS);
}
