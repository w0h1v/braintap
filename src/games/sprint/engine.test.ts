import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import { rngFromString } from "@/lib/rng";
import type { Difficulty } from "@/lib/types";
import {
  CELLS,
  MIN_CELL,
  MAX_CELL,
  PARAMS_BY_DIFFICULTY,
  paramsFor,
  sumOf,
  pickTarget,
  hasSubsetSum,
  scoreToNormalised,
  tierTitle,
  shareGrid,
  buildShareText,
  isWin,
  validateSprint,
  type SprintParams,
  type SprintPuzzle,
} from "./engine";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // > 180 days of daily puzzles
const TIERS: Difficulty[] = ["easy", "medium", "hard"];

/** Mirror the component's deterministic target RNG. */
function targetRng(seed: number, issued: number) {
  return rngFromString(`sprint-target:${seed}:${issued}`);
}

/**
 * Simulate a full sprint by always clearing every target via its known cells,
 * refilling from the deterministic stream, and issuing the next target the same
 * way the component does. Returns the number of targets verified solvable.
 */
function simulate(p: SprintPuzzle, rounds: number): number {
  const params = p.params;
  const grid = p.grid.slice();
  let target = p.firstTarget;
  let cells = p.firstTargetCells.slice();
  let issued = 1;
  let ptr = 0;
  let cleared = 0;

  for (let n = 0; n < rounds; n++) {
    // The current target must be reachable from the live grid within tier sizes.
    expect(
      hasSubsetSum(grid, target, params.minTargetCells, params.maxTargetCells),
      `unsolvable target ${target}`,
    ).toBe(true);
    // The known solution cells must actually sum to it.
    expect(sumOf(grid, cells)).toBe(target);
    // And the solution cell count stays within the tier's allowed range.
    expect(cells.length).toBeGreaterThanOrEqual(params.minTargetCells);
    expect(cells.length).toBeLessThanOrEqual(params.maxTargetCells);

    // Clear it: replace those cells from the refill stream.
    for (const id of cells) {
      grid[id] = p.refill[ptr % p.refill.length];
      ptr += 1;
    }
    cleared += 1;

    // Issue the next target the way the component does (params-aware).
    issued += 1;
    const rng = targetRng(p.seed, issued);
    const picked = pickTarget(grid, rng, params);
    target = picked.target;
    cells = picked.cells;
  }
  return cleared;
}

describe("sprint engine", () => {
  it("sumOf and hasSubsetSum agree on a known board", () => {
    const grid = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 6, 7];
    expect(sumOf(grid, [0, 1])).toBe(3);
    expect(hasSubsetSum(grid, 3)).toBe(true); // 1+2
    expect(hasSubsetSum(grid, 6)).toBe(true); // 1+2+3
    expect(hasSubsetSum(grid, 1)).toBe(false); // no 2/3-cell subset sums to 1
  });

  it("hasSubsetSum honours min/max subset size bounds", () => {
    const grid = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3, 4, 5, 6, 7];
    // 4-cell subset 1+2+3+4 = 10 only found when maxK allows 4 cells.
    expect(hasSubsetSum(grid, 10, 2, 3)).toBe(true); // 1+2+7 etc.
    // A single cell value is never matched at minK=2.
    expect(hasSubsetSum(grid, 9, 2, 4)).toBe(true); // many 2-cell sums
    // Requiring exactly larger subsets still resolves over 16 cells.
    expect(hasSubsetSum(grid, 100, 2, 4)).toBe(false); // unreachable
  });

  it("pickTarget returns cells within the tier range that sum to the target", () => {
    const grid = Array.from({ length: CELLS }, (_, i) => (i % 9) + 1);
    for (const tier of TIERS) {
      const params = paramsFor(tier);
      const rng = rngFromString(`pick-test:${tier}`);
      for (let i = 0; i < 50; i++) {
        const { target, cells } = pickTarget(grid, rng, params);
        expect(cells.length).toBeGreaterThanOrEqual(params.minTargetCells);
        expect(cells.length).toBeLessThanOrEqual(params.maxTargetCells);
        expect(sumOf(grid, cells)).toBe(target);
        expect(
          hasSubsetSum(grid, target, params.minTargetCells, params.maxTargetCells),
        ).toBe(true);
      }
    }
  });

  it("getDailyPuzzle is deterministic per (date, difficulty)", () => {
    for (const tier of TIERS) {
      const a = getDailyPuzzle("2025-03-14", tier);
      const b = getDailyPuzzle("2025-03-14", tier);
      expect(a.grid).toEqual(b.grid);
      expect(a.firstTarget).toBe(b.firstTarget);
      expect(a.refill).toEqual(b.refill);
      expect(a.seed).toBe(b.seed);
      expect(a.difficulty).toBe(tier);
    }
    // omitting the difficulty yields the medium tier
    const def = getDailyPuzzle("2025-03-14");
    const med = getDailyPuzzle("2025-03-14", "medium");
    expect(def.grid).toEqual(med.grid);
    expect(def.difficulty).toBe("medium");
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.grid).not.toEqual(b.grid);
  });

  it("each tier yields a different daily puzzle from the others", () => {
    const easy = getDailyPuzzle("2025-03-14", "easy");
    const med = getDailyPuzzle("2025-03-14", "medium");
    const hard = getDailyPuzzle("2025-03-14", "hard");
    expect(easy.grid).not.toEqual(med.grid);
    expect(med.grid).not.toEqual(hard.grid);
    expect(easy.grid).not.toEqual(hard.grid);
  });

  it("tier parameters escalate as intended", () => {
    const e = PARAMS_BY_DIFFICULTY.easy;
    const m = PARAMS_BY_DIFFICULTY.medium;
    const h = PARAMS_BY_DIFFICULTY.hard;
    // larger numbers as tiers rise
    expect(e.maxDigit).toBeLessThan(m.maxDigit);
    expect(m.maxDigit).toBeLessThan(h.maxDigit);
    // more operands (cells per target) as tiers rise
    expect(e.maxTargetCells).toBeLessThanOrEqual(m.maxTargetCells);
    expect(m.maxTargetCells).toBeLessThan(h.maxTargetCells);
    // a stiffer clear goal as tiers rise
    expect(e.goal).toBeLessThan(m.goal);
    expect(m.goal).toBeLessThan(h.goal);
    // every tier stays inside the global digit bounds
    for (const p of [e, m, h]) {
      expect(p.minDigit).toBeGreaterThanOrEqual(MIN_CELL);
      expect(p.maxDigit).toBeLessThanOrEqual(MAX_CELL);
    }
  });

  it("isWin gates on the tier goal", () => {
    expect(isWin(2, PARAMS_BY_DIFFICULTY.easy)).toBe(false);
    expect(isWin(3, PARAMS_BY_DIFFICULTY.easy)).toBe(true);
    expect(isWin(4, PARAMS_BY_DIFFICULTY.medium)).toBe(false);
    expect(isWin(5, PARAMS_BY_DIFFICULTY.medium)).toBe(true);
    expect(isWin(6, PARAMS_BY_DIFFICULTY.hard)).toBe(false);
    expect(isWin(7, PARAMS_BY_DIFFICULTY.hard)).toBe(true);
  });

  it("scoring helpers behave sensibly", () => {
    expect(scoreToNormalised(0)).toBe(0);
    expect(scoreToNormalised(12)).toBe(100);
    expect(scoreToNormalised(24)).toBe(100); // capped
    expect(scoreToNormalised(6)).toBe(50);
    expect(tierTitle(0)).toBe("Warm-up done.");
    expect(tierTitle(3)).toBe("Solid run.");
    expect(tierTitle(7)).toBe("Quick thinker.");
    expect(tierTitle(12)).toBe("Lightning math.");
    expect(shareGrid(0).length).toBe(shareGrid(1).length); // min 1 square
    expect([...shareGrid(99)].length).toBe(12); // capped at 12
    expect(buildShareText(1)).toContain("1 target in 60s");
    expect(buildShareText(5)).toContain("5 targets in 60s");
  });
});

describe(`sprint daily puzzles are always solvable across ${SAMPLE} days`, () => {
  it("every issued target is reachable for a full simulated 60s run at every tier", () => {
    for (const tier of TIERS) {
      const params = paramsFor(tier);
      let date = START;
      for (let d = 0; d < SAMPLE; d++) {
        const p = getDailyPuzzle(date, tier);

        // Well-formed + validator agrees.
        expect(p.grid.length).toBe(CELLS);
        expect(p.difficulty).toBe(tier);
        expect(
          p.grid.every(
            (v) => Number.isInteger(v) && v >= params.minDigit && v <= params.maxDigit,
          ),
          `bad digits on ${date} (${tier})`,
        ).toBe(true);
        expect(validateSprint(p), `validator failed on ${date} (${tier})`).toBe(true);

        // Simulate a fast 60s run: clearing ~60 targets is far beyond human
        // pace, proving the target stream stays solvable for a full round.
        const cleared = simulate(p, 60);
        expect(cleared).toBe(60);

        date = addDays(date, 1);
      }
    }
  });

  it("validateSprint rejects malformed puzzles", () => {
    const good = getDailyPuzzle(START, "medium");
    expect(validateSprint(good)).toBe(true);

    const badGrid: SprintPuzzle = { ...good, grid: good.grid.slice(0, 10) };
    expect(validateSprint(badGrid)).toBe(false);

    const badDigit: SprintPuzzle = {
      ...good,
      grid: good.grid.map((_, i) => (i === 0 ? 99 : good.grid[i])),
    };
    expect(validateSprint(badDigit)).toBe(false);

    const badTarget: SprintPuzzle = { ...good, firstTarget: 999 };
    expect(validateSprint(badTarget)).toBe(false);

    const badCells: SprintPuzzle = { ...good, firstTargetCells: [0] };
    expect(validateSprint(badCells)).toBe(false);

    // out-of-range tier params are rejected
    const badParams: SprintPuzzle = {
      ...good,
      params: { ...good.params, maxDigit: 99 } as SprintParams,
    };
    expect(validateSprint(badParams)).toBe(false);
  });

  it("validateSprint tolerates an older puzzle shape without params", () => {
    const good = getDailyPuzzle(START, "medium");
    // Older serialized puzzles lacked `params`/`difficulty`; the validator must
    // fall back to the medium default and still accept a valid medium board.
    const legacy = { ...good } as Partial<SprintPuzzle> & SprintPuzzle;
    // @ts-expect-error simulate a legacy shape missing params
    delete legacy.params;
    expect(validateSprint(legacy)).toBe(true);
  });
});
