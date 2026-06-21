import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Crossword } from "./Crossword";
import { getDailyPuzzle } from "./generator";
import { validatePuzzle, type CrosswordPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<CrosswordPuzzle, any>({
  meta: GAME_METAS.crossword,
  getDailyPuzzle,
  Component: Crossword,
  validatePuzzle,
  supportsDifficulty: true,
  hintsByDifficulty: { easy: 3, medium: 1, hard: 0 },
});
