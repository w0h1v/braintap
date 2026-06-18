import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Weaver } from "./Weaver";
import { getDailyPuzzle } from "./generator";
import { validateWeaver, type WeaverPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<WeaverPuzzle, any>({
  meta: GAME_METAS.weaver,
  getDailyPuzzle,
  Component: Weaver,
  validatePuzzle: validateWeaver,
  supportsDifficulty: true,
});
