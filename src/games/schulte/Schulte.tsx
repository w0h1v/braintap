"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
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

const BOARD_MAX = "min(92vw, 380px)";

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
  hostTimer = false,
}: GameComponentProps<SchultePuzzle, SchulteState>) {
  const saved = savedState ?? null;

  // Size is driven by the difficulty the host selects, via the puzzle it passes.
  const size = puzzle.size;
  // The high number for the active grid (size²).
  const max = cellsFor(size);

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

  const abandon = useCallback(() => {
    stopTimer();
    setRunning(false);
    setNext(1);
    setElapsedMs(0);
    setMessage("");
  }, [stopTimer]);

  // Keyboard: Enter/Space on the start button is native; allow Escape to abandon.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && running) abandon();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, abandon]);

  const startLabel = completedAnyThisMount ? "Play again" : "Start table";
  const displayMs = running ? elapsedMs : completedAnyThisMount ? lastMs : 0;
  const found = running ? next - 1 : completedAnyThisMount && !running ? max : 0;
  const progress = found / max;

  // Screen-reader live status.
  const statusText = running
    ? `${found} of ${max} found. Find ${Math.min(next, max)} next.`
    : completedAnyThisMount
      ? `Table cleared in ${formatSecs(lastMs)}.`
      : "Press start to begin.";

  return (
    <div className="flex w-full flex-col items-center">
      <span className="sr-only" aria-live="polite" role="status">
        {statusText}
      </span>

      {/* stat boxes */}
      <div
        className={cn(
          "mb-3 flex w-full items-stretch justify-center gap-3",
          !reducedMotion && "animate-rise",
        )}
        style={{ maxWidth: BOARD_MAX }}
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
        {/* When the host owns the timer, show progress instead of a duplicate
            clock; otherwise show the internal timer + per-size best. */}
        {hostTimer ? (
          <div
            className="flex flex-1 flex-col items-center rounded-2xl border px-4 py-2.5"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}
          >
            <div
              className="font-display text-[26px] font-semibold leading-none tabular-nums"
              style={{ color: "#eafcff" }}
            >
              {found}
              <span className="text-[15px] text-[rgba(226,234,255,0.45)]">{`/${max}`}</span>
            </div>
            <div className="mt-1.5 font-mono text-[9.5px] tracking-[0.14em] text-[rgba(226,234,255,0.45)]">
              {bestForSize != null ? `BEST ${formatSecs(bestForSize)}` : "FOUND"}
            </div>
          </div>
        ) : (
          <div
            className="flex flex-1 flex-col items-center rounded-2xl border px-4 py-2.5"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}
          >
            <div
              className="font-display text-[26px] font-semibold leading-none tabular-nums"
              style={{ color: "#ffb020" }}
            >
              {formatSecs(displayMs)}
            </div>
            <div className="mt-1.5 font-mono text-[9.5px] tracking-[0.14em] text-[rgba(226,234,255,0.45)]">
              {bestForSize != null ? `BEST ${formatSecs(bestForSize)}` : "TIME"}
            </div>
          </div>
        )}
      </div>

      {/* progress bar */}
      <div
        className="mb-2 h-1 w-full overflow-hidden rounded-pill bg-white/[0.06]"
        style={{ maxWidth: BOARD_MAX }}
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

      {/* message */}
      <div
        className="flex min-h-[20px] items-center justify-center text-center font-mono text-[12.5px]"
        style={{ color: message.startsWith("Tap") ? "#ff9bb6" : ACCENT.soft }}
        aria-live="polite"
        role="status"
      >
        {message}
      </div>

      {/* grid */}
      <div className="relative mt-2 w-full" style={{ maxWidth: BOARD_MAX }}>
        <div
          className="grid gap-1.5 rounded-2xl border p-1.5"
          role="grid"
          aria-label={`Schulte table, find numbers 1 to ${max} in order`}
          style={{
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            borderColor: `${ACCENT.solid}33`,
            background: `${ACCENT.solid}0d`,
            boxShadow: running
              ? `0 18px 50px -22px ${ACCENT.solid}66, inset 0 0 50px -34px ${ACCENT.solid}`
              : "0 18px 50px -28px rgba(0,0,0,0.6)",
          }}
        >
          {grid.map((value, cell) => {
            const isFound = running && value < next;
            const shaking = shakeCell === cell;
            const popping = popCell === cell;
            return (
              <button
                key={cell}
                type="button"
                role="gridcell"
                onClick={() => tap(cell)}
                disabled={!running}
                aria-label={`Number ${value}${isFound ? ", found" : ""}`}
                className={cn(
                  "flex aspect-square select-none touch-manipulation items-center justify-center rounded-[10px] font-display font-semibold outline-none",
                  "focus-visible:ring-2 focus-visible:ring-offset-0",
                  !reducedMotion &&
                    "transition-[background-color,transform,color,box-shadow] duration-150 active:scale-95",
                  shaking && !reducedMotion && "animate-shake",
                  popping && !reducedMotion && "animate-pop",
                  !running && "cursor-default",
                )}
                style={{
                  minHeight: 44,
                  fontSize:
                    size <= 3
                      ? "clamp(20px, 7vw, 30px)"
                      : size >= 7
                        ? "clamp(13px, 4vw, 18px)"
                        : "clamp(16px, 5.4vw, 22px)",
                  background: isFound ? TAPPED_BG : "rgba(255,255,255,0.06)",
                  color: isFound ? TAPPED_FG : "#eafcff",
                  border: `1px solid ${isFound ? TAPPED_BORDER : "rgba(255,255,255,0.08)"}`,
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

      {/* start / play again + abandon */}
      {!running ? (
        <button
          type="button"
          onClick={() => start(completedAnyThisMount)}
          className={cn(
            "mt-5 rounded-[13px] px-9 py-3.5 font-display text-[15px] font-semibold outline-none",
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
            "mt-5 min-h-[44px] rounded-pill border px-6 py-2.5 font-display text-[13px] text-[#eaf1ff] outline-none",
            !reducedMotion && "transition-colors active:scale-[0.98]",
          )}
          style={{ borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.04)" }}
          aria-label="Abandon this table"
        >
          Reset
        </button>
      )}

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        eyebrow={`${size}×${size} CLEARED`}
        title={titleForTime(lastMs, size)}
        statValue={formatSecs(lastMs)}
        statLabel={
          (bestBySize[size] ?? null) != null &&
          (bestBySize[size] as number) < lastMs
            ? `BEST ${formatSecs(bestBySize[size] as number)}`
            : "NEW BEST · CLEAR TIME"
        }
        insight={INSIGHT}
        share={shareLine(lastMs, size)}
      />
    </div>
  );
}

// Reference CELLS/SIZE so they are part of the module surface and lint-clean.
void CELLS;
void SIZE;
