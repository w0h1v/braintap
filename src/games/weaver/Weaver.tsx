"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { HintButton } from "@/components/play/HintButton";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import { Hive } from "./Hive";
import {
  evaluateWord,
  getHint,
  hiveLetters,
  rankFor,
  RANKS,
  scoreOf,
  type SubmitError,
  type WeaverPuzzle,
} from "./engine";

const MAX_HINTS = 3;
/** Score deducted per hint used (applied to the final normalized score). */
const HINT_PENALTY = 5;

const ACCENT = GAME_METAS.weaver.accent;
const INSIGHT =
  "Hunting for words from a fixed set of letters exercises your brain's lexical retrieval network — the same word-finding circuitry that keeps verbal fluency sharp with age.";

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

export function Weaver({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
}: GameComponentProps<WeaverPuzzle, WeaverState>) {
  const saved = savedState ?? null;
  const hive = useMemo(() => hiveLetters(puzzle), [puzzle]);

  const [found, setFound] = useState<string[]>(() => saved?.found ?? []);
  const [order, setOrder] = useState<string[]>(
    () => saved?.order ?? puzzle.outer.slice(),
  );
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
  const completedRef = useRef(false);
  const hintsRef = useRef(hintsUsed);
  hintsRef.current = hintsUsed;

  const foundSet = useMemo(() => new Set(found), [found]);
  const score = useMemo(
    () => found.reduce((s, w) => s + scoreOf(w, hive), 0),
    [found, hive],
  );
  const rank = rankFor(score, puzzle.totalScore);
  const total = puzzle.valid.length;
  const pct = total > 0 ? Math.round((found.length / total) * 100) : 0;
  const pangramCount = useMemo(
    () => found.filter((w) => w.length === 7 && evaluateWord(w, puzzle, new Set()).ok).length,
    [found, puzzle],
  );

  // Distance to the next rank, for a small motivating hint under the rank pill.
  const nextRank = useMemo(() => {
    if (puzzle.totalScore <= 0) return null;
    const cur = score / puzzle.totalScore;
    for (const [threshold, label] of RANKS) {
      if (cur < threshold) {
        const need = Math.ceil(threshold * puzzle.totalScore) - score;
        return { label, need: Math.max(1, need) };
      }
    }
    return null;
  }, [score, puzzle.totalScore]);

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
      onComplete({
        status: "won",
        score: normalized,
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
          hintsUsed: hints,
        },
      });
    },
    [onComplete, puzzle.totalScore, reducedMotion, total],
  );

  const submit = useCallback(() => {
    if (won) return;
    if (!cur) return;
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
      if (next.length === puzzle.valid.length) {
        const finalScore = next.reduce((s, w) => s + scoreOf(w, hive), 0);
        queueMicrotask(() => finish(next, finalScore, hintsRef.current));
      }
      return next;
    });
  }, [won, cur, puzzle, foundSet, showFlash, reducedMotion, finish, hive]);

  const tapLetter = useCallback(
    (letter: string) => {
      if (won) return;
      setCur((c) => (c.length >= 20 ? c : c + letter));
      sfx.tap();
      haptics.tap();
      if (!reducedMotion) {
        setPopLetter(letter);
        if (popTimer.current) clearTimeout(popTimer.current);
        popTimer.current = setTimeout(() => setPopLetter(null), 120);
      }
    },
    [won, reducedMotion],
  );

  const del = useCallback(() => {
    if (won) return;
    setCur((c) => c.slice(0, -1));
    haptics.tap();
  }, [won]);

  const shuffle = useCallback(() => {
    if (won) return;
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
  }, [won, reducedMotion]);

  const useHint = useCallback(() => {
    if (won) return;
    if (hintsRef.current >= MAX_HINTS) return;
    const hint = getHint(puzzle, foundSet);
    if (!hint) return;

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
      if (next.length === puzzle.valid.length) {
        const finalScore = next.reduce((s, w) => s + scoreOf(w, hive), 0);
        // include this hint in the count even though state hasn't flushed yet
        queueMicrotask(() =>
          finish(next, finalScore, Math.min(MAX_HINTS, hintsRef.current + 1)),
        );
      }
      return next;
    });
  }, [won, puzzle, foundSet, showFlash, reducedMotion, finish, hive]);

  // Keyboard support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won) return;
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
  }, [won, submit, del, tapLetter, shuffle, hive]);

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
    <div className="mx-auto flex w-full max-w-[460px] flex-col items-center">
      {/* Rank & progress */}
      <div className="flex w-full items-end justify-between gap-3">
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
          {nextRank && !won && (
            <div className="mt-1 truncate font-mono text-[10px] text-ink-faint">
              {nextRank.need} pt{nextRank.need > 1 ? "s" : ""} to {nextRank.label}
            </div>
          )}
        </div>
        <span className="shrink-0 font-mono text-[11px] text-ink-mute">
          {found.length}/{total} · {score} pts
        </span>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
        role="progressbar"
        aria-label="Words found"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${found.length} of ${total} words`}
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
        disabled={!cur || won}
        aria-label={cur ? `Current word ${cur}. Tap to delete last letter.` : "Current word, empty"}
        className={cn(
          "mt-5 flex min-h-[40px] w-full items-center justify-center rounded-xl px-3",
          "transition-colors disabled:cursor-default",
          shake && !reducedMotion && "animate-shake",
        )}
      >
        <span role="status" aria-live="polite" className="break-all text-center">
          {cur ? (
            <span className="font-display text-[26px] font-semibold tracking-[0.08em]">
              {cur.split("").map((ch, i) => (
                <span
                  key={i}
                  style={{ color: ch === puzzle.center ? ACCENT.solid : "#f3f7ff" }}
                >
                  {ch}
                </span>
              ))}
              {!reducedMotion && (
                <span
                  aria-hidden
                  className="ml-0.5 inline-block w-[2px] align-middle animate-pulse2"
                  style={{ height: "1.1em", background: ACCENT.soft, opacity: 0.7 }}
                />
              )}
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
        className="mt-1 flex min-h-[18px] items-center justify-center"
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

      {/* Hexagon hive */}
      <div className="mt-3">
        <Hive
          cells={cells}
          accent={ACCENT}
          popLetter={popLetter}
          spinning={spinning}
          reducedMotion={reducedMotion}
          disabled={won}
          onTap={tapLetter}
        />
      </div>

      {/* Action buttons */}
      <div className="mt-5 flex w-full items-center justify-center gap-3">
        <button
          type="button"
          onClick={del}
          disabled={won || !cur}
          className={cn(
            "min-h-[44px] rounded-pill border border-line-strong px-5 font-display text-[14px] text-[#eaf1ff]",
            "outline-none transition-transform focus-visible:ring-2 focus-visible:ring-white/30 active:scale-95 disabled:opacity-40",
          )}
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          Delete
        </button>
        <button
          type="button"
          onClick={shuffle}
          disabled={won}
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
          disabled={won || cur.length < 4}
          className={cn(
            "min-h-[44px] rounded-pill px-7 font-display text-[14px] font-semibold text-[#04060f]",
            "outline-none transition-transform focus-visible:ring-2 focus-visible:ring-white/50 active:scale-95",
            "disabled:opacity-40",
          )}
          style={{ backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})` }}
        >
          Enter
        </button>
      </div>

      {/* Hint */}
      <div className="mt-3 flex w-full items-center justify-center">
        <HintButton
          used={hintsUsed}
          max={MAX_HINTS}
          onHint={useHint}
          accent={ACCENT}
          disabled={won}
        />
      </div>

      {/* Found words */}
      <div className="mt-6 w-full">
        <div className="mb-2 flex items-center justify-between font-mono text-[10px] tracking-[0.16em] text-ink-faint">
          <span>FOUND · {found.length}</span>
          <span>{total - found.length} LEFT</span>
        </div>
        {found.length === 0 ? (
          <div
            className="rounded-xl border border-dashed px-4 py-5 text-center font-mono text-[11px] text-ink-faint"
            style={{ borderColor: "rgba(255,255,255,0.1)" }}
          >
            Words you find appear here.
            <br />
            Find one using all 7 letters for a ✨ pangram bonus.
          </div>
        ) : (
          <div
            className="flex max-h-[168px] flex-wrap content-start gap-[7px] overflow-y-auto pr-1"
          >
            {foundDisplay.map((w) => {
              const pan = evaluateWord(w, puzzle, new Set<string>());
              const isPan = pan.ok && pan.pangram;
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
        title="Hive cleared."
        statValue={rank}
        statLabel={`${found.length} WORDS · ${score} POINTS`}
        insight={INSIGHT}
        extra={
          pangramCount > 0 ? (
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-pill px-3 py-1.5 font-mono text-[11px]"
              style={{
                color: ACCENT.soft,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${ACCENT.solid}44`,
              }}
            >
              ✨ {pangramCount} pangram{pangramCount > 1 ? "s" : ""} found
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
