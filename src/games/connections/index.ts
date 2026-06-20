import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Connections, MAX_HINTS } from "./Connections";
import { getDailyPuzzle } from "./generator";
import { validateConnections, type ConnectionsPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<ConnectionsPuzzle, any>({
  meta: GAME_METAS.connections,
  getDailyPuzzle,
  Component: Connections,
  validatePuzzle: validateConnections,
  supportsDifficulty: true,
  hintsByDifficulty: MAX_HINTS,
});
