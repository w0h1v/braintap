/**
 * Curated board shapes for Pips, one pool per difficulty tier. Every shape is a
 * hand-verified, domino-tileable polyomino (an even number of cells with a
 * perfect matching) that fits within 5 columns so it renders comfortably at
 * 360px. The generator picks a shape, finds a tiling, then paints regions on it.
 *
 * Shapes are authored as [row, col] pairs (row increases downward). A test
 * asserts every shape here is tileable, so a bad edit is caught in CI.
 */

import type { Cell, PipsDifficulty } from "./engine";

type Shape = [number, number][];

function cells(shape: Shape): Cell[] {
  return shape.map(([r, c]) => ({ r, c }));
}

// Easy — 6 cells / 3 dominoes.
const EASY: Shape[] = [
  // 2×3 block
  [
    [0, 0], [0, 1], [0, 2],
    [1, 0], [1, 1], [1, 2],
  ],
  // S / staircase
  [
    [0, 1], [0, 2],
    [1, 0], [1, 1], [1, 2],
    [2, 0],
  ],
  // diagonal staircase
  [
    [0, 0], [0, 1],
    [1, 1], [1, 2],
    [2, 2], [2, 3],
  ],
];

// Medium — 10 cells / 5 dominoes.
const MEDIUM: Shape[] = [
  // 2×5 block
  [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
  ],
  // top-notch blob
  [
    [0, 0], [0, 1],
    [1, 0], [1, 1], [1, 2], [1, 3],
    [2, 0], [2, 1], [2, 2], [2, 3],
  ],
  // plus / cross
  [
    [0, 1], [0, 2],
    [1, 0], [1, 1], [1, 2], [1, 3],
    [2, 1], [2, 2],
    [3, 1], [3, 2],
  ],
];

// Hard — 12 cells / 6 dominoes.
const HARD: Shape[] = [
  // 3×4 block
  [
    [0, 0], [0, 1], [0, 2], [0, 3],
    [1, 0], [1, 1], [1, 2], [1, 3],
    [2, 0], [2, 1], [2, 2], [2, 3],
  ],
  // octagon-ish blob
  [
    [0, 1], [0, 2],
    [1, 0], [1, 1], [1, 2], [1, 3],
    [2, 0], [2, 1], [2, 2], [2, 3],
    [3, 1], [3, 2],
  ],
  // 2×4 block with a 2×2 tail
  [
    [0, 0], [0, 1], [0, 2], [0, 3],
    [1, 0], [1, 1], [1, 2], [1, 3],
    [2, 1], [2, 2],
    [3, 1], [3, 2],
  ],
];

export const BOARDS: Record<PipsDifficulty, Cell[][]> = {
  easy: EASY.map(cells),
  medium: MEDIUM.map(cells),
  hard: HARD.map(cells),
};
