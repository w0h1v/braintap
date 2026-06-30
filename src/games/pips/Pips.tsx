"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { HintButton } from "@/components/play/HintButton";
import { useGameClock } from "@/lib/useGameClock";
import { formatClock } from "@/lib/share";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import { useEntitlement } from "@/lib/entitlement";
import { adsAvailable, showRewardedAd } from "@/lib/ads";
import { getMonetizationConfig } from "@/lib/config";
import { useFitBox } from "@/lib/useFitBox";
import {
  faces,
  buildAdjacency,
  regionStatus,
  isSolved,
  getHint,
  constraintLabel,
  constraintDescription,
  type Constraint,
  type ConstraintKind,
  type Placed,
  type PipsPuzzle,
} from "./engine";

export const MAX_HINTS = 3;

const ACCENT = GAME_METAS.pips.accent;
const INSIGHT = GAME_METAS.pips.insight;

const PIP_INK = "#1a1030"; // dark pip / domino ink
const MET = "#34d399"; // a region's constraint is satisfied

/** Pip dot positions on a 3×3 grid (indices 0..8) per face value. */
const PIP_MAP: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};

/** Distinct, vivid region fills (greedy-assigned so adjacent regions never
 *  share a hue). Higher opacity + bright edges keep each region a clearly
 *  separate colour block on the dark board, not a muddy tint. */
const REGION_TINTS = [
  { fill: "rgba(45,212,191,0.30)", edge: "rgba(94,234,212,0.85)" }, // teal
  { fill: "rgba(245,158,11,0.30)", edge: "rgba(251,191,36,0.85)" }, // amber
  { fill: "rgba(167,139,250,0.34)", edge: "rgba(196,181,253,0.9)" }, // violet
  { fill: "rgba(56,189,248,0.30)", edge: "rgba(125,211,252,0.85)" }, // sky
  { fill: "rgba(251,113,133,0.30)", edge: "rgba(253,164,175,0.85)" }, // rose
  { fill: "rgba(163,230,53,0.28)", edge: "rgba(190,242,100,0.85)" }, // lime
];

/** Badge accent per constraint kind (the little diamond on each region). */
const BADGE_COLOR: Record<Exclude<ConstraintKind, "empty">, string> = {
  eq: "#0ea5a4", // teal
  lt: "#f97316", // orange
  gt: "#a855f7", // violet
  equal: "#ec4899", // magenta
  ne: "#3b82f6", // blue
};

type Orient = "h" | "v";
type Dir = "right" | "left" | "down" | "up";

/** One half of a domino: a 3×3 pip grid drawn to fill its cell. */
function PipFace({ value }: { value: number }) {
  const dots = PIP_MAP[value] ?? [];
  return (
    <div
      className="grid h-full w-full"
      style={{
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        padding: "11%",
      }}
      aria-hidden="true"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="grid place-items-center">
          {dots.includes(i) && (
            <span
              style={{
                width: "74%",
                height: "74%",
                borderRadius: "50%",
                background: PIP_INK,
                boxShadow: "inset 0 -1px 1px rgba(255,255,255,0.18)",
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
}

interface BoardSnapshot {
  placed: Placed[];
  locked: number[];
  hintsUsed: number;
  moves: number;
}

interface PipsState {
  placed: Placed[];
  locked: number[];
  hintsUsed: number;
  elapsedMs: number;
  won: boolean;
  moves: number;
  past?: BoardSnapshot[];
  future?: BoardSnapshot[];
}

const MAX_HISTORY = 60;

/** Solve-time thresholds (seconds) for the 3 / 2 / 1 star awards. Shared so the
 *  live "soft goal" hint and the final scoring agree. */
const STAR_SECONDS = { three: 60, two: 150 } as const;

/** Stars earned for a given solve time (seconds). */
function starsFor(sec: number): number {
  return sec < STAR_SECONDS.three ? 3 : sec < STAR_SECONDS.two ? 2 : 1;
}

function emptyState(dominoCount: number): PipsState {
  return {
    placed: new Array(dominoCount).fill(null),
    locked: [],
    hintsUsed: 0,
    elapsedMs: 0,
    won: false,
    moves: 0,
    past: [],
    future: [],
  };
}

function snapshot(s: PipsState): BoardSnapshot {
  return {
    placed: s.placed.map((p) => (p ? { ...p } : null)),
    locked: s.locked.slice(),
    hintsUsed: s.hintsUsed,
    moves: s.moves,
  };
}

/** Direction from cell `a` to its adjacent partner `b`. */
function dirOf(a: { r: number; c: number }, b: { r: number; c: number }): Dir {
  if (b.c === a.c + 1) return "right";
  if (b.c === a.c - 1) return "left";
  if (b.r === a.r + 1) return "down";
  return "up";
}

/** Border-radius (px) for a domino half given the edge shared with its partner. */
function tileRadius(dir: Dir): string {
  const R = "9px";
  const flat = "2px";
  // top-left top-right bottom-right bottom-left
  switch (dir) {
    case "right":
      return `${R} ${flat} ${flat} ${R}`;
    case "left":
      return `${flat} ${R} ${R} ${flat}`;
    case "down":
      return `${R} ${R} ${flat} ${flat}`;
    case "up":
      return `${flat} ${flat} ${R} ${R}`;
  }
}

/** Inset (px) for each side; the partner side overlaps slightly to merge halves. */
function tileInset(dir: Dir): { top: number; right: number; bottom: number; left: number } {
  const I = 3;
  const base = { top: I, right: I, bottom: I, left: I };
  if (dir === "right") base.right = -1;
  else if (dir === "left") base.left = -1;
  else if (dir === "down") base.bottom = -1;
  else base.top = -1;
  return base;
}

/** Greedy graph-colour the regions so neighbours differ; returns tint index per region. */
function colourRegions(puzzle: PipsPuzzle, adj: number[][]): number[] {
  const regionCount = puzzle.constraints.length;
  const nbr: Set<number>[] = Array.from({ length: regionCount }, () => new Set());
  puzzle.cells.forEach((_, cell) => {
    const g = puzzle.regionOf[cell];
    for (const j of adj[cell]) {
      const h = puzzle.regionOf[j];
      if (h !== g) {
        nbr[g].add(h);
        nbr[h].add(g);
      }
    }
  });
  const colour = new Array(regionCount).fill(-1);
  for (let g = 0; g < regionCount; g++) {
    const taken = new Set<number>();
    for (const h of nbr[g]) if (colour[h] >= 0) taken.add(colour[h]);
    let k = 0;
    while (taken.has(k)) k++;
    colour[g] = k % REGION_TINTS.length;
  }
  return colour;
}

export function Pips({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
  hostTimer,
}: GameComponentProps<PipsPuzzle, PipsState>) {
  const { isPremium } = useEntitlement();
  const DOMINOES = puzzle.dominoes.length;

  // Board geometry (memoised on the puzzle).
  const adj = useMemo(() => buildAdjacency(puzzle.cells), [puzzle.cells]);
  const coordIndex = useMemo(() => {
    const m = new Map<string, number>();
    puzzle.cells.forEach((cell, i) => m.set(`${cell.r},${cell.c}`, i));
    return m;
  }, [puzzle.cells]);
  const rows = useMemo(() => Math.max(...puzzle.cells.map((c) => c.r)) + 1, [puzzle.cells]);
  const cols = useMemo(() => Math.max(...puzzle.cells.map((c) => c.c)) + 1, [puzzle.cells]);
  // Size the square-celled board to the height left between the fixed chrome
  // (heading, toolbar, tray, controls) so board + controls fit without scroll.
  // maxW caps the board at its desktop cell size (82px/cell) so it never bloats.
  const { ref: boardFitRef, size: boardSize } = useFitBox<HTMLDivElement>(cols, rows, cols * 82);
  const tintIdx = useMemo(() => colourRegions(puzzle, adj), [puzzle, adj]);
  // Badge anchor cell per region: the bottom-right-most cell (max r, then max c).
  const regionAnchor = useMemo(() => {
    const anchor = new Array(puzzle.constraints.length).fill(-1);
    puzzle.cells.forEach((cell, i) => {
      const g = puzzle.regionOf[i];
      const cur = anchor[g];
      if (cur < 0) {
        anchor[g] = i;
        return;
      }
      const cc = puzzle.cells[cur];
      if (cell.r > cc.r || (cell.r === cc.r && cell.c > cc.c)) anchor[g] = i;
    });
    return anchor;
  }, [puzzle]);

  const [state, setState] = useState<PipsState>(() => {
    const base = emptyState(DOMINOES);
    if (!savedState) return base;
    const fits =
      Array.isArray(savedState.placed) && savedState.placed.length === DOMINOES;
    if (!fits) {
      return {
        ...base,
        elapsedMs: typeof savedState.elapsedMs === "number" ? savedState.elapsedMs : 0,
      };
    }
    return { ...base, ...savedState };
  });

  const [selected, setSelected] = useState<number | null>(null);
  const [orient, setOrient] = useState<Orient>("h");
  const [pendingFlip, setPendingFlip] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [invalidCell, setInvalidCell] = useState<number | null>(null);
  // Final solve stats, captured at win, surfaced in the completion modal.
  const [result, setResult] = useState<{
    stars: number;
    score: number;
    moves: number;
    hints: number;
  } | null>(null);
  const adInFlightRef = useRef(false);

  const { placed, locked, hintsUsed, won, moves } = state;
  const past = state.past ?? [];
  const future = state.future ?? [];
  const canUndo = !won && past.length > 0;
  const canRedo = !won && future.length > 0;
  const clock = useGameClock(!won, savedState?.elapsedMs ?? 0);

  const placement = placed;

  // Which cell each domino covers + render metadata.
  const coveredBy = useMemo(() => {
    const m = new Map<number, number>(); // cell -> domino id
    placed.forEach((p, id) => {
      if (!p) return;
      m.set(p.a, id);
      m.set(p.b, id);
    });
    return m;
  }, [placed]);

  const regions = useMemo(
    () => regionStatus(puzzle, placement),
    [puzzle, placement],
  );
  const metCount = regions.filter((r) => r.met).length;
  const totalRegions = regions.length;

  const trayIds = useMemo(
    () => puzzle.dominoes.map((_, id) => id).filter((id) => !placed[id]),
    [puzzle.dominoes, placed],
  );
  const allPlaced = trayIds.length === 0;

  // ----- persistence -----
  useEffect(() => {
    onPersistState?.({
      placed,
      locked,
      hintsUsed,
      elapsedMs: clock.ms,
      won,
      moves,
      past,
      future,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, locked, hintsUsed, won, moves, past, future]);

  // ----- win handling -----
  const finish = useCallback(
    (finalMoves: number, finalHints: number) => {
      clock.stop();
      haptics.win();
      sfx.win();
      const timeMs = clock.ms;
      const sec = Math.round(timeMs / 1000);
      const extraMoves = Math.max(0, finalMoves - DOMINOES);
      const score = Math.max(
        40,
        100 - Math.floor(sec / 6) - extraMoves * 3 - finalHints * 12,
      );
      const stars = starsFor(sec);
      setResult({ stars, score, moves: finalMoves, hints: finalHints });
      setShowModal(false);
      setTimeout(() => setShowModal(true), reducedMotion ? 0 : 320);
      onComplete({
        status: "won",
        score,
        timeMs,
        moves: finalMoves,
        stars,
        shareText: `BrainTap · Pips\nEvery region satisfied 🁫 in ${formatClock(timeMs)}\n\nbraintap.app`,
        detail: { difficulty: puzzle.difficulty, hintsUsed: finalHints },
      });
    },
    [clock, onComplete, puzzle.difficulty, reducedMotion, DOMINOES],
  );

  const commit = useCallback(
    (next: PipsState) => {
      if (!next.won && isSolved(puzzle, next.placed)) {
        next = { ...next, won: true };
        setState(next);
        finish(next.moves, next.hintsUsed);
      } else {
        setState(next);
      }
    },
    [puzzle, finish],
  );

  const applyAction = useCallback(
    (changes: Partial<BoardSnapshot>) => {
      const prevPast = state.past ?? [];
      const nextPast = [...prevPast, snapshot(state)].slice(-MAX_HISTORY);
      commit({ ...state, ...changes, past: nextPast, future: [] });
    },
    [state, commit],
  );

  const undo = useCallback(() => {
    let did = false;
    setState((s) => {
      const p = s.past ?? [];
      if (s.won || p.length === 0) return s;
      const prev = p[p.length - 1];
      did = true;
      return {
        ...s,
        ...prev,
        // Spent hints are sticky: undo rolls back the board but never refunds a
        // hint (and its score penalty), so hint→undo can't farm free reveals.
        hintsUsed: s.hintsUsed,
        past: p.slice(0, -1),
        future: [...(s.future ?? []), snapshot(s)].slice(-MAX_HISTORY),
      };
    });
    if (did) {
      sfx.tap();
      haptics.tap();
      setSelected(null);
    }
  }, []);

  const redo = useCallback(() => {
    let did = false;
    let redone: PipsState | null = null;
    setState((s) => {
      const f = s.future ?? [];
      if (s.won || f.length === 0) return s;
      const nextBoard = f[f.length - 1];
      did = true;
      const result: PipsState = {
        ...s,
        ...nextBoard,
        hintsUsed: s.hintsUsed, // sticky — never re-credit or double-count a hint
        past: [...(s.past ?? []), snapshot(s)].slice(-MAX_HISTORY),
        future: f.slice(0, -1),
      };
      redone = result;
      return result;
    });
    setSelected(null);
    if (did && redone) {
      sfx.tap();
      haptics.tap();
      const r = redone as PipsState;
      if (!r.won && isSolved(puzzle, r.placed)) {
        setState((s) => ({ ...s, won: true }));
        finish(r.moves, r.hintsUsed);
      }
    }
  }, [puzzle, finish]);

  // ----- placement -----
  const selectTray = useCallback(
    (id: number) => {
      if (won) return;
      setSelected((cur) => {
        if (cur === id) return null;
        return id;
      });
      // Reset pending orientation/flip to a sensible default when (re)selecting.
      setOrient("h");
      setPendingFlip(false);
      sfx.tap();
      haptics.tap();
    },
    [won],
  );

  const placeAt = useCallback(
    (cell: number) => {
      if (won || selected == null || coveredBy.has(cell)) return;
      const { r, c } = puzzle.cells[cell];
      const order: [number, number][] =
        orient === "h"
          ? [
              [0, 1],
              [0, -1],
              [1, 0],
              [-1, 0],
            ]
          : [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ];
      let partner = -1;
      for (const [dr, dc] of order) {
        const j = coordIndex.get(`${r + dr},${c + dc}`);
        if (j != null && !coveredBy.has(j)) {
          partner = j;
          break;
        }
      }
      if (partner < 0) {
        // No room next to this cell — flash it and bail with a distinctly
        // "wrong" cue so an illegal move doesn't feel like a normal tap.
        setInvalidCell(cell);
        sfx.wrong();
        haptics.error();
        setTimeout(() => setInvalidCell(null), reducedMotion ? 0 : 320);
        return;
      }
      const next = placed.slice();
      next[selected] = { a: cell, b: partner, flip: pendingFlip };
      sfx.place();
      haptics.success();
      setSelected(null);
      applyAction({ placed: next, moves: moves + 1 });
    },
    [won, selected, coveredBy, puzzle.cells, orient, coordIndex, placed, pendingFlip, moves, applyAction, reducedMotion],
  );

  // Tap a placed domino: lift it back to the tray and re-select it (preserving
  // its orientation/flip) for quick re-placement. Hint-locked dominoes are fixed.
  const liftCell = useCallback(
    (cell: number) => {
      if (won) return;
      const id = coveredBy.get(cell);
      if (id == null || locked.includes(id)) return;
      const p = placed[id];
      const next = placed.slice();
      next[id] = null;
      sfx.tap();
      haptics.tap();
      applyAction({ placed: next });
      if (p) {
        setOrient(puzzle.cells[p.a].r === puzzle.cells[p.b].r ? "h" : "v");
        setPendingFlip(p.flip);
      }
      setSelected(id);
    },
    [won, coveredBy, locked, placed, applyAction, puzzle.cells],
  );

  const onCellTap = useCallback(
    (cell: number) => {
      if (coveredBy.has(cell)) liftCell(cell);
      else placeAt(cell);
    },
    [coveredBy, liftCell, placeAt],
  );

  const rotate = useCallback(() => {
    setOrient((o) => (o === "h" ? "v" : "h"));
    sfx.tap();
    haptics.tap();
  }, []);
  const flipPending = useCallback(() => {
    setPendingFlip((f) => !f);
    sfx.tap();
    haptics.tap();
  }, []);

  const reset = useCallback(() => {
    if (won) return;
    setSelected(null);
    sfx.tap();
    haptics.tap();
    // Keep hint-locked dominoes (and the hint count/penalty) through a reset.
    setState((s) => {
      const next = emptyState(DOMINOES);
      next.elapsedMs = s.elapsedMs;
      next.hintsUsed = s.hintsUsed;
      for (const id of s.locked) {
        const sol = puzzle.solution[id];
        next.placed[id] = { a: sol.a, b: sol.b, flip: sol.flip };
        next.locked.push(id);
      }
      next.moves = s.moves;
      next.past = [...(s.past ?? []), snapshot(s)].slice(-MAX_HISTORY);
      next.future = [];
      return next;
    });
  }, [won, puzzle.solution, DOMINOES]);

  // Full replay of the same board: clear everything (including hint-locks),
  // reset the clock, and re-arm play. Used by the won-board "Play again" hooks.
  const replayPuzzle = useCallback(() => {
    setSelected(null);
    setOrient("h");
    setPendingFlip(false);
    setInvalidCell(null);
    setResult(null);
    setShowModal(false);
    sfx.tap();
    haptics.tap();
    clock.reset(0);
    clock.start();
    setState(emptyState(DOMINOES));
  }, [clock, DOMINOES]);

  const allPlacedCorrectly = useMemo(
    () => getHint(puzzle, placement) == null,
    [puzzle, placement],
  );

  const useHint = useCallback(async () => {
    if (won || state.hintsUsed >= MAX_HINTS) return;
    if (
      adsAvailable() &&
      !isPremium &&
      state.hintsUsed >= getMonetizationConfig().freeHintThreshold
    ) {
      if (adInFlightRef.current) return;
      adInFlightRef.current = true;
      const r = await showRewardedAd();
      adInFlightRef.current = false;
      if (r !== "rewarded") return;
    }
    const hint = getHint(puzzle, state.placed);
    if (!hint) return;
    setSelected(null);
    sfx.place();
    haptics.success();
    const next = state.placed.slice();
    // Evict whatever occupies the hinted cells, then lock the revealed domino.
    const evict = (cell: number) => {
      const occ = next.findIndex((p) => p && (p.a === cell || p.b === cell));
      if (occ >= 0) next[occ] = null;
    };
    evict(hint.a);
    evict(hint.b);
    next[hint.id] = { a: hint.a, b: hint.b, flip: hint.flip };
    const nextLocked = locked.includes(hint.id) ? locked.slice() : [...locked, hint.id];
    applyAction({
      placed: next,
      locked: nextLocked,
      hintsUsed: state.hintsUsed + 1,
      moves: state.moves + 1,
    });
  }, [won, state, puzzle, applyAction, locked, isPremium]);

  // Global keyboard: Esc clears selection, R rotates, F flips, Ctrl/Cmd+Z undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Escape") setSelected(null);
      else if ((e.key === "r" || e.key === "R") && selected != null) rotate();
      else if ((e.key === "f" || e.key === "F") && selected != null) flipPending();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, rotate, flipPending, selected]);

  // Stars currently "on pace" for, given elapsed time (soft live goal).
  const liveStars = starsFor(Math.round(clock.ms / 1000));

  const status = won
    ? "Solved! Every region is satisfied."
    : selected != null
      ? "Tap a board cell to drop the domino (↻ rotate, ⇄ flip)."
      : allPlaced
        ? `${metCount} of ${totalRegions} regions satisfied — adjust to finish.`
        : "Pick a domino, then tap the board to place it.";

  const selDomino = selected != null ? puzzle.dominoes[selected] : null;
  const selFaces = selDomino ? faces(selDomino, pendingFlip) : null;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[440px] flex-1 flex-col items-center px-1">
      {!hostTimer && (
        <div className="mb-3 flex w-full shrink-0 items-center justify-end font-mono text-[11px] text-ink-mute">
          <span
            className="font-semibold tabular-nums tracking-[0.06em] text-ink-soft"
            aria-label={`Time elapsed ${formatClock(clock.ms)}`}
          >
            {formatClock(clock.ms)}
          </span>
        </div>
      )}

      {/* Heading row */}
      <div className="mb-1 flex w-full shrink-0 items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.16em] text-ink-faint">
          FILL EVERY REGION
        </span>
        <span className="font-mono text-[10px] tracking-[0.12em]" style={{ color: ACCENT.soft }}>
          {metCount}/{totalRegions} satisfied
        </span>
      </div>

      {/* Live star goal — a soft target so a fast solve feels earned. */}
      {!won && (
        <div
          className="mb-2 flex w-full shrink-0 items-center justify-between font-mono text-[10px] tracking-[0.08em] text-ink-mute"
          aria-hidden
        >
          <span className="tabular-nums" style={{ color: liveStars === 3 ? MET : undefined }}>
            {"★".repeat(liveStars)}
            <span className="text-ink-faint">{"☆".repeat(3 - liveStars)}</span>
            <span className="ml-1.5 text-ink-faint">on pace</span>
          </span>
          <span className="text-ink-faint">
            {liveStars > 1
              ? `★★★ under ${STAR_SECONDS.three}s · ★★ under ${STAR_SECONDS.two}s`
              : "solve faster for more stars"}
          </span>
        </div>
      )}

      {/* Board — flexes to the height left between the fixed heading and the
          toolbar/tray/controls; sized by aspect ratio so the whole game fits the
          viewport without scrolling. */}
      <div ref={boardFitRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          width: boardSize?.w,
          height: boardSize?.h,
          gap: 0,
        }}
        role="grid"
        aria-label="Pips board"
      >
        {puzzle.cells.map((cell, i) => {
          const g = puzzle.regionOf[i];
          const tint = REGION_TINTS[tintIdx[g]];
          const id = coveredBy.get(i);
          const covered = id != null;
          const p = covered ? placed[id as number] : null;
          const isLocked = covered && locked.includes(id as number);
          const partner = p ? (p.a === i ? p.b : p.a) : -1;
          const dir = p ? dirOf(cell, puzzle.cells[partner]) : "right";
          const faceVal = p
            ? p.a === i
              ? faces(puzzle.dominoes[id as number], p.flip).a
              : faces(puzzle.dominoes[id as number], p.flip).b
            : 0;
          const inset = tileInset(dir);
          const isAnchor = regionAnchor[g] === i;
          const c = puzzle.constraints[g];
          const region = regions[g];
          const armed = selected != null && !covered && !won;
          const flashing = invalidCell === i && !reducedMotion;

          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              onClick={() => onCellTap(i)}
              disabled={won}
              aria-label={cellLabel(i, cell, g, c, covered, faceVal, isLocked, region.met)}
              className={cn(
                "relative outline-none transition-shadow duration-200 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-white/70",
                flashing && "animate-shake",
              )}
              style={{
                gridColumn: cell.c + 1,
                gridRow: cell.r + 1,
                aspectRatio: "1",
                background: tint.fill,
                boxShadow: armed
                  ? `inset 0 0 0 2px ${ACCENT.solid}cc`
                  : `inset 0 0 0 1.5px ${tint.edge}`,
                cursor: won ? "default" : "pointer",
              }}
            >
              {covered && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: inset.top,
                    right: inset.right,
                    bottom: inset.bottom,
                    left: inset.left,
                    borderRadius: tileRadius(dir),
                    background: "linear-gradient(160deg, #ffffff, #e9edff)",
                    boxShadow: isLocked
                      ? `inset 0 0 0 2px ${ACCENT.solid}, 0 2px 8px rgba(0,0,0,.35)`
                      : "0 2px 8px rgba(0,0,0,.32)",
                  }}
                >
                  <PipFace value={faceVal} />
                  {/* center divider drawn once, from the anchor (`a`) cell */}
                  {p && p.a === i && <Divider dir={dir} />}
                </span>
              )}

              {/* region constraint badge */}
              {isAnchor && c.kind !== "empty" && (
                <span
                  aria-hidden
                  className={cn(!reducedMotion && region.met && "animate-pop")}
                  style={{
                    position: "absolute",
                    right: -7,
                    bottom: -7,
                    width: 22,
                    height: 22,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 7,
                    transform: "rotate(45deg)",
                    background: BADGE_COLOR[c.kind as Exclude<ConstraintKind, "empty">],
                    boxShadow: region.met
                      ? `0 0 0 2px ${MET}, 0 1px 6px rgba(0,0,0,.45)`
                      : "0 1px 6px rgba(0,0,0,.45)",
                    zIndex: 5,
                  }}
                >
                  <span
                    style={{
                      transform: "rotate(-45deg)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {constraintLabel(c)}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      </div>

      {/* Won-board review affordance: the board is locked, so offer the next
          actions inline (not only buried in the modal). */}
      {won && (
        <div className="mt-4 flex w-full shrink-0 items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={replayPuzzle}
            className="flex items-center gap-1.5 rounded-pill border border-line-strong px-5 py-2.5 font-display text-[13.5px] text-[#eaf1ff] outline-none transition-colors hover:border-white/30 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white/40"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <span aria-hidden className="text-[15px] leading-none">↻</span>
            Play again
          </button>
          <Link
            href="/"
            className="rounded-pill border border-line-strong px-5 py-2.5 font-display text-[13.5px] text-[#eaf1ff] outline-none transition-colors hover:border-white/30 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white/40"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            Back to today
          </Link>
        </div>
      )}

      {/* Selected-domino toolbar */}
      <div className="mt-4 flex min-h-[44px] w-full shrink-0 items-center justify-center">
        {selFaces ? (
          <div
            className="flex items-center gap-2 rounded-pill border px-2.5 py-1.5"
            style={{ borderColor: `${ACCENT.solid}66`, background: `${ACCENT.solid}12` }}
          >
            <span className="ml-1 font-mono text-[10px] tracking-[0.1em] text-ink-soft">
              PLACING
            </span>
            <span
              className="flex"
              style={{
                flexDirection: orient === "h" ? "row" : "column",
                background: "linear-gradient(160deg, #ffffff, #e9edff)",
                borderRadius: 7,
                padding: 3,
                gap: 2,
              }}
              aria-hidden
            >
              <span style={{ width: 22, height: 22 }}>
                <PipFace value={selFaces.a} />
              </span>
              <span
                style={
                  orient === "h"
                    ? { width: 1, background: "rgba(4,6,15,.4)", margin: "3px 0" }
                    : { height: 1, background: "rgba(4,6,15,.4)", margin: "0 3px" }
                }
              />
              <span style={{ width: 22, height: 22 }}>
                <PipFace value={selFaces.b} />
              </span>
            </span>
            <button
              type="button"
              onClick={rotate}
              aria-label="Rotate domino orientation"
              className="flex h-11 min-w-[44px] items-center justify-center rounded-full text-[15px] text-ink-soft outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-white/60"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              ↻
            </button>
            <button
              type="button"
              onClick={flipPending}
              aria-label="Swap domino faces"
              className="flex h-11 min-w-[44px] items-center justify-center rounded-full text-[15px] text-ink-soft outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-white/60"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              ⇄
            </button>
          </div>
        ) : (
          <span className="font-mono text-[11px] text-ink-mute">
            {allPlaced ? "All dominoes placed · tap one to adjust" : "Tap a domino below to begin"}
          </span>
        )}
      </div>

      {/* Tray */}
      <div
        className="mt-3 flex min-h-[74px] w-full shrink-0 flex-wrap items-center justify-center gap-3 rounded-2xl border px-3 py-3"
        style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
      >
        {allPlaced ? (
          <span className="font-mono text-[12px] text-ink-mute">
            {won ? "Solved — every region satisfied!" : "All placed · tap a domino to rearrange"}
          </span>
        ) : (
          trayIds.map((id) => {
            const d = puzzle.dominoes[id];
            const isSel = selected === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectTray(id)}
                disabled={won}
                aria-pressed={isSel}
                aria-label={`Domino ${d[0]} and ${d[1]}${isSel ? ", selected" : ""}. Tap to ${isSel ? "deselect" : "select"}`}
                className="flex select-none outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent active:scale-95"
                style={{
                  background: "linear-gradient(160deg, #ffffff, #e8ecff)",
                  borderRadius: 9,
                  padding: 4,
                  boxShadow: isSel
                    ? `0 6px 18px rgba(0,0,0,.4), 0 0 0 2px ${ACCENT.solid}, 0 0 16px ${ACCENT.solid}66`
                    : "0 4px 12px rgba(0,0,0,.32)",
                  transform: isSel && !reducedMotion ? "translateY(-3px)" : "none",
                }}
              >
                <span style={{ width: 38, height: 38 }}>
                  <PipFace value={d[0]} />
                </span>
                <span style={{ width: 1, background: "rgba(4,6,15,.45)", margin: "6px 0" }} />
                <span style={{ width: 38, height: 38 }}>
                  <PipFace value={d[1]} />
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Undo / redo */}
      <div className="mt-4 flex w-full shrink-0 items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo last move"
          title="Undo (Ctrl/Cmd+Z)"
          className="flex items-center gap-1.5 rounded-pill border border-line-strong px-5 py-2 font-display text-[13px] text-[#eaf1ff] outline-none transition-colors hover:border-white/30 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <span aria-hidden className="text-[15px] leading-none">
            ↶
          </span>
          Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo move"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          className="flex items-center gap-1.5 rounded-pill border border-line-strong px-5 py-2 font-display text-[13px] text-[#eaf1ff] outline-none transition-colors hover:border-white/30 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          Redo
          <span aria-hidden className="text-[15px] leading-none">
            ↷
          </span>
        </button>
      </div>

      {/* Controls: hint + reset */}
      <div className="mt-3 flex w-full shrink-0 items-center justify-center gap-2.5">
        <HintButton
          used={hintsUsed}
          max={MAX_HINTS}
          onHint={useHint}
          accent={ACCENT}
          disabled={won || allPlacedCorrectly}
        />
        <button
          type="button"
          onClick={reset}
          disabled={won}
          className="rounded-pill border border-line-strong px-6 py-2.5 font-display text-[13.5px] text-[#eaf1ff] outline-none transition-colors hover:border-white/30 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          Reset board
        </button>
      </div>

      <p
        aria-live="polite"
        className="mt-3 min-h-[2.5rem] shrink-0 text-center font-mono text-[12.5px] leading-snug transition-colors"
        style={{ color: won ? MET : ACCENT.soft }}
      >
        {status}
      </p>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        title="Every region satisfied."
        statValue={formatClock(clock.ms)}
        statLabel="SOLVE TIME"
        insight={INSIGHT}
        share={`BrainTap · Pips\nEvery region satisfied 🁫 in ${formatClock(clock.ms)}\n\nbraintap.app`}
        onReplay={replayPuzzle}
        replayLabel={result && result.stars < 3 ? "Play again — beat your time" : "Play again"}
        extra={
          result && (
            <div className="space-y-2">
              <div
                className="flex items-center justify-center gap-1 text-[26px] leading-none"
                aria-label={`${result.stars} of 3 stars`}
              >
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} style={{ color: i < result.stars ? ACCENT.solid : "rgba(255,255,255,0.18)" }}>
                    {i < result.stars ? "★" : "☆"}
                  </span>
                ))}
              </div>
              <p className="font-mono text-[11px] tracking-[0.08em] text-ink-mute">
                {result.stars < 3
                  ? `Solve under ${STAR_SECONDS.three}s for ★★★`
                  : "Fastest tier cleared"}
                {" · "}
                {result.moves} {result.moves === 1 ? "move" : "moves"}
                {result.hints > 0 && ` · ${result.hints} ${result.hints === 1 ? "hint" : "hints"}`}
              </p>
            </div>
          )
        }
      />
    </div>
  );
}

/** The thin line down the middle of a domino, drawn on the shared edge. */
function Divider({ dir }: { dir: Dir }) {
  const onEdge: Record<Dir, CSSProperties> = {
    right: { right: 0, top: "14%", bottom: "14%", width: 1 },
    left: { left: 0, top: "14%", bottom: "14%", width: 1 },
    down: { bottom: 0, left: "14%", right: "14%", height: 1 },
    up: { top: 0, left: "14%", right: "14%", height: 1 },
  };
  return (
    <span
      aria-hidden
      style={{ position: "absolute", background: "rgba(20,16,40,0.22)", ...onEdge[dir] }}
    />
  );
}

function cellLabel(
  index: number,
  cell: { r: number; c: number },
  region: number,
  c: Constraint,
  covered: boolean,
  faceVal: number,
  locked: boolean,
  met: boolean,
): string {
  const where = `Cell row ${cell.r + 1}, column ${cell.c + 1}, region ${region + 1} (${constraintDescription(c)}${met ? ", satisfied" : ""})`;
  if (covered) {
    return `${where}: shows ${faceVal}${locked ? ", revealed by a hint and locked" : ". Tap to lift the domino"}`;
  }
  return `${where}: empty. Tap to place the selected domino`;
}
