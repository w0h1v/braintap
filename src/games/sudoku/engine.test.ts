import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import {
  CELLS,
  N,
  idx,
  okAt,
  countSolutions,
  findConflicts,
  isSolved,
  validateSudoku,
  getHint,
} from "./engine";
import { getDailyPuzzle } from "./generator";
import type { Difficulty } from "@/lib/types";

const START = "2025-01-01";
const SAMPLE = 200; // ~6+ months of daily puzzles
const TIERS: Difficulty[] = ["easy", "medium", "hard"];
const TIER_DAYS = 120; // consecutive days checked per tier

function fullyValidGrid(g: number[]): boolean {
  if (findConflicts(g).some(Boolean)) return false;
  return g.every((v) => v >= 1 && v <= 6);
}

describe("sudoku engine", () => {
  it("okAt respects row, column and box constraints", () => {
    const g = new Array(CELLS).fill(0);
    g[idx(0, 0)] = 5;
    expect(okAt(g, 0, 3, 5)).toBe(false); // same row
    expect(okAt(g, 3, 0, 5)).toBe(false); // same column
    expect(okAt(g, 1, 1, 5)).toBe(false); // same 2x3 box
    expect(okAt(g, 1, 3, 5)).toBe(true); // free cell
  });

  it("a generated puzzle is deterministic per date", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.puzzle).toEqual(b.puzzle);
    expect(a.solution).toEqual(b.solution);
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.puzzle).not.toEqual(b.puzzle);
  });
});

describe("sudoku daily puzzles are solvable (solvable bank)", () => {
  it(`every puzzle across ${SAMPLE} days has a unique solution`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      // solution is a complete valid grid
      expect(fullyValidGrid(p.solution), `solution invalid on ${date}`).toBe(true);

      // givens match the solution; non-givens empty
      for (let c = 0; c < CELLS; c++) {
        if (p.given[c]) expect(p.puzzle[c]).toBe(p.solution[c]);
        else expect(p.puzzle[c]).toBe(0);
      }

      // exactly one solution
      expect(countSolutions(p.puzzle.slice(), 2), `not unique on ${date}`).toBe(1);

      // module validator agrees
      expect(validateSudoku(p), `validator failed on ${date}`).toBe(true);

      // clue count in a sane range for a 6x6
      expect(p.clues).toBeGreaterThanOrEqual(8);
      expect(p.clues).toBeLessThanOrEqual(36);

      date = addDays(date, 1);
    }
  });

  it("isSolved only accepts the exact solution", () => {
    const p = getDailyPuzzle(START);
    expect(isSolved(p.solution, p.solution)).toBe(true);
    const wrong = p.solution.slice();
    const i = wrong.findIndex((_, k) => !p.given[k]);
    wrong[i] = (wrong[i] % 6) + 1;
    expect(isSolved(wrong, p.solution)).toBe(false);
  });
});

describe("sudoku difficulty tiers", () => {
  it(`every tier across ${TIER_DAYS} consecutive days is well-formed + uniquely solvable`, () => {
    for (const d of TIERS) {
      let date = START;
      for (let i = 0; i < TIER_DAYS; i++) {
        const p = getDailyPuzzle(date, d);

        // solution is a complete valid grid
        expect(fullyValidGrid(p.solution), `${d} solution invalid on ${date}`).toBe(true);

        // givens match the solution; non-givens empty
        for (let c = 0; c < CELLS; c++) {
          if (p.given[c]) expect(p.puzzle[c]).toBe(p.solution[c]);
          else expect(p.puzzle[c]).toBe(0);
        }

        // exactly one solution
        expect(countSolutions(p.puzzle.slice(), 2), `${d} not unique on ${date}`).toBe(1);

        // module validator agrees (well-formed + unique solution)
        expect(validateSudoku(p), `${d} validator failed on ${date}`).toBe(true);

        date = addDays(date, 1);
      }
    }
  });

  it("is deterministic per (date, difficulty) and tiers differ on a given day", () => {
    const a = getDailyPuzzle("2025-03-14", "hard");
    const b = getDailyPuzzle("2025-03-14", "hard");
    expect(a.puzzle).toEqual(b.puzzle);

    const easy = getDailyPuzzle("2025-03-14", "easy");
    const hard = getDailyPuzzle("2025-03-14", "hard");
    expect(easy.puzzle).not.toEqual(hard.puzzle);
  });

  it("easy averages more givens (clues) than hard over the sampled days", () => {
    let easyTotal = 0;
    let hardTotal = 0;
    let date = START;
    for (let i = 0; i < TIER_DAYS; i++) {
      easyTotal += getDailyPuzzle(date, "easy").clues;
      hardTotal += getDailyPuzzle(date, "hard").clues;
      date = addDays(date, 1);
    }
    expect(easyTotal / TIER_DAYS).toBeGreaterThan(hardTotal / TIER_DAYS);
  });
});

const p0 = getDailyPuzzle(START);

describe("sudoku getHint", () => {
  it("returns null when the grid is full", () => {
    const p = getDailyPuzzle(START);
    expect(getHint(p.solution.slice(), p.solution)).toBeNull();
  });

  it("reveals an empty cell with its correct solution value", () => {
    const p = getDailyPuzzle(START);
    const hint = getHint(p.puzzle.slice(), p.solution);
    expect(hint).not.toBeNull();
    expect(p.puzzle[hint!.cell]).toBe(0); // an empty cell
    expect(hint!.value).toBe(p.solution[hint!.cell]); // correct value
    expect(hint!.value).toBeGreaterThanOrEqual(1);
    expect(hint!.value).toBeLessThanOrEqual(6);
  });

  it("prefers a naked single when one exists", () => {
    // Take the solution and blank a single cell -> it is a forced naked single.
    const current = p0.solution.slice();
    const target = current.findIndex((_, k) => !p0.given[k]);
    current[target] = 0;
    const hint = getHint(current, p0.solution);
    expect(hint).not.toBeNull();
    expect(hint!.cell).toBe(target);
    expect(hint!.forced).toBe(true);
    expect(hint!.value).toBe(p0.solution[target]);
  });
});

// silence unused import lint when N changes
void N;
