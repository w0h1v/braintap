import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import { DIFFICULTIES } from "@/lib/difficulty";
import { getDailyPuzzle } from "./generator";
import {
  problemAt,
  applyOp,
  isValidProblem,
  validateMathSprint,
  scoreToNormalised,
  isWin,
  paramsFor,
  PARAMS_BY_DIFFICULTY,
  type Op,
  type SprintParams,
} from "./engine";

const START = "2025-01-01";
const DAYS = 200; // ≥180 consecutive days
const VALID_OPS: Op[] = ["+", "-", "x", "/"];

describe("mathsprint determinism", () => {
  it("getDailyPuzzle returns the same puzzle for a date + difficulty", () => {
    for (const d of DIFFICULTIES) {
      const a = getDailyPuzzle("2025-03-14", d);
      const b = getDailyPuzzle("2025-03-14", d);
      expect(a).toEqual(b);
    }
  });

  it("problemAt is deterministic for the same seed + ordinal", () => {
    const params = paramsFor("hard");
    for (let n = 0; n < 50; n++) {
      expect(problemAt(12345, n, params)).toEqual(problemAt(12345, n, params));
    }
  });

  it("different tiers differ on the same date", () => {
    const easy = getDailyPuzzle("2025-05-05", "easy");
    const hard = getDailyPuzzle("2025-05-05", "hard");
    expect(easy.seed).not.toBe(hard.seed);
    expect(easy.params).not.toEqual(hard.params);
  });
});

describe("mathsprint solvable", () => {
  // The procedural winnability proof: for each tier, across ≥180 consecutive
  // days, every problem the round can present (goal + buffer) is well-formed and
  // answerable with an exact integer — so a player CAN reach the goal.
  it("every problem in every daily round is solvable (exact, in-range)", () => {
    for (const d of DIFFICULTIES) {
      const params = paramsFor(d);
      const need = params.goal + 8;
      for (let i = 0; i < DAYS; i++) {
        const dateISO = addDays(START, i);
        const puzzle = getDailyPuzzle(dateISO, d);
        for (let ord = 0; ord < need; ord++) {
          const prob = problemAt(puzzle.seed, ord, params);

          // exact integer answer, recomputed
          expect(Number.isInteger(prob.answer)).toBe(true);
          expect(applyOp(prob.a, prob.b, prob.op)).toBe(prob.answer);

          // op in the tier pool
          expect(params.ops).toContain(prob.op);

          // operands within declared ranges, per op
          if (prob.op === "+" || prob.op === "-") {
            expect(prob.a).toBeGreaterThanOrEqual(params.addSubMin);
            expect(prob.a).toBeLessThanOrEqual(params.addSubMax);
            expect(prob.b).toBeGreaterThanOrEqual(params.addSubMin);
            expect(prob.b).toBeLessThanOrEqual(params.addSubMax);
            if (prob.op === "-" && !params.allowNegative) {
              expect(prob.answer).toBeGreaterThanOrEqual(0);
            }
          } else if (prob.op === "x") {
            expect(prob.a).toBeGreaterThanOrEqual(params.mulMin);
            expect(prob.a).toBeLessThanOrEqual(params.mulMax);
            expect(prob.b).toBeGreaterThanOrEqual(params.mulMin);
            expect(prob.b).toBeLessThanOrEqual(params.mulMax);
          } else {
            // division: exact, divisor + quotient in range
            expect(prob.a).toBe(prob.b * prob.answer);
            expect(prob.b).toBeGreaterThanOrEqual(params.divDMin);
            expect(prob.b).toBeLessThanOrEqual(params.divDMax);
            expect(prob.answer).toBeGreaterThanOrEqual(params.divQMin);
            expect(prob.answer).toBeLessThanOrEqual(params.divQMax);
          }

          // prompt non-empty and consistent with operands
          expect(prob.prompt.length).toBeGreaterThan(0);
          expect(prob.prompt).toContain(String(prob.a));
          expect(prob.prompt).toContain(String(prob.b));

          // and the engine's own predicate agrees
          expect(isValidProblem(prob, params)).toBe(true);
        }
      }
    }
  });
});

describe("mathsprint validatePuzzle", () => {
  it("returns true for every generated daily/tier puzzle across the sample", () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < DAYS; i++) {
        const puzzle = getDailyPuzzle(addDays(START, i), d);
        expect(validateMathSprint(puzzle)).toBe(true);
      }
    }
  });

  it("rejects malformed puzzles", () => {
    const good = getDailyPuzzle("2025-02-02", "medium");
    // mismatched weights length
    expect(
      validateMathSprint({
        ...good,
        params: { ...good.params, opWeights: [1] },
      }),
    ).toBe(false);
    // inverted range
    expect(
      validateMathSprint({
        ...good,
        params: { ...good.params, addSubMin: 99, addSubMax: 1 },
      }),
    ).toBe(false);
    // bad op in pool
    expect(
      validateMathSprint({
        ...good,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        params: { ...good.params, ops: ["?" as any], opWeights: [1] },
      }),
    ).toBe(false);
    // zero divisor min
    expect(
      validateMathSprint({ ...good, params: { ...good.params, divDMin: 0 } }),
    ).toBe(false);
  });
});

describe("mathsprint escalation invariants", () => {
  const easy = PARAMS_BY_DIFFICULTY.easy;
  const medium = PARAMS_BY_DIFFICULTY.medium;
  const hard = PARAMS_BY_DIFFICULTY.hard;
  const maxOperand = (p: SprintParams) => Math.max(p.addSubMax, p.mulMax, p.divQMax * p.divDMax);

  it("operand max is non-decreasing easy → hard", () => {
    expect(maxOperand(medium)).toBeGreaterThanOrEqual(maxOperand(easy));
    expect(maxOperand(hard)).toBeGreaterThanOrEqual(maxOperand(medium));
  });

  it("ops.length is non-decreasing easy → hard", () => {
    expect(medium.ops.length).toBeGreaterThanOrEqual(easy.ops.length);
    expect(hard.ops.length).toBeGreaterThanOrEqual(medium.ops.length);
  });

  it("goal is non-decreasing easy → hard", () => {
    expect(medium.goal).toBeGreaterThanOrEqual(easy.goal);
    expect(hard.goal).toBeGreaterThanOrEqual(medium.goal);
  });

  it("duration increases with difficulty (more time offsets harder problems)", () => {
    expect(easy.durationSec).toBe(60);
    expect(medium.durationSec).toBe(75);
    expect(hard.durationSec).toBe(90);
  });

  it("ops ⊆ {+,-,x,/} for every tier", () => {
    for (const p of [easy, medium, hard]) {
      expect(p.ops.every((o) => VALID_OPS.includes(o))).toBe(true);
    }
  });

  it("easy never produces negative answers across the sample", () => {
    const params = paramsFor("easy");
    const puzzle = getDailyPuzzle("2025-06-06", "easy");
    for (let ord = 0; ord < 200; ord++) {
      expect(problemAt(puzzle.seed, ord, params).answer).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("mathsprint scoring", () => {
  it("scoreToNormalised(0) is 0 and is monotonic, capped at 100", () => {
    expect(scoreToNormalised(0)).toBe(0);
    let prev = -1;
    for (let s = 0; s <= 40; s++) {
      const v = scoreToNormalised(s);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(100);
      prev = v;
    }
    expect(scoreToNormalised(1000)).toBe(100);
  });

  it("isWin is true iff score >= goal", () => {
    const params = paramsFor("hard");
    expect(isWin(params.goal - 1, params)).toBe(false);
    expect(isWin(params.goal, params)).toBe(true);
    expect(isWin(params.goal + 5, params)).toBe(true);
  });
});
