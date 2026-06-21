import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { StroopRush } from "./StroopRush";
import { getDailyPuzzle } from "./generator";
import { validateStroop, type StroopPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<StroopPuzzle, any>({
  meta: GAME_METAS.stroop,
  getDailyPuzzle,
  Component: StroopRush,
  validatePuzzle: validateStroop,
  supportsDifficulty: true,
  // Stroop Rush is a fixed-duration countdown game with its own clock; a host
  // count-up timer would mislead, so suppress it.
  hostTimer: false,
});
