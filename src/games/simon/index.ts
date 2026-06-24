import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Simon } from "./Simon";
import { getDailyPuzzle } from "./generator";
import { validateSimon, type SimonPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<SimonPuzzle, any>({
  meta: GAME_METAS.simon,
  getDailyPuzzle,
  Component: Simon,
  validatePuzzle: validateSimon,
  supportsDifficulty: true,
  // Memory game with no time pressure — a host count-up timer chip misleads.
  // (Simon renders no timer of its own; the run is still timed internally.)
  hostTimer: false,
});
