import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import {
  CELLS,
  MAX_ROUNDS,
  INITIAL_LEVEL,
  levelForRound,
  showDuration,
  isValidPattern,
  evaluateTap,
  isRoundComplete,
  validateVault,
  generateRounds,
} from "./engine";
import { rngFromString } from "@/lib/rng";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // ~6+ months of daily sequences

describe("vault engine", () => {
  it("levelForRound starts at INITIAL_LEVEL and grows by one", () => {
    expect(levelForRound(1)).toBe(INITIAL_LEVEL);
    expect(levelForRound(MAX_ROUNDS)).toBe(INITIAL_LEVEL + MAX_ROUNDS - 1);
  });

  it("showDuration increases with level", () => {
    expect(showDuration(3)).toBeLessThan(showDuration(12));
  });

  it("isValidPattern rejects empty, out-of-bounds and duplicates", () => {
    expect(isValidPattern([])).toBe(false);
    expect(isValidPattern([0, 24, 12])).toBe(true);
    expect(isValidPattern([0, 25])).toBe(false);
    expect(isValidPattern([-1])).toBe(false);
    expect(isValidPattern([3, 3])).toBe(false);
  });

  it("evaluateTap classifies correct, wrong and duplicate taps", () => {
    const pattern = [2, 5, 9];
    const picked = new Set([2]);
    expect(evaluateTap(pattern, picked, 5)).toBe("correct");
    expect(evaluateTap(pattern, picked, 7)).toBe("wrong");
    expect(evaluateTap(pattern, picked, 2)).toBe("duplicate");
  });

  it("isRoundComplete only true once all pattern cells picked (order-free)", () => {
    const pattern = [2, 5, 9];
    expect(isRoundComplete(pattern, new Set([9, 2]))).toBe(false);
    expect(isRoundComplete(pattern, new Set([9, 2, 5]))).toBe(true);
    // extra cells beyond the pattern don't matter
    expect(isRoundComplete(pattern, new Set([2, 5, 9, 1]))).toBe(true);
  });
});

describe("vault determinism", () => {
  it("same date produces the same sequence", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.rounds).toEqual(b.rounds);
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.rounds).not.toEqual(b.rounds);
  });

  it("generateRounds is reproducible from the same seed", () => {
    const a = generateRounds(rngFromString("vault:test"));
    const b = generateRounds(rngFromString("vault:test"));
    expect(a).toEqual(b);
  });
});

describe("vault daily puzzles are solvable (solvable bank)", () => {
  it(`every sequence across ${SAMPLE} days is winnable by construction`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      // module validator agrees
      expect(validateVault(p), `validator failed on ${date}`).toBe(true);

      // exactly MAX_ROUNDS rounds
      expect(p.rounds.length).toBe(MAX_ROUNDS);

      for (let r = 0; r < p.rounds.length; r++) {
        const pattern = p.rounds[r];

        // valid pattern: non-empty, unique, in-bounds
        expect(isValidPattern(pattern), `bad pattern on ${date} round ${r + 1}`).toBe(true);

        // size grows with the round
        expect(pattern.length).toBe(levelForRound(r + 1));

        // every target cell is in-bounds
        for (const cell of pattern) {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThan(CELLS);
        }

        // winnable: tapping exactly the pattern cells completes the round
        expect(isRoundComplete(pattern, new Set(pattern))).toBe(true);
      }

      date = addDays(date, 1);
    }
  });
});
