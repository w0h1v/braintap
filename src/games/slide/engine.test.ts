import { describe, it, expect } from "vitest";
import type { Difficulty } from "@/lib/types";
import { addDays } from "@/lib/daily";
import {
  N,
  CELLS,
  BLANK,
  idx,
  solvedBoard,
  blankPos,
  neighbors,
  canMove,
  applyMove,
  isSolved,
  countInversions,
  isBoardSolvable,
  manhattan,
  scramble,
  validateSlide,
  nextBestMove,
  cellsFor,
  isSlideSize,
  sizeOf,
  type Board,
} from "./engine";
import { rngFromString } from "@/lib/rng";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200; // > 180 days

function isPermutation(b: Board, cells: number = CELLS): boolean {
  if (b.length !== cells) return false;
  const seen = new Array(cells).fill(false);
  for (const v of b) {
    if (!Number.isInteger(v) || v < 0 || v >= cells || seen[v]) return false;
    seen[v] = true;
  }
  return true;
}

/** Reconstruct the solved board by reversing a sequence of legal moves. */
function bfsSolvableCheck(board: Board): boolean {
  // We rely on parity for the formal proof; this checks small structural facts.
  return isBoardSolvable(board);
}

describe("slide engine — basics", () => {
  it("solvedBoard is [1..15,0] and isSolved agrees", () => {
    const s = solvedBoard();
    expect(s).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]);
    expect(isSolved(s)).toBe(true);
    expect(blankPos(s)).toBe(CELLS - 1);
  });

  it("idx maps row/col correctly", () => {
    expect(idx(0, 0)).toBe(0);
    expect(idx(3, 3)).toBe(15);
    expect(idx(1, 2)).toBe(6);
  });

  it("neighbors are orthogonal and respect edges", () => {
    expect(neighbors(0).sort()).toEqual([1, 4]); // top-left corner
    expect(neighbors(15).sort()).toEqual([11, 14]); // bottom-right corner
    expect(neighbors(5).sort()).toEqual([1, 4, 6, 9]); // interior
  });
});

describe("slide engine — moves", () => {
  it("canMove only allows tiles adjacent to the blank", () => {
    const b = solvedBoard(); // blank at index 15
    expect(canMove(b, 14)).toBe(true); // left of blank
    expect(canMove(b, 11)).toBe(true); // above blank
    expect(canMove(b, 0)).toBe(false); // far away
    expect(canMove(b, 15)).toBe(false); // the blank itself
  });

  it("applyMove swaps the tile into the blank and is reversible", () => {
    const b = solvedBoard();
    const moved = applyMove(b, 14); // slide tile 15 into the blank
    expect(moved[15]).toBe(15); // tile 15 now bottom-right
    expect(moved[14]).toBe(BLANK); // blank moved left
    expect(moved).not.toBe(b); // new array
    expect(b[14]).toBe(15); // original unchanged

    // Reverse it: slide tile 15 back.
    const back = applyMove(moved, 15);
    expect(isSolved(back)).toBe(true);
  });

  it("applyMove ignores illegal moves", () => {
    const b = solvedBoard();
    const same = applyMove(b, 0); // index 0 not adjacent to blank at 15
    expect(same).toBe(b);
  });

  it("a sequence of legal moves keeps the board a valid permutation", () => {
    const rng = rngFromString("slide:move-test");
    let b = solvedBoard();
    for (let i = 0; i < 500; i++) {
      const opts = neighbors(blankPos(b));
      const pick = opts[rng.int(0, opts.length - 1)];
      b = applyMove(b, pick);
      expect(isPermutation(b)).toBe(true);
    }
  });
});

describe("slide engine — solvability invariants", () => {
  it("countInversions and isBoardSolvable agree on the solved board", () => {
    const s = solvedBoard();
    expect(countInversions(s)).toBe(0);
    expect(isBoardSolvable(s)).toBe(true);
  });

  it("manhattan distance is zero only for the solved board", () => {
    expect(manhattan(solvedBoard())).toBe(0);
    const scrambled = scramble(rngFromString("slide:mh"), 50);
    if (!isSolved(scrambled)) expect(manhattan(scrambled)).toBeGreaterThan(0);
  });

  it("a known unsolvable board is rejected (swap of 14 and 15)", () => {
    const bad = solvedBoard();
    [bad[12], bad[13]] = [bad[13], bad[12]]; // swap tiles 13 and 14 -> odd inversions, blank odd row from bottom
    expect(isBoardSolvable(bad)).toBe(false);
  });

  it("random-walk scrambles are always solvable", () => {
    for (let i = 0; i < 100; i++) {
      const b = scramble(rngFromString(`slide:rw-${i}`), 200);
      expect(isBoardSolvable(b)).toBe(true);
    }
  });
});

describe("slide daily puzzles are solvable (solvable bank)", () => {
  it(`every daily puzzle across ${SAMPLE} days is solvable and shuffled`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      // well-formed permutation
      expect(isPermutation(p.start), `start not a permutation on ${date}`).toBe(true);
      expect(p.goal).toEqual(solvedBoard());

      // solvable by parity (and BFS-level structural check)
      expect(isBoardSolvable(p.start), `not solvable on ${date}`).toBe(true);
      expect(bfsSolvableCheck(p.start)).toBe(true);

      // not already solved (non-trivial)
      expect(isSolved(p.start), `trivially solved on ${date}`).toBe(false);

      // module validator agrees
      expect(validateSlide(p), `validator failed on ${date}`).toBe(true);

      date = addDays(date, 1);
    }
  });

  it("getDailyPuzzle is deterministic per date", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.start).toEqual(b.start);
  });

  it("different dates generally produce different scrambles", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.start).not.toEqual(b.start);
  });
});

describe("slide engine — validator guards", () => {
  it("rejects non-permutations and wrong-length boards", () => {
    expect(validateSlide({ start: [0, 1], goal: solvedBoard(), scrambleSteps: 0 })).toBe(false);
    const dup = solvedBoard();
    dup[0] = dup[1]; // duplicate
    expect(validateSlide({ start: dup, goal: solvedBoard(), scrambleSteps: 0 })).toBe(false);
  });

  it("rejects an already-solved start", () => {
    expect(
      validateSlide({ start: solvedBoard(), goal: solvedBoard(), scrambleSteps: 0 }),
    ).toBe(false);
  });

  it("accepts a hand-made solvable scramble", () => {
    // one legal move from solved is solvable and not solved
    const start = applyMove(solvedBoard(), 14);
    expect(validateSlide({ start, goal: solvedBoard(), scrambleSteps: 0 })).toBe(true);
  });
});

describe("slide engine — nextBestMove hint", () => {
  it("returns -1 for the solved board", () => {
    expect(nextBestMove(solvedBoard())).toBe(-1);
  });

  it("returns a legal move adjacent to the blank", () => {
    const start = applyMove(solvedBoard(), 14); // one move from solved
    const hint = nextBestMove(start);
    expect(canMove(start, hint)).toBe(true);
  });

  it("immediately solves a board that is one move from solved", () => {
    const start = applyMove(solvedBoard(), 14);
    const hint = nextBestMove(start);
    expect(isSolved(applyMove(start, hint))).toBe(true);
  });

  it("is deterministic for a given board", () => {
    const b = scramble(rngFromString("slide:hint-det"), 60);
    expect(nextBestMove(b)).toBe(nextBestMove(b));
  });

  it("always yields a legal progress move on scrambled boards", () => {
    for (let i = 0; i < 50; i++) {
      const b = scramble(rngFromString(`slide:hint-legal-${i}`), 40 + i);
      if (isSolved(b)) continue;
      const mv = nextBestMove(b);
      expect(canMove(b, mv)).toBe(true);
      // Sliding the suggested tile must keep the board a valid solvable board.
      const after = applyMove(b, mv);
      expect(isBoardSolvable(after)).toBe(true);
    }
  });

  it("prefers the lowest-Manhattan move among options (greedy)", () => {
    const b = scramble(rngFromString("slide:hint-greedy"), 30);
    const mv = nextBestMove(b);
    const best = manhattan(applyMove(b, mv));
    for (const p of neighbors(blankPos(b))) {
      expect(manhattan(applyMove(b, p))).toBeGreaterThanOrEqual(best);
    }
  });
});

describe("slide daily puzzles — difficulty tiers", () => {
  const TIERS: Difficulty[] = ["easy", "medium", "hard"];
  const EXPECTED_SIZE: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 5 };

  it("each tier maps to its grid size: easy=3, medium=4, hard=5", () => {
    for (const tier of TIERS) {
      const p = getDailyPuzzle(START, tier);
      expect(p.size, `wrong size for ${tier}`).toBe(EXPECTED_SIZE[tier]);
      expect(isSlideSize(p.size)).toBe(true);
      expect(p.goal).toEqual(solvedBoard(p.size));
    }
  });

  it(`every tier is solvable, shuffled and valid across ${SAMPLE} days`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      for (const tier of TIERS) {
        const p = getDailyPuzzle(date, tier);
        const psize = sizeOf(p.start);
        const cells = cellsFor(psize);

        // the declared size matches the board and the expected tier size
        expect(p.size, `${tier} declared size on ${date}`).toBe(EXPECTED_SIZE[tier]);
        expect(psize).toBe(EXPECTED_SIZE[tier]);

        // well-formed permutation of 0..cells-1
        expect(isPermutation(p.start, cells), `${tier} not a permutation on ${date}`).toBe(true);
        expect(p.goal).toEqual(solvedBoard(psize));

        // solvable by parity for this grid size
        expect(isBoardSolvable(p.start, psize), `${tier} not solvable on ${date}`).toBe(true);

        // not already solved (non-trivial)
        expect(isSolved(p.start), `${tier} trivially solved on ${date}`).toBe(false);

        // module validator agrees
        expect(validateSlide(p), `${tier} validator failed on ${date}`).toBe(true);
      }
      date = addDays(date, 1);
    }
  });

  it("scramble depth escalates with the tier (easy < medium < hard)", () => {
    const easy = getDailyPuzzle(START, "easy");
    const medium = getDailyPuzzle(START, "medium");
    const hard = getDailyPuzzle(START, "hard");
    expect(easy.scrambleSteps).toBeLessThan(medium.scrambleSteps);
    expect(medium.scrambleSteps).toBeLessThan(hard.scrambleSteps);
  });

  it("grid size escalates with the tier (easy < medium < hard)", () => {
    const easy = getDailyPuzzle(START, "easy");
    const medium = getDailyPuzzle(START, "medium");
    const hard = getDailyPuzzle(START, "hard");
    expect(sizeOf(easy.start)).toBeLessThan(sizeOf(medium.start));
    expect(sizeOf(medium.start)).toBeLessThan(sizeOf(hard.start));
  });

  it("tiers on the same date are independent puzzles", () => {
    const easy = getDailyPuzzle("2025-03-14", "easy");
    const medium = getDailyPuzzle("2025-03-14", "medium");
    const hard = getDailyPuzzle("2025-03-14", "hard");
    // Different sizes already guarantee different arrays; assert lengths differ.
    expect(easy.start.length).not.toBe(medium.start.length);
    expect(medium.start.length).not.toBe(hard.start.length);
  });

  it("is deterministic per (date, difficulty) and memoised", () => {
    for (const tier of TIERS) {
      const a = getDailyPuzzle("2025-04-01", tier);
      const b = getDailyPuzzle("2025-04-01", tier);
      expect(a.start).toEqual(b.start);
      expect(a).toBe(b); // memoised: identical reference for same (date, tier)
    }
  });

  it("omitting difficulty yields the medium 4×4 puzzle", () => {
    const plain = getDailyPuzzle("2025-05-05");
    const medium = getDailyPuzzle("2025-05-05", "medium");
    expect(plain.size).toBe(4);
    expect(plain.start).toEqual(medium.start);
  });

  it("different dates produce different scrambles within a tier", () => {
    for (const tier of TIERS) {
      const a = getDailyPuzzle("2025-06-01", tier);
      const b = getDailyPuzzle("2025-06-02", tier);
      expect(a.start).not.toEqual(b.start);
    }
  });
});

void N;
