import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Reversi } from "./Reversi";
import { getDailyPuzzle } from "./generator";
import { validateReversi, type ReversiPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<ReversiPuzzle, any>({
  meta: GAME_METAS.reversi,
  getDailyPuzzle,
  Component: Reversi,
  validatePuzzle: validateReversi,
  supportsDifficulty: true,
});
