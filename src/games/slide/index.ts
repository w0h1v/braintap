import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Slide } from "./Slide";
import { getDailyPuzzle } from "./generator";
import { validateSlide, type SlidePuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<SlidePuzzle, any>({
  meta: GAME_METAS.slide,
  getDailyPuzzle,
  Component: Slide,
  validatePuzzle: validateSlide,
  supportsDifficulty: true,
});
