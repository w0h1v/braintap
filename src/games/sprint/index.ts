import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Sprint } from "./Sprint";
import { getDailyPuzzle } from "./generator";
import { validateSprint, type SprintPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<SprintPuzzle, any>({
  meta: GAME_METAS.sprint,
  getDailyPuzzle,
  Component: Sprint,
  validatePuzzle: validateSprint,
  supportsDifficulty: true,
  // Sprint is a fixed-duration game with its own countdown; a host count-up
  // timer would mislead, so suppress it.
  hostTimer: false,
});
