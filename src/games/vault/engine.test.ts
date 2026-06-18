import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import { DIFFICULTIES } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";
import {
  CELLS,
  MAX_ROUNDS,
  INITIAL_LEVEL,
  PARAMS_BY_DIFFICULTY,
  paramsFor,
  cellsFor,
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

  it("levelForRound honours a custom starting level", () => {
    expect(levelForRound(1, 2)).toBe(2);
    expect(levelForRound(3, 4)).toBe(6);
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

  it("isValidPattern bounds scale with the cell count", () => {
    // index 30 is out of bounds on a 25-cell board but valid on a 36-cell one
    expect(isValidPattern([30], 25)).toBe(false);
    expect(isValidPattern([30], 36)).toBe(true);
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

describe("vault difficulty parameters escalate", () => {
  it("grid, initialLevel and maxRounds all grow easy → medium → hard", () => {
    const e = PARAMS_BY_DIFFICULTY.easy;
    const m = PARAMS_BY_DIFFICULTY.medium;
    const h = PARAMS_BY_DIFFICULTY.hard;

    expect(e.grid).toBeLessThan(m.grid);
    expect(m.grid).toBeLessThan(h.grid);

    expect(e.initialLevel).toBeLessThan(m.initialLevel);
    expect(m.initialLevel).toBeLessThan(h.initialLevel);

    expect(e.maxRounds).toBeLessThan(m.maxRounds);
    expect(m.maxRounds).toBeLessThan(h.maxRounds);

    // medium matches the legacy single-tier defaults
    expect(m.grid).toBe(5);
    expect(m.initialLevel).toBe(INITIAL_LEVEL);
    expect(m.maxRounds).toBe(MAX_ROUNDS);
  });

  it("the final round always fits on its grid", () => {
    for (const d of DIFFICULTIES) {
      const { grid, initialLevel, maxRounds } = paramsFor(d);
      expect(levelForRound(maxRounds, initialLevel)).toBeLessThanOrEqual(cellsFor(grid));
    }
  });
});

describe("vault determinism", () => {
  it("same date + difficulty produces the same sequence", () => {
    const a = getDailyPuzzle("2025-03-14", "hard");
    const b = getDailyPuzzle("2025-03-14", "hard");
    expect(a.rounds).toEqual(b.rounds);
  });

  it("default difficulty is medium and stable", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14", "medium");
    expect(a.rounds).toEqual(b.rounds);
    expect(a.difficulty).toBe("medium");
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.rounds).not.toEqual(b.rounds);
  });

  it("different tiers on the same date are independent puzzles", () => {
    const e = getDailyPuzzle("2025-03-14", "easy");
    const m = getDailyPuzzle("2025-03-14", "medium");
    const h = getDailyPuzzle("2025-03-14", "hard");
    expect(e.grid).not.toBe(m.grid);
    expect(m.grid).not.toBe(h.grid);
    // Even where shapes overlap, the seeds differ, so the patterns differ.
    expect(e.rounds).not.toEqual(m.rounds);
    expect(m.rounds).not.toEqual(h.rounds);
  });

  it("generateRounds is reproducible from the same seed", () => {
    const a = generateRounds(rngFromString("vault:test"));
    const b = generateRounds(rngFromString("vault:test"));
    expect(a).toEqual(b);
  });
});

describe("vault daily puzzles are solvable across every tier", () => {
  for (const difficulty of DIFFICULTIES as readonly Difficulty[]) {
    const { grid, initialLevel, maxRounds } = paramsFor(difficulty);
    const cells = cellsFor(grid);

    it(`${difficulty}: every sequence across ${SAMPLE} days is winnable`, () => {
      let date = START;
      for (let i = 0; i < SAMPLE; i++) {
        const p = getDailyPuzzle(date, difficulty);

        // module validator agrees
        expect(validateVault(p), `validator failed on ${date} (${difficulty})`).toBe(true);

        // puzzle carries the correct tier metadata
        expect(p.grid).toBe(grid);
        expect(p.initialLevel).toBe(initialLevel);
        expect(p.difficulty).toBe(difficulty);

        // exactly maxRounds rounds for the tier
        expect(p.rounds.length).toBe(maxRounds);

        for (let r = 0; r < p.rounds.length; r++) {
          const pattern = p.rounds[r];

          // valid pattern: non-empty, unique, in-bounds for this grid
          expect(isValidPattern(pattern, cells), `bad pattern on ${date} round ${r + 1}`).toBe(true);

          // size grows with the round from the tier's starting level
          expect(pattern.length).toBe(levelForRound(r + 1, initialLevel));

          // every target cell is in-bounds for the tier's grid
          for (const cell of pattern) {
            expect(cell).toBeGreaterThanOrEqual(0);
            expect(cell).toBeLessThan(cells);
          }

          // winnable: tapping exactly the pattern cells completes the round
          expect(isRoundComplete(pattern, new Set(pattern))).toBe(true);
        }

        date = addDays(date, 1);
      }
    });
  }
});

// Keep CELLS referenced as part of the legacy engine surface.
void CELLS;
