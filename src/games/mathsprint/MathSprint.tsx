"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import {
  problemAt,
  scoreToNormalised,
  tierTitle,
  buildShareText,
  isWin,
  opGlyph,
  type MathSprintPuzzle,
  type Problem,
} from "./engine";

const ACCENT = GAME_METAS.mathsprint.accent;
const INSIGHT = GAME_METAS.mathsprint.insight;

interface MathSprintState {
  /** Index of the current problem in the stream. */
  ordinal: number;
  /** Correct answers so far. */
  score: number;
  /** Wrong submits so far. */
  mistakes: number;
  /** Current correct streak. */
  streak: number;
  bestStreak: number;
  /** Current keypad buffer, e.g. "5" or "-3". */
  entry: string;
  /** Ms elapsed in the round (countdown = duration − elapsed). */
  elapsedMs: number;
  phase: "idle" | "playing" | "done";
}

/** Read out a problem for screen readers, e.g. "7 times 8". */
function speakProblem(p: Problem): string {
  const word =
    p.op === "+" ? "plus" : p.op === "-" ? "minus" : p.op === "x" ? "times" : "divided by";
  return `${p.a} ${word} ${p.b}`;
}

export function MathSprint({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
  hostTimer = false,
}: GameComponentProps<MathSprintPuzzle, MathSprintState>) {
  const saved = savedState ?? null;
  // A finished saved game starts back at idle so the player can replay.
  const resumable = saved && saved.phase === "playing";
  const params = puzzle.params;
  const goal = params.goal;
  const durationMs = params.durationSec * 1000;

  const [ordinal, setOrdinal] = useState<number>(() => (resumable ? saved!.ordinal : 0));
  const [score, setScore] = useState<number>(() => (resumable ? saved!.score : 0));
  const [mistakes, setMistakes] = useState<number>(() => (resumable ? saved!.mistakes : 0));
  const [streak, setStreak] = useState<number>(() => (resumable ? saved!.streak : 0));
  const [bestStreak, setBestStreak] = useState<number>(() => (resumable ? saved!.bestStreak : 0));
  const [entry, setEntry] = useState<string>(() => (resumable ? saved!.entry : ""));
  const [phase, setPhase] = useState<MathSprintState["phase"]>(() =>
    resumable ? "playing" : "idle",
  );
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    resumable ? Math.max(0, durationMs - saved!.elapsedMs) : durationMs,
  );

  const [flash, setFlash] = useState(false);
  const [shake, setShake] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [scorePops, setScorePops] = useState<number[]>([]);
  const [liveStatus, setLiveStatus] = useState("");

  const deadlineRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const popTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Live refs for the timer callback (which closes over a stale render).
  const scoreRef = useRef(score);
  const mistakesRef = useRef(mistakes);
  const bestStreakRef = useRef(bestStreak);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    mistakesRef.current = mistakes;
  }, [mistakes]);
  useEffect(() => {
    bestStreakRef.current = bestStreak;
  }, [bestStreak]);

  // Clean up pending pop-clear timers on unmount.
  useEffect(
    () => () => {
      popTimers.current.forEach(clearTimeout);
    },
    [],
  );

  const current = useMemo(
    () => problemAt(puzzle.seed, ordinal, params),
    [puzzle.seed, ordinal, params],
  );

  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const timeLow = remainingSec <= 10 && phase === "playing";
  const timeFrac = Math.max(0, Math.min(1, remainingMs / durationMs));

  // ---- persistence -----------------------------------------------------------
  useEffect(() => {
    if (phase === "idle") return;
    onPersistState?.({
      ordinal,
      score,
      mistakes,
      streak,
      bestStreak,
      entry,
      elapsedMs: durationMs - remainingMs,
      phase,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordinal, score, mistakes, streak, bestStreak, entry, phase]);

  // ---- finish ----------------------------------------------------------------
  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    const finalScore = scoreRef.current;
    const finalMistakes = mistakesRef.current;
    const finalBest = bestStreakRef.current;
    setPhase("done");
    deadlineRef.current = null;
    const won = isWin(finalScore, params);
    setLiveStatus(
      `Time! ${finalScore} correct.` + (won ? " Goal reached." : ` Need ${goal} to clear.`),
    );
    haptics.win();
    sfx.win();
    setTimeout(() => setShowModal(true), reducedMotion ? 0 : 260);
    onComplete({
      status: won ? "won" : "lost",
      score: scoreToNormalised(finalScore),
      timeMs: durationMs,
      mistakes: finalMistakes,
      detail: { correct: finalScore, goal, bestStreak: finalBest },
      shareText: buildShareText(finalScore, finalBest, params),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete, reducedMotion, params, goal, durationMs]);

  // ---- timer -----------------------------------------------------------------
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
        finish();
      } else {
        setRemainingMs(left);
      }
    };
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---- actions ---------------------------------------------------------------
  const start = useCallback(() => {
    completedRef.current = false;
    setOrdinal(0);
    setScore(0);
    setMistakes(0);
    setStreak(0);
    setBestStreak(0);
    setEntry("");
    scoreRef.current = 0;
    mistakesRef.current = 0;
    bestStreakRef.current = 0;
    setRemainingMs(durationMs);
    deadlineRef.current = Date.now() + durationMs;
    setShowModal(false);
    setScorePops([]);
    setLiveStatus(`Sprint started. ${speakProblem(problemAt(puzzle.seed, 0, params))}.`);
    setPhase("playing");
    haptics.tap();
    sfx.tap();
  }, [puzzle.seed, params, durationMs]);

  const pressDigit = useCallback(
    (d: string) => {
      if (phase !== "playing") return;
      setEntry((prev) => {
        // Cap entry length to avoid runaway buffers; answers are small.
        if (prev.replace("-", "").length >= 6) return prev;
        if (prev === "0") return d; // replace a lone leading zero
        if (prev === "-0") return `-${d}`;
        return prev + d;
      });
      haptics.tap();
      sfx.tap();
    },
    [phase],
  );

  const pressBackspace = useCallback(() => {
    if (phase !== "playing") return;
    setEntry((prev) => prev.slice(0, -1));
    haptics.tap();
    sfx.tap();
  }, [phase]);

  const pressSign = useCallback(() => {
    if (phase !== "playing") return;
    setEntry((prev) => (prev.startsWith("-") ? prev.slice(1) : `-${prev}`));
    haptics.tap();
    sfx.tap();
  }, [phase]);

  const submit = useCallback(() => {
    if (phase !== "playing") return;
    if (entry === "" || entry === "-") return;
    const value = Number(entry);
    if (!Number.isFinite(value)) return;

    if (value === current.answer) {
      // Correct: advance to the next problem.
      const ns = scoreRef.current + 1;
      scoreRef.current = ns;
      setScore(ns);
      setStreak((prevStreak) => {
        const nextStreak = prevStreak + 1;
        setBestStreak((b) => {
          const nb = Math.max(b, nextStreak);
          bestStreakRef.current = nb;
          return nb;
        });
        return nextStreak;
      });
      const nextOrdinal = ordinal + 1;
      const nextProb = problemAt(puzzle.seed, nextOrdinal, params);
      setOrdinal(nextOrdinal);
      setEntry("");
      setLiveStatus(`Correct, score ${ns}. Next: ${speakProblem(nextProb)}.`);
      haptics.success();
      sfx.correct();
      if (!reducedMotion) {
        setFlash(true);
        setTimeout(() => setFlash(false), 260);
        const id = Date.now();
        setScorePops((p) => [...p, id]);
        const ts = setTimeout(() => setScorePops((p) => p.filter((x) => x !== id)), 750);
        popTimers.current.push(ts);
      }
    } else {
      // Wrong: same problem stays up; streak resets, mistake tallied.
      const nm = mistakesRef.current + 1;
      mistakesRef.current = nm;
      setMistakes(nm);
      setStreak(0);
      setEntry("");
      setLiveStatus("Not quite, try again.");
      haptics.error();
      sfx.wrong();
      if (!reducedMotion) {
        setShake(true);
        setTimeout(() => setShake(false), 480);
      }
    }
  }, [phase, entry, current.answer, ordinal, puzzle.seed, params, reducedMotion]);

  // ---- keyboard --------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "idle" || phase === "done") {
        if (e.key === "Enter" || e.key === " ") {
          start();
          e.preventDefault();
        }
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        pressDigit(e.key);
        e.preventDefault();
      } else if (e.key === "Enter") {
        submit();
        e.preventDefault();
      } else if (e.key === "Backspace") {
        pressBackspace();
        e.preventDefault();
      } else if (e.key === "-") {
        pressSign();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, pressDigit, submit, pressBackspace, pressSign, start]);

  const finalScore = score;
  const showStart = phase === "idle" || phase === "done";
  const negativesAllowed = params.allowNegative;

  // Keypad layout: 1-9, then ± / 0 / ⌫.
  const keys: { label: string; aria: string; onPress: () => void; mono?: boolean }[] = [
    ...["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => ({
      label: d,
      aria: d,
      onPress: () => pressDigit(d),
    })),
    {
      label: "±",
      aria: "toggle negative sign",
      onPress: pressSign,
    },
    { label: "0", aria: "0", onPress: () => pressDigit("0") },
    { label: "⌫", aria: "backspace", onPress: pressBackspace },
  ];

  return (
    <div className="flex w-full flex-col items-center">
      {/* stats row */}
      <div className="grid w-full max-w-[420px] grid-cols-3 gap-2.5">
        <StatCard
          value={String(score)}
          label="CORRECT"
          color="#eafcff"
          flash={flash}
          flashColor={ACCENT.solid}
          accentBorder
          scorePops={scorePops}
        />
        <StatCard value={String(Math.max(streak, 0))} label="STREAK" color="#00e5ff" />
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
      </div>

      {/* polite live region for screen readers */}
      <p className="sr-only" role="status" aria-live="polite">
        {liveStatus}
      </p>

      {/* problem + answer card */}
      <div
        className={cn(
          "relative mt-5 flex w-full max-w-[420px] flex-col items-center justify-center rounded-2xl border px-4 py-7",
          shake && !reducedMotion && "animate-shake",
        )}
        style={{
          minHeight: 150,
          background: flash
            ? `linear-gradient(180deg, ${ACCENT.solid}33, rgba(8,12,26,0.4))`
            : `${ACCENT.solid}14`,
          borderColor: flash ? `${ACCENT.solid}99` : `${ACCENT.solid}1f`,
          transition: reducedMotion ? undefined : "background 200ms, border-color 200ms",
        }}
        aria-label={
          phase === "playing"
            ? `${speakProblem(current)} equals what?`
            : "Math sprint problem"
        }
      >
        <div
          className="font-display font-semibold leading-none text-ink"
          style={{ fontSize: "clamp(34px, 11vw, 56px)" }}
          aria-hidden="true"
        >
          {phase === "playing" ? (
            <>
              {current.a} {opGlyph(current.op)} {current.b} =
            </>
          ) : (
            <span style={{ color: "rgba(226,234,255,0.4)" }}>
              {puzzle.first.a} {opGlyph(puzzle.first.op)} {puzzle.first.b} =
            </span>
          )}
        </div>

        {/* answer line */}
        <div
          className="mt-4 flex h-[1.4em] items-center font-display font-semibold"
          style={{ fontSize: "clamp(24px, 8vw, 38px)" }}
          aria-hidden="true"
        >
          {entry === "" ? (
            <span style={{ color: "rgba(226,234,255,0.28)" }}>?</span>
          ) : (
            <span style={{ color: ACCENT.solid }}>
              {entry}
              {!reducedMotion && phase === "playing" && (
                <span className="animate-pulse" style={{ color: ACCENT.solid }}>
                  |
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* keypad + submit (hidden on start/replay overlay) */}
      {!showStart && (
        <>
          <div
            className="mt-5 grid w-full max-w-[420px] grid-cols-3 gap-2.5"
            role="group"
            aria-label="Number pad"
          >
            {keys.map((k) => {
              const disabled = k.label === "±" && !negativesAllowed;
              return (
                <button
                  key={k.label}
                  type="button"
                  aria-label={k.aria}
                  disabled={disabled}
                  onClick={k.onPress}
                  className={cn(
                    "flex items-center justify-center rounded-xl border font-display font-semibold select-none",
                    !reducedMotion && "transition-transform duration-100 active:scale-95",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03040b]",
                    disabled ? "opacity-30" : "hover:bg-white/[0.1]",
                  )}
                  style={{
                    height: "clamp(48px, 15vw, 60px)",
                    minHeight: 48,
                    fontSize: "clamp(20px, 6vw, 26px)",
                    color: "#eafcff",
                    background: `${ACCENT.solid}33`,
                    borderColor: `${ACCENT.solid}4d`,
                  }}
                >
                  {k.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={submit}
            className={cn(
              "mt-2.5 w-full max-w-[420px] rounded-xl py-3.5 font-display text-[15px] font-semibold text-[#04060f]",
              !reducedMotion && "transition-transform duration-100 active:scale-[0.98]",
            )}
            style={{
              minHeight: 48,
              backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
              boxShadow: `0 10px 30px ${ACCENT.solid}38`,
            }}
          >
            Submit
          </button>
        </>
      )}

      {/* start / replay overlay + instructions */}
      {showStart && (
        <div
          className={cn(
            "mt-6 flex w-full max-w-[420px] flex-col items-center",
            !reducedMotion && "animate-rise",
          )}
        >
          {phase === "idle" && (
            <p className="mb-4 px-2 text-center font-display text-[13.5px] leading-relaxed text-[rgba(226,234,255,0.62)]">
              Solve each problem and hit{" "}
              <span style={{ color: ACCENT.solid }}>submit</span> before the{" "}
              {params.durationSec}s clock runs out — wrong answers cost your streak, not your
              time.
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
              minHeight: 48,
              backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
              boxShadow: `0 10px 30px ${ACCENT.solid}38`,
            }}
          >
            {phase === "done" ? "Play again" : "Start sprint"}
          </button>
        </div>
      )}

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        eyebrow="TIME!"
        title={tierTitle(finalScore)}
        statValue={String(finalScore)}
        statLabel={`CORRECT · ${params.durationSec}S`}
        insight={INSIGHT}
        share={buildShareText(finalScore, bestStreak, params)}
        won={isWin(finalScore, params)}
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
        className="font-display text-[34px] font-semibold leading-none tabular-nums transition-colors duration-150"
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
