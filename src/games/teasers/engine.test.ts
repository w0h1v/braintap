import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import {
  RIDDLES_PER_DAY,
  CHOICES,
  RIDDLE_COUNT_BY_DIFFICULTY,
  riddleCountFor,
  validateRiddle,
  validateTeasers,
  scoreFromCorrect,
  verdict,
} from "./engine";
import { RIDDLE_BANK } from "./bank";
import { getDailyPuzzle } from "./generator";
import { DIFFICULTIES } from "@/lib/difficulty";

const START = "2025-01-01";
const SAMPLE = 180; // ~6 months of daily puzzles

describe("teasers bank", () => {
  it("ships an extensive validated bank (>= 120 riddles)", () => {
    expect(RIDDLE_BANK.length).toBeGreaterThanOrEqual(120);
  });

  it("every riddle is well-formed (4 unique choices, valid index, non-empty aha)", () => {
    RIDDLE_BANK.forEach((r, i) => {
      expect(validateRiddle(r), `riddle ${i} malformed: ${r.question}`).toBe(true);
      expect(r.choices.length).toBe(CHOICES);
      const lowered = r.choices.map((c) => c.trim().toLowerCase());
      expect(new Set(lowered).size, `riddle ${i} has duplicate choices`).toBe(CHOICES);
      expect(r.answerIndex).toBeGreaterThanOrEqual(0);
      expect(r.answerIndex).toBeLessThan(CHOICES);
      expect(r.aha.trim().length, `riddle ${i} has empty aha`).toBeGreaterThan(0);
    });
  });

  it("every question in the bank is unique", () => {
    const qs = RIDDLE_BANK.map((r) => r.question.trim().toLowerCase());
    expect(new Set(qs).size).toBe(RIDDLE_BANK.length);
  });

  it("validateRiddle rejects malformed riddles", () => {
    expect(validateRiddle({ question: "", choices: ["a", "b", "c", "d"], answerIndex: 0, aha: "x" })).toBe(false);
    expect(validateRiddle({ question: "q", choices: ["a", "b", "c"] as never, answerIndex: 0, aha: "x" })).toBe(false);
    expect(validateRiddle({ question: "q", choices: ["a", "a", "c", "d"], answerIndex: 0, aha: "x" })).toBe(false);
    expect(validateRiddle({ question: "q", choices: ["a", "b", "c", "d"], answerIndex: 4, aha: "x" })).toBe(false);
    expect(validateRiddle({ question: "q", choices: ["a", "b", "c", "d"], answerIndex: 0, aha: "  " })).toBe(false);
  });
});

describe("teasers difficulty knob", () => {
  it("maps tiers to escalating riddle counts: easy=3, medium=5, hard=7", () => {
    expect(riddleCountFor("easy")).toBe(3);
    expect(riddleCountFor("medium")).toBe(5);
    expect(riddleCountFor("hard")).toBe(7);
    expect(RIDDLE_COUNT_BY_DIFFICULTY.easy).toBe(3);
    expect(RIDDLE_COUNT_BY_DIFFICULTY.medium).toBe(5);
    expect(RIDDLE_COUNT_BY_DIFFICULTY.hard).toBe(7);
    // counts strictly escalate across the unlock chain
    expect(riddleCountFor("easy")).toBeLessThan(riddleCountFor("medium"));
    expect(riddleCountFor("medium")).toBeLessThan(riddleCountFor("hard"));
  });

  it("defaults to the medium count when no tier is given", () => {
    expect(riddleCountFor()).toBe(RIDDLES_PER_DAY);
    expect(RIDDLES_PER_DAY).toBe(5);
  });

  it("getDailyPuzzle defaults to the medium tier", () => {
    const def = getDailyPuzzle("2025-03-14");
    const med = getDailyPuzzle("2025-03-14", "medium");
    expect(def.riddles.map((r) => r.question)).toEqual(med.riddles.map((r) => r.question));
    expect(def.difficulty).toBe("medium");
  });
});

describe.each(DIFFICULTIES)("teasers daily puzzles are solvable (%s)", (tier) => {
  const expectedCount = riddleCountFor(tier);

  it(`every ${tier} puzzle across ${SAMPLE} days is valid with ${expectedCount} distinct riddles`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date, tier);

      expect(p.difficulty, `wrong tier tag on ${date}`).toBe(tier);
      expect(p.riddles.length, `wrong count on ${date} (${tier})`).toBe(expectedCount);
      expect(validateTeasers(p), `validator failed on ${date} (${tier})`).toBe(true);

      // distinct riddles within the day
      const qs = p.riddles.map((r) => r.question);
      expect(new Set(qs).size, `duplicate riddle on ${date} (${tier})`).toBe(expectedCount);

      // every riddle solvable (a single correct, well-formed option)
      for (const r of p.riddles) {
        expect(validateRiddle(r)).toBe(true);
      }

      date = addDays(date, 1);
    }
  });

  it(`${tier} is deterministic per (date, tier)`, () => {
    const a = getDailyPuzzle("2025-03-14", tier);
    const b = getDailyPuzzle("2025-03-14", tier);
    expect(a.riddles.map((r) => r.question)).toEqual(b.riddles.map((r) => r.question));
  });

  it(`${tier} differs across consecutive dates`, () => {
    const a = getDailyPuzzle("2025-03-14", tier);
    const b = getDailyPuzzle("2025-03-15", tier);
    expect(a.riddles.map((r) => r.question)).not.toEqual(b.riddles.map((r) => r.question));
  });
});

describe("teasers tiers differ from one another", () => {
  it("yields a different daily set per tier on the same date", () => {
    let date = START;
    let differingDays = 0;
    for (let i = 0; i < SAMPLE; i++) {
      const easy = getDailyPuzzle(date, "easy").riddles.map((r) => r.question);
      const med = getDailyPuzzle(date, "medium").riddles.map((r) => r.question);
      const hard = getDailyPuzzle(date, "hard").riddles.map((r) => r.question);

      // counts must escalate easy < medium < hard
      expect(easy.length).toBeLessThan(med.length);
      expect(med.length).toBeLessThan(hard.length);

      // tier sets are not identical (different anchor + count)
      const allSame =
        JSON.stringify(easy) === JSON.stringify(med) &&
        JSON.stringify(med) === JSON.stringify(hard);
      if (!allSame) differingDays++;

      date = addDays(date, 1);
    }
    // every sampled day differs across tiers
    expect(differingDays).toBe(SAMPLE);
  });
});

describe("teasers validation is tier-aware and legacy-tolerant", () => {
  it("rejects a puzzle whose count mismatches its tagged tier", () => {
    const easy = getDailyPuzzle("2025-03-14", "easy");
    expect(validateTeasers({ riddles: easy.riddles, difficulty: "hard" })).toBe(false);
  });

  it("accepts legacy (untagged) puzzles with any recognised count", () => {
    const med = getDailyPuzzle("2025-03-14", "medium");
    // strip the difficulty tag to simulate an older shape
    expect(validateTeasers({ riddles: med.riddles })).toBe(true);
  });
});

describe("teasers scoring", () => {
  it("maps correct count to a 0-100 score over a tier total", () => {
    expect(scoreFromCorrect(0)).toBe(0);
    expect(scoreFromCorrect(5)).toBe(100);
    expect(scoreFromCorrect(3)).toBe(60);
    expect(scoreFromCorrect(3, 3)).toBe(100);
    expect(scoreFromCorrect(7, 7)).toBe(100);
  });

  it("verdict copy reflects the tiers (default total = 5)", () => {
    expect(verdict(5)).toBe("Flawless lateral thinking.");
    expect(verdict(4)).toBe("Sharp instincts.");
    expect(verdict(3)).toBe("Sharp instincts.");
    expect(verdict(2)).toBe("The aha takes practice.");
    expect(verdict(0)).toBe("The aha takes practice.");
  });

  it("verdict scales with an explicit total", () => {
    expect(verdict(3, 3)).toBe("Flawless lateral thinking.");
    expect(verdict(2, 3)).toBe("Sharp instincts."); // 0.67 >= 0.6
    expect(verdict(7, 7)).toBe("Flawless lateral thinking.");
    expect(verdict(5, 7)).toBe("Sharp instincts."); // 0.714 >= 0.6
    expect(verdict(4, 7)).toBe("The aha takes practice."); // 0.571 < 0.6
  });
});
