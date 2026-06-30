"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { useFitBox } from "@/lib/useFitBox";
import { cn } from "@/lib/cn";
import {
  WORD_LEN,
  MAX_ROWS,
  isValidGuess,
  evaluateGuess,
  isWin,
  mergeKeyStates,
  buildShareText,
  computeScore,
  rowToEmoji,
  type BrainlePuzzle,
  type Verdict,
} from "./engine";

/** Resolve the guess allowance for a puzzle, tolerating older saved shapes. */
function maxRowsOf(puzzle: BrainlePuzzle): number {
  const m = puzzle?.maxGuesses;
  return typeof m === "number" && m >= 1 ? m : MAX_ROWS;
}

const ACCENT = GAME_METAS.brainle.accent;
const INSIGHT = GAME_METAS.brainle.insight;

// Tile colours per verdict (Wordle-standard, brain-themed cyan/amber palette).
const VERDICT_BG: Record<Verdict, string> = {
  correct: "#00e5ff",
  present: "#ffb020",
  absent: "rgba(255,255,255,0.06)",
};
const VERDICT_FG: Record<Verdict, string> = {
  correct: "#04060f",
  present: "#04060f",
  absent: "rgba(226,234,255,0.5)",
};
const VERDICT_BORDER: Record<Verdict, string> = {
  correct: "#00e5ff",
  present: "#ffb020",
  absent: "rgba(255,255,255,0.1)",
};
// Subtle neon glow under correct tiles (skipped when reduced motion is on).
const VERDICT_GLOW: Partial<Record<Verdict, string>> = {
  correct: "0 0 18px rgba(0,229,255,0.45)",
  present: "0 0 14px rgba(255,176,32,0.3)",
};

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

// Per-cell flip reveal timing. FLIP_MS matches the Tailwind `animate-flip`
// (btFlip 0.6s) duration; tiles stagger left-to-right by FLIP_STAGGER.
const FLIP_MS = 600;
const FLIP_STAGGER = 90;

// Score penalty applied when the (single-use) hint is revealed, so the hint
// carries a cost like every other game's hint contract.
const HINT_PENALTY = 12;

// Distinct corner glyphs per verdict — a non-colour cue so correct/present are
// distinguishable without relying on hue alone (colour-blind / SR parity).
const VERDICT_GLYPH: Partial<Record<Verdict, string>> = {
  correct: "●",
  present: "◐",
};

interface BrainleState {
  guesses: string[];
  won: boolean;
  over: boolean;
  hintUsed?: boolean;
}

export function Brainle({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
}: GameComponentProps<BrainlePuzzle, BrainleState>) {
  const saved = savedState ?? null;
  const [guesses, setGuesses] = useState<string[]>(() => saved?.guesses ?? []);
  const [current, setCurrent] = useState("");
  const [won, setWon] = useState(saved?.won ?? false);
  const [over, setOver] = useState(saved?.over ?? false);
  const [message, setMessage] = useState("");
  // Consolidated per-guess summary for screen readers (e.g. "2 correct, 1 present").
  const [srSummary, setSrSummary] = useState("");
  const [shake, setShake] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // Index of the row currently playing its flip-reveal (for staggered animation).
  const [revealRow, setRevealRow] = useState<number | null>(null);
  // How many cells of `revealRow` have crossed the flip mid-point and may now
  // paint their verdict colour. Cells before this index show their colour; cells
  // at/after it stay neutral until their own mid-flip timer fires. This makes the
  // flip an actual reveal rather than a cosmetic spin over an already-coloured tile.
  const [revealedCells, setRevealedCells] = useState(0);
  const [hintUsed, setHintUsed] = useState(saved?.hintUsed ?? false);
  const completedRef = useRef(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const midFlipTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const answer = puzzle.answer;
  // Guess allowance comes from the puzzle (tier-dependent); the host controls
  // difficulty, so we read it here rather than hardcoding 6.
  const maxRows = maxRowsOf(puzzle);
  // Size the board to the available height so board + keyboard fit the viewport.
  const { ref: boardFitRef, size: boardSize } = useFitBox<HTMLDivElement>(WORD_LEN, maxRows, 320);

  // Verdicts for already-submitted rows.
  const verdicts = useMemo(
    () => guesses.map((g) => evaluateGuess(g, answer)),
    [guesses, answer],
  );

  // Keyboard colour map derived from all submitted rows.
  const keyStates = useMemo(() => {
    let ks: Record<string, Verdict> = {};
    guesses.forEach((g, i) => {
      ks = mergeKeyStates(ks, g, verdicts[i]);
    });
    return ks;
  }, [guesses, verdicts]);

  // Persist resumable state.
  useEffect(() => {
    onPersistState?.({ guesses, won, over, hintUsed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses, won, over, hintUsed]);

  // If restoring an already-finished game, surface the modal.
  useEffect(() => {
    if (saved?.over && !completedRef.current) {
      completedRef.current = true;
      setShowModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tidy timers on unmount.
  useEffect(
    () => () => {
      if (msgTimer.current) clearTimeout(msgTimer.current);
      if (revealTimer.current) clearTimeout(revealTimer.current);
      midFlipTimers.current.forEach(clearTimeout);
    },
    [],
  );

  // `sticky` keeps the message pinned (used to hold the revealed answer in the
  // message line through the lose beat, until the modal opens).
  const flash = useCallback((text: string, sticky = false) => {
    setMessage(text);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    if (!sticky) msgTimer.current = setTimeout(() => setMessage(""), 1800);
  }, []);

  const doShake = useCallback(() => {
    haptics.error();
    sfx.wrong();
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const finish = useCallback(
    (didWin: boolean, finalGuesses: string[]) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setOver(true);
      setWon(didWin);
      if (didWin) {
        haptics.win();
        sfx.win();
      } else {
        haptics.error();
        sfx.wrong();
      }
      const share = buildShareText(didWin, finalGuesses, answer, maxRows);
      // Let the staggered tile reveal (and win bounce) finish before the modal.
      const delay = reducedMotion ? 200 : FLIP_MS + (WORD_LEN - 1) * FLIP_STAGGER + 420;
      setTimeout(() => setShowModal(true), delay);
      // The hint is a single-use, score-penalised reveal: dock the score on a win
      // when it was used (clamped to the loss floor so it never goes negative).
      const base = computeScore(didWin, finalGuesses.length);
      const score = didWin && hintUsed ? Math.max(20, base - HINT_PENALTY) : base;
      onComplete({
        status: didWin ? "won" : "lost",
        score,
        moves: finalGuesses.length,
        shareText: share,
        detail: { answer, guesses: finalGuesses.length, won: didWin, hintUsed },
      });
    },
    [answer, onComplete, reducedMotion, maxRows, hintUsed],
  );

  const submit = useCallback(() => {
    if (over) return;
    const guess = current.toUpperCase();
    if (guess.length < WORD_LEN) {
      flash("Not enough letters");
      doShake();
      return;
    }
    if (!isValidGuess(guess)) {
      flash("Not in word list");
      doShake();
      return;
    }
    const nextGuesses = [...guesses, guess];
    const submittedRow = nextGuesses.length - 1;
    const v = evaluateGuess(guess, answer);
    const won_ = isWin(v);
    const anyCorrect = v.some((x) => x === "correct");
    const nCorrect = v.filter((x) => x === "correct").length;
    const nPresent = v.filter((x) => x === "present").length;
    setGuesses(nextGuesses);
    setCurrent("");
    setSrSummary(
      won_
        ? `${guess} — solved!`
        : `${guess}: ${nCorrect} correct, ${nPresent} present.`,
    );

    // Feedback for *accepting* the guess. A neutral commit tone for a plain valid
    // guess; the rewarding correct/success cue is reserved for a win or a row that
    // landed at least one correct tile — so a wrong guess no longer sounds like a
    // success.
    if (won_) {
      // Win cue is played by finish() (sfx.win / haptics.win); avoid double-firing.
    } else if (anyCorrect) {
      sfx.correct();
      haptics.success();
    } else {
      sfx.place();
      haptics.tap();
    }

    // Drive the staggered flip-reveal for this row (skipped under reduced motion).
    // Verdict colours stay hidden until each cell crosses the flip mid-point.
    midFlipTimers.current.forEach(clearTimeout);
    midFlipTimers.current = [];
    if (!reducedMotion) {
      setRevealRow(submittedRow);
      setRevealedCells(0);
      for (let c = 0; c < WORD_LEN; c++) {
        midFlipTimers.current.push(
          setTimeout(() => setRevealedCells((n) => Math.max(n, c + 1)), c * FLIP_STAGGER + FLIP_MS / 2),
        );
      }
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => {
        setRevealRow(null);
        setRevealedCells(WORD_LEN);
      }, FLIP_MS + (WORD_LEN - 1) * FLIP_STAGGER + 80);
    } else {
      setRevealedCells(WORD_LEN);
    }

    if (won_) {
      const titles = ["Solved!", "Sharp.", "Locked in.", "Nice synapse."];
      flash(titles[Math.min(nextGuesses.length - 1, titles.length - 1)]);
      finish(true, nextGuesses);
    } else if (nextGuesses.length >= maxRows) {
      // Pin the revealed answer in the message line through the lose beat.
      flash(`The word was ${answer}`, true);
      finish(false, nextGuesses);
    }
  }, [over, current, guesses, answer, flash, doShake, finish, reducedMotion, maxRows]);

  const typeLetter = useCallback(
    (letter: string) => {
      if (over) return;
      if (current.length >= WORD_LEN) return;
      setCurrent((c) => c + letter.toUpperCase());
      sfx.tap();
      haptics.tap();
    },
    [over, current],
  );

  const backspace = useCallback(() => {
    if (over) return;
    setCurrent((c) => c.slice(0, -1));
  }, [over]);

  // Replay the same puzzle from scratch (offered from the completion modal).
  const reset = useCallback(() => {
    midFlipTimers.current.forEach(clearTimeout);
    midFlipTimers.current = [];
    if (msgTimer.current) clearTimeout(msgTimer.current);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    completedRef.current = false;
    setGuesses([]);
    setCurrent("");
    setWon(false);
    setOver(false);
    setMessage("");
    setSrSummary("");
    setShake(false);
    setShowModal(false);
    setRevealRow(null);
    setRevealedCells(0);
    setHintUsed(false);
  }, []);

  // Physical keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (over) return;
      if (e.key === "Enter") {
        submit();
        e.preventDefault();
      } else if (e.key === "Backspace") {
        backspace();
        e.preventDefault();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        typeLetter(e.key);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [over, submit, backspace, typeLetter]);

  const showHint = useCallback(() => {
    if (hintUsed || over) {
      // Already spent: re-show the hint without a second penalty.
      if (hintUsed) flash(`💡 ${puzzle.hint}`);
      return;
    }
    setHintUsed(true);
    flash(`💡 ${puzzle.hint}`);
    haptics.tap();
  }, [flash, puzzle.hint, hintUsed, over]);

  // Per-cell render data for the board (maxRows × WORD_LEN).
  const rows = useMemo(() => {
    return Array.from({ length: maxRows }, (_, r) => {
      if (r < guesses.length) {
        const g = guesses[r];
        return Array.from({ length: WORD_LEN }, (_, c) => ({
          letter: g[c],
          verdict: verdicts[r][c] as Verdict | null,
          live: false,
        }));
      }
      if (r === guesses.length && !over) {
        return Array.from({ length: WORD_LEN }, (_, c) => ({
          letter: current[c] ?? "",
          verdict: null as Verdict | null,
          live: c < current.length,
        }));
      }
      return Array.from({ length: WORD_LEN }, () => ({
        letter: "",
        verdict: null as Verdict | null,
        live: false,
      }));
    });
  }, [guesses, verdicts, current, over, maxRows]);

  const shareString = buildShareText(won, guesses, answer, maxRows);
  const emojiGrid = guesses.map((g) => rowToEmoji(evaluateGuess(g, answer))).join("\n");
  const guessesLeft = maxRows - guesses.length;

  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col items-center", !reducedMotion && "animate-rise")}>
      {/* hint + theme */}
      <div className="mb-2 flex w-full max-w-[360px] shrink-0 items-center justify-between gap-2 px-1">
        <span
          className="font-mono text-[10.5px] tracking-[0.18em]"
          style={{ color: ACCENT.soft }}
        >
          THE MIND
        </span>
        <button
          type="button"
          onClick={showHint}
          disabled={over}
          className={cn(
            "rounded-pill border px-3.5 py-2 font-mono text-[11px] transition-transform",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff2bd6]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#04060f]",
            !over && "active:scale-95",
            over && "opacity-40",
            hintUsed && "opacity-60",
          )}
          style={{
            background: `${ACCENT.solid}1a`,
            borderColor: `${ACCENT.solid}55`,
            color: ACCENT.soft,
          }}
          aria-label={
            hintUsed
              ? "Hint already used — tap to show it again"
              : `Reveal a one-time hint (costs ${HINT_PENALTY} points)`
          }
        >
          {hintUsed ? "Hint used" : `Hint · −${HINT_PENALTY}`}
        </button>
      </div>

      {/* live status / message line */}
      <div
        className={cn(
          "flex min-h-[22px] w-full max-w-[360px] shrink-0 items-center justify-center px-2 text-center font-mono text-[12.5px]",
          !reducedMotion && message && "animate-pop",
        )}
        style={{ color: ACCENT.soft }}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>

      {/* Consolidated per-guess result, announced once per submit (non-visual). */}
      <p className="sr-only" role="status" aria-live="polite">
        {srSummary}
      </p>

      {/* board — flexes to the height left between the fixed header and keyboard,
          sized by aspect ratio so board + keyboard fit the viewport (no scroll). */}
      <div ref={boardFitRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
      <div
        className={cn(
          "grid gap-[6px] transition-[filter] duration-500",
          // Distinct lose cue: desaturate/dim the final board (skipped if reduced motion).
          over && !won && !reducedMotion && "[filter:grayscale(0.7)_brightness(0.82)]",
        )}
        style={{ width: boardSize?.w, height: boardSize?.h, gridTemplateRows: `repeat(${maxRows}, 1fr)` }}
        role="grid"
        aria-label={`Guess board, ${guesses.length} of ${maxRows} guesses used`}
      >
        {rows.map((cells, r) => {
          const isShakeRow = shake && r === guesses.length && !over;
          const isWinRow = won && r === guesses.length - 1;
          const isRevealing = revealRow === r;
          return (
            <div
              key={r}
              role="row"
              className={cn(
                "grid gap-[6px]",
                isShakeRow && !reducedMotion && "animate-shake",
                isWinRow && !reducedMotion && "animate-solve",
              )}
              style={{ gridTemplateColumns: `repeat(${WORD_LEN}, 1fr)` }}
            >
              {cells.map((cell, c) => {
                // While this row flips, hold the verdict colour back until the
                // cell crosses the flip mid-point (tracked by revealedCells). This
                // makes the flip an actual reveal, not a spin over a coloured tile.
                const painted = !isRevealing || c < revealedCells;
                const v = painted ? cell.verdict : null;
                const bg = v ? VERDICT_BG[v] : "rgba(255,255,255,0.04)";
                const fg = v ? VERDICT_FG[v] : "#eaf1ff";
                const border = v
                  ? VERDICT_BORDER[v]
                  : cell.live
                    ? `${ACCENT.solid}88`
                    : "rgba(255,255,255,0.14)";
                const glow =
                  v && !reducedMotion && VERDICT_GLOW[v] ? VERDICT_GLOW[v] : undefined;
                const glyph = v ? VERDICT_GLYPH[v] : undefined;
                return (
                  <div
                    key={c}
                    role="gridcell"
                    aria-label={
                      cell.letter
                        ? `${cell.letter}${cell.verdict ? `, ${cell.verdict}` : ""}`
                        : "empty"
                    }
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-[10px] border-2 font-display font-semibold uppercase",
                      "text-[clamp(20px,6.6vw,28px)] leading-none",
                      "transition-[transform,background-color,border-color] duration-150",
                      // pop only the live cell as a letter lands
                      cell.live && !v && !reducedMotion && "animate-pop",
                      // staggered flip when a row reveals its verdicts
                      cell.verdict && isRevealing && !reducedMotion && "animate-flip",
                    )}
                    style={{
                      background: bg,
                      color: fg,
                      borderColor: border,
                      boxShadow: glow,
                      animationDelay:
                        cell.verdict && isRevealing && !reducedMotion
                          ? `${c * FLIP_STAGGER}ms`
                          : undefined,
                    }}
                  >
                    {cell.letter}
                    {/* Non-colour verdict cue (correct ● / present ◐) for parity
                        without relying on hue alone. */}
                    {glyph && (
                      <span
                        aria-hidden
                        className="absolute right-[3px] top-[2px] text-[9px] leading-none opacity-80"
                      >
                        {glyph}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>

      {/* keyboard — tight gaps + minimal padding so the 10-key top row keeps the
          widest possible per-key target at 360px (KEY-1). */}
      <div className="mt-3 flex w-full max-w-[480px] shrink-0 flex-col items-center gap-[6px] px-0">
        {KEY_ROWS.map((rowKeys, i) => (
          <div key={i} className="flex w-full justify-center gap-[4px]">
            {i === 2 && (
              <KeyButton wide label="Submit guess" onClick={submit} disabled={over}>
                ENTER
              </KeyButton>
            )}
            {rowKeys.split("").map((letter) => (
              <KeyButton
                key={letter}
                label={letter}
                onClick={() => typeLetter(letter)}
                disabled={over}
                verdict={keyStates[letter]}
              >
                {letter}
              </KeyButton>
            ))}
            {i === 2 && (
              <KeyButton wide label="Delete letter" onClick={backspace} disabled={over}>
                ⌫
              </KeyButton>
            )}
          </div>
        ))}
      </div>

      {/* guesses-remaining helper (screen-reader friendly, subtle visual) */}
      <p
        className="mt-3 font-mono text-[10.5px] tracking-[0.14em] text-ink-faint"
        aria-live="polite"
      >
        {over
          ? won
            ? "SOLVED"
            : `THE WORD WAS ${answer}`
          : `${guessesLeft} ${guessesLeft === 1 ? "GUESS" : "GUESSES"} LEFT`}
      </p>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        eyebrow="PUZZLE COMPLETE"
        won={won}
        title={won ? "Nice synapse." : "Out of guesses"}
        statValue={won ? `${guesses.length}/${maxRows}` : `X/${maxRows}`}
        statLabel={won ? "GUESSES" : answer}
        insight={INSIGHT}
        share={shareString}
        onReplay={reset}
        replayLabel="Play again"
        extra={
          emojiGrid ? (
            <div className="flex flex-col items-center gap-2">
              <pre className="font-mono text-[18px] leading-[1.2] tracking-[2px]">{emojiGrid}</pre>
              <p className="font-mono text-[10.5px] tracking-[0.12em] text-ink-faint">
                {won
                  ? `SOLVED IN ${guesses.length}/${maxRows}`
                  : `${guesses.length}/${maxRows} USED`}
                {hintUsed ? ` · HINT (−${HINT_PENALTY})` : ""}
              </p>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}

function KeyButton({
  children,
  label,
  onClick,
  disabled,
  wide,
  verdict,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  wide?: boolean;
  verdict?: Verdict;
}) {
  let bg = "rgba(255,255,255,0.08)";
  let color = "#eaf1ff";
  if (verdict === "correct") {
    bg = "#00e5ff";
    color = "#04060f";
  } else if (verdict === "present") {
    bg = "#ffb020";
    color = "#04060f";
  } else if (verdict === "absent") {
    bg = "rgba(255,255,255,0.03)";
    color = "rgba(226,234,255,0.35)";
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex h-[52px] min-w-0 items-center justify-center rounded-[8px] px-0 font-display font-semibold",
        "transition-[transform,background-color,color] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e5ff]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[#04060f]",
        wide ? "flex-[1.4] text-[11px]" : "flex-1 text-[15px]",
      )}
      style={{ background: bg, color }}
    >
      {children}
    </button>
  );
}
