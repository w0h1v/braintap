import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import type { Difficulty } from "@/lib/types";
import {
  N,
  CELLS,
  GLYPHS,
  SIZES,
  cellsFor,
  isForgeSize,
  lineClue,
  linePlacements,
  deriveRowClues,
  deriveColClues,
  countSolutions,
  countFilled,
  isSolved,
  validateForge,
  cellIndex,
  getHint,
  type State,
} from "./engine";
import { getDailyPuzzle, TIER_PARAMS } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // ~6+ months of daily puzzles

describe("forge engine — clues", () => {
  it("lineClue computes contiguous runs", () => {
    expect(lineClue([0, 0, 0, 0, 0])).toEqual([0]);
    expect(lineClue([1, 1, 1, 1, 1])).toEqual([5]);
    expect(lineClue([1, 1, 1, 0, 1])).toEqual([3, 1]);
    expect(lineClue([0, 1, 0, 1, 0])).toEqual([1, 1]);
  });

  it("derives matching row/col clues for the diamond glyph", () => {
    const g = GLYPHS[0].grid;
    expect(deriveRowClues(g)).toEqual([[1], [3], [5], [3], [1]]);
    expect(deriveColClues(g)).toEqual([[1], [3], [5], [3], [1]]);
  });

  it("linePlacements enumerates all satisfying lines", () => {
    // run of 3 in a length-5 line: 3 placements
    expect(linePlacements([3], 5).length).toBe(3);
    // empty line: exactly one placement (all zeros)
    expect(linePlacements([0], 5)).toEqual([[0, 0, 0, 0, 0]]);
    // full line: exactly one placement
    expect(linePlacements([5], 5)).toEqual([[1, 1, 1, 1, 1]]);
    // every produced line matches the clue it came from
    for (const line of linePlacements([2, 1], 5)) {
      expect(lineClue(line)).toEqual([2, 1]);
    }
  });
});

describe("forge engine — solving + state", () => {
  it("isSolved treats marked-empty (2) as empty", () => {
    const g = GLYPHS[0].grid;
    const state: State = new Array(CELLS).fill(0) as State;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        state[cellIndex(r, c)] = g[r][c] === 1 ? 1 : 2; // mark blanks as ✕
      }
    }
    expect(isSolved(state, g)).toBe(true);

    // flip one filled cell off → not solved
    state[cellIndex(2, 2)] = 0;
    expect(isSolved(state, g)).toBe(false);
  });

  it("countSolutions finds the unique diamond solution", () => {
    const g = GLYPHS[0].grid;
    expect(countSolutions(deriveRowClues(g), deriveColClues(g), 5)).toBe(1);
  });
});

describe("forge engine — hints", () => {
  it("getHint reveals a still-wrong cell with its correct state", () => {
    const g = GLYPHS[0].grid; // diamond
    const empty: State = new Array(CELLS).fill(0) as State;

    // Repeatedly apply hints; each must point at a cell that is currently wrong
    // and resolve it to the correct state, eventually solving the grid.
    const state = empty.slice() as State;
    let guard = 0;
    let hint = getHint(g, state);
    while (hint && guard < CELLS + 5) {
      const { r, c, index, value } = hint;
      // hint state matches what the solution wants
      expect(value).toBe(g[r][c] === 1 ? 1 : 2);
      // the cell was indeed not already correct
      const want = g[r][c] === 1 ? 1 : 2;
      expect(state[index]).not.toBe(want);
      state[index] = value;
      hint = getHint(g, state);
      guard++;
    }

    // once exhausted, the grid is solved and no further hint is offered
    expect(getHint(g, state)).toBeNull();
    expect(isSolved(state, g)).toBe(true);
  });

  it("getHint returns null when every cell already matches", () => {
    const g = GLYPHS[2].grid; // arrow
    const state: State = new Array(CELLS).fill(0) as State;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        state[cellIndex(r, c)] = g[r][c] === 1 ? 1 : 2;
      }
    }
    expect(getHint(g, state)).toBeNull();
  });

  it("getHint scans top-left first and returns the correct state for that cell", () => {
    const g = GLYPHS[0].grid; // diamond, row 0 = [0,0,1,0,0]
    const state: State = new Array(CELLS).fill(0) as State;
    const hint = getHint(g, state);
    // (0,0) is empty in the solution but unmarked by the player → mark-empty (2)
    expect(hint).not.toBeNull();
    expect(hint!.r).toBe(0);
    expect(hint!.c).toBe(0);
    expect(hint!.value).toBe(2);

    // if the player already marked the blanks, the first filled gap is revealed
    const partial: State = new Array(CELLS).fill(2) as State;
    const filledHint = getHint(g, partial);
    expect(filledHint).not.toBeNull();
    expect(filledHint!.r).toBe(0);
    expect(filledHint!.c).toBe(2);
    expect(filledHint!.value).toBe(1);
  });
});

describe("forge curated glyphs", () => {
  it("every curated glyph is well-formed and non-trivial", () => {
    for (const glyph of GLYPHS) {
      expect(glyph.grid.length).toBe(N);
      glyph.grid.forEach((row) => expect(row.length).toBe(N));
      const filled = countFilled(glyph.grid);
      expect(filled).toBeGreaterThan(0);
      expect(filled).toBeLessThan(CELLS);
    }
  });
});

describe("forge daily puzzles are solvable (solvable bank)", () => {
  it(`every puzzle across ${SAMPLE} days has a UNIQUE solution`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      // structurally valid binary grid
      expect(p.solution.length, `bad grid on ${date}`).toBe(N);
      p.solution.forEach((row) => expect(row.length).toBe(N));

      // clues match the solution
      expect(deriveRowClues(p.solution)).toEqual(p.rowClues);
      expect(deriveColClues(p.solution)).toEqual(p.colClues);

      // exactly one solution from the clues alone
      expect(
        countSolutions(p.rowClues, p.colClues, 2),
        `not unique on ${date}`,
      ).toBe(1);

      // module validator agrees
      expect(validateForge(p), `validator failed on ${date}`).toBe(true);

      // sane fill density
      expect(p.filled).toBeGreaterThanOrEqual(6);
      expect(p.filled).toBeLessThanOrEqual(19);

      date = addDays(date, 1);
    }
  });

  it("daily puzzle is deterministic per date", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.solution).toEqual(b.solution);
    expect(a.rowClues).toEqual(b.rowClues);
  });

  it("different dates generally differ", () => {
    const seen = new Set<string>();
    let date = START;
    let distinct = 0;
    for (let i = 0; i < 30; i++) {
      const key = JSON.stringify(getDailyPuzzle(date).solution);
      if (!seen.has(key)) {
        seen.add(key);
        distinct++;
      }
      date = addDays(date, 1);
    }
    // expect a healthy variety across a month
    expect(distinct).toBeGreaterThan(5);
  });
});

describe("forge difficulty tiers", () => {
  const TIERS: Difficulty[] = ["easy", "medium", "hard"];
  const TIER_SAMPLE = 120; // ~4 months per tier

  it("supported sizes escalate 4 → 5 → 7", () => {
    expect(SIZES).toEqual([4, 5, 7]);
    expect(TIER_PARAMS.easy.size).toBe(4);
    expect(TIER_PARAMS.medium.size).toBe(5);
    expect(TIER_PARAMS.hard.size).toBe(7);
    // grid size strictly escalates with difficulty
    expect(TIER_PARAMS.easy.size).toBeLessThan(TIER_PARAMS.medium.size);
    expect(TIER_PARAMS.medium.size).toBeLessThan(TIER_PARAMS.hard.size);
  });

  it("omitting difficulty yields the medium 5×5 puzzle (legacy default)", () => {
    const def = getDailyPuzzle("2025-04-09");
    const med = getDailyPuzzle("2025-04-09", "medium");
    expect(def.size).toBe(N);
    expect(def.solution).toEqual(med.solution);
  });

  it("each tier is a valid, uniquely-solvable picross at its grid size", () => {
    for (const tier of TIERS) {
      const size = TIER_PARAMS[tier].size;
      let date = START;
      for (let i = 0; i < TIER_SAMPLE; i++) {
        const p = getDailyPuzzle(date, tier);

        // size is one of the supported sizes and matches the tier
        expect(isForgeSize(p.size), `bad size on ${tier} ${date}`).toBe(true);
        expect(p.size, `wrong size on ${tier} ${date}`).toBe(size);

        // structurally valid square binary grid
        expect(p.solution.length, `bad grid on ${tier} ${date}`).toBe(size);
        p.solution.forEach((row) => expect(row.length).toBe(size));
        p.solution.forEach((row) =>
          row.forEach((v) => expect(v === 0 || v === 1).toBe(true)),
        );

        // clues match the solution
        expect(deriveRowClues(p.solution)).toEqual(p.rowClues);
        expect(deriveColClues(p.solution)).toEqual(p.colClues);

        // exactly one solution from the clues alone (uniquely solvable)
        expect(
          countSolutions(p.rowClues, p.colClues, 2, size),
          `not unique on ${tier} ${date}`,
        ).toBe(1);

        // module validator agrees
        expect(validateForge(p), `validator failed on ${tier} ${date}`).toBe(
          true,
        );

        // fill density stays within the tier window and is non-trivial
        const fill = TIER_PARAMS[tier].fill;
        expect(p.filled).toBeGreaterThanOrEqual(fill[0]);
        expect(p.filled).toBeLessThanOrEqual(fill[1]);
        expect(p.filled).toBeGreaterThan(0);
        expect(p.filled).toBeLessThan(cellsFor(size));

        date = addDays(date, 1);
      }
    }
  });

  it("average fill escalates with difficulty across many days", () => {
    const avgFill = (tier: Difficulty) => {
      let date = START;
      let sum = 0;
      for (let i = 0; i < TIER_SAMPLE; i++) {
        sum += getDailyPuzzle(date, tier).filled;
        date = addDays(date, 1);
      }
      return sum / TIER_SAMPLE;
    };
    const easy = avgFill("easy");
    const medium = avgFill("medium");
    const hard = avgFill("hard");
    // Denser (and larger) boards as the tier rises.
    expect(easy).toBeLessThan(medium);
    expect(medium).toBeLessThan(hard);
  });

  it("is deterministic per (date, difficulty) and distinct across tiers", () => {
    for (const tier of TIERS) {
      const a = getDailyPuzzle("2025-05-20", tier);
      const b = getDailyPuzzle("2025-05-20", tier);
      expect(a.solution).toEqual(b.solution);
      expect(a.rowClues).toEqual(b.rowClues);
    }
    // Different tiers on the same day differ (different sizes guarantee it).
    const e = getDailyPuzzle("2025-05-20", "easy");
    const m = getDailyPuzzle("2025-05-20", "medium");
    const h = getDailyPuzzle("2025-05-20", "hard");
    expect(e.size).not.toBe(m.size);
    expect(m.size).not.toBe(h.size);
  });

  it("each tier produces a healthy variety of distinct puzzles", () => {
    for (const tier of TIERS) {
      const seen = new Set<string>();
      let date = START;
      for (let i = 0; i < 30; i++) {
        seen.add(JSON.stringify(getDailyPuzzle(date, tier).solution));
        date = addDays(date, 1);
      }
      expect(seen.size, `low variety on ${tier}`).toBeGreaterThan(5);
    }
  });

  it("isSolved + getHint work at non-default grid sizes", () => {
    for (const tier of ["easy", "hard"] as Difficulty[]) {
      const p = getDailyPuzzle("2025-02-02", tier);
      const size = p.size;
      const state: State = new Array(cellsFor(size)).fill(0) as State;
      // resolve the whole board via successive hints
      let guard = 0;
      let hint = getHint(p.solution, state);
      while (hint && guard < cellsFor(size) + 5) {
        state[hint.index] = hint.value;
        hint = getHint(p.solution, state);
        guard++;
      }
      expect(getHint(p.solution, state)).toBeNull();
      expect(isSolved(state, p.solution)).toBe(true);
    }
  });
});
