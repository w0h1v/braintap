import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import type { Difficulty } from "@/lib/types";
import {
  GRID,
  ROWS,
  COLS,
  cellIdx,
  applyRule,
  computeLayer,
  satisfiesAllRules,
  candidateSatisfiesRule,
  tilesEqual,
  validateMatrix,
  TIERS,
  ATTR_KEYS,
  type Rule,
  type Tile,
} from "./engine";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // ~6+ months of daily puzzles (>=180 required)
const TIERS_LIST: Difficulty[] = ["easy", "medium", "hard"];
const TIER_DAYS = 120; // consecutive days checked per tier

describe("matrix engine helpers", () => {
  it("applyRule reproduces a known progression case (row axis, step 1)", () => {
    const rule: Rule = { attr: "count", kind: "progression", axis: "row", step: 1, modulo: 4 };
    // base 1 at (0,0): cols 0,1,2 => 1,2,3
    expect(applyRule(rule, 1, 0, 0)).toBe(1);
    expect(applyRule(rule, 1, 0, 1)).toBe(2);
    expect(applyRule(rule, 1, 0, 2)).toBe(3);
    // wraps with modulo
    expect(applyRule(rule, 3, 0, 2)).toBe((3 + 2) % 4);
  });

  it("computeLayer reproduces an arithmetic count case", () => {
    const rule: Rule = { attr: "count", kind: "arithmetic", axis: "row", modulo: 4 };
    const grid: Tile[] = Array.from({ length: GRID }, () => ({
      shape: 0,
      count: 0,
      rotation: 0,
      fill: 0,
      color: 0,
    }));
    grid[cellIdx(0, 0)].count = 1;
    grid[cellIdx(0, 1)].count = 2;
    const layer = computeLayer(rule, 0, grid);
    expect(layer[cellIdx(0, 2)]).toBe(3); // 1 + 2
  });

  it("computeLayer reproduces a distinct (Latin) case: every row/col a permutation", () => {
    const rule: Rule = { attr: "shape", kind: "distinct", axis: "row", modulo: 3 };
    const layer = computeLayer(rule, 0);
    for (let r = 0; r < ROWS; r++) {
      const row = [layer[cellIdx(r, 0)], layer[cellIdx(r, 1)], layer[cellIdx(r, 2)]];
      expect(new Set(row).size).toBe(3);
    }
    for (let c = 0; c < COLS; c++) {
      const col = [layer[cellIdx(0, c)], layer[cellIdx(1, c)], layer[cellIdx(2, c)]];
      expect(new Set(col).size).toBe(3);
    }
  });
});

describe("matrix generator is deterministic", () => {
  it("same (date, tier) yields an identical puzzle", () => {
    const a = getDailyPuzzle("2025-03-14", "medium");
    const b = getDailyPuzzle("2025-03-14", "medium");
    expect(a.cells).toEqual(b.cells);
    expect(a.options).toEqual(b.options);
    expect(a.answerIndex).toBe(b.answerIndex);
    expect(a.rules).toEqual(b.rules);
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14", "medium");
    const b = getDailyPuzzle("2025-03-15", "medium");
    const same =
      JSON.stringify(a.cells) === JSON.stringify(b.cells) &&
      JSON.stringify(a.options) === JSON.stringify(b.options);
    expect(same).toBe(false);
  });

  it("different tiers differ on a given day", () => {
    const easy = getDailyPuzzle("2025-03-14", "easy");
    const hard = getDailyPuzzle("2025-03-14", "hard");
    expect(easy.optionCount).not.toBe(hard.optionCount);
  });
});

describe("matrix daily puzzles are solvable (solvable across days + tiers)", () => {
  it(`every default puzzle across ${SAMPLE} days is well-formed + uniquely winnable`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      expect(validateMatrix(p), `validator failed on ${date}`).toBe(true);

      // exactly one option satisfies all rules
      const satisfying = p.options.filter((o) => satisfiesAllRules(p.rules, p.cells, o));
      expect(satisfying.length, `not uniquely winnable on ${date}`).toBe(1);

      // answerIndex points at the satisfying option and equals cells[8]
      expect(tilesEqual(p.options[p.answerIndex], p.cells[GRID - 1]), `answer mismatch on ${date}`).toBe(
        true,
      );
      expect(satisfiesAllRules(p.rules, p.cells, p.options[p.answerIndex])).toBe(true);

      // options pairwise distinct
      for (let a = 0; a < p.options.length; a++) {
        for (let b = a + 1; b < p.options.length; b++) {
          expect(tilesEqual(p.options[a], p.options[b]), `dup options on ${date}`).toBe(false);
        }
      }

      date = addDays(date, 1);
    }
  });

  it(`every tier across ${TIER_DAYS} consecutive days is well-formed + uniquely winnable`, () => {
    for (const d of TIERS_LIST) {
      const cfg = TIERS[d];
      let date = START;
      for (let i = 0; i < TIER_DAYS; i++) {
        const p = getDailyPuzzle(date, d);

        expect(validateMatrix(p), `${d} validator failed on ${date}`).toBe(true);
        expect(p.optionCount, `${d} optionCount on ${date}`).toBe(cfg.optionCount);
        expect(p.options.length, `${d} options.length on ${date}`).toBe(cfg.optionCount);
        expect(p.strikes, `${d} strikes on ${date}`).toBe(cfg.strikes);

        const satisfying = p.options.filter((o) => satisfiesAllRules(p.rules, p.cells, o));
        expect(satisfying.length, `${d} not uniquely winnable on ${date}`).toBe(1);
        expect(p.answerIndex, `${d} answerIndex range on ${date}`).toBeGreaterThanOrEqual(0);
        expect(p.answerIndex).toBeLessThan(p.options.length);

        // rules: distinct attributes, arithmetic only on count
        const seen = new Set<string>();
        for (const rule of p.rules) {
          expect(seen.has(rule.attr), `${d} dup rule attr on ${date}`).toBe(false);
          seen.add(rule.attr);
          if (rule.kind === "arithmetic") expect(rule.attr).toBe("count");
        }
        // at least one row-axis rule
        expect(p.rules.some((r) => r.axis === "row"), `${d} no row rule on ${date}`).toBe(true);

        date = addDays(date, 1);
      }
    }
  });
});

describe("matrix tier shape", () => {
  it("easy has fewer options than hard; hard never has fewer rules than easy (avg)", () => {
    let easyRules = 0;
    let hardRules = 0;
    let date = START;
    for (let i = 0; i < TIER_DAYS; i++) {
      const easy = getDailyPuzzle(date, "easy");
      const hard = getDailyPuzzle(date, "hard");
      expect(easy.options.length).toBeLessThan(hard.options.length);
      easyRules += easy.rules.length;
      hardRules += hard.rules.length;
      date = addDays(date, 1);
    }
    expect(hardRules / TIER_DAYS).toBeGreaterThanOrEqual(easyRules / TIER_DAYS);
  });

  it("hard guarantees at least one column-axis rule over the sweep", () => {
    let date = START;
    for (let i = 0; i < TIER_DAYS; i++) {
      const hard = getDailyPuzzle(date, "hard");
      expect(hard.rules.some((r) => r.axis === "col"), `no col rule on ${date}`).toBe(true);
      date = addDays(date, 1);
    }
  });
});

describe("matrix distractors", () => {
  it("every distractor fails at least one rule (only the answer satisfies all)", () => {
    let date = START;
    for (let i = 0; i < 90; i++) {
      for (const d of TIERS_LIST) {
        const p = getDailyPuzzle(date, d);
        for (let oi = 0; oi < p.options.length; oi++) {
          const ok = satisfiesAllRules(p.rules, p.cells, p.options[oi]);
          if (oi === p.answerIndex) expect(ok).toBe(true);
          else expect(ok, `distractor satisfied all rules on ${date}/${d}`).toBe(false);
        }
      }
      date = addDays(date, 1);
    }
  });
});

describe("matrix validateMatrix guards", () => {
  it("rejects a puzzle whose answerIndex points at a non-satisfying tile", () => {
    const p = getDailyPuzzle(START, "medium");
    const broken = {
      ...p,
      cells: p.cells.map((t) => ({ ...t })),
    };
    // corrupt the canonical answer cell so it no longer satisfies the rules
    const attr = p.rules[0].attr;
    const dom = attr === "color" ? p.paletteSize : 4;
    broken.cells[GRID - 1] = {
      ...broken.cells[GRID - 1],
      [attr]: (broken.cells[GRID - 1][attr] + 1) % dom,
    };
    expect(validateMatrix(broken)).toBe(false);
  });

  it("candidateSatisfiesRule agrees with the canonical answer", () => {
    const p = getDailyPuzzle(START, "hard");
    for (const rule of p.rules) {
      expect(candidateSatisfiesRule(rule, p.cells, p.cells[GRID - 1])).toBe(true);
    }
  });
});

// silence unused-import lint when constants drift.
void ATTR_KEYS;
