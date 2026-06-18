import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import {
  CELLS,
  MAX,
  SIZE,
  SIZES,
  DEFAULT_SIZE,
  cellsFor,
  cellOf,
  isComplete,
  isCorrectTap,
  isSchulteSize,
  scoreForTime,
  starsForTime,
  titleForTime,
  validateSchulte,
  type SchultePuzzle,
} from "./engine";
import { getDailyPuzzle, getDailyPuzzleForSize } from "./generator";
import type { Difficulty } from "@/lib/types";

const START = "2025-01-01";
const SAMPLE = 200; // ~6+ months of daily puzzles

/** Difficulty → expected grid edge length. */
const SIZE_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 3,
  medium: 5,
  hard: 7,
};

function isPermutationOf(grid: number[], n: number): boolean {
  if (grid.length !== n) return false;
  const seen = new Set<number>();
  for (const v of grid) {
    if (!Number.isInteger(v) || v < 1 || v > n) return false;
    if (seen.has(v)) return false;
    seen.add(v);
  }
  return seen.size === n;
}

describe("schulte engine", () => {
  it("constants describe a 5x5 / 1..25 default table", () => {
    expect(SIZE).toBe(5);
    expect(CELLS).toBe(25);
    expect(MAX).toBe(25);
    expect(DEFAULT_SIZE).toBe(5);
  });

  it("supports 3x3 / 5x5 / 7x7 sizes", () => {
    expect(SIZES).toEqual([3, 5, 7]);
    expect(cellsFor(3)).toBe(9);
    expect(cellsFor(5)).toBe(25);
    expect(cellsFor(7)).toBe(49);
    expect(isSchulteSize(3)).toBe(true);
    expect(isSchulteSize(5)).toBe(true);
    expect(isSchulteSize(7)).toBe(true);
    expect(isSchulteSize(4)).toBe(false);
    expect(isSchulteSize("5")).toBe(false);
    expect(isSchulteSize(undefined)).toBe(false);
  });

  it("cellOf locates a value in the grid", () => {
    const grid = Array.from({ length: CELLS }, (_, i) => i + 1);
    expect(cellOf(grid, 1)).toBe(0);
    expect(cellOf(grid, 25)).toBe(24);
    expect(cellOf(grid, 99)).toBe(-1);
  });

  it("isCorrectTap and isComplete track sequence progress", () => {
    expect(isCorrectTap(1, 1)).toBe(true);
    expect(isCorrectTap(2, 1)).toBe(false);
    // default max (25)
    expect(isComplete(25)).toBe(false);
    expect(isComplete(26)).toBe(true);
    // explicit max for other sizes
    expect(isComplete(9, 9)).toBe(false);
    expect(isComplete(10, 9)).toBe(true);
    expect(isComplete(49, 49)).toBe(false);
    expect(isComplete(50, 49)).toBe(true);
  });

  it("scoreForTime is monotonic non-increasing and bounded 20..100", () => {
    const fast = scoreForTime(10_000);
    const mid = scoreForTime(30_000);
    const slow = scoreForTime(120_000);
    expect(fast).toBe(100);
    expect(fast).toBeGreaterThanOrEqual(mid);
    expect(mid).toBeGreaterThanOrEqual(slow);
    expect(slow).toBeGreaterThanOrEqual(20);
    expect(fast).toBeLessThanOrEqual(100);
  });

  it("scoreForTime scales thresholds with grid size", () => {
    // A 3×3 cleared in the 5×5 perfect window should still be perfect, and the
    // smaller grid is graded harder (perfect window shrinks with cell count).
    expect(scoreForTime(5_000, 3)).toBe(100);
    // 7×7 gets a wider perfect window than 5×5 at the same time.
    expect(scoreForTime(20_000, 7)).toBeGreaterThanOrEqual(scoreForTime(20_000, 5));
    // Bounds hold for every size.
    for (const s of SIZES) {
      const v = scoreForTime(300_000, s);
      expect(v).toBeGreaterThanOrEqual(20);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("titleForTime tiers by speed (default 5x5)", () => {
    expect(titleForTime(10_000)).toBe("Eagle eyes.");
    expect(titleForTime(25_000)).toBe("Sharp focus.");
    expect(titleForTime(45_000)).toBe("Locked in.");
  });

  it("titleForTime scales with size", () => {
    // Same wall-clock time grades differently across sizes: the 3×3 window is
    // tighter (18000 * 9/25 ≈ 6480ms for top tier) than the 7×7 window.
    expect(titleForTime(8_000, 3)).toBe("Sharp focus.");
    expect(titleForTime(8_000, 7)).toBe("Eagle eyes.");
    // A time that is "Locked in." at 5×5 can still be top-tier at 7×7
    // (18000 * 49/25 ≈ 35280ms top-tier window).
    expect(titleForTime(20_000, 7)).toBe("Eagle eyes.");
  });

  it("starsForTime awards 3/2/1 stars by scaled speed", () => {
    expect(starsForTime(10_000, 5)).toBe(3);
    expect(starsForTime(25_000, 5)).toBe(2);
    expect(starsForTime(45_000, 5)).toBe(1);
    // smaller grid is graded harder
    expect(starsForTime(15_000, 3)).toBeLessThanOrEqual(starsForTime(15_000, 5));
  });

  it("validateSchulte accepts every supported size and rejects malformed", () => {
    for (const s of SIZES) {
      const n = cellsFor(s);
      const grid = Array.from({ length: n }, (_, i) => i + 1);
      expect(validateSchulte({ grid, size: s })).toBe(true);
    }
    // wrong length
    expect(validateSchulte({ grid: [1, 2, 3], size: SIZE })).toBe(false);
    // duplicate / missing value
    const dup = Array.from({ length: CELLS }, (_, i) => i + 1);
    dup[0] = 2;
    expect(validateSchulte({ grid: dup, size: SIZE })).toBe(false);
    // out of range
    const outOfRange = Array.from({ length: CELLS }, (_, i) => i + 1);
    outOfRange[0] = 26;
    expect(validateSchulte({ grid: outOfRange, size: SIZE })).toBe(false);
    // unsupported size
    expect(
      validateSchulte({ grid: Array.from({ length: 16 }, (_, i) => i + 1), size: 4 }),
    ).toBe(false);
  });

  it("a generated puzzle is deterministic per date", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.grid).toEqual(b.grid);
    expect(a.size).toBe(DEFAULT_SIZE);
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.grid).not.toEqual(b.grid);
  });

  it("getDailyPuzzleForSize is deterministic per (date, size) and size-aware", () => {
    for (const s of SIZES) {
      const a = getDailyPuzzleForSize("2025-03-14", s);
      const b = getDailyPuzzleForSize("2025-03-14", s);
      expect(a.size).toBe(s);
      expect(a.grid.length).toBe(cellsFor(s));
      expect(a.grid).toEqual(b.grid);
    }
    // the default-size helper matches the explicit default-size call
    expect(getDailyPuzzle("2025-03-14").grid).toEqual(
      getDailyPuzzleForSize("2025-03-14", DEFAULT_SIZE).grid,
    );
  });

  it("getDailyPuzzle maps difficulty → size (easy=3, medium=5, hard=7)", () => {
    expect(getDailyPuzzle("2025-03-14", "easy").size).toBe(3);
    expect(getDailyPuzzle("2025-03-14", "medium").size).toBe(5);
    expect(getDailyPuzzle("2025-03-14", "hard").size).toBe(7);
    // omitting the difficulty yields the medium 5×5 daily table unchanged
    expect(getDailyPuzzle("2025-03-14").grid).toEqual(
      getDailyPuzzle("2025-03-14", "medium").grid,
    );
  });

  it("getDailyPuzzle is deterministic per (date, difficulty) and tier-scoped", () => {
    for (const d of ["easy", "medium", "hard"] as const) {
      const a = getDailyPuzzle("2025-03-14", d);
      const b = getDailyPuzzle("2025-03-14", d);
      expect(a.size).toBe(SIZE_BY_DIFFICULTY[d]);
      expect(a.grid).toEqual(b.grid);
      // matches the size-keyed helper for the mapped size
      expect(a.grid).toEqual(
        getDailyPuzzleForSize("2025-03-14", SIZE_BY_DIFFICULTY[d]).grid,
      );
    }
  });
});

describe("schulte daily puzzles are always solvable", () => {
  it(`every default grid across ${SAMPLE} days is a valid permutation (solvable)`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p: SchultePuzzle = getDailyPuzzle(date);
      expect(isPermutationOf(p.grid, MAX), `grid not a permutation on ${date}`).toBe(true);
      expect(validateSchulte(p), `validator failed on ${date}`).toBe(true);
      expect(p.size).toBe(SIZE);
      date = addDays(date, 1);
    }
  });

  it("every supported size produces a valid permutation across a sample of days", () => {
    for (const s of SIZES) {
      let date = START;
      for (let i = 0; i < 60; i++) {
        const p = getDailyPuzzleForSize(date, s);
        expect(
          isPermutationOf(p.grid, cellsFor(s)),
          `size ${s} not a permutation on ${date}`,
        ).toBe(true);
        expect(validateSchulte(p), `size ${s} validator failed on ${date}`).toBe(true);
        date = addDays(date, 1);
      }
    }
  });

  it("each difficulty tier yields a valid permutation of the expected size across many days", () => {
    for (const d of ["easy", "medium", "hard"] as const) {
      const expectedSize = SIZE_BY_DIFFICULTY[d];
      let date = START;
      for (let i = 0; i < SAMPLE; i++) {
        const p: SchultePuzzle = getDailyPuzzle(date, d);
        expect(p.size, `tier ${d} wrong size on ${date}`).toBe(expectedSize);
        expect(
          isPermutationOf(p.grid, cellsFor(expectedSize)),
          `tier ${d} not a permutation on ${date}`,
        ).toBe(true);
        expect(validateSchulte(p), `tier ${d} validator failed on ${date}`).toBe(true);
        date = addDays(date, 1);
      }
    }
  });

  it("each table is completable by tapping 1..max in order (solvable walk)", () => {
    for (const s of SIZES) {
      const p = getDailyPuzzleForSize(START, s);
      const max = cellsFor(s);
      let next = 1;
      while (!isComplete(next, max)) {
        const cell = cellOf(p.grid, next);
        expect(cell, `missing ${next} at size ${s}`).toBeGreaterThanOrEqual(0);
        expect(isCorrectTap(p.grid[cell], next)).toBe(true);
        next += 1;
      }
      expect(next).toBe(max + 1);
    }
  });
});
