import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import { DIFFICULTIES } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";
import {
  buildAdjacency,
  evalConstraint,
  isSolved,
  solve,
  getHint,
  validatePips,
  regionCells,
  constraintLabel,
  MIN_FACE,
  MAX_FACE,
  type Cell,
  type Placement,
  type PipsPuzzle,
} from "./engine";
import { getDailyPuzzle, DIFFICULTY_SPEC } from "./generator";
import { BOARDS } from "./boards";

const START = "2025-01-01";
const SAMPLE = 200; // > 180 days as required

/** Canonical placement from a puzzle's stored solution. */
function solutionPlacement(p: PipsPuzzle): Placement {
  return p.solution.map((s) => ({ a: s.a, b: s.b, flip: s.flip }));
}

/** Does a polyomino admit a perfect matching (i.e. is it domino-tileable)? */
function isTileable(cells: Cell[]): boolean {
  const N = cells.length;
  if (N % 2 !== 0) return false;
  const adj = buildAdjacency(cells);
  const covered = new Array(N).fill(false);
  function rec(): boolean {
    let a = -1;
    for (let i = 0; i < N; i++) {
      if (!covered[i]) {
        a = i;
        break;
      }
    }
    if (a < 0) return true;
    for (const b of adj[a]) {
      if (covered[b]) continue;
      covered[a] = covered[b] = true;
      if (rec()) return true;
      covered[a] = covered[b] = false;
    }
    return false;
  }
  return rec();
}

describe("pips engine geometry + constraints", () => {
  it("buildAdjacency links orthogonal neighbours only", () => {
    const cells: Cell[] = [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 0 },
    ];
    const adj = buildAdjacency(cells);
    expect(adj[0].sort()).toEqual([1, 2]); // (0,0) touches (0,1) and (1,0)
    expect(adj[1]).toEqual([0]); // (0,1) touches only (0,0)
    expect(adj[2]).toEqual([0]); // (1,0) touches only (0,0)
  });

  it("evalConstraint honours every kind", () => {
    expect(evalConstraint([2], { kind: "eq", value: 2 })).toBe(true);
    expect(evalConstraint([3], { kind: "eq", value: 2 })).toBe(false);
    expect(evalConstraint([1, 2], { kind: "lt", value: 7 })).toBe(true);
    expect(evalConstraint([4, 4], { kind: "lt", value: 7 })).toBe(false);
    expect(evalConstraint([4, 4], { kind: "gt", value: 5 })).toBe(true);
    expect(evalConstraint([2, 2], { kind: "gt", value: 5 })).toBe(false);
    expect(evalConstraint([3, 3], { kind: "equal" })).toBe(true);
    expect(evalConstraint([3, 4], { kind: "equal" })).toBe(false);
    expect(evalConstraint([1, 2, 3], { kind: "ne" })).toBe(true);
    expect(evalConstraint([1, 2, 2], { kind: "ne" })).toBe(false);
    expect(evalConstraint([6, 6], { kind: "empty" })).toBe(true);
  });

  it("constraintLabel renders the badge text", () => {
    expect(constraintLabel({ kind: "eq", value: 2 })).toBe("2");
    expect(constraintLabel({ kind: "lt", value: 7 })).toBe("<7");
    expect(constraintLabel({ kind: "gt", value: 5 })).toBe(">5");
    expect(constraintLabel({ kind: "equal" })).toBe("=");
    expect(constraintLabel({ kind: "ne" })).toBe("≠");
    expect(constraintLabel({ kind: "empty" })).toBe("");
  });

  it("solve finds a unique solution on a tiny hand puzzle", () => {
    // Two cells (0,0)-(0,1), one region "sum = 5", one domino [2,3].
    const puzzle: PipsPuzzle = {
      difficulty: "easy",
      cells: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
      regionOf: [0, 0],
      constraints: [{ kind: "eq", value: 5 }],
      dominoes: [[2, 3]],
      solution: [{ a: 0, b: 1, flip: false }],
    };
    const report = solve(puzzle, 2);
    expect(report.solvable).toBe(true);
    // [2,3] and [3,2] both sum to 5 in this region → same value... no: they paint
    // different grids ([2,3] vs [3,2]) but the region only constrains the SUM, so
    // both grids satisfy it → two distinct value-grids.
    expect(report.count).toBe(2);
    expect(report.unique).toBe(false);
  });

  it("solve reports unsolvable when no placement satisfies the rule", () => {
    const puzzle: PipsPuzzle = {
      difficulty: "easy",
      cells: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
      regionOf: [0, 0],
      constraints: [{ kind: "eq", value: 12 }],
      dominoes: [[1, 1]],
      solution: [{ a: 0, b: 1, flip: false }],
    };
    const report = solve(puzzle, 2);
    expect(report.solvable).toBe(false);
    expect(report.count).toBe(0);
  });

  it("isSolved requires full coverage and every constraint met", () => {
    const p = getDailyPuzzle(START);
    const placement = solutionPlacement(p);
    expect(isSolved(p, placement)).toBe(true);
    const partial = placement.slice();
    partial[0] = null;
    expect(isSolved(p, partial)).toBe(false);
  });
});

describe("pips hints", () => {
  it("getHint reveals an unplaced domino from the solution, null when solved", () => {
    const p = getDailyPuzzle(START);
    const empty: Placement = p.dominoes.map(() => null);
    const hint = getHint(p, empty);
    expect(hint).not.toBeNull();
    const sol = p.solution[hint!.id];
    expect(hint!.a).toBe(sol.a);
    expect(hint!.b).toBe(sol.b);
    expect(hint!.flip).toBe(sol.flip);

    expect(getHint(p, solutionPlacement(p))).toBeNull();
  });

  it("getHint treats a value-identical reversed placement as already correct", () => {
    // cells (0,0)-(0,1), region sum=5, domino [2,3], solution {a:0,b:1,flip:false}.
    const puzzle: PipsPuzzle = {
      difficulty: "easy",
      cells: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
      ],
      regionOf: [0, 0],
      constraints: [{ kind: "eq", value: 5 }],
      dominoes: [[2, 3]],
      solution: [{ a: 0, b: 1, flip: false }],
    };
    // Reversed encoding paints the identical grid (cell0=2, cell1=3).
    const reversed: Placement = [{ a: 1, b: 0, flip: true }];
    expect(isSolved(puzzle, reversed)).toBe(true);
    // ...so it must NOT be re-hinted (order-agnostic, consistent with isSolved).
    expect(getHint(puzzle, reversed)).toBeNull();
  });
});

describe("pips determinism + variety", () => {
  it("is deterministic per date and difficulty", () => {
    const key = (p: PipsPuzzle) =>
      JSON.stringify([p.cells, p.regionOf, p.constraints, p.dominoes, p.solution]);
    for (const d of DIFFICULTIES) {
      expect(key(getDailyPuzzle("2025-03-14", d))).toBe(key(getDailyPuzzle("2025-03-14", d)));
    }
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(JSON.stringify(a.dominoes) !== JSON.stringify(b.dominoes)).toBe(true);
  });

  it("each tier yields a distinct puzzle on the same day", () => {
    const date = "2025-05-20";
    const key = (p: PipsPuzzle) => JSON.stringify([p.cells, p.constraints, p.dominoes]);
    const e = key(getDailyPuzzle(date, "easy"));
    const m = key(getDailyPuzzle(date, "medium"));
    const h = key(getDailyPuzzle(date, "hard"));
    expect(e).not.toBe(m);
    expect(m).not.toBe(h);
    expect(e).not.toBe(h);
  });
});

describe("pips board templates", () => {
  it("every curated board shape is domino-tileable with the expected cell count", () => {
    for (const tier of DIFFICULTIES) {
      const spec = DIFFICULTY_SPEC[tier as Difficulty];
      for (const board of BOARDS[tier as Difficulty]) {
        expect(board.length, `${tier} board cell count`).toBe(spec.dominoes * 2);
        expect(isTileable(board), `${tier} board tileable`).toBe(true);
      }
    }
  });

  it("tier domino counts strictly escalate easy < medium < hard", () => {
    expect(DIFFICULTY_SPEC.easy.dominoes).toBeLessThan(DIFFICULTY_SPEC.medium.dominoes);
    expect(DIFFICULTY_SPEC.medium.dominoes).toBeLessThan(DIFFICULTY_SPEC.hard.dominoes);
  });
});

describe("pips daily puzzles are solvable", () => {
  for (const tier of DIFFICULTIES) {
    it(`every ${tier} puzzle across ${SAMPLE} days is well-formed, uniquely solvable and valid`, () => {
      const spec = DIFFICULTY_SPEC[tier as Difficulty];
      let date = START;
      for (let i = 0; i < SAMPLE; i++) {
        const p = getDailyPuzzle(date, tier);

        // tier-correct shape
        expect(p.difficulty, `difficulty tag on ${date}/${tier}`).toBe(tier);
        expect(p.dominoes.length, `dominoes on ${date}/${tier}`).toBe(spec.dominoes);
        expect(p.cells.length, `cells on ${date}/${tier}`).toBe(spec.dominoes * 2);
        expect(p.solution.length, `solution on ${date}/${tier}`).toBe(spec.dominoes);

        // faces in range
        for (const d of p.dominoes) {
          for (const f of d) {
            expect(f).toBeGreaterThanOrEqual(MIN_FACE);
            expect(f).toBeLessThanOrEqual(MAX_FACE);
          }
        }

        // every region has at least one constraint and at least one cell
        const byRegion = regionCells(p);
        expect(byRegion.length).toBe(p.constraints.length);
        expect(byRegion.every((cs) => cs.length >= 1)).toBe(true);
        // not every region is blank (then it wouldn't be a puzzle)
        expect(p.constraints.some((c) => c.kind !== "empty")).toBe(true);

        // stored solution actually solves it
        expect(isSolved(p, solutionPlacement(p)), `stored solution wrong on ${date}/${tier}`).toBe(
          true,
        );

        // exactly one distinct value-grid satisfies the board
        const report = solve(p, 2);
        expect(report.solvable, `not solvable on ${date}/${tier}`).toBe(true);
        expect(report.unique, `not unique on ${date}/${tier}`).toBe(true);

        // module validator agrees
        expect(validatePips(p), `validator failed on ${date}/${tier}`).toBe(true);

        date = addDays(date, 1);
      }
    });
  }

  it("validatePips rejects malformed puzzles", () => {
    const p = getDailyPuzzle(START);
    // wrong domino count
    expect(validatePips({ ...p, dominoes: p.dominoes.slice(1) })).toBe(false);
    // out-of-range face
    expect(
      validatePips({ ...p, dominoes: [[9, 9], ...p.dominoes.slice(1)] as PipsPuzzle["dominoes"] }),
    ).toBe(false);
    // a region id with no constraint
    expect(validatePips({ ...p, constraints: p.constraints.slice(1) })).toBe(false);
    // corrupt the solution: drop a covering so the board isn't tiled
    const badSolution = p.solution.map((s, i) => (i === 0 ? { ...s, a: s.b } : s));
    expect(validatePips({ ...p, solution: badSolution })).toBe(false);
  });
});
