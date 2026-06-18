"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { GameId, GameResult } from "./types";
import { todayISO, addDays } from "./daily";

export interface Settings {
  zen: boolean;
  sound: boolean;
}

export interface StoredResult extends GameResult {
  gameId: GameId;
  dateISO: string;
  playedAt: number;
}

interface ProgressState {
  hydrated: boolean;
  settings: Settings;
  onboarded: boolean;
  /** results[dateISO][gameId] */
  results: Record<string, Partial<Record<GameId, StoredResult>>>;
  /** in-progress resumable state: states[dateISO][gameId] */
  states: Record<string, Partial<Record<GameId, unknown>>>;
  currentStreak: number;
  longestStreak: number;
  lastPlayedISO: string | null;

  // actions
  setHydrated: () => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setOnboarded: (v: boolean) => void;
  recordResult: (
    gameId: GameId,
    dateISO: string,
    result: GameResult,
    affectsStreak: boolean,
  ) => void;
  saveGameState: (gameId: GameId, dateISO: string, state: unknown) => void;
  getResult: (gameId: GameId, dateISO: string) => StoredResult | undefined;
  getGameState: (gameId: GameId, dateISO: string) => unknown;
  resetDay: (dateISO: string) => void;
  resetAll: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      settings: { zen: false, sound: true },
      onboarded: false,
      results: {},
      states: {},
      currentStreak: 0,
      longestStreak: 0,
      lastPlayedISO: null,

      setHydrated: () => set({ hydrated: true }),

      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),

      setOnboarded: (v) => set({ onboarded: v }),

      recordResult: (gameId, dateISO, result, affectsStreak) =>
        set((s) => {
          const day = { ...(s.results[dateISO] ?? {}) };
          const prev = day[gameId];
          // Keep the better result if replayed.
          const keep =
            prev && prev.score >= result.score
              ? prev
              : { ...result, gameId, dateISO, playedAt: Date.now() };
          day[gameId] = keep;

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

          return {
            results: { ...s.results, [dateISO]: day },
            currentStreak,
            longestStreak,
            lastPlayedISO,
          };
        }),

      saveGameState: (gameId, dateISO, state) =>
        set((s) => {
          const day = { ...(s.states[dateISO] ?? {}) };
          day[gameId] = state;
          return { states: { ...s.states, [dateISO]: day } };
        }),

      getResult: (gameId, dateISO) => get().results[dateISO]?.[gameId],

      getGameState: (gameId, dateISO) => get().states[dateISO]?.[gameId],

      resetDay: (dateISO) =>
        set((s) => {
          const results = { ...s.results };
          const states = { ...s.states };
          delete results[dateISO];
          delete states[dateISO];
          return { results, states };
        }),

      resetAll: () =>
        set({
          results: {},
          states: {},
          currentStreak: 0,
          longestStreak: 0,
          lastPlayedISO: null,
        }),
    }),
    {
      name: "braintap-progress-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        settings: s.settings,
        onboarded: s.onboarded,
        results: s.results,
        states: s.states,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        lastPlayedISO: s.lastPlayedISO,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

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
