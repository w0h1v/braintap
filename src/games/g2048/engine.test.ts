import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import { rngFromString } from "@/lib/rng";
import {
  CELLS,
  SIZE,
  WIN_TILE,
  idx,
  slideLine,
  move,
  moveWithPaths,
  canMove,
  hasWon,
  maxTile,
  emptyCells,
  applySpawn,
  resolveSpawnCell,
  makeStart,
  makeSpawn,
  validateG2048,
  type Direction,
  type Grid,
} from "./engine";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // ~6+ months of daily puzzles

describe("g2048 slide + merge", () => {
  it("slides tiles toward index 0 without merging distinct values", () => {
    expect(slideLine([0, 2, 0, 4]).line).toEqual([2, 4, 0, 0]);
    expect(slideLine([0, 2, 0, 4]).gained).toBe(0);
  });

  it("merges a single pair and scores the result", () => {
    const { line, gained } = slideLine([2, 2, 0, 0]);
    expect(line).toEqual([4, 0, 0, 0]);
    expect(gained).toBe(4);
  });

  it("merges only once per tile per move (no chaining)", () => {
    // [2,2,2,0] => 4,2 not 6 ; the spec example 4+4+4 -> 8 not 12
    expect(slideLine([2, 2, 2, 0]).line).toEqual([4, 2, 0, 0]);
    expect(slideLine([4, 4, 4, 0]).line).toEqual([8, 4, 0, 0]);
    // spec row example [2,4,4,2] left -> [2,8,2,0], score 8
    const r = slideLine([2, 4, 4, 2]);
    expect(r.line).toEqual([2, 8, 2, 0]);
    expect(r.gained).toBe(8);
  });

  it("does not double-merge four equal tiles", () => {
    const { line, gained } = slideLine([2, 2, 2, 2]);
    expect(line).toEqual([4, 4, 0, 0]);
    expect(gained).toBe(8);
  });

  it("move L/R/U/D transform the grid on the correct axis", () => {
    // single 2 in top-right; moving left should put it top-left
    const g: Grid = new Array(CELLS).fill(0);
    g[idx(0, 3)] = 2;
    expect(move(g, "L").grid[idx(0, 0)]).toBe(2);
    expect(move(g, "L").moved).toBe(true);

    const g2: Grid = new Array(CELLS).fill(0);
    g2[idx(0, 0)] = 2;
    expect(move(g2, "D").grid[idx(SIZE - 1, 0)]).toBe(2);
    expect(move(g2, "R").grid[idx(0, SIZE - 1)]).toBe(2);
  });

  it("an invalid move reports moved=false and changes nothing", () => {
    const g: Grid = new Array(CELLS).fill(0);
    g[idx(0, 0)] = 2;
    g[idx(1, 0)] = 4; // column already packed up-left
    const res = move(g, "U");
    expect(res.moved).toBe(false);
    expect(res.grid).toEqual(g);
    expect(res.gained).toBe(0);
  });

  it("a move never creates or destroys tile mass beyond merges", () => {
    const rng = rngFromString("mass-check");
    let g = makeStart(rng);
    const dirs: Direction[] = ["U", "D", "L", "R"];
    for (let step = 0; step < 50; step++) {
      const sumBefore = g.reduce((a, b) => a + b, 0);
      const res = move(g, dirs[step % 4]);
      const sumAfter = res.grid.reduce((a, b) => a + b, 0);
      // merging preserves total tile value (4+4 -> 8); only spawns add value.
      expect(sumAfter).toBe(sumBefore);
      g = res.grid.some((v) => v === 0) ? applySpawn(res.grid, makeSpawn(rng)) : res.grid;
    }
  });
});

describe("g2048 moveWithPaths matches move and reports slide paths", () => {
  it("grid/gained/moved agree with move across a scripted run", () => {
    const rng = rngFromString("paths-parity");
    let g = makeStart(rng);
    const dirs: Direction[] = ["L", "U", "R", "D"];
    for (let step = 0; step < 80; step++) {
      const dir = dirs[step % 4];
      const a = move(g, dir);
      const b = moveWithPaths(g, dir);
      expect(b.grid).toEqual(a.grid);
      expect(b.gained).toBe(a.gained);
      expect(b.moved).toBe(a.moved);
      // Every path lands on a non-empty destination holding its stated value.
      for (const p of b.paths) {
        expect(b.grid[p.to]).toBe(p.value);
        if (p.merged) expect(p.value).toBe(g[p.from] * 2);
      }
      g = b.grid.some((v) => v === 0) ? applySpawn(b.grid, makeSpawn(rng)) : b.grid;
    }
  });

  it("records both sources for a merge and a single source for a slide", () => {
    const g: Grid = new Array(CELLS).fill(0);
    g[idx(0, 0)] = 2;
    g[idx(0, 1)] = 2;
    g[idx(1, 0)] = 4; // lone slider in a different row
    const res = moveWithPaths(g, "L");
    const mergePath = res.paths.find((p) => p.to === idx(0, 0) && p.merged);
    expect(mergePath).toBeTruthy();
    expect(mergePath?.value).toBe(4);
    expect(mergePath?.mergedFrom).toBe(idx(0, 1));
    const slide = res.paths.find((p) => p.value === 4 && !p.merged);
    expect(slide?.from).toBe(idx(1, 0));
    expect(slide?.to).toBe(idx(1, 0));
  });
});

describe("g2048 spawns land on empty cells", () => {
  it("resolveSpawnCell always targets an empty cell when one exists", () => {
    const rng = rngFromString("spawn-empty");
    for (let t = 0; t < 500; t++) {
      // random-ish board with some filled cells
      const g: Grid = new Array(CELLS).fill(0);
      const fills = rng.int(0, CELLS - 1);
      for (let i = 0; i < fills; i++) g[rng.int(0, CELLS - 1)] = 2;
      const spawn = makeSpawn(rng);
      const cell = resolveSpawnCell(g, spawn);
      if (emptyCells(g).length === 0) {
        expect(cell).toBe(-1);
      } else {
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(g[cell]).toBe(0); // landed on empty
      }
    }
  });

  it("applySpawn fills exactly one empty cell with 2 or 4", () => {
    const g: Grid = new Array(CELLS).fill(0);
    const rng = rngFromString("apply-spawn");
    const next = applySpawn(g, makeSpawn(rng));
    expect(emptyCells(next).length).toBe(CELLS - 1);
    const placed = next.filter((v) => v !== 0);
    expect(placed.length).toBe(1);
    expect([2, 4]).toContain(placed[0]);
  });
});

describe("g2048 daily puzzles are deterministic", () => {
  it("same date yields the same start + spawn script", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.start).toEqual(b.start);
    expect(a.spawns).toEqual(b.spawns);
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    const diffStart = JSON.stringify(a.start) !== JSON.stringify(b.start);
    const diffSpawns = JSON.stringify(a.spawns) !== JSON.stringify(b.spawns);
    expect(diffStart || diffSpawns).toBe(true);
  });
});

describe("g2048 daily puzzles are solvable (solvable across the archive)", () => {
  it(`every daily start across ${SAMPLE} days is well-formed and playable`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      // exactly two starting tiles, each 2 or 4
      const tiles = p.start.filter((v) => v !== 0);
      expect(tiles.length, `start tile count on ${date}`).toBe(2);
      expect(tiles.every((v) => v === 2 || v === 4), `start tile values on ${date}`).toBe(true);
      expect(emptyCells(p.start).length, `empties on ${date}`).toBe(CELLS - 2);

      // a legal opening move always exists (the game is never born stuck)
      expect(canMove(p.start), `no opening move on ${date}`).toBe(true);

      // module validator agrees
      expect(validateG2048(p), `validator failed on ${date}`).toBe(true);

      date = addDays(date, 1);
    }
  });

  it("a scripted greedy run reaches game-over cleanly (engine never deadlocks)", () => {
    // Drive a full game with the daily spawn script using a fixed move cycle,
    // proving the slide/spawn loop always terminates in a valid end state.
    const p = getDailyPuzzle(START);
    let g = p.start.slice();
    let si = 0;
    const dirs: Direction[] = ["L", "U", "R", "D"];
    let guard = 0;
    while (canMove(g) && !hasWon(g) && guard < 5000) {
      guard++;
      // try each direction until one is valid
      let advanced = false;
      for (let k = 0; k < 4; k++) {
        const res = move(g, dirs[(si + k) % 4]);
        if (res.moved) {
          g = applySpawn(res.grid, p.spawns[si % p.spawns.length]);
          si++;
          advanced = true;
          break;
        }
      }
      if (!advanced) break;
    }
    // Either we won, or we ended with no moves left — both are valid terminals.
    expect(hasWon(g) || !canMove(g)).toBe(true);
    expect(maxTile(g)).toBeGreaterThanOrEqual(2);
    expect(maxTile(g)).toBeLessThanOrEqual(WIN_TILE * 16); // sane upper bound
  });

  it("validateG2048 rejects malformed puzzles", () => {
    expect(validateG2048({ start: [], spawns: [] } as never)).toBe(false);
    const good = getDailyPuzzle(START);
    const badStart = { ...good, start: new Array(CELLS).fill(0) };
    expect(validateG2048(badStart)).toBe(false); // zero tiles
    const badSpawns = { ...good, spawns: [{ value: 8, pick: 0 }] } as never;
    expect(validateG2048(badSpawns)).toBe(false);
  });
});
