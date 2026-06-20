import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { PatternMatrix, MAX_HINTS } from "./PatternMatrix";
import { getDailyPuzzle } from "./generator";
import { validateMatrix, type MatrixPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<MatrixPuzzle, any>({
  meta: GAME_METAS.matrix,
  getDailyPuzzle,
  Component: PatternMatrix,
  validatePuzzle: validateMatrix,
  supportsDifficulty: true,
  hintsByDifficulty: MAX_HINTS,
});
