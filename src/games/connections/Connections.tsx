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
import { useFitBox } from "@/lib/useFitBox";
import { useEntitlement } from "@/lib/entitlement";
import { adsAvailable, showRewardedAd } from "@/lib/ads";
import { getMonetizationConfig } from "@/lib/config";
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
export const MAX_HINTS = 1;
/** Score penalty per hint used on a win. */
const HINT_PENALTY = 20;

interface ConnectionsState {
  /** Words still on the board, in their current display order. */
  remaining: string[];
  /** Indices (into puzzle.groups) of solved groups, in solve order. */
  solvedOrder: number[];
  /**
   * How many of `solvedOrder` the player genuinely earned (by submitting a
   * correct guess or spending a hint). Any groups beyond this index were
   * auto-revealed on a loss and must NOT read as celebratory solves.
   */
  earnedCount: number;
  /** True when the loss was a voluntary give-up, not running out of guesses. */
  gaveUp?: boolean;
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

/** Spoken word for an emoji colour, so screen readers get the share grid too. */
const EMOJI_WORD = ["yellow", "green", "blue", "purple"] as const;
function emojiWordFor(gi: number): string {
  return EMOJI_WORD[gi] ?? "blank";
}

/** Roman-style ordinal label for the category's tier order (non-color cue). */
const TIER_ORDINAL = ["1st", "2nd", "3rd", "4th"] as const;

/**
 * Per-word font sizing. Tiles are fluid (a quarter of the board minus gaps), so
 * we shrink long words aggressively to guarantee they never overflow or overlap
 * their neighbours down to a 360px viewport.
 */
function fontSizeFor(word: string): string {
  // Floor raised to 9px so even the longest pool terms (17ch) stay legible on a
  // 360px viewport. Tiles already wrap (overflow-wrap:anywhere) and clip-guard
  // with overflow-hidden, so the larger floor wraps onto two lines rather than
  // shrinking into sub-legible 6.5px text.
  const len = word.length;
  if (len >= 15) return "clamp(9px, 2.4vw, 10.5px)";
  if (len >= 13) return "clamp(9.5px, 2.6vw, 11px)";
  if (len >= 11) return "clamp(10px, 2.8vw, 11.5px)";
  if (len >= 9) return "clamp(10.5px, 3vw, 12.5px)";
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
  const { isPremium } = useEntitlement();

  const [remaining, setRemaining] = useState<string[]>(
    () => saved?.remaining ?? puzzle.tiles.slice(),
  );
  const [solvedOrder, setSolvedOrder] = useState<number[]>(
    () => saved?.solvedOrder ?? [],
  );
  // How many entries of `solvedOrder` the player actually earned. On a resumed
  // For a legacy loss with no stored earnedCount, approximate it from how many
  // groups were genuinely earned — correct guesses (a history row that is all one
  // group) plus hint-revealed groups — rather than crediting 0, which would
  // mislabel real solves as "revealed". New saves store the exact value.
  const [earnedCount, setEarnedCount] = useState<number>(() => {
    if (saved?.earnedCount != null) return saved.earnedCount;
    if (saved?.status !== "lost") return saved?.solvedOrder?.length ?? 0;
    const correctGuesses = (saved.history ?? []).filter(
      (row) => row.length > 0 && row.every((g) => g === row[0]),
    ).length;
    return Math.min(GROUP_COUNT, correctGuesses + (saved.hintsUsed ?? 0));
  });
  // Whether a loss was a voluntary give-up (distinct end-of-game copy).
  const [gaveUp, setGaveUp] = useState<boolean>(saved?.gaveUp ?? false);
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
  /** True while a rewarded-ad hint is in flight — freezes the whole board. */
  const [busy, setBusy] = useState(false);
  /** Two-step confirmation state for the "Give up" affordance. */
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);

  const completedRef = useRef(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Monotonic counter driving the (deterministic, UI-only) shuffle. */
  const shuffleSeed = useRef(1);
  /** DOM refs for each tile button, so the cursor can move actual focus. */
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /** True only after a real key press, so we don't yank focus on mount/touch. */
  const keyboardActive = useRef(false);
  /** Guards the rewarded-ad hint flow against re-entrancy while an ad is showing. */
  const adInFlightRef = useRef(false);

  /** Number of columns in the tile grid (matches grid-cols-4). */
  const GRID_COLS = 4;

  /**
   * Size the tile grid to the height left between the fixed header/controls so
   * board + controls fit the viewport without page scroll. Tiles are 1.3:1
   * (w:h), so the box's column-aspect is 4×1.3 = 5.2 wide per `rows` tall; the
   * row count tracks the (shrinking) tile count as groups are solved/revealed.
   */
  const gridRows = Math.max(1, Math.ceil(remaining.length / GRID_COLS));
  const { ref: gridFitRef, size: gridSize } = useFitBox<HTMLDivElement>(
    GRID_COLS * 1.3,
    gridRows,
    420,
  );

  const maxMistakes = maxMistakesFor(puzzle);
  /** Show near-miss "one away" feedback only when the tier allows it. */
  const showOneAway = puzzle.oneAway !== false;

  const gameOver = status !== "playing";
  const won = status === "won";
  const lost = status === "lost";
  const flawless = won && mistakes === 0;
  const mistakesLeft = maxMistakes - mistakes;
  /** Any interaction with tiles/actions is blocked when over OR mid-ad. */
  const interactionLocked = gameOver || busy;
  /** Submitting now would end the game on a wrong guess. */
  const lastGuess = !gameOver && mistakesLeft === 1;

  // Persist resumable state.
  useEffect(() => {
    onPersistState?.({
      remaining,
      solvedOrder,
      earnedCount,
      gaveUp,
      history,
      mistakes,
      hintsUsed,
      status,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, solvedOrder, earnedCount, gaveUp, history, mistakes, hintsUsed, status]);

  // Clean up the message timer on unmount.
  useEffect(() => {
    return () => {
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
  }, []);

  // Resuming an already-finished puzzle: mark it complete (so onComplete-derived
  // UI like the tier nav rehydrates) and auto-open the result modal, instead of
  // leaving the player on a bare "View result" button with no context.
  useEffect(() => {
    if (saved && saved.status !== "playing" && !completedRef.current) {
      completedRef.current = true;
      setShowModal(true);
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (gameOver || busy) return;
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
    [gameOver, busy],
  );

  const submit = useCallback(() => {
    if (gameOver || busy || selected.length !== GROUP_SIZE) return;

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
      setEarnedCount(nextSolved.length); // a genuinely earned group
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
      setEarnedCount(solvedOrder.length); // lock in what was truly earned
      setSolvedOrder(finalSolved);
      setRemaining([]);
      setSelected([]);
      finish(false, solvedOrder, nextHistory, nextMistakes, hintsUsed);
    }
  }, [
    gameOver,
    busy,
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
    if (gameOver || busy) return;
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
  }, [gameOver, busy]);

  const deselect = useCallback(() => {
    if (gameOver || busy || selected.length === 0) return;
    setSelected([]);
    sfx.tap();
    haptics.tap();
  }, [gameOver, busy, selected.length]);

  /**
   * Reset the board to a fresh attempt at the same puzzle. Used as the modal's
   * "Play again" action so a finished player can retry without leaving.
   */
  const resetGame = useCallback(() => {
    completedRef.current = false;
    setRemaining(puzzle.tiles.slice());
    setSolvedOrder([]);
    setEarnedCount(0);
    setHistory([]);
    setMistakes(0);
    setHintsUsed(0);
    setStatus("playing");
    setSelected([]);
    setShaking([]);
    setJustSolved(null);
    setConfirmGiveUp(false);
    setShowModal(false);
    setMessage("");
    shuffleSeed.current = 1;
  }, [puzzle.tiles]);

  /** Concede the puzzle: reveal the remaining groups and end as a loss. */
  const giveUp = useCallback(() => {
    if (gameOver || busy) return;
    const revealed = puzzle.groups
      .map((_, i) => i)
      .filter((i) => !solvedOrder.includes(i));
    const finalSolved = [...solvedOrder, ...revealed];
    setEarnedCount(solvedOrder.length);
    setGaveUp(true);
    setSolvedOrder(finalSolved);
    setRemaining([]);
    setSelected([]);
    setConfirmGiveUp(false);
    finish(false, solvedOrder, history, mistakes, hintsUsed);
  }, [gameOver, busy, puzzle, solvedOrder, history, mistakes, hintsUsed, finish]);

  // Auto-dismiss the give-up confirmation if the player ignores it.
  useEffect(() => {
    if (!confirmGiveUp) return;
    const t = setTimeout(() => setConfirmGiveUp(false), 4000);
    return () => clearTimeout(t);
  }, [confirmGiveUp]);

  const useHint = useCallback(async () => {
    if (gameOver || busy || hintsUsed >= MAX_HINTS) return;
    // MON-1: past the free threshold, a non-premium native user earns the hint
    // by watching a rewarded ad. Inert on web (adsAvailable() is false), so the
    // hint behaves exactly as before there. Ad fail → no hint, no penalty.
    if (adsAvailable() && !isPremium && hintsUsed >= getMonetizationConfig().freeHintThreshold) {
      if (adInFlightRef.current) return; // ignore taps while a rewarded ad is in flight
      adInFlightRef.current = true;
      setBusy(true); // freeze the whole board, not just the hint button
      let r: Awaited<ReturnType<typeof showRewardedAd>>;
      try {
        r = await showRewardedAd();
      } finally {
        adInFlightRef.current = false;
        setBusy(false);
      }
      if (r !== "rewarded") return;
    }
    const gi = getHint(puzzle, solvedOrder);
    if (gi < 0) return; // nothing left to reveal

    const groupWords = new Set(puzzle.groups[gi].words);
    const nextRemaining = remaining.filter((w) => !groupWords.has(w));
    const nextSolved = [...solvedOrder, gi];
    const nextHints = hintsUsed + 1;

    setRemaining(nextRemaining);
    setSolvedOrder(nextSolved);
    setEarnedCount(nextSolved.length); // a hint-revealed group still "counts"
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
    isPremium,
    busy,
  ]);

  // Keyboard: Enter submits, Escape / Backspace deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOver || busy) return;
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
  }, [gameOver, busy, selected.length, submit, deselect]);

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
      if (interactionLocked || remaining.length === 0) return;
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
    [interactionLocked, remaining, focusIndex, selected.length, toggle, submit],
  );

  const modalInsight = useMemo(() => {
    // On a win, highlight the hardest (last) category; on a loss, the most
    // recently revealed one.
    const lastEarned = earnedCount > 0 ? solvedOrder[earnedCount - 1] : undefined;
    const target = won
      ? puzzle.groups[GROUP_COUNT - 1]
      : (lastEarned != null ? puzzle.groups[lastEarned] : undefined) ?? puzzle.groups[0];
    return `"${target.label}" — ${target.insight}`;
  }, [won, puzzle.groups, solvedOrder, earnedCount]);

  const shareString = buildShare(won, history, mistakes);

  const selectionFull = selected.length === GROUP_SIZE;
  const messageColor = messageTone === "error" ? "#ff9bbf" : ACCENT.soft;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center">
      <p
        className="mb-1.5 shrink-0 text-center font-mono text-[10.5px] tracking-[0.16em]"
        style={{ color: ACCENT.soft }}
      >
        CREATE FOUR GROUPS OF FOUR
      </p>

      {/* message / status area (live region) */}
      <div
        className="flex min-h-[24px] shrink-0 items-center justify-center px-2 text-center font-mono text-[12.5px] tracking-[0.03em]"
        style={{ color: messageColor }}
        aria-live="polite"
        role="status"
      >
        {message ||
          (lost
            ? gaveUp
              ? "Answers revealed"
              : "Out of guesses — solution revealed"
            : won
              ? "All four groups found!"
              : selectionFull
                ? "Tap Submit to lock in your group"
                : "")}
      </div>

      <div
        className="flex min-h-0 w-full flex-1 flex-col"
        style={{ maxWidth: "min(94vw, 420px)" }}
      >
        {/* solved categories */}
        {solvedOrder.length > 0 && (
          <div className="mb-2 flex shrink-0 flex-col gap-2">
            {solvedOrder.map((gi, order) => {
              const g = puzzle.groups[gi];
              const isFresh = gi === justSolved && !reducedMotion;
              // Entries past the earned count were auto-revealed on a loss /
              // give-up — render them muted and labelled so they never read as
              // a celebratory solve the player earned.
              const revealedNotSolved = order >= earnedCount;
              const ordinal = TIER_ORDINAL[gi] ?? `${gi + 1}th`;
              return (
                <div
                  key={g.label}
                  role="group"
                  className={cn(
                    "rounded-xl px-3 py-2.5",
                    !revealedNotSolved && isFresh && "animate-solve",
                    !reducedMotion && !revealedNotSolved && !isFresh && "animate-pop",
                  )}
                  aria-label={
                    revealedNotSolved
                      ? `Revealed (not solved): ${g.label}, ${ordinal} group. ${g.words.join(", ")}`
                      : `Solved: ${g.label}, ${ordinal} group. ${g.words.join(", ")}`
                  }
                  style={
                    revealedNotSolved
                      ? {
                          // Muted, desaturated treatment with a thin coloured edge so
                          // the category is still identifiable but visibly "not earned".
                          background: "rgba(255,255,255,0.05)",
                          boxShadow: `inset 0 0 0 1px ${g.color}66`,
                        }
                      : {
                          background: g.color,
                          boxShadow: isFresh
                            ? `0 0 0 1px ${g.color}, 0 8px 26px ${g.color}55`
                            : `0 4px 16px ${g.color}33`,
                        }
                  }
                >
                  <div
                    className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: revealedNotSolved ? g.color : "rgba(4,6,15,0.68)" }}
                  >
                    <span
                      className="rounded px-1 py-px text-[8.5px] tracking-[0.08em]"
                      aria-hidden
                      style={{
                        background: revealedNotSolved ? "rgba(255,255,255,0.08)" : "rgba(4,6,15,0.16)",
                        color: revealedNotSolved ? g.color : "rgba(4,6,15,0.7)",
                      }}
                    >
                      {ordinal}
                    </span>
                    <span>{g.label}</span>
                    {revealedNotSolved && (
                      <span
                        className="ml-auto text-[8.5px] font-normal lowercase tracking-[0.06em]"
                        style={{ color: "rgba(226,234,255,0.5)" }}
                        aria-hidden
                      >
                        revealed
                      </span>
                    )}
                  </div>
                  <div
                    className="mt-0.5 break-words font-display text-[14.5px] font-semibold leading-snug"
                    style={{
                      color: revealedNotSolved ? "rgba(226,234,255,0.62)" : "#04060f",
                      textDecoration: revealedNotSolved ? "line-through" : undefined,
                      textDecorationColor: revealedNotSolved ? `${g.color}99` : undefined,
                    }}
                  >
                    {g.words.join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* grid — flexes to the height left between the fixed header and the
            controls, sized by aspect ratio so board + controls fit the viewport
            (no scroll). The box shrinks row-wise as groups are solved. */}
        <div
          ref={gridFitRef}
          className="flex min-h-0 w-full flex-1 items-center justify-center"
        >
        {remaining.length > 0 && (
          <div
            className="grid grid-cols-4 gap-1.5 sm:gap-2"
            role="grid"
            aria-label="Connections tiles. Use arrow keys to move, Space to select, Enter to submit four."
            onKeyDown={onGridKeyDown}
            style={{
              width: gridSize?.w,
              height: gridSize?.h,
              gridTemplateRows: `repeat(${gridRows}, 1fr)`,
            }}
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
                    "group relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-[11px] p-1 text-center font-display font-semibold uppercase leading-[1.08] transition-[transform,box-shadow,background-color,color] duration-150 active:scale-[0.94] outline-none disabled:cursor-default",
                    // Visible keyboard focus ring (only shows on keyboard focus).
                    "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-offset-0",
                    isShaking && !reducedMotion && "animate-shake",
                    !reducedMotion && "motion-safe:animate-pop",
                  )}
                  style={{
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
        </div>

        {/* last-guess warning: surface the stakes before the final allowed miss */}
        {lastGuess && (
          <div
            className="mt-3 flex shrink-0 items-center justify-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "#ff9bbf" }}
            role="status"
          >
            <span aria-hidden>⚠</span>
            <span>Last guess — one mistake left</span>
          </div>
        )}

        {/* mistakes tracker */}
        {!won && (
          <div className={cn("flex shrink-0 items-center justify-center gap-2.5", lastGuess ? "mt-2" : "mt-3")}>
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
          <>
          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={shuffle}
              disabled={busy}
              className="min-h-[44px] rounded-pill border border-white/20 px-5 py-2.5 font-display text-sm text-[#eaf1ff] transition-colors duration-150 hover:border-white/35 hover:bg-white/[0.07] active:scale-[0.97] disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              Shuffle
            </button>
            <button
              type="button"
              onClick={deselect}
              disabled={busy || selected.length === 0}
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
              disabled={interactionLocked}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!selectionFull || busy}
              aria-label={
                !selectionFull
                  ? `Select ${GROUP_SIZE - selected.length} more to submit`
                  : lastGuess
                    ? "Submit your group of four — this is your last guess"
                    : "Submit your group of four"
              }
              className="min-h-[44px] rounded-pill px-6 py-2.5 font-display text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
              style={
                selectionFull
                  ? {
                      color: "#04060f",
                      backgroundImage: lastGuess
                        ? "linear-gradient(118deg,#ff6b9d,#ff9bbf)"
                        : `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
                      border: "1px solid transparent",
                      boxShadow: lastGuess
                        ? "0 8px 26px rgba(255,107,157,0.35)"
                        : `0 8px 26px ${ACCENT.solid}3a`,
                    }
                  : {
                      color: "rgba(226,234,255,0.4)",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      opacity: 0.55,
                    }
              }
            >
              {selectionFull && lastGuess
                ? "Submit · last guess"
                : `Submit${selected.length > 0 && !selectionFull ? ` · ${selected.length}/${GROUP_SIZE}` : ""}`}
            </button>
          </div>

          {/* Give up: an explicit, two-step exit so a stuck player is never trapped. */}
          <div className="mt-2 flex shrink-0 justify-center">
            {confirmGiveUp ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] tracking-[0.06em]" style={{ color: "rgba(226,234,255,0.6)" }}>
                  Reveal the answers?
                </span>
                <button
                  type="button"
                  onClick={giveUp}
                  disabled={busy}
                  className="min-h-[36px] rounded-pill px-4 py-1.5 font-display text-[13px] font-semibold text-[#04060f] transition-transform active:scale-[0.97] disabled:opacity-40"
                  style={{ background: "#ff9bbf" }}
                >
                  Give up
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmGiveUp(false)}
                  className="min-h-[36px] rounded-pill border border-white/20 px-4 py-1.5 font-display text-[13px] text-[#eaf1ff] transition-colors hover:bg-white/[0.07]"
                >
                  Keep playing
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmGiveUp(true)}
                disabled={busy}
                className="min-h-[36px] rounded-pill px-3 py-1.5 font-display text-[12.5px] text-ink-faint transition-colors hover:text-[#eaf1ff] disabled:opacity-40"
              >
                Give up
              </button>
            )}
          </div>
          </>
        )}

        {/* compact end-of-game banner (modal carries the full result) */}
        {gameOver && !showModal && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="mt-4 min-h-[44px] w-full shrink-0 rounded-pill border px-5 py-2.5 font-display text-sm font-semibold transition-transform duration-150 active:scale-[0.98]"
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
        statValue={`${earnedCount}/${GROUP_COUNT}`}
        statLabel="GROUPS FOUND"
        insight={modalInsight}
        share={shareString}
        onReplay={resetGame}
        replayLabel="Play again"
        extra={
          history.length > 0 ? (
            <figure className="m-0">
              <pre
                className="mx-auto inline-block font-mono text-[18px] leading-[1.25]"
                style={{ letterSpacing: "2px" }}
                aria-hidden
              >
                {history.map((row) => row.map(emojiFor).join("")).join("\n")}
              </pre>
              {/* Text alternative so screen readers get the guess recap too. */}
              <figcaption className="sr-only">
                Guess history, {history.length} guess{history.length === 1 ? "" : "es"}:{" "}
                {history
                  .map(
                    (row, r) =>
                      `Guess ${r + 1}: ${row.map(emojiWordFor).join(", ")}`,
                  )
                  .join(". ")}
                .
              </figcaption>
            </figure>
          ) : undefined
        }
      />
    </div>
  );
}
