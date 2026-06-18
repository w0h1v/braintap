import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Teasers } from "./Teasers";
import { getDailyPuzzle } from "./generator";
import { validateTeasers, type TeasersPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<TeasersPuzzle, any>({
  meta: GAME_METAS.teasers,
  getDailyPuzzle,
  Component: Teasers,
  validatePuzzle: validateTeasers,
});
