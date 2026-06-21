/**
 * Mini Crossword engine — pure, deterministic logic for a small square crossword
 * grid (4×4 or 5×5) with optional blocked squares. The bank stores hand-built,
 * validated grids + clues; `buildPuzzle` compiles a raw bank entry into a fully
 * derived `CrosswordPuzzle` (numbering, across/down runs, per-cell run indices).
 *
 * "Solvable" for a fill puzzle is a *consistency* property, not a CSP one: the
 * guarantee is that the curated solution is the intended answer and every clue
 * answer provably spells its run in the grid (see `validatePuzzle`).
 *
 * No React, no DOM, no globals: fully unit-testable.
 */

import type { Difficulty } from "@/lib/types";

/** A cell index into the row-major grid (0 .. size*size-1). */
export type Cell = number;

export type Dir = "across" | "down";

/** A raw clue in a bank entry: the answer must equal the letters of its run. */
export interface ClueDef {
  /** Standard crossword number of the entry's start cell. */
  num: number;
  /** Human clue text, e.g. "Organ that thinks". */
  clue: string;
  /** UPPERCASE A–Z; must equal the cells of that entry. */
  answer: string;
}

/** A curated bank entry, authored by hand and validated before compilation. */
export interface CrosswordEntry {
  difficulty: Difficulty;
  /** Grid dimension (square: size*size cells), e.g. 4 or 5. */
  size: number;
  /**
   * Layout as strings, one per row. '.' = black/blocked square, A–Z = the
   * solution letter. length === size; each row length === size.
   */
  rows: string[];
  /** Clues for across entries, in grid-number order. */
  across: ClueDef[];
  /** Clues for down entries, in grid-number order. */
  down: ClueDef[];
  /** Optional flavour label, e.g. "MIND MATTERS". */
  theme?: string;
  /** Brain-science line for the completion modal. */
  insight: string;
}

/** A single across/down run with its clue + answer, derived from an entry. */
export interface CrosswordEntryRun {
  num: number;
  dir: Dir;
  /** Ordered cell indices of this run. */
  cells: Cell[];
  clue: string;
  /** answer.length === cells.length. */
  answer: string;
}

/** A fully-derived, playable crossword puzzle. */
export interface CrosswordPuzzle {
  size: number;
  /** length size*size; true = black square. */
  block: boolean[];
  /** length size*size; "" for blocks, else "A".."Z". */
  solution: string[];
  /** length size*size; 0 = no number, else its label. */
  numbers: number[];
  /** Every across+down run with clue+answer. */
  entries: CrosswordEntryRun[];
  /** cell -> index into `entries` of its across run (-1 when none). */
  acrossOf: number[];
  /** cell -> index into `entries` of its down run (-1 when none). */
  downOf: number[];
  difficulty: Difficulty;
  theme?: string;
  insight: string;
}

const A_Z = /^[A-Z]$/;

export const rowOf = (cell: Cell, size: number): number => Math.floor(cell / size);
export const colOf = (cell: Cell, size: number): number => cell % size;
export const cellAt = (r: number, c: number, size: number): Cell => r * size + c;

/** Parse a bank entry's `rows` into block[] + solution[] (row-major). */
export function parseGrid(entry: CrosswordEntry): { block: boolean[]; solution: string[] } {
  const { size, rows } = entry;
  const block: boolean[] = new Array(size * size).fill(false);
  const solution: string[] = new Array(size * size).fill("");
  for (let r = 0; r < size; r++) {
    const row = rows[r] ?? "";
    for (let c = 0; c < size; c++) {
      const ch = row[c];
      const i = cellAt(r, c, size);
      if (ch === "." || ch === undefined) {
        block[i] = true;
        solution[i] = "";
      } else {
        block[i] = false;
        solution[i] = ch.toUpperCase();
      }
    }
  }
  return { block, solution };
}

/** Is the cell white (not blocked)? */
function white(block: boolean[], i: number): boolean {
  return i >= 0 && i < block.length && !block[i];
}

/**
 * Compute standard crossword numbering for a grid. A white cell is numbered if
 * it starts an across run (white, with a block/edge to its left AND a white cell
 * to its right) OR a down run (white, with a block/edge above AND a white cell
 * below). Numbers increment in row-major order.
 */
export function computeNumbers(size: number, block: boolean[]): number[] {
  const numbers: number[] = new Array(size * size).fill(0);
  let n = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = cellAt(r, c, size);
      if (!white(block, i)) continue;
      const leftBlocked = c === 0 || !white(block, cellAt(r, c - 1, size));
      const rightWhite = c + 1 < size && white(block, cellAt(r, c + 1, size));
      const topBlocked = r === 0 || !white(block, cellAt(r - 1, c, size));
      const bottomWhite = r + 1 < size && white(block, cellAt(r + 1, c, size));
      const startsAcross = leftBlocked && rightWhite;
      const startsDown = topBlocked && bottomWhite;
      if (startsAcross || startsDown) {
        n += 1;
        numbers[i] = n;
      }
    }
  }
  return numbers;
}

/**
 * Build the across + down runs (length >= 2) from a grid. Each run carries its
 * start number; clue/answer are attached later from the bank entry.
 */
export function computeRuns(
  size: number,
  block: boolean[],
  numbers: number[],
): { across: { num: number; cells: Cell[] }[]; down: { num: number; cells: Cell[] }[] } {
  const across: { num: number; cells: Cell[] }[] = [];
  const down: { num: number; cells: Cell[] }[] = [];

  // Across: scan each row left→right.
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      const i = cellAt(r, c, size);
      if (!white(block, i)) {
        c += 1;
        continue;
      }
      const cells: Cell[] = [];
      const startNum = numbers[i];
      while (c < size && white(block, cellAt(r, c, size))) {
        cells.push(cellAt(r, c, size));
        c += 1;
      }
      if (cells.length >= 2) across.push({ num: startNum, cells });
    }
  }

  // Down: scan each column top→bottom.
  for (let c = 0; c < size; c++) {
    let r = 0;
    while (r < size) {
      const i = cellAt(r, c, size);
      if (!white(block, i)) {
        r += 1;
        continue;
      }
      const cells: Cell[] = [];
      const startNum = numbers[i];
      while (r < size && white(block, cellAt(r, c, size))) {
        cells.push(cellAt(r, c, size));
        r += 1;
      }
      if (cells.length >= 2) down.push({ num: startNum, cells });
    }
  }

  return { across, down };
}

/**
 * Validate a raw bank entry's shape BEFORE compilation so authoring errors fail
 * loudly: row count/length, blocks/letters only, every run has a matching clue
 * whose answer spells the run, and no extra/missing clues.
 */
export function validateEntry(entry: CrosswordEntry): boolean {
  const { size, rows } = entry;
  if (!Number.isInteger(size) || size < 3 || size > 7) return false;
  if (!Array.isArray(rows) || rows.length !== size) return false;
  for (const row of rows) {
    if (typeof row !== "string" || row.length !== size) return false;
    for (const ch of row) {
      if (ch !== "." && !A_Z.test(ch)) return false;
    }
  }

  const { block, solution } = parseGrid(entry);
  const numbers = computeNumbers(size, block);
  const { across, down } = computeRuns(size, block, numbers);

  if (across.length === 0 || down.length === 0) return false;

  // Every white cell must belong to a run of length >= 2 (no orphan whites).
  for (let i = 0; i < size * size; i++) {
    if (block[i]) continue;
    const inAcross = across.some((run) => run.cells.includes(i));
    const inDown = down.some((run) => run.cells.includes(i));
    if (!inAcross && !inDown) return false;
  }

  // Clue lists must match the runs exactly (by number) and answers must spell
  // the grid letters.
  const checkSide = (
    runs: { num: number; cells: Cell[] }[],
    clues: ClueDef[],
  ): boolean => {
    if (!Array.isArray(clues) || clues.length !== runs.length) return false;
    for (const run of runs) {
      const clue = clues.find((cl) => cl.num === run.num);
      if (!clue) return false;
      const answer = (clue.answer ?? "").toUpperCase();
      if (answer.length !== run.cells.length) return false;
      if (!/^[A-Z]+$/.test(answer)) return false;
      if (typeof clue.clue !== "string" || clue.clue.trim().length === 0) return false;
      for (let k = 0; k < run.cells.length; k++) {
        if (answer[k] !== solution[run.cells[k]]) return false;
      }
    }
    // No duplicate clue numbers within a side.
    const nums = clues.map((cl) => cl.num);
    if (new Set(nums).size !== nums.length) return false;
    return true;
  };

  if (!checkSide(across, entry.across)) return false;
  if (!checkSide(down, entry.down)) return false;

  return true;
}

/**
 * Deterministic compiler: CrosswordEntry → CrosswordPuzzle. Numbering and run
 * assembly are fully determined by `rows`, so the same entry always yields the
 * same puzzle. Throws on a malformed entry (caught by tests via validateEntry).
 */
export function buildPuzzle(entry: CrosswordEntry, difficulty?: Difficulty): CrosswordPuzzle {
  const { size } = entry;
  const { block, solution } = parseGrid(entry);
  const numbers = computeNumbers(size, block);
  const { across, down } = computeRuns(size, block, numbers);

  const entries: CrosswordEntryRun[] = [];
  const acrossOf: number[] = new Array(size * size).fill(-1);
  const downOf: number[] = new Array(size * size).fill(-1);

  const attach = (
    runs: { num: number; cells: Cell[] }[],
    clues: ClueDef[],
    dir: Dir,
    ofMap: number[],
  ) => {
    for (const run of runs) {
      const clue = clues.find((cl) => cl.num === run.num);
      const answer = (clue?.answer ?? "").toUpperCase();
      const ix = entries.length;
      entries.push({
        num: run.num,
        dir,
        cells: run.cells.slice(),
        clue: clue?.clue ?? "",
        answer,
      });
      for (const cell of run.cells) ofMap[cell] = ix;
    }
  };

  attach(across, entry.across, "across", acrossOf);
  attach(down, entry.down, "down", downOf);

  return {
    size,
    block,
    solution,
    numbers,
    entries,
    acrossOf,
    downOf,
    difficulty: difficulty ?? entry.difficulty,
    theme: entry.theme,
    insight: entry.insight,
  };
}

/**
 * Validate a compiled puzzle is well-formed and solvable (consistency):
 * (1) solution length === size*size; non-block = single A–Z, block = "";
 * (2) every white cell belongs to a run of length >= 2 (no orphan whites);
 * (3) each entry answer is UPPERCASE A–Z, answer.length === cells.length, and
 *     answer[i] === solution[cells[i]] (clue answers spell the grid);
 * (4) numbering matches the standard rule (recomputed independently);
 * (5) at least one across and one down entry;
 * (6) the grid is one connected white component (a proper crossword).
 */
export function validatePuzzle(p: CrosswordPuzzle): boolean {
  const { size } = p;
  if (!Number.isInteger(size) || size < 3) return false;
  const n = size * size;
  if (p.solution.length !== n || p.block.length !== n || p.numbers.length !== n) return false;

  // (1) cell contents
  for (let i = 0; i < n; i++) {
    if (p.block[i]) {
      if (p.solution[i] !== "") return false;
    } else {
      if (!A_Z.test(p.solution[i])) return false;
    }
  }

  // (4) numbering recomputed
  const expected = computeNumbers(size, p.block);
  for (let i = 0; i < n; i++) if (expected[i] !== p.numbers[i]) return false;

  // (5) at least one across and one down
  const acrossEntries = p.entries.filter((e) => e.dir === "across");
  const downEntries = p.entries.filter((e) => e.dir === "down");
  if (acrossEntries.length === 0 || downEntries.length === 0) return false;

  // (3) answers consistent with grid
  for (const e of p.entries) {
    if (!/^[A-Z]+$/.test(e.answer)) return false;
    if (e.answer.length !== e.cells.length) return false;
    if (e.cells.length < 2) return false;
    for (let k = 0; k < e.cells.length; k++) {
      if (e.answer[k] !== p.solution[e.cells[k]]) return false;
    }
  }

  // (2) every white cell belongs to a run via acrossOf/downOf
  for (let i = 0; i < n; i++) {
    if (p.block[i]) continue;
    if (p.acrossOf[i] < 0 && p.downOf[i] < 0) return false;
  }

  // (6) one connected white component
  const whites: number[] = [];
  for (let i = 0; i < n; i++) if (!p.block[i]) whites.push(i);
  if (whites.length === 0) return false;
  const seen = new Set<number>();
  const stack = [whites[0]];
  seen.add(whites[0]);
  while (stack.length) {
    const cur = stack.pop()!;
    const r = rowOf(cur, size);
    const c = colOf(cur, size);
    const neighbours = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ];
    for (const [nr, nc] of neighbours) {
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const ni = cellAt(nr, nc, size);
      if (p.block[ni] || seen.has(ni)) continue;
      seen.add(ni);
      stack.push(ni);
    }
  }
  if (seen.size !== whites.length) return false;

  return true;
}

/** True when every white cell's letter matches the solution. */
export function isSolved(letters: string[], solution: string[], block: boolean[]): boolean {
  for (let i = 0; i < solution.length; i++) {
    if (block[i]) continue;
    if (letters[i] !== solution[i]) return false;
  }
  return true;
}

/** Count of correctly-filled white cells (for progress). */
export function correctCount(letters: string[], solution: string[], block: boolean[]): number {
  let n = 0;
  for (let i = 0; i < solution.length; i++) {
    if (!block[i] && letters[i] === solution[i] && letters[i] !== "") n += 1;
  }
  return n;
}

/** Number of white cells in the grid. */
export function whiteCount(block: boolean[]): number {
  let n = 0;
  for (const b of block) if (!b) n += 1;
  return n;
}

/**
 * Pick a cell to reveal as a hint: prefer the currently-selected cell when it is
 * white and not yet correct; otherwise the first white cell whose letter is
 * empty or wrong (row-major). Returns null when the grid is already correct.
 */
export function getHintCell(
  letters: string[],
  solution: string[],
  block: boolean[],
  preferred?: number | null,
): number | null {
  const needsFill = (i: number) => !block[i] && letters[i] !== solution[i];
  if (preferred != null && needsFill(preferred)) return preferred;
  for (let i = 0; i < solution.length; i++) {
    if (needsFill(i)) return i;
  }
  return null;
}
