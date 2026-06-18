"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { HintButton } from "@/components/play/HintButton";
import { useGameClock } from "@/lib/useGameClock";
import { formatClock } from "@/lib/share";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import {
  cellIndex,
  cellsFor,
  lineClue,
  isSolved,
  getHint,
  type Cell,
  type Clue,
  type ForgePuzzle,
} from "./engine";

const ACCENT = GAME_METAS.forge.accent;
const MAX_HINTS = 3;
const HINT_PENALTY = 8;
const INSIGHT =
  "Nonograms recruit the parietal lobe's spatial reasoning while your working memory juggles overlapping row and column constraints — deduction made visual.";

interface ForgeState {
  cells: Cell[]; // length CELLS, 0/1/2
  elapsedMs: number;
  won: boolean;
  hintsUsed?: number;
}

const FILL = ACCENT.solid; // #ffb020
const FILL_GLOW = "rgba(255,176,32,.5)";
const MARK = "rgba(255,90,140,.9)";

function clueText(clue: Clue): string {
  return clue.join(" ");
}

/** True when a line's filled cells (state===1) exactly satisfy its clue. */
function lineSatisfied(values: Cell[], clue: Clue): boolean {
  const binary = values.map((v) => (v === 1 ? 1 : 0));
  const got = lineClue(binary);
  if (got.length !== clue.length) return false;
  for (let i = 0; i < got.length; i++) if (got[i] !== clue[i]) return false;
  return true;
}

export function Forge({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
  hostTimer,
}: GameComponentProps<ForgePuzzle, ForgeState>) {
  const N = puzzle.size;
  const CELLS = cellsFor(N);
  const saved = savedState ?? null;
  // Guard against older saves whose cells array length doesn't match this grid
  // size (e.g. a save from a different tier or the legacy single-size puzzle).
  const [cells, setCells] = useState<Cell[]>(() =>
    saved?.cells && saved.cells.length === CELLS
      ? saved.cells
      : (new Array(CELLS).fill(0) as Cell[]),
  );
  const [won, setWon] = useState(saved?.won ?? false);
  const [hintsUsed, setHintsUsed] = useState(saved?.hintsUsed ?? 0);
  const [selected, setSelected] = useState<number>(0);
  const [markMode, setMarkMode] = useState(false);
  // Cell index revealed by the most recent hint (drives a one-shot pulse).
  const [hintCell, setHintCell] = useState<number | null>(null);
  // Cells that played the solve "ripple"; drives a one-shot per-cell animation.
  const [solveBurst, setSolveBurst] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // Show the instructions overlay until the player starts (skip if resuming).
  const [started, setStarted] = useState(
    () => Boolean(saved?.won) || (saved?.cells?.some((v) => v !== 0) ?? false),
  );
  const completedRef = useRef(saved?.won ?? false);
  const hintsRef = useRef(saved?.hintsUsed ?? 0);
  const gridRef = useRef<HTMLDivElement>(null);
  const longPress = useRef<{ id: number; timer: number } | null>(null);

  const clock = useGameClock(!won && started, saved?.elapsedMs ?? 0);

  // Begin play: reveal the board and start the timer.
  const begin = useCallback(() => {
    setStarted(true);
    clock.start();
  }, [clock]);

  // Persist resumable state (JSON-serialisable).
  useEffect(() => {
    onPersistState?.({ cells, elapsedMs: clock.ms, won, hintsUsed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, won, hintsUsed]);

  const finish = useCallback(
    (finalCells: Cell[]) => {
      if (completedRef.current) return;
      completedRef.current = true;
      clock.stop();
      setWon(true);
      haptics.win();
      sfx.win();
      if (!reducedMotion) {
        setSolveBurst(true);
        window.setTimeout(() => setSolveBurst(false), 700);
      }
      const timeMs = clock.ms;
      const sec = Math.round(timeMs / 1000);
      const usedHints = hintsRef.current;
      // Goal-based game: generous score, faster solves score higher.
      // Each hint reveals a cell, so deduct a fixed penalty per hint used.
      const score = Math.max(
        50,
        100 - Math.floor(sec / 9) - usedHints * HINT_PENALTY,
      );
      const stars: 1 | 2 | 3 = sec < 90 ? 3 : sec < 240 ? 2 : 1;
      const share = `BrainTap · Focus Forge\nPicross solved ${puzzle.glyphSymbol} in ${formatClock(
        timeMs,
      )}\n\nbraintap.app/games`;
      window.setTimeout(() => setShowModal(true), reducedMotion ? 0 : 620);
      onComplete({
        status: "won",
        score,
        timeMs,
        stars,
        shareText: share,
        detail: {
          glyph: puzzle.glyphName,
          cells: finalCells.slice(),
          hintsUsed: usedHints,
        },
      });
    },
    [clock, onComplete, puzzle.glyphName, puzzle.glyphSymbol, reducedMotion],
  );

  const checkSolved = useCallback(
    (next: Cell[]) => {
      if (isSolved(next, puzzle.solution)) finish(next);
    },
    [finish, puzzle.solution],
  );

  // Toggle fill (left-click / primary). Filled <-> empty.
  const toggleFill = useCallback(
    (i: number) => {
      if (won) return;
      setCells((prev) => {
        const next = prev.slice() as Cell[];
        next[i] = next[i] === 1 ? 0 : 1;
        if (next[i] === 1) {
          sfx.place();
          haptics.success();
        } else {
          sfx.tap();
          haptics.tap();
        }
        queueMicrotask(() => checkSolved(next));
        return next;
      });
    },
    [won, checkSolved],
  );

  // Toggle mark-empty (right-click / mark mode / long-press). Empty <-> marked.
  const toggleMark = useCallback(
    (i: number) => {
      if (won) return;
      setCells((prev) => {
        const next = prev.slice() as Cell[];
        // Never clobber a filled cell with a mark.
        if (next[i] === 1) return prev;
        next[i] = next[i] === 2 ? 0 : 2;
        sfx.tap();
        haptics.tap();
        return next;
      });
    },
    [won],
  );

  // Reveal one correct cell from the solution (fill it, or mark an empty one).
  const useHint = useCallback(() => {
    if (won || hintsRef.current >= MAX_HINTS) return;
    setCells((prev) => {
      const hint = getHint(puzzle.solution, prev);
      if (!hint) return prev; // nothing left to reveal
      const next = prev.slice() as Cell[];
      next[hint.index] = hint.value;
      hintsRef.current += 1;
      setHintsUsed(hintsRef.current);
      setSelected(hint.index);
      if (!reducedMotion) {
        setHintCell(hint.index);
        window.setTimeout(() => setHintCell(null), 700);
      }
      sfx.place();
      haptics.success();
      queueMicrotask(() => checkSolved(next));
      return next;
    });
  }, [won, puzzle.solution, reducedMotion, checkSolved]);

  // Primary cell action depends on current mode.
  const onCellActivate = useCallback(
    (i: number) => {
      setSelected(i);
      if (markMode) toggleMark(i);
      else toggleFill(i);
    },
    [markMode, toggleFill, toggleMark],
  );

  const onCellContext = useCallback(
    (e: React.MouseEvent, i: number) => {
      e.preventDefault();
      setSelected(i);
      toggleMark(i);
    },
    [toggleMark],
  );

  // Long-press on touch = mark (mobile has no right-click).
  const onTouchStart = useCallback(
    (i: number) => {
      if (won) return;
      const timer = window.setTimeout(() => {
        longPress.current = null;
        setSelected(i);
        toggleMark(i);
      }, 380);
      longPress.current = { id: i, timer };
    },
    [won, toggleMark],
  );
  const cancelLongPress = useCallback(() => {
    if (longPress.current) {
      window.clearTimeout(longPress.current.timer);
      longPress.current = null;
    }
  }, []);

  // Keyboard navigation + actions.
  const move = useCallback(
    (dr: number, dc: number) => {
      setSelected((cur) => {
        let r = Math.floor(cur / N) + dr;
        let c = (cur % N) + dc;
        r = (r + N) % N;
        c = (c + N) % N;
        return cellIndex(r, c, N);
      });
    },
    [N],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won) return;
      switch (e.key) {
        case "ArrowUp":
          move(-1, 0);
          e.preventDefault();
          break;
        case "ArrowDown":
          move(1, 0);
          e.preventDefault();
          break;
        case "ArrowLeft":
          move(0, -1);
          e.preventDefault();
          break;
        case "ArrowRight":
          move(0, 1);
          e.preventDefault();
          break;
        case " ":
        case "Enter":
          if (!started) begin();
          else if (markMode) toggleMark(selected);
          else toggleFill(selected);
          e.preventDefault();
          break;
        case "x":
        case "X":
        case "m":
        case "M":
          toggleMark(selected);
          e.preventDefault();
          break;
        case "Backspace":
        case "Delete":
        case "0":
          setCells((prev) => {
            const next = prev.slice() as Cell[];
            next[selected] = 0;
            return next;
          });
          e.preventDefault();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [won, started, markMode, selected, move, toggleFill, toggleMark, begin]);

  // Per-line completion (for clue dimming) + overall progress.
  const { rowDone, colDone, progress } = useMemo(() => {
    const grid: Cell[][] = [];
    for (let r = 0; r < N; r++) {
      grid.push(
        Array.from({ length: N }, (_, c) => cells[cellIndex(r, c, N)] as Cell),
      );
    }
    const rowDone = grid.map((row, r) => lineSatisfied(row, puzzle.rowClues[r]));
    const colDone = Array.from({ length: N }, (_, c) =>
      lineSatisfied(
        grid.map((row) => row[c]),
        puzzle.colClues[c],
      ),
    );
    let correct = 0;
    let total = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (puzzle.solution[r][c] === 1) {
          total++;
          if (cells[cellIndex(r, c, N)] === 1) correct++;
        }
      }
    }
    return {
      rowDone,
      colDone,
      progress: total ? Math.round((correct / total) * 100) : 0,
    };
  }, [cells, N, puzzle.rowClues, puzzle.colClues, puzzle.solution]);

  const status = won
    ? `Solved! ${puzzle.glyphName} revealed.`
    : `${progress}% of the glyph revealed`;

  return (
    <div className="flex w-full flex-col items-center">
      {/* meta row */}
      <div className="mb-2 flex w-full max-w-[420px] items-center justify-between font-mono text-[11px] text-ink-mute">
        <span style={{ color: ACCENT.soft }}>NONOGRAM · {N}×{N}</span>
        {/* When the host renders a unified timer, hide our own timer chip but
            keep all timing logic so result.timeMs is still reported. */}
        {!hostTimer && (
          <span aria-live="off" className="tabular-nums">
            {formatClock(clock.ms)}
          </span>
        )}
      </div>

      {/* live status line */}
      <div
        className={cn(
          "mb-2 h-[20px] font-display text-[15px] font-semibold transition-opacity duration-200",
          won ? "opacity-100" : "opacity-0",
        )}
        aria-live="polite"
        style={{ color: ACCENT.soft }}
      >
        <span className="sr-only">{status}</span>
        <span aria-hidden>{won ? "Glyph revealed!" : ""}</span>
      </div>

      {/* board wrapper (for solved vignette + instructions overlay) */}
      <div className="relative w-full" style={{ maxWidth: 420 }}>
        <div
          ref={gridRef}
          className={cn("mx-auto select-none rounded-2xl p-2 transition-shadow")}
          style={{
            display: "grid",
            gridTemplateColumns: `clamp(30px, 12vw, 50px) repeat(${N}, minmax(0, 1fr))`,
            gap: "clamp(3px, 1vw, 5px)",
            width: "min(92vw, 420px)",
            touchAction: "manipulation",
            boxShadow: won
              ? `0 0 0 1px ${FILL}, 0 0 34px rgba(255,176,32,.28)`
              : "0 0 0 1px rgba(255,255,255,.04)",
            background:
              "radial-gradient(120% 120% at 50% 0%, rgba(255,176,32,.05), rgba(255,255,255,.015))",
          }}
          role="grid"
          aria-label={`Nonogram grid, ${N} by ${N}, with row and column clues`}
        >
          {/* top-left blank corner */}
          <div role="presentation" />

          {/* column clues */}
          {Array.from({ length: N }, (_, c) => (
            <div
              key={`col-${c}`}
              role="columnheader"
              aria-label={`Column ${c + 1} clue ${clueText(puzzle.colClues[c])}`}
              className={cn(
                "flex flex-col items-center justify-end break-words pb-1 font-mono leading-none transition-opacity duration-200",
                colDone[c] && !won && "opacity-35",
              )}
              style={{
                color: ACCENT.soft,
                fontSize: "clamp(9px, 2.7vw, 13px)",
                gap: "1px",
              }}
            >
              {puzzle.colClues[c].map((n, k) => (
                <span key={k}>{n}</span>
              ))}
            </div>
          ))}

          {/* rows: row clue + cells */}
          {Array.from({ length: N }, (_, r) => (
            <Row
              key={`row-${r}`}
              r={r}
              size={N}
              cells={cells}
              puzzle={puzzle}
              selected={selected}
              won={won}
              rowDone={rowDone[r]}
              solveBurst={solveBurst}
              hintCell={hintCell}
              reducedMotion={Boolean(reducedMotion)}
              onActivate={onCellActivate}
              onContext={onCellContext}
              onTouchStart={onTouchStart}
              onTouchEnd={cancelLongPress}
            />
          ))}
        </div>

        {/* instructions / start overlay */}
        {!started && !won && (
          <div
            className={cn(
              "absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl px-5 text-center backdrop-blur-md",
              !reducedMotion && "animate-pop",
            )}
            style={{ background: "rgba(6,10,22,0.82)" }}
          >
            <div
              className="font-mono text-[11px] tracking-[0.2em]"
              style={{ color: ACCENT.solid }}
            >
              HOW TO PLAY
            </div>
            <p className="mt-3 max-w-[280px] text-[13.5px] leading-relaxed text-ink-soft">
              The numbers are <strong style={{ color: ACCENT.soft }}>runs</strong>{" "}
              of filled cells in each row and column. Tap to fill, long-press (or
              Mark mode) to rule a cell out, and reveal the hidden glyph.
            </p>
            <button
              type="button"
              onClick={begin}
              className="mt-5 min-h-[44px] rounded-pill px-7 py-2.5 font-display text-[14px] font-semibold transition-transform active:scale-95"
              style={{
                background: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
                color: "#04060f",
              }}
            >
              Start forging
            </button>
          </div>
        )}
      </div>

      {/* progress bar */}
      <div
        className="mt-4 h-1.5 w-full max-w-[420px] overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,.06)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label="Glyph revealed"
      >
        <div
          className={cn(!reducedMotion && "transition-[width] duration-300")}
          style={{
            width: `${progress}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${ACCENT.from}, ${ACCENT.to})`,
          }}
        />
      </div>

      {/* controls */}
      <div className="mt-4 flex w-full max-w-[420px] items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setMarkMode((m) => !m)}
          aria-pressed={markMode}
          disabled={won}
          className={cn(
            "min-h-[44px] rounded-pill border px-6 py-2.5 font-display text-[13.5px] transition-all active:scale-95 disabled:opacity-40",
            markMode ? "text-[#04060f]" : "border-line-strong text-[#eaf1ff]",
          )}
          style={
            markMode
              ? {
                  background: ACCENT.solid,
                  borderColor: ACCENT.solid,
                  boxShadow: "0 0 18px rgba(255,176,32,.35)",
                }
              : { background: "rgba(255,255,255,0.04)" }
          }
        >
          ✕ Mark · {markMode ? "On" : "Off"}
        </button>
        <HintButton
          used={hintsUsed}
          max={MAX_HINTS}
          onHint={useHint}
          accent={ACCENT}
          disabled={won}
        />
      </div>

      {/* legend */}
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center font-mono text-[11px] text-ink-faint">
        <span>
          <span style={{ color: FILL }}>■</span> tap to fill
        </span>
        <span aria-hidden>·</span>
        <span>
          <span style={{ color: MARK }}>✕</span> long-press / Mark to rule out
        </span>
      </p>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        title="Glyph revealed."
        statValue={puzzle.glyphSymbol}
        statLabel={puzzle.glyphName.toUpperCase()}
        insight={INSIGHT}
        share={`BrainTap · Focus Forge\nPicross solved ${puzzle.glyphSymbol} in ${formatClock(
          clock.ms,
        )}\n\nbraintap.app/games`}
      />
    </div>
  );
}

function Row({
  r,
  size,
  cells,
  puzzle,
  selected,
  won,
  rowDone,
  solveBurst,
  hintCell,
  reducedMotion,
  onActivate,
  onContext,
  onTouchStart,
  onTouchEnd,
}: {
  r: number;
  size: number;
  cells: Cell[];
  puzzle: ForgePuzzle;
  selected: number;
  won: boolean;
  rowDone: boolean;
  solveBurst: boolean;
  hintCell: number | null;
  reducedMotion: boolean;
  onActivate: (i: number) => void;
  onContext: (e: React.MouseEvent, i: number) => void;
  onTouchStart: (i: number) => void;
  onTouchEnd: () => void;
}) {
  return (
    <>
      <div
        role="rowheader"
        aria-label={`Row ${r + 1} clue ${clueText(puzzle.rowClues[r])}`}
        className={cn(
          "flex items-center justify-end break-words pr-1.5 font-mono leading-none transition-opacity duration-200",
          rowDone && !won && "opacity-35",
        )}
        style={{
          color: ACCENT.soft,
          fontSize: "clamp(9px, 2.7vw, 13px)",
          gap: "clamp(3px, 1.2vw, 5px)",
        }}
      >
        {puzzle.rowClues[r].map((n, k) => (
          <span key={k}>{n}</span>
        ))}
      </div>

      {Array.from({ length: size }, (_, c) => {
        const i = cellIndex(r, c, size);
        const v = cells[i];
        const sel = selected === i;
        const filled = v === 1;
        const marked = v === 2;
        const inSolution = puzzle.solution[r][c] === 1;
        const label = filled ? "filled" : marked ? "marked empty" : "empty";
        const justHinted = hintCell === i;
        // Stagger the solve ripple diagonally for a forged-glyph reveal.
        const burstDelay = solveBurst && filled ? (r + c) * 45 : 0;
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            aria-label={`Row ${r + 1} column ${c + 1}, ${label}`}
            aria-selected={filled}
            tabIndex={sel ? 0 : -1}
            disabled={won && !filled}
            onClick={() => onActivate(i)}
            onContextMenu={(e) => onContext(e, i)}
            onTouchStart={() => onTouchStart(i)}
            onTouchEnd={onTouchEnd}
            onTouchMove={onTouchEnd}
            className={cn(
              "flex aspect-square items-center justify-center rounded-lg font-mono text-base outline-none",
              !reducedMotion && "transition-all duration-150 active:scale-90",
              !reducedMotion && solveBurst && filled && "animate-solve",
              !reducedMotion && justHinted && "animate-solve",
              "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[#ffcf7a] focus-visible:ring-offset-0",
            )}
            style={{
              minWidth: 0,
              background: filled
                ? FILL
                : marked
                  ? "rgba(255,90,140,.08)"
                  : "rgba(255,255,255,.04)",
              border: filled
                ? `1px solid ${FILL}`
                : sel
                  ? "1px solid rgba(255,176,32,.75)"
                  : marked
                    ? "1px solid rgba(255,90,140,.25)"
                    : "1px solid rgba(255,255,255,.1)",
              boxShadow: filled
                ? `0 0 12px ${FILL_GLOW}`
                : sel
                  ? "0 0 0 2px rgba(255,176,32,.3)"
                  : "none",
              color: MARK,
              animationDelay: burstDelay ? `${burstDelay}ms` : undefined,
              // keep glyph cells comfortably tappable on small phones
              minHeight: "clamp(44px, 14vw, 56px)",
            }}
          >
            <span
              aria-hidden
              className={cn(
                "leading-none",
                !reducedMotion && "transition-transform duration-150",
              )}
              style={{
                transform: marked ? "scale(1)" : "scale(0)",
                opacity: marked ? 1 : 0,
                fontSize: "clamp(13px, 4vw, 17px)",
              }}
            >
              ✕
            </span>
          </button>
        );
      })}
    </>
  );
}
