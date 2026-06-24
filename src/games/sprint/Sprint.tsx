"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { rngFromString } from "@/lib/rng";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import {
  CELLS,
  GRID_SIZE,
  DURATION_MS,
  DURATION_SEC,
  pickTarget,
  sumOf,
  scoreToNormalised,
  tierTitle,
  buildShareText,
  isWin,
  type SprintPuzzle,
} from "./engine";

const ACCENT = GAME_METAS.sprint.accent;
const INSIGHT = GAME_METAS.sprint.insight;

interface SprintState {
  /** Live grid digits. */
  grid: number[];
  /** Currently selected cell indices. */
  selected: number[];
  /** Current target sum. */
  target: number;
  /** Targets cleared so far. */
  score: number;
  /** How many targets have been issued (drives deterministic target stream). */
  issued: number;
  /** Pointer into the deterministic refill stream. */
  refillPtr: number;
  /** Milliseconds elapsed in the round. */
  elapsedMs: number;
  /** Phase of the round. */
  phase: "idle" | "playing" | "done";
}

/** Build the live target RNG for a given issue count (deterministic per replay). */
function targetRng(seed: number, issued: number) {
  return rngFromString(`sprint-target:${seed}:${issued}`);
}

export function Sprint({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
  hostTimer = false,
}: GameComponentProps<SprintPuzzle, SprintState>) {
  const saved = savedState ?? null;
  // A finished saved game starts back at idle so the player can replay.
  const resumable = saved && saved.phase === "playing";
  // Tier params drive the digit range, target sizes, and the win goal. Guard
  // against older puzzle shapes that lack params (treat as the medium default).
  const params = puzzle.params ?? { goal: 5, minTargetCells: 2, maxTargetCells: 3 };
  const goal = params.goal ?? 5;

  const [grid, setGrid] = useState<number[]>(
    () => (resumable ? saved!.grid.slice() : puzzle.grid.slice()),
  );
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(resumable ? saved!.selected : []),
  );
  const [target, setTarget] = useState<number>(
    () => (resumable ? saved!.target : puzzle.firstTarget),
  );
  const [score, setScore] = useState<number>(() => (resumable ? saved!.score : 0));
  const [issued, setIssued] = useState<number>(() => (resumable ? saved!.issued : 1));
  const [refillPtr, setRefillPtr] = useState<number>(() => (resumable ? saved!.refillPtr : 0));
  const [phase, setPhase] = useState<SprintState["phase"]>(() =>
    resumable ? "playing" : "idle",
  );
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    resumable ? Math.max(0, DURATION_MS - saved!.elapsedMs) : DURATION_MS,
  );

  const [flash, setFlash] = useState(false);
  const [shake, setShake] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [showModal, setShowModal] = useState(false);
  // Cells freshly refilled after a match — drives a brief pop animation.
  const [popping, setPopping] = useState<Set<number>>(() => new Set());
  // Floating "+1" badge keyed by a monotonically increasing id.
  const [scorePops, setScorePops] = useState<number[]>([]);
  // Screen-reader live status; kept as state so announcements actually fire.
  const [liveStatus, setLiveStatus] = useState("");

  const deadlineRef = useRef<number | null>(null);
  const refillRef = useRef(refillPtr);
  // Monotonic id for "+1" pops — Date.now() collides on same-ms scores (this is
  // a speed game) which produced duplicate React keys.
  const popId = useRef(0);
  const completedRef = useRef(false);
  const popTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Keep the refill pointer ref in sync (used inside callbacks without re-binding).
  useEffect(() => {
    refillRef.current = refillPtr;
  }, [refillPtr]);

  // Clean up any pending pop-clear timers on unmount.
  useEffect(
    () => () => {
      popTimers.current.forEach(clearTimeout);
    },
    [],
  );

  const selectedSum = useMemo(() => sumOf(grid, selected), [grid, selected]);
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const overshoot = selectedSum > target;
  const timeLow = remainingSec <= 10 && phase === "playing";
  const timeFrac = Math.max(0, Math.min(1, remainingMs / DURATION_MS));
  // How close the current selection is to the target (0–1), for the sum meter.
  const sumFrac = target > 0 ? Math.max(0, Math.min(1, selectedSum / target)) : 0;

  // ---- persistence -----------------------------------------------------------
  useEffect(() => {
    if (phase === "idle") return;
    onPersistState?.({
      grid,
      selected: [...selected],
      target,
      score,
      issued,
      refillPtr,
      elapsedMs: DURATION_MS - remainingMs,
      phase,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, selected, target, score, issued, refillPtr, phase]);

  // ---- timer -----------------------------------------------------------------
  const finish = useCallback(
    (finalScore: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setPhase("done");
      deadlineRef.current = null;
      const won = isWin(finalScore, puzzle.params);
      setLiveStatus(
        `Time! Final score ${finalScore} target${finalScore === 1 ? "" : "s"}.` +
          (won ? " Goal reached." : ` Need ${goal} to clear.`),
      );
      haptics.win();
      sfx.win();
      setTimeout(() => setShowModal(true), reducedMotion ? 0 : 260);
      onComplete({
        // The host unlocks the next tier only on "won"; clearing the tier goal
        // wins the round, otherwise it's a loss for this attempt.
        status: won ? "won" : "lost",
        score: scoreToNormalised(finalScore),
        timeMs: DURATION_MS,
        detail: { cleared: finalScore, goal },
        shareText: buildShareText(finalScore),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onComplete, reducedMotion, puzzle.params, goal],
  );

  useEffect(() => {
    if (phase !== "playing") return;
    if (deadlineRef.current == null) {
      deadlineRef.current = Date.now() + remainingMs;
    }
    const tick = () => {
      const end = deadlineRef.current;
      if (end == null) return;
      const left = end - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        finish(scoreRef.current);
      } else {
        setRemainingMs(left);
      }
    };
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Keep a ref of the live score for the timer callback.
  const scoreRef = useRef(score);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // ---- actions ---------------------------------------------------------------
  const start = useCallback(() => {
    completedRef.current = false;
    setGrid(puzzle.grid.slice());
    setSelected(new Set());
    setTarget(puzzle.firstTarget);
    setScore(0);
    setIssued(1);
    setRefillPtr(0);
    refillRef.current = 0;
    scoreRef.current = 0;
    setRemainingMs(DURATION_MS);
    deadlineRef.current = Date.now() + DURATION_MS;
    setShowModal(false);
    setPopping(new Set());
    setScorePops([]);
    setLiveStatus(`Sprint started. First target ${puzzle.firstTarget}.`);
    setPhase("playing");
    haptics.tap();
    sfx.tap();
  }, [puzzle]);

  const nextTarget = useCallback(
    (liveGrid: number[]) => {
      setIssued((prevIssued) => {
        const nextIssued = prevIssued + 1;
        const rng = targetRng(puzzle.seed, nextIssued);
        const { target: t } = pickTarget(liveGrid, rng, puzzle.params);
        setTarget(t);
        return nextIssued;
      });
    },
    [puzzle.seed, puzzle.params],
  );

  const clearOnOvershoot = useCallback(() => {
    setSelected(new Set());
    haptics.error();
    sfx.wrong();
    if (!reducedMotion) {
      setShake(true);
      setTimeout(() => setShake(false), 480);
    }
    setLiveStatus("Overshoot. Selection cleared.");
  }, [reducedMotion]);

  const onMatch = useCallback(
    (sel: Set<number>) => {
      // Replace selected cells from the deterministic refill stream.
      setGrid((prevGrid) => {
        const nextGrid = prevGrid.slice();
        let ptr = refillRef.current;
        for (const id of sel) {
          nextGrid[id] = puzzle.refill[ptr % puzzle.refill.length];
          ptr += 1;
        }
        refillRef.current = ptr;
        setRefillPtr(ptr);
        nextTarget(nextGrid);
        return nextGrid;
      });
      setSelected(new Set());
      const ns = scoreRef.current + 1;
      setScore(() => {
        scoreRef.current = ns;
        return ns;
      });
      setLiveStatus(`Matched. Score ${ns}. New target coming up.`);
      haptics.success();
      sfx.correct();
      if (!reducedMotion) {
        setFlash(true);
        setTimeout(() => setFlash(false), 260);
        // Pop the freshly refilled cells.
        const refreshed = new Set(sel);
        setPopping(refreshed);
        const tp = setTimeout(() => setPopping(new Set()), 360);
        popTimers.current.push(tp);
        // Floating +1 badge.
        const id = ++popId.current;
        setScorePops((p) => [...p, id]);
        const ts = setTimeout(
          () => setScorePops((p) => p.filter((x) => x !== id)),
          750,
        );
        popTimers.current.push(ts);
      }
    },
    [nextTarget, puzzle.refill, reducedMotion],
  );

  const toggleCell = useCallback(
    (i: number) => {
      if (phase !== "playing") return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        const sum = sumOf(grid, next);
        if (sum === target) {
          // Defer mutation to the next microtask so state updates batch cleanly.
          queueMicrotask(() => onMatch(next));
        } else if (sum > target) {
          queueMicrotask(() => clearOnOvershoot());
        } else {
          haptics.tap();
          sfx.tap();
          setLiveStatus(`Selected sum ${sum} of ${target}.`);
        }
        return next;
      });
    },
    [phase, grid, target, onMatch, clearOnOvershoot],
  );

  // ---- keyboard --------------------------------------------------------------
  const move = useCallback((dr: number, dc: number) => {
    setFocusIdx((cur) => {
      let r = Math.floor(cur / GRID_SIZE) + dr;
      let c = (cur % GRID_SIZE) + dc;
      r = (r + GRID_SIZE) % GRID_SIZE;
      c = (c + GRID_SIZE) % GRID_SIZE;
      return r * GRID_SIZE + c;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") (move(-1, 0), e.preventDefault());
      else if (e.key === "ArrowDown") (move(1, 0), e.preventDefault());
      else if (e.key === "ArrowLeft") (move(0, -1), e.preventDefault());
      else if (e.key === "ArrowRight") (move(0, 1), e.preventDefault());
      else if (e.key === " " || e.key === "Enter") {
        if (phase === "idle" || phase === "done") {
          start();
        } else {
          toggleCell(focusIdx);
        }
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, toggleCell, focusIdx, phase, start]);

  const finalScore = score;
  const showStart = phase === "idle" || phase === "done";

  return (
    <div className="flex w-full flex-col items-center">
      {/* stats bar. When the host owns the unified timer we suppress our own
          SECONDS chip (timing logic is untouched) and show the win goal so the
          player still knows the per-tier clear target. */}
      <div className="grid w-full max-w-[420px] grid-cols-3 gap-2.5">
        <StatCard
          value={phase === "idle" ? "—" : String(target)}
          label="TARGET"
          color="#eafcff"
          flash={flash}
          flashColor={ACCENT.solid}
          accentBorder
        />
        {hostTimer ? (
          <StatCard value={String(goal)} label="GOAL" color="#ffb020" />
        ) : (
          <StatCard
            value={String(remainingSec)}
            label="SECONDS"
            color={timeLow ? "#ff8a4c" : "#ffb020"}
            pulse={timeLow && !reducedMotion}
            progress={phase === "playing" ? timeFrac : undefined}
            progressColor={timeLow ? "#ff8a4c" : "#ffb020"}
          />
        )}
        <StatCard
          value={String(score)}
          label="SCORE"
          color="#00e5ff"
          scorePops={scorePops}
        />
      </div>

      {/* selection status + sum meter */}
      <div className="mt-4 flex w-full max-w-[420px] flex-col items-center gap-1.5">
        <div className="font-mono text-[12px] text-[rgba(226,234,255,0.55)]">
          Selected sum:{" "}
          <span
            className="font-semibold transition-colors duration-150"
            style={{ color: overshoot ? "#ff8a4c" : ACCENT.solid }}
          >
            {selectedSum}
          </span>
          {phase === "playing" && (
            <span className="text-[rgba(226,234,255,0.35)]"> / {target}</span>
          )}
        </div>
        {/* progress toward target */}
        <div
          className="h-1 w-full max-w-[240px] overflow-hidden rounded-pill"
          style={{ background: "rgba(255,255,255,0.07)" }}
          aria-hidden="true"
        >
          <div
            className={cn("h-full rounded-pill", !reducedMotion && "transition-all duration-150")}
            style={{
              width: `${(overshoot ? 1 : sumFrac) * 100}%`,
              background: overshoot
                ? "#ff8a4c"
                : `linear-gradient(90deg, ${ACCENT.from}, ${ACCENT.to})`,
            }}
          />
        </div>
      </div>

      {/* polite live region for screen readers */}
      <p className="sr-only" role="status" aria-live="polite">
        {liveStatus}
      </p>

      {/* grid */}
      <div
        className={cn(
          "relative mt-4 grid grid-cols-4 gap-2",
          shake && !reducedMotion && "animate-shake",
        )}
        style={{ width: "min(92vw, 332px)" }}
        role="grid"
        aria-label="Number grid"
      >
        {Array.from({ length: CELLS }, (_, i) => {
          const value = grid[i];
          const isSel = selected.has(i);
          const isPop = popping.has(i);
          const r = Math.floor(i / GRID_SIZE) + 1;
          const c = (i % GRID_SIZE) + 1;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              aria-label={`Row ${r} column ${c}, value ${value}${isSel ? ", selected" : ""}`}
              disabled={phase !== "playing"}
              tabIndex={i === focusIdx ? 0 : -1}
              onFocus={() => setFocusIdx(i)}
              onClick={() => toggleCell(i)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl font-display font-semibold",
                "select-none border",
                !reducedMotion && "transition-[transform,background,box-shadow,border-color] duration-150",
                !reducedMotion && isPop && "animate-pop",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03040b]",
                phase === "playing" && !isSel && "hover:bg-white/[0.1] hover:border-white/20",
                phase === "playing" ? "cursor-pointer" : "cursor-default",
              )}
              style={{
                fontSize: "clamp(20px, 6.5vw, 26px)",
                minHeight: 44,
                color: isSel ? "#04140d" : "#eafcff",
                background: isSel
                  ? `linear-gradient(160deg, ${ACCENT.from}, ${ACCENT.to})`
                  : "rgba(255,255,255,0.06)",
                borderColor: isSel ? "transparent" : "rgba(255,255,255,0.08)",
                boxShadow: isSel ? `0 0 18px ${ACCENT.solid}80` : "none",
                transform: isSel && !reducedMotion ? "scale(0.94)" : "scale(1)",
                opacity: phase !== "playing" && phase !== "idle" ? 0.55 : 1,
              }}
            >
              {value}
            </button>
          );
        })}
      </div>

      {/* start / replay overlay + instructions */}
      {showStart ? (
        <div
          className={cn(
            "mt-6 flex w-full max-w-[332px] flex-col items-center",
            !reducedMotion && "animate-rise",
          )}
        >
          {phase === "idle" && (
            <p className="mb-4 px-2 text-center font-display text-[13.5px] leading-relaxed text-[rgba(226,234,255,0.62)]">
              Tap cells that{" "}
              <span style={{ color: ACCENT.solid }}>add up to the target</span> before the{" "}
              {DURATION_SEC}-second clock runs out. Overshoot and the selection clears — every
              match refreshes the board.
            </p>
          )}
          <button
            type="button"
            onClick={start}
            className={cn(
              "rounded-xl px-9 py-3.5 font-display text-[15px] font-semibold text-[#04060f]",
              !reducedMotion && "transition-transform duration-200 hover:-translate-y-0.5",
              "active:scale-95",
            )}
            style={{
              backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
              boxShadow: `0 10px 30px ${ACCENT.solid}38`,
            }}
          >
            {phase === "done" ? "Play again" : "Start sprint"}
          </button>
        </div>
      ) : (
        <p className="mt-6 max-w-[332px] text-center font-mono text-[10.5px] tracking-[0.08em] text-ink-faint">
          TAP CELLS THAT SUM TO THE TARGET · OVERSHOOT CLEARS
        </p>
      )}

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        eyebrow="TIME!"
        title={tierTitle(finalScore)}
        statValue={String(finalScore)}
        statLabel="TARGETS CLEARED · 60S"
        insight={INSIGHT}
        share={buildShareText(finalScore)}
        won={isWin(finalScore, puzzle.params)}
      />
    </div>
  );
}

function StatCard({
  value,
  label,
  color,
  accentBorder = false,
  flash = false,
  flashColor,
  pulse = false,
  progress,
  progressColor,
  scorePops,
}: {
  value: string;
  label: string;
  color: string;
  accentBorder?: boolean;
  flash?: boolean;
  flashColor?: string;
  pulse?: boolean;
  /** 0–1 remaining-time fraction; renders a thin bottom bar when provided. */
  progress?: number;
  progressColor?: string;
  /** Active floating "+1" badge ids. */
  scorePops?: number[];
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl px-2 py-3",
        pulse && "animate-pulse2",
      )}
      style={{
        background: accentBorder
          ? `linear-gradient(180deg, ${ACCENT.solid}1a, rgba(8,12,26,0.4))`
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${accentBorder ? `${ACCENT.solid}4d` : "rgba(255,255,255,0.1)"}`,
      }}
    >
      <div
        className="font-display text-[34px] font-semibold leading-none transition-colors duration-150"
        style={{ color: flash && flashColor ? flashColor : color }}
      >
        {value}
      </div>
      <div
        className="mt-1.5 font-mono text-[9.5px] tracking-[0.14em]"
        style={{ color: accentBorder ? ACCENT.soft : "rgba(226,234,255,0.45)" }}
      >
        {label}
      </div>

      {progress != null && (
        <div
          className="absolute inset-x-0 bottom-0 h-[3px]"
          style={{ background: "rgba(255,255,255,0.06)" }}
          aria-hidden="true"
        >
          <div
            className="h-full transition-[width] duration-200 ease-linear"
            style={{
              width: `${progress * 100}%`,
              background: progressColor ?? color,
              opacity: 0.85,
            }}
          />
        </div>
      )}

      {scorePops?.map((id) => (
        <span
          key={id}
          className="pointer-events-none absolute right-2 top-1.5 animate-rise font-display text-[15px] font-semibold"
          style={{ color, textShadow: `0 0 12px ${color}` }}
          aria-hidden="true"
        >
          +1
        </span>
      ))}
    </div>
  );
}
