"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { playTone, sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import {
  PADS,
  MAX_ROUNDS,
  PAD_COLORS,
  PAD_NAMES,
  PAD_TONES,
  gapForRound,
  normalizeSpeed,
  sequenceForRound,
  isCorrectTap,
  titleForRounds,
  scoreForRounds,
  type SimonPuzzle,
  type SimonSpeed,
} from "./engine";

const ACCENT = GAME_METAS.simon.accent;
const INSIGHT = GAME_METAS.simon.insight;

/** Pad corner radii to make the 2×2 grid read as one rounded square. */
const PAD_RADIUS = ["22px 8px 8px 8px", "8px 22px 8px 8px", "8px 8px 8px 22px", "8px 8px 22px 8px"];

type Phase = "idle" | "watching" | "input" | "over";

interface SimonState {
  best: number;
  played: boolean;
  /**
   * Legacy persisted speed choice from the pre-tier version. Kept optional so
   * old saves never crash; the host now owns difficulty/speed so it is ignored.
   */
  speed?: SimonSpeed;
}

const shareFor = (rounds: number) =>
  `BrainTap · Sequence Echo\n🧠 Recalled ${rounds} step${rounds === 1 ? "" : "s"}\n\nbraintap.app/games`;

export function Simon({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion = false,
}: GameComponentProps<SimonPuzzle, SimonState>) {
  // NOTE on hostTimer: Simon never renders its own visible timer chip, so there
  // is nothing to hide when the host owns the clock. The run is still timed
  // internally (t0Ref) so result.timeMs is reported on completion.
  const saved = savedState ?? null;

  // Speed + win target are driven by the difficulty tier the host selects, via
  // the puzzle it passes. Fall back to safe legacy values for older puzzles.
  const speed: SimonSpeed = normalizeSpeed(puzzle.speed);
  const target =
    typeof puzzle.target === "number" && puzzle.target > 0 ? puzzle.target : MAX_ROUNDS;

  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [message, setMessage] = useState("");
  const [lit, setLit] = useState<number | null>(null);
  const [best, setBest] = useState(saved?.best ?? 0);
  const [played, setPlayed] = useState(saved?.played ?? false);
  const [showModal, setShowModal] = useState(false);
  const [finalRounds, setFinalRounds] = useState(0);
  const [won, setWon] = useState(false);
  const [wrongPad, setWrongPad] = useState<number | null>(null);
  const [progress, setProgress] = useState(0); // steps tapped in the current round

  // Mutable refs used inside async playback timers.
  const stepRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const speedRef = useRef<SimonSpeed>(speed);
  speedRef.current = speed;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedRef = useRef(false);
  // Timing: the run clock starts when the player begins and stops at game over,
  // so result.timeMs is reported even though no visible chip is shown.
  const t0Ref = useRef(0);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // When the host switches difficulty, the puzzle (sequence + speed + target)
  // changes underneath us. Cancel any in-flight run and reset to idle so the
  // player starts the new tier cleanly.
  const puzzleSig = `${speed}:${target}:${puzzle.sequence.join(",")}`;
  const lastPuzzleSigRef = useRef(puzzleSig);
  useEffect(() => {
    if (lastPuzzleSigRef.current === puzzleSig) return;
    lastPuzzleSigRef.current = puzzleSig;
    clearTimers();
    completedRef.current = false;
    setPhaseBoth("idle");
    setRound(0);
    setProgress(0);
    setMessage("");
    setLit(null);
    setWrongPad(null);
    setWon(false);
    setFinalRounds(0);
    setShowModal(false);
    stepRef.current = 0;
    t0Ref.current = 0;
  }, [puzzleSig, clearTimers, setPhaseBoth]);

  // Persist best + played (JSON-serialisable only). Speed is no longer a player
  // choice (the host tier owns it), so it is not persisted.
  useEffect(() => {
    onPersistState?.({ best, played });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [best, played]);

  /** Light a pad (with tone) for a duration, then darken it. */
  const flash = useCallback(
    (pad: number, durationMs: number, playSound = true) => {
      setLit(pad);
      if (playSound) playTone(PAD_TONES[pad], durationMs * 0.9, "sine", 0.08);
      const offDelay = reducedMotion ? Math.min(160, durationMs) : durationMs * 0.7;
      schedule(() => setLit((cur) => (cur === pad ? null : cur)), offDelay);
    },
    [reducedMotion, schedule],
  );

  /** Play the full sequence for the current round, then hand control over. */
  const playback = useCallback(
    (forRound: number) => {
      setPhaseBoth("watching");
      setProgress(0);
      setMessage("Watch…");
      const seq = sequenceForRound(puzzle, forRound);
      const baseGap = gapForRound(forRound, speedRef.current);
      const gap = reducedMotion ? Math.max(360, baseGap) : baseGap;
      let t = 0;
      seq.forEach((pad) => {
        schedule(() => flash(pad, gap * 0.62), t);
        t += gap;
      });
      schedule(() => {
        stepRef.current = 0;
        setPhaseBoth("input");
        setMessage("Your turn");
      }, t + 140);
    },
    [puzzle, reducedMotion, flash, schedule, setPhaseBoth],
  );

  /** Advance to the next round: grow the revealed sequence and replay it. */
  const nextRound = useCallback(
    (fromRound: number) => {
      const r = fromRound + 1;
      setRound(r);
      schedule(() => playback(r), reducedMotion ? 380 : 650);
    },
    [playback, schedule, reducedMotion],
  );

  const endGame = useCallback(
    (rounds: number, didWin: boolean) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const timeMs = t0Ref.current > 0 ? Date.now() - t0Ref.current : 0;
      setPhaseBoth("over");
      setPlayed(true);
      setWon(didWin);
      setFinalRounds(rounds);
      if (rounds > best) setBest(rounds);
      if (didWin) haptics.win();
      else haptics.error();
      schedule(() => setShowModal(true), reducedMotion ? 250 : 700);
      onComplete({
        // A successful clear (recalled `target` steps) unlocks the next tier;
        // a slip before the target is a loss.
        status: didWin ? "won" : "lost",
        score: scoreForRounds(rounds),
        moves: rounds,
        timeMs,
        shareText: shareFor(rounds),
        detail: { rounds, target, won: didWin, best: Math.max(best, rounds) },
      });
    },
    [best, onComplete, schedule, reducedMotion, setPhaseBoth, target],
  );

  const start = useCallback(() => {
    clearTimers();
    completedRef.current = false;
    setShowModal(false);
    setWrongPad(null);
    setWon(false);
    setLit(null);
    setProgress(0);
    setFinalRounds(0);
    setRound(1);
    stepRef.current = 0;
    t0Ref.current = Date.now();
    schedule(() => playback(1), reducedMotion ? 200 : 450);
  }, [clearTimers, playback, schedule, reducedMotion]);

  const onPad = useCallback(
    (pad: number) => {
      if (phaseRef.current !== "input") return;
      const step = stepRef.current;
      const correct = isCorrectTap(puzzle, round, step, pad);
      // Echo feedback regardless, so the tap feels alive.
      flash(pad, 280);

      if (!correct) {
        setWrongPad(pad);
        haptics.error();
        sfx.wrong();
        setPhaseBoth("over");
        setMessage("Wrong — game over");
        // round - 1 = steps fully recalled before the slip. A miss before the
        // target is a loss.
        endGame(round - 1, false);
        return;
      }

      haptics.tap();
      const next = step + 1;
      stepRef.current = next;
      setProgress(next);
      const seqLen = sequenceForRound(puzzle, round).length;
      if (next >= seqLen) {
        // Round cleared.
        haptics.success();
        sfx.correct();
        if (round >= target) {
          // Reached the tier's target length — a win.
          setMessage("✓ Cleared!");
          endGame(round, true);
          return;
        }
        // Otherwise advance to the next round.
        setPhaseBoth("watching");
        setMessage("✓ Nice");
        nextRound(round);
      }
    },
    [puzzle, round, target, flash, endGame, nextRound, setPhaseBoth],
  );

  // Keyboard: 1–4 to tap pads; Enter/Space to start.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current === "input" && e.key >= "1" && e.key <= "4") {
        onPad(Number(e.key) - 1);
        e.preventDefault();
        return;
      }
      if (
        (e.key === "Enter" || e.key === " ") &&
        (phaseRef.current === "idle" || phaseRef.current === "over")
      ) {
        start();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPad, start]);

  const interactive = phase === "input";
  const watching = phase === "watching";
  const showRound = phase === "over" ? finalRounds : round;
  const seqLen = round > 0 ? sequenceForRound(puzzle, round).length : 0;

  // Screen-reader status line (kept concise + polite).
  const srStatus =
    phase === "idle"
      ? played
        ? "Ready to replay. Press Start sequence."
        : "Press Start sequence to begin."
      : phase === "watching"
        ? `Round ${round}. Watch the sequence.`
        : phase === "input"
          ? `Round ${round} of ${target}. Your turn — ${progress} of ${seqLen} repeated.`
          : won
            ? `Cleared! You recalled ${finalRounds} step${finalRounds === 1 ? "" : "s"}.`
            : `Game over. You recalled ${finalRounds} step${finalRounds === 1 ? "" : "s"}.`;

  return (
    <div className="flex w-full flex-col items-center">
      {/* polite SR status */}
      <span className="sr-only" aria-live="polite">
        {srStatus}
      </span>

      {/* stats */}
      <div
        className={cn(
          "mb-4 flex w-full items-stretch justify-center gap-3",
          !reducedMotion && "animate-rise",
        )}
        style={{ maxWidth: "min(92vw, 320px)" }}
      >
        <div
          className="flex flex-1 flex-col items-center rounded-2xl border px-4 py-2.5"
          style={{ background: `${ACCENT.solid}12`, borderColor: `${ACCENT.solid}40` }}
        >
          <span
            className="font-display text-[26px] font-semibold leading-none tabular-nums"
            style={{ color: "#ffd0f2" }}
          >
            {showRound}
            <span className="text-[15px] text-[rgba(226,234,255,0.45)]">{`/${target}`}</span>
          </span>
          <span
            className="mt-1 font-mono text-[9.5px] tracking-[0.14em]"
            style={{ color: ACCENT.soft }}
          >
            ROUND
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-2xl border border-line-strong bg-white/[0.04] px-4 py-2.5">
          <span className="font-display text-[26px] font-semibold leading-none tabular-nums text-[#9b8cff]">
            {best}
          </span>
          <span className="mt-1 font-mono text-[9.5px] tracking-[0.14em] text-ink-faint">BEST</span>
        </div>
      </div>

      {/* message */}
      <div
        className="mb-3 flex min-h-[22px] items-center justify-center text-center font-mono text-[13px]"
        style={{ color: phase === "over" ? "#ff8da8" : ACCENT.soft }}
        aria-hidden
      >
        {message || (played ? "Tap Start to beat your best." : "Watch, then repeat the pattern.")}
      </div>

      {/* progress dots — one per step in the current round */}
      <div
        className="mb-3 flex min-h-[8px] flex-wrap items-center justify-center gap-1.5"
        style={{ maxWidth: "min(92vw, 320px)" }}
        aria-hidden
      >
        {phase !== "idle" &&
          phase !== "over" &&
          Array.from({ length: seqLen }, (_, i) => {
            const done = i < progress;
            return (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  !reducedMotion && "transition-all duration-200",
                )}
                style={{
                  background: done ? ACCENT.solid : "rgba(255,255,255,0.14)",
                  boxShadow: done ? `0 0 6px ${ACCENT.solid}` : "none",
                  transform: done && !reducedMotion ? "scale(1.15)" : "scale(1)",
                }}
              />
            );
          })}
      </div>

      {/* pads */}
      <div
        className={cn(
          "grid grid-cols-2 gap-3 rounded-[26px] p-3",
          !reducedMotion && "transition-shadow duration-300",
        )}
        style={{
          width: "min(92vw, 300px)",
          aspectRatio: "1",
          background: "rgba(6,10,22,0.55)",
          border: `1px solid ${ACCENT.solid}22`,
          boxShadow: watching
            ? `0 0 0 1px ${ACCENT.solid}33, 0 18px 50px -24px ${ACCENT.solid}`
            : interactive
              ? `0 0 0 1px ${ACCENT.solid}55, 0 18px 50px -20px ${ACCENT.solid}`
              : "0 18px 50px -28px rgba(0,0,0,0.6)",
        }}
        role="group"
        aria-label="Sequence pads. Use number keys 1 to 4, or tap."
      >
        {Array.from({ length: PADS }, (_, i) => {
          const [bright, dim] = PAD_COLORS[i];
          const isLit = lit === i;
          const isWrong = wrongPad === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPad(i)}
              disabled={!interactive}
              aria-label={`Pad ${i + 1}, ${PAD_NAMES[i]}`}
              className={cn(
                "relative flex min-h-[44px] touch-manipulation select-none items-center justify-center border-none outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2",
                !reducedMotion && "transition-[transform,box-shadow,background-color] duration-150",
                interactive ? "cursor-pointer" : "cursor-default",
                isLit && !reducedMotion && "scale-[0.96]",
                isWrong && !reducedMotion && "animate-shake",
              )}
              style={{
                background: isLit ? bright : dim,
                borderRadius: PAD_RADIUS[i],
                boxShadow: isLit
                  ? `0 0 34px ${bright}, inset 0 0 18px rgba(255,255,255,0.35)`
                  : interactive
                    ? `inset 0 0 0 1px ${bright}44`
                    : "none",
                opacity: watching && !isLit ? 0.82 : 1,
                // @ts-expect-error CSS var for focus ring colour
                "--tw-ring-color": bright,
                "--tw-ring-offset-color": "#04060f",
              }}
            >
              {/* numeral aids colour-blind users + keyboard mapping; brightens when lit */}
              <span
                aria-hidden
                className="font-display text-[15px] font-semibold leading-none"
                style={{
                  color: isLit ? "rgba(4,6,15,0.55)" : "rgba(255,255,255,0.28)",
                }}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* start / play again — the host owns the difficulty/speed selector now */}
      <button
        type="button"
        onClick={start}
        disabled={watching || interactive}
        aria-label={played ? "Play again" : "Start sequence"}
        className={cn(
          "mt-6 min-h-[48px] rounded-xl px-9 py-3.5 font-display text-[15px] font-semibold text-[#04060f] outline-none",
          "focus-visible:ring-2 focus-visible:ring-offset-2",
          !reducedMotion && "transition-transform active:scale-95",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
        style={{
          backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
          boxShadow: `0 10px 30px ${ACCENT.solid}38`,
          // @ts-expect-error CSS var for focus ring colour
          "--tw-ring-color": ACCENT.solid,
          "--tw-ring-offset-color": "#04060f",
        }}
      >
        {watching ? "Watch…" : interactive ? "Your turn" : played ? "Play again" : "Start sequence"}
      </button>

      {/* idle helper / how-to */}
      {phase === "idle" && (
        <p
          className="mt-3 max-w-[280px] text-center font-mono text-[11px] leading-relaxed text-ink-faint"
          style={{ overflowWrap: "break-word" }}
        >
          {played
            ? `Recall ${target} steps to clear this tier — replay to beat your best.`
            : `Each round adds one step. Tap the pads back in order — recall ${target} steps to win. One miss ends the run.`}
        </p>
      )}

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        won={won}
        eyebrow={won ? "TIER CLEARED" : "SEQUENCE BROKEN"}
        title={won ? "Tier cleared." : titleForRounds(finalRounds)}
        statValue={String(finalRounds)}
        statLabel="STEPS RECALLED"
        insight={INSIGHT}
        share={shareFor(finalRounds)}
      />
    </div>
  );
}
