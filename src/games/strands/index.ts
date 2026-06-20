import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Strands } from "./Strands";
import { getDailyPuzzle } from "./generator";
import { validatePuzzle, MAX_HINTS_BY_DIFFICULTY, type StrandsPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<StrandsPuzzle, any>({
  meta: GAME_METAS.strands,
  getDailyPuzzle,
  Component: Strands,
  validatePuzzle,
  supportsDifficulty: true,
  hintsByDifficulty: {
    easy: MAX_HINTS_BY_DIFFICULTY.easy,
    medium: MAX_HINTS_BY_DIFFICULTY.medium,
    hard: MAX_HINTS_BY_DIFFICULTY.hard,
  },
});
