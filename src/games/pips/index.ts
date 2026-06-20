import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Pips, MAX_HINTS } from "./Pips";
import { getDailyPuzzle } from "./generator";
import { validatePips, type PipsPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<PipsPuzzle, any>({
  meta: GAME_METAS.pips,
  getDailyPuzzle,
  Component: Pips,
  validatePuzzle: validatePips,
  supportsDifficulty: true,
  hintsByDifficulty: MAX_HINTS,
});
