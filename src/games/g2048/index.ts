import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { G2048 } from "./G2048";
import { getDailyPuzzle } from "./generator";
import { validateG2048, type G2048Puzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<G2048Puzzle, any>({
  meta: GAME_METAS.g2048,
  getDailyPuzzle,
  Component: G2048,
  validatePuzzle: validateG2048,
});
