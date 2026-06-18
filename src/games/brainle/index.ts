import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Brainle } from "./Brainle";
import { getDailyPuzzle } from "./generator";
import { validateBrainle, type BrainlePuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<BrainlePuzzle, any>({
  meta: GAME_METAS.brainle,
  getDailyPuzzle,
  Component: Brainle,
  validatePuzzle: validateBrainle,
  supportsDifficulty: true,
});
