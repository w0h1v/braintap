"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import {
  BLANK_MS,
  BLANK_MS_REDUCED,
  MASK_COLOR,
  REDUCED_MOTION_FLASH_FLOOR,
  evaluateTap,
  scoreRun,
  testGrid,
  type SpotChangePuzzle,
} from "./engine";

const ACCENT = GAME_METAS.spotchange.accent;
const INSIGHT = GAME_METAS.spotchange.insight;

const GOOD = "#7cf5c4";
const BAD = "#ff5a7c";

type Phase = "idle" | "show" | "blank" | "test" | "resolved" | "over";

// Per-round input window (presentation-only, never seeded). The TEST phase
// auto-resolves as a miss when this elapses, giving the game a real lose beat
// and per-round pressure. Generous so it tests recall, not twitch speed; a
// reduced-motion floor keeps it comfortable.
const INPUT_MS = 6000;
const INPUT_MS_REDUCED = 9000;

/** Longest run of consecutive correct answers in a result list. */
function bestStreak(results: readonly boolean[]): number {
  let best = 0;
  let cur = 0;
  for (const r of results) {
    cur = r ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

interface SpotChangeState {
  /** Per-round correctness results recorded so far. */
  results: boolean[];
  /** Whether the run has ended. */
  ended: boolean;
  /** Accumulated input-phase time in ms (for the leaderboard tiebreak). */
  timeMs: number;
  /** Grid edge the saved run belongs to (tier guard). */
  grid: number;
  /** Round count the saved run belongs to (tier guard). */
  rounds: number;
}

export function SpotChange({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
}: GameComponentProps<SpotChangePuzzle, SpotChangeState>) {
  const { grid, palette, rounds, flashMs } = puzzle;
  const cells = grid * grid;
  const totalRounds = rounds.length;

  // Only resume a saved run when it belongs to THIS tier (same grid + round
  // count). Mismatched tiers start fresh.
  const saved = savedState ?? null;
  const savedMatchesTier =
    saved != null && saved.grid === grid && saved.rounds === totalRounds;

  const [results, setResults] = useState<boolean[]>(() =>
    savedMatchesTier && saved && !saved.ended ? saved.results.slice() : [],
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [chosen, setChosen] = useState<number | null>(null);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [ended, setEnded] = useState(savedMatchesTier ? saved?.ended ?? false : false);
  const [showModal, setShowModal] = useState(false);
  const [shake, setShake] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  // Whether the current resolve was a timeout (no tap) vs. a wrong tap.
  const [timedOut, setTimedOut] = useState(false);

  const completedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The per-round input deadline timer (so a tap can cancel it).
  const inputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timing: accumulate TEST-phase wall clock (Date.now is allowed in the
  // component; the prohibition is engine/generator only).
  const startedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef(savedMatchesTier ? saved?.timeMs ?? 0 : 0);

  // Tier signature: when the host switches difficulty the puzzle changes and we
  // reset the in-progress run.
  const tierSig = `${grid}:${totalRounds}:${flashMs}`;
  const lastTierSigRef = useRef(tierSig);

  // The index of the round currently being played (0-based).
  const roundIdx = Math.min(results.length, totalRounds - 1);
  const round = rounds[roundIdx];
  const correct = results.filter(Boolean).length;
  const inputMs = reducedMotion ? INPUT_MS_REDUCED : INPUT_MS;
  const streakBest = bestStreak(results);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  // Clean up any pending timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  // React to a difficulty/tier switch from the host: reset to a fresh run.
  useEffect(() => {
    if (lastTierSigRef.current === tierSig) return;
    lastTierSigRef.current = tierSig;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    completedRef.current = false;
    startedAtRef.current = null;
    elapsedRef.current = 0;
    setResults([]);
    setPhase("idle");
    setChosen(null);
    setWasCorrect(false);
    setEnded(false);
    setShowModal(false);
    setShake(false);
    setFocusIdx(0);
    setTimedOut(false);
    if (inputTimerRef.current) {
      clearTimeout(inputTimerRef.current);
      inputTimerRef.current = null;
    }
  }, [tierSig]);

  // Persist resumable progress (results + end status + timing + tier guard).
  useEffect(() => {
    onPersistState?.({
      results,
      ended,
      timeMs: Math.round(elapsedRef.current),
      grid,
      rounds: totalRounds,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, ended, grid, totalRounds]);

  const finish = useCallback(
    (finalResults: boolean[]) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const timeMs = Math.round(elapsedRef.current);
      const correctCount = finalResults.filter(Boolean).length;
      const perfect = correctCount === finalResults.length;
      // Accuracy is primary. A small time bonus only breaks ties between perfect
      // runs; it never pushes a non-perfect run to 100.
      const base = scoreRun(finalResults);
      const score = perfect ? 100 : base;
      // Completing the full run UNLOCKS the next tier — gating on completion,
      // not perfection (a fixed-trial accuracy game should never soft-lock
      // progression behind a flawless run). Accuracy still drives the score and
      // rank, so there's a number to chase without a hard wall.
      const status = "won" as const;
      // Graded celebration: full confetti + win jingle only for a perfect run;
      // a strong-but-imperfect run still gets a light, encouraging beat.
      const strong = !perfect && base >= 60;

      setEnded(true);
      setPhase("over");

      if (perfect) {
        haptics.win();
        sfx.win();
      } else if (strong) {
        haptics.success();
        sfx.correct();
      }

      schedule(() => setShowModal(true), perfect ? 420 : 300);

      const grid_emoji =
        "🟩".repeat(correctCount) + "⬛".repeat(finalResults.length - correctCount);

      onComplete({
        // `status: "won"` is the progression-unlock signal (granted on
        // completion, not perfection). `score` stays accuracy-based, so rank
        // still reflects how well the run went.
        status,
        score,
        timeMs,
        mistakes: finalResults.length - correctCount,
        shareText: `BrainTap · Spot the Change\n${correctCount}/${finalResults.length} changes spotted\n\n${grid_emoji}\nbraintap.app/games`,
        detail: {
          correct: correctCount,
          total: finalResults.length,
          perfect,
          streak: bestStreak(finalResults),
          grid,
        },
      });
    },
    [onComplete, schedule, grid],
  );

  // Resolve the current TEST round. `cell === null` means the input window
  // elapsed with no answer (a timeout miss); otherwise it's the tapped cell.
  const resolveRound = useCallback(
    (cell: number | null) => {
      if (phase !== "test" || ended) return;
      // Stop the per-round deadline timer the moment the round resolves.
      if (inputTimerRef.current) {
        clearTimeout(inputTimerRef.current);
        inputTimerRef.current = null;
      }
      // Bank this round's input time.
      if (startedAtRef.current != null) {
        elapsedRef.current += Date.now() - startedAtRef.current;
        startedAtRef.current = null;
      }

      const isCorrect = cell != null && evaluateTap(round, cell) === "correct";
      setChosen(cell);
      setWasCorrect(isCorrect);
      setTimedOut(cell == null);
      setPhase("resolved");

      if (isCorrect) {
        sfx.correct();
        haptics.success();
      } else {
        sfx.wrong();
        haptics.error();
        if (!reducedMotion) {
          setShake(true);
          schedule(() => setShake(false), 480);
        }
      }

      const nextResults = [...results, isCorrect];
      setResults(nextResults);

      if (nextResults.length >= totalRounds) {
        schedule(() => finish(nextResults), reducedMotion ? 600 : 900);
      }
    },
    [phase, ended, round, results, totalRounds, reducedMotion, schedule, finish],
  );

  // Begin a round: SHOW → (timer) → BLANK → (timer) → TEST → (deadline) → miss.
  const startRound = useCallback(() => {
    if (ended) return;
    setChosen(null);
    setWasCorrect(false);
    setTimedOut(false);
    setPhase("show");

    const flash = reducedMotion ? Math.max(flashMs, REDUCED_MOTION_FLASH_FLOOR) : flashMs;
    const blank = reducedMotion ? BLANK_MS_REDUCED : BLANK_MS;

    schedule(() => {
      setPhase("blank");
      schedule(() => {
        setPhase("test");
        setFocusIdx(0);
        startedAtRef.current = Date.now();
        // Arm the per-round input deadline: no answer in time is a miss.
        inputTimerRef.current = setTimeout(() => {
          inputTimerRef.current = null;
          resolveRound(null);
        }, inputMs);
        timersRef.current.push(inputTimerRef.current);
      }, blank);
    }, flash);
  }, [ended, flashMs, reducedMotion, schedule, inputMs, resolveRound]);

  // Handle a tap/selection on a cell during the TEST phase.
  const pick = useCallback((cell: number) => resolveRound(cell), [resolveRound]);

  // Reset the current tier to a fresh run so the player can replay. Clears the
  // completion guard, results, timing and modal so a new full run can be
  // scored from scratch (the unlock has already been granted on completion).
  const replay = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (inputTimerRef.current) {
      clearTimeout(inputTimerRef.current);
      inputTimerRef.current = null;
    }
    completedRef.current = false;
    startedAtRef.current = null;
    elapsedRef.current = 0;
    setResults([]);
    setPhase("idle");
    setChosen(null);
    setWasCorrect(false);
    setTimedOut(false);
    setEnded(false);
    setShowModal(false);
    setShake(false);
    setFocusIdx(0);
  }, []);

  // Keyboard navigation during the TEST phase (mirror sudoku's move()).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (phase !== "test") return;
      let next = focusIdx;
      const r = Math.floor(focusIdx / grid);
      const c = focusIdx % grid;
      if (e.key === "ArrowRight") next = r * grid + Math.min(grid - 1, c + 1);
      else if (e.key === "ArrowLeft") next = r * grid + Math.max(0, c - 1);
      else if (e.key === "ArrowDown") next = Math.min(grid - 1, r + 1) * grid + c;
      else if (e.key === "ArrowUp") next = Math.max(0, r - 1) * grid + c;
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(focusIdx);
        return;
      } else return;
      e.preventDefault();
      setFocusIdx(next);
      sfx.tap();
    },
    [phase, focusIdx, grid, pick],
  );

  // What colour index each cell shows in the current phase.
  const displayGrid = useMemo<number[] | null>(() => {
    if (phase === "show") return round.base;
    // TEST, RESOLVED and OVER all show the swapped (test) grid so the changed
    // cell stays visible — the board is reviewable on the end screen instead of
    // being blanked, and a resolved round keeps its colours to learn from.
    if (phase === "test" || phase === "resolved" || phase === "over") {
      return testGrid(round);
    }
    return null; // idle / blank → masked (never paints base mid-run)
  }, [phase, round]);

  const perfectSoFar = ended && correct === totalRounds;
  const isLastRound = results.length >= totalRounds;
  // A run resumed from saved state mid-way: idle, but rounds already played and
  // not yet ended. The board is masked (idle) so we offer a clear resume CTA
  // instead of stranding the player on an empty grid.
  const isMidRunResume =
    phase === "idle" && !ended && results.length > 0 && results.length < totalRounds;

  const message =
    phase === "show"
      ? "Memorize the grid…"
      : phase === "blank"
        ? "…"
        : phase === "test"
          ? "Tap the cell that changed."
          : phase === "resolved"
            ? wasCorrect
              ? "Spotted it ✓"
              : timedOut
                ? "Out of time — the highlighted cell changed."
                : "Missed — the highlighted cell changed."
            : phase === "over"
              ? perfectSoFar
                ? "Every change spotted ✓"
                : `${correct}/${totalRounds} changes spotted`
              : ended
                ? "Run complete"
                : isMidRunResume
                  ? `Resume your run — round ${results.length + 1} of ${totalRounds}.`
                  : "Memorize the grid, then spot the one cell that changed.";

  const primaryLabel =
    phase === "idle" && results.length === 0
      ? "Start round"
      : isMidRunResume
        ? `Resume · round ${results.length + 1}`
        : phase === "resolved" && !isLastRound
          ? "Next round"
          : null;
  const showPrimary = (phase === "idle" || phase === "resolved") && !ended && primaryLabel;

  return (
    <div className="flex w-full flex-col items-center">
      {/* Status header: round + score chips */}
      <div className="mb-2.5 flex w-full max-w-[420px] items-center justify-between font-mono text-[10.5px] tracking-[0.12em]">
        <span className="flex items-center gap-2">
          <span style={{ color: ACCENT.soft }}>
            ROUND {Math.min(results.length + (ended ? 0 : 1), totalRounds)}/{totalRounds}
          </span>
          {/* Streak chip — a small chase number: most changes spotted in a row. */}
          {streakBest > 0 && (
            <span
              className="rounded-pill px-1.5 py-[1px] font-semibold"
              style={{ background: `${GOOD}1f`, color: GOOD }}
              aria-label={`Best streak ${streakBest} in a row`}
            >
              🔥 {streakBest}
            </span>
          )}
        </span>
        <span
          className="flex items-center gap-[5px]"
          role="img"
          aria-label={`${correct} of ${totalRounds} rounds correct`}
        >
          {Array.from({ length: totalRounds }, (_, i) => {
            const result = i < results.length ? results[i] : null;
            return (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  "h-[6px] w-[6px] rounded-full",
                  reducedMotion ? "" : "transition-all duration-300",
                )}
                style={{
                  background:
                    result === true
                      ? GOOD
                      : result === false
                        ? BAD
                        : "rgba(255,255,255,0.14)",
                  boxShadow: result === true ? `0 0 6px ${GOOD}99` : "none",
                }}
              />
            );
          })}
        </span>
      </div>

      {/* Live status message */}
      <div
        role="status"
        aria-live="polite"
        className="mb-2.5 flex min-h-[24px] items-center justify-center text-center font-mono text-[13px]"
        style={{ color: phase === "resolved" && !wasCorrect ? BAD : ACCENT.soft }}
      >
        {message}
      </div>

      {/* Countdown bar: memorize-time cue on SHOW, input deadline on TEST. The
          TEST bar mirrors the per-round timer that auto-resolves as a miss, so
          the pressure is visible. Under reducedMotion we skip the animation
          (the timer still runs) to honour the motion preference. */}
      <div
        className="mb-3 h-[3px] w-full max-w-[min(92vw,420px)] overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
        aria-hidden="true"
      >
        {phase === "show" && !reducedMotion && (
          <div
            key={`show-${results.length}`}
            className="h-full origin-left"
            style={{
              background: `linear-gradient(90deg, ${ACCENT.from}, ${ACCENT.to})`,
              boxShadow: `0 0 8px ${ACCENT.solid}88`,
              animation: `spotCountdown ${flashMs}ms linear forwards`,
            }}
          />
        )}
        {phase === "test" && !reducedMotion && (
          <div
            key={`test-${results.length}`}
            className="h-full origin-left"
            style={{
              background: `linear-gradient(90deg, ${BAD}, ${ACCENT.to})`,
              boxShadow: `0 0 8px ${BAD}88`,
              animation: `spotCountdown ${inputMs}ms linear forwards`,
            }}
          />
        )}
      </div>

      {/* Grid */}
      <div
        className={cn(
          "grid w-full max-w-[min(92vw,420px)] gap-[2.2vw] sm:gap-[9px]",
          shake && !reducedMotion && "animate-shake",
        )}
        style={{ gridTemplateColumns: `repeat(${grid}, 1fr)` }}
        role="grid"
        aria-label="Spot the change grid"
        onKeyDown={onKeyDown}
      >
        {Array.from({ length: cells }, (_, i) => {
          const r = Math.floor(i / grid);
          const c = i % grid;
          const interactive = phase === "test" && !ended;

          // Resolve the colour this cell is currently painted.
          const colorIdx = displayGrid ? displayGrid[i] : null;
          const pc = colorIdx != null ? palette[colorIdx] : null;
          const bg = pc ? pc.hex : MASK_COLOR;
          let border = pc ? `${pc.hex}` : "rgba(255,255,255,0.09)";
          let shadow = pc ? `0 0 10px ${pc.hex}44` : "none";

          // Resolve markers on the changed/chosen cells after a resolve.
          const isChanged = i === round.changedCell;
          const isChosen = chosen === i;
          if (phase === "resolved" || phase === "over") {
            if (wasCorrect && isChanged) {
              border = GOOD;
              shadow = `0 0 18px ${GOOD}cc`;
            } else if (!wasCorrect && isChosen) {
              border = BAD;
              shadow = `0 0 18px ${BAD}cc`;
            } else if (!wasCorrect && isChanged) {
              // Reveal the true changed cell so the player learns.
              border = ACCENT.solid;
              shadow = `0 0 18px ${ACCENT.solid}cc`;
            }
          }

          const ringHighlight =
            (phase === "resolved" || phase === "over") &&
            ((wasCorrect && isChanged) || (!wasCorrect && (isChosen || isChanged)));

          // The label includes the colour NAME (a non-colour cue) when known.
          const colourName = pc ? `, ${pc.name}` : "";

          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              tabIndex={interactive ? (i === focusIdx ? 0 : -1) : -1}
              aria-label={`Row ${r + 1} column ${c + 1}${colourName}${
                isChosen ? ", selected" : ""
              }`}
              aria-selected={isChosen}
              disabled={!interactive}
              onClick={() => pick(i)}
              onFocus={() => {
                if (interactive) setFocusIdx(i);
              }}
              className={cn(
                "relative flex aspect-square min-h-[44px] items-center justify-center rounded-[11px] border outline-none",
                reducedMotion ? "" : "transition-all duration-150 ease-out",
                interactive && "active:scale-90 cursor-pointer",
                interactive &&
                  "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04060f]",
              )}
              style={{
                background: bg,
                borderColor: border,
                boxShadow: shadow,
                transform: ringHighlight && !reducedMotion ? "scale(1.05)" : undefined,
                // @ts-expect-error -- CSS var consumed by ring utility
                "--tw-ring-color": `${ACCENT.solid}cc`,
              }}
            >
              {/* Glyph = non-colour channel so colour is never the sole cue. */}
              {pc && (
                <span
                  aria-hidden="true"
                  className="select-none font-mono text-[clamp(9px,3.2vw,15px)] font-bold leading-none"
                  style={{ color: "rgba(4,6,15,0.55)" }}
                >
                  {pc.glyph}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Intro / instructions — only before the very first round. */}
      {phase === "idle" && results.length === 0 && !ended && (
        <p className="mt-4 max-w-[340px] text-center font-mono text-[11.5px] leading-relaxed text-ink-faint">
          The grid flashes, then blanks. When it returns, one cell&apos;s colour
          has changed — tap it. Each round is scored on its own; play all{" "}
          {totalRounds}.
        </p>
      )}

      {/* Primary action button (Start round / Next round). */}
      {showPrimary && (
        <button
          type="button"
          onClick={() => startRound()}
          aria-label={primaryLabel ?? undefined}
          className={cn(
            "mt-6 rounded-xl px-8 py-3.5 font-display text-[15px] font-semibold text-[#04060f]",
            reducedMotion ? "" : "transition-transform active:scale-95",
            reducedMotion ? "" : "animate-pop",
          )}
          style={{
            backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
            boxShadow: `0 8px 24px -8px ${ACCENT.solid}99`,
          }}
        >
          {primaryLabel}
        </button>
      )}

      {/* Keep layout height stable during show/blank/test/resolving. */}
      {(phase === "show" || phase === "blank" || phase === "test" || (phase === "resolved" && isLastRound)) && (
        <p className="mt-6 h-[20px] text-center font-mono text-[11px] text-ink-faint">
          {phase === "show"
            ? "Hold the colours in mind…"
            : phase === "blank"
              ? "…"
              : phase === "test"
                ? "Which cell changed?"
                : "Tallying your run…"}
        </p>
      )}

      {ended && (
        <div className="mt-6 flex flex-col items-center gap-2">
          {streakBest > 0 && (
            <p className="font-mono text-[11px] tracking-[0.08em]" style={{ color: GOOD }}>
              🔥 Best streak: {streakBest} in a row
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="rounded-pill border border-line-strong px-6 py-2.5 font-display text-[13.5px] text-[#eaf1ff] transition-transform active:scale-95"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              View result
            </button>
            <button
              type="button"
              onClick={replay}
              className="rounded-pill px-6 py-2.5 font-display text-[13.5px] font-semibold text-[#04060f] transition-transform active:scale-95"
              style={{ backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})` }}
            >
              ↻ Play again
            </button>
          </div>
        </div>
      )}

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        // A completed run reads as a win (confetti + rank reveal): unlock is on
        // completion, and a strong non-perfect run deserves a number to chase.
        // The eyebrow/title still distinguish a perfect run from a partial one.
        won={ended}
        eyebrow="CHANGE DETECTED"
        title={perfectSoFar ? "Every change spotted." : `${correct}/${totalRounds} changes spotted.`}
        statValue={`${correct}/${totalRounds}`}
        statLabel="CORRECT"
        insight={INSIGHT}
        onReplay={ended ? replay : undefined}
        replayLabel="Play this tier again"
        share={`BrainTap · Spot the Change\n${correct}/${totalRounds} changes spotted\n\n${
          "🟩".repeat(correct) + "⬛".repeat(totalRounds - correct)
        }\nbraintap.app/games`}
      />

      {!reducedMotion && (
        <style>{`@keyframes spotCountdown{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
      )}
    </div>
  );
}
