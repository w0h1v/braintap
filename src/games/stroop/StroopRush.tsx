"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import {
  CANONICAL_COLORS,
  scoreToNormalised,
  starsFor,
  tierTitle,
  buildShareText,
  isWin,
  type StroopPuzzle,
  type Trial,
} from "./engine";

const ACCENT = GAME_METAS.stroop.accent;
const INSIGHT = GAME_METAS.stroop.insight;

/** JSON-serialisable resumable state — plain numbers/booleans only. */
interface StroopState {
  /** Cursor into trials — how many trials have been consumed. */
  idx: number;
  /** Correct taps so far. */
  correct: number;
  /** Wrong taps so far. */
  mistakes: number;
  /** Clock snapshot in ms remaining. */
  remainingMs: number;
  /** True once the round has ended. */
  ended: boolean;
  /** Final normalised score, set on end. */
  finalScore?: number;
}

type Phase = "idle" | "playing" | "done";

export function StroopRush({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
  difficulty,
}: GameComponentProps<StroopPuzzle, StroopState>) {
  const params = puzzle.params;
  const setSize = params.colorSet.length;
  const saved = savedState ?? null;
  // A finished saved game starts back at idle so the player can replay.
  const resumable = !!saved && !saved.ended;
  // Per-tier personal best (correct count) lives in localStorage so it persists
  // across days/sessions without touching shared progress state.
  const bestKey = `braintap.stroop.best.${difficulty ?? puzzle.difficulty ?? "medium"}`;

  const [idx, setIdx] = useState<number>(() => (resumable ? saved!.idx : 0));
  const [correct, setCorrect] = useState<number>(() => (resumable ? saved!.correct : 0));
  const [mistakes, setMistakes] = useState<number>(() => (resumable ? saved!.mistakes : 0));
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    resumable ? Math.max(0, saved!.remainingMs) : params.durationMs,
  );
  const [phase, setPhase] = useState<Phase>(() => (resumable ? "playing" : "idle"));

  const [flash, setFlash] = useState(false);
  const [shake, setShake] = useState(false);
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [liveStatus, setLiveStatus] = useState("");
  // Assertive announcement of the current trial's ink for eyes-free play.
  const [trialStatus, setTrialStatus] = useState("");
  // Transient penalty flag → drives the "-2s" float + SECONDS card pulse.
  const [penalty, setPenalty] = useState(false);
  // Fired once when `correct` first reaches the tier goal (micro-celebration).
  const [goalHit, setGoalHit] = useState(false);
  // Per-tier personal best (correct count), loaded from storage.
  const [best, setBest] = useState<number | null>(null);
  // True for the just-finished round when it beat the stored best.
  const [isRecord, setIsRecord] = useState(false);
  // Short "Resuming — N left" countdown shown before re-arming a low-time resume.
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);

  const deadlineRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const correctRef = useRef(correct);
  const mistakesRef = useRef(mistakes);
  const remainingRef = useRef(remainingMs);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const penaltyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards a trial against rapid double-fire: holds the idx the last answer
  // consumed; a second tap resolving to the same idx is ignored until advance.
  const lockedIdxRef = useRef<number | null>(null);
  const bestRef = useRef<number | null>(null);

  // Load the per-tier personal best (and refresh if the tier key changes).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(bestKey);
      const n = raw == null ? NaN : Number(raw);
      const v = Number.isFinite(n) ? n : null;
      setBest(v);
      bestRef.current = v;
    } catch {
      setBest(null);
      bestRef.current = null;
    }
  }, [bestKey]);

  useEffect(() => {
    correctRef.current = correct;
  }, [correct]);
  useEffect(() => {
    mistakesRef.current = mistakes;
  }, [mistakes]);
  useEffect(() => {
    remainingRef.current = remainingMs;
  }, [remainingMs]);

  // Clean up pending feedback timers on unmount.
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (penaltyTimer.current) clearTimeout(penaltyTimer.current);
    },
    [],
  );

  const trial: Trial | undefined = puzzle.trials[Math.min(idx, puzzle.trials.length - 1)];
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const timeLow = remainingSec <= 8 && phase === "playing";
  const timeFrac = Math.max(0, Math.min(1, remainingMs / params.durationMs));
  const goal = params.goal;

  // ---- persistence -----------------------------------------------------------
  // Persist on every meaningful progress change while playing.
  useEffect(() => {
    if (phase === "idle") return;
    onPersistState?.({
      idx,
      correct,
      mistakes,
      remainingMs,
      ended: phase === "done",
      finalScore: phase === "done" ? scoreToNormalised(correct) : undefined,
    });
    // Persist on trial progress + phase changes (throttled clock handled below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, correct, mistakes, phase]);

  // ---- finish ----------------------------------------------------------------
  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    deadlineRef.current = null;
    setPhase("done");
    const finalCorrect = correctRef.current;
    const won = isWin(finalCorrect, params);
    // Update the per-tier personal best before showing the modal.
    const prevBest = bestRef.current;
    const record = finalCorrect > 0 && (prevBest == null || finalCorrect > prevBest);
    setIsRecord(record);
    if (record) {
      setBest(finalCorrect);
      bestRef.current = finalCorrect;
      try {
        window.localStorage.setItem(bestKey, String(finalCorrect));
      } catch {
        /* storage unavailable — best stays in-memory for this session */
      }
    }
    setLiveStatus(
      `Time! ${finalCorrect} correct.` +
        (won ? " Goal reached." : ` Need ${goal} to clear.`) +
        (record ? " New personal best." : ""),
    );
    haptics.win();
    sfx.win();
    onPersistState?.({
      idx,
      correct: finalCorrect,
      mistakes: mistakesRef.current,
      remainingMs: 0,
      ended: true,
      finalScore: scoreToNormalised(finalCorrect),
    });
    onComplete({
      status: won ? "won" : "played",
      score: scoreToNormalised(finalCorrect),
      timeMs: params.durationMs,
      mistakes: mistakesRef.current,
      stars: starsFor(finalCorrect, params),
      shareText: buildShareText(finalCorrect, params),
      detail: { difficulty: puzzle.difficulty, correct: finalCorrect, mistakes: mistakesRef.current },
    });
    setTimeout(() => setShowModal(true), reducedMotion ? 0 : 280);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete, onPersistState, params, goal, idx, puzzle.difficulty, reducedMotion, bestKey]);

  // ---- low-time resume guard -------------------------------------------------
  // A round resumed with very little time left would otherwise end the instant
  // the player looks at it (or after a single wrong tap). Hold the clock and run
  // a short visible "Resuming — N left" countdown so the end isn't a surprise.
  const RESUME_GRACE_MS = 1500;
  useEffect(() => {
    if (!resumable) return;
    const left = Math.max(0, saved!.remainingMs);
    if (left > 0 && left < RESUME_GRACE_MS) {
      // Freeze the clock until the grace countdown completes.
      deadlineRef.current = null;
      const start = Math.max(1, Math.ceil(left / 1000));
      setResumeCountdown(start);
      setLiveStatus(`Resuming — ${start} second${start === 1 ? "" : "s"} left.`);
      let n = start;
      const id = setInterval(() => {
        n -= 1;
        if (n <= 0) {
          clearInterval(id);
          setResumeCountdown(null);
          // Re-arm the clock from the snapshot so ticking can begin.
          deadlineRef.current = Date.now() + remainingRef.current;
        } else {
          setResumeCountdown(n);
        }
      }, 1000);
      return () => clearInterval(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- countdown clock -------------------------------------------------------
  useEffect(() => {
    if (phase !== "playing") return;
    // Hold ticking while a low-time resume grace countdown is running.
    if (resumeCountdown != null) return;
    if (deadlineRef.current == null) {
      deadlineRef.current = Date.now() + remainingRef.current;
    }
    const tick = () => {
      const end = deadlineRef.current;
      if (end == null) return;
      const left = end - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        remainingRef.current = 0;
        finish();
      } else {
        setRemainingMs(left);
        remainingRef.current = left;
      }
    };
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, resumeCountdown]);

  // Pause the clock when the tab is backgrounded so it doesn't drain unfairly.
  useEffect(() => {
    if (phase !== "playing") return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        // Snapshot remaining time; stop the deadline so it resumes cleanly.
        const end = deadlineRef.current;
        if (end != null) {
          const left = Math.max(0, end - Date.now());
          remainingRef.current = left;
          setRemainingMs(left);
        }
        deadlineRef.current = null;
      } else if (resumeCountdown == null) {
        // Don't arm the clock mid resume-grace countdown.
        deadlineRef.current = Date.now() + remainingRef.current;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase, resumeCountdown]);

  // ---- actions ---------------------------------------------------------------
  const start = useCallback(() => {
    completedRef.current = false;
    setIdx(0);
    setCorrect(0);
    setMistakes(0);
    correctRef.current = 0;
    mistakesRef.current = 0;
    setRemainingMs(params.durationMs);
    remainingRef.current = params.durationMs;
    deadlineRef.current = Date.now() + params.durationMs;
    setShowModal(false);
    setWrongIdx(null);
    setGoalHit(false);
    setPenalty(false);
    setIsRecord(false);
    setResumeCountdown(null);
    lockedIdxRef.current = null;
    setLiveStatus("Round started. Tap the ink colour.");
    // Announce the first trial's ink for eyes-free players.
    const first = puzzle.trials[0];
    if (first) {
      setTrialStatus(
        `Ink ${CANONICAL_COLORS[params.colorSet[first.inkIdx]].label.toLowerCase()} — choose it.`,
      );
    }
    setPhase("playing");
    haptics.tap();
    sfx.tap();
  }, [params.durationMs, params.colorSet, puzzle.trials]);

  const answer = useCallback(
    (tapIdx: number) => {
      if (phase !== "playing") return;
      // Hold input while a low-time resume grace countdown is running.
      if (resumeCountdown != null) return;
      const curIdx = Math.min(idx, puzzle.trials.length - 1);
      const cur = puzzle.trials[curIdx];
      if (!cur) return;
      // Double-fire guard: a correct tap locks this trial's idx until the next
      // trial renders. Ignore any further taps that still resolve to it (covers
      // both the touch and keyboard paths).
      if (lockedIdxRef.current === curIdx) return;
      if (tapIdx === cur.inkIdx) {
        lockedIdxRef.current = curIdx;
        // Correct — advance to the next trial.
        const nc = correctRef.current + 1;
        correctRef.current = nc;
        setCorrect(nc);
        const nextIdx = Math.min(curIdx + 1, puzzle.trials.length - 1);
        setIdx(nextIdx);
        // One-shot micro-celebration the instant the goal is reached.
        const reachedGoal = nc === goal;
        if (reachedGoal) {
          setGoalHit(true);
          setLiveStatus(`Goal reached — ${nc} correct. Keep going for bonus!`);
          haptics.win();
          sfx.win();
        } else {
          setLiveStatus(`Correct. ${nc} of ${goal}.`);
          haptics.success();
          sfx.correct();
        }
        // Announce the upcoming trial's ink for eyes-free play (assertive).
        const next = puzzle.trials[nextIdx];
        if (next) {
          setTrialStatus(
            `Ink ${CANONICAL_COLORS[params.colorSet[next.inkIdx]].label.toLowerCase()} — choose it.`,
          );
        }
        if (!reducedMotion) {
          setFlash(true);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setFlash(false), 200);
        }
      } else {
        // Wrong — penalise the clock, do NOT advance (same trial re-renders).
        const nm = mistakesRef.current + 1;
        mistakesRef.current = nm;
        setMistakes(nm);
        const left = Math.max(0, remainingRef.current - params.penaltyMs);
        remainingRef.current = left;
        setRemainingMs(left);
        if (deadlineRef.current != null) deadlineRef.current = Date.now() + left;
        const inkName = CANONICAL_COLORS[params.colorSet[cur.inkIdx]].label;
        setLiveStatus(`Wrong. The ink is ${inkName.toLowerCase()}. -${params.penaltyMs / 1000}s.`);
        haptics.error();
        sfx.wrong();
        setWrongIdx(tapIdx);
        // Surface the time loss: a "-Ns" float + a pulse on the SECONDS card.
        setPenalty(true);
        if (penaltyTimer.current) clearTimeout(penaltyTimer.current);
        penaltyTimer.current = setTimeout(() => setPenalty(false), 700);
        if (!reducedMotion) {
          setShake(true);
          if (shakeTimer.current) clearTimeout(shakeTimer.current);
          shakeTimer.current = setTimeout(() => {
            setShake(false);
            setWrongIdx(null);
          }, 480);
        } else {
          setWrongIdx(null);
        }
        if (left <= 0) finish();
      }
    },
    [phase, idx, puzzle.trials, params, goal, reducedMotion, finish, resumeCountdown],
  );

  // End the round early. Scores whatever the player has — mirrors the timer
  // expiring, so it always lands on the completion modal rather than discarding.
  const giveUp = useCallback(() => {
    if (phase !== "playing") return;
    setRemainingMs(0);
    remainingRef.current = 0;
    deadlineRef.current = null;
    finish();
  }, [phase, finish]);

  // ---- keyboard: 1..N map to swatches ---------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "idle" || phase === "done") {
        if (e.key === " " || e.key === "Enter") {
          start();
          e.preventDefault();
        }
        return;
      }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= setSize) {
        answer(n - 1);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, setSize, answer, start]);

  const finalCorrect = correct;
  const showStart = phase === "idle" || phase === "done";
  const won = isWin(finalCorrect, params);

  // Word panel colours.
  const wordColor = trial ? CANONICAL_COLORS[params.colorSet[trial.inkIdx]] : null;
  const wordLabel = trial ? CANONICAL_COLORS[params.colorSet[trial.wordIdx]].label : "";
  const inkName = wordColor ? wordColor.label.toLowerCase() : "";

  // Swatch grid columns: 2 on small sets, scale up a little for larger palettes.
  const cols = setSize <= 4 ? 2 : 3;

  return (
    <div
      className="flex w-full flex-col items-center"
      style={{
        maxWidth: "min(92vw, 380px)",
        // Keep bottom controls clear of the home indicator on notched devices.
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* stats bar */}
      <div className="grid w-full grid-cols-3 gap-2.5">
        <StatCard
          value={String(remainingSec)}
          label="SECONDS"
          color={timeLow || penalty ? "#ff8a4c" : ACCENT.solid}
          pulse={(timeLow || penalty) && !reducedMotion}
          progress={phase === "playing" ? timeFrac : undefined}
          progressColor={timeLow || penalty ? "#ff8a4c" : ACCENT.solid}
          penaltyFloat={penalty ? `-${params.penaltyMs / 1000}s` : undefined}
          reducedMotion={reducedMotion}
        />
        <StatCard
          value={`${correct}/${goal}`}
          label="CORRECT"
          // Recolour to the accent once the goal is cleared — bonus territory.
          color={goalHit ? ACCENT.solid : "#eafcff"}
          flash={flash}
          flashColor={ACCENT.solid}
          accentBorder
          badge={goalHit ? "GOAL!" : undefined}
          reducedMotion={reducedMotion}
        />
        <StatCard value={String(mistakes)} label="SLIPS" color="#ff8a4c" />
      </div>

      {/* personal best for this tier */}
      {best != null && (
        <p
          className="mt-2 font-mono text-[10px] tracking-[0.12em]"
          style={{ color: "rgba(226,234,255,0.5)" }}
        >
          PERSONAL BEST · <span style={{ color: ACCENT.soft }}>{best} CORRECT</span>
        </p>
      )}

      {/* polite live region for status/outcome */}
      <p className="sr-only" role="status" aria-live="polite">
        {liveStatus}
      </p>
      {/* assertive region: announces each new trial's ink for eyes-free play */}
      <p className="sr-only" role="status" aria-live="assertive">
        {trialStatus}
      </p>

      {/* word prompt panel */}
      <div
        className={cn(
          "relative mt-5 flex w-full items-center justify-center rounded-3xl border",
          shake && !reducedMotion && "animate-shake",
        )}
        style={{
          minHeight: "clamp(120px, 34vw, 168px)",
          background: flash && !reducedMotion
            ? `radial-gradient(circle at center, ${ACCENT.solid}22, rgba(8,12,26,0.55))`
            : "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(8,12,26,0.45))",
          borderColor:
            wrongIdx != null ? "#ff5470" : `${ACCENT.solid}40`,
          boxShadow: wrongIdx != null ? "0 0 24px #ff547055" : "none",
          transition: reducedMotion ? undefined : "border-color 150ms, box-shadow 150ms",
        }}
        // Word meaning is announced off; the ink answer is in the polite status.
        aria-live="off"
        aria-label={
          trial
            ? `Word ${wordLabel} shown in ${inkName} ink — choose ${inkName}`
            : "Tap start to begin"
        }
      >
        {resumeCountdown != null ? (
          <span className="flex flex-col items-center gap-1.5 px-6 text-center">
            <span className="font-mono text-[11px] tracking-[0.18em] text-[rgba(226,234,255,0.6)]">
              RESUMING
            </span>
            <span
              className={cn("font-display text-[44px] font-bold leading-none", !reducedMotion && "animate-pop")}
              style={{ color: ACCENT.solid }}
            >
              {resumeCountdown}
            </span>
            <span className="font-mono text-[10px] tracking-[0.14em] text-ink-faint">
              {resumeCountdown === 1 ? "SECOND LEFT" : "SECONDS LEFT"}
            </span>
          </span>
        ) : trial && phase !== "idle" ? (
          <span
            className="select-none font-display font-bold tracking-wide"
            style={{
              fontSize: "clamp(40px, 14vw, 72px)",
              color: wordColor!.hex,
              // High-contrast outline so any ink is legible on dark glass.
              textShadow:
                "0 1px 2px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9), 0 0 14px rgba(0,0,0,0.55)",
              WebkitTextStroke: "1px rgba(0,0,0,0.45)",
            }}
          >
            {wordLabel}
          </span>
        ) : (
          <span className="px-6 text-center font-display text-[15px] leading-relaxed text-[rgba(226,234,255,0.62)]">
            Tap the <span style={{ color: ACCENT.solid }}>INK colour</span>, not the word.
          </span>
        )}
      </div>

      {/* swatch palette */}
      <div
        className="mt-5 grid w-full gap-2.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        role="group"
        aria-label="Colour swatches — choose the ink colour"
      >
        {params.colorSet.map((canonIdx, i) => {
          const c = CANONICAL_COLORS[canonIdx];
          const isWrong = wrongIdx === i;
          return (
            <button
              key={c.key}
              type="button"
              disabled={phase !== "playing"}
              onClick={() => answer(i)}
              aria-label={`${c.label[0]}${c.label.slice(1).toLowerCase()}${i < 9 ? `, key ${i + 1}` : ""}`}
              className={cn(
                "flex select-none flex-col items-center justify-center rounded-2xl border-2 font-display font-semibold",
                !reducedMotion &&
                  "transition-[transform,box-shadow,border-color] duration-150 active:scale-95",
                isWrong && !reducedMotion && "animate-shake",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03040b]",
                phase === "playing" ? "cursor-pointer" : "cursor-default",
              )}
              style={{
                minHeight: 56,
                background: c.hex,
                borderColor: isWrong ? "#ffffff" : `${ACCENT.solid}80`,
                boxShadow: `0 6px 18px ${c.hex}40`,
                opacity: phase === "playing" ? 1 : 0.6,
              }}
            >
              {/* Never rely on colour alone: a readable text label sits on each
                  swatch (dark text + light halo for contrast on any hue). */}
              <span
                style={{
                  color: "#0a0a12",
                  fontSize: "clamp(13px, 4.2vw, 16px)",
                  textShadow: "0 1px 1px rgba(255,255,255,0.45)",
                  letterSpacing: "0.02em",
                }}
              >
                {c.label[0]}
                {c.label.slice(1).toLowerCase()}
              </span>
              <span
                aria-hidden="true"
                className="font-mono"
                style={{ color: "rgba(10,10,18,0.6)", fontSize: 10, marginTop: 2 }}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* start / replay overlay + instructions */}
      {showStart ? (
        <div
          className={cn(
            "mt-6 flex w-full flex-col items-center",
            !reducedMotion && "animate-rise",
          )}
        >
          {phase === "idle" && (
            <p className="mb-4 px-2 text-center font-display text-[13.5px] leading-relaxed text-[rgba(226,234,255,0.62)]">
              Each round shows a colour word painted in a{" "}
              <span style={{ color: ACCENT.solid }}>different ink</span>. Tap the swatch matching
              the <span style={{ color: ACCENT.solid }}>ink you see</span> — ignore what the word
              says. Clear <span style={{ color: ACCENT.solid }}>{goal}</span> before the{" "}
              {params.durationSec}-second clock runs out. Wrong taps cost time.
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
            {phase === "done" ? "Play again" : "Start round"}
          </button>
        </div>
      ) : (
        <div className="mt-6 flex w-full flex-col items-center gap-3">
          <p className="text-center font-mono text-[10.5px] tracking-[0.08em] text-ink-faint">
            TAP THE INK COLOUR · NOT THE WORD
          </p>
          <button
            type="button"
            onClick={giveUp}
            disabled={resumeCountdown != null}
            className={cn(
              "rounded-lg border border-line-strong bg-white/[0.04] px-5 py-2 font-display text-[12.5px] font-semibold text-[rgba(226,234,255,0.7)]",
              !reducedMotion && "transition-colors duration-150 hover:text-ink active:scale-95",
              resumeCountdown != null && "opacity-40",
            )}
            aria-label="End round now and see your result"
          >
            End round
          </button>
        </div>
      )}

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        eyebrow="TIME!"
        title={tierTitle(finalCorrect, params)}
        statValue={String(finalCorrect)}
        statLabel="CORRECT"
        insight={INSIGHT}
        share={buildShareText(finalCorrect, params)}
        won={won}
        onReplay={start}
        replayLabel="Play again"
        extra={
          isRecord ? (
            <div
              className="rounded-pill px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-[#04060f]"
              style={{ backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})` }}
            >
              ★ NEW BEST · {finalCorrect} CORRECT
            </div>
          ) : best != null ? (
            <div className="font-mono text-[11px] tracking-[0.12em] text-ink-faint">
              PERSONAL BEST · {best} CORRECT
            </div>
          ) : undefined
        }
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
  penaltyFloat,
  badge,
  reducedMotion = false,
}: {
  value: string;
  label: string;
  color: string;
  accentBorder?: boolean;
  flash?: boolean;
  flashColor?: string;
  pulse?: boolean;
  progress?: number;
  progressColor?: string;
  /** When set, shows a transient floating label (e.g. "-2s") above the value. */
  penaltyFloat?: string;
  /** When set, shows a small badge (e.g. "GOAL!") at the top of the card. */
  badge?: string;
  reducedMotion?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-2xl px-2 py-3",
        // Let the GOAL/-Ns overlays escape the card; otherwise clip the
        // bottom progress bar to the rounded corners.
        badge || penaltyFloat ? "overflow-visible" : "overflow-hidden",
        pulse && "animate-pulse2",
      )}
      style={{
        background: accentBorder
          ? `linear-gradient(180deg, ${ACCENT.solid}1a, rgba(8,12,26,0.4))`
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${accentBorder ? `${ACCENT.solid}4d` : "rgba(255,255,255,0.1)"}`,
      }}
    >
      {badge && (
        <span
          className={cn(
            "absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill px-2 py-0.5 font-mono text-[8.5px] font-bold tracking-[0.1em] text-[#04060f]",
            !reducedMotion && "animate-pop",
          )}
          style={{ backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})` }}
        >
          {badge}
        </span>
      )}
      {penaltyFloat && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -top-1 right-1 font-display text-[15px] font-bold",
            !reducedMotion && "animate-rise",
          )}
          style={{ color: "#ff5470", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
        >
          {penaltyFloat}
        </span>
      )}
      <div
        className="font-display text-[30px] font-semibold leading-none transition-colors duration-150"
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
    </div>
  );
}
