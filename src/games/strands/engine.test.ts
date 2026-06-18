import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/daily";
import { rngFromString } from "@/lib/rng";
import {
  COLS,
  ROWS,
  CELLS,
  adjacent,
  isConnectedPath,
  spangramSpans,
  findWordPaths,
  packGrid,
  validatePuzzle,
  getHint,
  type Cell,
} from "./engine";
import { BANK } from "./bank";
import { buildPuzzle, getDailyPuzzle } from "./generator";
import { DIFFICULTIES } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";

const START = "2025-01-01";
const DAYS = 200; // >180 days

/** Expected hint generosity per tier (easy generous, hard none). */
const EXPECTED_MAX_HINTS: Record<Difficulty, number> = {
  easy: 3,
  medium: 1,
  hard: 0,
};

describe("strands engine primitives", () => {
  it("adjacency is 8-directional and excludes self", () => {
    expect(adjacent([0, 0], [1, 1])).toBe(true);
    expect(adjacent([0, 0], [0, 1])).toBe(true);
    expect(adjacent([0, 0], [0, 0])).toBe(false);
    expect(adjacent([0, 0], [0, 2])).toBe(false);
    expect(adjacent([0, 0], [2, 2])).toBe(false);
  });

  it("isConnectedPath rejects gaps and reuse", () => {
    expect(isConnectedPath([[0, 0], [0, 1], [1, 1]])).toBe(true);
    expect(isConnectedPath([[0, 0], [0, 2]])).toBe(false); // gap
    expect(isConnectedPath([[0, 0], [0, 1], [0, 0]])).toBe(false); // reuse
    expect(isConnectedPath([[-1, 0], [0, 0]])).toBe(false); // out of bounds
  });

  it("spangramSpans needs two opposite edges", () => {
    const topToBottom: Cell[] = Array.from({ length: ROWS }, (_, r) => [r, 0]);
    expect(spangramSpans(topToBottom)).toBe(true);
    const leftToRight: Cell[] = Array.from({ length: COLS }, (_, c) => [0, c]);
    expect(spangramSpans(leftToRight)).toBe(true);
    expect(spangramSpans([[1, 1], [2, 2]])).toBe(false);
  });

  it("packGrid lays words to cover all cells with a spanning spangram", () => {
    const rng = rngFromString("strands-test:pack");
    // spangram(8) + words summing to 40 = 48 cells exactly
    const words = ["DENDRITE", "SYNAPSE", "CORTEX", "NEURON", "THALAMUS", "NERVE"];
    const sum = words.reduce((n, w) => n + w.length, 0);
    expect(sum + "CEREBRUM".length).toBe(CELLS); // fixture sanity: 48
    const placements = packGrid(words, "CEREBRUM", rng);
    expect(placements).not.toBeNull();
    const cover = new Set<string>();
    for (const key of Object.keys(placements!)) {
      const pl = placements![key];
      expect(isConnectedPath(pl.path)).toBe(true);
      pl.path.forEach(([r, c]) => cover.add(`${r},${c}`));
    }
    expect(cover.size).toBe(CELLS);
    expect(spangramSpans(placements!["CEREBRUM"].path)).toBe(true);
  });
});

describe("strands getHint", () => {
  it("reveals the shortest unfound theme word with a valid solution path", () => {
    const p = getDailyPuzzle("2025-03-14");
    const hint = getHint(p, []);
    expect(hint).not.toBeNull();
    // Should be a theme word (not the spangram) while plain words remain.
    expect(hint!.spangram).toBe(false);
    expect(p.words).toContain(hint!.word);
    // It picks the shortest available word.
    const shortest = Math.min(...p.words.map((w) => w.length));
    expect(hint!.word.length).toBe(shortest);
    // The revealed path matches the puzzle's placement and is connected.
    expect(hint!.path).toEqual(p.placements[hint!.word].path);
    expect(isConnectedPath(hint!.path)).toBe(true);
  });

  it("is deterministic and skips already-found words", () => {
    const p = getDailyPuzzle("2025-03-14");
    const first = getHint(p, [])!;
    expect(getHint(p, [])!.word).toBe(first.word); // deterministic
    const second = getHint(p, [first.word]);
    expect(second).not.toBeNull();
    expect(second!.word).not.toBe(first.word);
  });

  it("falls back to the spangram only when it is the last target, and null when none remain", () => {
    const p = getDailyPuzzle("2025-03-14");
    const onlySpangramLeft = getHint(p, p.words);
    expect(onlySpangramLeft).not.toBeNull();
    expect(onlySpangramLeft!.word).toBe(p.spangram);
    expect(onlySpangramLeft!.spangram).toBe(true);
    expect(getHint(p, [p.spangram, ...p.words])).toBeNull();
  });
});

describe("strands bank is well-formed", () => {
  it("has at least 60 themes", () => {
    expect(BANK.length).toBeGreaterThanOrEqual(60);
  });

  it("every theme is buildable and 48-letter packable (solvable)", () => {
    for (const entry of BANK) {
      const rng = rngFromString(`strands-bank:${entry.name}`);
      const puzzle = buildPuzzle(entry, rng);
      expect(puzzle, `theme ${entry.name} failed to build`).not.toBeNull();
      expect(validatePuzzle(puzzle!), `theme ${entry.name} invalid`).toBe(true);
      const total =
        puzzle!.spangram.length +
        puzzle!.words.reduce((n, w) => n + w.length, 0);
      expect(total).toBe(CELLS);
    }
  });

  it("words and spangrams are uppercase A-Z and sanely sized", () => {
    for (const entry of BANK) {
      expect(/^[A-Z]+$/.test(entry.spangram.toUpperCase())).toBe(true);
      expect(entry.spangram.length).toBeGreaterThanOrEqual(7);
      for (const w of entry.words) {
        expect(/^[A-Z]+$/.test(w.toUpperCase()), `bad word ${w}`).toBe(true);
        expect(w.length).toBeGreaterThanOrEqual(3);
        expect(w.length).toBeLessThanOrEqual(9);
      }
    }
  });
});

describe("strands daily puzzles are solvable (solvable bank)", () => {
  it(`every puzzle across ${DAYS} days packs and is fully findable`, () => {
    let date = START;
    for (let i = 0; i < DAYS; i++) {
      const p = getDailyPuzzle(date);

      // module validator agrees
      expect(validatePuzzle(p), `validator failed on ${date}`).toBe(true);

      // exactly 48 letters across all targets
      const total = p.spangram.length + p.words.reduce((n, w) => n + w.length, 0);
      expect(total, `letter count off on ${date}`).toBe(CELLS);

      // every target word is findable as a connected path
      for (const w of [p.spangram, ...p.words]) {
        const fwd = findWordPaths(p.grid, w);
        const rev = findWordPaths(p.grid, w.split("").reverse().join(""));
        expect(fwd.length + rev.length, `${w} not findable on ${date}`).toBeGreaterThanOrEqual(1);
      }

      date = addDays(date, 1);
    }
  });

  it("is deterministic per date", () => {
    const a = getDailyPuzzle("2025-03-14");
    const b = getDailyPuzzle("2025-03-14");
    expect(a.grid).toEqual(b.grid);
    expect(a.words).toEqual(b.words);
    expect(a.theme).toBe(b.theme);
  });

  it("defaults to the medium tier when difficulty is omitted", () => {
    const def = getDailyPuzzle("2025-03-14");
    const med = getDailyPuzzle("2025-03-14", "medium");
    expect(def.theme).toBe(med.theme);
    expect(def.grid).toEqual(med.grid);
    expect(def.maxHints).toBe(med.maxHints);
  });
});

describe("strands difficulty tiers", () => {
  it("each tier is valid + solvable across many days with the right hint budget", () => {
    for (const tier of DIFFICULTIES) {
      let date = START;
      for (let i = 0; i < DAYS; i++) {
        const p = getDailyPuzzle(date, tier);

        // Well-formed + fully solvable per the module validator.
        expect(validatePuzzle(p), `${tier} validator failed on ${date}`).toBe(true);

        // Exactly 48 letters across all targets.
        const total = p.spangram.length + p.words.reduce((n, w) => n + w.length, 0);
        expect(total, `${tier} letter count off on ${date}`).toBe(CELLS);

        // Every target is findable as a connected path (fwd or reversed).
        for (const w of [p.spangram, ...p.words]) {
          const fwd = findWordPaths(p.grid, w);
          const rev = findWordPaths(p.grid, w.split("").reverse().join(""));
          expect(
            fwd.length + rev.length,
            `${w} not findable (${tier}) on ${date}`,
          ).toBeGreaterThanOrEqual(1);
        }

        // Tier knob: hint generosity escalates downward as difficulty rises.
        expect(p.maxHints, `${tier} maxHints wrong on ${date}`).toBe(
          EXPECTED_MAX_HINTS[tier],
        );

        date = addDays(date, 1);
      }
    }
  });

  it("hint budget strictly decreases easy → medium → hard", () => {
    const easy = getDailyPuzzle("2025-03-14", "easy");
    const medium = getDailyPuzzle("2025-03-14", "medium");
    const hard = getDailyPuzzle("2025-03-14", "hard");
    expect(easy.maxHints!).toBeGreaterThan(medium.maxHints!);
    expect(medium.maxHints!).toBeGreaterThan(hard.maxHints!);
    expect(hard.maxHints).toBe(0);
  });

  it("serves a DIFFERENT board per tier on a given day (mostly distinct)", () => {
    // Across a span of days, the three tiers should rarely coincide because
    // each uses a tier-scoped bank index. Require the vast majority distinct.
    let date = START;
    let allThreeDistinct = 0;
    const SAMPLE = 60;
    for (let i = 0; i < SAMPLE; i++) {
      const e = getDailyPuzzle(date, "easy").theme;
      const m = getDailyPuzzle(date, "medium").theme;
      const h = getDailyPuzzle(date, "hard").theme;
      if (e !== m && m !== h && e !== h) allThreeDistinct++;
      date = addDays(date, 1);
    }
    // With a 63-entry bank and distinct per-tier offsets, near-all days differ.
    expect(allThreeDistinct).toBeGreaterThan(SAMPLE - 5);
  });

  it("is deterministic per (date, tier)", () => {
    for (const tier of DIFFICULTIES) {
      const a = getDailyPuzzle("2025-04-02", tier);
      const b = getDailyPuzzle("2025-04-02", tier);
      expect(a.grid).toEqual(b.grid);
      expect(a.theme).toBe(b.theme);
      expect(a.maxHints).toBe(b.maxHints);
    }
  });
});
