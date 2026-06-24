/**
 * Achievements / milestones — a lightweight, local-first habit layer.
 *
 * Every achievement is DERIVED from the progress the store already keeps
 * (results, per-tier results, longest streak), so there is no separate source of
 * truth to drift and nothing to sync: `computeUnlocked` is a pure function of a
 * progress snapshot. The store persists the earned set so an unlock survives a
 * later streak reset, and surfaces newly-earned ids the moment they tip over.
 *
 * Imports only the pure `@/games/_meta` data (never `@/lib/games`, which pulls
 * in every game module) so this stays safe to import from the progress store.
 */

import type { GameId, Difficulty, SkillDomain } from "./types";
import type { StoredResult } from "./progress";
import { GAME_METAS, GAME_ORDER } from "@/games/_meta";

export interface Achievement {
  id: string;
  /** Short badge title. */
  title: string;
  /** How it's earned (shown on the badge + as the unlock toast subtitle). */
  description: string;
  emoji: string;
}

const TOTAL_GAMES = GAME_ORDER.length;
const TOTAL_DOMAINS = 6;

/** The catalogue, in display + toast order (earliest/easiest first). */
export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first-win", title: "First Spark", description: "Win your first puzzle.", emoji: "✨" },
  { id: "streak-3", title: "On a Roll", description: "Reach a 3-day streak.", emoji: "🔥" },
  { id: "explorer", title: "Explorer", description: "Play 10 different games.", emoji: "🧭" },
  { id: "flawless", title: "Flawless", description: "Score a perfect 100.", emoji: "💯" },
  { id: "tier-master", title: "Tier Master", description: "Clear Easy, Medium and Hard of one game in a day.", emoji: "🎯" },
  { id: "polymath", title: "Polymath", description: "Train all six brain domains.", emoji: "🧠" },
  { id: "streak-7", title: "Seven Strong", description: "Reach a 7-day streak.", emoji: "🗓️" },
  { id: "clean-sweep", title: "Clean Sweep", description: `Finish all ${TOTAL_GAMES} games in one day.`, emoji: "🧹" },
  { id: "centurion", title: "Centurion", description: "Play 100 puzzles.", emoji: "💪" },
  { id: "completionist", title: "Completionist", description: `Play all ${TOTAL_GAMES} games.`, emoji: "🏆" },
  { id: "streak-30", title: "Unstoppable", description: "Reach a 30-day streak.", emoji: "🚀" },
];

export const ACHIEVEMENT_BY_ID: Readonly<Record<string, Achievement>> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

export interface AchievementSnapshot {
  results: Record<string, Partial<Record<GameId, StoredResult>>>;
  tierResults: Record<string, Partial<Record<GameId, Partial<Record<Difficulty, StoredResult>>>>>;
  longestStreak: number;
}

/** The set of achievement ids currently earned for this snapshot. */
export function computeUnlocked(snap: AchievementSnapshot): Set<string> {
  const unlocked = new Set<string>();
  const { results, tierResults, longestStreak } = snap;

  const distinctGames = new Set<GameId>();
  const domains = new Set<SkillDomain>();
  let totalPlays = 0;
  let anyWon = false;
  let anyPerfect = false;
  let sweepDay = false;

  for (const day of Object.values(results)) {
    if (!day) continue;
    const ids = Object.keys(day) as GameId[];
    if (ids.length >= TOTAL_GAMES) sweepDay = true;
    for (const id of ids) {
      const r = day[id];
      if (!r) continue;
      totalPlays += 1;
      distinctGames.add(id);
      if (r.status === "won") anyWon = true;
      if (typeof r.score === "number" && r.score >= 100) anyPerfect = true;
      GAME_METAS[id]?.skills.forEach((s) => domains.add(s));
    }
  }

  // Tier mastery: any single game with Easy + Medium + Hard all won on one day.
  let tierMastered = false;
  outer: for (const day of Object.values(tierResults)) {
    if (!day) continue;
    for (const tiers of Object.values(day)) {
      if (
        tiers?.easy?.status === "won" &&
        tiers?.medium?.status === "won" &&
        tiers?.hard?.status === "won"
      ) {
        tierMastered = true;
        break outer;
      }
    }
  }

  if (anyWon) unlocked.add("first-win");
  if (longestStreak >= 3) unlocked.add("streak-3");
  if (longestStreak >= 7) unlocked.add("streak-7");
  if (longestStreak >= 30) unlocked.add("streak-30");
  if (distinctGames.size >= 10) unlocked.add("explorer");
  if (distinctGames.size >= TOTAL_GAMES) unlocked.add("completionist");
  if (sweepDay) unlocked.add("clean-sweep");
  if (tierMastered) unlocked.add("tier-master");
  if (domains.size >= TOTAL_DOMAINS) unlocked.add("polymath");
  if (anyPerfect) unlocked.add("flawless");
  if (totalPlays >= 100) unlocked.add("centurion");

  return unlocked;
}

/**
 * Newly-earned ids: present in the fresh snapshot but not in the already-earned
 * set. Returned in catalogue order for stable, pleasant toast sequencing.
 */
export function newlyUnlocked(snap: AchievementSnapshot, already: readonly string[]): string[] {
  const have = new Set(already);
  const fresh = computeUnlocked(snap);
  return ACHIEVEMENTS.filter((a) => fresh.has(a.id) && !have.has(a.id)).map((a) => a.id);
}
