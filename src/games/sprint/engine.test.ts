import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import { rngFromString } from "@/lib/rng";
import {
  CELLS,
  MIN_CELL,
  MAX_CELL,
  sumOf,
  pickTarget,
  hasSubsetSum,
  scoreToNormalised,
  tierTitle,
  shareGrid,
  buildShareText,
  validateSprint,
  type SprintPuzzle,
} from "./engine";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // > 180 days of daily puzzles

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
  const grid = p.grid.slice();
  let target = p.firstTarget;
  let cells = p.firstTargetCells.slice();
  let issued = 1;
  let ptr = 0;
  let cleared = 0;

  for (let n = 0; n < rounds; n++) {
    // The current target must be reachable from the live grid.
    expect(hasSubsetSum(grid, target), `unsolvable target ${target}`).toBe(true);
    // The known solution cells must actually sum to it.
    expect(sumOf(grid, cells)).toBe(target);

    // Clear it: replace those cells from the refill stream.
    for (const id of cells) {
      grid[id] = p.refill[ptr % p.refill.length];
      ptr += 1;
    }
    cleared += 1;

    // Issue the next target the way the component does.
    issued += 1;
    const rng = targetRng(p.seed, issued);
    const picked = pickTarget(grid, rng);
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

  it("pickTarget always returns 2-3 cells that sum to the target", () => {
    const rng = rngFromString("pick-test");
    const grid = Array.from({ length: CELLS }, (_, i) => (i % 9) + 1);
    for (let i = 0; i < 50; i++) {
      const { target, cells } = pickTarget(grid, rng);
      expect(cells.length).toBeGreaterThanOrEqual(2);
      expect(cells.length).toBeLessThanOrEqual(3);
      expect(sumOf(grid, cells)).toBe(target);
      expect(hasSubsetSum(grid, target)).toBe(true);
    }
  });

  it("getDailyPuzzle is deterministic per date", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.grid).toEqual(b.grid);
    expect(a.firstTarget).toBe(b.firstTarget);
    expect(a.refill).toEqual(b.refill);
    expect(a.seed).toBe(b.seed);
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.grid).not.toEqual(b.grid);
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
  it(`every issued target is reachable for a full simulated 60s run`, () => {
    let date = START;
    for (let d = 0; d < SAMPLE; d++) {
      const p = getDailyPuzzle(date);

      // Well-formed + validator agrees.
      expect(p.grid.length).toBe(CELLS);
      expect(
        p.grid.every((v) => Number.isInteger(v) && v >= MIN_CELL && v <= MAX_CELL),
        `bad digits on ${date}`,
      ).toBe(true);
      expect(validateSprint(p), `validator failed on ${date}`).toBe(true);

      // Simulate a fast 60s run: clearing ~40 targets is far beyond human pace,
      // proving the target stream stays solvable for an entire round + replays.
      const cleared = simulate(p, 60);
      expect(cleared).toBe(60);

      date = addDays(date, 1);
    }
  });

  it("validateSprint rejects malformed puzzles", () => {
    const good = getDailyPuzzle(START);
    expect(validateSprint(good)).toBe(true);

    const badGrid: SprintPuzzle = { ...good, grid: good.grid.slice(0, 10) };
    expect(validateSprint(badGrid)).toBe(false);

    const badDigit: SprintPuzzle = { ...good, grid: good.grid.map((_, i) => (i === 0 ? 99 : good.grid[i])) };
    expect(validateSprint(badDigit)).toBe(false);

    const badTarget: SprintPuzzle = { ...good, firstTarget: 999 };
    expect(validateSprint(badTarget)).toBe(false);

    const badCells: SprintPuzzle = { ...good, firstTargetCells: [0] };
    expect(validateSprint(badCells)).toBe(false);
  });
});
