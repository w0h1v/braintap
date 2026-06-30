"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { HintButton } from "@/components/play/HintButton";
import { useGameClock } from "@/lib/useGameClock";
import { formatClock } from "@/lib/share";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import { useFitBox } from "@/lib/useFitBox";
import { useEntitlement } from "@/lib/entitlement";
import { adsAvailable, showRewardedAd } from "@/lib/ads";
import { getMonetizationConfig } from "@/lib/config";
import {
  N,
  CELLS,
  idx,
  findConflicts,
  isSolved,
  peersOf,
  getHint,
  type SudokuPuzzle,
} from "./engine";

const ACCENT = GAME_METAS.sudoku.accent;
export const MAX_HINTS = 3;
const HINT_PENALTY = 8;
const INSIGHT = GAME_METAS.sudoku.insight;

const CONFLICT = "#ff6b9d";
const SAME = "#00e5ff";

/**
 * Cells of the row, column and 2×3 box containing `cell` that are now fully
 * filled and correct — drives the per-region success flash (VIS-1).
 */
function completedUnitCells(g: number[], cell: number, solution: number[]): number[] {
  const r = Math.floor(cell / N);
  const c = cell % N;
  const out = new Set<number>();
  const correctFull = (cells: number[]) =>
    cells.every((i) => g[i] !== 0 && g[i] === solution[i]);
  const row = Array.from({ length: N }, (_, k) => idx(r, k));
  if (correctFull(row)) row.forEach((i) => out.add(i));
  const col = Array.from({ length: N }, (_, k) => idx(k, c));
  if (correctFull(col)) col.forEach((i) => out.add(i));
  const br = Math.floor(r / 2) * 2;
  const bc = Math.floor(c / 3) * 3;
  const box: number[] = [];
  for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 3; dc++) box.push(idx(br + dr, bc + dc));
  if (correctFull(box)) box.forEach((i) => out.add(i));
  return [...out];
}

interface SudokuState {
  entries: number[];
  notes: number[][];
  elapsedMs: number;
  won: boolean;
  /** True when the win was a "reveal solution" give-up, not a genuine solve. */
  gaveUp?: boolean;
  hintsUsed?: number;
  hintCells?: number[];
}

// A point-in-time snapshot of the mutable board, used for undo/redo.
interface Snapshot {
  entries: number[];
  notes: number[][];
  hintsUsed: number;
  hintCells: number[];
  selected: number | null;
}

const shareLine = (ms: number) =>
  `BrainTap · Mini Sudoku\nSolved in ${formatClock(ms)}\n\n🟪 6×6 deduction\nbraintap.app`;

export function Sudoku({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion = false,
  hostTimer = false,
  difficulty,
}: GameComponentProps<SudokuPuzzle, SudokuState>) {
  // MECH: the user-facing tier is the one the player picked (host-provided),
  // not the engine's post-removal clue-count classification, which can disagree
  // with the selected tier. Fall back to the puzzle's own label when no tier was
  // passed (e.g. tier-less daily entry points).
  const tier = difficulty ?? puzzle.difficulty;
  const saved = savedState ?? null;
  const { isPremium } = useEntitlement();
  const [entries, setEntries] = useState<number[]>(
    () => saved?.entries ?? new Array(CELLS).fill(0),
  );
  const [notes, setNotes] = useState<Set<number>[]>(() =>
    saved?.notes
      ? saved.notes.map((arr) => new Set(arr))
      : Array.from({ length: CELLS }, () => new Set<number>()),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [won, setWon] = useState(saved?.won ?? false);
  const [hintsUsed, setHintsUsed] = useState(saved?.hintsUsed ?? 0);
  const [hintCells, setHintCells] = useState<Set<number>>(
    () => new Set(saved?.hintCells ?? []),
  );
  const [revealCell, setRevealCell] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  // WIN: when the board is completely filled but doesn't match the solution we
  // surface a persistent banner + mark the offending cells (instead of relying
  // on a one-shot 500ms shake). Cleared the moment the player edits anything.
  const [wrongCells, setWrongCells] = useState<Set<number>>(() => new Set());
  // GIVE-UP: when the player reveals the solution, the board fills read-only so
  // they can review the answer rather than abandoning a stuck puzzle.
  const [gaveUp, setGaveUp] = useState(saved?.gaveUp ?? false);
  // Cells briefly flashing after their row/column/box was completed (VIS-1).
  const [flashCells, setFlashCells] = useState<Set<number>>(() => new Set());
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [solving, setSolving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const mistakesRef = useRef(0);
  // Guards the rewarded-ad hint flow against re-entrancy while an ad is showing.
  const adInFlightRef = useRef(false);
  const finalMsRef = useRef(saved?.won ? (saved?.elapsedMs ?? 0) : 0);

  // Undo/redo history (session-only). Each stack entry is a full board snapshot
  // captured *before* a mutating action so we can roll back to it.
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);

  const clock = useGameClock(!won, saved?.elapsedMs ?? 0);

  // Size the square 6×6 board to the height left between the fixed meta/progress
  // chrome and the numpad/controls, so board + all controls fit the viewport
  // without scrolling on phones. 320 caps the board so it never out-competes the
  // fixed controls for height on short screens (iPhone SE): a 320px 6×6 board is
  // still ~53px/cell — comfortably tappable — while giving back the vertical
  // slack the control stack needs. The flex-1 region still grows the board to
  // this cap on larger screens.
  const { ref: boardFitRef, size: boardSize } = useFitBox<HTMLDivElement>(N, N, 320);

  // Capture the current mutable board into a serialisable snapshot.
  const snapshot = useCallback(
    (): Snapshot => ({
      entries: entries.slice(),
      notes: notes.map((s) => [...s]),
      hintsUsed,
      hintCells: [...hintCells],
      selected,
    }),
    [entries, notes, hintsUsed, hintCells, selected],
  );

  // Push the current state onto the undo stack and clear redo (new branch).
  const pushHistory = useCallback(() => {
    setUndoStack((prev) => [...prev, snapshot()]);
    setRedoStack([]);
  }, [snapshot]);

  // Apply a snapshot to the live board (used by both undo and redo).
  const applySnapshot = useCallback((snap: Snapshot) => {
    setEntries(snap.entries.slice());
    setNotes(snap.notes.map((arr) => new Set(arr)));
    setHintsUsed(snap.hintsUsed);
    setHintCells(new Set(snap.hintCells));
    setSelected(snap.selected);
    setWrongCells(new Set());
  }, []);

  const undo = useCallback(() => {
    if (won || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, snapshot()]);
    setUndoStack((u) => u.slice(0, -1));
    applySnapshot(prev);
    sfx.tap();
    haptics.tap();
  }, [won, undoStack, snapshot, applySnapshot]);

  const redo = useCallback(() => {
    if (won || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, snapshot()]);
    setRedoStack((r) => r.slice(0, -1));
    applySnapshot(next);
    sfx.tap();
    haptics.tap();
  }, [won, redoStack, snapshot, applySnapshot]);

  // Working grid = givens + user entries.
  const grid = useMemo(() => {
    const g = puzzle.puzzle.slice();
    for (let i = 0; i < CELLS; i++) if (!puzzle.given[i]) g[i] = entries[i];
    return g;
  }, [puzzle, entries]);

  const conflicts = useMemo(() => findConflicts(grid), [grid]);
  const conflictCount = useMemo(() => conflicts.filter(Boolean).length, [conflicts]);
  const filledCount = useMemo(() => grid.filter((v) => v !== 0).length, [grid]);
  const peers = useMemo(() => (selected == null ? new Set<number>() : peersOf(selected)), [selected]);
  const selectedValue = selected != null ? grid[selected] : 0;

  // Count of each digit placed *without conflict* — drives the numpad's
  // "all placed" badge. We deliberately ignore conflicting placements so a
  // digit is never disabled while it's still wrong somewhere (CTRL): a player
  // who erases a bad placement can always re-enter the digit without hunting.
  const digitCounts = useMemo(() => {
    const counts = new Array(7).fill(0) as number[];
    for (let i = 0; i < CELLS; i++) {
      const v = grid[i];
      if (v >= 1 && v <= 6 && !conflicts[i]) counts[v] += 1;
    }
    return counts;
  }, [grid, conflicts]);

  // Persist resumable state.
  useEffect(() => {
    onPersistState?.({
      entries,
      notes: notes.map((s) => [...s]),
      elapsedMs: won ? finalMsRef.current : clock.ms,
      won,
      gaveUp,
      hintsUsed,
      hintCells: [...hintCells],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, notes, won, gaveUp, hintsUsed, hintCells]);

  const finish = useCallback(() => {
    clock.stop();
    const timeMs = clock.ms;
    finalMsRef.current = timeMs;
    setWon(true);
    setSolving(true);
    haptics.win();
    sfx.win();
    const sec = Math.round(timeMs / 1000);
    const score = Math.max(
      10,
      100 - Math.floor(sec / 6) - mistakesRef.current * 4 - hintsUsed * HINT_PENALTY,
    );
    const baseStars = sec < 180 ? 3 : sec < 360 ? 2 : 1;
    // A hinted solve caps stars (can't earn the full 3).
    const stars = hintsUsed > 0 ? Math.min(baseStars, 2) : baseStars;
    const revealMs = reducedMotion ? 120 : 760;
    setTimeout(() => setShowModal(true), revealMs);
    onComplete({
      status: "won",
      score,
      timeMs,
      mistakes: mistakesRef.current,
      stars,
      shareText: shareLine(timeMs),
      detail: { difficulty: tier, hintsUsed },
    });
  }, [clock, onComplete, tier, reducedMotion, hintsUsed]);

  const tryComplete = useCallback(
    (g: number[]) => {
      if (g.every((v) => v !== 0)) {
        if (isSolved(g, puzzle.solution)) {
          setWrongCells(new Set());
          finish();
        } else {
          mistakesRef.current += 1;
          haptics.error();
          sfx.wrong();
          // Persist which filled cells differ from the solution so the player
          // has a steady, reviewable cue (not just a one-shot shake). Conflicts
          // already show their own ring; here we surface the silent-wrong cells.
          const wrong = new Set<number>();
          for (let i = 0; i < CELLS; i++) {
            if (!puzzle.given[i] && g[i] !== puzzle.solution[i]) wrong.add(i);
          }
          setWrongCells(wrong);
          if (!reducedMotion) {
            setShake(true);
            setTimeout(() => setShake(false), 500);
          }
        }
      }
    },
    [finish, puzzle.solution, puzzle.given, reducedMotion],
  );

  // Briefly flash a just-completed row/column/box in the game accent (VIS-1).
  const flashUnits = useCallback(
    (cells: number[]) => {
      if (reducedMotion || cells.length === 0) return;
      setFlashCells(new Set(cells));
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashCells(new Set()), 650);
    },
    [reducedMotion],
  );

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const inputDigit = useCallback(
    (n: number) => {
      if (won || selected == null || puzzle.given[selected]) return;
      pushHistory();
      // Any edit invalidates a stale "full but wrong" verdict.
      setWrongCells(new Set());
      if (notesMode) {
        setNotes((prev) => {
          const next = prev.slice();
          const s = new Set(next[selected]);
          if (s.has(n)) s.delete(n);
          else s.add(n);
          next[selected] = s;
          return next;
        });
        sfx.tap();
        haptics.tap();
        return;
      }
      setEntries((prev) => {
        const next = prev.slice();
        next[selected] = next[selected] === n ? 0 : n;
        const g = puzzle.puzzle.slice();
        for (let i = 0; i < CELLS; i++) if (!puzzle.given[i]) g[i] = next[i];
        sfx.place();
        haptics.success();
        // clear notes when committing a value
        setNotes((pn) => {
          const nn = pn.slice();
          nn[selected] = new Set();
          return nn;
        });
        const target = selected;
        queueMicrotask(() => {
          tryComplete(g);
          if (!g.every((v, k) => v === puzzle.solution[k])) {
            flashUnits(completedUnitCells(g, target, puzzle.solution));
          }
        });
        return next;
      });
    },
    [won, selected, notesMode, puzzle, tryComplete, pushHistory, flashUnits],
  );

  const erase = useCallback(() => {
    if (won || selected == null || puzzle.given[selected]) return;
    // Nothing to erase → don't record a no-op on the undo stack.
    if (entries[selected] === 0 && notes[selected].size === 0) return;
    pushHistory();
    setWrongCells(new Set());
    setEntries((prev) => {
      const next = prev.slice();
      next[selected] = 0;
      return next;
    });
    setNotes((prev) => {
      const next = prev.slice();
      next[selected] = new Set();
      return next;
    });
    sfx.tap();
    haptics.tap();
  }, [won, selected, puzzle.given, entries, notes, pushHistory]);

  const handleHint = useCallback(async () => {
    if (won || hintsUsed >= MAX_HINTS) return;
    // MON-1: past the free threshold, a non-premium native user earns the hint
    // by watching a rewarded ad. Inert on web (adsAvailable() is false), so the
    // hint behaves exactly as before there. Ad fail → no hint, no penalty.
    if (adsAvailable() && !isPremium && hintsUsed >= getMonetizationConfig().freeHintThreshold) {
      if (adInFlightRef.current) return; // ignore taps while a rewarded ad is in flight
      adInFlightRef.current = true;
      const r = await showRewardedAd();
      adInFlightRef.current = false;
      if (r !== "rewarded") return;
    }
    const hint = getHint(grid, puzzle.solution);
    if (!hint) return;
    const { cell, value } = hint;
    pushHistory();
    setHintsUsed((h) => h + 1);
    setHintCells((prev) => {
      const next = new Set(prev);
      next.add(cell);
      return next;
    });
    setSelected(cell);
    if (!reducedMotion) {
      setRevealCell(cell);
      setTimeout(() => setRevealCell((c) => (c === cell ? null : c)), 600);
    }
    sfx.place();
    haptics.success();
    setNotes((pn) => {
      const nn = pn.slice();
      nn[cell] = new Set();
      return nn;
    });
    setEntries((prev) => {
      const next = prev.slice();
      next[cell] = value;
      const g = puzzle.puzzle.slice();
      for (let i = 0; i < CELLS; i++) if (!puzzle.given[i]) g[i] = next[i];
      queueMicrotask(() => {
        tryComplete(g);
        if (!g.every((v, k) => v === puzzle.solution[k])) {
          flashUnits(completedUnitCells(g, cell, puzzle.solution));
        }
      });
      return next;
    });
  }, [won, hintsUsed, grid, puzzle, reducedMotion, tryComplete, pushHistory, flashUnits, isPremium]);

  // GIVE-UP: fill the whole board from the solution, read-only, so a stuck
  // player can review the answer and leave satisfied. Records a "lost" result
  // (no score) — distinct from a genuine solve.
  const revealSolution = useCallback(() => {
    if (won || gaveUp) return;
    if (!confirm("Reveal the full solution? This ends the puzzle without a win.")) return;
    clock.stop();
    finalMsRef.current = clock.ms;
    setGaveUp(true);
    setWon(true);
    setWrongCells(new Set());
    setSelected(null);
    setEntries(() => {
      const next = new Array(CELLS).fill(0);
      for (let i = 0; i < CELLS; i++) if (!puzzle.given[i]) next[i] = puzzle.solution[i];
      return next;
    });
    setNotes(Array.from({ length: CELLS }, () => new Set<number>()));
    sfx.tap();
    haptics.tap();
    const revealMs = reducedMotion ? 120 : 500;
    setTimeout(() => setShowModal(true), revealMs);
    onComplete({
      status: "lost",
      score: 0,
      timeMs: clock.ms,
      mistakes: mistakesRef.current,
      stars: 0,
      detail: { difficulty: tier, hintsUsed, revealed: true },
    });
  }, [won, gaveUp, clock, puzzle.given, puzzle.solution, reducedMotion, onComplete, tier, hintsUsed]);

  // Replay the same puzzle from scratch (session-only reset; the host keeps the
  // tier). Wired into the CompletionModal's "Play again" action.
  const reset = useCallback(() => {
    setEntries(new Array(CELLS).fill(0));
    setNotes(Array.from({ length: CELLS }, () => new Set<number>()));
    setSelected(null);
    setNotesMode(false);
    setWon(false);
    setGaveUp(false);
    setHintsUsed(0);
    setHintCells(new Set());
    setWrongCells(new Set());
    setUndoStack([]);
    setRedoStack([]);
    setShowModal(false);
    setSolving(false);
    mistakesRef.current = 0;
    finalMsRef.current = 0;
    clock.reset();
    clock.start();
  }, [clock]);

  const move = useCallback((dr: number, dc: number) => {
    setSelected((cur) => {
      const c = cur ?? 0;
      let r = Math.floor(c / N) + dr;
      let col = (c % N) + dc;
      r = (r + N) % N;
      col = (col + N) % N;
      return idx(r, col);
    });
  }, []);

  // Keyboard support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won) return;
      const mod = e.metaKey || e.ctrlKey;
      // Undo: Ctrl/Cmd+Z. Redo: Ctrl/Cmd+Shift+Z or Ctrl+Y.
      if (mod && (e.key === "z" || e.key === "Z")) {
        if (e.shiftKey) redo();
        else undo();
        e.preventDefault();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        redo();
        e.preventDefault();
        return;
      }
      if (e.key >= "1" && e.key <= "6") {
        inputDigit(Number(e.key));
        e.preventDefault();
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        erase();
        e.preventDefault();
      } else if (e.key === "n" || e.key === "N") {
        setNotesMode((m) => !m);
      } else if (e.key === "ArrowUp") (move(-1, 0), e.preventDefault());
      else if (e.key === "ArrowDown") (move(1, 0), e.preventDefault());
      else if (e.key === "ArrowLeft") (move(0, -1), e.preventDefault());
      else if (e.key === "ArrowRight") (move(0, 1), e.preventDefault());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [won, inputDigit, erase, move, undo, redo]);

  // Status text for screen readers.
  const status = gaveUp
    ? "Solution revealed."
    : won
      ? "Puzzle solved."
      : wrongCells.size > 0
        ? "Board is full but not yet correct — check the highlighted cells."
        : conflictCount > 0
          ? `${conflictCount} cell${conflictCount === 1 ? "" : "s"} conflict.`
          : `${filledCount} of ${CELLS} cells filled.`;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center">
      <p id="bt-sudoku-status" className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      {/* meta row: difficulty + progress + timer */}
      <div
        className={cn(
          "mb-2 flex w-full shrink-0 items-center justify-between font-mono text-[11px] text-ink-mute",
          !reducedMotion && "animate-rise",
        )}
        style={{ maxWidth: "min(92vw, 380px)" }}
      >
        <span
          className="rounded-pill border px-2.5 py-1 tracking-[0.14em]"
          style={{
            color: ACCENT.soft,
            borderColor: `${ACCENT.solid}40`,
            background: `${ACCENT.solid}14`,
          }}
        >
          {tier.toUpperCase()}
        </span>
        <span className="tabular-nums tracking-[0.12em]" style={{ color: ACCENT.soft }}>
          {filledCount}/{CELLS}
        </span>
        {/* The GameHost renders a unified timer when hostTimer is true, so we
            suppress our own chip to avoid duplication. Timing LOGIC (clock,
            finalMsRef, result.timeMs) stays intact regardless. */}
        {!hostTimer && (
          <span aria-hidden className="tabular-nums tracking-[0.1em]">
            {formatClock(won ? finalMsRef.current : clock.ms)}
          </span>
        )}
      </div>

      {/* progress bar */}
      <div
        className="mb-2 h-1 w-full shrink-0 overflow-hidden rounded-pill bg-white/[0.06]"
        style={{ maxWidth: "min(92vw, 380px)" }}
        role="presentation"
      >
        <div
          className={cn("h-full rounded-pill", !reducedMotion && "transition-[width] duration-300")}
          style={{
            width: `${(filledCount / CELLS) * 100}%`,
            backgroundImage: `linear-gradient(90deg, ${ACCENT.from}, ${ACCENT.to})`,
          }}
        />
      </div>

      {/* WIN: persistent banner for a full-but-incorrect board (stays until the
          next edit), so the state isn't conveyed by a single 500ms shake. */}
      {wrongCells.size > 0 && !won && (
        <div
          className="mb-2 w-full shrink-0 rounded-xl border px-3 py-1.5 text-center font-display text-[12px] leading-snug"
          style={{
            maxWidth: "min(92vw, 380px)",
            color: CONFLICT,
            borderColor: `${CONFLICT}59`,
            background: `${CONFLICT}1a`,
          }}
        >
          Board is full but not yet correct — check the highlighted cells.
        </div>
      )}

      {/* board — flexes to the height left between the fixed meta/progress chrome
          above and the numpad/controls below, sized square by useFitBox so the
          whole game fits the viewport without scrolling on phones. */}
      <div ref={boardFitRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
      <div
        className={cn(
          "grid grid-cols-6 overflow-hidden rounded-2xl border-2",
          shake && "animate-shake",
        )}
        style={{
          width: boardSize?.w,
          height: boardSize?.h,
          gridTemplateRows: `repeat(${N}, 1fr)`,
          borderColor: `${ACCENT.solid}66`,
          background: `${ACCENT.solid}1a`,
          boxShadow: `0 18px 50px -20px ${ACCENT.solid}59, inset 0 0 40px -28px ${ACCENT.solid}`,
        }}
        role="grid"
        aria-label="Sudoku grid, 6 by 6"
      >
        {Array.from({ length: CELLS }, (_, i) => {
          const r = Math.floor(i / N);
          const c = i % N;
          const value = grid[i];
          const given = puzzle.given[i];
          const isSel = selected === i;
          const isPeer = peers.has(i);
          const sameVal = selectedValue !== 0 && value === selectedValue && !isSel;
          const conflict = conflicts[i];
          const cellNotes = notes[i];
          const isHint = hintCells.has(i);
          const isFlash = flashCells.has(i);
          const isWrong = wrongCells.has(i);

          let bg = `${ACCENT.solid}12`;
          if (isSel) bg = `${ACCENT.solid}4d`;
          else if (sameVal) bg = `${ACCENT.solid}33`;
          else if (isPeer) bg = `${ACCENT.solid}20`;
          if (isHint && !isSel) bg = "rgba(0,229,255,0.16)";
          if (conflict) bg = "rgba(255,107,157,0.18)";
          if (isWrong && !conflict) bg = "rgba(255,107,157,0.14)";
          if (isFlash) bg = `${ACCENT.solid}40`;

          const color =
            conflict || isWrong ? CONFLICT : isHint ? SAME : given ? ACCENT.soft : "#eafcff";

          // Stagger the solve reveal across the grid (diagonal sweep).
          const revealDelay = solving && !reducedMotion ? (r + c) * 28 : 0;

          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-label={`Row ${r + 1} column ${c + 1}${value ? `, ${value}` : ", empty"}${given ? ", clue" : ""}${isHint ? ", revealed by hint" : ""}${conflict ? ", conflict" : ""}${isWrong && !conflict ? ", incorrect" : ""}`}
              aria-selected={isSel}
              disabled={won}
              onClick={() => {
                setSelected(i);
                if (!given && !won) {
                  sfx.tap();
                  haptics.tap();
                }
              }}
              className={cn(
                "relative flex touch-manipulation select-none items-center justify-center font-display outline-none",
                !reducedMotion && "transition-[background-color,transform,color] duration-150",
            // A persistent ring marks conflicts without a throbbing animation —
            // a steady cue reads clearly but isn't visually loud.
            conflict && "ring-2 ring-inset ring-[#ff6b9d]",
                isSel && !reducedMotion && "z-10 scale-[1.04]",
              )}
              style={{
                background: bg,
                color,
                fontWeight: given ? 700 : 500,
                fontSize: "clamp(15px, 5.4vw, 22px)",
                animation:
                  solving && !reducedMotion
                    ? `btSolve 0.5s ease ${revealDelay}ms both`
                    : isFlash && !reducedMotion
                      ? "btSolve 0.5s ease both"
                      : revealCell === i && !reducedMotion
                        ? "btPop 0.32s ease both"
                        : undefined,
                boxShadow: isSel
                  ? `inset 0 0 0 2px ${ACCENT.solid}`
                  : isFlash
                    ? `inset 0 0 0 2px ${ACCENT.solid}, 0 0 18px -4px ${ACCENT.solid}`
                    : undefined,
                // ACC: wrong-but-not-conflicting cells get a *dashed* inset
                // outline — a shape cue distinct from the solid conflict ring,
                // so the error state doesn't rely on colour alone.
                ...(isWrong && !conflict && !isSel
                  ? { outline: `2px dashed ${CONFLICT}`, outlineOffset: "-3px" }
                  : null),
                borderRight:
                  c === N - 1
                    ? "none"
                    : `${c % 3 === 2 ? 2 : 1}px solid ${c % 3 === 2 ? `${ACCENT.solid}59` : "rgba(255,255,255,0.07)"}`,
                borderBottom:
                  r === N - 1
                    ? "none"
                    : `${r % 2 === 1 ? 2 : 1}px solid ${r % 2 === 1 ? `${ACCENT.solid}59` : "rgba(255,255,255,0.07)"}`,
              }}
            >
              {/* ACC: non-colour marker for hint-revealed cells — a small
                  corner dot, distinct from peer/same-value highlighting which
                  is colour-only. */}
              {isHint && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                  style={{ background: SAME }}
                />
              )}
              {value !== 0 ? (
                value
              ) : cellNotes.size > 0 ? (
                <span className="grid grid-cols-3 gap-px p-0.5 text-[8.5px] leading-none text-ink-faint">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <span key={n} className="flex h-2 w-2 items-center justify-center tabular-nums">
                      {cellNotes.has(n) ? n : ""}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      </div>

      {/* numpad */}
      <div
        className="mt-2.5 grid w-full shrink-0 grid-cols-6 gap-1.5"
        style={{ maxWidth: "min(92vw, 380px)" }}
      >
        {[1, 2, 3, 4, 5, 6].map((n) => {
          const exhausted = digitCounts[n] >= N;
          const disabled = won || exhausted;
          return (
            <button
              key={n}
              type="button"
              onClick={() => inputDigit(n)}
              disabled={disabled}
              className={cn(
                "flex h-[clamp(42px,11vw,52px)] items-center justify-center rounded-[10px] font-display text-xl font-semibold text-[#eafcff] outline-none",
                !reducedMotion && "transition-transform active:scale-90",
                disabled ? "opacity-35" : "active:opacity-90",
              )}
              style={{
                background: notesMode ? `${ACCENT.solid}40` : `${ACCENT.solid}33`,
                border: `1px solid ${ACCENT.solid}${notesMode ? "73" : "4d"}`,
              }}
              aria-label={`${notesMode ? "Note" : "Enter"} ${n}${exhausted ? ", all placed" : ""}`}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* controls — undo/redo/notes/erase/hint combined into a single compact
          row so the board + every control fits a short (iPhone SE) viewport
          without scrolling. Buttons stay ≥40px tall (above the dense-cluster
          floor) and keep their full aria labels. */}
      <div
        className="mt-2 flex w-full shrink-0 items-stretch justify-center gap-1.5"
        style={{ maxWidth: "min(92vw, 380px)" }}
      >
        <button
          type="button"
          onClick={undo}
          disabled={won || undoStack.length === 0}
          aria-label="Undo"
          className={cn(
            "flex h-10 flex-[0.7] items-center justify-center rounded-pill border border-line-strong px-2 font-display text-[15px] text-[#eaf1ff] outline-none disabled:opacity-40 sm:h-11",
            !reducedMotion && "transition-colors active:scale-[0.98]",
          )}
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          ↶
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={won || redoStack.length === 0}
          aria-label="Redo"
          className={cn(
            "flex h-10 flex-[0.7] items-center justify-center rounded-pill border border-line-strong px-2 font-display text-[15px] text-[#eaf1ff] outline-none disabled:opacity-40 sm:h-11",
            !reducedMotion && "transition-colors active:scale-[0.98]",
          )}
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          ↷
        </button>
        <button
          type="button"
          onClick={() => setNotesMode((m) => !m)}
          aria-pressed={notesMode}
          aria-label={`Notes mode ${notesMode ? "on" : "off"}`}
          disabled={won}
          className={cn(
            "flex h-10 flex-[1.4] items-center justify-center rounded-pill border px-2 font-display text-[13px] outline-none disabled:opacity-40 sm:h-11 sm:text-[13.5px]",
            !reducedMotion && "transition-colors active:scale-[0.98]",
          )}
          style={
            notesMode
              ? {
                  color: ACCENT.soft,
                  borderColor: `${ACCENT.solid}99`,
                  background: `${ACCENT.solid}1f`,
                }
              : {
                  color: "#eaf1ff",
                  borderColor: "rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.04)",
                }
          }
        >
          Notes {notesMode ? "On" : "Off"}
        </button>
        <button
          type="button"
          onClick={erase}
          disabled={won || selected == null || (selected != null && puzzle.given[selected])}
          className={cn(
            "flex h-10 flex-1 items-center justify-center rounded-pill border border-line-strong px-2 font-display text-[13px] text-[#eaf1ff] outline-none disabled:opacity-40 sm:h-11 sm:text-[13.5px]",
            !reducedMotion && "transition-colors active:scale-[0.98]",
          )}
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          Erase
        </button>
        <HintButton
          used={hintsUsed}
          max={MAX_HINTS}
          onHint={handleHint}
          accent={ACCENT}
          disabled={won}
          className="!min-h-0 h-10 flex-[1.4] justify-center !gap-1 !px-2 !text-[13px] sm:h-11 sm:!text-[13.5px]"
        />
      </div>

      {/* WIN: a low-key give-up path so a stuck player can review the answer and
          leave satisfied rather than abandoning. Records a loss, no score. */}
      {!won && (
        <button
          type="button"
          onClick={revealSolution}
          className={cn(
            "mt-2 shrink-0 rounded-pill px-4 py-1.5 font-display text-[12px] text-ink-mute outline-none",
            !reducedMotion && "transition-colors active:scale-[0.98]",
          )}
          style={{ background: "transparent" }}
        >
          Reveal solution
        </button>
      )}

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        won={!gaveUp}
        title={gaveUp ? "Solution revealed." : "Grid solved."}
        statValue={gaveUp ? undefined : formatClock(finalMsRef.current)}
        statLabel={gaveUp ? undefined : "SOLVE TIME"}
        insight={INSIGHT}
        share={gaveUp ? undefined : shareLine(finalMsRef.current)}
        onReplay={reset}
        replayLabel="Play again"
      />
    </div>
  );
}
