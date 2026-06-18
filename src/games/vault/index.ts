import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Vault } from "./Vault";
import { getDailyPuzzle } from "./generator";
import { validateVault, type VaultPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<VaultPuzzle, any>({
  meta: GAME_METAS.vault,
  getDailyPuzzle,
  Component: Vault,
  validatePuzzle: validateVault,
  supportsDifficulty: true,
});
