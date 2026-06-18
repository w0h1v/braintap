import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Sudoku } from "./Sudoku";
import { getDailyPuzzle } from "./generator";
import { validateSudoku, type SudokuPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<SudokuPuzzle, any>({
  meta: GAME_METAS.sudoku,
  getDailyPuzzle,
  Component: Sudoku,
  validatePuzzle: validateSudoku,
});
