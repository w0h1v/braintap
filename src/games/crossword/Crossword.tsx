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
  rowOf,
  colOf,
  cellAt,
  isSolved,
  correctCount,
  whiteCount,
  getHintCell,
  type CrosswordPuzzle,
  type Dir,
} from "./engine";

const ACCENT = GAME_METAS.crossword.accent;
const WRONG = "#ff6b9d";
const HINT_PENALTY = 10;
/** Max hints per tier; mirrors index.ts hintsByDifficulty. */
const MAX_HINTS: Record<string, number> = { easy: 3, medium: 1, hard: 0 };

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

interface CrosswordState {
  letters: string[];
  elapsedMs: number;
  won: boolean;
  hintsUsed?: number;
  hintCells?: number[];
  selected?: number | null;
  orient?: Dir;
}

const shareLine = (ms: number, size: number) =>
  `BrainTap · Mini Crossword\nSolved in ${formatClock(ms)}\n\n🟦 ${size}×${size} grid\nbraintap.app`;

export function Crossword({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion = false,
  hostTimer = false,
}: GameComponentProps<CrosswordPuzzle, CrosswordState>) {
  const { size, block, solution, numbers, entries, acrossOf, downOf } = puzzle;
  const cellCount = size * size;
  const totalWhite = useMemo(() => whiteCount(block), [block]);
  const maxHints = MAX_HINTS[puzzle.difficulty] ?? 0;

  const saved = savedState ?? null;

  const firstWhite = useMemo(() => block.findIndex((b) => !b), [block]);

  const [letters, setLetters] = useState<string[]>(
    () => saved?.letters?.slice() ?? new Array(cellCount).fill(""),
  );
  const [selected, setSelected] = useState<number | null>(
    saved?.selected ?? (firstWhite >= 0 ? firstWhite : null),
  );
  const [orient, setOrient] = useState<Dir>(saved?.orient ?? "across");
  const [won, setWon] = useState(saved?.won ?? false);
  const [hintsUsed, setHintsUsed] = useState(saved?.hintsUsed ?? 0);
  const [hintCells, setHintCells] = useState<Set<number>>(
    () => new Set(saved?.hintCells ?? []),
  );
  const [checking, setChecking] = useState(false);
  const [shake, setShake] = useState(false);
  const [solving, setSolving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [revealCell, setRevealCell] = useState<number | null>(null);

  const mistakesRef = useRef(0);
  const finalMsRef = useRef(saved?.won ? (saved?.elapsedMs ?? 0) : 0);

  const clock = useGameClock(!won, saved?.elapsedMs ?? 0);

  // --- derived selection helpers -------------------------------------------

  /** The active entry index, given selection + orientation (falls back). */
  const activeEntryIdx = useMemo(() => {
    if (selected == null) return -1;
    const pref = orient === "across" ? acrossOf[selected] : downOf[selected];
    if (pref >= 0) return pref;
    const other = orient === "across" ? downOf[selected] : acrossOf[selected];
    return other;
  }, [selected, orient, acrossOf, downOf]);

  const activeEntry = activeEntryIdx >= 0 ? entries[activeEntryIdx] : null;
  const activeCells = useMemo(
    () => new Set(activeEntry?.cells ?? []),
    [activeEntry],
  );

  const filledCorrect = useMemo(
    () => correctCount(letters, solution, block),
    [letters, solution, block],
  );

  // --- persistence ----------------------------------------------------------

  useEffect(() => {
    onPersistState?.({
      letters,
      elapsedMs: won ? finalMsRef.current : clock.ms,
      won,
      hintsUsed,
      hintCells: [...hintCells],
      selected,
      orient,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters, won, hintsUsed, hintCells, selected, orient]);

  // --- completion -----------------------------------------------------------

  const finish = useCallback(() => {
    clock.stop();
    const timeMs = clock.ms;
    finalMsRef.current = timeMs;
    setWon(true);
    setSolving(true);
    haptics.win();
    sfx.win();
    const sec = Math.round(timeMs / 1000);
    const score = Math.max(
      10,
      100 - Math.floor(sec / 5) - mistakesRef.current * 3 - hintsUsed * HINT_PENALTY,
    );
    const baseStars = sec < 90 ? 3 : sec < 180 ? 2 : 1;
    const stars = hintsUsed > 0 ? Math.min(baseStars, 2) : baseStars;
    const revealMs = reducedMotion ? 120 : 820;
    setTimeout(() => setShowModal(true), revealMs);
    onComplete({
      status: "won",
      score,
      timeMs,
      mistakes: mistakesRef.current,
      stars,
      shareText: shareLine(timeMs, size),
      detail: { difficulty: puzzle.difficulty, hintsUsed, size, insight: GAME_METAS.crossword.insight },
    });
  }, [clock, onComplete, puzzle.difficulty, reducedMotion, hintsUsed, size]);

  const tryComplete = useCallback(
    (next: string[]) => {
      // Every white cell filled?
      let allFilled = true;
      for (let i = 0; i < cellCount; i++) {
        if (!block[i] && next[i] === "") {
          allFilled = false;
          break;
        }
      }
      if (!allFilled) return;
      if (isSolved(next, solution, block)) {
        finish();
      } else {
        mistakesRef.current += 1;
        haptics.error();
        sfx.wrong();
        if (!reducedMotion) {
          setShake(true);
          setTimeout(() => setShake(false), 480);
        }
      }
    },
    [block, cellCount, solution, finish, reducedMotion],
  );

  // --- caret movement -------------------------------------------------------

  /** Next empty cell in the active run after `from` (inclusive of advance). */
  const advance = useCallback(
    (from: number) => {
      if (!activeEntry) return;
      const cells = activeEntry.cells;
      const pos = cells.indexOf(from);
      if (pos < 0) return;
      // Find next empty cell after `from` in the run.
      for (let k = pos + 1; k < cells.length; k++) {
        if (letters[cells[k]] === "") {
          setSelected(cells[k]);
          return;
        }
      }
      // None empty after — wrap to first empty in run (if any), else stay.
      for (let k = 0; k < cells.length; k++) {
        if (letters[cells[k]] === "") {
          setSelected(cells[k]);
          return;
        }
      }
      // Run full: move to last cell.
      setSelected(cells[cells.length - 1]);
    },
    [activeEntry, letters],
  );

  // --- input ----------------------------------------------------------------

  const typeLetter = useCallback(
    (ch: string) => {
      if (won || selected == null || block[selected]) return;
      const L = ch.toUpperCase();
      if (!/^[A-Z]$/.test(L)) return;
      // A hint-locked cell is correct already; typing over it is disallowed.
      if (hintCells.has(selected)) {
        advance(selected);
        return;
      }
      const target = selected;
      setLetters((prev) => {
        const nextArr = prev.slice();
        nextArr[target] = L;
        sfx.place();
        haptics.success();
        queueMicrotask(() => tryComplete(nextArr));
        return nextArr;
      });
      advance(target);
    },
    [won, selected, block, hintCells, advance, tryComplete],
  );

  const backspace = useCallback(() => {
    if (won || selected == null || block[selected]) return;
    if (hintCells.has(selected)) return;
    setLetters((prev) => {
      const nextArr = prev.slice();
      if (nextArr[selected] !== "") {
        // Clear current cell.
        nextArr[selected] = "";
      } else if (activeEntry) {
        // Step back to the previous cell in the run and clear it.
        const cells = activeEntry.cells;
        const pos = cells.indexOf(selected);
        for (let k = pos - 1; k >= 0; k--) {
          if (!hintCells.has(cells[k])) {
            nextArr[cells[k]] = "";
            setSelected(cells[k]);
            break;
          }
        }
      }
      return nextArr;
    });
    sfx.tap();
    haptics.tap();
  }, [won, selected, block, hintCells, activeEntry]);

  // --- cell selection -------------------------------------------------------

  const selectCell = useCallback(
    (i: number) => {
      if (block[i]) return;
      if (selected === i) {
        // Toggle orientation if the cell belongs to both runs.
        if (acrossOf[i] >= 0 && downOf[i] >= 0) {
          setOrient((o) => (o === "across" ? "down" : "across"));
        }
      } else {
        setSelected(i);
        // Prefer current orientation; fall back to whichever run exists.
        const pref = orient === "across" ? acrossOf[i] : downOf[i];
        if (pref < 0) setOrient(orient === "across" ? "down" : "across");
      }
      if (!won) {
        sfx.tap();
        haptics.tap();
      }
    },
    [block, selected, acrossOf, downOf, orient, won],
  );

  // --- entry navigation (prev/next clue) -----------------------------------

  const stepEntry = useCallback(
    (delta: number) => {
      if (entries.length === 0) return;
      const cur = activeEntryIdx >= 0 ? activeEntryIdx : 0;
      const nextIdx = (cur + delta + entries.length) % entries.length;
      const e = entries[nextIdx];
      setOrient(e.dir);
      // Select first empty cell of the entry, else its first cell.
      const firstEmpty = e.cells.find((c) => letters[c] === "" && !hintCells.has(c));
      setSelected(firstEmpty ?? e.cells[0]);
      if (!won) {
        sfx.tap();
        haptics.tap();
      }
    },
    [entries, activeEntryIdx, letters, hintCells, won],
  );

  // --- hint -----------------------------------------------------------------

  const handleHint = useCallback(() => {
    if (won || hintsUsed >= maxHints) return;
    const cell = getHintCell(letters, solution, block, selected);
    if (cell == null) return;
    const value = solution[cell];
    setHintsUsed((h) => h + 1);
    setHintCells((prev) => {
      const nx = new Set(prev);
      nx.add(cell);
      return nx;
    });
    setSelected(cell);
    if (!reducedMotion) {
      setRevealCell(cell);
      setTimeout(() => setRevealCell((c) => (c === cell ? null : c)), 600);
    }
    sfx.place();
    haptics.success();
    setLetters((prev) => {
      const nextArr = prev.slice();
      nextArr[cell] = value;
      queueMicrotask(() => tryComplete(nextArr));
      return nextArr;
    });
  }, [won, hintsUsed, maxHints, letters, solution, block, selected, reducedMotion, tryComplete]);

  // --- arrow movement (skip blocks) ----------------------------------------

  const moveArrow = useCallback(
    (dr: number, dc: number) => {
      setSelected((cur) => {
        if (cur == null) return firstWhite >= 0 ? firstWhite : null;
        let r = rowOf(cur, size);
        let c = colOf(cur, size);
        for (let step = 0; step < size; step++) {
          r += dr;
          c += dc;
          if (r < 0 || r >= size || c < 0 || c >= size) return cur;
          const ni = cellAt(r, c, size);
          if (!block[ni]) return ni;
        }
        return cur;
      });
      // Align orientation to the movement axis when possible.
      if (dr !== 0) setOrient("down");
      else if (dc !== 0) setOrient("across");
    },
    [size, block, firstWhite],
  );

  // --- physical keyboard ----------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (won) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        typeLetter(e.key);
        e.preventDefault();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        backspace();
        e.preventDefault();
      } else if (e.key === " ") {
        if (selected != null && acrossOf[selected] >= 0 && downOf[selected] >= 0) {
          setOrient((o) => (o === "across" ? "down" : "across"));
        }
        e.preventDefault();
      } else if (e.key === "ArrowUp") (moveArrow(-1, 0), e.preventDefault());
      else if (e.key === "ArrowDown") (moveArrow(1, 0), e.preventDefault());
      else if (e.key === "ArrowLeft") (moveArrow(0, -1), e.preventDefault());
      else if (e.key === "ArrowRight") (moveArrow(0, 1), e.preventDefault());
      else if (e.key === "Tab") {
        stepEntry(e.shiftKey ? -1 : 1);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [won, typeLetter, backspace, moveArrow, stepEntry, selected, acrossOf, downOf]);

  // --- status text ----------------------------------------------------------

  const status = won
    ? "Crossword solved."
    : activeEntry
      ? `${activeEntry.num} ${activeEntry.dir}: ${activeEntry.clue}. ${filledCorrect} of ${totalWhite} cells correct.`
      : `${filledCorrect} of ${totalWhite} cells correct.`;

  // --- render ---------------------------------------------------------------

  const gridMax = "min(92vw, 380px)";

  return (
    <div className="flex w-full flex-col items-center">
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      {/* meta row */}
      <div
        className={cn(
          "mb-3 flex w-full items-center justify-between font-mono text-[11px] text-ink-mute",
          !reducedMotion && "animate-rise",
        )}
        style={{ maxWidth: gridMax }}
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
        <span className="tabular-nums tracking-[0.12em]" style={{ color: ACCENT.soft }}>
          {filledCorrect}/{totalWhite}
        </span>
        {!hostTimer && (
          <span aria-hidden className="tabular-nums tracking-[0.1em]">
            {formatClock(won ? finalMsRef.current : clock.ms)}
          </span>
        )}
      </div>

      {/* progress bar */}
      <div
        className="mb-3 h-1 w-full overflow-hidden rounded-pill bg-white/[0.06]"
        style={{ maxWidth: gridMax }}
        role="presentation"
      >
        <div
          className={cn("h-full rounded-pill", !reducedMotion && "transition-[width] duration-300")}
          style={{
            width: `${totalWhite ? (filledCorrect / totalWhite) * 100 : 0}%`,
            backgroundImage: `linear-gradient(90deg, ${ACCENT.from}, ${ACCENT.to})`,
          }}
        />
      </div>

      {/* grid */}
      <div
        className={cn(
          "grid aspect-square w-full overflow-hidden rounded-2xl border-2",
          shake && !reducedMotion && "animate-shake",
        )}
        style={{
          maxWidth: gridMax,
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          borderColor: `${ACCENT.solid}66`,
          background: `${ACCENT.solid}1a`,
          boxShadow: `0 18px 50px -20px ${ACCENT.solid}59, inset 0 0 40px -28px ${ACCENT.solid}`,
        }}
        role="grid"
        aria-label={`Crossword grid, ${size} by ${size}`}
      >
        {Array.from({ length: cellCount }, (_, i) => {
          const r = rowOf(i, size);
          const c = colOf(i, size);
          const isBlock = block[i];
          const num = numbers[i];

          if (isBlock) {
            return (
              <div
                key={i}
                role="presentation"
                aria-hidden
                style={{
                  background: "rgba(4,7,16,0.92)",
                  borderRight: c === size - 1 ? "none" : "1px solid rgba(255,255,255,0.05)",
                  borderBottom: r === size - 1 ? "none" : "1px solid rgba(255,255,255,0.05)",
                }}
              />
            );
          }

          const value = letters[i];
          const isSel = selected === i;
          const inActive = activeCells.has(i);
          const isHint = hintCells.has(i);
          const wrong = checking && value !== "" && value !== solution[i] && !isHint;
          const revealDelay = solving && !reducedMotion ? (r + c) * 30 : 0;

          let bg = "rgba(7,11,24,0.55)";
          if (inActive) bg = `${ACCENT.solid}1f`;
          if (isSel) bg = `${ACCENT.solid}40`;
          if (isHint && !isSel) bg = `${ACCENT.solid}26`;
          if (wrong) bg = "rgba(255,107,157,0.18)";

          const color = wrong ? WRONG : isHint ? ACCENT.soft : "#eafcff";

          const entryNum = activeEntry?.num;
          const dirWord = activeEntry?.dir;

          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-label={`Row ${r + 1} column ${c + 1}${value ? `, letter ${value}` : ", empty"}${num ? `, clue ${num}` : ""}${inActive && dirWord ? `, ${entryNum} ${dirWord}` : ""}${isHint ? ", revealed by hint" : ""}${wrong ? ", incorrect" : ""}`}
              aria-selected={isSel}
              disabled={won}
              onClick={() => selectCell(i)}
              className={cn(
                "relative flex touch-manipulation select-none items-center justify-center font-display outline-none",
                !reducedMotion && "transition-[background-color,color] duration-150",
                wrong && "ring-2 ring-inset ring-[#ff6b9d]",
              )}
              style={{
                background: bg,
                color,
                fontWeight: 600,
                fontSize: "clamp(16px, 6vw, 26px)",
                animation:
                  solving && !reducedMotion
                    ? `btSolve 0.5s ease ${revealDelay}ms both`
                    : revealCell === i && !reducedMotion
                      ? "btPop 0.32s ease both"
                      : undefined,
                boxShadow: isSel ? `inset 0 0 0 2px ${ACCENT.solid}` : undefined,
                borderRight: c === size - 1 ? "none" : "1px solid rgba(255,255,255,0.07)",
                borderBottom: r === size - 1 ? "none" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {num > 0 && (
                <span
                  className="pointer-events-none absolute left-[2px] top-[1px] font-mono leading-none"
                  style={{
                    fontSize: "clamp(7px, 2.1vw, 10px)",
                    color: isSel ? "#04060f" : "rgba(226,234,255,0.55)",
                  }}
                  aria-hidden
                >
                  {num}
                </span>
              )}
              {value}
            </button>
          );
        })}
      </div>

      {/* active clue strip */}
      <div
        className="mt-4 flex w-full items-stretch gap-1.5"
        style={{ maxWidth: gridMax }}
      >
        <button
          type="button"
          onClick={() => stepEntry(-1)}
          disabled={won || entries.length === 0}
          aria-label="Previous clue"
          className="flex min-h-[48px] w-11 shrink-0 items-center justify-center rounded-xl border font-display text-lg disabled:opacity-40"
          style={{ borderColor: `${ACCENT.solid}33`, background: `${ACCENT.solid}12`, color: ACCENT.soft }}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => {
            if (selected != null && acrossOf[selected] >= 0 && downOf[selected] >= 0) {
              setOrient((o) => (o === "across" ? "down" : "across"));
            }
          }}
          disabled={won}
          aria-label="Active clue. Tap to toggle across or down."
          className="flex min-h-[48px] flex-1 flex-col justify-center rounded-xl border px-3 py-1.5 text-left"
          style={{ borderColor: `${ACCENT.solid}33`, background: `${ACCENT.solid}12` }}
        >
          {activeEntry ? (
            <>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ color: ACCENT.soft }}
              >
                {activeEntry.num} {activeEntry.dir}
              </span>
              <span className="font-display text-[13.5px] leading-tight text-[#eafcff]">
                {activeEntry.clue}
              </span>
            </>
          ) : (
            <span className="font-display text-[13px] text-ink-mute">Tap a cell to start.</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => stepEntry(1)}
          disabled={won || entries.length === 0}
          aria-label="Next clue"
          className="flex min-h-[48px] w-11 shrink-0 items-center justify-center rounded-xl border font-display text-lg disabled:opacity-40"
          style={{ borderColor: `${ACCENT.solid}33`, background: `${ACCENT.solid}12`, color: ACCENT.soft }}
        >
          ›
        </button>
      </div>

      {/* on-screen keyboard */}
      <div className="mt-3 flex w-full flex-col gap-1.5" style={{ maxWidth: gridMax }}>
        {KEY_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-[3px]">
            {ri === 2 && (
              <button
                type="button"
                onClick={backspace}
                disabled={won}
                aria-label="Backspace"
                className={cn(
                  "flex h-[clamp(44px,11vw,52px)] min-w-[34px] flex-[1.4] items-center justify-center rounded-[8px] font-display text-base outline-none disabled:opacity-40",
                  !reducedMotion && "active:scale-95",
                )}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#eafcff" }}
              >
                ⌫
              </button>
            )}
            {row.split("").map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => typeLetter(k)}
                disabled={won}
                aria-label={`Letter ${k}`}
                className={cn(
                  "flex h-[clamp(44px,11vw,52px)] min-w-[26px] flex-1 items-center justify-center rounded-[8px] font-display text-[clamp(13px,3.6vw,16px)] font-semibold outline-none disabled:opacity-40",
                  !reducedMotion && "transition-transform active:scale-90",
                )}
                style={{
                  background: `${ACCENT.solid}1c`,
                  border: `1px solid ${ACCENT.solid}33`,
                  color: "#eafcff",
                }}
              >
                {k}
              </button>
            ))}
            {ri === 2 && (
              <button
                type="button"
                onClick={() => {
                  if (selected != null && acrossOf[selected] >= 0 && downOf[selected] >= 0) {
                    setOrient((o) => (o === "across" ? "down" : "across"));
                  }
                }}
                disabled={won}
                aria-label="Toggle across or down"
                className={cn(
                  "flex h-[clamp(44px,11vw,52px)] min-w-[34px] flex-[1.4] items-center justify-center rounded-[8px] font-display text-sm outline-none disabled:opacity-40",
                  !reducedMotion && "active:scale-95",
                )}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: ACCENT.soft }}
              >
                ⇄
              </button>
            )}
          </div>
        ))}
      </div>

      {/* controls: check toggle + hint */}
      <div
        className="mt-3 flex w-full items-center justify-center gap-3"
        style={{ maxWidth: gridMax }}
      >
        <button
          type="button"
          onClick={() => setChecking((v) => !v)}
          aria-pressed={checking}
          disabled={won}
          className={cn(
            "min-h-[44px] flex-1 rounded-pill border px-5 py-2.5 font-display text-[13.5px] outline-none disabled:opacity-40",
            !reducedMotion && "transition-colors active:scale-[0.98]",
          )}
          style={
            checking
              ? { color: ACCENT.soft, borderColor: `${ACCENT.solid}99`, background: `${ACCENT.solid}1f` }
              : { color: "#eaf1ff", borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.04)" }
          }
        >
          Check · {checking ? "On" : "Off"}
        </button>
        {maxHints > 0 && (
          <HintButton
            used={hintsUsed}
            max={maxHints}
            onHint={handleHint}
            accent={ACCENT}
            disabled={won}
          />
        )}
      </div>

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        title="Crossword solved."
        statValue={formatClock(finalMsRef.current)}
        statLabel="SOLVE TIME"
        insight={GAME_METAS.crossword.insight}
        share={shareLine(finalMsRef.current, size)}
      />
    </div>
  );
}
