"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { useProgress } from "@/lib/progress";
import { cn } from "@/lib/cn";
import {
  scoreFromCorrect,
  verdict,
  type TeasersPuzzle,
} from "./engine";

const ACCENT = GAME_METAS.teasers.accent;
const TITLE = GAME_METAS.teasers.name;
const INSIGHT = GAME_METAS.teasers.insight;

const CORRECT = "#7CF5C4";
const WRONG = "#ff5a7c";
const SURFACE = "min(92vw, 520px)";

interface TeasersState {
  /** Index of the riddle currently shown (0..riddle count for the tier). */
  index: number;
  /** Per-riddle chosen option index; -1 = not yet answered. */
  picks: number[];
  /** Whether the run has been completed. */
  done: boolean;
}

function emptyPicks(n: number): number[] {
  return new Array(n).fill(-1);
}

/**
 * Resolve initial state from a possibly-stale saved blob. The host namespaces
 * saves per tier, but a save written by an older build may carry a different
 * riddle count (or a malformed shape) — so we only adopt saved picks when they
 * match the current puzzle length, otherwise we start fresh.
 */
function initialState(
  saved: TeasersState | null,
  count: number,
): { index: number; picks: number[] } {
  const fresh = { index: 0, picks: emptyPicks(count) };
  if (!saved || saved.done) return fresh;
  if (!Array.isArray(saved.picks) || saved.picks.length !== count) return fresh;
  const idx =
    typeof saved.index === "number" && saved.index >= 0 && saved.index <= count
      ? saved.index
      : 0;
  return { index: idx, picks: saved.picks.slice() };
}

export function Teasers({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
}: GameComponentProps<TeasersPuzzle, TeasersState>) {
  const saved = savedState ?? null;
  const replaying = saved?.done ?? false;
  const count = puzzle.riddles.length;

  // Identity for the current tier's puzzle; switching tiers swaps `puzzle`,
  // which we detect to reset run state below.
  const puzzleKey = useMemo(
    () => puzzle.riddles.map((r) => r.question).join("|"),
    [puzzle.riddles],
  );

  // When replaying a finished day, start fresh from the top.
  const [index, setIndex] = useState<number>(() => initialState(saved, count).index);
  const [picks, setPicks] = useState<number[]>(() => initialState(saved, count).picks);
  // Provisional selection before it's locked in (select-then-confirm). -1 = none.
  const [pending, setPending] = useState<number>(-1);
  const [done, setDone] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [shake, setShake] = useState(false);
  const completedRef = useRef(false);
  // Guards advance() against a rapid second key/tap firing before the index
  // (and `answered`) settle, which could otherwise skip the next riddle.
  const advanceLock = useRef(false);
  // The index already committed this turn — guards commit() against a rapid
  // second Enter/Space firing the correct/wrong feedback twice (the picks[]
  // guard reads a stale closure). Reset whenever the riddle index changes.
  const committedRef = useRef(-1);

  const total = puzzle.riddles.length;
  const riddle = puzzle.riddles[Math.min(index, total - 1)];
  const answered = index < total && picks[index] !== -1;
  const selectedIdx = index < total ? picks[index] : -1;
  const isCorrect = answered && selectedIdx === riddle.answerIndex;
  const isLast = index === total - 1;

  const correctCount = useMemo(
    () =>
      puzzle.riddles.reduce(
        (acc, r, i) => acc + (picks[i] === r.answerIndex ? 1 : 0),
        0,
      ),
    [puzzle.riddles, picks],
  );

  // The bar fills as you commit answers, completing fully on the last reveal.
  const answeredCount = picks.filter((p) => p !== -1).length;
  const progressPct = Math.round((answeredCount / total) * 100);

  // When the host switches difficulty, the puzzle (and its riddle count)
  // changes. Reset the run to a fresh start for the new tier. We skip the very
  // first render (mount) so resumed saved state isn't clobbered.
  const mountedKey = useRef(puzzleKey);
  useEffect(() => {
    if (mountedKey.current === puzzleKey) return;
    mountedKey.current = puzzleKey;
    completedRef.current = false;
    advanceLock.current = false;
    setIndex(0);
    setPicks(emptyPicks(puzzle.riddles.length));
    setPending(-1);
    setDone(false);
    setShowModal(false);
    setShake(false);
  }, [puzzleKey, puzzle.riddles.length]);

  // Reset the provisional selection and clear the advance guard whenever the
  // active riddle changes, so a fresh riddle starts unselected and re-tappable.
  useEffect(() => {
    setPending(-1);
    advanceLock.current = false;
    committedRef.current = -1;
  }, [index]);

  // Persist resumable state (JSON-serialisable).
  useEffect(() => {
    onPersistState?.({ index, picks, done });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, picks, done]);

  // Commit the pending selection: this is the irreversible scoring step that
  // reveals the aha and plays correct/wrong feedback.
  const commit = useCallback(
    (choice: number) => {
      if (done || index >= total || picks[index] !== -1 || choice < 0) return;
      // Ref guard: stale `picks` lets two same-tick Enters both pass the check
      // above, double-firing the feedback. The ref is current within the batch.
      if (committedRef.current === index) return;
      committedRef.current = index;
      const right = choice === puzzle.riddles[index].answerIndex;
      setPicks((prev) => {
        const next = prev.slice();
        next[index] = choice;
        return next;
      });
      if (right) {
        haptics.success();
        sfx.correct();
      } else {
        haptics.error();
        sfx.wrong();
        if (!reducedMotion) {
          setShake(true);
          setTimeout(() => setShake(false), 480);
        }
      }
    },
    [done, index, total, picks, puzzle.riddles, reducedMotion],
  );

  // Select a choice: first tap provisionally selects it (re-tappable, so a
  // mis-tap can be corrected); tapping the same option again locks it in.
  const select = useCallback(
    (choice: number) => {
      if (done || index >= total || picks[index] !== -1) return;
      if (pending === choice) {
        commit(choice);
        return;
      }
      setPending(choice);
      haptics.tap();
      sfx.tap();
    },
    [done, index, total, picks, pending, commit],
  );

  // A run "passes" at >=60% accuracy (the same threshold that earns 2 stars).
  // Below that we still let the player advance, but the completion screen is
  // muted (no confetti, no win fanfare) so a 0/N run never reads as a triumph.
  const passed = total > 0 && correctCount / total >= 0.6;

  // All-time best accuracy for Tap Teasers, for a personal chase on the modal.
  // The stored normalised score IS accuracy% here (correct/total*100), so the
  // max score across history is the best accuracy. We fold in this run too.
  const results = useProgress((s) => s.results);
  const bestAccuracy = useMemo(() => {
    let best = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    for (const day of Object.values(results)) {
      const r = day?.teasers;
      if (r && typeof r.score === "number") best = Math.max(best, r.score);
    }
    return best;
  }, [results, correctCount, total]);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setDone(true);
    // Celebrate only a genuine pass; otherwise give the gentler error cue.
    if (passed) {
      haptics.win();
      sfx.win();
    } else {
      haptics.error();
      sfx.wrong();
    }
    const score = scoreFromCorrect(correctCount, total);
    // Completing all of the day's riddles counts as a win (and unlocks the next
    // tier on the host). Stars still reward accuracy.
    const status = "won" as const;
    const stars =
      correctCount >= total ? 3 : correctCount / total >= 0.6 ? 2 : 1;
    const emoji = puzzle.riddles
      .map((r, i) => (picks[i] === r.answerIndex ? "🟩" : "🟥"))
      .join("");
    setTimeout(() => setShowModal(true), reducedMotion ? 0 : 260);
    onComplete({
      status,
      score,
      stars,
      shareText: `BrainTap · Tap Teasers\n${correctCount}/${total} riddles cracked\n${emoji}\nbraintap.app`,
      detail: { correct: correctCount },
    });
  }, [correctCount, total, puzzle.riddles, picks, onComplete, reducedMotion, passed]);

  // Replay the same tier from a clean slate (wired to the modal's "Play again").
  const replay = useCallback(() => {
    completedRef.current = false;
    advanceLock.current = false;
    setIndex(0);
    setPicks(emptyPicks(total));
    setPending(-1);
    setDone(false);
    setShowModal(false);
    setShake(false);
  }, [total]);

  const advance = useCallback(() => {
    // First press confirms a pending (provisional) selection — this is the
    // explicit lock-in step that scores the riddle and reveals the aha.
    if (!answered) {
      if (pending !== -1) commit(pending);
      return;
    }
    // Already answered: guard against a rapid second key/tap firing before the
    // index settles and skipping the next riddle.
    if (advanceLock.current) return;
    advanceLock.current = true;
    haptics.tap();
    sfx.tap();
    if (isLast) {
      finish();
    } else {
      setIndex((i) => i + 1);
    }
  }, [answered, pending, commit, isLast, finish]);

  // Keyboard: 1–4 / A–D to select, Enter/Space to lock in / advance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === "Enter" || e.key === " ") {
        // Confirms a pending pick when unanswered, or advances when answered;
        // advance() re-checks `answered`, so a stale closure can't skip ahead.
        advance();
        e.preventDefault();
        return;
      }
      if (!answered) {
        const k = e.key.toLowerCase();
        const numMap: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
        const letMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
        const choice = k in numMap ? numMap[k] : k in letMap ? letMap[k] : -1;
        if (choice !== -1 && choice < riddle.choices.length) {
          select(choice);
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, answered, select, advance, riddle.choices.length]);

  const optionLetter = (i: number) => String.fromCharCode(65 + i);
  const safeIndex = Math.min(index, total - 1);

  // Status line read by assistive tech after each answer.
  const statusMsg = answered
    ? isCorrect
      ? `Correct. ${riddle.aha}`
      : `Not quite. The answer is ${riddle.choices[riddle.answerIndex]}. ${riddle.aha}`
    : `Riddle ${safeIndex + 1} of ${total}.`;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center bt-safe-bottom">
      {/* Visually-hidden live region for screen readers */}
      <p className="sr-only" aria-live="polite" role="status">
        {statusMsg}
      </p>

      {/* Header: game title + score chip */}
      <div
        className="flex w-full shrink-0 items-center justify-between gap-3"
        style={{ maxWidth: SURFACE }}
      >
        <div className="min-w-0">
          <div
            className="font-mono text-[10px] tracking-[0.2em]"
            style={{ color: ACCENT.soft }}
          >
            LATERAL · RIDDLE
          </div>
          <h1 className="truncate font-display text-[17px] font-semibold text-ink">
            {TITLE}
          </h1>
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 font-mono text-[11px] tracking-[0.08em]"
          style={{
            borderColor: `${ACCENT.solid}40`,
            background: `${ACCENT.solid}12`,
            color: ACCENT.soft,
          }}
          aria-label={`${correctCount} correct so far`}
        >
          <span aria-hidden="true">✦</span>
          <span className="tabular-nums text-ink">{correctCount}</span>
          <span className="text-ink-faint">cracked</span>
        </div>
      </div>

      {/* Counter + progress bar */}
      <div className="mt-3 w-full shrink-0" style={{ maxWidth: SURFACE }}>
        <div className="mb-2 flex items-center justify-between">
          <span
            className="font-mono text-[10.5px] tracking-[0.16em]"
            style={{ color: ACCENT.soft }}
          >
            RIDDLE {Math.min(index + 1, total)}/{total}
          </span>
          {replaying && (
            <span className="font-mono text-[10px] tracking-[0.12em] text-ink-faint">
              REPLAYING TODAY
            </span>
          )}
        </div>
        <div
          className="flex h-[6px] w-full gap-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answeredCount}
          aria-label={`Riddle progress: ${answeredCount} of ${total} answered`}
        >
          {puzzle.riddles.map((_, i) => {
            const segAnswered = picks[i] !== -1;
            const segCorrect = picks[i] === puzzle.riddles[i].answerIndex;
            const segCurrent = i === index && !segAnswered;
            return (
              <div
                key={i}
                className="h-full flex-1 overflow-hidden rounded-pill"
                style={{
                  background: segAnswered
                    ? segCorrect
                      ? CORRECT
                      : WRONG
                    : segCurrent
                      ? `${ACCENT.solid}66`
                      : "rgba(255,255,255,0.08)",
                  transition: reducedMotion ? "none" : "background 0.35s ease",
                }}
              />
            );
          })}
        </div>
        <span className="sr-only">{progressPct}% complete</span>
      </div>

      {/* Flexible play region: takes the height left between the fixed header /
          progress and the safe-area bottom, centres the active riddle card, and
          scrolls internally (never the page) if content can't fit a short
          viewport. The post-game review lives here too. */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto py-3">

      {/* Riddle card (active play) */}
      {!done && (
      <div
        key={safeIndex}
        className={cn(
          "relative my-auto w-full shrink-0 overflow-hidden rounded-[20px] border p-5 sm:p-7",
          !reducedMotion && "animate-rise",
          shake && !reducedMotion && "animate-shake",
        )}
        style={{
          maxWidth: SURFACE,
          background:
            "linear-gradient(180deg, rgba(20,12,30,0.7), rgba(8,12,26,0.6))",
          borderColor: `${ACCENT.solid}33`,
          boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        }}
      >
        {/* Subtle accent glow in the corner */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full"
          style={{
            background: `radial-gradient(circle, ${ACCENT.solid}22, transparent 70%)`,
          }}
        />

        <div
          className="relative font-mono text-[11px] tracking-[0.16em]"
          style={{ color: ACCENT.soft }}
        >
          RIDDLE {safeIndex + 1}
        </div>

        <p className="relative mt-3 font-display text-[19px] font-semibold leading-[1.4] text-[#f3f7ff] [overflow-wrap:anywhere] sm:text-[21px]">
          {riddle.question}
        </p>

        {/* Options */}
        <div
          className="relative mt-4 flex flex-col gap-2 sm:gap-2.5"
          role="radiogroup"
          aria-label="Answer choices"
        >
          {riddle.choices.map((choice, i) => {
            const isThisCorrect = i === riddle.answerIndex;
            const isPicked = selectedIdx === i;
            const isPending = !answered && pending === i;

            let bg = "rgba(255,255,255,0.045)";
            let border = "rgba(255,255,255,0.1)";
            let color = "#e7eeff";
            let opacity = 1;

            if (answered) {
              if (isThisCorrect) {
                bg = "rgba(124,245,196,0.14)";
                border = CORRECT;
                color = "#cffff0";
              } else if (isPicked) {
                bg = "rgba(255,90,124,0.12)";
                border = WRONG;
                color = "#ffd0da";
              } else {
                opacity = 0.5;
              }
            } else if (isPending) {
              // Provisional highlight — selected but not yet locked in.
              bg = `${ACCENT.solid}1f`;
              border = ACCENT.solid;
              color = "#f3f7ff";
            }

            // Reveal the correct answer with a gentle pulse.
            const pulse = answered && isThisCorrect && !reducedMotion;
            // Stagger option entrance for visual rhythm.
            const enterDelay = reducedMotion ? 0 : 60 + i * 55;

            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={answered ? isPicked : isPending}
                aria-label={`Option ${optionLetter(i)}: ${choice}${
                  answered && isThisCorrect ? " (correct)" : ""
                }${answered && isPicked && !isThisCorrect ? " (your pick, incorrect)" : ""}${
                  isPending ? " (selected — press the button below to lock in)" : ""
                }`}
                disabled={answered}
                onClick={() => select(i)}
                className={cn(
                  "flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left font-display text-[15px] font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99]",
                  answered ? "cursor-default" : "cursor-pointer",
                  pulse && "animate-solve",
                  !answered && !isPending && !reducedMotion && "animate-rise",
                )}
                style={
                  {
                    background: bg,
                    borderColor: border,
                    color,
                    opacity,
                    outlineColor: ACCENT.solid,
                    animationDelay: !answered && !reducedMotion ? `${enterDelay}ms` : undefined,
                  } as CSSProperties
                }
                onMouseEnter={(e) => {
                  if (answered || isPending) return;
                  e.currentTarget.style.borderColor = `${ACCENT.solid}73`;
                  e.currentTarget.style.background = `${ACCENT.solid}0f`;
                }}
                onMouseLeave={(e) => {
                  if (answered || isPending) return;
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.045)";
                }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold transition-colors duration-200"
                  style={{
                    background:
                      answered && isThisCorrect
                        ? "rgba(124,245,196,0.22)"
                        : answered && isPicked
                          ? "rgba(255,90,124,0.2)"
                          : "rgba(255,255,255,0.06)",
                    color: answered && (isThisCorrect || isPicked) ? color : ACCENT.soft,
                  }}
                  aria-hidden="true"
                >
                  {optionLetter(i)}
                </span>
                <span className="flex-1 [overflow-wrap:anywhere]">{choice}</span>
                {answered && isThisCorrect && (
                  <span aria-hidden="true" className="shrink-0 text-base" style={{ color: CORRECT }}>
                    ✓
                  </span>
                )}
                {answered && isPicked && !isThisCorrect && (
                  <span aria-hidden="true" className="shrink-0 text-base" style={{ color: WRONG }}>
                    ✗
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation reveal */}
        {answered && (
          <div
            className={cn(
              "relative mt-[18px] rounded-xl border p-3.5",
              !reducedMotion && "animate-rise",
            )}
            style={{
              background: isCorrect ? "rgba(124,245,196,0.07)" : "rgba(0,229,255,0.06)",
              borderColor: isCorrect ? "rgba(124,245,196,0.22)" : "rgba(0,229,255,0.18)",
            }}
          >
            <div
              className="font-mono text-[10.5px] tracking-[0.16em]"
              style={{ color: isCorrect ? CORRECT : "#9fe9ff" }}
            >
              {isCorrect ? "✓ NICE" : "💡 THE AHA"}
            </div>
            <p className="mt-2 text-[13.5px] leading-[1.55] text-[rgba(226,234,255,0.82)] [overflow-wrap:anywhere]">
              {riddle.aha}
            </p>
          </div>
        )}

        {/* Lock-in (confirm) button — shown once a choice is provisionally
            selected but not yet committed, so a mis-tap can be corrected first. */}
        {!answered && pending !== -1 && (
          <button
            type="button"
            onClick={() => commit(pending)}
            className="relative mt-[14px] min-h-[48px] w-full rounded-xl py-3.5 font-display text-[14px] font-semibold text-[#04060f] transition-all active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
              boxShadow: `0 10px 30px ${ACCENT.solid}38`,
              outlineColor: ACCENT.solid,
            }}
          >
            Lock in {optionLetter(pending)} →
          </button>
        )}

        {/* Advance button */}
        {answered && (
          <button
            type="button"
            onClick={advance}
            className={cn(
              "relative mt-[14px] min-h-[48px] w-full rounded-xl py-3.5 font-display text-[14px] font-semibold text-[#04060f] transition-all active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              !reducedMotion && "animate-rise",
            )}
            style={{
              backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
              boxShadow: `0 10px 30px ${ACCENT.solid}38`,
              outlineColor: ACCENT.solid,
            }}
          >
            {isLast ? "See results →" : "Next riddle →"}
          </button>
        )}

        {/* Hint (before locking in): how to select / confirm */}
        {!answered && (
          <p className="relative mt-4 text-center font-mono text-[10px] tracking-[0.1em] text-ink-faint">
            {pending === -1 ? (
              <>
                <span className="max-sm:hidden">TAP A CHOICE · OR PRESS A–D / 1–4</span>
                <span className="sm:hidden">TAP A CHOICE TO SELECT</span>
              </>
            ) : (
              <>
                <span className="max-sm:hidden">TAP AGAIN OR PRESS ENTER TO LOCK IN</span>
                <span className="sm:hidden">TAP LOCK IN TO CONFIRM</span>
              </>
            )}
          </p>
        )}
      </div>
      )}

      {/* Read-only review (after completion): every riddle with your pick, the
          correct answer, and the aha — the payoff that used to evaporate on
          finish. Stays visible behind the modal and after it's dismissed. */}
      {done && (
        <div className="my-auto flex w-full shrink-0 flex-col gap-3" style={{ maxWidth: SURFACE }}>
          <div className="flex items-center justify-between">
            <span
              className="font-mono text-[10.5px] tracking-[0.16em]"
              style={{ color: ACCENT.soft }}
            >
              REVIEW · {correctCount}/{total} CRACKED
            </span>
            {!showModal && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="font-mono text-[10px] tracking-[0.12em] underline decoration-dotted underline-offset-2"
                style={{ color: ACCENT.soft }}
              >
                RESULTS
              </button>
            )}
          </div>
          {puzzle.riddles.map((r, i) => {
            const pick = picks[i];
            const right = pick === r.answerIndex;
            return (
              <div
                key={i}
                className="rounded-[18px] border p-4 sm:p-5"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(20,12,30,0.6), rgba(8,12,26,0.5))",
                  borderColor: right ? "rgba(124,245,196,0.28)" : `${ACCENT.solid}2e`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="font-mono text-[10px] tracking-[0.16em]"
                    style={{ color: ACCENT.soft }}
                  >
                    RIDDLE {i + 1}
                  </span>
                  <span
                    className="shrink-0 font-mono text-[10px] tracking-[0.1em]"
                    style={{ color: right ? CORRECT : WRONG }}
                  >
                    {right ? "✓ CORRECT" : "✗ MISSED"}
                  </span>
                </div>
                <p className="mt-2 font-display text-[15px] font-semibold leading-[1.4] text-[#f3f7ff] [overflow-wrap:anywhere]">
                  {r.question}
                </p>
                <div className="mt-2.5 flex flex-col gap-1 text-[12.5px] leading-[1.5]">
                  {!right && pick !== -1 && (
                    <p style={{ color: "#ffd0da" }} className="[overflow-wrap:anywhere]">
                      Your pick: {optionLetter(pick)}. {r.choices[pick]}
                    </p>
                  )}
                  <p style={{ color: CORRECT }} className="[overflow-wrap:anywhere]">
                    Answer: {optionLetter(r.answerIndex)}. {r.choices[r.answerIndex]}
                  </p>
                </div>
                <p className="mt-2 text-[12.5px] leading-[1.55] text-[rgba(226,234,255,0.78)] [overflow-wrap:anywhere]">
                  <span className="font-mono text-[10px] tracking-[0.12em]" style={{ color: "#9fe9ff" }}>
                    💡 AHA{" "}
                  </span>
                  {r.aha}
                </p>
              </div>
            );
          })}
        </div>
      )}

      </div>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        eyebrow="RIDDLES COMPLETE"
        won={passed}
        title={verdict(correctCount, total)}
        statValue={`${correctCount}/${total}`}
        statLabel="RIDDLES CRACKED"
        insight={INSIGHT}
        onReplay={replay}
        replayLabel="Play this set again"
        extra={
          <span className="font-mono text-[11px] tracking-[0.08em] text-ink-faint">
            ALL-TIME BEST{" "}
            <span className="tabular-nums text-ink">{bestAccuracy}%</span> ACCURACY
          </span>
        }
        share={`BrainTap · Tap Teasers\n${correctCount}/${total} riddles cracked\n${puzzle.riddles
          .map((r, i) => (picks[i] === r.answerIndex ? "🟩" : "🟥"))
          .join("")}\nbraintap.app`}
      />
    </div>
  );
}
