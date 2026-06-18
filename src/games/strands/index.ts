import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Strands } from "./Strands";
import { getDailyPuzzle } from "./generator";
import { validatePuzzle, type StrandsPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<StrandsPuzzle, any>({
  meta: GAME_METAS.strands,
  getDailyPuzzle,
  Component: Strands,
  validatePuzzle,
  supportsDifficulty: true,
});
