/**
 * The 15 canonical game ids — kept in sync with src/games/_meta.ts (GAME_ORDER).
 * Duplicated here (rather than imported) so the e2e suite has no dependency on
 * the app's TS path aliases / build config.
 */
export const GAME_IDS = [
  "connections",
  "brainle",
  "strands",
  "forge",
  "weaver",
  "vault",
  "teasers",
  "sudoku",
  "sprint",
  "pips",
  "g2048",
  "schulte",
  "simon",
  "slide",
  "reversi",
] as const;

export type GameId = (typeof GAME_IDS)[number];
