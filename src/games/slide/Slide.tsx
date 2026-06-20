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
  cellsFor,
  sizeOf,
  BLANK,
  blankPos,
  canMove,
  applyMove,
  isSolved,
  manhattan,
  neighbors,
  nextBestMove,
  type Board,
  type SlidePuzzle,
} from "./engine";

const ACCENT = GAME_METAS.slide.accent;
const INSIGHT = GAME_METAS.slide.insight;

// Fluid board sizing shared by every full-width row so nothing overflows at 360px.
const BOARD_W = "min(92vw, 360px)";

export const MAX_HINTS = 3;
const HINT_PENALTY = 8; // score points deducted per hint used
// Tile-slide transition duration (ms). Kept in sync with the CSS transition.
const SLIDE_MS = 140;

interface SlideState {
  board: Board;
  moves: number;
  elapsedMs: number;
  won: boolean;
  hintsUsed: number;
  /** Grid edge length this save belongs to (back-compat: absent on old saves). */
  size?: number;
}

const shareLine = (moves: number, ms: number, size: number) =>
  `BrainTap · Tile Slide\nSolved in ${moves} moves · ${formatClock(ms)}\n\n🟦 ${size}×${size} sliding puzzle\nbraintap.app`;

export function Slide({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion = false,
  hostTimer = false,
}: GameComponentProps<SlidePuzzle, SlideState>) {
  // Grid size is driven by the difficulty the host selects, via the puzzle.
  // Fall back to inferring it from the board for legacy puzzles without a size.
  const size = puzzle.size ?? sizeOf(puzzle.start);
  const cells = cellsFor(size);
  const lastTile = cells - 1; // highest tile value (== cells - 1)

  // Only honour a saved board that matches the active grid size. Older saves (or
  // saves from a different tier) carry a board of a different length, so we fall
  // back to the fresh puzzle to avoid mixing sizes or crashing.
  const saved =
    savedState && Array.isArray(savedState.board) && savedState.board.length === cells
      ? savedState
      : null;

  const [board, setBoard] = useState<Board>(() => saved?.board?.slice() ?? puzzle.start.slice());
  const [moves, setMoves] = useState(() => saved?.moves ?? 0);
  const [won, setWon] = useState(() => saved?.won ?? false);
  const [hintsUsed, setHintsUsed] = useState(() => saved?.hintsUsed ?? 0);
  const [hintCell, setHintCell] = useState(-1); // tile cell currently highlighted by a hint
  const [showModal, setShowModal] = useState(false);
  const [focus, setFocus] = useState(0);
  const [solving, setSolving] = useState(false);
  const [nudge, setNudge] = useState(false);
  const completedRef = useRef(false);
  const finalMsRef = useRef(saved?.won ? (saved?.elapsedMs ?? 0) : 0);
  const hintsUsedRef = useRef(hintsUsed);
  hintsUsedRef.current = hintsUsed;
  const hintTimerRef = useRef<number | null>(null);

  // Lower bound on remaining moves (used for the share/stat efficiency hint).
  const optimalLB = useMemo(() => manhattan(puzzle.start, size), [puzzle.start, size]);

  const clock = useGameClock(!won && moves > 0, saved?.elapsedMs ?? 0);

  // React to a difficulty/size switch from the host: the host namespaces saved
  // state per tier, but on mount we still reset our refs/state to the new puzzle
  // when the puzzle identity changes.
  const puzzleSig = `${size}:${puzzle.start.join(",")}`;
  const lastSigRef = useRef(puzzleSig);
  useEffect(() => {
    if (lastSigRef.current === puzzleSig) return;
    lastSigRef.current = puzzleSig;
    const fresh =
      savedState && Array.isArray(savedState.board) && savedState.board.length === cells
        ? savedState
        : null;
    completedRef.current = false;
    finalMsRef.current = fresh?.won ? (fresh?.elapsedMs ?? 0) : 0;
    setBoard(fresh?.board?.slice() ?? puzzle.start.slice());
    setMoves(fresh?.moves ?? 0);
    setWon(fresh?.won ?? false);
    setHintsUsed(fresh?.hintsUsed ?? 0);
    setHintCell(-1);
    setShowModal(false);
    setFocus(0);
    setSolving(false);
    clock.reset(fresh?.elapsedMs ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleSig]);

  // Persist resumable state (JSON-serialisable only).
  useEffect(() => {
    onPersistState?.({
      board,
      moves,
      elapsedMs: won ? finalMsRef.current : clock.ms,
      won,
      hintsUsed,
      size,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, moves, won, hintsUsed]);

  useEffect(
    () => () => {
      if (hintTimerRef.current != null) window.clearTimeout(hintTimerRef.current);
    },
    [],
  );

  const finish = useCallback(
    (finalMoves: number, finalMs: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      clock.stop();
      finalMsRef.current = finalMs;
      setWon(true);
      setSolving(true);
      setHintCell(-1);
      haptics.win();
      sfx.win();
      setTimeout(() => setShowModal(true), reducedMotion ? 120 : 620);

      // Score: efficiency-weighted (vs the Manhattan lower bound) with a time
      // bonus. Manhattan is a hard lower bound, so moves >= optimalLB always.
      const eff = optimalLB > 0 ? Math.min(1, optimalLB / finalMoves) : 1;
      const sec = Math.round(finalMs / 1000);
      const timeBonus = Math.max(0, 20 - Math.floor(sec / 10));
      const usedHints = hintsUsedRef.current;
      const base = Math.round(40 + eff * 40 + timeBonus);
      const score = Math.max(35, Math.min(100, base - usedHints * HINT_PENALTY));
      const stars = score >= 85 ? 3 : score >= 60 ? 2 : 1;

      onComplete({
        status: "won",
        score,
        moves: finalMoves,
        timeMs: finalMs,
        stars,
        shareText: shareLine(finalMoves, finalMs, size),
        detail: { optimalLB, efficiency: Math.round(eff * 100), hintsUsed: usedHints, size },
      });
    },
    [clock, onComplete, optimalLB, reducedMotion, size],
  );

  const slideAt = useCallback(
    (p: number) => {
      if (won || completedRef.current) return;
      setBoard((cur) => {
        if (!canMove(cur, p, size)) {
          // Invalid tap: a small nudge + soft haptic so the player gets feedback.
          haptics.tap();
          if (!reducedMotion) {
            setNudge(true);
            window.setTimeout(() => setNudge(false), 220);
          }
          return cur;
        }
        const next = applyMove(cur, p, size);
        const startTimer = moves === 0;
        if (startTimer) clock.start();
        setMoves((m) => m + 1);
        setFocus(p); // the blank moved to where the tile was; keep focus on a real tile
        setHintCell(-1); // any move clears an outstanding hint highlight
        sfx.tap();
        haptics.tap();
        if (isSolved(next)) {
          // moves state hasn't flushed yet; compute the final count locally.
          const finalMoves = moves + 1;
          queueMicrotask(() => finish(finalMoves, clock.ms));
        }
        return next;
      });
    },
    [won, moves, clock, finish, reducedMotion, size],
  );

  // Hint: compute a sensible next move (pure helper), highlight it, then auto-make
  // it after a short beat so the player sees which tile moved. Deducts score.
  const useHint = useCallback(() => {
    if (won || completedRef.current) return;
    if (hintsUsedRef.current >= MAX_HINTS) return;
    const cell = nextBestMove(board, -1, size);
    if (cell < 0 || !canMove(board, cell, size)) return;

    setHintsUsed((h) => h + 1);
    setHintCell(cell);
    haptics.tap();
    sfx.tap();

    if (hintTimerRef.current != null) window.clearTimeout(hintTimerRef.current);
    if (reducedMotion) {
      slideAt(cell);
    } else {
      // Show the highlight briefly, then perform the move.
      hintTimerRef.current = window.setTimeout(() => {
        slideAt(cell);
      }, 420);
    }
  }, [won, board, reducedMotion, slideAt, size]);

  // Keyboard: arrow keys slide the tile from that direction into the blank.
  // Tab focus + Enter/Space activates the focused tile.
  const moveFocus = useCallback(
    (dr: number, dc: number) => {
      setFocus((cur) => {
        let r = Math.floor(cur / size) + dr;
        let c = (cur % size) + dc;
        r = Math.max(0, Math.min(size - 1, r));
        c = Math.max(0, Math.min(size - 1, c));
        return r * size + c;
      });
    },
    [size],
  );

  const slideFromDirection = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      // The blank "absorbs" the tile in the given direction relative to it.
      const blankIdx = blankPos(board);
      const r = Math.floor(blankIdx / size);
      const c = blankIdx % size;
      let target = -1;
      if (dir === "up" && r < size - 1) target = blankIdx + size; // tile below moves up
      else if (dir === "down" && r > 0) target = blankIdx - size; // tile above moves down
      else if (dir === "left" && c < size - 1) target = blankIdx + 1; // tile right moves left
      else if (dir === "right" && c > 0) target = blankIdx - 1; // tile left moves right
      if (target >= 0) slideAt(target);
    },
    [board, slideAt, size],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won) return;
      switch (e.key) {
        case "ArrowUp":
          slideFromDirection("up");
          e.preventDefault();
          break;
        case "ArrowDown":
          slideFromDirection("down");
          e.preventDefault();
          break;
        case "ArrowLeft":
          slideFromDirection("left");
          e.preventDefault();
          break;
        case "ArrowRight":
          slideFromDirection("right");
          e.preventDefault();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [won, slideFromDirection]);

  const alreadyWonOnLoad = useRef(saved?.won ?? false);
  const isComplete = won || isSolved(board);
  const blank = blankPos(board);
  const movable = useMemo(() => new Set(neighbors(blank, size)), [blank, size]);

  const replayed = alreadyWonOnLoad.current && !isComplete;

  // Tiles in their final position (excluding the blank) — drives the progress bar.
  const placed = useMemo(() => {
    let n = 0;
    for (let i = 0; i < cells - 1; i++) if (board[i] === i + 1) n += 1;
    return n;
  }, [board, cells]);

  const status = isComplete
    ? `Solved in ${moves} moves.`
    : replayed
      ? "Replaying. Beat your previous time."
      : `${placed} of ${lastTile} tiles in place, ${moves} moves.`;

  const liveMs = won ? finalMsRef.current : clock.ms;

  // Map tile value -> current cell index. Drives absolutely-positioned tiles so
  // a value that changes cell animates via a CSS transform transition.
  const cellOfValue = useMemo(() => {
    const m: number[] = new Array(cells).fill(-1);
    for (let i = 0; i < cells; i++) m[board[i]] = i;
    return m;
  }, [board, cells]);

  const hintsLeft = MAX_HINTS - hintsUsed;

  return (
    <div className="flex w-full flex-col items-center" id="screen-slide">
      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>

      {/* meta row: moves + progress + timer (timer hidden when the host owns it) */}
      <div
        className={cn(
          "flex w-full items-center justify-between font-mono text-[11px] text-ink-mute",
          !reducedMotion && "animate-rise",
        )}
        style={{ maxWidth: BOARD_W }}
      >
        <span
          id="slide-moves-pill"
          className="rounded-pill border px-2.5 py-1 tabular-nums tracking-[0.12em]"
          style={{
            color: ACCENT.soft,
            borderColor: `${ACCENT.solid}40`,
            background: `${ACCENT.solid}14`,
          }}
        >
          <span id="slide-moves">{moves}</span> {moves === 1 ? "MOVE" : "MOVES"}
        </span>
        <span className="tabular-nums tracking-[0.12em]" style={{ color: ACCENT.soft }}>
          {placed}/{lastTile}
        </span>
        {hostTimer ? (
          <span className="tabular-nums tracking-[0.12em]" style={{ color: ACCENT.soft }}>
            {size}×{size}
          </span>
        ) : (
          <span
            id="slide-time"
            className="tabular-nums tracking-[0.1em]"
            aria-label={`Time ${formatClock(liveMs)}`}
          >
            {formatClock(liveMs)}
          </span>
        )}
      </div>

      {/* progress bar */}
      <div
        className="mt-2.5 h-1 w-full overflow-hidden rounded-pill bg-white/[0.06]"
        style={{ maxWidth: BOARD_W }}
        role="presentation"
      >
        <div
          className={cn("h-full rounded-pill", !reducedMotion && "transition-[width] duration-300")}
          style={{
            width: `${(placed / lastTile) * 100}%`,
            backgroundImage: `linear-gradient(90deg, ${ACCENT.from}, ${ACCENT.to})`,
          }}
        />
      </div>

      {/* status message line (visible) */}
      <div
        id="slide-msg"
        aria-hidden
        className="mb-1 mt-3 min-h-[18px] text-center font-mono text-[12.5px]"
        style={{ color: ACCENT.soft }}
      >
        {isComplete ? "Solved!" : replayed ? "Replaying — beat your time." : ""}
      </div>

      <div
        id="slide-board"
        role="grid"
        aria-label={`Tile slide board, ${size} by ${size}`}
        className={cn(
          "relative w-full rounded-2xl p-2",
          nudge && !reducedMotion && "animate-shake",
        )}
        style={{
          maxWidth: BOARD_W,
          aspectRatio: "1 / 1",
          background: `${ACCENT.solid}10`,
          border: `1px solid ${ACCENT.solid}${isComplete ? "59" : "29"}`,
          boxShadow: isComplete
            ? `0 18px 50px -18px ${ACCENT.solid}80, inset 0 0 50px -30px ${ACCENT.solid}`
            : `0 14px 40px -24px ${ACCENT.solid}55, inset 0 0 40px -34px ${ACCENT.solid}`,
          transition: reducedMotion ? undefined : "border-color 0.4s ease, box-shadow 0.4s ease",
        }}
      >
        {/* Inner stage: padding lives on the board; tiles are positioned within
            this 0..100% stage. Each cell occupies (100/size)% with a gutter. */}
        <div className="absolute inset-2">
          {/* Blank slot marker (static, sits under the tiles). */}
          {(() => {
            const bi = cellOfValue[BLANK];
            const br = Math.floor(bi / size);
            const bc = bi % size;
            const pct = 100 / size;
            const gut = 4; // px gutter, matches former gap-2 feel
            return (
              <div
                key="blank"
                role="gridcell"
                aria-label={`Empty space, row ${br + 1} column ${bc + 1}`}
                className="absolute rounded-[10px]"
                style={{
                  width: `calc(${pct}% - ${gut}px)`,
                  height: `calc(${pct}% - ${gut}px)`,
                  left: `calc(${bc * pct}% + ${gut / 2}px)`,
                  top: `calc(${br * pct}% + ${gut / 2}px)`,
                  background: `${ACCENT.solid}08`,
                  boxShadow: `inset 0 0 0 1px ${ACCENT.solid}1a`,
                  transition: reducedMotion ? undefined : `left ${SLIDE_MS}ms ease, top ${SLIDE_MS}ms ease`,
                }}
              />
            );
          })()}

          {Array.from({ length: cells - 1 }, (_, k) => {
            const value = k + 1; // tiles 1..cells-1
            const i = cellOfValue[value]; // current cell
            const r = Math.floor(i / size);
            const c = i % size;
            const pct = 100 / size;
            const gut = 4;

            const canSlide = movable.has(i) && !isComplete;
            const inPlace = value === i + 1;
            const isHint = hintCell === i && !isComplete;
            // Stagger a celebratory pulse diagonally across the board on solve.
            const revealDelay = solving && !reducedMotion ? (r + c) * 32 : 0;

            return (
              <button
                key={value}
                type="button"
                role="gridcell"
                aria-label={`Tile ${value}, row ${r + 1} column ${c + 1}${
                  inPlace ? ", in place" : ""
                }${canSlide ? ", press to slide" : ""}${isHint ? ", suggested move" : ""}`}
                tabIndex={focus === i ? 0 : -1}
                onFocus={() => setFocus(i)}
                onClick={() => slideAt(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    slideAt(i);
                  } else if (e.key === "w") moveFocus(-1, 0);
                  else if (e.key === "s") moveFocus(1, 0);
                  else if (e.key === "a") moveFocus(0, -1);
                  else if (e.key === "d") moveFocus(0, 1);
                }}
                disabled={isComplete}
                className={cn(
                  "absolute flex touch-manipulation select-none items-center justify-center rounded-[10px] font-display font-semibold tabular-nums outline-none",
                  "focus-visible:ring-2 focus-visible:ring-offset-0",
                  !reducedMotion && "transition-[left,top,box-shadow,background-color]",
                  !reducedMotion && canSlide && "active:scale-95",
                  canSlide ? "cursor-pointer" : "cursor-default",
                )}
                style={{
                  width: `calc(${pct}% - ${gut}px)`,
                  height: `calc(${pct}% - ${gut}px)`,
                  left: `calc(${c * pct}% + ${gut / 2}px)`,
                  top: `calc(${r * pct}% + ${gut / 2}px)`,
                  transitionDuration: reducedMotion ? undefined : `${SLIDE_MS}ms`,
                  transitionTimingFunction: "cubic-bezier(0.22, 0.61, 0.36, 1)",
                  fontSize: `clamp(16px, ${Math.round(56 / size)}vw, 28px)`,
                  color: "#eafcff",
                  background: isHint
                    ? `linear-gradient(160deg, ${ACCENT.from}, ${ACCENT.to})`
                    : inPlace
                      ? `linear-gradient(160deg, ${ACCENT.solid}47, ${ACCENT.to}33)`
                      : `linear-gradient(160deg, ${ACCENT.solid}26, ${ACCENT.to}1f)`,
                  boxShadow: isHint
                    ? `0 0 0 2px ${ACCENT.solid}, 0 6px 20px ${ACCENT.solid}80, inset 0 0 0 1px ${ACCENT.solid}`
                    : canSlide
                      ? `0 4px 14px rgba(0,0,0,0.28), inset 0 0 0 1px ${ACCENT.solid}66`
                      : inPlace
                        ? `0 2px 10px rgba(0,0,0,0.22), inset 0 0 0 1px ${ACCENT.solid}3d`
                        : "0 2px 8px rgba(0,0,0,0.2)",
                  ["--tw-ring-color" as string]: `${ACCENT.solid}cc`,
                  animation:
                    isHint && !reducedMotion
                      ? "btSlideHint 0.9s ease-in-out infinite"
                      : solving && !reducedMotion
                        ? `btSolve 0.5s ease ${revealDelay}ms both`
                        : undefined,
                  zIndex: isHint ? 3 : 2,
                }}
              >
                {value}
                {inPlace && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                    style={{ background: ACCENT.solid, boxShadow: `0 0 6px ${ACCENT.solid}` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* hint control */}
      <div className="mt-3 flex w-full items-center justify-center" style={{ maxWidth: BOARD_W }}>
        <HintButton
          used={hintsUsed}
          max={MAX_HINTS}
          onHint={useHint}
          accent={ACCENT}
          disabled={isComplete || replayed || hintsLeft <= 0}
          label="Hint"
        />
      </div>

      <p
        className="mt-3 text-center font-mono text-[11px] leading-relaxed text-ink-faint"
        style={{ maxWidth: BOARD_W }}
      >
        Tap a tile next to the gap to slide it. Order 1 → {lastTile} with the gap last. Arrow keys
        work too.
      </p>

      {/* Keyframes for the hint pulse. Defined inline so the game folder is self-contained. */}
      <style>{`
        @keyframes btSlideHint {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        eyebrow="PUZZLE COMPLETE"
        title="Order restored."
        statValue={String(moves)}
        statLabel="MOVES"
        insight={INSIGHT}
        extra={
          <div className="font-mono text-[12px] text-ink-faint">
            TIME · <span style={{ color: ACCENT.from }}>{formatClock(finalMsRef.current)}</span>
            {hintsUsed > 0 && (
              <>
                {" · "}
                HINTS · <span style={{ color: ACCENT.from }}>{hintsUsed}</span>
              </>
            )}
          </div>
        }
        share={shareLine(moves, finalMsRef.current, size)}
      />
    </div>
  );
}
