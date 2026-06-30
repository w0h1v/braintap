"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { useFitBox } from "@/lib/useFitBox";
import { cn } from "@/lib/cn";
import {
  CELLS,
  SIZE,
  cellsFor,
  isComplete,
  isCorrectTap,
  scoreForTime,
  starsForTime,
  titleForTime,
  type SchultePuzzle,
} from "./engine";

const ACCENT = GAME_METAS.schulte.accent;
const INSIGHT = GAME_METAS.schulte.insight;

// Mint feedback for found cells (warmer than the cyan accent so progress reads).
const TAPPED_BG = "rgba(124,245,196,0.22)";
const TAPPED_FG = "rgba(124,245,196,0.92)";
const TAPPED_BORDER = "rgba(124,245,196,0.45)";

// Board width is size-aware so even the 7×7 board keeps >=44px tap targets at a
// 360px viewport. The 7×7 grid uses nearly the full width and a tighter gap.
function boardMaxFor(size: number): string {
  return size >= 7 ? "min(98vw, 420px)" : "min(92vw, 380px)";
}
// Inter-cell gap in px. Tighter for the dense 7×7 so cells stay >=44px wide.
function gapPxFor(size: number): number {
  return size >= 7 ? 4 : 6;
}
// Board padding in px (mirrors the gap so the visual rhythm holds).
function padPxFor(size: number): number {
  return size >= 7 ? 4 : 6;
}

interface SchulteState {
  /** Best (lowest) clear time in ms across sessions, if any. */
  bestMs: number | null;
  /** Whether the player has completed at least one table today. */
  playedToday: boolean;
  /** Last-played grid size (3/5/7), driven by difficulty. */
  size?: number;
  /** Best clear time per grid size, keyed by size. */
  bestBySize?: Partial<Record<number, number>>;
}

/** Local (non-seeded) Fisher-Yates shuffle for replays. */
function localShuffle(arr: number[]): number[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function formatSecs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

const shareLine = (ms: number, size: number) =>
  `BrainTap · Schulte Table\nFull ${size}×${size} in ${formatSecs(ms)}\n\n👁️ focus + scan\nbraintap.app`;

export function Schulte({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion = false,
}: GameComponentProps<SchultePuzzle, SchulteState>) {
  const saved = savedState ?? null;

  // Size is driven by the difficulty the host selects, via the puzzle it passes.
  const size = puzzle.size;
  // The high number for the active grid (size²).
  const max = cellsFor(size);
  // Size-aware layout so the dense 7×7 keeps >=44px tap targets at 360px.
  const boardMax = boardMaxFor(size);
  const gapPx = gapPxFor(size);
  const padPx = padPxFor(size);
  // Size the square board to the height left between fixed chrome and controls so
  // board + stats + button fit the viewport on phones (no page scroll). The grid
  // is square (size × size); cap at the 7×7 desktop max of 420px.
  const { ref: fitRef, size: boardSize } = useFitBox<HTMLDivElement>(size, size, 420);

  // The active grid layout: the deterministic daily grid for this difficulty on
  // first load; a fresh local shuffle on each "Play again".
  const [grid, setGrid] = useState<number[]>(() => puzzle.grid.slice());

  // The next number the player must tap (1..max). Idle until the table starts.
  const [next, setNext] = useState(1);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [message, setMessage] = useState<string>("");
  const [shakeCell, setShakeCell] = useState<number | null>(null);
  const [popCell, setPopCell] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [lastMs, setLastMs] = useState(0);
  // The best for this size *before* the just-finished clear, so the modal can
  // say "beat 18.2s" on a new best.
  const [priorBestMs, setPriorBestMs] = useState<number | null>(null);
  const [completedAnyThisMount, setCompletedAnyThisMount] = useState(false);

  // Per-size best times (restored from save; back-compat with flat bestMs).
  const [bestBySize, setBestBySize] = useState<Partial<Record<number, number>>>(
    () => {
      const fromSaved = saved?.bestBySize ? { ...saved.bestBySize } : {};
      if (saved?.bestMs != null && fromSaved[SIZE] == null) {
        fromSaved[SIZE] = saved.bestMs;
      }
      return fromSaved;
    },
  );
  const bestForSize = bestBySize[size] ?? null;

  // When the host switches difficulty, the puzzle (and its size) changes. Reset
  // the in-progress table to the new deterministic daily grid.
  const puzzleSig = `${size}:${puzzle.grid.join(",")}`;
  const lastPuzzleSigRef = useRef(puzzleSig);

  const playedTodayRef = useRef<boolean>(saved?.playedToday ?? false);
  const onCompleteFiredRef = useRef(false);
  const t0Ref = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The start/play-again button — focus returns here when a run ends so the
  // keyboard user is never stranded on a disabled cell.
  const startBtnRef = useRef<HTMLButtonElement | null>(null);
  // The current next-to-find cell (roving tabindex target) — focused on start
  // so arrow/tab keys land on a live cell.
  const rovingRef = useRef<HTMLButtonElement | null>(null);

  const persist = useCallback(
    (bests: Partial<Record<number, number>>, activeSize: number) => {
      onPersistState?.({
        bestMs: bests[SIZE] ?? null,
        playedToday: playedTodayRef.current,
        size: activeSize,
        bestBySize: bests,
      });
    },
    [onPersistState],
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
      if (modalTimerRef.current) clearTimeout(modalTimerRef.current);
    };
  }, []);

  // React to a difficulty/size switch from the host: reset to the new grid.
  useEffect(() => {
    if (lastPuzzleSigRef.current === puzzleSig) return;
    lastPuzzleSigRef.current = puzzleSig;
    stopTimer();
    setGrid(puzzle.grid.slice());
    setNext(1);
    setRunning(false);
    setElapsedMs(0);
    setMessage("");
    setCompletedAnyThisMount(false);
    setShowModal(false);
  }, [puzzleSig, puzzle.grid, stopTimer]);

  const flash = useCallback((text: string) => {
    setMessage(text);
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => setMessage(""), 1100);
  }, []);

  const start = useCallback(
    (reshuffle: boolean) => {
      if (reshuffle) setGrid((g) => localShuffle(g));
      setNext(1);
      setRunning(true);
      setElapsedMs(0);
      flash(`Find 1 → ${cellsFor(size)} in order`);
      t0Ref.current = Date.now();
      stopTimer();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - t0Ref.current);
      }, 100);
      sfx.tap();
      haptics.tap();
    },
    [flash, stopTimer, size],
  );

  const finish = useCallback(() => {
    stopTimer();
    const timeMs = Date.now() - t0Ref.current;
    setElapsedMs(timeMs);
    setLastMs(timeMs);
    setRunning(false);
    setMessage("");
    haptics.win();
    sfx.win();

    const prevBest = bestBySize[size] ?? null;
    setPriorBestMs(prevBest);
    const isBest = prevBest == null || timeMs < prevBest;
    const nextBests: Partial<Record<number, number>> = { ...bestBySize };
    if (isBest) nextBests[size] = timeMs;
    setBestBySize(nextBests);
    playedTodayRef.current = true;
    persist(nextBests, size);

    setCompletedAnyThisMount(true);
    if (modalTimerRef.current) clearTimeout(modalTimerRef.current);
    modalTimerRef.current = setTimeout(
      () => setShowModal(true),
      reducedMotion ? 0 : 520,
    );

    // Fire onComplete once for the first clear of this table. The host scores
    // the active difficulty's clear; subsequent replays are practice.
    if (!onCompleteFiredRef.current) {
      onCompleteFiredRef.current = true;
      onComplete({
        status: "won",
        score: scoreForTime(timeMs, size),
        timeMs,
        stars: starsForTime(timeMs, size),
        shareText: shareLine(timeMs, size),
        detail: { bestMs: nextBests[size] ?? timeMs, size },
      });
    }
  }, [bestBySize, onComplete, persist, reducedMotion, stopTimer, size]);

  const tap = useCallback(
    (cell: number) => {
      if (!running) return;
      const value = grid[cell];
      if (value < next) return; // already-found cell; ignore (rapid double-tap guard)
      if (isCorrectTap(value, next)) {
        sfx.correct();
        haptics.success();
        if (!reducedMotion) {
          setPopCell(cell);
          if (popTimerRef.current) clearTimeout(popTimerRef.current);
          popTimerRef.current = setTimeout(() => setPopCell(null), 260);
        }
        const nv = next + 1;
        setNext(nv);
        if (isComplete(nv, max)) {
          finish();
        }
      } else {
        sfx.wrong();
        haptics.error();
        flash(`Tap ${next} next`);
        if (!reducedMotion) {
          setShakeCell(cell);
          if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
          shakeTimerRef.current = setTimeout(() => setShakeCell(null), 480);
        }
      }
    },
    [running, grid, next, finish, flash, reducedMotion, max],
  );

  // Tap the cell holding `value` (used by the keyboard play path). Maps the
  // value back to its grid index and reuses the same tap logic as a touch.
  const tapByValue = useCallback(
    (value: number) => {
      const cell = grid.indexOf(value);
      if (cell !== -1) tap(cell);
    },
    [grid, tap],
  );

  const abandon = useCallback(() => {
    stopTimer();
    setRunning(false);
    setNext(1);
    setElapsedMs(0);
    setMessage("");
    // Return focus to the start/play-again button (re-rendered when !running).
    requestAnimationFrame(() => startBtnRef.current?.focus());
  }, [stopTimer]);

  // Keyboard play path. While a table is running:
  //  - typing the digits of the next number (e.g. "1" then "2" for 12) advances
  //  - a buffer resets after a short pause or on a non-matching key
  //  - Escape abandons the run
  // Enter/Space on the start button stays native (it is a real <button>).
  const digitBufRef = useRef("");
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && running) {
        abandon();
        return;
      }
      if (!running) return;
      if (e.key < "0" || e.key > "9") return;
      // Ignore typing while focus is in an editable field (defensive).
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const buf = (digitBufRef.current + e.key).slice(-String(max).length);
      digitBufRef.current = buf;
      if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
      digitTimerRef.current = setTimeout(() => (digitBufRef.current = ""), 900);

      // Try the longest matching suffix first so "12" beats "2".
      for (let len = buf.length; len >= 1; len--) {
        const candidate = Number(buf.slice(buf.length - len));
        if (candidate === next) {
          tapByValue(candidate);
          digitBufRef.current = "";
          if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
          e.preventDefault();
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
    };
  }, [running, abandon, next, max, tapByValue]);

  // Focus management: when the run starts, move focus onto the live grid (the
  // roving next-to-find cell) so keyboard/SR users land on a playable target.
  useEffect(() => {
    if (running) requestAnimationFrame(() => rovingRef.current?.focus());
  }, [running]);

  // When a run ends (finish), return focus to the start/play-again button.
  useEffect(() => {
    if (!running && completedAnyThisMount) {
      requestAnimationFrame(() => startBtnRef.current?.focus());
    }
  }, [running, completedAnyThisMount]);

  const startLabel = completedAnyThisMount ? "Play again" : "Start table";
  const displayMs = running ? elapsedMs : completedAnyThisMount ? lastMs : 0;
  const found = running ? next - 1 : completedAnyThisMount && !running ? max : 0;
  const progress = found / max;

  // Live "vs best" delta during a run: positive = behind your best, negative =
  // ahead. Only meaningful once a clear exists for this size.
  const vsBestMs =
    running && bestForSize != null ? displayMs - bestForSize : null;

  // Whether the just-finished clear set a new best for this size (first clear
  // counts as a best). Only meaningful once a run has completed.
  const isNewBest =
    completedAnyThisMount &&
    !running &&
    (priorBestMs == null || lastMs < priorBestMs);

  // Screen-reader live status — the single authoritative live region. Folds the
  // error/next-number prompt in so it is announced once, not by two regions.
  const statusText = running
    ? message.startsWith("Tap")
      ? message
      : `${found} of ${max} found. Find ${Math.min(next, max)} next.`
    : completedAnyThisMount
      ? `Table cleared in ${formatSecs(lastMs)}.${isNewBest ? " New best!" : ""}`
      : "Press start to begin.";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center">
      <span className="sr-only" aria-live="polite" role="status">
        {statusText}
      </span>

      {/* stat boxes */}
      <div
        className={cn(
          "mb-3 flex w-full shrink-0 items-stretch justify-center gap-3",
          !reducedMotion && "animate-rise",
        )}
        style={{ maxWidth: boardMax }}
      >
        <div
          className="relative flex flex-1 flex-col items-center overflow-hidden rounded-2xl border px-4 py-2.5"
          style={{
            background: `${ACCENT.solid}12`,
            borderColor: `${ACCENT.solid}40`,
          }}
        >
          <div
            className="font-display text-[26px] font-semibold leading-none tabular-nums"
            style={{ color: "#eafcff" }}
          >
            {Math.min(next, max)}
          </div>
          <div
            className="mt-1.5 font-mono text-[9.5px] tracking-[0.14em]"
            style={{ color: ACCENT.soft }}
          >
            FIND NEXT
          </div>
        </div>
        {/* Schulte owns its clock (hostTimer is suppressed in index.ts), so the
            live deci-second timer always lives here, next to the board, where
            the player is looking. A live "vs best" delta builds in-run tension. */}
        <div
          className="flex flex-1 flex-col items-center rounded-2xl border px-4 py-2.5"
          style={{
            background: isNewBest ? `${ACCENT.solid}1f` : "rgba(255,255,255,0.04)",
            borderColor: isNewBest ? `${ACCENT.solid}66` : "rgba(255,255,255,0.1)",
          }}
        >
          <div
            className="font-display text-[26px] font-semibold leading-none tabular-nums"
            style={{ color: isNewBest ? ACCENT.solid : "#ffb020" }}
          >
            {formatSecs(displayMs)}
          </div>
          <div className="mt-1.5 font-mono text-[9.5px] tracking-[0.14em] text-[rgba(226,234,255,0.45)]">
            {isNewBest ? (
              <span style={{ color: ACCENT.solid }}>★ NEW BEST</span>
            ) : running && vsBestMs != null ? (
              <span
                style={{ color: vsBestMs <= 0 ? TAPPED_FG : "rgba(255,155,182,0.92)" }}
              >
                {vsBestMs <= 0
                  ? `−${formatSecs(-vsBestMs)} VS BEST`
                  : `+${formatSecs(vsBestMs)} VS BEST`}
              </span>
            ) : bestForSize != null ? (
              `BEST ${formatSecs(bestForSize)}`
            ) : (
              "TIME"
            )}
          </div>
        </div>
      </div>

      {/* progress bar */}
      <div
        className="mb-2 h-1 w-full shrink-0 overflow-hidden rounded-pill bg-white/[0.06]"
        style={{ maxWidth: boardMax }}
        role="presentation"
        aria-hidden
      >
        <div
          className={cn("h-full rounded-pill", !reducedMotion && "transition-[width] duration-200")}
          style={{
            width: `${progress * 100}%`,
            backgroundImage: `linear-gradient(90deg, ${ACCENT.from}, ${ACCENT.to})`,
          }}
        />
      </div>

      {/* message — visual only; the sr-only status above is the single
          authoritative live region, so this is hidden from assistive tech to
          avoid two regions talking over each other. */}
      <div
        className="flex min-h-[20px] shrink-0 items-center justify-center text-center font-mono text-[12.5px]"
        style={{ color: message.startsWith("Tap") ? "#ff9bb6" : ACCENT.soft }}
        aria-hidden
      >
        {message}
      </div>

      {/* grid — flexes to the height left between the fixed stats/controls and is
          sized as a square by useFitBox so the whole game fits the viewport. */}
      <div ref={fitRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
      <div
        className="relative mt-2"
        style={{ width: boardSize?.w, height: boardSize?.h }}
      >
        <div
          className="grid h-full w-full rounded-2xl border"
          role="grid"
          aria-label={`Schulte table, find numbers 1 to ${max} in order`}
          style={{
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
            gap: gapPx,
            padding: padPx,
            borderColor: `${ACCENT.solid}33`,
            background: `${ACCENT.solid}14`,
            boxShadow: running
              ? `0 18px 50px -22px ${ACCENT.solid}66, inset 0 0 50px -34px ${ACCENT.solid}`
              : "0 18px 50px -28px rgba(0,0,0,0.6)",
          }}
        >
          {grid.map((value, cell) => {
            const isFound = running && value < next;
            const shaking = shakeCell === cell;
            const popping = popCell === cell;
            // Roving tabindex: while running, only the next-to-find cell is in
            // the tab order, so the grid is a single tab stop instead of 49.
            const isRovingTarget = running && value === next;
            return (
              <button
                key={cell}
                type="button"
                role="gridcell"
                ref={isRovingTarget ? rovingRef : undefined}
                tabIndex={running ? (isRovingTarget ? 0 : -1) : 0}
                onClick={() => tap(cell)}
                disabled={!running}
                aria-label={`Number ${value}${isFound ? ", found" : ""}`}
                className={cn(
                  "flex min-h-0 min-w-0 select-none touch-manipulation items-center justify-center rounded-[10px] font-display font-semibold outline-none",
                  "focus-visible:ring-2 focus-visible:ring-offset-0",
                  !reducedMotion &&
                    "transition-[background-color,transform,color,box-shadow] duration-150 active:scale-95",
                  shaking && !reducedMotion && "animate-shake",
                  popping && !reducedMotion && "animate-pop",
                  !running && "cursor-default",
                )}
                style={{
                  fontSize:
                    size <= 3
                      ? "clamp(20px, 7vw, 30px)"
                      : size >= 7
                        ? "clamp(13px, 4vw, 18px)"
                        : "clamp(16px, 5.4vw, 22px)",
                  background: isFound ? TAPPED_BG : `${ACCENT.solid}12`,
                  color: isFound ? TAPPED_FG : "#eafcff",
                  border: `1px solid ${isFound ? TAPPED_BORDER : `${ACCENT.solid}22`}`,
                  transform: isFound ? "scale(0.94)" : undefined,
                  ["--tw-ring-color" as string]: ACCENT.solid,
                }}
              >
                {value}
              </button>
            );
          })}
        </div>

        {/* pre-game / abandoned overlay with instructions */}
        {!running && !completedAnyThisMount && (
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center rounded-2xl px-6 text-center backdrop-blur-[3px]",
              !reducedMotion && "animate-pop",
            )}
            style={{ background: "rgba(4,6,15,0.78)" }}
          >
            <div
              className="font-mono text-[10px] tracking-[0.2em]"
              style={{ color: ACCENT.solid }}
            >
              ATTENTION · FOCUS
            </div>
            <h2 className="mt-2 font-display text-xl font-semibold text-ink">
              {`Find 1 → ${max}, fast.`}
            </h2>
            <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-[rgba(226,234,255,0.72)]">
              Tap the numbers in order. Keep your eyes on the centre and let your
              peripheral vision do the scanning.
            </p>
          </div>
        )}
      </div>
      </div>

      {/* start / play again + abandon */}
      {!running ? (
        <button
          ref={startBtnRef}
          type="button"
          onClick={() => start(completedAnyThisMount)}
          className={cn(
            "mt-4 shrink-0 rounded-[13px] px-9 py-3.5 font-display text-[15px] font-semibold outline-none",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            !reducedMotion && "transition-transform active:scale-[0.97]",
          )}
          style={{
            color: "#04060f",
            backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
            boxShadow: `0 10px 30px ${ACCENT.solid}38`,
            ["--tw-ring-color" as string]: ACCENT.solid,
          }}
        >
          {startLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={abandon}
          className={cn(
            "mt-4 min-h-[44px] shrink-0 rounded-pill border px-6 py-2.5 font-display text-[13px] text-[#eaf1ff] outline-none",
            !reducedMotion && "transition-colors active:scale-[0.98]",
          )}
          style={{ borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.04)" }}
          aria-label="Reset this table (or press Escape)"
        >
          Reset
        </button>
      )}

      {/* Surface the keyboard affordances so they are discoverable, not hidden. */}
      {running && (
        <p className="mt-2 shrink-0 text-center font-mono text-[10px] tracking-[0.12em] text-[rgba(226,234,255,0.4)]">
          TYPE THE NUMBER · ESC TO RESET
        </p>
      )}

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        eyebrow={isNewBest ? `★ NEW BEST · ${size}×${size}` : `${size}×${size} CLEARED`}
        title={isNewBest ? "New personal best!" : titleForTime(lastMs, size)}
        statValue={formatSecs(lastMs)}
        statLabel={
          isNewBest
            ? priorBestMs != null
              ? `BEAT ${formatSecs(priorBestMs)} · CLEAR TIME`
              : "FIRST CLEAR · CLEAR TIME"
            : priorBestMs != null
              ? `BEST ${formatSecs(priorBestMs)}`
              : "CLEAR TIME"
        }
        insight={INSIGHT}
        share={shareLine(lastMs, size)}
        onReplay={() => {
          setShowModal(false);
          start(true);
        }}
        replayLabel="Play again"
      />
    </div>
  );
}

// Reference CELLS/SIZE so they are part of the module surface and lint-clean.
void CELLS;
void SIZE;
