import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import { DIFFICULTIES } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";
import { rngFromString } from "@/lib/rng";
import {
  PARAMS_BY_DIFFICULTY,
  paramsFor,
  PALETTE,
  generateRound,
  generateRounds,
  testGrid,
  evaluateTap,
  scoreRun,
  validateSpotChange,
} from "./engine";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // 200 days × 3 tiers comfortably exceeds the 180-day bar

describe("spotchange parameters escalate", () => {
  it("grid, paletteSize and rounds grow easy → medium → hard; flashMs decreases", () => {
    const e = PARAMS_BY_DIFFICULTY.easy;
    const m = PARAMS_BY_DIFFICULTY.medium;
    const h = PARAMS_BY_DIFFICULTY.hard;

    expect(e.grid).toBeLessThan(m.grid);
    expect(m.grid).toBeLessThan(h.grid);

    expect(e.paletteSize).toBeLessThan(m.paletteSize);
    expect(m.paletteSize).toBeLessThan(h.paletteSize);

    expect(e.rounds).toBeLessThan(m.rounds);
    expect(m.rounds).toBeLessThan(h.rounds);

    // flashMs is the single INVERTED knob: shorter flash on harder tiers.
    expect(e.flashMs).toBeGreaterThan(m.flashMs);
    expect(m.flashMs).toBeGreaterThan(h.flashMs);
  });

  it("the palette has enough distinct colours for the hardest tier", () => {
    expect(PALETTE.length).toBeGreaterThanOrEqual(PARAMS_BY_DIFFICULTY.hard.paletteSize);
    const hexes = new Set(PALETTE.map((c) => c.hex));
    expect(hexes.size).toBe(PALETTE.length); // all distinct
  });
});

describe("spotchange engine", () => {
  it("generateRound: change is real and at exactly one cell", () => {
    const rng = rngFromString("spotchange:unit");
    const round = generateRound(rng, 4, 5);
    expect(round.newColor).not.toBe(round.base[round.changedCell]);
    const test = testGrid(round);
    let diffs = 0;
    for (let i = 0; i < round.base.length; i++) if (round.base[i] !== test[i]) diffs++;
    expect(diffs).toBe(1);
  });

  it("evaluateTap: tapping the changed cell is correct, anything else is wrong", () => {
    const round = { base: [0, 1, 2, 3], changedCell: 2, newColor: 0 };
    expect(evaluateTap(round, 2)).toBe("correct");
    expect(evaluateTap(round, 0)).toBe("wrong");
    expect(evaluateTap(round, 3)).toBe("wrong");
  });

  it("scoreRun: maps correctness to 0..100; perfect run is 100", () => {
    expect(scoreRun([])).toBe(0);
    expect(scoreRun([false, false, false])).toBe(0);
    expect(scoreRun([true, true, true, true])).toBe(100);
    expect(scoreRun([true, false, true, false])).toBe(50);
    // a non-perfect run never reaches 100
    expect(scoreRun([true, true, true, false, true, true, true])).toBeLessThan(100);
  });

  it("generateRounds is reproducible from the same seed", () => {
    const a = generateRounds(rngFromString("spotchange:seed"), paramsFor("hard"));
    const b = generateRounds(rngFromString("spotchange:seed"), paramsFor("hard"));
    expect(a).toEqual(b);
  });
});

describe("spotchange determinism", () => {
  it("same date + difficulty produces the same puzzle", () => {
    const a = getDailyPuzzle("2025-03-14", "hard");
    const b = getDailyPuzzle("2025-03-14", "hard");
    expect(a).toEqual(b);
  });

  it("default difficulty is medium and stable", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14", "medium");
    expect(a).toEqual(b);
    expect(a.difficulty).toBe("medium");
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14", "medium");
    const b = getDailyPuzzle("2025-03-15", "medium");
    expect(a.rounds).not.toEqual(b.rounds);
  });

  it("different tiers on the same date are independent puzzles", () => {
    const e = getDailyPuzzle("2025-03-14", "easy");
    const m = getDailyPuzzle("2025-03-14", "medium");
    const h = getDailyPuzzle("2025-03-14", "hard");
    expect(e.grid).not.toBe(m.grid);
    expect(m.grid).not.toBe(h.grid);
    expect(e.rounds).not.toEqual(m.rounds);
    expect(m.rounds).not.toEqual(h.rounds);
  });
});

describe("spotchange daily puzzles are solvable across every tier", () => {
  for (const difficulty of DIFFICULTIES as readonly Difficulty[]) {
    const params = paramsFor(difficulty);
    const cells = params.grid * params.grid;

    it(`${difficulty}: every run across ${SAMPLE} days is winnable and well-formed`, () => {
      let date = START;
      for (let i = 0; i < SAMPLE; i++) {
        const p = getDailyPuzzle(date, difficulty);

        // module validator agrees the puzzle is well-formed and unique
        expect(validateSpotChange(p), `validator failed on ${date} (${difficulty})`).toBe(true);

        // tier metadata is correct
        expect(p.grid).toBe(params.grid);
        expect(p.flashMs).toBe(params.flashMs);
        expect(p.difficulty).toBe(difficulty);
        expect(p.palette.length).toBe(params.paletteSize);
        expect(p.rounds.length).toBe(params.rounds);

        for (let r = 0; r < p.rounds.length; r++) {
          const round = p.rounds[r];

          // base fills the grid with in-bounds palette indices
          expect(round.base.length).toBe(cells);
          for (const v of round.base) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(p.palette.length);
          }

          // exactly one cell differs between base and test, at the changed cell
          const test = testGrid(round);
          let diffs = 0;
          let diffIdx = -1;
          for (let c = 0; c < cells; c++) {
            if (round.base[c] !== test[c]) {
              diffs++;
              diffIdx = c;
            }
          }
          expect(diffs, `round ${r + 1} on ${date}`).toBe(1);
          expect(diffIdx).toBe(round.changedCell);

          // the changed cell's new colour really differs from its old one
          expect(round.newColor).not.toBe(round.base[round.changedCell]);

          // winnable: the documented winning move always exists and is accepted
          expect(evaluateTap(round, round.changedCell)).toBe("correct");
        }

        date = addDays(date, 1);
      }
    });
  }
});
