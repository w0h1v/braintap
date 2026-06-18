import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import {
  WORD_LEN,
  MAX_ROWS,
  isWellFormed,
  isValidGuess,
  evaluateGuess,
  isWin,
  mergeKeyStates,
  rowToEmoji,
  buildShareText,
  computeScore,
  validateBrainle,
  hintFor,
  type Verdict,
} from "./engine";
import { ANSWERS, VALID, THEMED, HINTS } from "./words";
import { getDailyPuzzle } from "./generator";

const START = "2025-01-01";
const SAMPLE = 400; // > one full year of daily puzzles

describe("brainle word bank", () => {
  it("ships at least 365 answers", () => {
    expect(ANSWERS.length).toBeGreaterThanOrEqual(365);
  });

  it("every answer is well-formed and in the valid-guess dictionary", () => {
    for (const w of ANSWERS) {
      expect(isWellFormed(w), `${w} not well-formed`).toBe(true);
      expect(VALID.has(w), `${w} missing from valid set`).toBe(true);
    }
  });

  it("the answer bank has no duplicates", () => {
    expect(new Set(ANSWERS).size).toBe(ANSWERS.length);
  });

  it("themed words lead the bank and each has a hint", () => {
    THEMED.forEach((w, i) => {
      expect(ANSWERS[i]).toBe(w);
      expect(typeof HINTS[w]).toBe("string");
      expect(HINTS[w].length).toBeGreaterThan(0);
    });
  });

  it("every valid-guess entry is a 5-letter uppercase word", () => {
    for (const w of VALID) {
      expect(isWellFormed(w), `${w} malformed in valid set`).toBe(true);
    }
  });
});

describe("brainle evaluator (feedback correctness)", () => {
  it("scores a perfect guess as all-correct", () => {
    expect(evaluateGuess("BRAIN", "BRAIN")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ] as Verdict[]);
  });

  it("marks present vs absent for misplaced letters", () => {
    // FOCUS = F O C U S, COUGH = C O U G H
    // C present (in word, wrong spot), O correct (pos 1), U present, G absent, H absent
    expect(evaluateGuess("COUGH", "FOCUS")).toEqual([
      "present",
      "correct",
      "present",
      "absent",
      "absent",
    ] as Verdict[]);
  });

  it("handles duplicate guess letters where answer has only one", () => {
    // answer ABIDE has one A. Guess AROMA: first A correct, last A absent.
    const v = evaluateGuess("AROMA", "ABIDE");
    expect(v[0]).toBe("correct"); // A in position
    expect(v[4]).toBe("absent"); // second A has no remaining pool
  });

  it("handles duplicate guess letters where answer has two", () => {
    // answer LLAMA has two L's. Guess LOLLY: positions of L
    // LLAMA = L L A M A; LOLLY = L O L L Y
    // pos0 L correct; pos2 L: answer has 2 L's, one consumed by exact -> present;
    // pos3 L: pool exhausted -> absent
    const v = evaluateGuess("LOLLY", "LLAMA");
    expect(v[0]).toBe("correct");
    expect(v[1]).toBe("absent"); // O
    expect(v[2]).toBe("present"); // L still available
    expect(v[3]).toBe("absent"); // L pool now empty
    expect(v[4]).toBe("absent"); // Y
  });

  it("present letters are assigned left-to-right within the pool", () => {
    // SPEED = S P E E D, guess GEESE = G E E S E (three E guessed, two in answer)
    // pos1 E present, pos2 E present (pool of 2 spent), pos4 E absent (pool empty),
    // pos3 S present (S in answer), pos0 G absent
    // SPEED = S P E E D, GEESE = G E E S E
    // pos2 E==E -> correct (consumes one of two E); pos1 E -> present (last E in pool);
    // pos4 E -> absent (pool empty); pos3 S -> present; pos0 G -> absent
    const v = evaluateGuess("GEESE", "SPEED");
    expect(v[0]).toBe("absent"); // G
    expect(v[1]).toBe("present"); // first guessed E, pool still has one
    expect(v[2]).toBe("correct"); // E in correct spot
    expect(v[3]).toBe("present"); // S present
    expect(v[4]).toBe("absent"); // third E, pool empty
  });

  it("isWin only true for all-correct", () => {
    expect(isWin(evaluateGuess("BRAIN", "BRAIN"))).toBe(true);
    expect(isWin(evaluateGuess("BRAID", "BRAIN"))).toBe(false);
  });

  it("merges keyboard states with correct > present > absent precedence", () => {
    let ks: Record<string, Verdict> = {};
    // E first seen absent, then present -> upgrades
    ks = mergeKeyStates(ks, "ENTER", ["absent", "absent", "absent", "absent", "absent"]);
    expect(ks.E).toBe("absent");
    ks = mergeKeyStates(ks, "EAGER", ["present", "absent", "absent", "absent", "absent"]);
    expect(ks.E).toBe("present");
    ks = mergeKeyStates(ks, "EAGER", ["correct", "absent", "absent", "absent", "absent"]);
    expect(ks.E).toBe("correct");
    // never downgrades
    ks = mergeKeyStates(ks, "EAGER", ["absent", "absent", "absent", "absent", "absent"]);
    expect(ks.E).toBe("correct");
  });
});

describe("brainle validation helpers", () => {
  it("isWellFormed rejects malformed input", () => {
    expect(isWellFormed("BRAIN")).toBe(true);
    expect(isWellFormed("brain")).toBe(false);
    expect(isWellFormed("BRAI")).toBe(false);
    expect(isWellFormed("BRAINS")).toBe(false);
    expect(isWellFormed("BR4IN")).toBe(false);
  });

  it("isValidGuess requires presence in the dictionary", () => {
    expect(isValidGuess("BRAIN")).toBe(true);
    expect(isValidGuess("ZZZZZ")).toBe(false);
  });
});

describe("brainle share + scoring", () => {
  it("rowToEmoji maps verdicts to emoji", () => {
    expect(rowToEmoji(["correct", "present", "absent", "correct", "present"])).toBe(
      "🟦🟧⬛🟦🟧",
    );
  });

  it("buildShareText shows N/6 on win and X/6 on loss", () => {
    const win = buildShareText(true, ["FOCUS", "BRAIN"], "BRAIN");
    expect(win).toContain("2/6");
    expect(win).toContain("🟦🟦🟦🟦🟦");
    const loss = buildShareText(false, ["FOCUS"], "BRAIN");
    expect(loss).toContain("X/6");
  });

  it("computeScore rewards fewer guesses and gives a floor on loss", () => {
    expect(computeScore(true, 1)).toBe(100);
    expect(computeScore(true, 6)).toBe(60);
    expect(computeScore(false, 6)).toBe(20);
    expect(computeScore(true, 2)).toBeGreaterThan(computeScore(true, 3));
  });

  it("hintFor returns a string for any answer", () => {
    expect(typeof hintFor("BRAIN")).toBe("string");
    expect(hintFor("BRAIN").length).toBeGreaterThan(0);
    // a non-themed answer still gets a fallback hint
    expect(typeof hintFor("TABLE")).toBe("string");
  });
});

describe("brainle daily puzzles are solvable (solvable bank)", () => {
  it(`every daily puzzle across ${SAMPLE} days is well-formed, in-dictionary and self-solvable`, () => {
    let date = START;
    for (let i = 0; i < SAMPLE; i++) {
      const p = getDailyPuzzle(date);

      // determinism
      expect(getDailyPuzzle(date)).toEqual(p);

      // module validator agrees
      expect(validateBrainle(p), `validator failed on ${date}`).toBe(true);

      // answer is well-formed and guessable
      expect(isWellFormed(p.answer)).toBe(true);
      expect(VALID.has(p.answer), `${p.answer} not guessable on ${date}`).toBe(true);

      // a player who guesses the answer wins within the row limit
      const v = evaluateGuess(p.answer, p.answer);
      expect(isWin(v)).toBe(true);
      expect(p.answer.length).toBe(WORD_LEN);

      date = addDays(date, 1);
    }
  });

  it("walks the bank without immediate repeats across consecutive days", () => {
    let date = START;
    let prev = "";
    for (let i = 0; i < Math.min(ANSWERS.length, 60); i++) {
      const p = getDailyPuzzle(date);
      expect(p.answer).not.toBe(prev);
      prev = p.answer;
      date = addDays(date, 1);
    }
  });

  it("respects MAX_ROWS as 6", () => {
    expect(MAX_ROWS).toBe(6);
  });
});
