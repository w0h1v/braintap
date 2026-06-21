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
}: GameComponentProps<SudokuPuzzle, SudokuState>) {
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

  // Count of each digit already placed — disables fully-used numpad keys.
  const digitCounts = useMemo(() => {
    const counts = new Array(7).fill(0) as number[];
    for (const v of grid) if (v >= 1 && v <= 6) counts[v] += 1;
    return counts;
  }, [grid]);

  // Persist resumable state.
  useEffect(() => {
    onPersistState?.({
      entries,
      notes: notes.map((s) => [...s]),
      elapsedMs: won ? finalMsRef.current : clock.ms,
      won,
      hintsUsed,
      hintCells: [...hintCells],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, notes, won, hintsUsed, hintCells]);

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
      detail: { difficulty: puzzle.difficulty, hintsUsed },
    });
  }, [clock, onComplete, puzzle.difficulty, reducedMotion, hintsUsed]);

  const tryComplete = useCallback(
    (g: number[]) => {
      if (g.every((v) => v !== 0)) {
        if (isSolved(g, puzzle.solution)) {
          finish();
        } else {
          mistakesRef.current += 1;
          haptics.error();
          sfx.wrong();
          if (!reducedMotion) {
            setShake(true);
            setTimeout(() => setShake(false), 500);
          }
        }
      }
    },
    [finish, puzzle.solution, reducedMotion],
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
  const status = won
    ? "Puzzle solved."
    : conflictCount > 0
      ? `${conflictCount} cell${conflictCount === 1 ? "" : "s"} conflict.`
      : `${filledCount} of ${CELLS} cells filled.`;

  return (
    <div className="flex w-full flex-col items-center">
      <p id="bt-sudoku-status" className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      {/* meta row: difficulty + progress + timer */}
      <div
        className={cn(
          "mb-3 flex w-full items-center justify-between font-mono text-[11px] text-ink-mute",
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
          {puzzle.difficulty.toUpperCase()}
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
        className="mb-3 h-1 w-full overflow-hidden rounded-pill bg-white/[0.06]"
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

      <div
        className={cn(
          "grid aspect-square w-full grid-cols-6 overflow-hidden rounded-2xl border-2",
          shake && "animate-shake",
        )}
        style={{
          maxWidth: "min(92vw, 380px)",
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

          let bg = "rgba(6,10,22,0.55)";
          if (isSel) bg = `${ACCENT.solid}4d`;
          else if (sameVal) bg = "rgba(0,229,255,0.18)";
          else if (isPeer) bg = "rgba(255,255,255,0.05)";
          if (isHint && !isSel) bg = "rgba(0,229,255,0.14)";
          if (conflict) bg = "rgba(255,107,157,0.18)";
          if (isFlash) bg = `${ACCENT.solid}40`;

          const color = conflict ? CONFLICT : isHint ? SAME : given ? ACCENT.soft : "#eafcff";

          // Stagger the solve reveal across the grid (diagonal sweep).
          const revealDelay = solving && !reducedMotion ? (r + c) * 28 : 0;

          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-label={`Row ${r + 1} column ${c + 1}${value ? `, ${value}` : ", empty"}${given ? ", clue" : ""}${isHint ? ", revealed by hint" : ""}${conflict ? ", conflict" : ""}`}
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
                conflict && !reducedMotion && "animate-pulse2",
            // Persistent non-colour cue (a ring) so conflicts are perceivable
            // without relying on the red tint or the (motion-gated) pulse.
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

      {/* numpad */}
      <div
        className="mt-4 grid w-full grid-cols-6 gap-1.5"
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
                "flex h-[clamp(48px,13vw,56px)] items-center justify-center rounded-[10px] font-display text-xl font-semibold text-[#eafcff] outline-none",
                !reducedMotion && "transition-transform active:scale-90",
                disabled ? "opacity-35" : "active:opacity-90",
              )}
              style={{
                background: notesMode ? `${ACCENT.solid}26` : `${ACCENT.solid}24`,
                border: `1px solid ${ACCENT.solid}${notesMode ? "59" : "33"}`,
              }}
              aria-label={`${notesMode ? "Note" : "Enter"} ${n}${exhausted ? ", all placed" : ""}`}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* undo / redo */}
      <div
        className="mt-3 flex w-full items-center justify-center gap-3"
        style={{ maxWidth: "min(92vw, 380px)" }}
      >
        <button
          type="button"
          onClick={undo}
          disabled={won || undoStack.length === 0}
          aria-label="Undo"
          className={cn(
            "min-h-[44px] flex-1 rounded-pill border border-line-strong px-5 py-2.5 font-display text-[13.5px] text-[#eaf1ff] outline-none disabled:opacity-40",
            !reducedMotion && "transition-colors active:scale-[0.98]",
          )}
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={won || redoStack.length === 0}
          aria-label="Redo"
          className={cn(
            "min-h-[44px] flex-1 rounded-pill border border-line-strong px-5 py-2.5 font-display text-[13.5px] text-[#eaf1ff] outline-none disabled:opacity-40",
            !reducedMotion && "transition-colors active:scale-[0.98]",
          )}
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          ↷ Redo
        </button>
      </div>

      {/* controls */}
      <div
        className="mt-3 flex w-full items-center justify-center gap-3"
        style={{ maxWidth: "min(92vw, 380px)" }}
      >
        <button
          type="button"
          onClick={() => setNotesMode((m) => !m)}
          aria-pressed={notesMode}
          disabled={won}
          className={cn(
            "min-h-[44px] flex-1 rounded-pill border px-5 py-2.5 font-display text-[13.5px] outline-none disabled:opacity-40",
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
          Notes · {notesMode ? "On" : "Off"}
        </button>
        <button
          type="button"
          onClick={erase}
          disabled={won || selected == null || (selected != null && puzzle.given[selected])}
          className={cn(
            "min-h-[44px] flex-1 rounded-pill border border-line-strong px-5 py-2.5 font-display text-[13.5px] text-[#eaf1ff] outline-none disabled:opacity-40",
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
        />
      </div>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        title="Grid solved."
        statValue={formatClock(finalMsRef.current)}
        statLabel="SOLVE TIME"
        insight={INSIGHT}
        share={shareLine(finalMsRef.current)}
      />
    </div>
  );
}
