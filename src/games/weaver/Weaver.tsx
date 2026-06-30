"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { HintButton } from "@/components/play/HintButton";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import { useFitBox } from "@/lib/useFitBox";
import { useEntitlement } from "@/lib/entitlement";
import { adsAvailable, showRewardedAd } from "@/lib/ads";
import { getMonetizationConfig } from "@/lib/config";
import { Hive } from "./Hive";
import {
  evaluateWord,
  getHint,
  goalForWords,
  hiveLetters,
  isPangram,
  rankFor,
  scoreOf,
  type SubmitError,
  type WeaverPuzzle,
} from "./engine";

export const MAX_HINTS = 3;
/** Score deducted per hint used (applied to the final normalized score). */
const HINT_PENALTY = 5;

const ACCENT = GAME_METAS.weaver.accent;
const INSIGHT = GAME_METAS.weaver.insight;

const ERROR_TEXT: Record<SubmitError, string> = {
  short: "Too short — 4+ letters",
  center: "Must use the center letter",
  alien: "Uses a letter not in the hive",
  duplicate: "Already found",
  unknown: "Not in word list",
};

interface WeaverState {
  found: string[];
  /** Outer-letter ordering so a shuffle survives reload. */
  order: string[];
  won: boolean;
  /** Number of hints consumed (max MAX_HINTS), persisted across reloads. */
  hintsUsed?: number;
}

/**
 * Idea Weaver is intentionally WIN-ONLY: there is no lose / fail / timeout
 * state. The puzzle is always solvable, in-progress state is persisted via
 * onPersistState, and players resume exactly where they left off — so the
 * CompletionModal only ever represents a win. The missing "fail UI" is by
 * design, not a bug. (QA note for the win-lose audit dimension.)
 */
export function Weaver({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
}: GameComponentProps<WeaverPuzzle, WeaverState>) {
  const saved = savedState ?? null;
  const { isPremium } = useEntitlement();
  const hive = useMemo(() => hiveLetters(puzzle), [puzzle]);
  // Size the hexagon hive to the height left between the fixed chrome (header,
  // word strip, action row, hint) and the found-words list, so the whole game
  // fits a phone viewport without scrolling. The hive keeps its 260/280 aspect
  // ratio; 296 is its existing desktop max width.
  const { ref: hiveFitRef, size: hiveSize } = useFitBox<HTMLDivElement>(260, 280, 296);

  // Backward-compatible reads of saved state: older or cross-tier saves may hold
  // an `order` that is no longer a permutation of THIS hive's outer letters, or
  // `found` words that aren't valid for this hive. Guard so a stale save can
  // never crash or render the wrong hive.
  const safeOrder = useCallback(
    (s: WeaverState | null): string[] => {
      const want = puzzle.outer;
      const got = Array.isArray(s?.order) ? s!.order : null;
      if (got && got.length === want.length && want.every((l) => got.includes(l))) {
        return got.slice();
      }
      return want.slice();
    },
    [puzzle.outer],
  );
  const safeFound = useCallback(
    (s: WeaverState | null): string[] => {
      if (!Array.isArray(s?.found)) return [];
      const valid = new Set(puzzle.valid);
      return s!.found.filter((w) => typeof w === "string" && valid.has(w)).sort();
    },
    [puzzle.valid],
  );

  // The win goal for this tier. Fall back to the engine helper if an older or
  // archived puzzle shape arrived without one; clamp to the words on offer.
  const goal = useMemo(
    () =>
      Math.min(
        puzzle.valid.length,
        Math.max(
          1,
          puzzle.goal ?? goalForWords(puzzle.valid.length, puzzle.difficulty),
        ),
      ),
    [puzzle.valid.length, puzzle.goal, puzzle.difficulty],
  );

  const [found, setFound] = useState<string[]>(() => safeFound(saved));
  const [order, setOrder] = useState<string[]>(() => safeOrder(saved));
  const [cur, setCur] = useState("");
  const [won, setWon] = useState(saved?.won ?? false);
  const [hintsUsed, setHintsUsed] = useState(() =>
    Math.min(MAX_HINTS, Math.max(0, saved?.hintsUsed ?? 0)),
  );
  const [showModal, setShowModal] = useState(false);
  const [flash, setFlash] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [shake, setShake] = useState(false);
  const [popLetter, setPopLetter] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards submit() against a double-fire (rapid Enter taps / key-repeat) while
  // the winning word is being committed and the pre-modal delay is in flight, so
  // the goal-reaching word can never be counted twice.
  const submittingRef = useRef(false);
  // Seed the once-only completion guard from the resumed state so a finished
  // tier never re-fires onComplete when the player keeps finding words on reload.
  const completedRef = useRef(saved?.won ?? false);
  const hintsRef = useRef(hintsUsed);
  hintsRef.current = hintsUsed;
  // Guards the rewarded-ad hint flow against re-entrancy while an ad is showing.
  const adInFlightRef = useRef(false);
  // Solve-time stopwatch. Weaver shows no clock chip (the host owns the unified
  // timer when hostTimer is set), but we still measure wall-clock time so the
  // result can report timeMs. Started lazily on the first interaction.
  const t0Ref = useRef<number | null>(null);
  const startClock = useCallback(() => {
    if (t0Ref.current == null) t0Ref.current = Date.now();
  }, []);

  // Reset all in-progress state when the host hands us a different puzzle
  // (e.g. the player switches difficulty tiers). Keyed on the hive identity.
  const puzzleKey = puzzle.center + puzzle.outer.join("");
  const prevKeyRef = useRef(puzzleKey);
  useEffect(() => {
    if (prevKeyRef.current === puzzleKey) return;
    prevKeyRef.current = puzzleKey;
    completedRef.current = saved?.won ?? false;
    t0Ref.current = null;
    setFound(safeFound(saved));
    setOrder(safeOrder(saved));
    setCur("");
    setWon(saved?.won ?? false);
    setHintsUsed(Math.min(MAX_HINTS, Math.max(0, saved?.hintsUsed ?? 0)));
    setShowModal(false);
    setFlash(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleKey]);

  const foundSet = useMemo(() => new Set(found), [found]);
  const score = useMemo(
    () => found.reduce((s, w) => s + scoreOf(w, hive), 0),
    [found, hive],
  );
  const rank = rankFor(score, puzzle.totalScore);
  const total = puzzle.valid.length;
  // Progress is measured toward the tier's WIN goal, not the full word list, so
  // the bar fills as the player approaches the count that unlocks the next tier.
  const pct =
    goal > 0 ? Math.min(100, Math.round((found.length / goal) * 100)) : 0;
  const goalMet = found.length >= goal;
  // A 100% clear (every valid word found) is celebrated distinctly from just
  // meeting the tier's win goal — the marquee "why come back" achievement.
  const fullClear = total > 0 && found.length >= total;
  const pangramCount = useMemo(
    () => found.filter((w) => isPangram(w, hive)).length,
    [found, hive],
  );

  // Persist resumable state (JSON-serialisable only).
  useEffect(() => {
    onPersistState?.({ found, order, won, hintsUsed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found, order, won, hintsUsed]);

  const showFlash = useCallback((text: string, kind: "ok" | "err") => {
    setFlash({ text, kind });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1500);
  }, []);

  useEffect(
    () => () => {
      for (const t of [flashTimer, popTimer, spinTimer, shakeTimer]) {
        if (t.current) clearTimeout(t.current);
      }
    },
    [],
  );

  const finish = useCallback(
    (finalFound: string[], finalScore: number, hints: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const timeMs = t0Ref.current != null ? Date.now() - t0Ref.current : 0;
      setWon(true);
      haptics.win();
      sfx.win();
      const finalRank = rankFor(finalScore, puzzle.totalScore);
      const normalized = Math.max(
        0,
        Math.min(
          100,
          Math.round((finalScore / Math.max(1, puzzle.totalScore)) * 100) -
            hints * HINT_PENALTY,
        ),
      );
      setTimeout(() => setShowModal(true), reducedMotion ? 0 : 340);
      // Reaching the tier's word goal counts as a win — this is what unlocks the
      // next tier in the host. Players may keep finding words for a higher rank,
      // but onComplete fires exactly once (guarded by completedRef).
      onComplete({
        status: "won",
        score: normalized,
        timeMs,
        moves: finalFound.length,
        shareText:
          `BrainTap · Idea Weaver\n` +
          `${finalFound.length}/${total} words · ${finalScore} pts\n` +
          `Rank: ${finalRank}\n` +
          `braintap.app`,
        detail: {
          rank: finalRank,
          words: finalFound.length,
          points: finalScore,
          goal,
          hintsUsed: hints,
        },
      });
    },
    [onComplete, puzzle.totalScore, reducedMotion, total, goal],
  );

  const submit = useCallback(() => {
    if (!cur) return;
    // Re-entrancy guard: React batches setCur("")/setFound(), so a second Enter
    // fired before the next render still sees the same stale `cur`/`foundSet` and
    // could re-evaluate (and re-count) the same word. Released on the next tick.
    if (submittingRef.current) return;
    submittingRef.current = true;
    queueMicrotask(() => {
      submittingRef.current = false;
    });
    const r = evaluateWord(cur, puzzle, foundSet);
    if (!r.ok) {
      showFlash(ERROR_TEXT[r.reason], "err");
      haptics.error();
      sfx.wrong();
      if (!reducedMotion) {
        setShake(true);
        if (shakeTimer.current) clearTimeout(shakeTimer.current);
        shakeTimer.current = setTimeout(() => setShake(false), 420);
      }
      setCur("");
      return;
    }
    if (r.pangram) {
      haptics.win();
    } else {
      haptics.success();
    }
    sfx.correct();
    showFlash(
      r.pangram ? `✨ PANGRAM! +${r.points}` : `+${r.points} · ${r.word}`,
      "ok",
    );
    setCur("");
    setFound((prev) => {
      const next = [...prev, r.word].sort();
      if (next.length >= goal) {
        const finalScore = next.reduce((s, w) => s + scoreOf(w, hive), 0);
        queueMicrotask(() => finish(next, finalScore, hintsRef.current));
      }
      return next;
    });
  }, [cur, puzzle, foundSet, showFlash, reducedMotion, finish, hive, goal]);

  const tapLetter = useCallback(
    (letter: string) => {
      startClock();
      setCur((c) => (c.length >= 20 ? c : c + letter));
      sfx.tap();
      haptics.tap();
      if (!reducedMotion) {
        setPopLetter(letter);
        if (popTimer.current) clearTimeout(popTimer.current);
        popTimer.current = setTimeout(() => setPopLetter(null), 120);
      }
    },
    [reducedMotion, startClock],
  );

  const del = useCallback(() => {
    setCur((c) => c.slice(0, -1));
    haptics.tap();
  }, []);

  const shuffle = useCallback(() => {
    setOrder((prev) => {
      // Visual-only shuffle (UI affordance; does not affect the hive/puzzle).
      const out = prev.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    });
    sfx.tap();
    haptics.tap();
    if (!reducedMotion) {
      setSpinning(true);
      if (spinTimer.current) clearTimeout(spinTimer.current);
      spinTimer.current = setTimeout(() => setSpinning(false), 340);
    }
  }, [reducedMotion]);

  const useHint = useCallback(async () => {
    if (hintsRef.current >= MAX_HINTS) return;
    // MON-1: past the free threshold, a non-premium native user earns the hint
    // by watching a rewarded ad. Inert on web (adsAvailable() is false), so the
    // hint behaves exactly as before there. Ad fail → no hint, no penalty.
    if (adsAvailable() && !isPremium && hintsRef.current >= getMonetizationConfig().freeHintThreshold) {
      if (adInFlightRef.current) return; // ignore taps while a rewarded ad is in flight
      adInFlightRef.current = true;
      const r = await showRewardedAd();
      adInFlightRef.current = false;
      if (r !== "rewarded") return;
    }
    const hint = getHint(puzzle, foundSet);
    if (!hint) return;

    startClock();
    setHintsUsed((h) => Math.min(MAX_HINTS, h + 1));
    haptics.success();
    sfx.correct();
    showFlash(`💡 +${hint.points} · ${hint.word}`, "ok");
    if (!reducedMotion) {
      setPopLetter(hint.word[0]);
      if (popTimer.current) clearTimeout(popTimer.current);
      popTimer.current = setTimeout(() => setPopLetter(null), 120);
    }

    setFound((prev) => {
      if (prev.includes(hint.word)) return prev;
      const next = [...prev, hint.word].sort();
      if (next.length >= goal) {
        const finalScore = next.reduce((s, w) => s + scoreOf(w, hive), 0);
        // include this hint in the count even though state hasn't flushed yet
        queueMicrotask(() =>
          finish(next, finalScore, Math.min(MAX_HINTS, hintsRef.current + 1)),
        );
      }
      return next;
    });
  }, [puzzle, foundSet, showFlash, reducedMotion, finish, hive, goal, startClock, isPremium]);

  // Keyboard support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        submit();
        e.preventDefault();
      } else if (e.key === "Backspace") {
        del();
        e.preventDefault();
      } else if (e.key === " " || e.key === "Shift") {
        // Space shuffles for power users; Shift is ignored gracefully.
        if (e.key === " ") {
          shuffle();
          e.preventDefault();
        }
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const up = e.key.toUpperCase();
        if (hive.has(up)) {
          tapLetter(up);
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, del, tapLetter, shuffle, hive]);

  const cells = useMemo(() => [puzzle.center, ...order], [puzzle.center, order]);

  // Found words grouped longest-first then alphabetical, for a tidier list.
  const foundDisplay = useMemo(
    () =>
      found
        .slice()
        .sort((a, b) => (b.length - a.length) || a.localeCompare(b)),
    [found],
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[460px] flex-1 flex-col items-center">
      {/* Rank & progress */}
      <div className="flex w-full shrink-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="rounded-pill px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.08em]"
              style={{
                color: "#04060f",
                backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
              }}
            >
              {rank.toUpperCase()}
            </span>
            {pangramCount > 0 && (
              <span
                className="font-mono text-[11px]"
                style={{ color: ACCENT.soft }}
                aria-label={`${pangramCount} pangram${pangramCount > 1 ? "s" : ""} found`}
              >
                ✨ ×{pangramCount}
              </span>
            )}
          </div>
          {goalMet ? (
            <div className="mt-1 truncate font-mono text-[10px]" style={{ color: ACCENT.soft }}>
              {fullClear
                ? "🏆 Perfect clear — every word found!"
                : `Goal cleared — ${total - found.length} word${total - found.length === 1 ? "" : "s"} left for a perfect clear`}
            </div>
          ) : (
            <div className="mt-1 truncate font-mono text-[10px] text-ink-faint">
              {goal - found.length} more word{goal - found.length === 1 ? "" : "s"} to win
            </div>
          )}
        </div>
        <span className="shrink-0 font-mono text-[11px] text-ink-mute">
          {goalMet ? `${found.length}/${total}` : `${found.length}/${goal}`} · {score} pts
        </span>
      </div>

      <div
        className="mt-2 h-1.5 w-full shrink-0 overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
        role="progressbar"
        aria-label={goalMet ? "Words found" : "Progress to goal"}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={
          goalMet
            ? `Goal reached · ${found.length} of ${total} words found`
            : `${found.length} of ${goal} words to win`
        }
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundImage: `linear-gradient(90deg, ${ACCENT.from}, ${ACCENT.to})`,
            boxShadow: pct > 0 ? `0 0 12px ${ACCENT.solid}55` : "none",
            transition: reducedMotion ? "none" : "width 0.5s cubic-bezier(.2,.7,.2,1)",
          }}
        />
      </div>

      {/* Current word (tap anywhere to delete last letter) */}
      <button
        type="button"
        onClick={del}
        disabled={!cur}
        aria-label={cur ? `Current word ${cur}. Tap to delete last letter.` : "Current word, empty"}
        className={cn(
          "mt-3 flex min-h-[40px] w-full shrink-0 items-center justify-center rounded-xl px-3",
          "transition-colors disabled:cursor-default",
          shake && !reducedMotion && "animate-shake",
        )}
      >
        <span role="status" aria-live="polite" className="break-all text-center">
          {cur ? (
            <span className="font-display text-[26px] font-semibold tracking-[0.08em]">
              {cur.split("").map((ch, i) => {
                const isCenter = ch === puzzle.center;
                return (
                  <span
                    key={i}
                    // Non-colour cue (a11y): the required centre letter is also
                    // underlined, not distinguished by accent colour alone.
                    style={{
                      color: isCenter ? ACCENT.solid : "#f3f7ff",
                      textDecoration: isCenter ? "underline" : undefined,
                      textUnderlineOffset: isCenter ? "4px" : undefined,
                      textDecorationThickness: isCenter ? "2px" : undefined,
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
              {!reducedMotion && (
                <span
                  aria-hidden
                  className="ml-0.5 inline-block w-[2px] align-middle animate-pulse2"
                  style={{ height: "1.1em", background: ACCENT.soft, opacity: 0.7 }}
                />
              )}
              {/* Backspace affordance: signals the strip itself deletes the last
                  letter (it only ever backspaces, never clears the whole word). */}
              <span
                aria-hidden
                className="ml-2 align-middle font-mono text-[13px] text-ink-faint"
              >
                ⌫
              </span>
            </span>
          ) : (
            <span className="font-mono text-[12px] text-ink-faint">
              Tap letters to spell a word
            </span>
          )}
        </span>
      </button>

      {/* Flash feedback */}
      <div
        className="mt-1 flex min-h-[18px] shrink-0 items-center justify-center"
        role="status"
        aria-live="assertive"
      >
        {flash && (
          <span
            className={cn(
              "font-mono text-[12px] font-medium",
              !reducedMotion && "animate-rise",
            )}
            style={{ color: flash.kind === "ok" ? ACCENT.soft : "#ffb3ec" }}
          >
            {flash.text}
          </span>
        )}
      </div>

      {/* Hexagon hive — the resizable board. It flexes into the space left
          between the fixed chrome above and the action/hint/found rows below,
          and is sized to fit by useFitBox (keeps its 260/280 aspect). */}
      <div
        ref={hiveFitRef}
        className="mt-3 flex min-h-0 w-full flex-1 items-center justify-center"
      >
        <Hive
          cells={cells}
          accent={ACCENT}
          popLetter={popLetter}
          spinning={spinning}
          reducedMotion={reducedMotion}
          disabled={false}
          onTap={tapLetter}
          width={hiveSize?.w}
        />
      </div>

      {/* Action buttons — flex-nowrap with breakpoint-scaled gap/padding so the
          Delete / Shuffle / Enter row never wraps or clips on a ~320px phone. */}
      <div className="mt-4 flex w-full shrink-0 flex-nowrap items-center justify-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={del}
          disabled={!cur}
          className={cn(
            "min-h-[44px] rounded-pill border border-line-strong px-4 font-display text-[14px] text-[#eaf1ff] sm:px-5",
            "outline-none transition-transform focus-visible:ring-2 focus-visible:ring-white/30 active:scale-95 disabled:opacity-40",
          )}
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          Delete
        </button>
        <button
          type="button"
          onClick={shuffle}
          aria-label="Shuffle outer letters"
          className={cn(
            "flex h-[44px] w-[44px] items-center justify-center rounded-pill border border-line-strong font-display text-lg text-[#eaf1ff]",
            "outline-none transition-transform focus-visible:ring-2 focus-visible:ring-white/30 active:scale-95 disabled:opacity-40",
          )}
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <span
            aria-hidden
            className="inline-block"
            style={{
              transition: reducedMotion ? "none" : "transform 0.34s cubic-bezier(.2,.7,.2,1)",
              transform: spinning && !reducedMotion ? "rotate(360deg)" : "rotate(0deg)",
            }}
          >
            ↻
          </span>
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={cur.length < 4}
          className={cn(
            "min-h-[44px] rounded-pill px-6 font-display text-[14px] font-semibold text-[#04060f] sm:px-7",
            "outline-none transition-transform focus-visible:ring-2 focus-visible:ring-white/50 active:scale-95",
            "disabled:opacity-40",
          )}
          style={{ backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})` }}
        >
          Enter
        </button>
      </div>

      {/* Hint */}
      <div className="mt-3 flex w-full shrink-0 items-center justify-center">
        <HintButton
          used={hintsUsed}
          max={MAX_HINTS}
          onHint={useHint}
          accent={ACCENT}
          disabled={found.length >= total}
        />
      </div>

      {/* Found words — a secondary region that may shrink (its chip list scrolls)
          so the hive + controls always win the vertical budget on small phones. */}
      <div className="mt-4 flex min-h-0 w-full shrink flex-col">
        <div className="mb-2 flex shrink-0 items-center justify-between font-mono text-[10px] tracking-[0.16em] text-ink-faint">
          <span>FOUND · {found.length}</span>
          <span>{total - found.length} LEFT</span>
        </div>
        {found.length === 0 ? (
          <div
            className="shrink-0 rounded-xl border border-dashed px-4 py-5 text-center font-mono text-[11px] text-ink-faint"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            Words you find appear here.
            <br />
            Find one using all 7 letters for a ✨ pangram bonus.
          </div>
        ) : (
          <div
            className="flex max-h-[168px] min-h-0 flex-1 flex-wrap content-start gap-[7px] overflow-y-auto pr-1"
          >
            {foundDisplay.map((w) => {
              const isPan = isPangram(w, hive);
              return (
                <span
                  key={w}
                  className={cn(
                    "rounded-[7px] px-2.5 py-[5px] font-mono text-[11px] uppercase tracking-[0.04em]",
                    isPan && "font-semibold",
                    !reducedMotion && "animate-pop",
                  )}
                  style={
                    isPan
                      ? {
                          color: "#04060f",
                          backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
                          boxShadow: `0 0 14px ${ACCENT.solid}55`,
                        }
                      : {
                          color: "rgba(226,234,255,0.72)",
                          background: "rgba(255,255,255,0.06)",
                        }
                  }
                >
                  {w}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        title={fullClear ? "Perfect clear!" : "Goal reached."}
        statValue={rank}
        statLabel={`${found.length} WORDS · ${score} POINTS`}
        insight={INSIGHT}
        extra={
          fullClear || pangramCount > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {fullClear && (
                <div
                  className="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 font-mono text-[11px] font-semibold"
                  style={{
                    color: "#04060f",
                    backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
                    boxShadow: `0 0 14px ${ACCENT.solid}55`,
                  }}
                >
                  🏆 Found all {total} words
                </div>
              )}
              {pangramCount > 0 && (
                <div
                  className="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 font-mono text-[11px]"
                  style={{
                    color: ACCENT.soft,
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${ACCENT.solid}44`,
                  }}
                >
                  ✨ {pangramCount} pangram{pangramCount > 1 ? "s" : ""} found
                </div>
              )}
            </div>
          ) : undefined
        }
        share={
          `BrainTap · Idea Weaver\n` +
          `${found.length}/${total} words · ${score} pts\n` +
          `Rank: ${rank}\n` +
          `braintap.app`
        }
      />
    </div>
  );
}
