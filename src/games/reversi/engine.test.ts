import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import { rngFromString } from "@/lib/rng";
import {
  SIZE,
  CELLS,
  EMPTY,
  YOU,
  AI,
  idx,
  rowOf,
  colOf,
  initialBoard,
  flipsFor,
  isLegalMove,
  legalMoves,
  applyMove,
  chooseAiMove,
  score,
  isGameOver,
  outcomeFor,
  simulateGame,
  validateReversi,
  opponent,
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  isDifficulty,
  profileFor,
  tierToDifficulty,
  type Board,
  type Difficulty,
  type Tier,
} from "./engine";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 200;

function emptyBoard(): Board {
  return new Array(CELLS).fill(EMPTY) as Board;
}

describe("reversi engine — rules", () => {
  it("initial board has the standard 2v2 opening", () => {
    const b = initialBoard();
    expect(b[idx(3, 3)]).toBe(YOU);
    expect(b[idx(4, 4)]).toBe(YOU);
    expect(b[idx(3, 4)]).toBe(AI);
    expect(b[idx(4, 3)]).toBe(AI);
    const s = score(b);
    expect(s.you).toBe(2);
    expect(s.ai).toBe(2);
    expect(s.empty).toBe(60);
  });

  it("the opening has exactly four legal moves for each side", () => {
    const b = initialBoard();
    const you = legalMoves(b, YOU);
    const ai = legalMoves(b, AI);
    expect(you.length).toBe(4);
    expect(ai.length).toBe(4);
    // YOU opening moves: (2,4),(3,5),(4,2),(5,3)
    expect(new Set(you)).toEqual(
      new Set([idx(2, 4), idx(3, 5), idx(4, 2), idx(5, 3)]),
    );
  });

  it("flipsFor captures a single line in one direction", () => {
    // YOU places at (4,3); to the right sit two AI discs bracketed by YOU at (4,6).
    const b = emptyBoard();
    b[idx(4, 4)] = AI;
    b[idx(4, 5)] = AI;
    b[idx(4, 6)] = YOU;
    const flips = flipsFor(b, 4, 3, YOU);
    expect(new Set(flips)).toEqual(new Set([idx(4, 4), idx(4, 5)]));
  });

  it("flipsFor captures across multiple directions simultaneously", () => {
    const b = emptyBoard();
    // Center empty cell at (4,4); surround so placing YOU flips in two dirs.
    b[idx(4, 5)] = AI;
    b[idx(4, 6)] = YOU; // horizontal line
    b[idx(5, 4)] = AI;
    b[idx(6, 4)] = YOU; // vertical line
    const flips = flipsFor(b, 4, 4, YOU);
    expect(new Set(flips)).toEqual(new Set([idx(4, 5), idx(5, 4)]));
  });

  it("a move that flips nothing is illegal", () => {
    const b = initialBoard();
    expect(isLegalMove(b, 0, 0, YOU)).toBe(false); // corner flips nothing
    expect(flipsFor(b, 0, 0, YOU)).toEqual([]);
    expect(isLegalMove(b, 3, 3, YOU)).toBe(false); // occupied
  });

  it("applyMove places the disc and flips all captures, returning a new board", () => {
    const b = initialBoard();
    const move = idx(2, 4); // a legal YOU opener
    expect(isLegalMove(b, 2, 4, YOU)).toBe(true);
    const next = applyMove(b, 2, 4, YOU);
    expect(next).not.toBe(b);
    expect(b[move]).toBe(EMPTY); // original untouched
    expect(next[move]).toBe(YOU);
    expect(next[idx(3, 4)]).toBe(YOU); // flipped from AI
    const s = score(next);
    expect(s.you).toBe(4);
    expect(s.ai).toBe(1);
  });

  it("total disc count is conserved sensibly after a move", () => {
    const b = initialBoard();
    const before = score(b);
    const next = applyMove(b, 2, 4, YOU);
    const after = score(next);
    // one new disc placed, k flipped: you grows by 1+k, ai shrinks by k
    expect(after.you + after.ai).toBe(before.you + before.ai + 1);
  });
});

describe("reversi engine — AI", () => {
  it("chooseAiMove always returns a legal move when one exists", () => {
    const rng = rngFromString("ai-test");
    // Walk many random-ish positions by self-play and check every AI choice.
    let b = initialBoard();
    let turn: 1 | 2 = AI;
    for (let i = 0; i < 200 && !isGameOver(b); i++) {
      const moves = legalMoves(b, turn);
      if (moves.length === 0) {
        turn = opponent(turn);
        continue;
      }
      const m = chooseAiMove(b, turn, 0.5, rng);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(moves).toContain(m);
      b = applyMove(b, rowOf(m), colOf(m), turn);
      turn = opponent(turn);
    }
  });

  it("chooseAiMove returns -1 when there is no legal move", () => {
    const rng = rngFromString("none");
    const b = emptyBoard();
    b[idx(0, 0)] = YOU; // lone disc, AI has nothing to flip
    expect(chooseAiMove(b, AI, 0.5, rng)).toBe(-1);
  });

  it("chooseAiMove is deterministic for a given seed and position", () => {
    const b = initialBoard();
    const a = chooseAiMove(b, AI, 0.6, rngFromString("seed-x"));
    const c = chooseAiMove(b, AI, 0.6, rngFromString("seed-x"));
    expect(a).toBe(c);
  });

  it("AI prefers a corner over a low-value cell when both are legal", () => {
    const rng = rngFromString("corner");
    const b = emptyBoard();
    // Make (0,0) corner legal: (0,1)=AI-foe line ending at YOU placement? We test YOU AI weighting.
    // Set up so AI has a corner capture and an interior capture.
    b[idx(0, 1)] = YOU; // foe of AI
    b[idx(0, 2)] = AI; // own disc -> placing AI at (0,0) flips (0,1)
    b[idx(5, 4)] = YOU;
    b[idx(6, 4)] = AI; // placing AI at (4,4) flips (5,4) interior
    expect(isLegalMove(b, 0, 0, AI)).toBe(true);
    expect(isLegalMove(b, 4, 4, AI)).toBe(true);
    const m = chooseAiMove(b, AI, 0.3, rng);
    expect(m).toBe(idx(0, 0));
  });
});

describe("reversi engine — AI difficulty", () => {
  it("the default difficulty preserves the historical (normal) move choice", () => {
    const b = initialBoard();
    // The 4-arg call (no difficulty) must equal an explicit "normal" call with
    // the same seed — backward-compat for existing callers/tests.
    const legacy = chooseAiMove(b, AI, 0.6, rngFromString("compat"));
    const normal = chooseAiMove(b, AI, 0.6, rngFromString("compat"), "normal");
    expect(legacy).toBe(normal);
    expect(DEFAULT_DIFFICULTY).toBe("normal");
  });

  it("every difficulty returns a legal move and is deterministic per seed", () => {
    const b = initialBoard();
    for (const d of DIFFICULTIES) {
      const moves = legalMoves(b, AI);
      const a = chooseAiMove(b, AI, 0.5, rngFromString(`d-${d}`), d);
      const c = chooseAiMove(b, AI, 0.5, rngFromString(`d-${d}`), d);
      expect(a).toBe(c);
      expect(moves).toContain(a);
    }
  });

  it("hard difficulty (look-ahead) still always returns a legal move in self-play", () => {
    const rng = rngFromString("hard-self");
    let b = initialBoard();
    let turn: 1 | 2 = AI;
    for (let i = 0; i < 200 && !isGameOver(b); i++) {
      const moves = legalMoves(b, turn);
      if (moves.length === 0) {
        turn = opponent(turn);
        continue;
      }
      const m = chooseAiMove(b, turn, 0.5, rng, "hard");
      expect(moves).toContain(m);
      b = applyMove(b, rowOf(m), colOf(m), turn);
      turn = opponent(turn);
    }
  });

  it("hard plays at least as well as easy across many self-play games", () => {
    // Hard (look-ahead) vs Easy (greedy + noise) — hard should not lose overall.
    let hardWins = 0;
    let easyWins = 0;
    for (let g = 0; g < 12; g++) {
      const rng = rngFromString(`match-${g}`);
      let b = initialBoard();
      // AI = hard, YOU = easy. firstTurn alternates.
      let turn: 1 | 2 = g % 2 === 0 ? AI : YOU;
      for (let i = 0; i < 200 && !isGameOver(b); i++) {
        const moves = legalMoves(b, turn);
        if (moves.length === 0) {
          turn = opponent(turn);
          continue;
        }
        const diff: Difficulty = turn === AI ? "hard" : "easy";
        const m = chooseAiMove(b, turn, 0.5, rng, diff);
        b = applyMove(b, rowOf(m), colOf(m), turn);
        turn = opponent(turn);
      }
      const o = outcomeFor(b); // YOU(easy) perspective
      if (o === "lost") hardWins++;
      else if (o === "won") easyWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(easyWins);
  });

  it("profileFor and isDifficulty expose the strength config", () => {
    expect(isDifficulty("hard")).toBe(true);
    expect(isDifficulty("medium")).toBe(false);
    expect(isDifficulty(undefined)).toBe(false);
    expect(profileFor("hard").depth).toBeGreaterThan(profileFor("normal").depth);
    expect(profileFor("easy").jitter).toBeGreaterThan(profileFor("normal").jitter);
  });
});

describe("reversi engine — termination & validation", () => {
  it("a full self-played game terminates with a well-formed board", () => {
    const rng = rngFromString("term");
    const { board, plies } = simulateGame(
      { playerColor: YOU, firstTurn: AI, aggressiveness: 0.5 },
      rng,
    );
    expect(isGameOver(board)).toBe(true);
    const s = score(board);
    expect(s.you + s.ai + s.empty).toBe(CELLS);
    expect(s.you + s.ai).toBeGreaterThan(4);
    expect(plies).toBeGreaterThan(10);
    expect(["won", "tie", "lost"]).toContain(outcomeFor(board));
  });

  it("outcomeFor reads the disc differential", () => {
    const b = emptyBoard();
    b[idx(0, 0)] = YOU;
    b[idx(0, 1)] = YOU;
    b[idx(0, 2)] = AI;
    expect(outcomeFor(b)).toBe("won");
    b[idx(0, 3)] = AI;
    expect(outcomeFor(b)).toBe("tie");
    b[idx(0, 4)] = AI;
    expect(outcomeFor(b)).toBe("lost");
  });
});

describe("reversi daily puzzles are solvable", () => {
  it("getDailyPuzzle is deterministic per date", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a).toEqual(b);
  });

  it(`every daily puzzle across ${SAMPLE} days is valid and reaches a natural end`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      // config sanity
      expect([YOU, AI]).toContain(p.firstTurn);
      expect(p.playerColor).toBe(YOU);
      expect(p.aggressiveness).toBeGreaterThanOrEqual(0.2);
      expect(p.aggressiveness).toBeLessThanOrEqual(0.9);

      // module validator agrees (gameable opening + terminating game)
      expect(validateReversi(p), `validator failed on ${date}`).toBe(true);

      // a daily-seeded self-play game terminates and fills the board sensibly
      const rng = rngFromString(`reversi-ai:check:${date}`);
      const { board } = simulateGame(p, rng);
      expect(isGameOver(board), `did not terminate on ${date}`).toBe(true);
      const s = score(board);
      expect(s.you + s.ai + s.empty).toBe(CELLS);

      date = addDays(date, 1);
    }
  });
});

describe("reversi difficulty tiers (host Easy/Medium/Hard)", () => {
  const TIERS: Tier[] = ["easy", "medium", "hard"];

  it("maps each host tier to an escalating AI strength", () => {
    expect(tierToDifficulty("easy")).toBe("easy");
    expect(tierToDifficulty("medium")).toBe("normal");
    expect(tierToDifficulty("hard")).toBe("hard");
    // Search depth is the dominant strength knob and must escalate.
    expect(profileFor(tierToDifficulty("easy")).depth).toBeLessThanOrEqual(
      profileFor(tierToDifficulty("medium")).depth,
    );
    expect(profileFor(tierToDifficulty("medium")).depth).toBeLessThan(
      profileFor(tierToDifficulty("hard")).depth,
    );
    // Easy plays loosest (most jitter); hard plays cleanest (no jitter).
    expect(profileFor(tierToDifficulty("easy")).jitter).toBeGreaterThan(
      profileFor(tierToDifficulty("medium")).jitter,
    );
    expect(profileFor(tierToDifficulty("hard")).jitter).toBe(0);
  });

  it("medium (the default tier) preserves the legacy daily puzzle config", () => {
    // Omitting difficulty == medium, and the canonical board fields must match
    // a medium request exactly (only aiDifficulty differs, by definition).
    const legacy = getDailyPuzzle("2025-05-09");
    const medium = getDailyPuzzle("2025-05-09", "medium");
    expect(legacy).toEqual(medium);
    expect(medium.aiDifficulty).toBe("normal");
  });

  it("keeps the daily board canonical across tiers (only AI strength changes)", () => {
    let date = START;
    for (let i = 0; i < 60; i++) {
      const e = getDailyPuzzle(date, "easy");
      const m = getDailyPuzzle(date, "medium");
      const h = getDailyPuzzle(date, "hard");
      // Same opening config (firstTurn + aggressiveness) for every tier.
      expect(e.firstTurn).toBe(m.firstTurn);
      expect(m.firstTurn).toBe(h.firstTurn);
      expect(e.aggressiveness).toBe(m.aggressiveness);
      expect(m.aggressiveness).toBe(h.aggressiveness);
      // Distinct, correctly-mapped AI strength per tier.
      expect(e.aiDifficulty).toBe("easy");
      expect(m.aiDifficulty).toBe("normal");
      expect(h.aiDifficulty).toBe("hard");
      date = addDays(date, 1);
    }
  });

  it("memoises per date AND difficulty (different tiers are independent objects)", () => {
    const a1 = getDailyPuzzle("2025-07-01", "easy");
    const a2 = getDailyPuzzle("2025-07-01", "easy");
    const b = getDailyPuzzle("2025-07-01", "hard");
    expect(a1).toBe(a2); // same cached instance
    expect(a1).not.toBe(b); // different tier -> different cache entry
    expect(a1.aiDifficulty).not.toBe(b.aiDifficulty);
  });

  it(`every tier across ${SAMPLE} days is valid and terminates`, () => {
    for (const tier of TIERS) {
      let date = START;
      for (let i = 0; i < SAMPLE; i++) {
        const p = getDailyPuzzle(date, tier);
        expect(p.playerColor).toBe(YOU);
        expect([YOU, AI]).toContain(p.firstTurn);
        expect(p.aiDifficulty).toBe(tierToDifficulty(tier));
        expect(
          validateReversi(p),
          `validator failed on ${date} @ ${tier}`,
        ).toBe(true);

        const rng = rngFromString(`reversi-ai:check:${tier}:${date}`);
        const { board } = simulateGame(p, rng);
        expect(isGameOver(board), `did not terminate on ${date} @ ${tier}`).toBe(true);
        const s = score(board);
        expect(s.you + s.ai + s.empty).toBe(CELLS);
        date = addDays(date, 1);
      }
    }
  });

  it("hard tier AI outplays easy tier AI head-to-head across many games", () => {
    // Stronger tier (hard, look-ahead) vs weaker tier (easy, greedy+noise).
    let hardWins = 0;
    let easyWins = 0;
    for (let g = 0; g < 16; g++) {
      const rng = rngFromString(`tier-match-${g}`);
      let b = initialBoard();
      // AI side = hard, YOU side = easy. Alternate who opens.
      let turn: 1 | 2 = g % 2 === 0 ? AI : YOU;
      for (let i = 0; i < 200 && !isGameOver(b); i++) {
        const moves = legalMoves(b, turn);
        if (moves.length === 0) {
          turn = opponent(turn);
          continue;
        }
        const diff: Difficulty =
          turn === AI ? tierToDifficulty("hard") : tierToDifficulty("easy");
        const m = chooseAiMove(b, turn, 0.5, rng, diff);
        b = applyMove(b, rowOf(m), colOf(m), turn);
        turn = opponent(turn);
      }
      const o = outcomeFor(b); // YOU(easy) perspective
      if (o === "lost") hardWins++;
      else if (o === "won") easyWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(easyWins);
  });
});

// keep SIZE referenced for clarity
void SIZE;
