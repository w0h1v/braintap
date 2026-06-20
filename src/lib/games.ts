import type { GameId } from "./types";
import type { AnyGameModule } from "./types";
import { GAME_METAS, GAME_ORDER, ROTATION } from "@/games/_meta";

import connections from "@/games/connections";
import brainle from "@/games/brainle";
import strands from "@/games/strands";
import forge from "@/games/forge";
import weaver from "@/games/weaver";
import vault from "@/games/vault";
import teasers from "@/games/teasers";
import sudoku from "@/games/sudoku";
import sprint from "@/games/sprint";
import pips from "@/games/pips";
import g2048 from "@/games/g2048";
import schulte from "@/games/schulte";
import simon from "@/games/simon";
import slide from "@/games/slide";
import reversi from "@/games/reversi";
import crossword from "@/games/crossword";
import matrix from "@/games/matrix";
import stroop from "@/games/stroop";
import mathsprint from "@/games/mathsprint";
import spotchange from "@/games/spotchange";

export const GAME_MODULES: Record<GameId, AnyGameModule> = {
  connections,
  brainle,
  strands,
  forge,
  weaver,
  vault,
  teasers,
  sudoku,
  sprint,
  pips,
  g2048,
  schulte,
  simon,
  slide,
  reversi,
  crossword,
  matrix,
  stroop,
  mathsprint,
  spotchange,
};

/** All game modules in hub display order. */
export const ALL_GAMES: AnyGameModule[] = GAME_ORDER.map((id) => GAME_MODULES[id]);

export function getGame(id: string): AnyGameModule | undefined {
  return (GAME_MODULES as Record<string, AnyGameModule>)[id];
}

export function isGameId(id: string): id is GameId {
  return id in GAME_MODULES;
}

export { GAME_METAS, GAME_ORDER, ROTATION };
