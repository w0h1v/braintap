import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import {
  POOL,
  GROUP_COUNT,
  GROUP_SIZE,
  TILE_COUNT,
  GROUP_COLORS,
  buildPuzzle,
  evaluateGuess,
  getHint,
  groupOf,
  hasCrossMembership,
  validateConnections,
  type PoolCategory,
} from "./engine";
import { getDailyPuzzle } from "./generator";
import { rngFromString } from "@/lib/rng";

const START = "2025-01-01";
const SAMPLE = 200; // > 180 days

const key = (w: string) => w.trim().toLowerCase();

describe("connections pool", () => {
  it("has at least 44 curated categories", () => {
    expect(POOL.length).toBeGreaterThanOrEqual(44);
  });

  it("every category is well-formed (>=4 members, label, insight)", () => {
    for (const cat of POOL) {
      expect(cat.label.length).toBeGreaterThan(0);
      expect(cat.insight.length).toBeGreaterThan(0);
      expect(cat.members.length).toBeGreaterThanOrEqual(GROUP_SIZE);
      // members unique within the category
      expect(new Set(cat.members.map(key)).size).toBe(cat.members.length);
    }
  });

  it("category labels are unique", () => {
    expect(new Set(POOL.map((c) => c.label)).size).toBe(POOL.length);
  });

  it("no member term appears in more than one category (pool is disjoint)", () => {
    const owner = new Map<string, string>();
    for (const cat of POOL) {
      for (const m of cat.members) {
        const k = key(m);
        const prev = owner.get(k);
        expect(prev, `"${m}" shared by ${prev} and ${cat.label}`).toBeUndefined();
        owner.set(k, cat.label);
      }
    }
  });
});

describe("connections daily puzzles are solvable (solvable bank)", () => {
  it(`every puzzle across ${SAMPLE} days is valid and unambiguous`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      // exactly 4 groups, 16 tiles
      expect(p.groups.length, `groups on ${date}`).toBe(GROUP_COUNT);
      expect(p.tiles.length, `tiles on ${date}`).toBe(TILE_COUNT);

      // each group has 4 words; colour ordered
      p.groups.forEach((g, gi) => {
        expect(g.words.length).toBe(GROUP_SIZE);
        expect(g.color).toBe(GROUP_COLORS[gi]);
      });

      // 16 unique words
      const all = p.groups.flatMap((g) => g.words.map(key));
      expect(new Set(all).size, `unique words on ${date}`).toBe(TILE_COUNT);

      // tiles are a permutation of the 16 words
      expect(p.tiles.map(key).sort()).toEqual(all.sort());

      // module validator agrees (includes ambiguity guard)
      expect(validateConnections(p), `validator failed on ${date}`).toBe(true);

      // every tile resolves to exactly one group
      for (const w of p.tiles) {
        expect(groupOf(p, w)).toBeGreaterThanOrEqual(0);
      }

      date = addDays(date, 1);
    }
  });

  it("a full correct solve clears every group", () => {
    const p = getDailyPuzzle(START);
    for (const g of p.groups) {
      const ev = evaluateGuess(p, g.words);
      expect(ev.result).toBe("correct");
      expect(p.groups[ev.groupIndex].label).toBe(g.label);
    }
  });
});

describe("connections determinism", () => {
  it("same date yields the same puzzle", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.groups).toEqual(b.groups);
    expect(a.tiles).toEqual(b.tiles);
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.tiles).not.toEqual(b.tiles);
  });
});

describe("connections guess evaluation", () => {
  const p = getDailyPuzzle(START);

  it("detects a one-away guess", () => {
    const g0 = p.groups[0].words;
    const intruder = p.groups[1].words[0];
    const guess = [g0[0], g0[1], g0[2], intruder];
    const ev = evaluateGuess(p, guess);
    expect(ev.result).toBe("one-away");
  });

  it("detects a wrong guess (two from each)", () => {
    const guess = [
      p.groups[0].words[0],
      p.groups[0].words[1],
      p.groups[1].words[0],
      p.groups[1].words[1],
    ];
    expect(evaluateGuess(p, guess).result).toBe("wrong");
  });
});

describe("connections hint", () => {
  const p = getDailyPuzzle(START);

  it("returns the easiest unsolved group when none solved", () => {
    expect(getHint(p, [])).toBe(0);
  });

  it("skips already-solved groups (returns next lowest unsolved)", () => {
    expect(getHint(p, [0])).toBe(1);
    expect(getHint(p, [0, 1])).toBe(2);
    expect(getHint(p, [1, 0])).toBe(2); // order-independent
    expect(getHint(p, [0, 2])).toBe(1);
  });

  it("returns -1 once every group is solved", () => {
    expect(getHint(p, [0, 1, 2, 3])).toBe(-1);
  });

  it("the hinted group is a real, fully-correct group", () => {
    const gi = getHint(p, []);
    expect(gi).toBeGreaterThanOrEqual(0);
    const ev = evaluateGuess(p, p.groups[gi].words);
    expect(ev.result).toBe("correct");
    expect(ev.groupIndex).toBe(gi);
  });
});

describe("connections ambiguity guard", () => {
  it("hasCrossMembership flags an overlapping pick", () => {
    const a: PoolCategory = {
      label: "A",
      members: ["X", "Y", "Z", "W"],
      insight: "a",
    };
    const b: PoolCategory = {
      label: "B",
      members: ["X", "P", "Q", "R"], // shares X with A
      insight: "b",
    };
    const chosen = [
      { source: a, words: ["X", "Y", "Z", "W"] },
      { source: b, words: ["P", "Q", "R", "X"] },
    ];
    expect(hasCrossMembership(chosen)).toBe(true);
  });

  it("buildPuzzle is deterministic for a fixed seed", () => {
    const x = buildPuzzle(rngFromString("connections:test"));
    const y = buildPuzzle(rngFromString("connections:test"));
    expect(x).toEqual(y);
  });
});
