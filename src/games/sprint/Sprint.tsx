"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { rngFromString } from "@/lib/rng";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { useFitBox } from "@/lib/useFitBox";
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
  // Transient "over by N" amount, shown briefly after an overshoot is undone
  // (the offending cell is reverted immediately, so the live sum never sits in
  // the over state — this surfaces the feedback without a color-only cue).
  const [overBy, setOverBy] = useState(0);
  const [focusIdx, setFocusIdx] = useState(0);
  const [showModal, setShowModal] = useState(false);
  // Cells freshly refilled after a match — drives a brief pop animation.
  const [popping, setPopping] = useState<Set<number>>(() => new Set());
  // Floating "+1" badge keyed by a monotonically increasing id.
  const [scorePops, setScorePops] = useState<number[]>([]);
  // Screen-reader live status; kept as state so announcements actually fire.
  const [liveStatus, setLiveStatus] = useState("");

  // Size the 4×4 board to the height left between the fixed stats/meter chrome
  // and the controls below, so board + controls fit the viewport (no scroll).
  // The board is the flex-1 slack absorber, so a tighter cap (vs round 1's 332)
  // is the largest single lever for fitting board + chrome on a short phone.
  // Round 3: lowered further (268 -> 248) so the board yields more height to the
  // fixed chrome on iPhone SE — the board can be a touch smaller and still play.
  const { ref: boardFitRef, size: boardSize } = useFitBox<HTMLDivElement>(
    GRID_SIZE,
    GRID_SIZE,
    248,
  );

  const deadlineRef = useRef<number | null>(null);
  const refillRef = useRef(refillPtr);
  // Monotonic id for "+1" pops — Date.now() collides on same-ms scores (this is
  // a speed game) which produced duplicate React keys.
  const popId = useRef(0);
  const completedRef = useRef(false);
  const popTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // True between queuing a match/overshoot resolution and it landing — guards
  // against rapid double-tap races firing queued side effects twice.
  const resolvingRef = useRef(false);
  // Tracks which seconds we've already played a countdown tick for, so the
  // last-few-seconds urgency cue fires exactly once per second.
  const lastTickSecRef = useRef<number | null>(null);

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
  // The live selection is kept under target (overshoot reverts the tapped cell
  // immediately), so the over-state is surfaced transiently via `overBy`.
  const overshoot = overBy > 0;
  const goalReached = score >= goal;
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
      if (won) {
        haptics.win();
        sfx.win();
      } else {
        // Distinct, lower-key end cue when the goal wasn't reached — don't
        // reuse the victory fanfare on a loss.
        haptics.error();
        sfx.wrong();
      }
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
        // Subtle once-per-second urgency tick over the final 3 seconds.
        const sec = Math.ceil(left / 1000);
        if (sec <= 3 && sec >= 1 && lastTickSecRef.current !== sec) {
          lastTickSecRef.current = sec;
          haptics.tap();
          sfx.tap();
        }
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
    resolvingRef.current = false;
    lastTickSecRef.current = null;
    setShowModal(false);
    setPopping(new Set());
    setScorePops([]);
    setOverBy(0); // clear any leftover overshoot badge from a prior round
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

  // Overshoot: revert ONLY the cell that pushed the sum over, leaving the rest
  // of the (valid, under-target) selection intact. A soft "too high" nudge —
  // not the punishing full-clear.
  const undoOvershoot = useCallback(
    (offendingIdx: number, amountOver: number) => {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(offendingIdx);
        return next;
      });
      haptics.error();
      sfx.wrong();
      if (!reducedMotion) {
        setShake(true);
        setTimeout(() => setShake(false), 320);
      }
      // Surface the transient "over by N" cue, then clear it.
      setOverBy(amountOver);
      const tc = setTimeout(() => setOverBy(0), 900);
      popTimers.current.push(tc);
      setLiveStatus(`Too high by ${amountOver} — that cell was undone. Keep going.`);
      resolvingRef.current = false;
    },
    [reducedMotion],
  );

  // Explicit, no-penalty clear of the current selection during play.
  const clearSelection = useCallback(() => {
    if (phase !== "playing") return;
    setOverBy(0); // dismiss any lingering "over by N" badge
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      haptics.tap();
      sfx.tap();
      setLiveStatus("Selection cleared.");
      return new Set();
    });
  }, [phase]);

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
      resolvingRef.current = false;
    },
    [nextTarget, puzzle.refill, reducedMotion],
  );

  const toggleCell = useCallback(
    (i: number) => {
      if (phase !== "playing") return;
      // Ignore taps while a match/overshoot is mid-resolution (double-tap race).
      if (resolvingRef.current) return;
      // A fresh tap dismisses a stale "over by N" badge; if THIS tap overshoots,
      // undoOvershoot's queued microtask re-sets overBy after this runs.
      setOverBy(0);
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        const sum = sumOf(grid, next);
        if (sum === target) {
          // Lock until the queued resolution lands, then defer the mutation to
          // the next microtask so state updates batch cleanly.
          resolvingRef.current = true;
          queueMicrotask(() => onMatch(next));
        } else if (sum > target) {
          // Only the just-tapped cell `i` caused the overshoot — undo just it.
          const amountOver = sum - target;
          resolvingRef.current = true;
          queueMicrotask(() => undoOvershoot(i, amountOver));
          // Render the pre-tap selection: keep the offending cell unselected.
          next.delete(i);
        } else {
          haptics.tap();
          sfx.tap();
          setLiveStatus(`Selected sum ${sum} of ${target}.`);
        }
        return next;
      });
    },
    [phase, grid, target, onMatch, undoOvershoot],
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
    <div className="flex min-h-0 w-full flex-1 flex-col items-center">
      {/* stats bar. When the host owns the unified timer we suppress our own
          SECONDS chip (timing logic is untouched) and show the win goal so the
          player still knows the per-tier clear target. */}
      <div className="grid w-full max-w-[420px] shrink-0 grid-cols-3 gap-1.5 sm:gap-2.5">
        <StatCard
          value={phase === "idle" ? "—" : String(target)}
          label="TARGET"
          color="#eafcff"
          flash={flash}
          flashColor={ACCENT.solid}
          accentBorder
        />
        <StatCard
          value={String(remainingSec)}
          label="SECONDS"
          color={timeLow ? "#ff8a4c" : "#ffb020"}
          pulse={timeLow && !reducedMotion}
          progress={phase === "playing" ? timeFrac : undefined}
          progressColor={timeLow ? "#ff8a4c" : "#ffb020"}
        />
        {/* SCORE doubles as a goal tracker: the label shows the clear goal and
            the value tints green once the goal is reached. */}
        <StatCard
          value={String(score)}
          label={`SCORE · GOAL ${goal}`}
          color={goalReached ? "#34d399" : "#00e5ff"}
          progress={phase !== "idle" ? Math.min(1, score / goal) : undefined}
          progressColor={goalReached ? "#34d399" : "#00e5ff"}
          scorePops={scorePops}
        />
      </div>

      {/* selection status + sum meter */}
      <div className="mt-1.5 flex w-full max-w-[420px] shrink-0 flex-col items-center gap-1 sm:mt-4 sm:gap-1.5">
        <div className="flex items-center gap-2 font-mono text-[12px] text-[rgba(226,234,255,0.55)]">
          <span>
            Selected sum:{" "}
            <span
              className={cn(
                "font-semibold transition-colors duration-150",
                // Non-color cue: strike through the sum on overshoot so the
                // "too high" state reads without relying on hue.
                overshoot && "line-through decoration-2",
              )}
              style={{ color: overshoot ? "#ff8a4c" : ACCENT.solid }}
            >
              {selectedSum}
            </span>
            {phase === "playing" && (
              <span className="text-[rgba(226,234,255,0.35)]"> / {target}</span>
            )}
          </span>
          {overshoot && (
            <span
              className="rounded-pill px-1.5 py-0.5 font-semibold uppercase tracking-[0.08em] text-[10px]"
              style={{ background: "#ff8a4c", color: "#1a0a02" }}
            >
              ! over by {overBy}
            </span>
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

      {/* grid — flexes to the height left between the fixed stats/meter chrome
          and the controls below, sized square by useFitBox so it fits the
          viewport (no scroll). */}
      <div
        ref={boardFitRef}
        className="mt-1.5 flex min-h-0 w-full flex-1 items-center justify-center sm:mt-4"
      >
      <div
        className={cn(
          "relative grid gap-1.5 sm:gap-2",
          shake && !reducedMotion && "animate-shake",
        )}
        style={{
          width: boardSize?.w,
          height: boardSize?.h,
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
        }}
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
                "flex h-full w-full items-center justify-center rounded-xl font-display font-semibold",
                "select-none border",
                !reducedMotion && "transition-[transform,background,box-shadow,border-color] duration-150",
                !reducedMotion && isPop && "animate-pop",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03040b]",
                phase === "playing" && !isSel && "hover:bg-white/[0.1] hover:border-white/20",
                phase === "playing" ? "cursor-pointer" : "cursor-default",
              )}
              style={{
                fontSize: "clamp(20px, 6.5vw, 26px)",
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
      </div>

      {/* start / replay overlay + instructions */}
      {showStart ? (
        <div
          className={cn(
            "mt-1.5 flex w-full max-w-[332px] shrink-0 flex-col items-center sm:mt-4",
            !reducedMotion && "animate-rise",
          )}
        >
          {phase === "idle" && (
            <p className="mb-2 px-2 text-center font-display text-[11.5px] leading-snug text-[rgba(226,234,255,0.62)] sm:mb-4 sm:text-[13.5px] sm:leading-relaxed">
              Tap cells that{" "}
              <span style={{ color: ACCENT.solid }}>add up to the target</span> before the{" "}
              {DURATION_SEC}-second clock runs out. Go too high and only that last tap is undone —
              every match refreshes the board.
            </p>
          )}
          <button
            type="button"
            onClick={start}
            className={cn(
              "rounded-xl px-9 py-2 font-display text-[15px] font-semibold text-[#04060f] sm:py-3.5",
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
        <div className="mt-1.5 flex w-full max-w-[332px] shrink-0 flex-col items-center gap-1.5 sm:mt-4 sm:gap-3">
          <button
            type="button"
            onClick={clearSelection}
            disabled={selected.size === 0}
            className={cn(
              "min-h-[36px] rounded-xl border px-5 py-1.5 font-display text-[13px] font-semibold sm:min-h-0 sm:py-2",
              !reducedMotion && "transition-[opacity,transform] duration-150 active:scale-95",
              selected.size === 0
                ? "cursor-default opacity-40"
                : "opacity-100 hover:bg-white/[0.06]",
            )}
            style={{ borderColor: "rgba(255,255,255,0.16)", color: "#eaf1ff" }}
            aria-label="Clear current selection — no penalty"
          >
            Clear selection
          </button>
          {/* Non-essential helper prose: hidden on mobile (the live sum meter and
              "over by N" cue already convey the rule) so it never costs SE height;
              restored from sm: up. */}
          <p className="hidden max-w-[332px] text-center font-mono leading-snug tracking-[0.08em] text-ink-faint sm:block sm:text-[10.5px]">
            TAP CELLS THAT SUM TO THE TARGET · TOO HIGH UNDOES THE LAST TAP
          </p>
        </div>
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
        onReplay={() => {
          setShowModal(false);
          start();
        }}
        replayLabel="Play again"
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
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl px-2 py-1.5 sm:py-3",
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
        className="font-display text-[24px] font-semibold leading-none transition-colors duration-150 sm:text-[34px]"
        style={{ color: flash && flashColor ? flashColor : color }}
      >
        {value}
      </div>
      <div
        className="mt-0.5 font-mono text-[8.5px] tracking-[0.12em] sm:mt-1.5 sm:text-[9.5px] sm:tracking-[0.14em]"
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
