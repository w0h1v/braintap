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
import {
  pairStart,
  halves,
  colSums,
  isSolved,
  getHint,
  configOf,
  colsFor,
  slotsFor,
  type Domino,
  type PipsPuzzle,
  type Placement,
} from "./engine";

export const MAX_HINTS = 3;

const ACCENT = GAME_METAS.pips.accent;
const INSIGHT = GAME_METAS.pips.insight;

const MATCH = "#7CF5C4"; // column total equals target
const OVER = "#ff6b9d"; // column total exceeds target
const PIP_INK = "#1a1030"; // dark navy pip / control colour

/** Pip dot positions on a 3x3 grid (indices 0..8) per face value. */
const PIP_MAP: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};

/**
 * The undoable portion of the board — everything that a placement/flip/hint/
 * reset action changes. The clock, win flag and modal are intentionally NOT in
 * here: undo never resurrects a finished game.
 */
interface BoardSnapshot {
  slots: (number | null)[];
  flips: boolean[];
  locked: number[];
  hintsUsed: number;
  moves: number;
}

interface PipsState {
  /** slots[slot] = domino id or null */
  slots: (number | null)[];
  /** flips[dominoId] = flipped */
  flips: boolean[];
  /** Domino ids revealed + locked by a hint (cannot be moved or flipped). */
  locked: number[];
  /** Number of hints consumed (0..MAX_HINTS). */
  hintsUsed: number;
  elapsedMs: number;
  won: boolean;
  moves: number;
  /**
   * Undo history: board snapshots prior to each action, oldest first. Optional
   * for backward-compat with saves written before undo/redo existed.
   */
  past?: BoardSnapshot[];
  /** Redo stack: snapshots ahead of the current board, applied newest first. */
  future?: BoardSnapshot[];
}

function emptyState(slotCount: number, dominoCount: number): PipsState {
  return {
    slots: new Array(slotCount).fill(null),
    flips: new Array(dominoCount).fill(false),
    locked: [],
    hintsUsed: 0,
    elapsedMs: 0,
    won: false,
    moves: 0,
    past: [],
    future: [],
  };
}

/** Capture the undoable board fields from a full state. */
function snapshot(s: PipsState): BoardSnapshot {
  return {
    slots: s.slots.slice(),
    flips: s.flips.slice(),
    locked: s.locked.slice(),
    hintsUsed: s.hintsUsed,
    moves: s.moves,
  };
}

/** Maximum history depth kept (plenty for a 4-slot board, bounds persistence). */
const MAX_HISTORY = 50;

/** One half of a domino: a 3x3 pip grid. */
function PipFace({ value }: { value: number }) {
  const dots = PIP_MAP[value] ?? [];
  return (
    <div
      className="grid h-full w-full place-items-center"
      style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "min(1.2vw, 4px)", padding: "12%" }}
      aria-hidden="true"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          style={{
            width: "min(2.6vw, 9px)",
            height: "min(2.6vw, 9px)",
            borderRadius: "50%",
            background: dots.includes(i) ? PIP_INK : "transparent",
          }}
        />
      ))}
    </div>
  );
}

/** A full domino tile (two faces side by side). */
function DominoTile({
  d,
  flip,
  selected,
  reducedMotion,
  faceSize,
}: {
  d: Domino;
  flip: boolean;
  selected?: boolean;
  reducedMotion?: boolean;
  /** CSS width for each square face (fluid). */
  faceSize: string;
}) {
  const { left, right } = halves(d, flip);
  // Re-key on flip so the flip keyframe replays each toggle.
  return (
    <div
      key={flip ? "f" : "u"}
      className={cn(
        "flex select-none",
        !reducedMotion && "transition-transform duration-150",
        !reducedMotion && "animate-flip",
      )}
      style={{
        background: "linear-gradient(160deg, #ffffff, #e8ecff)",
        borderRadius: 9,
        padding: 4,
        boxShadow: selected
          ? `0 6px 20px rgba(0,0,0,.4), 0 0 0 2px ${ACCENT.solid}, 0 0 18px ${ACCENT.solid}66`
          : "0 4px 14px rgba(0,0,0,.35)",
        transform: selected && !reducedMotion ? "translateY(-3px)" : "none",
      }}
    >
      <div className="aspect-square" style={{ width: faceSize }}>
        <PipFace value={left} />
      </div>
      <div style={{ width: 1, background: "rgba(4,6,15,.45)", margin: "10% 0" }} />
      <div className="aspect-square" style={{ width: faceSize }}>
        <PipFace value={right} />
      </div>
    </div>
  );
}

export function Pips({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
  hostTimer,
}: GameComponentProps<PipsPuzzle, PipsState>) {
  // Board shape is read from the puzzle (difficulty-driven). Falls back to the
  // legacy 2×2 board for older puzzles that predate the `config` field.
  const cfg = useMemo(() => configOf(puzzle), [puzzle]);
  const COLS = colsFor(cfg);
  const SLOTS = slotsFor(cfg);
  const DOMINOES = SLOTS; // one domino per slot
  const PAIRS = cfg.pairs;

  const [state, setState] = useState<PipsState>(() => {
    const base = emptyState(SLOTS, DOMINOES);
    if (!savedState) return base;
    // Guard against older / mismatched saved shapes (e.g. a save from a
    // different board size): only adopt arrays that fit this board.
    const slotsOk =
      Array.isArray(savedState.slots) && savedState.slots.length === SLOTS;
    const flipsOk =
      Array.isArray(savedState.flips) && savedState.flips.length === DOMINOES;
    if (!slotsOk || !flipsOk) {
      // Keep only the safe, size-independent fields from the old save.
      return {
        ...base,
        elapsedMs: typeof savedState.elapsedMs === "number" ? savedState.elapsedMs : 0,
      };
    }
    return { ...base, ...savedState };
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [hintFlash, setHintFlash] = useState<number | null>(null);
  /** Keyboard-focused slot (0..3) for arrow navigation; refs drive real focus. */
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { slots, flips, won, moves, locked, hintsUsed } = state;
  const past = state.past ?? [];
  const future = state.future ?? [];
  const canUndo = !won && past.length > 0;
  const canRedo = !won && future.length > 0;
  const clock = useGameClock(!won, savedState?.elapsedMs ?? 0);

  const placement: Placement = useMemo(() => ({ slots, flips }), [slots, flips]);
  const sums = useMemo(
    () => colSums(puzzle.bank, placement, cfg),
    [puzzle.bank, placement, cfg],
  );

  // Dominoes not yet placed (tray) preserve their tray order by id.
  const trayIds = useMemo(
    () => Array.from({ length: DOMINOES }, (_, id) => id).filter((id) => !slots.includes(id)),
    [slots, DOMINOES],
  );

  // How many columns currently hit their target — drives the status line.
  const balancedCount = useMemo(
    () => sums.reduce((n, v, i) => (v === puzzle.targets[i] ? n + 1 : n), 0),
    [sums, puzzle.targets],
  );

  // Fire a soft chime + haptic the moment a *new* column becomes balanced
  // (without being a win). Purely feedback; gated by reducedMotion-independent
  // sound preference handled inside sfx.
  const prevBalanced = useRef(balancedCount);
  useEffect(() => {
    if (!won && balancedCount > prevBalanced.current && balancedCount < COLS) {
      sfx.correct();
      haptics.success();
    }
    prevBalanced.current = balancedCount;
  }, [balancedCount, won, COLS]);

  // Persist resumable state (including undo/redo history).
  useEffect(() => {
    onPersistState?.({
      slots,
      flips,
      locked,
      hintsUsed,
      elapsedMs: clock.ms,
      won,
      moves,
      past,
      future,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, flips, locked, hintsUsed, won, moves, past, future]);

  const finish = useCallback(
    (finalMoves: number, finalHints: number) => {
      clock.stop();
      haptics.win();
      sfx.win();
      const timeMs = clock.ms;
      const sec = Math.round(timeMs / 1000);
      // Score rewards speed + few moves beyond the minimum (4 placements),
      // and is reduced for every hint used.
      const extraMoves = Math.max(0, finalMoves - DOMINOES);
      const score = Math.max(
        40,
        100 - Math.floor(sec / 6) - extraMoves * 3 - finalHints * 12,
      );
      const stars = sec < 60 ? 3 : sec < 150 ? 2 : 1;
      setShowModal(false);
      setTimeout(() => setShowModal(true), reducedMotion ? 0 : 320);
      onComplete({
        status: "won",
        score,
        timeMs,
        moves: finalMoves,
        stars,
        shareText: `BrainTap · Pips\nEvery column balanced 🁫 in ${formatClock(timeMs)}\n\nbraintap.app`,
        detail: { difficulty: puzzle.difficulty, hintsUsed: finalHints },
      });
    },
    [clock, onComplete, puzzle.difficulty, reducedMotion, DOMINOES],
  );

  // Detect a win after each board change.
  const commit = useCallback(
    (next: PipsState) => {
      if (!next.won && isSolved(puzzle, { slots: next.slots, flips: next.flips })) {
        next = { ...next, won: true };
        setState(next);
        setPulse(true);
        if (!reducedMotion) setTimeout(() => setPulse(false), 600);
        finish(next.moves, next.hintsUsed);
      } else {
        setState(next);
      }
    },
    [puzzle, finish, reducedMotion],
  );

  /**
   * Apply a board-changing action: record the pre-action board on the undo
   * stack (capping depth), clear the redo stack, then commit + win-detect.
   * `changes` carries only the fields the action mutates.
   */
  const applyAction = useCallback(
    (changes: Partial<BoardSnapshot>) => {
      const prevPast = state.past ?? [];
      const nextPast = [...prevPast, snapshot(state)].slice(-MAX_HISTORY);
      commit({ ...state, ...changes, past: nextPast, future: [] });
    },
    [state, commit],
  );

  const undo = useCallback(() => {
    let didUndo = false;
    setState((s) => {
      const p = s.past ?? [];
      if (s.won || p.length === 0) return s;
      const prev = p[p.length - 1];
      didUndo = true;
      return {
        ...s,
        ...prev,
        past: p.slice(0, -1),
        future: [...(s.future ?? []), snapshot(s)].slice(-MAX_HISTORY),
      };
    });
    if (didUndo) {
      sfx.tap();
      haptics.tap();
      setSelected(null);
      setHintFlash(null);
    }
  }, []);

  const redo = useCallback(() => {
    let didRedo = false;
    let redone: PipsState | null = null;
    setState((s) => {
      const f = s.future ?? [];
      if (s.won || f.length === 0) return s;
      const nextBoard = f[f.length - 1];
      didRedo = true;
      const result: PipsState = {
        ...s,
        ...nextBoard,
        past: [...(s.past ?? []), snapshot(s)].slice(-MAX_HISTORY),
        future: f.slice(0, -1),
      };
      redone = result;
      return result;
    });
    setSelected(null);
    setHintFlash(null);
    // Re-applying a redone board may reach the solution again; win-detect it.
    if (didRedo && redone) {
      sfx.tap();
      haptics.tap();
      const r = redone as PipsState;
      if (!r.won && isSolved(puzzle, { slots: r.slots, flips: r.flips })) {
        setState((s) => ({ ...s, won: true }));
        setPulse(true);
        if (!reducedMotion) setTimeout(() => setPulse(false), 600);
        finish(r.moves, r.hintsUsed);
      }
    }
  }, [puzzle, finish, reducedMotion]);

  const placeInSlot = useCallback(
    (slot: number) => {
      if (won || selected == null) return;
      // Can't overwrite a hint-locked domino sitting in this slot.
      const occupant = state.slots[slot];
      if (occupant != null && state.locked.includes(occupant)) return;
      setSelected(null);
      const nextSlots = state.slots.slice();
      // If something is already in that slot, send it back to the tray.
      nextSlots[slot] = selected;
      // Remove the selected domino from any other slot it occupied.
      for (let s = 0; s < SLOTS; s++) {
        if (s !== slot && nextSlots[s] === selected) nextSlots[s] = null;
      }
      sfx.place();
      haptics.success();
      applyAction({ slots: nextSlots, moves: state.moves + 1 });
    },
    [won, selected, state, applyAction, SLOTS],
  );

  const flipDomino = useCallback(
    (id: number) => {
      if (won || state.locked.includes(id)) return;
      const nextFlips = state.flips.slice();
      nextFlips[id] = !nextFlips[id];
      sfx.tap();
      haptics.tap();
      applyAction({ flips: nextFlips });
    },
    [won, state, applyAction],
  );

  const removeFromSlot = useCallback(
    (slot: number) => {
      if (won) return;
      const occupant = state.slots[slot];
      if (occupant != null && state.locked.includes(occupant)) return;
      const nextSlots = state.slots.slice();
      nextSlots[slot] = null;
      sfx.tap();
      haptics.tap();
      applyAction({ slots: nextSlots });
    },
    [won, state, applyAction],
  );

  const selectTray = useCallback(
    (id: number) => {
      if (won) return;
      setSelected((cur) => (cur === id ? null : id));
      sfx.tap();
      haptics.tap();
    },
    [won],
  );

  const reset = useCallback(() => {
    if (won) return;
    setSelected(null);
    setHintFlash(null);
    sfx.tap();
    haptics.tap();
    // Re-apply hint-locked dominoes so revealed answers persist through a reset;
    // the hint count (and its score penalty) is preserved too. Reset is itself
    // undoable: it records the pre-reset board and clears the redo stack.
    setState((s) => {
      const next = {
        ...emptyState(SLOTS, DOMINOES),
        elapsedMs: s.elapsedMs,
        hintsUsed: s.hintsUsed,
      };
      for (const id of s.locked) {
        const { slot, flip } = puzzle.solution[id];
        next.slots[slot] = id;
        next.flips[id] = flip;
        next.locked.push(id);
      }
      next.moves = s.moves;
      next.past = [...(s.past ?? []), snapshot(s)].slice(-MAX_HISTORY);
      next.future = [];
      return next;
    });
  }, [won, puzzle.solution, DOMINOES, SLOTS]);

  const useHint = useCallback(() => {
    if (won || state.hintsUsed >= MAX_HINTS) return;
    const hint = getHint(puzzle, { slots: state.slots, flips: state.flips });
    if (!hint) return; // nothing left to reveal
    setSelected(null);
    sfx.place();
    haptics.success();
    const nextSlots = state.slots.slice();
    const nextFlips = state.flips.slice();
    // Evict whatever currently occupies the target slot (back to the tray),
    // and pull the hinted domino out of any slot it already sits in.
    nextSlots[hint.slot] = hint.id;
    for (let s = 0; s < SLOTS; s++) {
      if (s !== hint.slot && nextSlots[s] === hint.id) nextSlots[s] = null;
    }
    nextFlips[hint.id] = hint.flip;
    const nextLocked = state.locked.includes(hint.id)
      ? state.locked.slice()
      : [...state.locked, hint.id];
    setHintFlash(hint.slot);
    if (!reducedMotion) setTimeout(() => setHintFlash(null), 700);
    applyAction({
      slots: nextSlots,
      flips: nextFlips,
      locked: nextLocked,
      hintsUsed: state.hintsUsed + 1,
      moves: state.moves + 1,
    });
  }, [won, state, puzzle, applyAction, reducedMotion, SLOTS]);

  // Move keyboard focus to a slot button (used by arrow-key navigation).
  const focusSlot = useCallback(
    (slot: number) => {
      const el = slotRefs.current[((slot % SLOTS) + SLOTS) % SLOTS];
      el?.focus();
    },
    [SLOTS],
  );

  // Step focus by one slot in a grid direction (dr/dc in row/pair units),
  // wrapping within the rows×pairs slot grid.
  const stepFocus = useCallback(
    (fromIdx: number, dr: number, dc: number) => {
      const rows = SLOTS / PAIRS;
      const row = Math.floor(fromIdx / PAIRS);
      const pair = fromIdx % PAIRS;
      const nr = ((row + dr) % rows + rows) % rows;
      const nc = ((pair + dc) % PAIRS + PAIRS) % PAIRS;
      focusSlot(nr * PAIRS + nc);
    },
    [SLOTS, PAIRS, focusSlot],
  );

  // Global keyboard affordances: Escape clears selection, Ctrl/Cmd+Z undoes,
  // Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes, and arrow keys move between slots when
  // a slot is focused. Place/flip on a focused slot is handled natively by the
  // slot buttons via Enter/Space.
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
      if (e.key === "Escape") {
        setSelected(null);
        return;
      }
      // Arrow navigation only when a slot currently holds focus.
      if (e.key.startsWith("Arrow")) {
        const active = document.activeElement;
        const idx = slotRefs.current.findIndex((el) => el && el === active);
        if (idx < 0) return;
        e.preventDefault();
        // rows×pairs grid: left/right move between pairs, up/down between rows.
        if (e.key === "ArrowLeft") stepFocus(idx, 0, -1);
        else if (e.key === "ArrowRight") stepFocus(idx, 0, 1);
        else if (e.key === "ArrowUp") stepFocus(idx, -1, 0);
        else if (e.key === "ArrowDown") stepFocus(idx, 1, 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, stepFocus]);

  const allPlaced = trayIds.length === 0;
  // No hint can do anything once every domino already matches the solution.
  const allPlacedCorrectly = useMemo(
    () => getHint(puzzle, { slots, flips }) == null,
    [puzzle, slots, flips],
  );
  // Status line for screen readers + visible hint.
  const status = won
    ? "Solved! Every column is balanced."
    : selected != null
      ? "Domino selected — tap a slot to place it."
      : balancedCount === 0
        ? "Select a domino, then drop it into a slot."
        : `${balancedCount} of ${COLS} columns balanced.`;

  // Fluid face size keeps tiles comfortable yet never overflowing at 360px.
  const FACE = "clamp(30px, 9.5vw, 42px)";

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col items-center px-1">
      {/*
        Header timer. Hidden when the host renders its own unified timer chip
        (hostTimer) — all timing logic above is preserved so result.timeMs is
        still reported. The difficulty is shown by the host's tier selector, so
        no in-component difficulty/size selector is rendered here.
      */}
      {!hostTimer && (
        <div className="mb-3 flex w-full items-center justify-end font-mono text-[11px] text-ink-mute">
          <span
            className="font-semibold tabular-nums tracking-[0.06em] text-ink-soft"
            aria-label={`Time elapsed ${formatClock(clock.ms)}`}
          >
            {formatClock(clock.ms)}
          </span>
        </div>
      )}

      {/* Column targets */}
      <div className="mb-1.5 flex w-full items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.16em] text-ink-faint">
          COLUMN TARGETS
        </span>
        <span className="font-mono text-[10px] tracking-[0.12em]" style={{ color: ACCENT.soft }}>
          {balancedCount}/{COLS} balanced
        </span>
      </div>
      <div
        className="grid w-full gap-2"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        role="list"
        aria-label="Column targets"
      >
        {Array.from({ length: COLS }, (_, c) => {
          const sum = sums[c];
          const target = puzzle.targets[c];
          const met = sum === target;
          const over = sum > target;
          const empty = sum === 0;
          const border = met ? MATCH : over ? OVER : "rgba(255,255,255,0.16)";
          const bg = met ? `${MATCH}1f` : over ? `${OVER}1f` : "rgba(255,255,255,0.03)";
          return (
            <div
              key={c}
              role="listitem"
              aria-label={`Column ${c + 1}: ${sum} of ${target} pips${met ? ", balanced" : over ? ", over target" : ""}`}
              className={cn(
                "flex flex-col items-center justify-center rounded-[12px] border py-2 transition-all duration-200",
                met && pulse && !reducedMotion && "animate-pop",
              )}
              style={{
                borderColor: border,
                background: bg,
                minHeight: 58,
                boxShadow: met ? `0 0 16px ${MATCH}33` : "none",
              }}
            >
              <span
                className="font-display font-semibold leading-none tabular-nums"
                style={{
                  color: met ? MATCH : over ? OVER : "#f3f7ff",
                  fontSize: "clamp(18px, 5.5vw, 22px)",
                }}
              >
                {empty ? "·" : sum}
              </span>
              <span
                className="mt-1 font-mono text-[11px] tabular-nums"
                style={{ color: met ? `${MATCH}cc` : "rgba(226,234,255,0.45)" }}
              >
                /{target}
              </span>
            </div>
          );
        })}
      </div>

      {/* Slots (2x2) */}
      <div className="mt-5 mb-1.5 w-full font-mono text-[10px] tracking-[0.16em] text-ink-faint">
        SLOTS · TAP TO PLACE, ↻ TO FLIP · ⬄ KEYS TO MOVE
      </div>
      <div
        className="grid w-full gap-2.5"
        style={{ gridTemplateColumns: `repeat(${PAIRS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: SLOTS }, (_, slot) => {
          const id = slots[slot];
          const ps = pairStart(slot, PAIRS);
          if (id == null) {
            const armed = selected != null && !won;
            return (
              <button
                key={slot}
                type="button"
                ref={(el) => {
                  slotRefs.current[slot] = el;
                }}
                onClick={() => placeInSlot(slot)}
                disabled={won}
                aria-label={`Slot ${slot + 1}, empty, feeds columns ${ps + 1} and ${ps + 2}${armed ? ". Tap to place the selected domino" : ", no domino selected"}`}
                className={cn(
                  "flex min-h-[68px] items-center justify-center rounded-xl border-2 border-dashed font-mono text-[11px] tracking-[0.12em] outline-none transition-all duration-200",
                  "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                  armed && !reducedMotion && "animate-pulse2",
                  "disabled:opacity-50",
                )}
                style={{
                  borderColor: armed ? ACCENT.solid : `${ACCENT.solid}55`,
                  background: armed ? `${ACCENT.solid}18` : `${ACCENT.solid}08`,
                  color: ACCENT.soft,
                  ["--tw-ring-color" as string]: `${ACCENT.solid}99`,
                }}
              >
                {armed ? "TAP TO PLACE" : "DROP"}
              </button>
            );
          }
          const d = puzzle.bank[id];
          const { left, right } = halves(d, flips[id]);
          const isLocked = locked.includes(id);
          const flashing = hintFlash === slot && !reducedMotion;
          return (
            <div
              key={slot}
              className={cn(
                "relative flex min-h-[68px] items-center justify-center rounded-xl",
                !reducedMotion && "animate-pop",
                flashing && "animate-pop",
              )}
              style={
                isLocked
                  ? {
                      boxShadow: flashing
                        ? `0 0 0 2px ${ACCENT.solid}, 0 0 22px ${ACCENT.solid}88`
                        : `0 0 0 2px ${ACCENT.solid}aa`,
                      borderRadius: 13,
                    }
                  : undefined
              }
              aria-label={`Slot ${slot + 1}: domino ${left} and ${right}, feeds columns ${ps + 1} and ${ps + 2}${isLocked ? ", revealed by a hint and locked" : ""}`}
            >
              <button
                type="button"
                ref={(el) => {
                  slotRefs.current[slot] = el;
                }}
                onClick={() => flipDomino(id)}
                disabled={won || isLocked}
                aria-label={
                  isLocked
                    ? `Slot ${slot + 1} locked by hint (${left} and ${right})`
                    : `Flip domino in slot ${slot + 1} (currently ${left} and ${right})`
                }
                className={cn(
                  "rounded-[11px] outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                  isLocked ? "cursor-default" : "cursor-pointer",
                )}
              >
                <DominoTile d={d} flip={flips[id]} reducedMotion={reducedMotion} faceSize={FACE} />
              </button>
              {isLocked && (
                <div
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full text-[12px] shadow-sm"
                  style={{ background: ACCENT.solid, color: PIP_INK }}
                  aria-hidden
                  title="Revealed by a hint"
                >
                  🔒
                </div>
              )}
              {!won && !isLocked && (
                <div className="absolute right-1 top-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => flipDomino(id)}
                    aria-label={`Flip domino in slot ${slot + 1}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] shadow-sm outline-none transition-transform active:scale-90 focus-visible:ring-2 focus-visible:ring-white"
                    style={{ background: "rgba(255,255,255,0.92)", color: PIP_INK }}
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromSlot(slot)}
                    aria-label={`Remove domino from slot ${slot + 1}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] shadow-sm outline-none transition-transform active:scale-90 focus-visible:ring-2 focus-visible:ring-white"
                    style={{ background: "rgba(255,255,255,0.92)", color: PIP_INK }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tray */}
      <div className="mt-5 mb-1.5 w-full font-mono text-[10px] tracking-[0.16em] text-ink-faint">
        DOMINO TRAY · TAP TO SELECT, ↻ TO FLIP
      </div>
      <div
        className="flex min-h-[78px] w-full flex-wrap items-center justify-center gap-3 rounded-2xl border px-3 py-3"
        style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
      >
        {allPlaced ? (
          <span className="font-mono text-[12px] text-ink-mute">
            {won ? "Every domino placed — solved!" : "All dominoes placed · flip to balance"}
          </span>
        ) : (
          trayIds.map((id) => {
            const d = puzzle.bank[id];
            const { left, right } = halves(d, flips[id]);
            const isSel = selected === id;
            return (
              <div key={id} className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => selectTray(id)}
                  disabled={won}
                  aria-pressed={isSel}
                  aria-label={`Domino ${left} and ${right}${isSel ? ", selected" : ""}. Tap to ${isSel ? "deselect" : "select"}`}
                  className="rounded-[12px] p-0.5 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent active:scale-95"
                  style={{ ["--tw-ring-color" as string]: `${ACCENT.solid}aa` }}
                >
                  <DominoTile
                    d={d}
                    flip={flips[id]}
                    selected={isSel}
                    reducedMotion={reducedMotion}
                    faceSize={FACE}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => flipDomino(id)}
                  disabled={won}
                  aria-label={`Flip tray domino ${left} and ${right}`}
                  className="flex h-7 min-w-[44px] items-center justify-center rounded-full text-[13px] text-ink-soft outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-white/60"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  ↻
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Undo / redo */}
      <div className="mt-4 flex w-full items-center justify-center gap-2.5">
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
      <div className="mt-3 flex w-full items-center justify-center gap-2.5">
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

      {/* Live status: drives both screen-reader output and a visible hint. */}
      <p
        aria-live="polite"
        className="mt-3 h-5 text-center font-mono text-[12.5px] transition-colors"
        style={{ color: won ? MATCH : ACCENT.soft }}
      >
        {status}
      </p>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        title="Perfectly balanced."
        statValue={formatClock(clock.ms)}
        statLabel="SOLVE TIME"
        insight={INSIGHT}
        share={`BrainTap · Pips\nEvery column balanced 🁫 in ${formatClock(clock.ms)}\n\nbraintap.app`}
      />
    </div>
  );
}
