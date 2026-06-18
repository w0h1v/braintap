import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Forge } from "./Forge";
import { getDailyPuzzle } from "./generator";
import { validateForge, type ForgePuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<ForgePuzzle, any>({
  meta: GAME_METAS.forge,
  getDailyPuzzle,
  Component: Forge,
  validatePuzzle: validateForge,
});
