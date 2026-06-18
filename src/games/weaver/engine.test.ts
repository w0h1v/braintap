import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import {
  MIN_WORDS,
  MIN_WORD_LEN,
  HIVE_SIZE,
  OUTER_SIZE,
  evaluateWord,
  getHint,
  hiveLetters,
  isPangram,
  scoreOf,
  rankFor,
  validateWeaver,
  findValidWords,
  type WeaverPuzzle,
} from "./engine";
import { getDailyPuzzle } from "./generator";
import { PANGRAMS } from "./pangrams";
import { WORD_SET } from "./dictionary";

const START = "2025-01-01";
const SAMPLE = 200; // ~6+ months of daily puzzles

describe("weaver scoring", () => {
  const hive = new Set(["R", "B", "A", "I", "N", "E", "D"]);

  it("scores by length with a 4-letter floor", () => {
    expect(scoreOf("RAIN", hive)).toBe(1); // 4 letters → 1
    expect(scoreOf("BRAIN", hive)).toBe(5); // 5 letters → 5
    expect(scoreOf("BREAD", hive)).toBe(5);
  });

  it("awards +7 bonus for a pangram using all 7 letters", () => {
    expect(isPangram("BRAINED", hive)).toBe(true);
    expect(scoreOf("BRAINED", hive)).toBe(7 + 7); // 14
    expect(isPangram("BRAIN", hive)).toBe(false);
  });

  it("ranks by fraction of total score", () => {
    expect(rankFor(0, 100)).toBe("Novice");
    expect(rankFor(10, 100)).toBe("Spark");
    expect(rankFor(50, 100)).toBe("Brilliant");
    expect(rankFor(95, 100)).toBe("Mastermind");
    expect(rankFor(0, 0)).toBe("Novice");
  });
});

describe("weaver word evaluation", () => {
  const puzzle = getDailyPuzzle(START);
  const empty = new Set<string>();

  it("accepts a real findable word", () => {
    const w = puzzle.valid[0];
    const r = evaluateWord(w, puzzle, empty);
    expect(r.ok).toBe(true);
  });

  it("rejects short, center-less, alien, duplicate and unknown words", () => {
    expect(evaluateWord("AB", puzzle, empty)).toEqual({ ok: false, reason: "short" });

    // a word missing the center letter
    const noCenter = "Z".repeat(4); // guaranteed alien too, but length ok
    const r = evaluateWord(noCenter, puzzle, empty);
    expect(r.ok).toBe(false);

    // duplicate
    const w = puzzle.valid[0];
    expect(evaluateWord(w, puzzle, new Set([w]))).toEqual({
      ok: false,
      reason: "duplicate",
    });

    // unknown but in-hive word: build from hive letters + center, not in list
    const hive = [...hiveLetters(puzzle)];
    const fake = puzzle.center + puzzle.center + puzzle.center + puzzle.center;
    if (!puzzle.valid.includes(fake)) {
      expect(evaluateWord(fake, puzzle, empty)).toEqual({
        ok: false,
        reason: "unknown",
      });
    }
    expect(hive.length).toBe(HIVE_SIZE);
  });

  it("is case-insensitive", () => {
    const w = puzzle.valid[0];
    expect(evaluateWord(w.toLowerCase(), puzzle, empty).ok).toBe(true);
  });
});

describe("weaver hint helper", () => {
  const puzzle = getDailyPuzzle(START);
  const empty = new Set<string>();

  it("returns a not-yet-found valid word with its score and 2-letter prefix", () => {
    const hint = getHint(puzzle, empty);
    expect(hint).not.toBeNull();
    const h = hint!;
    expect(puzzle.valid).toContain(h.word);
    expect(empty.has(h.word)).toBe(false);
    expect(h.points).toBe(scoreOf(h.word, hiveLetters(puzzle)));
    expect(h.prefix).toBe(h.word.slice(0, 2));
  });

  it("is deterministic and pure (does not mutate inputs)", () => {
    const a = getHint(puzzle, empty);
    const b = getHint(puzzle, empty);
    expect(a).toEqual(b);
    expect(empty.size).toBe(0);
  });

  it("skips already-found words", () => {
    const first = getHint(puzzle, empty)!;
    const next = getHint(puzzle, new Set([first.word]));
    expect(next).not.toBeNull();
    expect(next!.word).not.toBe(first.word);
  });

  it("prefers a medium-length word over the pangram or shortest words", () => {
    const lens = puzzle.valid.map((w) => w.length);
    const mid = (Math.min(...lens) + Math.max(...lens)) / 2;
    const h = getHint(puzzle, empty)!;
    // chosen word is at least as close to the midpoint as the pangram
    expect(Math.abs(h.word.length - mid)).toBeLessThanOrEqual(
      Math.abs(puzzle.pangram.length - mid),
    );
  });

  it("returns null when every valid word is found", () => {
    expect(getHint(puzzle, new Set(puzzle.valid))).toBeNull();
  });
});

describe("weaver determinism", () => {
  it("same date yields the same puzzle", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a).toEqual(b);
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.center + a.outer.join("")).not.toEqual(b.center + b.outer.join(""));
  });
});

describe("weaver puzzle bank is solvable", () => {
  it("every bundled pangram is a real 7-distinct-letter word in the dictionary", () => {
    expect(PANGRAMS.length).toBeGreaterThanOrEqual(365);
    for (const p of PANGRAMS) {
      expect(/^[A-Z]+$/.test(p), `pangram ${p} not uppercase`).toBe(true);
      expect(new Set(p).size, `pangram ${p} not 7 distinct`).toBe(HIVE_SIZE);
      expect(WORD_SET.has(p), `pangram ${p} missing from dictionary`).toBe(true);
    }
  });

  it("every pangram builds a well-formed, solvable hive with a pangram + min words", () => {
    for (const p of PANGRAMS) {
      // mirror the generator's hive construction directly from the pangram
      const letters = [...new Set(p)].sort();
      let best: WeaverPuzzle | null = null;
      for (const center of letters) {
        const outer = letters.filter((l) => l !== center);
        const valid = findValidWords(center, outer);
        if (!best || valid.length > best.valid.length) {
          const hive = new Set(letters);
          if (!valid.some((w) => isPangram(w, hive))) continue;
          best = {
            center,
            outer,
            valid,
            totalScore: valid.reduce((s, w) => s + scoreOf(w, hive), 0),
            pangram: valid
              .filter((w) => isPangram(w, hive))
              .sort((a, b) => a.length - b.length || (a < b ? -1 : 1))[0],
          };
        }
      }
      expect(best, `no usable hive for ${p}`).not.toBeNull();
      const puzzle = best as WeaverPuzzle;
      expect(puzzle.outer.length).toBe(OUTER_SIZE);
      expect(puzzle.valid.length, `too few words for ${p}`).toBeGreaterThanOrEqual(
        MIN_WORDS,
      );
      expect(validateWeaver(puzzle), `validateWeaver failed for ${p}`).toBe(true);
    }
  });

  it(`every daily puzzle across ${SAMPLE} days is solvable and well-formed`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      expect(validateWeaver(p), `validator failed on ${date}`).toBe(true);
      expect(p.valid.length, `too few words on ${date}`).toBeGreaterThanOrEqual(
        MIN_WORDS,
      );

      // the pangram is present and uses all hive letters
      const hive = hiveLetters(p);
      expect(isPangram(p.pangram, hive), `bad pangram on ${date}`).toBe(true);
      expect(p.valid).toContain(p.pangram);

      // every valid word satisfies the rules
      for (const w of p.valid) {
        expect(w.length).toBeGreaterThanOrEqual(MIN_WORD_LEN);
        expect(w.includes(p.center)).toBe(true);
        for (const ch of w) expect(hive.has(ch)).toBe(true);
      }

      // totalScore matches the maximum attainable score
      const max = p.valid.reduce((s, w) => s + scoreOf(w, hive), 0);
      expect(p.totalScore).toBe(max);

      date = addDays(date, 1);
    }
  });

  it("consecutive days walk the bank without immediate repeats", () => {
    const seen = new Set<string>();
    let date = START;
    for (let i = 0; i < 60; i++) {
      const p = getDailyPuzzle(date);
      const key = p.center + p.outer.join("");
      seen.add(key);
      date = addDays(date, 1);
    }
    // 60 consecutive days should yield many distinct hives
    expect(seen.size).toBeGreaterThan(50);
  });
});
