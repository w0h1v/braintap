import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import { DIFFICULTIES } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";
import {
  COLS,
  SLOTS,
  DOMINOES,
  MIN_FACE,
  MAX_FACE,
  pairStart,
  halves,
  colSums,
  isSolved,
  solve,
  validatePips,
  getHint,
  configOf,
  colsFor,
  slotsFor,
  DIFFICULTY_CONFIG,
  type Placement,
  type Domino,
  type PipsPuzzle,
} from "./engine";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // >180 days as required

/** Build the canonical placement from a puzzle's stored solution. */
function solutionPlacement(p: PipsPuzzle): Placement {
  const n = p.solution.length;
  const slots: (number | null)[] = new Array(n).fill(null);
  const flips = new Array(n).fill(false);
  for (let id = 0; id < n; id++) {
    const { slot, flip } = p.solution[id];
    slots[slot] = id;
    flips[id] = flip;
  }
  return { slots, flips };
}

describe("pips engine", () => {
  it("pairStart maps slots to the correct column pair", () => {
    expect(pairStart(0)).toBe(0);
    expect(pairStart(1)).toBe(2);
    expect(pairStart(2)).toBe(0);
    expect(pairStart(3)).toBe(2);
  });

  it("pairStart honours a custom pair count", () => {
    // 3 pairs → slots 0,1,2 start cols 0,2,4; slots 3,4,5 wrap to 0,2,4.
    expect(pairStart(0, 3)).toBe(0);
    expect(pairStart(1, 3)).toBe(2);
    expect(pairStart(2, 3)).toBe(4);
    expect(pairStart(3, 3)).toBe(0);
  });

  it("halves swaps faces when flipped", () => {
    const d: Domino = [3, 5];
    expect(halves(d, false)).toEqual({ left: 3, right: 5 });
    expect(halves(d, true)).toEqual({ left: 5, right: 3 });
  });

  it("colSums accumulates pips into the right columns", () => {
    const bank: Domino[] = [
      [3, 2],
      [4, 1],
      [5, 2],
      [3, 3],
    ];
    // domino 0 in slot 0 (cols 0,1), domino 1 in slot 1 (cols 2,3), etc.
    const placement: Placement = {
      slots: [0, 1, 2, 3],
      flips: [false, false, false, false],
    };
    const s = colSums(bank, placement);
    // col0 = 3 + 5, col1 = 2 + 2, col2 = 4 + 3, col3 = 1 + 3
    expect(s).toEqual([8, 4, 7, 4]);
  });

  it("solve finds the known prototype puzzle", () => {
    const report = solve(
      [8, 4, 7, 4],
      [
        [3, 2],
        [4, 1],
        [5, 2],
        [3, 3],
      ],
      2,
    );
    expect(report.solvable).toBe(true);
  });

  it("solve reports unsolvable when targets cannot be met", () => {
    const report = solve(
      [12, 12, 12, 12],
      [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      2,
    );
    expect(report.solvable).toBe(false);
    expect(report.solutionCount).toBe(0);
  });

  it("isSolved requires all slots filled", () => {
    const p = getDailyPuzzle(START);
    const placement = solutionPlacement(p);
    expect(isSolved(p, placement)).toBe(true);
    const partial: Placement = { ...placement, slots: [...placement.slots] };
    partial.slots[0] = null;
    expect(isSolved(p, partial)).toBe(false);
  });

  it("getHint reveals an unplaced domino from the solution", () => {
    const p = getDailyPuzzle(START);
    const empty: Placement = {
      slots: new Array(slotsFor(configOf(p))).fill(null),
      flips: new Array(slotsFor(configOf(p))).fill(false),
    };
    const hint = getHint(p, empty);
    expect(hint).not.toBeNull();
    // The revealed hint must match the stored solution exactly.
    expect(hint!.slot).toBe(p.solution[hint!.id].slot);
    expect(hint!.flip).toBe(p.solution[hint!.id].flip);
  });

  it("getHint skips already-correct dominoes and returns null when solved", () => {
    const p = getDailyPuzzle(START);
    const solved = solutionPlacement(p);
    // Fully solved board: nothing left to reveal.
    expect(getHint(p, solved)).toBeNull();

    // Remove just the first solution domino: that exact one is returned next.
    const id0 = 0;
    const { slot: slot0 } = p.solution[id0];
    const partial: Placement = {
      slots: [...solved.slots],
      flips: [...solved.flips],
    };
    partial.slots[slot0] = null;
    const hint = getHint(p, partial);
    expect(hint).not.toBeNull();
    expect(hint!.id).toBe(id0);
    expect(hint!.slot).toBe(slot0);
    expect(hint!.flip).toBe(p.solution[id0].flip);
  });

  it("is deterministic per date and difficulty", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.targets).toEqual(b.targets);
    expect(a.bank).toEqual(b.bank);
    expect(a.solution).toEqual(b.solution);

    for (const d of DIFFICULTIES) {
      const x = getDailyPuzzle("2025-03-14", d);
      const y = getDailyPuzzle("2025-03-14", d);
      expect(x.bank).toEqual(y.bank);
      expect(x.targets).toEqual(y.targets);
      expect(x.solution).toEqual(y.solution);
    }
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(
      JSON.stringify([a.targets, a.bank]) !== JSON.stringify([b.targets, b.bank]),
    ).toBe(true);
  });

  it("each tier yields a distinct puzzle on the same day", () => {
    const date = "2025-05-20";
    const e = getDailyPuzzle(date, "easy");
    const m = getDailyPuzzle(date, "medium");
    const h = getDailyPuzzle(date, "hard");
    const key = (p: PipsPuzzle) => JSON.stringify([p.targets, p.bank, p.config]);
    expect(key(e)).not.toBe(key(m));
    expect(key(m)).not.toBe(key(h));
    expect(key(e)).not.toBe(key(h));
  });
});

const TIER_CONFIG = DIFFICULTY_CONFIG;

describe("pips difficulty tiers", () => {
  it("tier board shapes escalate (size + domino + column count)", () => {
    const e = TIER_CONFIG.easy;
    const m = TIER_CONFIG.medium;
    const h = TIER_CONFIG.hard;
    // Domino/slot count strictly escalates easy < medium < hard.
    expect(slotsFor(e)).toBeLessThan(slotsFor(m));
    expect(slotsFor(m)).toBeLessThan(slotsFor(h));
    // Column count is non-decreasing and strictly grows by hard.
    expect(colsFor(e)).toBeLessThanOrEqual(colsFor(m));
    expect(colsFor(m)).toBeLessThan(colsFor(h));
    // Concrete intended shapes.
    expect(slotsFor(e)).toBe(2);
    expect(slotsFor(m)).toBe(4);
    expect(slotsFor(h)).toBe(6);
    expect(colsFor(h)).toBe(6);
  });

  for (const tier of DIFFICULTIES) {
    it(`every ${tier} puzzle across ${SAMPLE} days is well-formed, solvable and valid`, () => {
      const cfg = TIER_CONFIG[tier as Difficulty];
      const cols = colsFor(cfg);
      const n = slotsFor(cfg);
      let date = START;
      for (let i = 0; i < SAMPLE; i++) {
        const p = getDailyPuzzle(date, tier);

        // tier-correct shape
        expect(p.difficulty, `difficulty tag on ${date}/${tier}`).toBe(tier);
        expect(p.targets.length, `targets on ${date}/${tier}`).toBe(cols);
        expect(p.bank.length, `bank on ${date}/${tier}`).toBe(n);
        expect(p.solution.length, `solution on ${date}/${tier}`).toBe(n);

        // faces in range
        for (const d of p.bank) {
          for (const f of d) {
            expect(f).toBeGreaterThanOrEqual(MIN_FACE);
            expect(f).toBeLessThanOrEqual(MAX_FACE);
          }
        }

        // stored solution actually solves it
        const placement = solutionPlacement(p);
        expect(isSolved(p, placement), `stored solution wrong on ${date}/${tier}`).toBe(
          true,
        );

        // solvable (validator's core guarantee)
        const report = solve(p.targets, p.bank, 2, cfg);
        expect(report.solvable, `not solvable on ${date}/${tier}`).toBe(true);

        // module validator agrees
        expect(validatePips(p), `validator failed on ${date}/${tier}`).toBe(true);

        date = addDays(date, 1);
      }
    });
  }
});

describe("pips daily puzzles are solvable", () => {
  it(`every default (medium) puzzle across ${SAMPLE} days is well-formed, solvable and uniquely solved`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      // shape
      expect(p.targets.length, `targets on ${date}`).toBe(COLS);
      expect(p.bank.length, `bank on ${date}`).toBe(DOMINOES);
      expect(p.solution.length, `solution on ${date}`).toBe(DOMINOES);

      // faces in range
      for (const d of p.bank) {
        for (const f of d) {
          expect(f).toBeGreaterThanOrEqual(MIN_FACE);
          expect(f).toBeLessThanOrEqual(MAX_FACE);
        }
      }

      // stored solution actually solves it
      const placement = solutionPlacement(p);
      expect(isSolved(p, placement), `stored solution wrong on ${date}`).toBe(true);

      // exactly one solution (unique)
      const report = solve(p.targets, p.bank, 2);
      expect(report.solvable, `not solvable on ${date}`).toBe(true);
      expect(report.unique, `not unique on ${date}`).toBe(true);

      // module validator agrees
      expect(validatePips(p), `validator failed on ${date}`).toBe(true);

      date = addDays(date, 1);
    }
  });

  it("validatePips rejects malformed puzzles", () => {
    const p = getDailyPuzzle(START);
    expect(validatePips({ ...p, targets: [0, 0, 0] })).toBe(false);
    expect(
      validatePips({ ...p, bank: [...p.bank.slice(0, 3), [9, 9] as Domino] }),
    ).toBe(false);
    // corrupt the solution so it no longer satisfies targets
    const badSolution = p.solution.map((s) => ({ ...s, flip: !s.flip }));
    const corrupted = { ...p, solution: badSolution };
    // flipping every domino almost never preserves all 4 column targets
    if (isSolved({ ...p }, solutionPlacement({ ...p, solution: badSolution } as typeof p))) {
      // extremely rare symmetric case — skip
    } else {
      expect(validatePips(corrupted)).toBe(false);
    }
  });

  // sanity: legacy slot count constant referenced
  it("has four slots on the default board", () => {
    expect(SLOTS).toBe(4);
  });
});
