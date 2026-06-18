"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameId, GameResult } from "@/lib/types";
import { getGame } from "@/lib/games";
import { useProgress } from "@/lib/progress";
import { todayISO, dateLabel } from "@/lib/daily";
import { GameIcon } from "@/components/GameIcon";
import { cn } from "@/lib/cn";

export function GameHost({ gameId, dateParam }: { gameId: GameId; dateParam?: string }) {
  const game = getGame(gameId)!;
  const meta = game.meta;
  const today = todayISO();
  const dateISO = dateParam || today;
  const isArchive = dateISO !== today;

  const hydrated = useProgress((s) => s.hydrated);
  const recordResult = useProgress((s) => s.recordResult);
  const saveGameState = useProgress((s) => s.saveGameState);
  const getResult = useProgress((s) => s.getResult);
  const getGameState = useProgress((s) => s.getGameState);
  const zen = useProgress((s) => s.settings.zen);

  const puzzle = useMemo(() => game.getDailyPuzzle(dateISO), [game, dateISO]);
  const [done, setDone] = useState<GameResult | null>(null);

  // Reflect any previously stored result for this date.
  useEffect(() => {
    if (!hydrated) return;
    const r = getResult(gameId, dateISO);
    if (r) setDone(r);
  }, [hydrated, getResult, gameId, dateISO]);

  const savedState = hydrated ? getGameState(gameId, dateISO) : null;

  const reducedMotion =
    zen ||
    (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  const onComplete = useCallback(
    (result: GameResult) => {
      recordResult(gameId, dateISO, result, !isArchive);
      setDone(result);
    },
    [recordResult, gameId, dateISO, isArchive],
  );

  const onPersistState = useCallback(
    (state: unknown) => saveGameState(gameId, dateISO, state),
    [saveGameState, gameId, dateISO],
  );

  const Component = game.Component as React.ComponentType<{
    puzzle: unknown;
    dateISO: string;
    onComplete: (r: GameResult) => void;
    savedState?: unknown;
    onPersistState?: (s: unknown) => void;
    reducedMotion?: boolean;
    isArchive?: boolean;
  }>;

  // Remount the game when the puzzle/date changes.
  const keyRef = useRef(`${gameId}:${dateISO}`);
  keyRef.current = `${gameId}:${dateISO}`;

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

      <div
        className={cn(
          "rounded-3xl border border-line bg-gradient-to-b from-[rgba(11,15,31,0.65)] to-[rgba(6,8,18,0.6)] p-4 sm:p-6",
        )}
      >
        <Component
          key={keyRef.current}
          puzzle={puzzle}
          dateISO={dateISO}
          onComplete={onComplete}
          savedState={savedState}
          onPersistState={onPersistState}
          reducedMotion={Boolean(reducedMotion)}
          isArchive={isArchive}
        />
      </div>

      {done && (
        <div className="mt-4 flex flex-col items-center gap-2 text-center">
          <div className="font-mono text-xs tracking-[0.16em] text-mint">
            {done.status === "won" ? "SOLVED" : done.status === "lost" ? "COMPLETE" : "PLAYED"}
            {typeof done.score === "number" ? ` · ${done.score} pts` : ""}
          </div>
          <Link href="/" className="font-mono text-xs text-cyan">
            Back to today&apos;s puzzles →
          </Link>
        </div>
      )}
    </div>
  );
}
