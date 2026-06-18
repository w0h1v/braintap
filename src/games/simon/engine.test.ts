import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import type { Difficulty } from "@/lib/types";
import {
  PADS,
  MAX_ROUNDS,
  GAP_FLOOR,
  GAP_START,
  GAP_STEP,
  sequenceForRound,
  gapForRound,
  isCorrectTap,
  titleForRounds,
  scoreForRounds,
  validateSimon,
  tierParams,
  TIER_PARAMS,
  SPEEDS,
  SPEED_FACTORS,
  normalizeSpeed,
} from "./engine";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // ~6+ months of daily puzzles
const TIERS: Difficulty[] = ["easy", "medium", "hard"];

/**
 * Simulate a perfect player echoing the sequence up to `target`, verifying the
 * puzzle is solvable: every tap from round 1 through `target` must be correct.
 */
function isSolvableToTarget(p: { sequence: number[] }, target: number): boolean {
  for (let round = 1; round <= target; round++) {
    const seq = sequenceForRound(p, round);
    if (seq.length !== round) return false;
    for (let step = 0; step < seq.length; step++) {
      if (!isCorrectTap(p, round, step, seq[step])) return false;
    }
  }
  return true;
}

describe("simon engine", () => {
  it("a generated puzzle is deterministic per date", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.sequence).toEqual(b.sequence);
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.sequence).not.toEqual(b.sequence);
  });

  it("gapForRound shrinks each round and floors at GAP_FLOOR", () => {
    expect(gapForRound(0)).toBe(GAP_START);
    expect(gapForRound(1)).toBe(GAP_START - GAP_STEP);
    expect(gapForRound(100)).toBe(GAP_FLOOR);
    for (let r = 0; r < 200; r++) {
      expect(gapForRound(r)).toBeGreaterThanOrEqual(GAP_FLOOR);
      expect(gapForRound(r)).toBeLessThanOrEqual(GAP_START);
    }
  });

  it("speed scales the gap without changing the sequence (determinism preserved)", () => {
    const p = getDailyPuzzle(START);
    // The recalled sequence is identical regardless of speed.
    for (const s of SPEEDS) {
      void s; // speed is a UI/timing concern only
    }
    expect(sequenceForRound(p, 8)).toEqual(getDailyPuzzle(START).sequence.slice(0, 8));

    // Default speed ("normal") matches the legacy single-arg behaviour.
    for (let r = 0; r < 50; r++) {
      expect(gapForRound(r)).toBe(gapForRound(r, "normal"));
    }

    // Slow is slower (larger gap), fast is faster (smaller gap) than normal.
    for (let r = 0; r < 50; r++) {
      const normal = gapForRound(r, "normal");
      expect(gapForRound(r, "slow")).toBeGreaterThanOrEqual(normal);
      expect(gapForRound(r, "fast")).toBeLessThanOrEqual(normal);
    }
    expect(SPEED_FACTORS.slow).toBeGreaterThan(SPEED_FACTORS.normal);
    expect(SPEED_FACTORS.fast).toBeLessThan(SPEED_FACTORS.normal);
  });

  it("normalizeSpeed coerces unknown values to normal", () => {
    expect(normalizeSpeed("slow")).toBe("slow");
    expect(normalizeSpeed("fast")).toBe("fast");
    expect(normalizeSpeed("normal")).toBe("normal");
    expect(normalizeSpeed(undefined)).toBe("normal");
    expect(normalizeSpeed("bogus")).toBe("normal");
    expect(normalizeSpeed(null)).toBe("normal");
  });

  it("titleForRounds returns the right tier", () => {
    expect(titleForRounds(0)).toBe("Warm-up done.");
    expect(titleForRounds(3)).toBe("Warm-up done.");
    expect(titleForRounds(4)).toBe("Solid recall.");
    expect(titleForRounds(8)).toBe("Steel-trap memory.");
    expect(titleForRounds(12)).toBe("Photographic.");
    expect(titleForRounds(40)).toBe("Photographic.");
  });

  it("scoreForRounds is 0..100 and monotonic up to the cap", () => {
    expect(scoreForRounds(0)).toBe(0);
    expect(scoreForRounds(14)).toBe(100);
    expect(scoreForRounds(100)).toBe(100);
    let prev = -1;
    for (let r = 0; r <= 14; r++) {
      const s = scoreForRounds(r);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it("isCorrectTap accepts the expected pad and rejects others", () => {
    const p = getDailyPuzzle(START);
    const seq = sequenceForRound(p, 5);
    for (let step = 0; step < seq.length; step++) {
      expect(isCorrectTap(p, 5, step, seq[step])).toBe(true);
      const wrong = (seq[step] + 1) % PADS;
      expect(isCorrectTap(p, 5, step, wrong)).toBe(false);
    }
    // out-of-range steps are never correct
    expect(isCorrectTap(p, 5, -1, seq[0])).toBe(false);
    expect(isCorrectTap(p, 5, 5, 0)).toBe(false);
  });
});

describe("simon daily puzzles are solvable (solvable bank)", () => {
  it(`every daily sequence across ${SAMPLE} days is well-formed and prefix-stable`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      // well-formed: full length, all pad indices in range
      expect(validateSimon(p), `validator failed on ${date}`).toBe(true);
      expect(p.sequence.length, `wrong length on ${date}`).toBe(MAX_ROUNDS);
      for (const v of p.sequence) {
        expect(v, `pad out of range on ${date}`).toBeGreaterThanOrEqual(0);
        expect(v, `pad out of range on ${date}`).toBeLessThan(PADS);
      }

      // prefix-stability: round k sequence is a prefix of round k+1.
      // This is what makes the game "solvable" — a memorised prefix never
      // changes as the sequence grows, so any reachable round is echoable.
      for (let k = 1; k < MAX_ROUNDS; k++) {
        const a = sequenceForRound(p, k);
        const b = sequenceForRound(p, k + 1);
        expect(a.length, `prefix length on ${date} round ${k}`).toBe(k);
        expect(b.slice(0, k), `prefix mismatch on ${date} round ${k}`).toEqual(a);
      }

      date = addDays(date, 1);
    }
  });

  it("uses a healthy spread of all four pads over a long sequence", () => {
    // Not strictly required, but guards against a degenerate generator.
    const p = getDailyPuzzle(START);
    const seen = new Set(p.sequence);
    expect(seen.size).toBe(PADS);
  });
});

describe("simon difficulty tiers", () => {
  it("tier parameters escalate: speed gets faster and target gets longer", () => {
    const easy = tierParams("easy");
    const medium = tierParams("medium");
    const hard = tierParams("hard");

    // Target sequence length to WIN strictly increases with difficulty.
    expect(easy.target).toBeLessThan(medium.target);
    expect(medium.target).toBeLessThan(hard.target);

    // Playback gets faster (smaller gap factor) as difficulty rises.
    expect(easy.speed).toBe("slow");
    expect(medium.speed).toBe("normal");
    expect(hard.speed).toBe("fast");
    expect(SPEED_FACTORS[easy.speed]).toBeGreaterThan(SPEED_FACTORS[medium.speed]);
    expect(SPEED_FACTORS[medium.speed]).toBeGreaterThan(SPEED_FACTORS[hard.speed]);

    // The map and the accessor agree.
    for (const d of TIERS) {
      expect(tierParams(d)).toEqual(TIER_PARAMS[d]);
    }
  });

  it("getDailyPuzzle is deterministic per (date, difficulty) and carries tier params", () => {
    for (const d of TIERS) {
      const a = getDailyPuzzle("2025-03-14", d);
      const b = getDailyPuzzle("2025-03-14", d);
      expect(a.sequence).toEqual(b.sequence);
      expect(a.difficulty).toBe(d);
      expect(a.speed).toBe(TIER_PARAMS[d].speed);
      expect(a.target).toBe(TIER_PARAMS[d].target);
    }
  });

  it("omitting difficulty yields the medium tier (legacy default)", () => {
    const def = getDailyPuzzle("2025-03-14");
    const med = getDailyPuzzle("2025-03-14", "medium");
    expect(def.sequence).toEqual(med.sequence);
    expect(def.difficulty).toBe("medium");
    expect(def.speed).toBe("normal");
    expect(def.target).toBe(TIER_PARAMS.medium.target);
  });

  it("each tier yields an independent daily sequence (tier-scoped seed)", () => {
    // On the same date the three tiers should generally differ from each other,
    // proving the seed is namespaced per tier rather than shared.
    let date = START;
    let easyVsMedium = 0;
    let mediumVsHard = 0;
    const DAYS = 30;
    for (let i = 0; i < DAYS; i++) {
      const e = getDailyPuzzle(date, "easy");
      const m = getDailyPuzzle(date, "medium");
      const h = getDailyPuzzle(date, "hard");
      // Compare a long prefix so a chance short-prefix match doesn't count.
      const pe = e.sequence.slice(0, 16).join("");
      const pm = m.sequence.slice(0, 16).join("");
      const ph = h.sequence.slice(0, 16).join("");
      if (pe !== pm) easyVsMedium++;
      if (pm !== ph) mediumVsHard++;
      date = addDays(date, 1);
    }
    // Overwhelmingly different across a month of dates.
    expect(easyVsMedium).toBeGreaterThan(DAYS - 3);
    expect(mediumVsHard).toBeGreaterThan(DAYS - 3);
  });

  it("every tier is well-formed and solvable to its target across many days", () => {
    for (const d of TIERS) {
      const { target } = tierParams(d);
      let date = START;
      for (let i = 0; i < SAMPLE; i++) {
        const p = getDailyPuzzle(date, d);

        // Well-formed: full-length, in-range pad indices.
        expect(validateSimon(p), `tier ${d} validator failed on ${date}`).toBe(true);
        expect(p.sequence.length, `tier ${d} wrong length on ${date}`).toBe(MAX_ROUNDS);

        // The win target is reachable (target <= MAX_ROUNDS) and a perfect
        // player can echo every round up to it.
        expect(target).toBeLessThanOrEqual(MAX_ROUNDS);
        expect(
          isSolvableToTarget(p, target),
          `tier ${d} not solvable to target ${target} on ${date}`,
        ).toBe(true);

        date = addDays(date, 1);
      }
    }
  });
});
