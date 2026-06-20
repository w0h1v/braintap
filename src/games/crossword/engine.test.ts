import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import type { Difficulty } from "@/lib/types";
import { BANK } from "./bank";
import {
  buildPuzzle,
  validateEntry,
  validatePuzzle,
  isSolved,
  computeNumbers,
  parseGrid,
  type CrosswordEntry,
} from "./engine";
import { getDailyPuzzle, poolFor } from "./generator";

const TIERS: Difficulty[] = ["easy", "medium", "hard"];
const START = "2025-01-01";
const DAYS = 200; // > 180-day winnable bar

describe("crossword bank integrity", () => {
  it("every bank entry is a valid raw entry", () => {
    BANK.forEach((entry, i) => {
      expect(validateEntry(entry), `entry ${i} (${entry.difficulty}) failed validateEntry`).toBe(true);
    });
  });

  it("every bank entry compiles to a solvable puzzle (solvable bank)", () => {
    BANK.forEach((entry, i) => {
      const p = buildPuzzle(entry);
      expect(validatePuzzle(p), `entry ${i} (${entry.difficulty}) failed validatePuzzle`).toBe(true);
      // The curated solution is accepted, and any single wrong/empty cell rejected.
      expect(isSolved(p.solution, p.solution, p.block)).toBe(true);
    });
  });

  it("isSolved rejects an empty or wrong white cell", () => {
    const p = buildPuzzle(BANK[0]);
    const firstWhite = p.block.findIndex((b) => !b);
    const empty = p.solution.slice();
    empty[firstWhite] = "";
    expect(isSolved(empty, p.solution, p.block)).toBe(false);
    const wrong = p.solution.slice();
    wrong[firstWhite] = wrong[firstWhite] === "A" ? "B" : "A";
    expect(isSolved(wrong, p.solution, p.block)).toBe(false);
  });

  it("each tier sub-bank meets the target size", () => {
    for (const t of TIERS) {
      const pool = poolFor(t);
      expect(pool.length, `${t} sub-bank too small`).toBeGreaterThanOrEqual(120);
    }
  });

  it("no duplicate grids within a tier sub-bank", () => {
    for (const t of TIERS) {
      const pool = poolFor(t);
      const keys = pool.map((e) => e.rows.join("|"));
      expect(new Set(keys).size, `${t} has duplicate grids`).toBe(keys.length);
    }
  });

  it("validateEntry rejects an answer inconsistent with the grid", () => {
    const good = BANK.find((e) => e.across.length > 0)!;
    const bad: CrosswordEntry = {
      ...good,
      across: good.across.map((c, i) =>
        i === 0 ? { ...c, answer: c.answer.split("").reverse().join("") + "X" } : c,
      ),
    };
    expect(validateEntry(bad)).toBe(false);
  });
});

describe("crossword numbering", () => {
  it("recomputes consistent standard numbering", () => {
    const p = buildPuzzle(BANK[0]);
    const { block } = parseGrid(BANK[0]);
    expect(computeNumbers(BANK[0].size, block)).toEqual(p.numbers);
    // first white cell is always numbered 1
    const firstWhite = p.block.findIndex((b) => !b);
    expect(p.numbers[firstWhite]).toBe(1);
  });
});

describe("crossword daily puzzles", () => {
  it("is deterministic per (date, difficulty)", () => {
    for (const t of TIERS) {
      const a = getDailyPuzzle("2025-03-14", t);
      const b = getDailyPuzzle("2025-03-14", t);
      expect(a.solution).toEqual(b.solution);
      expect(a.numbers).toEqual(b.numbers);
    }
  });

  it("easy and hard differ in layout on the same day", () => {
    const easy = getDailyPuzzle("2025-03-14", "easy");
    const hard = getDailyPuzzle("2025-03-14", "hard");
    // Different size or different solution string.
    const differ =
      easy.size !== hard.size || easy.solution.join("") !== hard.solution.join("");
    expect(differ).toBe(true);
  });

  it(`every tier across ${DAYS} consecutive days yields a solvable puzzle`, () => {
    for (const t of TIERS) {
      let date = START;
      for (let i = 0; i < DAYS; i++) {
        const p = getDailyPuzzle(date, t);
        expect(validatePuzzle(p), `${t} not solvable on ${date}`).toBe(true);
        expect(p.difficulty).toBe(t);
        date = addDays(date, 1);
      }
    }
  });

  it("consecutive days walk the bank without immediate repeats", () => {
    for (const t of TIERS) {
      const a = getDailyPuzzle("2025-05-01", t);
      const b = getDailyPuzzle("2025-05-02", t);
      expect(a.solution.join("")).not.toEqual(b.solution.join(""));
    }
  });
});
