import type { GameId } from "./types";
import { GAME_METAS, GAME_ORDER, ROTATION } from "@/games/_meta";

/**
 * Game METADATA only — safe to import anywhere (hub, layout, archive,
 * leaderboard, …) without pulling in a single game implementation. The actual
 * game modules load on demand via `@/lib/loadGame` (imported only by the play
 * route), so the heavy engines/components/word-banks never ship to non-game
 * pages. See loadGame.ts for why that lives in its own module.
 */

/** Live count of playable games — the single source of truth for copy/stats. */
export const GAME_COUNT = GAME_ORDER.length;

const NUMBER_WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen", "Twenty", "Twenty-one", "Twenty-two",
  "Twenty-three", "Twenty-four", "Twenty-five",
] as const;

/** Spelled-out capitalised game count for prose (e.g. "Twenty"); numeral fallback. */
export const GAME_COUNT_WORD = NUMBER_WORDS[GAME_COUNT] ?? String(GAME_COUNT);

export function isGameId(id: string): id is GameId {
  return id in GAME_METAS;
}

export { GAME_METAS, GAME_ORDER, ROTATION };
