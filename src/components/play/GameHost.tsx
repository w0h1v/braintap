"use client";

import Link from "next/link";
import {
  memo,
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
import { DifficultyContext } from "@/components/play/DifficultyContext";
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

/**
 * Self-contained timer chip. Owns its own clock so the 4Hz tick re-renders ONLY
 * this chip, never the game subtree. Resets to `initialMs` (the tier's banked
 * elapsed) whenever `resetKey` changes; runs while `run` is true; shows the
 * frozen best time once solved. Reports the live ms up via `onMs` (a ref write,
 * so it never re-renders the parent).
 */
const TierTimer = memo(function TierTimer({
  resetKey,
  initialMs,
  run,
  frozenMs,
  onMs,
}: {
  resetKey: string;
  initialMs: number;
  run: boolean;
  frozenMs: number | null;
  onMs: (ms: number) => void;
}) {
  const clock = useGameClock(false, initialMs);
  useEffect(() => {
    clock.reset(initialMs);
    if (run) clock.start();
    else clock.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, run]);
  useEffect(() => {
    onMs(clock.ms);
  }, [clock.ms, onMs]);

  const shown = frozenMs != null ? frozenMs : clock.ms;
  return (
    <div
      className="flex items-center gap-2 self-start rounded-pill border border-line bg-white/[0.02] px-3.5 py-1.5 font-mono text-[12px] tabular-nums text-ink-soft sm:self-auto"
      aria-label={frozenMs != null ? "Best time" : "Elapsed time"}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 9v4l2.5 2M9 2h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {frozenMs != null ? `Best ${fmtMs(shown)}` : fmtMs(shown)}
    </div>
  );
});

export function GameHost({ gameId, dateParam }: { gameId: GameId; dateParam?: string }) {
  const game = getGame(gameId)!;
  const meta = game.meta;
  const supportsDiff = Boolean(game.supportsDifficulty);
  const showHostTimer = supportsDiff && game.hostTimer !== false;
  const today = todayISO();
  const dateISO = dateParam || today;
  const isArchive = dateISO !== today;

  const hydrated = useProgress((s) => s.hydrated);
  const recordResult = useProgress((s) => s.recordResult);
  const saveGameState = useProgress((s) => s.saveGameState);
  const getGameState = useProgress((s) => s.getGameState);
  const zen = useProgress((s) => s.settings.zen);
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

  // --- unified timer: per-tier elapsed bank + live ms via a ref (no re-render) ---
  const hostMsRef = useRef(0);
  const bankRef = useRef<Partial<Record<Difficulty, number>>>({});
  const prevDiffRef = useRef<Difficulty>(difficulty);
  // Bank the leaving tier's elapsed during render (before the child timer
  // resets), so returning to a tier resumes its accumulated time.
  if (difficulty !== prevDiffRef.current) {
    bankRef.current[prevDiffRef.current] = hostMsRef.current;
    prevDiffRef.current = difficulty;
  }
  const initialMs = tierWon ? 0 : bankRef.current[difficulty] ?? 0;
  const onMs = useCallback((ms: number) => {
    hostMsRef.current = ms;
  }, []);

  const onComplete = useCallback(
    (result: GameResult) => {
      // Prefer the game's own measured time; fall back to the host clock for
      // games that don't track time themselves (only when the host timer runs).
      const fallback = showHostTimer ? hostMsRef.current : undefined;
      const finalResult: GameResult = supportsDiff
        ? { ...result, timeMs: result.timeMs ?? fallback }
        : result;
      recordResult(gameId, dateISO, finalResult, !isArchive, activeDiff);
      void syncProgress();
    },
    [recordResult, gameId, dateISO, isArchive, activeDiff, supportsDiff, showHostTimer],
  );

  const onPersistState = useCallback(
    (state: unknown) => saveGameState(gameId, dateISO, state, activeDiff),
    [saveGameState, gameId, dateISO, activeDiff],
  );

  // Memoise the game so timer/host re-renders never reconcile the board subtree.
  const GameComponent = useMemo(
    () => memo(game.Component as HostComponent),
    [game.Component],
  );
  const componentKey = `${gameId}:${dateISO}:${activeDiff ?? "solo"}`;

  const nextTier = activeDiff ? nextDifficulty(activeDiff) : null;

  // Per-tier hint allotment, surfaced as a note on the tier selector so players
  // see the budget before committing. Only games that declare hints show it.
  const hintsCfg = game.hintsByDifficulty;
  const flatHints = typeof hintsCfg === "number" ? hintsCfg : null;
  const hintsFor = (d: Difficulty): number | undefined =>
    hintsCfg == null ? undefined : typeof hintsCfg === "number" ? hintsCfg : hintsCfg[d];

  // Tier navigation handed to the completion modal so it can name the tier,
  // tag the share text, and offer a "next tier" CTA right where the player is
  // looking (the modal covers the footer's progression button).
  const tierNav = useMemo(
    () =>
      activeDiff
        ? {
            difficulty: activeDiff,
            next: nextTier,
            goNext: () => nextTier && setDifficulty(nextTier),
          }
        : null,
    [activeDiff, nextTier],
  );

  // Keyboard nav across the (unlocked) tier tabs — automatic activation.
  const onTabsKeyDown = (e: React.KeyboardEvent) => {
    const unlocked = DIFFICULTIES.filter((d) => isUnlocked(d));
    if (unlocked.length <= 1) return;
    const i = unlocked.indexOf(difficulty);
    let next: Difficulty | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = unlocked[(i + 1) % unlocked.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = unlocked[(i - 1 + unlocked.length) % unlocked.length];
    else if (e.key === "Home") next = unlocked[0];
    else if (e.key === "End") next = unlocked[unlocked.length - 1];
    if (next) {
      e.preventDefault();
      setDifficulty(next);
    }
  };

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
            onKeyDown={onTabsKeyDown}
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
              const label = won
                ? `${dm.label}, solved`
                : unlocked
                  ? dm.label
                  : `${dm.label}, locked — solve ${priorLabel} to unlock`;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  id={`tier-tab-${d}`}
                  aria-controls="tier-panel"
                  aria-selected={active}
                  aria-disabled={!unlocked || undefined}
                  aria-label={label}
                  tabIndex={active ? 0 : -1}
                  onClick={() => unlocked && setDifficulty(d)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 font-mono text-[11px] tracking-[0.06em] transition-colors",
                    active
                      ? "font-semibold text-[#04060f] underline decoration-2 underline-offset-2"
                      : unlocked
                        ? "text-ink-soft hover:text-ink"
                        : "cursor-not-allowed text-ink-faint opacity-60",
                  )}
                  style={active ? { backgroundColor: dm.color } : undefined}
                >
                  <span aria-hidden>{won ? "✓" : !unlocked ? "🔒" : "○"}</span>
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

          {showHostTimer && (
            <TierTimer
              resetKey={`${componentKey}:${tierWon ? "won" : "live"}`}
              initialMs={initialMs}
              run={!tierWon}
              frozenMs={tierWon ? tierResult?.timeMs ?? 0 : null}
              onMs={onMs}
            />
          )}
        </div>
      )}

      {supportsDiff && hintsCfg != null && (
        <div className="-mt-1.5 mb-4 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-ink-mute">
          <span aria-hidden>💡</span>
          {flatHints != null ? (
            <span>
              {flatHints === 0
                ? "No hints"
                : `${flatHints} hint${flatHints === 1 ? "" : "s"}`}{" "}
              available
            </span>
          ) : (
            <>
              <span>Hints</span>
              {DIFFICULTIES.map((d) => (
                <span key={d} className="tabular-nums">
                  <span style={{ color: DIFFICULTY_META[d].color }}>
                    {DIFFICULTY_META[d].label}
                  </span>{" "}
                  {hintsFor(d) ?? 0}
                </span>
              ))}
            </>
          )}
        </div>
      )}

      <div
        id={supportsDiff ? "tier-panel" : undefined}
        role={supportsDiff ? "tabpanel" : undefined}
        aria-labelledby={supportsDiff ? `tier-tab-${difficulty}` : undefined}
        className="rounded-3xl border border-line bg-gradient-to-b from-[rgba(11,15,31,0.65)] to-[rgba(6,8,18,0.6)] p-4 sm:p-6"
      >
        <DifficultyContext.Provider value={tierNav}>
          <GameComponent
            key={componentKey}
            puzzle={puzzle}
            dateISO={dateISO}
            onComplete={onComplete}
            savedState={savedState}
            onPersistState={onPersistState}
            reducedMotion={Boolean(reducedMotion)}
            isArchive={isArchive}
            difficulty={activeDiff}
            hostTimer={showHostTimer}
          />
        </DifficultyContext.Provider>
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
