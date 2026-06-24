import { describe, it, expect } from "vitest";
import { computeUnlocked, newlyUnlocked, ACHIEVEMENTS } from "./achievements";
import { GAME_ORDER } from "@/games/_meta";
import type { StoredResult } from "./progress";
import type { GameId, Difficulty } from "./types";

const N = GAME_ORDER.length;

function res(status: StoredResult["status"], score = 50): StoredResult {
  return { status, score, gameId: "brainle", dateISO: "2025-01-01", playedAt: 0 } as StoredResult;
}

function day(ids: GameId[], status: StoredResult["status"] = "won", score = 50) {
  const d: Partial<Record<GameId, StoredResult>> = {};
  for (const id of ids) d[id] = res(status, score);
  return d;
}

type Snap = Parameters<typeof computeUnlocked>[0];
function snap(partial: Partial<Snap>): Snap {
  return { results: {}, tierResults: {}, longestStreak: 0, ...partial };
}

describe("achievements — computeUnlocked", () => {
  it("grants nothing for an empty snapshot", () => {
    expect(computeUnlocked(snap({})).size).toBe(0);
  });

  it("first-win requires an actual win (not just a play)", () => {
    expect(computeUnlocked(snap({ results: { d: day(["brainle"], "played") } })).has("first-win")).toBe(false);
    expect(computeUnlocked(snap({ results: { d: day(["brainle"], "won") } })).has("first-win")).toBe(true);
  });

  it("streak tiers track longestStreak", () => {
    expect(computeUnlocked(snap({ longestStreak: 2 })).has("streak-3")).toBe(false);
    expect(computeUnlocked(snap({ longestStreak: 3 })).has("streak-3")).toBe(true);
    const big = computeUnlocked(snap({ longestStreak: 30 }));
    expect(big.has("streak-3") && big.has("streak-7") && big.has("streak-30")).toBe(true);
  });

  it("explorer at 10 distinct games, completionist at all of them", () => {
    const ten = computeUnlocked(snap({ results: { d: day(GAME_ORDER.slice(0, 10)) } }));
    expect(ten.has("explorer")).toBe(true);
    expect(ten.has("completionist")).toBe(false);
    const all = computeUnlocked(snap({ results: { d: day([...GAME_ORDER]) } }));
    expect(all.has("completionist")).toBe(true);
  });

  it("clean-sweep needs every game in a single day", () => {
    // 10 + 10 across two days = 20 distinct, but no single sweep day
    const split = computeUnlocked(
      snap({ results: { a: day(GAME_ORDER.slice(0, 10)), b: day(GAME_ORDER.slice(10)) } }),
    );
    expect(split.has("completionist")).toBe(true);
    expect(split.has("clean-sweep")).toBe(false);
    expect(computeUnlocked(snap({ results: { a: day([...GAME_ORDER]) } })).has("clean-sweep")).toBe(true);
  });

  it("tier-master needs Easy+Medium+Hard all won for one game on a day", () => {
    const tiers = (...won: Difficulty[]) => {
      const t: Partial<Record<Difficulty, StoredResult>> = {};
      for (const d of won) t[d] = res("won");
      return { d: { brainle: t } };
    };
    expect(computeUnlocked(snap({ tierResults: tiers("easy", "medium") })).has("tier-master")).toBe(false);
    expect(computeUnlocked(snap({ tierResults: tiers("easy", "medium", "hard") })).has("tier-master")).toBe(true);
  });

  it("polymath needs all six brain domains covered", () => {
    // connections(verbal,logic) + vault(memory) + g2048(numeric,spatial) + schulte(focus) = 6 domains
    const ids: GameId[] = ["connections", "vault", "g2048", "schulte"];
    expect(computeUnlocked(snap({ results: { d: day(ids) } })).has("polymath")).toBe(true);
    expect(computeUnlocked(snap({ results: { d: day(["brainle"]) } })).has("polymath")).toBe(false);
  });

  it("flawless on a perfect score; centurion at 100 plays", () => {
    expect(computeUnlocked(snap({ results: { d: day(["brainle"], "won", 100) } })).has("flawless")).toBe(true);
    const results: Snap["results"] = {};
    for (let i = 0; i < 100; i++) results[`d${i}`] = day(["brainle"]);
    expect(computeUnlocked(snap({ results })).has("centurion")).toBe(true);
  });
});

describe("achievements — newlyUnlocked", () => {
  it("returns only freshly-earned ids, in catalogue order", () => {
    const s = snap({ results: { d: day(["brainle"], "won") }, longestStreak: 3 });
    // already have first-win; streak-3 is new
    expect(newlyUnlocked(s, ["first-win"])).toEqual(["streak-3"]);
    // nothing new when everything earned is already known
    expect(newlyUnlocked(s, ["first-win", "streak-3"])).toEqual([]);
  });

  it("every id it returns exists in the catalogue", () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    const fresh = newlyUnlocked(snap({ results: { d: day([...GAME_ORDER], "won", 100) }, longestStreak: 30 }), []);
    expect(fresh.length).toBeGreaterThan(0);
    for (const id of fresh) expect(ids.has(id)).toBe(true);
  });
});
