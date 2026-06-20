"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { CompletionModal } from "@/components/play/CompletionModal";
import { haptics } from "@/lib/haptics";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import {
  INITIAL_LEVEL,
  GRID,
  cellsFor,
  levelForRound,
  showDuration,
  evaluateTap,
  isRoundComplete,
  type VaultPuzzle,
} from "./engine";

const ACCENT = GAME_METAS.vault.accent;
const INSIGHT = GAME_METAS.vault.insight;

const GOOD = "#7cf5c4";
const BAD = "#ff5a7c";

type Phase = "idle" | "show" | "input" | "cleared" | "over";

interface VaultState {
  /** Highest round reached / currently on (1-indexed). */
  round: number;
  /** Whether the run has ended. */
  ended: boolean;
  /** Whether the run was won (cleared all rounds). */
  won: boolean;
  /** Grid edge length the saved progress belongs to (back-compat optional). */
  grid?: number;
  /** Starting pattern size the saved progress belongs to (back-compat optional). */
  initialLevel?: number;
}

export function Vault({
  puzzle,
  onComplete,
  savedState,
  onPersistState,
  reducedMotion,
}: GameComponentProps<VaultPuzzle, VaultState>) {
  // Tier parameters come from the puzzle the host passes in.
  const grid = puzzle.grid ?? GRID;
  const cells = cellsFor(grid);
  const initialLevel = puzzle.initialLevel ?? INITIAL_LEVEL;
  const maxRounds = puzzle.rounds.length;

  // Only resume a saved run when it belongs to THIS tier (same grid + start
  // size). Older saves (no grid/initialLevel) are assumed to be the medium
  // default so they never crash; mismatched tiers start fresh.
  const saved = savedState ?? null;
  const savedMatchesTier =
    saved != null &&
    (saved.grid ?? GRID) === grid &&
    (saved.initialLevel ?? INITIAL_LEVEL) === initialLevel;

  const [round, setRound] = useState(() =>
    savedMatchesTier && saved && !saved.ended ? saved.round : 1,
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [lit, setLit] = useState<Set<number>>(new Set()); // cells shown cyan
  const [badCell, setBadCell] = useState<number | null>(null);
  const [ended, setEnded] = useState(savedMatchesTier ? saved?.ended ?? false : false);
  const [won, setWon] = useState(savedMatchesTier ? saved?.won ?? false : false);
  const [showModal, setShowModal] = useState(false);
  const [shake, setShake] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const completedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Timing: accumulate input-phase wall-clock so the host's unified timer has a
  // matching result.timeMs. (The host owns the visible clock; we keep logic.)
  const startedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  // The active tier signature; when the host switches difficulty the puzzle (and
  // thus this signature) changes and we reset the in-progress run.
  const tierSig = `${grid}:${initialLevel}:${maxRounds}`;
  const lastTierSigRef = useRef(tierSig);

  const level = levelForRound(round, initialLevel);
  const pattern = puzzle.rounds[Math.min(round, maxRounds) - 1];

  // Clean up any pending timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  // React to a difficulty/tier switch from the host: reset to a fresh run.
  useEffect(() => {
    if (lastTierSigRef.current === tierSig) return;
    lastTierSigRef.current = tierSig;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    completedRef.current = false;
    startedAtRef.current = null;
    elapsedRef.current = 0;
    setRound(1);
    setPhase("idle");
    setPicked(new Set());
    setLit(new Set());
    setBadCell(null);
    setEnded(false);
    setWon(false);
    setShowModal(false);
    setShake(false);
    setHasStarted(false);
  }, [tierSig]);

  // Persist resumable progress (highest round reached + end status + tier).
  useEffect(() => {
    onPersistState?.({ round, ended, won, grid, initialLevel });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, ended, won, grid, initialLevel]);

  const remaining = phase === "input" ? Math.max(0, level - picked.size) : 0;

  const message =
    phase === "show"
      ? "Memorize the pattern…"
      : phase === "input"
        ? remaining === 1
          ? "One more cell"
          : `Rebuild it · ${remaining} cells left`
        : phase === "cleared"
          ? `Round ${round - 1} cleared ✓`
          : phase === "over"
            ? won
              ? "Vault mastered ✓"
              : "Wrong cell — run over"
            : "Memorize the lit cells, then tap them back.";

  const endGame = useCallback(
    (didWin: boolean, finalRound: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      // Capture any in-flight input time.
      if (startedAtRef.current != null) {
        elapsedRef.current += Date.now() - startedAtRef.current;
        startedAtRef.current = null;
      }
      const timeMs = Math.round(elapsedRef.current);
      setEnded(true);
      setWon(didWin);
      setPhase("over");

      const reach = didWin ? maxRounds + 1 : finalRound;
      const held = didWin
        ? levelForRound(maxRounds, initialLevel)
        : levelForRound(finalRound, initialLevel) - 1;
      // Score: progress through the run (0..100). A win is 100.
      const cleared = didWin ? maxRounds : finalRound - 1;
      const score = didWin ? 100 : Math.round((cleared / maxRounds) * 100);

      if (didWin) {
        haptics.win();
        sfx.win();
      } else {
        haptics.error();
        sfx.wrong();
      }

      schedule(() => setShowModal(true), didWin ? 400 : 280);

      onComplete({
        status: didWin ? "won" : "lost",
        score,
        timeMs,
        moves: cleared,
        shareText: `BrainTap · Memory Vault\nReached round ${reach} (${held} cells held)\n\n${
          "🟦".repeat(Math.min(cleared, 10)) || "—"
        }\nbraintap.app/games`,
        detail: { reach, held, won: didWin, grid },
      });
    },
    [onComplete, schedule, maxRounds, initialLevel, grid],
  );

  const startRound = useCallback(() => {
    if (ended) return;
    setHasStarted(true);
    setPicked(new Set());
    setBadCell(null);
    setPhase("show");
    setLit(new Set(pattern));

    const dur = reducedMotion
      ? Math.min(showDuration(level), 1600)
      : showDuration(level);

    schedule(() => {
      setLit(new Set());
      setPhase("input");
      // Start the recall clock once the player must act.
      startedAtRef.current = Date.now();
    }, dur);
  }, [ended, pattern, level, reducedMotion, schedule]);

  const advance = useCallback(() => {
    // Round fully rebuilt — bank its input time.
    if (startedAtRef.current != null) {
      elapsedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    sfx.correct();
    haptics.success();
    const nextRound = round + 1;
    if (round >= maxRounds) {
      endGame(true, round);
      return;
    }
    setRound(nextRound);
    setPhase("cleared");
  }, [round, endGame, maxRounds]);

  const pick = useCallback(
    (cell: number) => {
      if (phase !== "input" || ended) return;
      const result = evaluateTap(pattern, picked, cell);
      if (result === "duplicate") return;

      if (result === "wrong") {
        setBadCell(cell);
        // Reveal the cells the player missed as a clue.
        const missed = new Set(pattern.filter((c) => !picked.has(c)));
        setLit(missed);
        haptics.error();
        sfx.wrong();
        if (!reducedMotion) {
          setShake(true);
          schedule(() => setShake(false), 500);
        }
        schedule(() => endGame(false, round), reducedMotion ? 350 : 700);
        return;
      }

      // Correct cell.
      sfx.place();
      haptics.tap();
      const next = new Set(picked);
      next.add(cell);
      setPicked(next);
      if (isRoundComplete(pattern, next)) {
        advance();
      }
    },
    [phase, ended, pattern, picked, round, endGame, advance, reducedMotion, schedule],
  );

  const cellState = (i: number): "off" | "show" | "good" | "bad" => {
    if (badCell === i) return "bad";
    if (lit.has(i)) return "show";
    if (picked.has(i)) return "good";
    return "off";
  };

  const buttonLabel = phase === "cleared" ? "Next round" : hasStarted ? "Start sequence" : "Start";
  const buttonVisible = (phase === "idle" || phase === "cleared") && !ended;

  return (
    <div className="flex w-full flex-col items-center">
      {/* Status header: round + progress dots */}
      <div className="mb-2.5 flex w-full max-w-[420px] items-center justify-between font-mono text-[10.5px] tracking-[0.12em]">
        <span style={{ color: ACCENT.soft }}>
          ROUND {Math.min(round, maxRounds)}/{maxRounds} · {level} CELLS
        </span>
        <span
          className="flex items-center gap-[5px]"
          role="img"
          aria-label={`${Math.min(round - 1, maxRounds)} of ${maxRounds} rounds cleared`}
        >
          {Array.from({ length: maxRounds }, (_, i) => {
            const done = i < Math.min(round - 1, maxRounds);
            return (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  "h-[6px] w-[6px] rounded-full",
                  reducedMotion ? "" : "transition-all duration-300",
                )}
                style={{
                  background: done ? ACCENT.solid : "rgba(255,255,255,0.14)",
                  boxShadow: done ? `0 0 6px ${ACCENT.solid}99` : "none",
                }}
              />
            );
          })}
        </span>
      </div>

      {/* Live status message */}
      <div
        role="status"
        aria-live="polite"
        className="mb-2.5 flex min-h-[24px] items-center justify-center text-center font-mono text-[13px]"
        style={{ color: phase === "over" && !won ? BAD : ACCENT.soft }}
      >
        {message}
      </div>

      {/* Show-phase countdown bar (visual cue that memorize time is ticking) */}
      <div
        className="mb-3 h-[3px] w-full max-w-[min(92vw,420px)] overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
        aria-hidden="true"
      >
        {phase === "show" && !reducedMotion && (
          <div
            key={round}
            className="h-full origin-left"
            style={{
              background: `linear-gradient(90deg, ${ACCENT.from}, ${ACCENT.to})`,
              boxShadow: `0 0 8px ${ACCENT.solid}88`,
              animation: `vaultCountdown ${showDuration(level)}ms linear forwards`,
            }}
          />
        )}
      </div>

      {/* Grid */}
      <div
        className={cn(
          "grid w-full max-w-[min(92vw,420px)] gap-[2.2vw] sm:gap-[9px]",
          shake && !reducedMotion && "animate-shake",
        )}
        style={{ gridTemplateColumns: `repeat(${grid}, 1fr)` }}
        role="grid"
        aria-label="Memory vault grid"
      >
        {Array.from({ length: cells }, (_, i) => {
          const r = Math.floor(i / grid);
          const c = i % grid;
          const state = cellState(i);
          const interactive = phase === "input" && !ended;

          let bg = "rgba(255,255,255,0.045)";
          let border = "rgba(255,255,255,0.09)";
          let shadow = "none";
          if (state === "show") {
            bg = ACCENT.solid;
            border = ACCENT.solid;
            shadow = `0 0 18px ${ACCENT.solid}b3`;
          } else if (state === "good") {
            bg = GOOD;
            border = GOOD;
            shadow = `0 0 16px ${GOOD}99`;
          } else if (state === "bad") {
            bg = BAD;
            border = BAD;
            shadow = `0 0 18px ${BAD}aa`;
          }

          const lifted = state === "show" || state === "good" || state === "bad";

          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-label={`Row ${r + 1} column ${c + 1}${
                state === "good" ? ", selected" : ""
              }`}
              aria-selected={state === "good"}
              disabled={!interactive}
              onClick={() => pick(i)}
              className={cn(
                "aspect-square min-h-[44px] rounded-[11px] border outline-none",
                reducedMotion ? "" : "transition-all duration-150 ease-out",
                interactive && "active:scale-90",
                interactive &&
                  "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04060f]",
              )}
              style={{
                background: bg,
                borderColor: border,
                boxShadow: shadow,
                transform:
                  lifted && !reducedMotion ? "scale(1.04)" : undefined,
                cursor: interactive ? "pointer" : "default",
                // @ts-expect-error -- CSS var consumed by ring utility
                "--tw-ring-color": `${ACCENT.solid}cc`,
              }}
            />
          );
        })}
      </div>

      {/* Intro / instructions — only before the very first sequence */}
      {phase === "idle" && !hasStarted && !ended && (
        <p className="mt-4 max-w-[340px] text-center font-mono text-[11.5px] leading-relaxed text-ink-faint">
          Watch the cyan cells, then tap them all back — order doesn&apos;t
          matter. Each cleared round adds one more cell. One wrong tap ends the
          run.
        </p>
      )}

      {/* Primary action button */}
      {buttonVisible && (
        <button
          type="button"
          onClick={() => startRound()}
          aria-label={`${buttonLabel}, memorize ${level} cells`}
          className={cn(
            "mt-6 rounded-xl px-8 py-3.5 font-display text-[15px] font-semibold text-[#04060f]",
            reducedMotion ? "" : "transition-transform active:scale-95",
            reducedMotion ? "" : "animate-pop",
          )}
          style={{
            backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})`,
            boxShadow: `0 8px 24px -8px ${ACCENT.solid}99`,
          }}
        >
          {buttonLabel}
        </button>
      )}

      {/* Show / input phases: keep layout height stable with a quiet hint */}
      {(phase === "show" || phase === "input") && (
        <p className="mt-6 h-[20px] text-center font-mono text-[11px] text-ink-faint">
          {phase === "show" ? "Hold the shape in mind…" : "Tap the cells you saw"}
        </p>
      )}

      {ended && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="mt-6 rounded-pill border border-line-strong px-6 py-2.5 font-display text-[13.5px] text-[#eaf1ff] transition-transform active:scale-95"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          View result
        </button>
      )}

      <CompletionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        accent={ACCENT}
        won={won}
        eyebrow="VAULT MASTERED"
        title={won ? "Vault mastered." : "Sequence broken."}
        statValue={`Round ${won ? maxRounds + 1 : round}`}
        statLabel={`${won ? levelForRound(maxRounds, initialLevel) : Math.max(0, level - 1)} CELLS HELD`}
        insight={INSIGHT}
        share={`BrainTap · Memory Vault\nReached round ${won ? maxRounds + 1 : round} (${
          won ? levelForRound(maxRounds, initialLevel) : Math.max(0, level - 1)
        } cells held)\n\n${"🟦".repeat(Math.min(won ? maxRounds : round - 1, 10)) || "—"}\nbraintap.app/games`}
      />

      {!reducedMotion && (
        <style>{`@keyframes vaultCountdown{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
      )}
    </div>
  );
}
