import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Schulte } from "./Schulte";
import { getDailyPuzzle } from "./generator";
import { validateSchulte, type SchultePuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<SchultePuzzle, any>({
  meta: GAME_METAS.schulte,
  getDailyPuzzle,
  Component: Schulte,
  validatePuzzle: validateSchulte,
  supportsDifficulty: true,
  // Schulte owns its own clock; the host count-up chip started on a different
  // signal and disagreed with the recorded time. Suppress it so Schulte shows
  // its own live clock (the single source of truth).
  hostTimer: false,
});
