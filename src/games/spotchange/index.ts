import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { SpotChange } from "./SpotChange";
import { getDailyPuzzle } from "./generator";
import { validateSpotChange, type SpotChangePuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<SpotChangePuzzle, any>({
  meta: GAME_METAS.spotchange,
  getDailyPuzzle,
  Component: SpotChange,
  validatePuzzle: validateSpotChange,
  supportsDifficulty: true,
  // Fixed-trial accuracy game: a host count-up clock would mislead, so we show
  // our own round/score chips and keep our own input-phase timing internally.
  hostTimer: false,
});
