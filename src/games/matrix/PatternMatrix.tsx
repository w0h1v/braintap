"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { HintButton } from "@/components/play/HintButton";
import { useGameClock } from "@/lib/useGameClock";
import { useFitBox } from "@/lib/useFitBox";
import { formatClock } from "@/lib/share";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import {
  GRID,
  describeRule,
  type MatrixPuzzle,
  type Tile,
  type AttrKey,
} from "./engine";

const ACCENT = GAME_METAS.matrix.accent;
const INSIGHT = GAME_METAS.matrix.insight;

export const MAX_HINTS: Record<"easy" | "medium" | "hard", number> = {
  easy: 2,
  medium: 1,
  hard: 1,
};
const HINT_PENALTY = 12;
const STRIKE_PENALTY = 14;

/** Colour palette for the `color` attribute: peri tints + neutral hues, each
 * paired with a distinct stroke-dasharray so colour is never the sole cue. */
const COLOR_SLOTS: { stroke: string; dash: string }[] = [
  { stroke: "#86a3ff", dash: "0" }, // peri, solid stroke
  { stroke: "#00e5ff", dash: "5 3" }, // cyan, dashed
  { stroke: "#ffb86b", dash: "1 4" }, // amber, dotted
  { stroke: "#7cf5c4", dash: "8 4 2 4" }, // mint, dash-dot
];

const SHAPE_NAMES = ["triangle", "circle", "square", "diamond", "hexagon"];
const FILL_NAMES = ["outline", "solid", "striped", "dotted"];

/** Sub-grid offsets (in a unit 0..1 box) for 1..4 repeated glyphs. */
const LAYOUTS: { x: number; y: number; s: number }[][] = [
  [{ x: 0.5, y: 0.5, s: 0.62 }], // 1
  [
    { x: 0.32, y: 0.5, s: 0.4 },
    { x: 0.68, y: 0.5, s: 0.4 },
  ], // 2
  [
    { x: 0.5, y: 0.3, s: 0.36 },
    { x: 0.32, y: 0.7, s: 0.36 },
    { x: 0.68, y: 0.7, s: 0.36 },
  ], // 3
  [
    { x: 0.32, y: 0.32, s: 0.34 },
    { x: 0.68, y: 0.32, s: 0.34 },
    { x: 0.32, y: 0.68, s: 0.34 },
    { x: 0.68, y: 0.68, s: 0.34 },
  ], // 4
];

/** Build the SVG path/element for a single shape glyph centred at (cx,cy). */
function shapePath(shape: number, cx: number, cy: number, half: number): string {
  const pts = (corners: [number, number][]) =>
    corners.map(([x, y]) => `${(cx + x * half).toFixed(2)},${(cy + y * half).toFixed(2)}`).join(" ");
  switch (shape) {
    case 0: // triangle
      return `M ${pts([[0, -1], [0.92, 0.8], [-0.92, 0.8]])} Z`;
    case 2: // square
      return `M ${pts([[-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85]])} Z`;
    case 3: // diamond
      return `M ${pts([[0, -1], [1, 0], [0, 1], [-1, 0]])} Z`;
    case 4: { // hexagon
      const h = 0.866;
      return `M ${pts([[0.5, -h], [1, 0], [0.5, h], [-0.5, h], [-1, 0], [-0.5, -h]])} Z`;
    }
    default:
      return ""; // circle handled separately
  }
}

let PATTERN_SEQ = 0;

/** A pure, deterministic-render glyph for a tile. Board and options use it identically. */
function TileGlyph({
  tile,
  size,
  paletteSize,
}: {
  tile: Tile;
  /** any CSS length, e.g. "min(26vw, 96px)". */
  size: string;
  paletteSize: number;
}) {
  // Unique ids for SVG patterns within this render.
  const uid = useMemo(() => `mtx-${(PATTERN_SEQ += 1)}`, []);
  const count = tile.count + 1; // 1..4
  const layout = LAYOUTS[tile.count] ?? LAYOUTS[0];
  const slot = COLOR_SLOTS[tile.color % paletteSize] ?? COLOR_SLOTS[0];
  const stroke = slot.stroke;
  const rotation = tile.rotation * 90;
  const fill = tile.fill; // 0 outline, 1 solid, 2 striped, 3 dotted

  const VB = 100;
  const fillRef =
    fill === 1 ? stroke : fill === 2 ? `url(#${uid}-stripe)` : fill === 3 ? `url(#${uid}-dots)` : "none";

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      aria-hidden
      style={{ display: "block", width: size, height: size }}
    >
      <defs>
        <pattern id={`${uid}-stripe`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="none" />
          <line x1="0" y1="0" x2="0" y2="6" stroke={stroke} strokeWidth="2.4" />
        </pattern>
        <pattern id={`${uid}-dots`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.4" fill={stroke} />
        </pattern>
      </defs>
      <g transform={`rotate(${rotation} ${VB / 2} ${VB / 2})`}>
        {layout.slice(0, count).map((g, i) => {
          const cx = g.x * VB;
          const cy = g.y * VB;
          const half = (g.s * VB) / 2;
          const common = {
            fill: fillRef,
            stroke,
            strokeWidth: 4,
            strokeDasharray: slot.dash === "0" ? undefined : slot.dash,
          };
          if (tile.shape === 1) {
            return <circle key={i} cx={cx} cy={cy} r={half * 0.92} {...common} />;
          }
          return <path key={i} d={shapePath(tile.shape, cx, cy, half)} {...common} />;
        })}
      </g>
    </svg>
  );
}

/** Human-readable description of a tile for aria-labels. */
function describeTile(tile: Tile): string {
  const shape = SHAPE_NAMES[tile.shape] ?? "shape";
  const count = tile.count + 1;
  const rot = tile.rotation * 90;
  const fill = FILL_NAMES[tile.fill] ?? "outline";
  return `${shape}, ${count > 1 ? `${count} of them` : "single"}, rotated ${rot} degrees, ${fill}`;
}

interface MatrixState {
  selected: number | null;
  picked: number[]; // wrong option indices already tried (for dimming)
  strikesUsed: number;
  hintsUsed: number;
  revealedRules: number[];
  done: boolean;
  won: boolean;
  elapsedMs: number;
}

const shareLine = (ms: number, strikesUsed: number, strikes: number, won: boolean) => {
  const pips =
    Array.from({ length: strikes }, (_, i) => (i < strikes - strikesUsed ? "🟦" : "⬜")).join("") || "🟦";
  return `BrainTap · Pattern Matrix\n${won ? "Solved" : "Stumped"} · ${formatClock(ms)}\n\n🟦🟦🟦\n🟦🟦🟦\n🟦🟦${won ? "🟦" : "⬜"}\nStrikes ${pips}\nbraintap.app`;
};

export function PatternMatrix({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion = false,
  hostTimer = false,
  difficulty = "medium",
}: GameComponentProps<MatrixPuzzle, MatrixState>) {
  const saved = savedState ?? null;
  const maxHints = MAX_HINTS[difficulty] ?? 1;

  const [selected, setSelected] = useState<number | null>(saved?.selected ?? null);
  const [picked, setPicked] = useState<number[]>(() => saved?.picked ?? []);
  const [strikesUsed, setStrikesUsed] = useState(saved?.strikesUsed ?? 0);
  const [hintsUsed, setHintsUsed] = useState(saved?.hintsUsed ?? 0);
  const [revealedRules, setRevealedRules] = useState<number[]>(() => saved?.revealedRules ?? []);
  const [done, setDone] = useState(saved?.done ?? false);
  const [won, setWon] = useState(saved?.won ?? false);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  const [popIdx, setPopIdx] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  // Live-region message for screen readers (wrong picks / reveals); the static
  // status line covers the rest.
  const [liveMsg, setLiveMsg] = useState("");
  const finalMsRef = useRef(saved?.done ? (saved?.elapsedMs ?? 0) : 0);
  const completedRef = useRef(saved?.done ?? false);

  const clock = useGameClock(!done, saved?.elapsedMs ?? 0);
  const strikesLeft = puzzle.strikes - strikesUsed;

  // Size the square 3x3 board to the height left between the fixed meta row and
  // the prompt/options/controls below, so the whole game fits without scroll.
  // Cap kept tight so the board never wins more height than needed on short
  // phones (iPhone SE): the fixed prompt/options/controls stack is what pushes
  // the fold, so we let the board yield height to them. The flex-1 region still
  // absorbs slack and grows to this cap on taller screens.
  const { ref: boardFitRef, size: boardSize } = useFitBox<HTMLDivElement>(1, 1, 208);

  // Resuming a finished puzzle should re-surface the celebratory/result modal
  // (MOB: persisted done state otherwise loses the share + recap entirely).
  useEffect(() => {
    if (saved?.done) setShowModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a snapshot ref so the visibility/unmount flush below can persist the
  // *live* clock value without re-binding listeners on every state change.
  const persistRef = useRef<() => void>(() => {});
  persistRef.current = () => {
    onPersistState?.({
      selected,
      picked,
      strikesUsed,
      hintsUsed,
      revealedRules,
      done,
      won,
      elapsedMs: done ? finalMsRef.current : clock.ms,
    });
  };

  // Persist resumable state on every meaningful change.
  useEffect(() => {
    persistRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, picked, strikesUsed, hintsUsed, revealedRules, done, won]);

  // Flush the live elapsed time when the tab is hidden or the game unmounts,
  // so resume time doesn't drift back to the last state-change snapshot.
  useEffect(() => {
    const flush = () => persistRef.current();
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, []);

  const computeScore = useCallback(
    (ms: number, strikes: number, hints: number, didWin: boolean) => {
      if (!didWin) return 0;
      const sec = Math.round(ms / 1000);
      return Math.max(
        10,
        100 - Math.floor(sec / 8) - strikes * STRIKE_PENALTY - hints * HINT_PENALTY,
      );
    },
    [],
  );

  const finish = useCallback(
    (didWin: boolean, finalStrikes: number, suppressCue = false) => {
      if (completedRef.current) return;
      completedRef.current = true;
      clock.stop();
      const timeMs = clock.ms;
      finalMsRef.current = timeMs;
      setDone(true);
      setWon(didWin);
      // The win cue is always owned here. The loss cue is owned by confirm()'s
      // strike feedback when a wrong pick ends the round, so skip it then to
      // avoid a doubled error buzz/sound.
      if (didWin) {
        haptics.win();
        sfx.win();
        setLiveMsg("Correct. Matrix solved.");
      } else if (!suppressCue) {
        haptics.error();
        sfx.wrong();
        setLiveMsg("Out of strikes. The answer is now revealed on the board.");
      } else {
        setLiveMsg("Incorrect. Out of strikes. The answer is now revealed on the board.");
      }
      const score = computeScore(timeMs, finalStrikes, hintsUsed, didWin);
      const sec = Math.round(timeMs / 1000);
      const baseStars = sec < 45 ? 3 : sec < 120 ? 2 : 1;
      const stars = didWin ? Math.max(1, (finalStrikes > 0 || hintsUsed > 0 ? Math.min(baseStars, 2) : baseStars)) : 1;
      const revealMs = reducedMotion ? 120 : 620;
      setTimeout(() => setShowModal(true), revealMs);
      onComplete({
        status: didWin ? "won" : "lost",
        score,
        timeMs,
        mistakes: finalStrikes,
        stars,
        shareText: shareLine(timeMs, finalStrikes, puzzle.strikes, didWin),
        detail: { difficulty: puzzle.difficulty, hintsUsed, strikesUsed: finalStrikes },
      });
    },
    [clock, computeScore, hintsUsed, onComplete, puzzle.difficulty, puzzle.strikes, reducedMotion],
  );

  const confirm = useCallback(() => {
    if (done || selected == null || picked.includes(selected)) return;
    if (selected === puzzle.answerIndex) {
      setPopIdx(selected);
      // No correct/success cue here: finish() owns the single terminal win cue.
      finish(true, strikesUsed);
      return;
    }
    // wrong pick
    const nextStrikes = strikesUsed + 1;
    const nextLeft = puzzle.strikes - nextStrikes;
    setPicked((p) => (p.includes(selected) ? p : [...p, selected]));
    setStrikesUsed(nextStrikes);
    sfx.wrong();
    haptics.error();
    if (!reducedMotion) {
      setShakeIdx(selected);
      setTimeout(() => setShakeIdx((s) => (s === selected ? null : s)), 480);
    }
    setSelected(null);
    if (nextStrikes >= puzzle.strikes) {
      // finish() announces the strike-out; suppress its cue (already played).
      finish(false, nextStrikes, true);
    } else {
      setLiveMsg(`Incorrect. Strikes left: ${nextLeft}.`);
    }
  }, [done, selected, picked, puzzle.answerIndex, puzzle.strikes, strikesUsed, reducedMotion, finish]);

  // Replay the same puzzle: clear local progress and restart the clock. Score
  // is not re-submitted unless the player finishes again, matching other games.
  const handleReplay = useCallback(() => {
    setShowModal(false);
    completedRef.current = false;
    finalMsRef.current = 0;
    setSelected(null);
    setPicked([]);
    setStrikesUsed(0);
    setHintsUsed(0);
    setRevealedRules([]);
    setShakeIdx(null);
    setPopIdx(null);
    setWon(false);
    setLiveMsg("");
    setDone(false);
    clock.reset();
    clock.start();
  }, [clock]);

  const handleSelect = useCallback(
    (i: number) => {
      if (done || picked.includes(i)) return;
      setSelected(i);
      sfx.tap();
      haptics.tap();
    },
    [done, picked],
  );

  const handleHint = useCallback(() => {
    if (done || hintsUsed >= maxHints) return;
    // Reveal the next not-yet-revealed rule.
    const nextRule = puzzle.rules.findIndex((_, idx) => !revealedRules.includes(idx));
    if (nextRule < 0) return;
    setRevealedRules((r) => [...r, nextRule]);
    setHintsUsed((h) => h + 1);
    sfx.place();
    haptics.success();
  }, [done, hintsUsed, maxHints, puzzle.rules, revealedRules]);

  // Keyboard: arrows move option focus, Enter/Space confirm.
  const optRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cols = puzzle.optionCount === 6 ? 3 : 4;
  const move = useCallback(
    (delta: number) => {
      if (done) return;
      setSelected((cur) => {
        const start = cur ?? -1;
        let next = start;
        for (let step = 0; step < puzzle.optionCount; step++) {
          next = (next + delta + puzzle.optionCount) % puzzle.optionCount;
          if (!picked.includes(next)) break;
        }
        optRefs.current[next]?.focus();
        return next;
      });
    },
    [done, picked, puzzle.optionCount],
  );

  // Keyboard is scoped to the radiogroup (below) instead of the whole window,
  // so it no longer hijacks Space/Enter/arrows for the rest of the page.
  const onGroupKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (done) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        move(e.key === "ArrowDown" ? cols : 1);
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        move(e.key === "ArrowUp" ? -cols : -1);
        e.preventDefault();
      } else if (e.key === "Enter") {
        // Space already fires a native click on the focused radio button; only
        // intercept Enter, and only when a selection exists to confirm.
        if (selected != null) {
          confirm();
          e.preventDefault();
        }
      }
    },
    [done, move, cols, selected, confirm],
  );

  const status = done
    ? won
      ? "Matrix solved."
      : "Out of strikes."
    : `Strikes left: ${strikesLeft}. Pick the tile that completes the matrix.`;

  // Derive the in-cell glyph size from the fitted board (3 cells, 6px gaps,
  // 6px padding each side). Falls back to the viewport-based size pre-measure.
  const tileSize = boardSize
    ? `${Math.max(0, (boardSize.w - 12 - 12) / 3)}px`
    : "min(26vw, 96px)";
  // Glyph fills ~86% of the option button so it scales with the button's own
  // responsive cap (max-w-56px mobile / 72px sm+) and never overflows the
  // tighter mobile tile — no separate breakpoint math needed.
  const optSize = "86%";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center">
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {/* Assertive channel for pick/strike/reveal results (controls + a11y). */}
      <p className="sr-only" role="alert" aria-live="assertive">
        {liveMsg}
      </p>

      {/* meta row: tier + strike pips + timer */}
      <div
        className={cn(
          "mb-1.5 flex w-full shrink-0 items-center justify-between font-mono text-[10.5px] text-ink-mute sm:mb-3 sm:text-[11px]",
          !reducedMotion && "animate-rise",
        )}
        style={{ maxWidth: "min(92vw, 380px)" }}
      >
        <span
          className="rounded-pill border px-2.5 py-1 tracking-[0.14em]"
          style={{
            color: ACCENT.soft,
            borderColor: `${ACCENT.solid}40`,
            background: `${ACCENT.solid}14`,
          }}
        >
          {puzzle.difficulty.toUpperCase()}
        </span>
        <span className="flex items-center gap-1.5" aria-label={`Strikes left: ${strikesLeft} of ${puzzle.strikes}`}>
          {Array.from({ length: puzzle.strikes }, (_, i) => {
            const alive = i < strikesLeft;
            return (
              <span
                key={i}
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: alive ? ACCENT.solid : "transparent",
                  border: `1.5px solid ${alive ? ACCENT.solid : "rgba(255,255,255,0.22)"}`,
                  boxShadow: alive ? `0 0 8px -1px ${ACCENT.solid}` : undefined,
                }}
              />
            );
          })}
        </span>
        {!hostTimer && (
          <span aria-hidden className="tabular-nums tracking-[0.1em]">
            {formatClock(done ? finalMsRef.current : clock.ms)}
          </span>
        )}
      </div>

      {/* board region — flexes to the height left between the fixed meta row and
          the prompt/options/controls, so the 3x3 board sizes to fit (no scroll). */}
      <div ref={boardFitRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
      {/* 3x3 board */}
      <div
        className="grid aspect-square grid-cols-3 gap-1.5 rounded-2xl border-2 p-1.5"
        style={{
          width: boardSize?.w,
          height: boardSize?.h,
          maxWidth: "min(92vw, 300px)",
          borderColor: `${ACCENT.solid}66`,
          background: `${ACCENT.solid}14`,
          boxShadow: `0 18px 50px -20px ${ACCENT.solid}59, inset 0 0 40px -28px ${ACCENT.solid}`,
        }}
        role="img"
        aria-label={`Pattern matrix, 3 by 3 grid with the bottom-right tile missing. Visible tiles: ${puzzle.cells
          .slice(0, GRID - 1)
          .map((t, i) => `cell ${i + 1}: ${describeTile(t)}`)
          .join("; ")}.`}
      >
        {Array.from({ length: GRID }, (_, i) => {
          const isMissing = i === GRID - 1;
          // Reveal the canonical answer in the missing cell on BOTH outcomes —
          // win celebrates, loss teaches (the prompt copy promises it's shown).
          const revealed = done && isMissing;
          return (
            <div
              key={i}
              className={cn(
                "relative flex items-center justify-center rounded-xl",
                !reducedMotion && revealed && "animate-pop",
              )}
              style={{
                background: isMissing
                  ? revealed && !won
                    ? "rgba(40,12,16,0.5)"
                    : "rgba(6,10,22,0.4)"
                  : "rgba(6,10,22,0.55)",
                border: isMissing
                  ? revealed && !won
                    ? "2px solid rgba(255,120,120,0.6)"
                    : `2px dashed ${ACCENT.solid}88`
                  : `1px solid rgba(255,255,255,0.07)`,
              }}
            >
              {isMissing ? (
                revealed ? (
                  <TileGlyph tile={puzzle.cells[GRID - 1]} size={tileSize} paletteSize={puzzle.paletteSize} />
                ) : (
                  <span
                    className="font-display text-2xl font-bold"
                    style={{ color: `${ACCENT.solid}cc` }}
                    aria-hidden
                  >
                    ?
                  </span>
                )
              ) : (
                <TileGlyph
                  tile={puzzle.cells[i]}
                  size={tileSize}
                  paletteSize={puzzle.paletteSize}
                />
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* hint tray (revealed rules) — capped + internally scrollable on mobile so
          revealing rules never pushes the controls below the fold. */}
      {revealedRules.length > 0 && (
        <div
          className="mt-1.5 max-h-[64px] w-full shrink-0 overflow-y-auto rounded-xl border p-1.5 text-left sm:mt-3 sm:max-h-none sm:p-3"
          style={{ maxWidth: "min(92vw, 380px)", background: `${ACCENT.solid}10`, borderColor: `${ACCENT.solid}33` }}
        >
          <div className="font-mono text-[9.5px] tracking-[0.16em] sm:text-[10px]" style={{ color: ACCENT.soft }}>
            💡 RULES REVEALED
          </div>
          <ul className="mt-0.5 space-y-0.5 text-[11.5px] leading-snug text-[rgba(226,234,255,0.85)] sm:mt-1.5 sm:space-y-1 sm:text-[13px]">
            {revealedRules.map((ri) => (
              <li key={ri}>· {describeRule(puzzle.rules[ri])}</li>
            ))}
          </ul>
        </div>
      )}

      {/* prompt — compact on mobile; only shown when it carries a result beat,
          otherwise hidden to reclaim the fold (the options make the ask obvious). */}
      <p
        className={cn(
          "mt-1.5 shrink-0 text-center font-display text-[12px] text-ink-soft sm:mt-4 sm:text-[13.5px]",
          !done && "hidden sm:block",
        )}
        style={{ maxWidth: "min(92vw, 380px)" }}
      >
        {done
          ? won
            ? "Solved — nicely reasoned."
            : "Out of strikes. The answer is shown above."
          : "Which tile completes the matrix?"}
      </p>

      {/* options strip */}
      <div
        className="mt-1.5 grid w-full shrink-0 justify-items-center gap-1.5 sm:mt-3 sm:gap-2"
        style={{
          maxWidth: "min(92vw, 380px)",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
        role="radiogroup"
        aria-label="Answer options"
        onKeyDown={onGroupKeyDown}
      >
        {puzzle.options.map((opt, i) => {
          const isPickedWrong = picked.includes(i);
          const isSel = selected === i;
          const isAnswerReveal = done && i === puzzle.answerIndex;
          // Roving tabindex: the selected radio is the lone tab stop; with no
          // selection yet, the first still-pickable option carries it.
          const rovingIdx =
            selected != null
              ? selected
              : puzzle.options.findIndex((_, k) => !picked.includes(k));
          return (
            <button
              key={i}
              ref={(el) => {
                optRefs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSel}
              tabIndex={done ? -1 : i === rovingIdx ? 0 : -1}
              aria-label={`${describeTile(opt)}${isPickedWrong ? ", already tried, incorrect" : isAnswerReveal && done ? ", correct answer" : ""}`}
              disabled={done || isPickedWrong}
              onClick={() => handleSelect(i)}
              className={cn(
                "flex aspect-square min-h-[38px] min-w-[38px] w-full max-w-[56px] items-center justify-center rounded-xl outline-none sm:max-w-[72px] sm:min-h-[44px] sm:min-w-[44px]",
                !reducedMotion && "transition-[transform,background-color,border-color] duration-150",
                !reducedMotion && shakeIdx === i && "animate-shake",
                !reducedMotion && popIdx === i && "animate-pop",
                !reducedMotion && isSel && "scale-[1.05]",
              )}
              style={{
                background: isSel
                  ? `${ACCENT.solid}33`
                  : isAnswerReveal
                    ? `${ACCENT.solid}26`
                    : "rgba(6,10,22,0.55)",
                border: isSel
                  ? `2px solid ${ACCENT.solid}`
                  : isAnswerReveal
                    ? `2px solid ${ACCENT.solid}aa`
                    : `1px solid rgba(255,255,255,0.10)`,
                opacity: isPickedWrong ? 0.32 : 1,
                boxShadow: isSel ? `0 0 18px -4px ${ACCENT.solid}` : undefined,
              }}
            >
              <TileGlyph tile={opt} size={optSize} paletteSize={puzzle.paletteSize} />
            </button>
          );
        })}
      </div>

      {/* controls: during play → confirm + hint; after → replay + view result
          so the player can recover even after dismissing the modal. */}
      <div
        className="mt-1.5 flex w-full shrink-0 items-center justify-center gap-2 sm:mt-4 sm:gap-3"
        style={{ maxWidth: "min(92vw, 380px)" }}
      >
        {done ? (
          <>
            <button
              type="button"
              onClick={handleReplay}
              className={cn(
                "min-h-[38px] flex-1 rounded-pill px-4 py-1.5 font-display text-[14px] font-semibold text-[#04060f] outline-none sm:min-h-[48px] sm:px-5 sm:py-3 sm:text-[15px]",
                !reducedMotion && "transition-transform active:scale-[0.98]",
              )}
              style={{ backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})` }}
            >
              ↻ {won ? "Play again" : "Try again"}
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="min-h-[38px] rounded-pill border px-4 py-1.5 font-display text-[14px] font-semibold outline-none sm:min-h-[48px] sm:px-5 sm:py-3 sm:text-[15px]"
              style={{ borderColor: `${ACCENT.solid}55`, background: `${ACCENT.solid}14`, color: ACCENT.soft }}
            >
              View result
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={confirm}
              disabled={selected == null}
              className={cn(
                "min-h-[38px] flex-1 rounded-pill px-4 py-1.5 font-display text-[14px] font-semibold text-[#04060f] outline-none disabled:opacity-40 sm:min-h-[48px] sm:px-5 sm:py-3 sm:text-[15px]",
                !reducedMotion && "transition-transform active:scale-[0.98]",
              )}
              style={{ backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})` }}
            >
              Confirm
            </button>
            <HintButton
              used={hintsUsed}
              max={maxHints}
              onHint={handleHint}
              accent={ACCENT}
              disabled={done}
              className="!min-h-[38px] !px-3 !py-1.5 sm:!min-h-[44px] sm:!px-4 sm:!py-2.5"
            />
          </>
        )}
      </div>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        won={won}
        title={won ? "Pattern solved." : "Out of strikes."}
        statValue={formatClock(finalMsRef.current)}
        statLabel="SOLVE TIME"
        insight={INSIGHT}
        share={shareLine(finalMsRef.current, strikesUsed, puzzle.strikes, won)}
        onReplay={handleReplay}
        replayLabel={won ? "Play again" : "Try again"}
      />
    </div>
  );
}

// silence unused-import lint if AttrKey drifts out of use.
export type { AttrKey };
