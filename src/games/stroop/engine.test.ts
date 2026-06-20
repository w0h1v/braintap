import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import type { Difficulty } from "@/lib/types";
import {
  CANONICAL_COLORS,
  TRIAL_COUNT,
  PARAMS_BY_DIFFICULTY,
  paramsFor,
  scoreToNormalised,
  starsFor,
  isWin,
  tierTitle,
  shareGrid,
  buildShareText,
  validateStroop,
  type StroopPuzzle,
} from "./engine";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // > 180 days of daily puzzles
const TIERS: Difficulty[] = ["easy", "medium", "hard"];

describe("stroop engine", () => {
  it("getDailyPuzzle is deterministic per (date, difficulty)", () => {
    for (const tier of TIERS) {
      const a = getDailyPuzzle("2025-03-14", tier);
      const b = getDailyPuzzle("2025-03-14", tier);
      expect(a.trials).toEqual(b.trials);
      expect(a.seed).toBe(b.seed);
      expect(a.difficulty).toBe(tier);
    }
    // omitting the difficulty yields the medium tier
    const def = getDailyPuzzle("2025-03-14");
    const med = getDailyPuzzle("2025-03-14", "medium");
    expect(def.trials).toEqual(med.trials);
    expect(def.difficulty).toBe("medium");
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.trials).not.toEqual(b.trials);
  });

  it("each tier yields a different daily puzzle from the others", () => {
    const easy = getDailyPuzzle("2025-03-14", "easy");
    const med = getDailyPuzzle("2025-03-14", "medium");
    const hard = getDailyPuzzle("2025-03-14", "hard");
    expect(easy.trials).not.toEqual(med.trials);
    expect(med.trials).not.toEqual(hard.trials);
    expect(easy.trials).not.toEqual(hard.trials);
  });

  it("tier parameters escalate as intended", () => {
    const e = PARAMS_BY_DIFFICULTY.easy;
    const m = PARAMS_BY_DIFFICULTY.medium;
    const h = PARAMS_BY_DIFFICULTY.hard;
    // colour set size grows: 4 < 6 < 7
    expect(e.colorSet.length).toBe(4);
    expect(m.colorSet.length).toBe(6);
    expect(h.colorSet.length).toBe(7);
    expect(e.colorSet.length).toBeLessThan(m.colorSet.length);
    expect(m.colorSet.length).toBeLessThan(h.colorSet.length);
    // shrinking clock
    expect(e.durationSec).toBeGreaterThan(m.durationSec);
    expect(m.durationSec).toBeGreaterThan(h.durationSec);
    // fewer congruent (easier) trials as tiers rise
    expect(e.congruentRate).toBeGreaterThan(m.congruentRate);
    expect(m.congruentRate).toBeGreaterThan(h.congruentRate);
    // stiffer goal
    expect(e.goal).toBeLessThan(m.goal);
    expect(m.goal).toBeLessThan(h.goal);
    // harsher wrong-tap penalty
    expect(e.penaltyMs).toBeLessThan(m.penaltyMs);
    expect(m.penaltyMs).toBeLessThan(h.penaltyMs);
    // every colour set indexes the canonical palette uniquely
    for (const p of [e, m, h]) {
      expect(new Set(p.colorSet).size).toBe(p.colorSet.length);
      expect(p.colorSet.every((c) => c >= 0 && c < CANONICAL_COLORS.length)).toBe(true);
    }
  });

  it("isWin gates on the tier goal", () => {
    expect(isWin(11, PARAMS_BY_DIFFICULTY.easy)).toBe(false);
    expect(isWin(12, PARAMS_BY_DIFFICULTY.easy)).toBe(true);
    expect(isWin(17, PARAMS_BY_DIFFICULTY.medium)).toBe(false);
    expect(isWin(18, PARAMS_BY_DIFFICULTY.medium)).toBe(true);
    expect(isWin(23, PARAMS_BY_DIFFICULTY.hard)).toBe(false);
    expect(isWin(24, PARAMS_BY_DIFFICULTY.hard)).toBe(true);
  });

  it("scoring + presentation helpers behave sensibly", () => {
    expect(scoreToNormalised(0)).toBe(0);
    expect(scoreToNormalised(24)).toBe(100);
    expect(scoreToNormalised(48)).toBe(100); // capped
    expect(scoreToNormalised(12)).toBe(50);

    // stars scale to the tier goal
    expect(starsFor(0, PARAMS_BY_DIFFICULTY.easy)).toBe(1);
    expect(starsFor(8, PARAMS_BY_DIFFICULTY.easy)).toBe(2); // ≥ ceil(12*2/3)=8
    expect(starsFor(12, PARAMS_BY_DIFFICULTY.easy)).toBe(3);

    expect(tierTitle(0, PARAMS_BY_DIFFICULTY.easy)).toBe("Warm-up done.");
    expect(tierTitle(12, PARAMS_BY_DIFFICULTY.easy)).toBe("Unshakeable focus.");

    expect(shareGrid(0).length).toBe(shareGrid(1).length); // min 1 square
    expect([...shareGrid(99)].length).toBe(12); // capped at 12
    expect(buildShareText(12, PARAMS_BY_DIFFICULTY.easy)).toContain("12 correct in 45s");
    expect(buildShareText(18, PARAMS_BY_DIFFICULTY.medium)).toContain("18 correct in 40s");
  });
});

describe(`stroop daily puzzles are always solvable across ${SAMPLE} days`, () => {
  it("every trial maps to a present swatch and incongruent trials genuinely mismatch, every tier", () => {
    for (const tier of TIERS) {
      const params = paramsFor(tier);
      const setSize = params.colorSet.length;
      let date = START;
      for (let d = 0; d < SAMPLE; d++) {
        const p = getDailyPuzzle(date, tier);

        // well-formed + validator agrees (core solvability invariant)
        expect(p.difficulty).toBe(tier);
        expect(p.trials.length).toBe(TRIAL_COUNT);
        expect(validateStroop(p), `validator failed on ${date} (${tier})`).toBe(true);

        // a perfect player can always reach the goal: stream length >> goal and
        // every trial has a present, correct answer.
        expect(p.trials.length).toBeGreaterThan(params.goal * 8);

        for (const t of p.trials) {
          // ink answer is a real swatch index
          expect(t.inkIdx, `bad inkIdx on ${date} (${tier})`).toBeGreaterThanOrEqual(0);
          expect(t.inkIdx).toBeLessThan(setSize);
          expect(t.wordIdx).toBeGreaterThanOrEqual(0);
          expect(t.wordIdx).toBeLessThan(setSize);
          // congruence flag is honest
          expect(t.congruent).toBe(t.wordIdx === t.inkIdx);
          // incongruent trials are genuinely mismatched
          if (!t.congruent) expect(t.wordIdx).not.toBe(t.inkIdx);
        }

        date = addDays(date, 1);
      }
    }
  });

  it("observed congruent fraction tracks the tier rate, and easy > hard", () => {
    const observed: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const tier of TIERS) {
      const p = getDailyPuzzle("2025-04-01", tier);
      const frac = p.trials.filter((t) => t.congruent).length / p.trials.length;
      observed[tier] = frac;
      // within a reasonable tolerance of the configured rate over 400 trials
      expect(Math.abs(frac - p.params.congruentRate)).toBeLessThan(0.08);
    }
    expect(observed.easy).toBeGreaterThan(observed.hard);
  });

  it("validateStroop rejects malformed puzzles", () => {
    const good = getDailyPuzzle(START, "medium");
    expect(validateStroop(good)).toBe(true);

    const empty: StroopPuzzle = { ...good, trials: [] };
    expect(validateStroop(empty)).toBe(false);

    const badInk: StroopPuzzle = {
      ...good,
      trials: good.trials.map((t, i) =>
        i === 0 ? { ...t, inkIdx: 99 } : t,
      ),
    };
    expect(validateStroop(badInk)).toBe(false);

    const lyingCongruent: StroopPuzzle = {
      ...good,
      trials: good.trials.map((t, i) =>
        i === 0 ? { wordIdx: 0, inkIdx: 1, congruent: true } : t,
      ),
    };
    expect(validateStroop(lyingCongruent)).toBe(false);

    const badParams: StroopPuzzle = {
      ...good,
      params: { ...good.params, congruentRate: 1.5 },
    };
    expect(validateStroop(badParams)).toBe(false);

    const dupSet: StroopPuzzle = {
      ...good,
      params: { ...good.params, colorSet: [0, 0, 1, 2, 3, 4] },
    };
    expect(validateStroop(dupSet)).toBe(false);
  });
});
