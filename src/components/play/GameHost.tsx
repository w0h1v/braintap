"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import type { GameId, GameResult, Difficulty } from "@/lib/types";
import { getGame } from "@/lib/games";
import { useProgress } from "@/lib/progress";
import { syncProgress } from "@/lib/sync";
import { todayISO, dateLabel } from "@/lib/daily";
import { DIFFICULTIES, DIFFICULTY_META, nextDifficulty } from "@/lib/difficulty";
import { useGameClock } from "@/lib/useGameClock";
import { GameIcon } from "@/components/GameIcon";
import { cn } from "@/lib/cn";

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type HostComponent = ComponentType<{
  puzzle: unknown;
  dateISO: string;
  onComplete: (r: GameResult) => void;
  savedState?: unknown;
  onPersistState?: (s: unknown) => void;
  reducedMotion?: boolean;
  isArchive?: boolean;
  difficulty?: Difficulty;
  hostTimer?: boolean;
}>;

export function GameHost({ gameId, dateParam }: { gameId: GameId; dateParam?: string }) {
  const game = getGame(gameId)!;
  const meta = game.meta;
  const supportsDiff = Boolean(game.supportsDifficulty);
  const today = todayISO();
  const dateISO = dateParam || today;
  const isArchive = dateISO !== today;

  const hydrated = useProgress((s) => s.hydrated);
  const recordResult = useProgress((s) => s.recordResult);
  const saveGameState = useProgress((s) => s.saveGameState);
  const getGameState = useProgress((s) => s.getGameState);
  const zen = useProgress((s) => s.settings.zen);
  // Reactive per-tier + representative results for this game/day.
  const tierMap = useProgress((s) => s.tierResults[dateISO]?.[gameId]);
  const repResult = useProgress((s) => s.results[dateISO]?.[gameId]);

  const reducedMotion =
    zen ||
    (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  const isUnlocked = useCallback(
    (d: Difficulty): boolean => {
      const order = DIFFICULTY_META[d].order;
      if (order === 0) return true;
      return tierMap?.[DIFFICULTIES[order - 1]]?.status === "won";
    },
    [tierMap],
  );

  // Active tier. Initialise once hydrated to the lowest unlocked-but-unsolved tier.
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const initRef = useRef(false);
  useEffect(() => {
    if (!supportsDiff || !hydrated || initRef.current) return;
    initRef.current = true;
    let pick: Difficulty = "easy";
    for (const d of DIFFICULTIES) {
      const order = DIFFICULTY_META[d].order;
      const unlocked = order === 0 || tierMap?.[DIFFICULTIES[order - 1]]?.status === "won";
      if (!unlocked) break;
      pick = d;
      if (tierMap?.[d]?.status !== "won") break;
    }
    setDifficulty(pick);
  }, [supportsDiff, hydrated, tierMap]);

  const activeDiff: Difficulty | undefined = supportsDiff ? difficulty : undefined;

  const puzzle = useMemo(
    () => game.getDailyPuzzle(dateISO, activeDiff),
    [game, dateISO, activeDiff],
  );

  const savedState = hydrated ? getGameState(gameId, dateISO, activeDiff) : null;

  const tierResult = supportsDiff ? tierMap?.[difficulty] : repResult;
  const tierWon = tierResult?.status === "won";

  // Unified timer for difficulty games: reset + run when the active tier changes
  // (unless it's already solved, in which case we show the saved best time).
  const clock = useGameClock(false);
  useEffect(() => {
    if (!supportsDiff) return;
    clock.reset(0);
    if (tierWon) clock.stop();
    else clock.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportsDiff, difficulty]);

  const onComplete = useCallback(
    (result: GameResult) => {
      clock.stop();
      // Prefer the game's own measured time (sudoku/schulte); fall back to the
      // host clock for games that don't track time themselves (e.g. connections).
      const finalResult: GameResult = supportsDiff
        ? { ...result, timeMs: result.timeMs ?? clock.ms }
        : result;
      recordResult(gameId, dateISO, finalResult, !isArchive, activeDiff);
      // Push to the cloud so signed-in players land on the (per-tier)
      // leaderboard immediately. Guarded no-op for guests / offline.
      void syncProgress();
    },
    [recordResult, gameId, dateISO, isArchive, activeDiff, supportsDiff, clock],
  );

  const onPersistState = useCallback(
    (state: unknown) => saveGameState(gameId, dateISO, state, activeDiff),
    [saveGameState, gameId, dateISO, activeDiff],
  );

  const Component = game.Component as HostComponent;
  const componentKey = `${gameId}:${dateISO}:${activeDiff ?? "solo"}`;

  const elapsed = tierWon ? tierResult?.timeMs ?? 0 : clock.ms;
  const nextTier = activeDiff ? nextDifficulty(activeDiff) : null;

  return (
    <div className="mx-auto max-w-shell px-4 pb-16 pt-24 sm:px-6">
      {/* header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl border border-line-strong bg-white/[0.03] px-3 py-2 font-mono text-xs text-ink-soft transition-colors hover:text-ink"
        >
          ← Today
        </Link>
        <div className="flex items-center gap-2.5">
          <span style={{ color: meta.accent.solid }}>
            <GameIcon id={meta.icon} size={20} />
          </span>
          <div className="text-right">
            <div className="font-display text-sm font-semibold leading-tight text-ink">
              {meta.name}
            </div>
            <div className="font-mono text-[10px] tracking-[0.12em] text-ink-mute">
              {isArchive ? dateLabel(dateISO) : "TODAY"}
            </div>
          </div>
        </div>
      </div>

      {isArchive && (
        <div className="mb-4 rounded-xl border border-amber/30 bg-amber/[0.06] px-4 py-2 text-center font-mono text-[11px] text-amber-soft">
          Archive puzzle · {dateLabel(dateISO)} — does not affect your streak
        </div>
      )}

      {/* difficulty tier bar + timer */}
      {supportsDiff && (
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Difficulty"
            className="flex gap-1 rounded-pill border border-line bg-white/[0.02] p-1"
          >
            {DIFFICULTIES.map((d) => {
              const dm = DIFFICULTY_META[d];
              const unlocked = isUnlocked(d);
              const won = tierMap?.[d]?.status === "won";
              const active = d === difficulty;
              const best = tierMap?.[d]?.timeMs;
              const priorLabel =
                dm.order > 0 ? DIFFICULTY_META[DIFFICULTIES[dm.order - 1]].label : "";
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={!unlocked}
                  onClick={() => unlocked && setDifficulty(d)}
                  title={unlocked ? dm.label : `Solve ${priorLabel} to unlock`}
                  className={cn(
                    "flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 font-mono text-[11px] tracking-[0.06em] transition-colors",
                    active
                      ? "text-[#04060f]"
                      : unlocked
                        ? "text-ink-soft hover:text-ink"
                        : "cursor-not-allowed text-ink-faint opacity-60",
                  )}
                  style={
                    active
                      ? { backgroundColor: dm.color }
                      : undefined
                  }
                >
                  <span aria-hidden>
                    {won ? "✓" : !unlocked ? "🔒" : "○"}
                  </span>
                  <span className="uppercase">{dm.label}</span>
                  {best ? (
                    <span className={cn("tabular-nums", active ? "opacity-70" : "text-ink-faint")}>
                      {fmtMs(best)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* timer chip */}
          <div
            className="flex items-center gap-2 self-start rounded-pill border border-line bg-white/[0.02] px-3.5 py-1.5 font-mono text-[12px] tabular-nums text-ink-soft sm:self-auto"
            aria-label={tierWon ? "Best time" : "Elapsed time"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 9v4l2.5 2M9 2h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {tierWon ? `Best ${fmtMs(elapsed)}` : fmtMs(elapsed)}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-line bg-gradient-to-b from-[rgba(11,15,31,0.65)] to-[rgba(6,8,18,0.6)] p-4 sm:p-6">
        <Component
          key={componentKey}
          puzzle={puzzle}
          dateISO={dateISO}
          onComplete={onComplete}
          savedState={savedState}
          onPersistState={onPersistState}
          reducedMotion={Boolean(reducedMotion)}
          isArchive={isArchive}
          difficulty={activeDiff}
          hostTimer={supportsDiff}
        />
      </div>

      {tierResult && (
        <div className="mt-4 flex flex-col items-center gap-2 text-center">
          <div className="font-mono text-xs tracking-[0.16em] text-mint">
            {tierWon ? "SOLVED" : tierResult.status === "lost" ? "COMPLETE" : "PLAYED"}
            {typeof tierResult.score === "number" ? ` · ${tierResult.score} pts` : ""}
            {tierResult.timeMs ? ` · ${fmtMs(tierResult.timeMs)}` : ""}
          </div>

          {supportsDiff && tierWon && nextTier ? (
            <button
              type="button"
              onClick={() => setDifficulty(nextTier)}
              className="rounded-xl px-4 py-2 font-display text-sm font-semibold text-[#04060f]"
              style={{ backgroundColor: DIFFICULTY_META[nextTier].color }}
            >
              Next: {DIFFICULTY_META[nextTier].label} →
            </button>
          ) : supportsDiff && tierWon && !nextTier ? (
            <div className="font-mono text-[11px] tracking-[0.14em] text-amber-soft">
              ALL TIERS CLEARED 🎉
            </div>
          ) : null}

          <Link href="/" className="font-mono text-xs text-cyan">
            Back to today&apos;s puzzles →
          </Link>
        </div>
      )}
    </div>
  );
}
