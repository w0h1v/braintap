"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GameId, GameResult, Difficulty } from "./types";
import { todayISO, addDays } from "./daily";
import { prevDifficulty } from "./difficulty";
import { newlyUnlocked } from "./achievements";

export interface Settings {
  zen: boolean;
  sound: boolean;
  /** Device vibration. Independent of `sound` so muted play keeps haptics. */
  haptics: boolean;
}

export interface StoredResult extends GameResult {
  gameId: GameId;
  dateISO: string;
  playedAt: number;
  /** Tier this result was recorded at (absent for legacy single-puzzle games). */
  difficulty?: Difficulty;
}

/** Per-difficulty result map for a game on a day. */
type TierResultMap = Partial<Record<Difficulty, StoredResult>>;
type TierStateMap = Partial<Record<Difficulty, unknown>>;

interface ProgressState {
  hydrated: boolean;
  settings: Settings;
  onboarded: boolean;
  /** Representative result per game/day (best across tiers): results[dateISO][gameId] */
  results: Record<string, Partial<Record<GameId, StoredResult>>>;
  /** Per-tier results: tierResults[dateISO][gameId][difficulty] */
  tierResults: Record<string, Partial<Record<GameId, TierResultMap>>>;
  /** in-progress resumable state: states[dateISO][gameId] */
  states: Record<string, Partial<Record<GameId, unknown>>>;
  /** Per-tier resume state: tierStates[dateISO][gameId][difficulty] */
  tierStates: Record<string, Partial<Record<GameId, TierStateMap>>>;
  currentStreak: number;
  longestStreak: number;
  lastPlayedISO: string | null;
  /** Game ids the player has starred, newest-first is not guaranteed — display in GAME_ORDER. */
  favorites: GameId[];
  /** Earned achievement ids (monotonic — once earned, stays). Persisted. */
  achievements: string[];

  // actions
  setHydrated: () => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setOnboarded: (v: boolean) => void;
  /** Star / unstar a game (persisted). */
  toggleFavorite: (id: GameId) => void;
  recordResult: (
    gameId: GameId,
    dateISO: string,
    result: GameResult,
    affectsStreak: boolean,
    difficulty?: Difficulty,
  ) => void;
  saveGameState: (
    gameId: GameId,
    dateISO: string,
    state: unknown,
    difficulty?: Difficulty,
  ) => void;
  getResult: (gameId: GameId, dateISO: string) => StoredResult | undefined;
  getTierResult: (
    gameId: GameId,
    dateISO: string,
    difficulty: Difficulty,
  ) => StoredResult | undefined;
  /** Easy is always open; medium/hard unlock when the prior tier is WON. */
  isTierUnlocked: (gameId: GameId, dateISO: string, difficulty: Difficulty) => boolean;
  getGameState: (gameId: GameId, dateISO: string, difficulty?: Difficulty) => unknown;
  resetDay: (dateISO: string) => void;
  resetAll: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      settings: { zen: false, sound: true, haptics: true },
      onboarded: false,
      results: {},
      tierResults: {},
      states: {},
      tierStates: {},
      currentStreak: 0,
      longestStreak: 0,
      lastPlayedISO: null,
      favorites: [],
      achievements: [],

      setHydrated: () => set({ hydrated: true }),

      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((x) => x !== id)
            : [...s.favorites, id],
        })),

      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),

      setOnboarded: (v) => set({ onboarded: v }),

      recordResult: (gameId, dateISO, result, affectsStreak, difficulty) =>
        set((s) => {
          const stored: StoredResult = {
            ...result,
            gameId,
            dateISO,
            playedAt: Date.now(),
            ...(difficulty ? { difficulty } : {}),
          };

          // Representative result (best across tiers) — keeps every existing
          // reader (stats, archive, leaderboard, sync) working unchanged.
          const day = { ...(s.results[dateISO] ?? {}) };
          const prev = day[gameId];
          day[gameId] = pickBetter(prev, stored);

          // Per-tier result (best score, ties broken by faster time).
          let tierResults = s.tierResults;
          if (difficulty) {
            const dayTiers = { ...(s.tierResults[dateISO] ?? {}) };
            const gameTiers = { ...(dayTiers[gameId] ?? {}) };
            gameTiers[difficulty] = pickBetter(gameTiers[difficulty], stored);
            dayTiers[gameId] = gameTiers;
            tierResults = { ...s.tierResults, [dateISO]: dayTiers };
          }

          let { currentStreak, longestStreak, lastPlayedISO } = s;
          if (affectsStreak && !prev) {
            if (lastPlayedISO === dateISO) {
              // already counted today
            } else if (lastPlayedISO && addDays(lastPlayedISO, 1) === dateISO) {
              currentStreak += 1;
            } else if (lastPlayedISO && lastPlayedISO > dateISO) {
              // recording for a past date relative to last play; leave streak
            } else {
              currentStreak = 1;
            }
            if (lastPlayedISO === null || dateISO >= lastPlayedISO) {
              lastPlayedISO = dateISO;
            }
            longestStreak = Math.max(longestStreak, currentStreak);
          }

          const nextResults = { ...s.results, [dateISO]: day };

          // Derive achievements from the freshly-updated snapshot and merge any
          // newly-earned ids into the persisted set (monotonic).
          const fresh = newlyUnlocked(
            { results: nextResults, tierResults, longestStreak },
            s.achievements,
          );

          return {
            results: nextResults,
            tierResults,
            currentStreak,
            longestStreak,
            lastPlayedISO,
            achievements: fresh.length ? [...s.achievements, ...fresh] : s.achievements,
          };
        }),

      saveGameState: (gameId, dateISO, state, difficulty) =>
        set((s) => {
          if (difficulty) {
            const dayTiers = { ...(s.tierStates[dateISO] ?? {}) };
            const gameTiers = { ...(dayTiers[gameId] ?? {}) };
            gameTiers[difficulty] = state;
            dayTiers[gameId] = gameTiers;
            return { tierStates: { ...s.tierStates, [dateISO]: dayTiers } };
          }
          const day = { ...(s.states[dateISO] ?? {}) };
          day[gameId] = state;
          return { states: { ...s.states, [dateISO]: day } };
        }),

      getResult: (gameId, dateISO) => get().results[dateISO]?.[gameId],

      getTierResult: (gameId, dateISO, difficulty) =>
        get().tierResults[dateISO]?.[gameId]?.[difficulty],

      isTierUnlocked: (gameId, dateISO, difficulty) => {
        const prior = prevDifficulty(difficulty);
        if (!prior) return true; // easy is always open
        return get().tierResults[dateISO]?.[gameId]?.[prior]?.status === "won";
      },

      getGameState: (gameId, dateISO, difficulty) =>
        difficulty
          ? get().tierStates[dateISO]?.[gameId]?.[difficulty]
          : get().states[dateISO]?.[gameId],

      resetDay: (dateISO) =>
        set((s) => {
          const results = { ...s.results };
          const tierResults = { ...s.tierResults };
          const states = { ...s.states };
          const tierStates = { ...s.tierStates };
          delete results[dateISO];
          delete tierResults[dateISO];
          delete states[dateISO];
          delete tierStates[dateISO];
          return { results, tierResults, states, tierStates };
        }),

      resetAll: () =>
        set({
          results: {},
          tierResults: {},
          states: {},
          tierStates: {},
          currentStreak: 0,
          longestStreak: 0,
          lastPlayedISO: null,
          achievements: [],
        }),
    }),
    {
      name: "braintap-progress-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        settings: s.settings,
        onboarded: s.onboarded,
        results: s.results,
        tierResults: s.tierResults,
        states: s.states,
        tierStates: s.tierStates,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        lastPlayedISO: s.lastPlayedISO,
        favorites: s.favorites,
        achievements: s.achievements,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

/** Keep the stronger result: higher score, ties broken by the faster time. */
function pickBetter(
  prev: StoredResult | undefined,
  next: StoredResult,
): StoredResult {
  if (!prev) return next;
  if (next.score > prev.score) return next;
  if (next.score === prev.score) {
    const pt = prev.timeMs ?? Number.POSITIVE_INFINITY;
    const nt = next.timeMs ?? Number.POSITIVE_INFINITY;
    return nt < pt ? next : prev;
  }
  return prev;
}

/** Recompute the live streak (resets to 0 if a day was missed). */
export function liveStreak(
  currentStreak: number,
  lastPlayedISO: string | null,
  today = todayISO(),
): number {
  if (!lastPlayedISO) return 0;
  if (lastPlayedISO === today) return currentStreak;
  if (addDays(lastPlayedISO, 1) === today) return currentStreak; // still alive, not yet played today
  return 0; // missed at least one day
}

/** Convenience selectors. */
export function selectTodayResults(s: ProgressState, date = todayISO()) {
  return s.results[date] ?? {};
}
