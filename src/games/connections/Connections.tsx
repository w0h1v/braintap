"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { HintButton } from "@/components/play/HintButton";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import {
  GROUP_COUNT,
  GROUP_SIZE,
  GROUP_EMOJI,
  MAX_MISTAKES,
  evaluateGuess,
  getHint,
  groupOf,
  type ConnectionsPuzzle,
} from "./engine";

/**
 * Live mistake allowance for a puzzle. Falls back to the legacy constant when a
 * puzzle predates the per-tier `maxMistakes` field so older states never crash.
 */
function maxMistakesFor(puzzle: ConnectionsPuzzle): number {
  return typeof puzzle.maxMistakes === "number" ? puzzle.maxMistakes : MAX_MISTAKES;
}

const ACCENT = GAME_METAS.connections.accent;

/** Hints allowed per game. */
const MAX_HINTS = 1;
/** Score penalty per hint used on a win. */
const HINT_PENALTY = 20;

interface ConnectionsState {
  /** Words still on the board, in their current display order. */
  remaining: string[];
  /** Indices (into puzzle.groups) of solved groups, in solve order. */
  solvedOrder: number[];
  /** Each guess recorded as group-index per word, for the emoji share grid. */
  history: number[][];
  mistakes: number;
  /** Number of hints used (auto-revealed categories). */
  hintsUsed: number;
  /** "playing" | "won" | "lost" */
  status: "playing" | "won" | "lost";
}

function emojiFor(gi: number): string {
  return GROUP_EMOJI[gi] ?? "⬛";
}

/**
 * Per-word font sizing. Tiles are fluid (a quarter of the board minus gaps), so
 * we shrink long words aggressively to guarantee they never overflow or overlap
 * their neighbours down to a 360px viewport.
 */
function fontSizeFor(word: string): string {
  const len = word.length;
  if (len >= 15) return "clamp(6.5px, 1.9vw, 9.5px)";
  if (len >= 13) return "clamp(7.5px, 2.2vw, 10.5px)";
  if (len >= 11) return "clamp(8.5px, 2.6vw, 11.5px)";
  if (len >= 9) return "clamp(9.5px, 2.9vw, 12.5px)";
  if (len >= 7) return "clamp(11px, 3.3vw, 13.5px)";
  return "clamp(12px, 3.6vw, 15px)";
}

export function Connections({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
}: GameComponentProps<ConnectionsPuzzle, ConnectionsState>) {
  const saved = savedState ?? null;

  const [remaining, setRemaining] = useState<string[]>(
    () => saved?.remaining ?? puzzle.tiles.slice(),
  );
  const [solvedOrder, setSolvedOrder] = useState<number[]>(
    () => saved?.solvedOrder ?? [],
  );
  const [history, setHistory] = useState<number[][]>(() => saved?.history ?? []);
  const [mistakes, setMistakes] = useState<number>(() => saved?.mistakes ?? 0);
  const [hintsUsed, setHintsUsed] = useState<number>(() => saved?.hintsUsed ?? 0);
  const [status, setStatus] = useState<ConnectionsState["status"]>(
    () => saved?.status ?? "playing",
  );

  const [selected, setSelected] = useState<string[]>([]);
  /** Keyboard cursor: index into `remaining` of the focused tile (roving tabindex). */
  const [focusIndex, setFocusIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const [shaking, setShaking] = useState<string[]>([]);
  const [justSolved, setJustSolved] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const completedRef = useRef(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Monotonic counter driving the (deterministic, UI-only) shuffle. */
  const shuffleSeed = useRef(1);
  /** DOM refs for each tile button, so the cursor can move actual focus. */
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /** True only after a real key press, so we don't yank focus on mount/touch. */
  const keyboardActive = useRef(false);

  /** Number of columns in the tile grid (matches grid-cols-4). */
  const GRID_COLS = 4;

  const maxMistakes = maxMistakesFor(puzzle);
  /** Show near-miss "one away" feedback only when the tier allows it. */
  const showOneAway = puzzle.oneAway !== false;

  const gameOver = status !== "playing";
  const won = status === "won";
  const lost = status === "lost";
  const flawless = won && mistakes === 0;
  const mistakesLeft = maxMistakes - mistakes;

  // Persist resumable state.
  useEffect(() => {
    onPersistState?.({
      remaining,
      solvedOrder,
      history,
      mistakes,
      hintsUsed,
      status,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, solvedOrder, history, mistakes, hintsUsed, status]);

  // Clean up the message timer on unmount.
  useEffect(() => {
    return () => {
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
  }, []);

  const flash = useCallback((text: string, tone: "info" | "error" = "info") => {
    setMessage(text);
    setMessageTone(tone);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMessage(""), 1800);
  }, []);

  const buildShare = useCallback(
    (didWin: boolean, hist: number[][], miss: number) => {
      const grid = hist.map((row) => row.map(emojiFor).join("")).join("\n");
      const head = didWin
        ? `Solved · ${miss} mistake${miss === 1 ? "" : "s"}`
        : "Missed it";
      return `BrainTap · Neural Connections\n${head}\n\n${grid}\nbraintap.app/games`;
    },
    [],
  );

  const finish = useCallback(
    (
      didWin: boolean,
      finalSolved: number[],
      hist: number[][],
      miss: number,
      hints: number,
    ) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setStatus(didWin ? "won" : "lost");
      if (didWin) {
        haptics.win();
        sfx.win();
      } else {
        haptics.error();
        sfx.wrong();
      }
      const baseScore = didWin
        ? Math.max(40, 100 - miss * 12)
        : Math.round((finalSolved.length / GROUP_COUNT) * 35);
      // Hints cost score notably and bar a 3-star win.
      const score = Math.max(0, baseScore - hints * HINT_PENALTY);
      const stars: 1 | 2 | 3 = didWin
        ? miss === 0 && hints === 0
          ? 3
          : miss <= 2 && hints <= 1
            ? 2
            : 1
        : 1;
      const delay = reducedMotion ? 0 : didWin ? 520 : 640;
      setTimeout(() => setShowModal(true), delay);
      onComplete({
        status: didWin ? "won" : "lost",
        score,
        mistakes: miss,
        stars,
        shareText: buildShare(didWin, hist, miss),
        detail: { solved: finalSolved.length, hintsUsed: hints },
      });
    },
    [onComplete, reducedMotion, buildShare],
  );

  const toggle = useCallback(
    (word: string) => {
      if (gameOver) return;
      let changed = false;
      setSelected((prev) => {
        if (prev.includes(word)) {
          changed = true;
          return prev.filter((w) => w !== word);
        }
        if (prev.length >= GROUP_SIZE) return prev; // full — ignore
        changed = true;
        return [...prev, word];
      });
      if (changed) {
        sfx.tap();
        haptics.tap();
      }
    },
    [gameOver],
  );

  const submit = useCallback(() => {
    if (gameOver || selected.length !== GROUP_SIZE) return;

    const ev = evaluateGuess(puzzle, selected);
    const row = selected.map((w) => groupOf(puzzle, w));
    const nextHistory = [...history, row];
    setHistory(nextHistory);

    if (ev.result === "correct") {
      const gi = ev.groupIndex;
      const groupWords = new Set(puzzle.groups[gi].words);
      const nextRemaining = remaining.filter((w) => !groupWords.has(w));
      const nextSolved = [...solvedOrder, gi];
      setRemaining(nextRemaining);
      setSolvedOrder(nextSolved);
      setSelected([]);
      setJustSolved(gi);
      haptics.success();
      sfx.correct();
      if (nextSolved.length === GROUP_COUNT) {
        finish(true, nextSolved, nextHistory, mistakes, hintsUsed);
      } else {
        flash(`Nice — ${GROUP_COUNT - nextSolved.length} to go`, "info");
      }
      return;
    }

    // wrong or one-away
    const nextMistakes = mistakes + 1;
    setMistakes(nextMistakes);
    setShaking(selected);
    haptics.error();
    sfx.wrong();
    flash(
      ev.result === "one-away" && showOneAway
        ? "So close — one away"
        : "Not a group",
      "error",
    );
    setTimeout(() => setShaking([]), reducedMotion ? 0 : 520);

    if (nextMistakes >= maxMistakes) {
      // reveal remaining groups, then end.
      const revealed = puzzle.groups
        .map((_, i) => i)
        .filter((i) => !solvedOrder.includes(i));
      const finalSolved = [...solvedOrder, ...revealed];
      setSolvedOrder(finalSolved);
      setRemaining([]);
      setSelected([]);
      finish(false, solvedOrder, nextHistory, nextMistakes, hintsUsed);
    }
  }, [
    gameOver,
    selected,
    puzzle,
    history,
    remaining,
    solvedOrder,
    mistakes,
    hintsUsed,
    finish,
    flash,
    reducedMotion,
    maxMistakes,
    showOneAway,
  ]);

  const shuffle = useCallback(() => {
    if (gameOver) return;
    setRemaining((prev) => {
      // Deterministic, UI-only visual reshuffle (does not touch puzzle data and
      // never uses Date.now / Math.random). A monotonic seed varies the order on
      // each press while keeping behaviour reproducible.
      const seed = shuffleSeed.current++;
      const a = prev.slice();
      let s = (seed * 2654435761) >>> 0;
      for (let i = a.length - 1; i > 0; i--) {
        s = (s * 48271 + 1) >>> 0;
        const j = s % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
    sfx.tap();
    haptics.tap();
  }, [gameOver]);

  const deselect = useCallback(() => {
    if (gameOver || selected.length === 0) return;
    setSelected([]);
    sfx.tap();
    haptics.tap();
  }, [gameOver, selected.length]);

  const useHint = useCallback(() => {
    if (gameOver || hintsUsed >= MAX_HINTS) return;
    const gi = getHint(puzzle, solvedOrder);
    if (gi < 0) return; // nothing left to reveal

    const groupWords = new Set(puzzle.groups[gi].words);
    const nextRemaining = remaining.filter((w) => !groupWords.has(w));
    const nextSolved = [...solvedOrder, gi];
    const nextHints = hintsUsed + 1;

    setRemaining(nextRemaining);
    setSolvedOrder(nextSolved);
    setSelected((prev) => prev.filter((w) => !groupWords.has(w)));
    setHintsUsed(nextHints);
    setJustSolved(gi);
    haptics.success();
    sfx.correct();

    if (nextSolved.length === GROUP_COUNT) {
      finish(true, nextSolved, history, mistakes, nextHints);
    } else {
      flash(
        `Hint — "${puzzle.groups[gi].label}" revealed`,
        "info",
      );
    }
  }, [
    gameOver,
    hintsUsed,
    puzzle,
    solvedOrder,
    remaining,
    history,
    mistakes,
    finish,
    flash,
  ]);

  // Keyboard: Enter submits, Escape / Backspace deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (e.key === "Enter" && selected.length === GROUP_SIZE) {
        submit();
        e.preventDefault();
      } else if (e.key === "Escape" || e.key === "Backspace") {
        if (selected.length > 0) e.preventDefault();
        deselect();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gameOver, selected.length, submit, deselect]);

  // Drop the solve-pop highlight once it has played.
  useEffect(() => {
    if (justSolved == null) return;
    const t = setTimeout(() => setJustSolved(null), reducedMotion ? 0 : 560);
    return () => clearTimeout(t);
  }, [justSolved, reducedMotion]);

  // Keep the keyboard cursor in range as tiles are removed (solves / hints) or
  // reordered (shuffle). Clamp to the last valid tile.
  useEffect(() => {
    setFocusIndex((i) => {
      if (remaining.length === 0) return 0;
      return Math.min(Math.max(i, 0), remaining.length - 1);
    });
  }, [remaining.length]);

  // Move actual DOM focus to the cursor tile, but only when the user is driving
  // with the keyboard (so we never steal focus on mount, touch, or shuffle).
  useEffect(() => {
    if (!keyboardActive.current || gameOver) return;
    tileRefs.current[focusIndex]?.focus();
  }, [focusIndex, remaining, gameOver]);

  /**
   * Grid keyboard handler: arrow keys move the cursor between tiles, Enter/Space
   * toggle the focused tile, and (when four are selected) Enter submits.
   */
  const onGridKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (gameOver || remaining.length === 0) return;
      const n = remaining.length;
      const row = Math.floor(focusIndex / GRID_COLS);
      const col = focusIndex % GRID_COLS;
      const rows = Math.ceil(n / GRID_COLS);

      const moveTo = (next: number) => {
        keyboardActive.current = true;
        setFocusIndex(Math.min(Math.max(next, 0), n - 1));
      };

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          moveTo(col > 0 ? focusIndex - 1 : focusIndex);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveTo(col < GRID_COLS - 1 ? focusIndex + 1 : focusIndex);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveTo(row > 0 ? focusIndex - GRID_COLS : focusIndex);
          break;
        case "ArrowDown": {
          e.preventDefault();
          if (row < rows - 1) moveTo(Math.min(focusIndex + GRID_COLS, n - 1));
          break;
        }
        case "Home":
          e.preventDefault();
          moveTo(0);
          break;
        case "End":
          e.preventDefault();
          moveTo(n - 1);
          break;
        case " ":
        case "Spacebar":
          // Space always toggles the focused tile.
          e.preventDefault();
          keyboardActive.current = true;
          toggle(remaining[focusIndex]);
          break;
        case "Enter":
          // Enter submits a full selection, otherwise toggles the focused tile.
          // Stop the event reaching the window-level handler so submit fires once.
          e.preventDefault();
          e.stopPropagation();
          keyboardActive.current = true;
          if (selected.length === GROUP_SIZE) submit();
          else toggle(remaining[focusIndex]);
          break;
        default:
          break;
      }
    },
    [gameOver, remaining, focusIndex, selected.length, toggle, submit],
  );

  const modalInsight = useMemo(() => {
    // On a win, highlight the hardest (last) category; on a loss, the most
    // recently revealed one.
    const target = won
      ? puzzle.groups[GROUP_COUNT - 1]
      : puzzle.groups[solvedOrder[solvedOrder.length - 1]] ?? puzzle.groups[0];
    return `"${target.label}" — ${target.insight}`;
  }, [won, puzzle.groups, solvedOrder]);

  const shareString = buildShare(won, history, mistakes);

  const selectionFull = selected.length === GROUP_SIZE;
  const messageColor = messageTone === "error" ? "#ff9bbf" : ACCENT.soft;

  return (
    <div className="flex w-full flex-col items-center">
      <p
        className="mb-1.5 text-center font-mono text-[10.5px] tracking-[0.16em]"
        style={{ color: ACCENT.soft }}
      >
        CREATE FOUR GROUPS OF FOUR
      </p>

      {/* message / status area (live region) */}
      <div
        className="flex min-h-[24px] items-center justify-center px-2 text-center font-mono text-[12.5px] tracking-[0.03em]"
        style={{ color: messageColor }}
        aria-live="polite"
        role="status"
      >
        {message ||
          (lost
            ? "Out of guesses — solution revealed"
            : won
              ? "All four groups found!"
              : selectionFull
                ? "Tap Submit to lock in your group"
                : "")}
      </div>

      <div className="w-full" style={{ maxWidth: "min(94vw, 420px)" }}>
        {/* solved categories */}
        {solvedOrder.length > 0 && (
          <div className="mb-2 flex flex-col gap-2">
            {solvedOrder.map((gi) => {
              const g = puzzle.groups[gi];
              const isFresh = gi === justSolved && !reducedMotion;
              return (
                <div
                  key={g.label}
                  className={cn(
                    "rounded-xl px-3 py-2.5",
                    isFresh && "animate-solve",
                    !reducedMotion && !isFresh && "animate-pop",
                  )}
                  style={{
                    background: g.color,
                    boxShadow: isFresh
                      ? `0 0 0 1px ${g.color}, 0 8px 26px ${g.color}55`
                      : `0 4px 16px ${g.color}33`,
                  }}
                >
                  <div
                    className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: "rgba(4,6,15,0.68)" }}
                  >
                    {g.label}
                  </div>
                  <div
                    className="mt-0.5 break-words font-display text-[14.5px] font-semibold leading-snug"
                    style={{ color: "#04060f" }}
                  >
                    {g.words.join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* grid */}
        {remaining.length > 0 && (
          <div
            className="grid grid-cols-4 gap-1.5 sm:gap-2"
            role="grid"
            aria-label="Connections tiles. Use arrow keys to move, Space to select, Enter to submit four."
            onKeyDown={onGridKeyDown}
          >
            {remaining.map((word, i) => {
              const isSel = selected.includes(word);
              const isShaking = shaking.includes(word);
              const isCursor = i === focusIndex;
              const selIndex = selected.indexOf(word);
              return (
                <button
                  key={word}
                  ref={(el) => {
                    tileRefs.current[i] = el;
                  }}
                  type="button"
                  role="gridcell"
                  aria-selected={isSel}
                  aria-label={`${word}${isSel ? `, selected ${selIndex + 1} of ${GROUP_SIZE}` : ""}`}
                  disabled={gameOver}
                  // Roving tabindex: only the cursor tile is in the tab order.
                  tabIndex={isCursor ? 0 : -1}
                  onClick={() => {
                    keyboardActive.current = false;
                    setFocusIndex(i);
                    toggle(word);
                  }}
                  onFocus={() => setFocusIndex(i)}
                  className={cn(
                    "group relative flex min-h-[52px] items-center justify-center overflow-hidden rounded-[11px] p-1 text-center font-display font-semibold uppercase leading-[1.08] transition-[transform,box-shadow,background-color,color] duration-150 active:scale-[0.94] outline-none disabled:cursor-default",
                    // Visible keyboard focus ring (only shows on keyboard focus).
                    "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-offset-0",
                    isShaking && !reducedMotion && "animate-shake",
                    !reducedMotion && "motion-safe:animate-pop",
                  )}
                  style={{
                    aspectRatio: "1.3 / 1",
                    letterSpacing: "0.01em",
                    fontSize: fontSizeFor(word),
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    hyphens: "auto",
                    willChange: isShaking ? "transform" : undefined,
                    animationDelay:
                      !reducedMotion && !isShaking ? `${Math.min(i, 15) * 18}ms` : undefined,
                    color: isSel ? "#eafcff" : "#e7eeff",
                    background: isSel
                      ? "linear-gradient(160deg,#1b2a52,#243a6e)"
                      : "rgba(255,255,255,0.055)",
                    boxShadow: isSel
                      ? `inset 0 0 0 1.5px ${ACCENT.solid}99, 0 4px 16px ${ACCENT.solid}3a`
                      : "inset 0 0 0 1px rgba(255,255,255,0.06)",
                    // Tailwind ring colour, consumed by focus-visible:ring-2 above.
                    ["--tw-ring-color" as string]: ACCENT.solid,
                  }}
                >
                  {word}
                </button>
              );
            })}
          </div>
        )}

        {/* mistakes tracker */}
        {!won && (
          <div className="mt-4 flex items-center justify-center gap-2.5">
            <span
              className="font-mono text-[11.5px]"
              style={{ color: "rgba(226,234,255,0.55)" }}
            >
              Mistakes
            </span>
            <div
              className="flex gap-[7px]"
              role="img"
              aria-label={`${mistakes} of ${maxMistakes} mistakes used, ${mistakesLeft} remaining`}
            >
              {Array.from({ length: maxMistakes }, (_, i) => {
                const used = i < mistakes;
                return (
                  <span
                    key={i}
                    className="h-3 w-3 rounded-full transition-all duration-300"
                    style={{
                      background: used
                        ? "rgba(255,155,191,0.85)"
                        : "rgba(255,255,255,0.12)",
                      boxShadow: used ? "0 0 8px rgba(255,107,157,0.45)" : "none",
                      transform: used ? "scale(1)" : "scale(0.85)",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* actions */}
        {!gameOver && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={shuffle}
              className="min-h-[44px] rounded-pill border border-white/20 px-5 py-2.5 font-display text-sm text-[#eaf1ff] transition-colors duration-150 hover:border-white/35 hover:bg-white/[0.07] active:scale-[0.97]"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              Shuffle
            </button>
            <button
              type="button"
              onClick={deselect}
              disabled={selected.length === 0}
              className="min-h-[44px] rounded-pill border border-white/20 px-5 py-2.5 font-display text-sm text-[#eaf1ff] transition-colors duration-150 hover:border-white/35 hover:bg-white/[0.07] active:scale-[0.97] disabled:opacity-40 disabled:hover:border-white/20 disabled:hover:bg-white/[0.04]"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              Deselect all
            </button>
            <HintButton
              used={hintsUsed}
              max={MAX_HINTS}
              onHint={useHint}
              accent={ACCENT}
              disabled={gameOver}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!selectionFull}
              aria-label={
                selectionFull
                  ? "Submit your group of four"
                  : `Select ${GROUP_SIZE - selected.length} more to submit`
              }
              className="min-h-[44px] rounded-pill px-6 py-2.5 font-display text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
              style={
                selectionFull
                  ? {
                      color: "#04060f",
                      backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
                      border: "1px solid transparent",
                      boxShadow: `0 8px 26px ${ACCENT.solid}3a`,
                    }
                  : {
                      color: "rgba(226,234,255,0.4)",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      opacity: 0.55,
                    }
              }
            >
              Submit{selected.length > 0 && !selectionFull ? ` · ${selected.length}/${GROUP_SIZE}` : ""}
            </button>
          </div>
        )}

        {/* compact end-of-game banner (modal carries the full result) */}
        {gameOver && !showModal && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-5 min-h-[44px] w-full rounded-pill border px-5 py-2.5 font-display text-sm font-semibold transition-transform duration-150 active:scale-[0.98]"
            style={{
              color: ACCENT.solid,
              borderColor: `${ACCENT.solid}55`,
              background: `${ACCENT.solid}12`,
            }}
          >
            View result
          </button>
        )}
      </div>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        won={won}
        eyebrow="PUZZLE COMPLETE"
        title={won ? (flawless ? "Flawless." : "Solved!") : "So close."}
        statValue={`${solvedOrder.length}/${GROUP_COUNT}`}
        statLabel="GROUPS FOUND"
        insight={modalInsight}
        share={shareString}
        extra={
          history.length > 0 ? (
            <pre
              className="mx-auto inline-block font-mono text-[18px] leading-[1.25]"
              style={{ letterSpacing: "2px" }}
              aria-hidden
            >
              {history.map((row) => row.map(emojiFor).join("")).join("\n")}
            </pre>
          ) : undefined
        }
      />
    </div>
  );
}
