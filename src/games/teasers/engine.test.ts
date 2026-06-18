import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import {
  RIDDLES_PER_DAY,
  CHOICES,
  validateRiddle,
  validateTeasers,
  scoreFromCorrect,
  verdict,
} from "./engine";
import { RIDDLE_BANK } from "./bank";
import { getDailyPuzzle } from "./generator";

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

describe("teasers daily puzzles are solvable (solvable bank)", () => {
  it(`every daily puzzle across ${SAMPLE} days is valid and has 5 distinct riddles`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      expect(p.riddles.length, `wrong count on ${date}`).toBe(RIDDLES_PER_DAY);
      expect(validateTeasers(p), `validator failed on ${date}`).toBe(true);

      // five distinct riddles within the day
      const qs = p.riddles.map((r) => r.question);
      expect(new Set(qs).size, `duplicate riddle on ${date}`).toBe(RIDDLES_PER_DAY);

      // every riddle solvable (a single correct, well-formed option)
      for (const r of p.riddles) {
        expect(validateRiddle(r)).toBe(true);
      }

      date = addDays(date, 1);
    }
  });

  it("is deterministic per date", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.riddles.map((r) => r.question)).toEqual(b.riddles.map((r) => r.question));
  });

  it("different dates generally differ", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-15");
    expect(a.riddles.map((r) => r.question)).not.toEqual(b.riddles.map((r) => r.question));
  });
});

describe("teasers scoring", () => {
  it("maps correct count to a 0-100 score", () => {
    expect(scoreFromCorrect(0)).toBe(0);
    expect(scoreFromCorrect(5)).toBe(100);
    expect(scoreFromCorrect(3)).toBe(60);
  });

  it("verdict copy reflects the tiers", () => {
    expect(verdict(5)).toBe("Flawless lateral thinking.");
    expect(verdict(4)).toBe("Sharp instincts.");
    expect(verdict(3)).toBe("Sharp instincts.");
    expect(verdict(2)).toBe("The aha takes practice.");
    expect(verdict(0)).toBe("The aha takes practice.");
  });
});
