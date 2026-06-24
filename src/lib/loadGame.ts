import type { GameId, AnyGameModule } from "./types";

/**
 * Per-game module loaders, deliberately in their OWN module imported only by the
 * play route's GameHost — NOT in `@/lib/games`.
 *
 * Why the separation matters: webpack associates a chunk's dynamic `import()`
 * children with whatever loads that chunk. If these 20 `import()`s lived in the
 * metadata module that the hub/layout/archive import, webpack pulls (and Next
 * prefetches) every game chunk — incl. Brainle's ~13k-word dictionary — onto
 * pages that never play a game. Isolating them here keeps non-game pages clean;
 * a game's chunk loads only when its /play route mounts and calls loadGame().
 *
 * The string literals must stay literal for webpack to create the split points.
 */
const LOADERS: Record<GameId, () => Promise<{ default: AnyGameModule }>> = {
  connections: () => import("@/games/connections"),
  brainle: () => import("@/games/brainle"),
  strands: () => import("@/games/strands"),
  forge: () => import("@/games/forge"),
  weaver: () => import("@/games/weaver"),
  vault: () => import("@/games/vault"),
  teasers: () => import("@/games/teasers"),
  sudoku: () => import("@/games/sudoku"),
  sprint: () => import("@/games/sprint"),
  pips: () => import("@/games/pips"),
  g2048: () => import("@/games/g2048"),
  schulte: () => import("@/games/schulte"),
  simon: () => import("@/games/simon"),
  slide: () => import("@/games/slide"),
  reversi: () => import("@/games/reversi"),
  crossword: () => import("@/games/crossword"),
  matrix: () => import("@/games/matrix"),
  stroop: () => import("@/games/stroop"),
  mathsprint: () => import("@/games/mathsprint"),
  spotchange: () => import("@/games/spotchange"),
};

/** Load a game's implementation on demand (resolves to its `GameModule`). */
export function loadGame(id: GameId): Promise<AnyGameModule> {
  return LOADERS[id]().then((m) => m.default);
}
