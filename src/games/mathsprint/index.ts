import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { MathSprint } from "./MathSprint";
import { getDailyPuzzle } from "./generator";
import { validateMathSprint, type MathSprintPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<MathSprintPuzzle, any>({
  meta: GAME_METAS.mathsprint,
  getDailyPuzzle,
  Component: MathSprint,
  validatePuzzle: validateMathSprint,
  supportsDifficulty: true,
  // Fixed-duration countdown game: the game owns its own visible countdown, so a
  // count-up host timer would mislead.
  hostTimer: false,
});
