"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
  COLS,
  ROWS,
  CELLS,
  cellKey,
  adjacent,
  isConnectedPath,
  readPath,
  getHint,
  type Cell,
  type StrandsPuzzle,
} from "./engine";

/** Fallback hint budget for older puzzle shapes that predate `maxHints`. */
const DEFAULT_MAX_HINTS = 2;
const HINT_PENALTY = 12;

const ACCENT = GAME_METAS.strands.accent;
const SPANGRAM_COLOR = "#a9f6ff";
/** Per-word fill colours for found theme words. */
const PALETTE = ["#00e5ff", "#ff2bd6", "#ffb020", "#7CF5C4", "#86a3ff", "#ff7a9c", "#9b8cff", "#7CF5C4", "#ff9e3d"];

const DEFAULT_MSG = "Tap connected letters to spell a word.";

interface StrandsState {
  /** Words found so far (theme words + maybe spangram). */
  found: string[];
  elapsedMs: number;
  won: boolean;
  /** How many hints the player has spent. */
  hintsUsed?: number;
}

/** Per-cell geometry as percentages of the board, for the SVG connector overlay. */
function cellCenter(r: number, c: number): { x: number; y: number } {
  return { x: ((c + 0.5) / COLS) * 100, y: ((r + 0.5) / ROWS) * 100 };
}

export function Strands({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
  hostTimer = false,
}: GameComponentProps<StrandsPuzzle, StrandsState>) {
  const saved = savedState ?? null;
  const { isPremium } = useEntitlement();
  const targets = useMemo(() => [puzzle.spangram, ...puzzle.words], [puzzle]);
  const total = targets.length;
  // Hint generosity comes from the puzzle's difficulty tier (easy=3, medium=1,
  // hard=0). Guard against older puzzle shapes that lack the field.
  const maxHints = puzzle.maxHints ?? DEFAULT_MAX_HINTS;

  const [found, setFound] = useState<string[]>(() => saved?.found ?? []);
  const [hintsUsed, setHintsUsed] = useState<number>(() => saved?.hintsUsed ?? 0);
  const hintsUsedRef = useRef(saved?.hintsUsed ?? 0);
  /** Cells of the word currently being revealed by a hint (highlighted). */
  const [hintCells, setHintCells] = useState<Set<string>>(() => new Set());
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // current in-progress selection path (connected adjacency chain)
  const [path, setPath] = useState<Cell[]>([]);
  const [cursor, setCursor] = useState<Cell>([0, 0]);
  const [won, setWon] = useState(saved?.won ?? false);
  const [shake, setShake] = useState(false);
  /** One-shot board pulse fired on the final word / completion (feel cue). */
  const [boardWin, setBoardWin] = useState(false);
  /** Authoritative solve time (ms) captured synchronously at finish; the
   *  throttled clock state can lag by up to ~250ms. Used for the modal too. */
  const [finalMs, setFinalMs] = useState<number | null>(saved?.won ? (saved?.elapsedMs ?? 0) : null);
  const [message, setMessage] = useState<string>(DEFAULT_MSG);
  const [msgTone, setMsgTone] = useState<"idle" | "good" | "span" | "bad">("idle");
  /** Word whose cells just popped in (for the reveal animation). */
  const [popWord, setPopWord] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(saved?.won ?? false);
  // Single in-flight guard for the entire hint flow (including the rewarded-ad
  // await), so a double-tap can't spend two hints or desync the ad path.
  const hintInFlightRef = useRef(false);

  const clock = useGameClock(!won, saved?.elapsedMs ?? 0);

  // Size the 6×8 board to the height left between the fixed chrome (eyebrow,
  // progress, bar, message, controls) so board + controls fit without scroll.
  const { ref: boardFitRef, size: boardSize } = useFitBox<HTMLDivElement>(COLS, ROWS, 360);

  // Soft hint nudge: after a stretch of inactivity (no new word, no selection)
  // and with hints still available, gently pulse the Hint button. Resets on
  // any progress so it only fires when the player seems stuck.
  const [nudgeHint, setNudgeHint] = useState(false);
  useEffect(() => {
    setNudgeHint(false);
    if (won || hintsUsed >= maxHints || path.length > 0) return;
    const t = setTimeout(() => setNudgeHint(true), 18000);
    return () => clearTimeout(t);
  }, [won, hintsUsed, maxHints, found.length, path.length]);

  // Authoritative elapsed-time accounting, mirroring the clock but readable
  // synchronously (the clock's `ms` state is throttled to 250ms ticks).
  const baseElapsedRef = useRef(saved?.elapsedMs ?? 0);
  const sessionStartRef = useRef(Date.now());
  /** Elapsed ms at this instant — accurate at the moment of a win. */
  const elapsedNow = useCallback(
    () => (won ? baseElapsedRef.current : baseElapsedRef.current + (Date.now() - sessionStartRef.current)),
    [won],
  );

  /** Stable colour for a given found word. */
  const colorFor = useCallback(
    (w: string) =>
      w === puzzle.spangram ? SPANGRAM_COLOR : PALETTE[puzzle.words.indexOf(w) % PALETTE.length],
    [puzzle],
  );

  // Map of cell-key → fill colour for found words.
  const cellColor = useMemo(() => {
    const m = new Map<string, string>();
    found.forEach((w) => {
      const pl = puzzle.placements[w];
      if (!pl) return;
      const color = colorFor(w);
      pl.path.forEach(([r, c]) => m.set(cellKey(r, c), color));
    });
    return m;
  }, [found, puzzle, colorFor]);

  const pathSet = useMemo(() => new Set(path.map(([r, c]) => cellKey(r, c))), [path]);
  const spangramFound = found.includes(puzzle.spangram);
  const remaining = total - found.length;

  // Persist resumable state (JSON-serialisable).
  useEffect(() => {
    onPersistState?.({ found, elapsedMs: clock.ms, won, hintsUsed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found, won, hintsUsed]);

  // Resume-after-win: if the player returns to an already-solved board, surface
  // the results modal immediately rather than flashing a frozen, all-disabled
  // board with no way back to the summary.
  useEffect(() => {
    if (saved?.won) setShowModal(true);
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup pending timers on unmount.
  useEffect(
    () => () => {
      if (msgTimer.current) clearTimeout(msgTimer.current);
      if (popTimer.current) clearTimeout(popTimer.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  const flash = useCallback((text: string, tone: "idle" | "good" | "span" | "bad" = "idle") => {
    setMessage(text);
    setMsgTone(tone);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => {
      setMessage(DEFAULT_MSG);
      setMsgTone("idle");
    }, 1700);
  }, []);

  const finish = useCallback(
    (allFound: string[]) => {
      if (completedRef.current) return;
      completedRef.current = true;
      // Capture the authoritative elapsed BEFORE stopping the clock; the
      // throttled `clock.ms` state may lag the true value by up to ~250ms.
      const timeMs = elapsedNow();
      baseElapsedRef.current = timeMs;
      setFinalMs(timeMs);
      clock.stop();
      setWon(true);
      haptics.win();
      sfx.win();
      // One-shot board-level completion pulse before the modal opens (feel).
      if (!reducedMotion) {
        setBoardWin(true);
        setTimeout(() => setBoardWin(false), 620);
      }
      const sec = Math.max(1, Math.round(timeMs / 1000));
      const usedHints = hintsUsedRef.current;
      // Score: fast solves score higher; floor of 50 for completion. Hints cost.
      const base = Math.min(100, 100 - Math.floor(sec / 12));
      const score = Math.max(50, base - usedHints * HINT_PENALTY);
      setTimeout(() => setShowModal(true), reducedMotion ? 0 : 620);
      onComplete({
        status: "won",
        score,
        timeMs,
        stars: sec < 240 ? 3 : sec < 480 ? 2 : 1,
        shareText: `BrainTap · Mind Strands\nTheme: ${puzzle.theme}\n${allFound.length - 1}/${puzzle.words.length} + spangram 🌟\nin ${formatClock(timeMs)}\n\nbraintap.app`,
        detail: { theme: puzzle.theme, hintsUsed: usedHints },
      });
    },
    [clock, elapsedNow, onComplete, puzzle, reducedMotion],
  );

  /** Mark a word's cells with a quick reveal pop (respects reducedMotion). */
  const triggerPop = useCallback(
    (word: string) => {
      if (reducedMotion) return;
      setPopWord(word);
      if (popTimer.current) clearTimeout(popTimer.current);
      popTimer.current = setTimeout(() => setPopWord(null), 420);
    },
    [reducedMotion],
  );

  /** Spend a hint: reveal one not-yet-found word by lighting its path cells. */
  const useHint = useCallback(async () => {
    // Single in-flight guard for the WHOLE hint body: prevents a double-tap
    // (or a tap during the rewarded-ad await) from spending two hints or
    // desyncing the rewarded-ad path. Cleared in `finally`.
    if (hintInFlightRef.current) return;
    // Read the spend count from the ref, not the closed-over state, so rapid
    // calls can't both observe the same stale value.
    const used = hintsUsedRef.current;
    if (won || used >= maxHints) return;
    hintInFlightRef.current = true;
    try {
      // MON-1: past the free threshold, a non-premium native user earns the hint
      // by watching a rewarded ad. Inert on web (adsAvailable() is false), so the
      // hint behaves exactly as before there. Ad fail → no hint, no penalty.
      if (adsAvailable() && !isPremium && used >= getMonetizationConfig().freeHintThreshold) {
        const r = await showRewardedAd();
        if (r !== "rewarded") return;
      }
      const hint = getHint(puzzle, found);
      if (!hint) return;
      const next = used + 1;
      hintsUsedRef.current = next;
      setHintsUsed(next);
      haptics.tap();
      sfx.tap();
      flash(
        hint.spangram ? `Hint · 🌟 spangram (-${HINT_PENALTY})` : `Hint · ${hint.word.length} letters (-${HINT_PENALTY})`,
        "idle",
      );
      // First hint lights only the first cell; later hints reveal the full path.
      const cells = next === 1 ? hint.path.slice(0, 1) : hint.path;
      setHintCells(new Set(cells.map(([r, c]) => cellKey(r, c))));
      if (hintTimer.current) clearTimeout(hintTimer.current);
      // Hold the highlight long enough to read, then clear (instant if reduced).
      hintTimer.current = setTimeout(() => setHintCells(new Set()), reducedMotion ? 1400 : 2200);
    } finally {
      hintInFlightRef.current = false;
    }
  }, [won, maxHints, puzzle, found, flash, reducedMotion, isPremium]);

  /** Resolve a completed selection path against the targets. */
  const resolvePath = useCallback(
    (sel: Cell[]) => {
      if (sel.length < 3) {
        setPath([]);
        return;
      }
      const word = readPath(puzzle.grid, sel);
      const reversed = word.split("").reverse().join("");
      const match = targets.find((w) => w === word || w === reversed);
      if (!match) {
        haptics.error();
        sfx.wrong();
        flash("Not a theme word.", "bad");
        if (!reducedMotion) {
          setShake(true);
          setTimeout(() => setShake(false), 450);
        }
        setPath([]);
        return;
      }
      if (found.includes(match)) {
        flash(`Already found ${match}.`, "idle");
        setPath([]);
        return;
      }
      const isSpan = match === puzzle.spangram;
      // The spangram is the marquee find: give it a stronger, distinct cue.
      if (isSpan) {
        haptics.win();
        sfx.win();
      } else {
        haptics.success();
        sfx.correct();
      }
      flash(isSpan ? `🌟 Spangram — ${match}` : `✓ ${match}`, isSpan ? "span" : "good");
      triggerPop(match);
      if (hintCells.size > 0) {
        if (hintTimer.current) clearTimeout(hintTimer.current);
        setHintCells(new Set());
      }
      const next = [...found, match];
      setFound(next);
      setPath([]);
      if (next.length === total) finish(next);
    },
    [puzzle, targets, found, total, flash, finish, reducedMotion, triggerPop, hintCells],
  );

  /** Extend / start / submit the selection by activating a cell. */
  /** True once a drag has crossed cells, so the trailing click is ignored. */
  const suppressClick = useRef(false);

  const activate = useCallback(
    (r: number, c: number) => {
      if (won) return;
      // Ignore the synthetic click that follows a completed drag (consume once).
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      setCursor([r, c]);
      const cell: Cell = [r, c];
      const key = cellKey(r, c);
      // Cell already in a found word: ignore.
      if (cellColor.has(key)) {
        sfx.tap();
        return;
      }
      setPath((prev) => {
        if (prev.length === 0) {
          sfx.tap();
          haptics.tap();
          return [cell];
        }
        const last = prev[prev.length - 1];
        // Tapping the last cell again submits the current path.
        if (last[0] === r && last[1] === c) {
          queueMicrotask(() => resolvePath(prev));
          return prev;
        }
        // Tapping a cell already in the path: trim back to it.
        const existing = prev.findIndex(([pr, pc]) => pr === r && pc === c);
        if (existing >= 0) {
          sfx.tap();
          return prev.slice(0, existing + 1);
        }
        // Extend only to an adjacent free cell.
        if (adjacent(last, cell) && !pathSet.has(key)) {
          sfx.tap();
          haptics.tap();
          return [...prev, cell];
        }
        // Otherwise restart a new selection here.
        sfx.tap();
        return [cell];
      });
    },
    [won, cellColor, pathSet, resolvePath],
  );

  const submit = useCallback(() => {
    if (path.length >= 3) resolvePath(path);
    else setPath([]);
  }, [path, resolvePath]);

  // ---- Pointer drag-to-select (NYT-Strands-style) -------------------------
  // Coexists with tap-tap: a press+release without crossing into another cell
  // falls through to the click handler (tap mode); any drag across cells builds
  // and submits a traced path on release.
  const boardRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const lastDragCell = useRef<Cell | null>(null);

  /** Resolve which grid cell (if any) sits under a viewport point. */
  const cellFromPoint = useCallback((clientX: number, clientY: number): Cell | null => {
    const board = boardRef.current;
    if (!board) return null;
    const el = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-cell]");
    if (!el || !board.contains(el)) return null;
    const r = Number(el.dataset.row);
    const c = Number(el.dataset.col);
    if (Number.isNaN(r) || Number.isNaN(c)) return null;
    return [r, c];
  }, []);

  /** Extend the in-progress drag path toward a cell, honouring adjacency/reuse. */
  const dragTo = useCallback(
    (r: number, c: number) => {
      const key = cellKey(r, c);
      if (cellColor.has(key)) return; // can't drag through found-word cells
      const cell: Cell = [r, c];
      setCursor(cell);
      setPath((prev) => {
        if (prev.length === 0) return [cell];
        const last = prev[prev.length - 1];
        if (last[0] === r && last[1] === c) return prev; // same cell, no-op
        // Backtrack: dragging back onto an earlier cell trims to it.
        const existing = prev.findIndex(([pr, pc]) => pr === r && pc === c);
        if (existing >= 0) {
          if (existing === prev.length - 1) return prev;
          haptics.tap();
          return prev.slice(0, existing + 1);
        }
        // Extend only to an adjacent, unused cell.
        if (adjacent(last, cell)) {
          sfx.tap();
          haptics.tap();
          return [...prev, cell];
        }
        return prev; // non-adjacent jump: ignore (keep tracing from last cell)
      });
    },
    [cellColor],
  );

  /** Cell where the current press started (drag origin), or null when idle. */
  const dragStart = useRef<Cell | null>(null);

  const onCellPointerDown = useCallback(
    (e: ReactPointerEvent, r: number, c: number) => {
      if (won) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const key = cellKey(r, c);
      if (cellColor.has(key)) return; // found-word cell: leave to tap handler
      // Arm a potential drag. We do NOT mutate the path yet so that an
      // in-progress tap-tap selection survives; the click handler still runs
      // for a pure press. The path is seeded lazily on the first cell crossing.
      dragging.current = true;
      suppressClick.current = false;
      dragStart.current = [r, c];
      lastDragCell.current = [r, c];
    },
    [won, cellColor],
  );

  // Global pointermove/up while a drag is active (pointer may leave the cell).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (!cell) return;
      const last = lastDragCell.current;
      if (last && last[0] === cell[0] && last[1] === cell[1]) return;
      // Crossing into a *new* cell means this is a drag, not a tap.
      if (!suppressClick.current) {
        // First crossing: commit to drag mode and seed the trace from the
        // origin cell (replacing any tap-tap selection in progress).
        suppressClick.current = true;
        const start = dragStart.current;
        if (start) {
          setPath([start]);
          setCursor(start);
          sfx.tap();
          haptics.tap();
        }
      }
      lastDragCell.current = cell;
      dragTo(cell[0], cell[1]);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      const dragged = suppressClick.current;
      dragStart.current = null;
      lastDragCell.current = null;
      if (dragged) {
        // Submit the traced path; resolvePath handles too-short selections.
        setPath((prev) => {
          if (prev.length >= 3) queueMicrotask(() => resolvePath(prev));
          else queueMicrotask(() => setPath([]));
          return prev;
        });
        // suppressClick stays true so the trailing click is ignored; it is
        // reset on the next pointerdown.
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [cellFromPoint, dragTo, resolvePath]);

  const clear = useCallback(() => {
    if (path.length === 0) return;
    sfx.tap();
    setPath([]);
  }, [path.length]);

  const move = useCallback((dr: number, dc: number) => {
    setCursor(([r, c]) => {
      const nr = (r + dr + ROWS) % ROWS;
      const nc = (c + dc + COLS) % COLS;
      return [nr, nc];
    });
  }, []);

  // Keyboard support: arrows move cursor, Enter activates, Esc clears.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won) return;
      if (e.key === "ArrowUp") (move(-1, 0), e.preventDefault());
      else if (e.key === "ArrowDown") (move(1, 0), e.preventDefault());
      else if (e.key === "ArrowLeft") (move(0, -1), e.preventDefault());
      else if (e.key === "ArrowRight") (move(0, 1), e.preventDefault());
      else if (e.key === "Enter" || e.key === " ") {
        activate(cursor[0], cursor[1]);
        e.preventDefault();
      } else if (e.key === "Backspace") {
        setPath((p) => p.slice(0, -1));
        e.preventDefault();
      } else if (e.key === "Escape") setPath([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [won, move, activate, cursor]);

  const validPath = path.length >= 3 && isConnectedPath(path);
  // The letters spelled by the in-progress selection, for the SR live region.
  const spelled = useMemo(
    () => (path.length > 0 ? readPath(puzzle.grid, path) : ""),
    [path, puzzle.grid],
  );
  const liveStatus =
    msgTone !== "idle"
      ? message
      : spelled
        ? `Spelling: ${spelled.split("").join(" ")}`
        : `${found.length} of ${total} found.`;

  // Connector segments for found words (one polyline per word) + the live path.
  const foundSegments = useMemo(
    () =>
      found.map((w) => ({
        word: w,
        color: colorFor(w),
        pts: (puzzle.placements[w]?.path ?? []).map(([r, c]) => cellCenter(r, c)),
      })),
    [found, puzzle, colorFor],
  );
  const livePoints = useMemo(() => path.map(([r, c]) => cellCenter(r, c)), [path]);

  const msgColor =
    msgTone === "bad"
      ? "#ff8aa8"
      : msgTone === "span"
        ? SPANGRAM_COLOR
        : msgTone === "good"
          ? "#9bf7d3"
          : ACCENT.soft;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center" style={{ ["--strands-w" as string]: "min(92vw, 360px)" }}>
      {/* theme eyebrow */}
      <div className="mb-1.5 shrink-0 text-center" style={{ width: "var(--strands-w)" }}>
        <div
          className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
          style={{ color: ACCENT.soft }}
        >
          Theme · {puzzle.theme}
        </div>
        {/* Be explicit that the tier difference here is hint generosity — the
            grid/words are the same — so the choice isn't misleading (MECH). */}
        <div className="mt-0.5 font-mono text-[9.5px] tracking-[0.08em] text-ink-faint">
          {maxHints === 0
            ? "No hints on this tier"
            : `${maxHints} hint${maxHints === 1 ? "" : "s"} available`}
        </div>
      </div>

      {/* progress + timer row */}
      <div
        className="mb-2 flex shrink-0 items-center justify-between font-mono text-[12px]"
        style={{ width: "var(--strands-w)" }}
      >
        <span style={{ color: ACCENT.soft }}>
          {found.length} / {total} found
          {spangramFound && <span style={{ color: SPANGRAM_COLOR }}> · spangram ✓</span>}
        </span>
        {/* When the host owns the timer it renders a unified clock; hide our own
            chip to avoid a duplicate (timing logic stays live for result.timeMs). */}
        {!hostTimer && (
          <span className="tabular-nums text-ink-mute">{formatClock(clock.ms)}</span>
        )}
      </div>

      {/* progress bar */}
      <div
        className="mb-3 h-1.5 shrink-0 overflow-hidden rounded-pill"
        style={{ width: "var(--strands-w)", background: "rgba(255,255,255,0.07)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={found.length}
        aria-label="Words found"
      >
        <div
          className={cn("h-full rounded-pill", !reducedMotion && "transition-[width] duration-500 ease-out")}
          style={{
            width: `${(found.length / total) * 100}%`,
            backgroundImage: `linear-gradient(90deg, ${ACCENT.from}, ${ACCENT.to})`,
            boxShadow: `0 0 10px ${ACCENT.solid}66`,
          }}
        />
      </div>

      {/* board region — flexes to the height left between the fixed chrome and
          controls; the board is sized by aspect ratio so it fits both width and
          height (no page scroll on phones). */}
      <div ref={boardFitRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
      {/* grid + connector overlay */}
      <div
        className={cn(
          "relative",
          shake && !reducedMotion && "animate-shake",
          boardWin && !reducedMotion && "animate-solve",
        )}
        style={{ width: boardSize?.w, height: boardSize?.h }}
      >
        {/* SVG connector lines behind the cells */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {foundSegments.map((seg) => {
            if (seg.pts.length < 2) return null;
            const isSpan = seg.word === puzzle.spangram;
            return (
              <polyline
                key={seg.word}
                points={seg.pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={seg.color}
                // The spangram gets a stronger, more luminous trail to mark it
                // as the puzzle's marquee thread.
                strokeOpacity={isSpan ? 0.85 : 0.55}
                strokeWidth={isSpan ? 3.6 : 2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={isSpan ? { filter: `drop-shadow(0 0 4px ${seg.color})` } : undefined}
              />
            );
          })}
          {livePoints.length >= 2 && (
            <polyline
              points={livePoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={ACCENT.soft}
              strokeOpacity={0.85}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        <div
          ref={boardRef}
          className="relative grid h-full w-full touch-none gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          }}
          role="grid"
          aria-label={`${COLS} by ${ROWS} letter grid. Tap connected letters or drag across them to spell theme words.`}
        >
          {Array.from({ length: CELLS }, (_, i) => {
            const r = Math.floor(i / COLS);
            const c = i % COLS;
            const key = cellKey(r, c);
            const letter = puzzle.grid[r][c];
            const fill = cellColor.get(key);
            const inPath = pathSet.has(key);
            const isStart = path.length > 0 && path[0][0] === r && path[0][1] === c;
            const isCursor = cursor[0] === r && cursor[1] === c;
            const isSpangramCell = fill === SPANGRAM_COLOR;
            const isHinted = !fill && hintCells.has(key);
            const isPopping = Boolean(
              !reducedMotion &&
                popWord != null &&
                puzzle.placements[popWord]?.path.some(([pr, pc]) => pr === r && pc === c),
            );

            let bg = "rgba(255,255,255,0.05)";
            let color = "#dfe9ff";
            let shadow = "none";
            let border = "1px solid rgba(255,255,255,0.07)";
            if (fill) {
              bg = fill;
              color = "#04060f";
              shadow = isSpangramCell ? `0 0 14px ${fill}` : `0 0 10px ${fill}88`;
              border = isSpangramCell ? `1px solid ${fill}` : "1px solid transparent";
            } else if (inPath) {
              bg = ACCENT.soft;
              color = "#04060f";
              shadow = isStart ? `0 0 14px ${ACCENT.soft}` : `0 0 8px ${ACCENT.soft}88`;
              border = "1px solid transparent";
            } else if (isHinted) {
              bg = `${ACCENT.solid}26`;
              color = "#eaf1ff";
              shadow = `0 0 12px ${ACCENT.solid}99`;
              border = `1px solid ${ACCENT.soft}`;
            }

            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                data-cell=""
                data-row={r}
                data-col={c}
                aria-label={`${letter}, row ${r + 1}, column ${c + 1}${fill ? (isSpangramCell ? ", spangram" : ", found") : inPath ? ", selected" : ""}`}
                aria-selected={inPath}
                onPointerDown={(e) => onCellPointerDown(e, r, c)}
                onClick={() => activate(r, c)}
                className={cn(
                  "relative z-[1] flex h-full w-full select-none items-center justify-center rounded-[10px] font-display font-semibold outline-none transition-[background,box-shadow,transform,border-color] duration-150",
                  !reducedMotion && "active:scale-90",
                  isPopping && "animate-pop",
                  isHinted && !reducedMotion && "animate-pulse",
                  "focus-visible:ring-2 focus-visible:ring-white/70",
                  isCursor && !inPath && !fill && "ring-2 ring-white/40",
                )}
                style={{
                  background: bg,
                  color,
                  boxShadow: shadow,
                  border,
                  fontSize: "clamp(15px, 4.4vw, 22px)",
                }}
              >
                {letter}
                {/* Non-colour cue: a star marker uniquely flags spangram cells
                    so they're distinguishable from theme words without relying
                    on hue alone (a11y). */}
                {isSpangramCell && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0.5 top-0.5 text-[8px] leading-none"
                    style={{ color: "#04060f" }}
                  >
                    ★
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      </div>

      {/* live feedback message */}
      <div
        className={cn(
          "mt-3 flex min-h-[20px] shrink-0 items-center justify-center text-center font-mono text-[12px]",
          !reducedMotion && "transition-colors duration-200",
        )}
        style={{ width: "var(--strands-w)", color: msgColor }}
      >
        {message}
      </div>

      {/* screen-reader live region (announces found words / progress) */}
      <div className="sr-only" aria-live="polite" role="status">
        {liveStatus}
      </div>

      {/* controls */}
      <div
        className="mt-3 flex shrink-0 items-center justify-center gap-3"
        style={{ width: "var(--strands-w)" }}
      >
        {won ? (
          // Solved: the play controls are inert. Offer a clear way back to the
          // results summary instead of leaving a frozen, all-disabled row.
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className={cn(
              "w-full rounded-pill px-7 py-2.5 font-display text-[13.5px] font-semibold text-[#04060f] outline-none transition-transform",
              !reducedMotion && "active:scale-95",
              "focus-visible:ring-2 focus-visible:ring-white/80",
            )}
            style={{
              backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
              minHeight: 44,
            }}
          >
            View results
          </button>
        ) : (
        <>
        <button
          type="button"
          onClick={clear}
          disabled={path.length === 0 || won}
          className={cn(
            "rounded-pill border border-line-strong px-5 py-2.5 font-display text-[13.5px] text-[#eaf1ff] outline-none transition-[opacity,transform,background] disabled:opacity-40",
            !reducedMotion && "active:scale-95",
            "focus-visible:ring-2 focus-visible:ring-white/50",
          )}
          style={{ background: "rgba(255,255,255,0.04)", minHeight: 44 }}
        >
          Clear
        </button>
        {/* Hard tier offers no hints (maxHints === 0): omit the button entirely. */}
        {maxHints > 0 && (
          <span className="relative inline-flex">
            {nudgeHint && !reducedMotion && (
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-1 rounded-pill animate-pulse2"
                style={{ boxShadow: `0 0 0 2px ${ACCENT.solid}55` }}
              />
            )}
            <HintButton
              used={hintsUsed}
              max={maxHints}
              onHint={useHint}
              accent={ACCENT}
              disabled={won || remaining <= 0}
            />
          </span>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!validPath || won}
          className={cn(
            "rounded-pill px-7 py-2.5 font-display text-[13.5px] font-semibold text-[#04060f] outline-none transition-[opacity,transform,box-shadow] disabled:opacity-40",
            !reducedMotion && "active:scale-95",
            "focus-visible:ring-2 focus-visible:ring-white/80",
          )}
          style={{
            backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
            boxShadow: validPath && !won ? `0 6px 22px ${ACCENT.solid}3a` : "none",
            minHeight: 44,
          }}
        >
          Submit
        </button>
        </>
        )}
      </div>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        title="Every strand found."
        statValue={formatClock(finalMs ?? clock.ms)}
        statLabel="SOLVE TIME"
        insight={puzzle.insight}
        extra={
          <div className="flex flex-col items-center gap-3">
            <div className="font-mono text-[12px] text-ink-mute">
              Theme · {puzzle.theme} · {puzzle.words.length} words + spangram
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {[puzzle.spangram, ...puzzle.words].map((w) => {
                const isSpan = w === puzzle.spangram;
                const color = colorFor(w);
                return (
                  <span
                    key={w}
                    className="rounded-pill px-2.5 py-1 font-mono text-[10.5px] font-semibold tracking-[0.04em]"
                    style={{
                      background: `${color}22`,
                      color,
                      border: `1px solid ${color}55`,
                    }}
                  >
                    {isSpan ? `🌟 ${w}` : w}
                  </span>
                );
              })}
            </div>
            <div className="font-mono text-[10.5px] tracking-[0.04em] text-ink-faint">
              A fresh theme unlocks tomorrow — come back to keep your streak.
            </div>
          </div>
        }
        share={`BrainTap · Mind Strands\nTheme: ${puzzle.theme}\n${puzzle.words.length}/${puzzle.words.length} + spangram 🌟\nin ${formatClock(finalMs ?? clock.ms)}\n\nbraintap.app`}
      />
    </div>
  );
}
