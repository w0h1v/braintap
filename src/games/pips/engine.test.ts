import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
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
  type Placement,
  type Domino,
} from "./engine";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // >180 days as required

/** Build the canonical placement from a puzzle's stored solution. */
function solutionPlacement(p: ReturnType<typeof getDailyPuzzle>): Placement {
  const slots: (number | null)[] = [null, null, null, null];
  const flips = [false, false, false, false];
  for (let id = 0; id < DOMINOES; id++) {
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
      slots: [null, null, null, null],
      flips: [false, false, false, false],
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

  it("is deterministic per date", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.targets).toEqual(b.targets);
    expect(a.bank).toEqual(b.bank);
    expect(a.solution).toEqual(b.solution);
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(
      JSON.stringify([a.targets, a.bank]) !== JSON.stringify([b.targets, b.bank]),
    ).toBe(true);
  });
});

describe("pips daily puzzles are solvable", () => {
  it(`every puzzle across ${SAMPLE} days is well-formed, solvable and uniquely solved`, () => {
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

  // sanity: slot count constant referenced
  it("has four slots", () => {
    expect(SLOTS).toBe(4);
  });
});
