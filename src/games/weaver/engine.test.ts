import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import {
  MIN_WORDS,
  MIN_WORD_LEN,
  MIN_GOAL,
  HIVE_SIZE,
  OUTER_SIZE,
  GOAL_FRACTION,
  goalForWords,
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
import type { Difficulty } from "@/lib/types";

const START = "2025-01-01";
const SAMPLE = 200; // ~6+ months of daily puzzles
const TIERS: readonly Difficulty[] = ["easy", "medium", "hard"];

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

describe("weaver goalForWords (tier knob)", () => {
  it("scales the goal by the tier fraction, rounded up", () => {
    // 20 findable words → easy 25% = 5, medium 50% = 10, hard 75% = 15
    expect(goalForWords(20, "easy")).toBe(5);
    expect(goalForWords(20, "medium")).toBe(10);
    expect(goalForWords(20, "hard")).toBe(15);
  });

  it("escalates monotonically easy < medium < hard for a rich hive", () => {
    const e = goalForWords(40, "easy");
    const m = goalForWords(40, "medium");
    const h = goalForWords(40, "hard");
    expect(e).toBeLessThan(m);
    expect(m).toBeLessThan(h);
  });

  it("clamps to [MIN_GOAL, total] and defaults to medium", () => {
    expect(goalForWords(0, "hard")).toBe(0);
    // a lean hive never asks for fewer than MIN_GOAL...
    expect(goalForWords(4, "easy")).toBe(MIN_GOAL);
    // ...nor more than the words on offer
    expect(goalForWords(2, "hard")).toBe(2);
    // omitting the tier behaves like medium
    expect(goalForWords(20)).toBe(goalForWords(20, "medium"));
  });

  it("fractions are ordered easy < medium < hard", () => {
    expect(GOAL_FRACTION.easy).toBeLessThan(GOAL_FRACTION.medium);
    expect(GOAL_FRACTION.medium).toBeLessThan(GOAL_FRACTION.hard);
  });
});

describe("weaver per-tier daily puzzles", () => {
  it("each tier serves a DIFFERENT pangram/hive on the same day", () => {
    let date = START;
    let allThreeDistinctDays = 0;
    for (let i = 0; i < SAMPLE; i++) {
      const keys = TIERS.map((t) => {
        const p = getDailyPuzzle(date, t);
        return p.center + p.outer.join("");
      });
      if (new Set(keys).size === 3) allThreeDistinctDays++;
      date = addDays(date, 1);
    }
    // The tier-scoped bank index keeps the three tiers out of sync, so the vast
    // majority of days serve three distinct hives.
    expect(allThreeDistinctDays).toBeGreaterThan(SAMPLE * 0.9);
  });

  it("is deterministic and memoised per (date, difficulty)", () => {
    for (const t of TIERS) {
      const a = getDailyPuzzle("2025-04-09", t);
      const b = getDailyPuzzle("2025-04-09", t);
      expect(a).toEqual(b);
      expect(a.difficulty).toBe(t);
    }
  });

  it("omitting the difficulty yields the medium tier", () => {
    expect(getDailyPuzzle("2025-04-09")).toEqual(getDailyPuzzle("2025-04-09", "medium"));
  });

  it(`every tier across ${SAMPLE} days is valid, solvable, and goal-consistent`, () => {
    for (const t of TIERS) {
      let date = START;
      for (let i = 0; i < SAMPLE; i++) {
        const p = getDailyPuzzle(date, t);

        expect(validateWeaver(p), `tier ${t} validator failed on ${date}`).toBe(true);
        expect(p.difficulty, `tier ${t} mislabelled on ${date}`).toBe(t);
        expect(p.valid.length, `too few words for ${t} on ${date}`).toBeGreaterThanOrEqual(
          MIN_WORDS,
        );

        // the goal matches the engine knob and is reachable
        expect(p.goal, `goal missing for ${t} on ${date}`).toBe(
          goalForWords(p.valid.length, t),
        );
        expect(p.goal!).toBeGreaterThanOrEqual(MIN_GOAL);
        expect(p.goal!).toBeLessThanOrEqual(p.valid.length);

        // the hive is actually solvable up to the goal: pick any `goal` valid
        // words and they all evaluate as accepted in sequence.
        const found = new Set<string>();
        let i2 = 0;
        for (const w of p.valid) {
          if (found.size >= p.goal!) break;
          const r = evaluateWord(w, p, found);
          expect(r.ok, `word ${w} rejected for ${t} on ${date}`).toBe(true);
          found.add(w);
          i2++;
        }
        expect(found.size).toBe(p.goal!);
        expect(i2).toBe(p.goal!);

        date = addDays(date, 1);
      }
    }
  });

  it("goals escalate easy <= medium <= hard on a per-tier average", () => {
    // Tiers draw different hives, so a single day can invert; compare the mean
    // goal across many days to confirm the intended escalation holds overall.
    const sums: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      for (const t of TIERS) sums[t] += getDailyPuzzle(date, t).goal!;
      date = addDays(date, 1);
    }
    expect(sums.easy).toBeLessThan(sums.medium);
    expect(sums.medium).toBeLessThan(sums.hard);
  });

  it("validateWeaver still accepts a legacy puzzle without difficulty/goal", () => {
    const p = getDailyPuzzle(START, "medium");
    const legacy: WeaverPuzzle = {
      center: p.center,
      outer: p.outer,
      valid: p.valid,
      totalScore: p.totalScore,
      pangram: p.pangram,
    };
    expect(legacy.difficulty).toBeUndefined();
    expect(legacy.goal).toBeUndefined();
    expect(validateWeaver(legacy)).toBe(true);
  });

  it("validateWeaver rejects an out-of-range goal", () => {
    const p = getDailyPuzzle(START, "medium");
    expect(validateWeaver({ ...p, goal: p.valid.length + 1 })).toBe(false);
    expect(validateWeaver({ ...p, goal: -1 })).toBe(false);
  });
});
