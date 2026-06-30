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
import type { GameId, GameResult, Difficulty, AnyGameModule } from "@/lib/types";
import { loadGame } from "@/lib/loadGame";
import { PlaySkeleton } from "@/components/play/PlaySkeleton";
import { useProgress } from "@/lib/progress";
import { syncProgress } from "@/lib/sync";
import { todayISO, dateLabel } from "@/lib/daily";
import { DIFFICULTIES, DIFFICULTY_META, nextDifficulty } from "@/lib/difficulty";
import { useGameClock } from "@/lib/useGameClock";
import { GameIcon } from "@/components/GameIcon";
import { DifficultyContext } from "@/components/play/DifficultyContext";
import { WinCelebration } from "@/components/play/WinCelebration";
import { StreakCelebration } from "@/components/play/StreakCelebration";
import { ACHIEVEMENT_BY_ID } from "@/lib/achievements";
import { useToast } from "@/components/ui/Toast";
import { maybeInterstitial } from "@/lib/ads";
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

/**
 * Outer host: lazily loads the one game module for this route (code-split per
 * game) and shows the skeleton until it arrives, then hands off to the real
 * host. This is what keeps every non-/play page off the heavy game bundles.
 */
export function GameHost({ gameId, dateParam }: { gameId: GameId; dateParam?: string }) {
  const [game, setGame] = useState<AnyGameModule | null>(null);
  useEffect(() => {
    let active = true;
    loadGame(gameId).then((m) => {
      if (active) setGame(m);
    });
    return () => {
      active = false;
    };
  }, [gameId]);

  if (!game) return <PlaySkeleton />;
  return <GameHostInner game={game} gameId={gameId} dateParam={dateParam} />;
}

function GameHostInner({
  game,
  gameId,
  dateParam,
}: {
  game: AnyGameModule;
  gameId: GameId;
  dateParam?: string;
}) {
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

  const toast = useToast();

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  // Bumped on each win to (re)play the brief win-celebration beat.
  const [winBurst, setWinBurst] = useState(0);
  // Bumped when the daily streak grows; `celebStreak` carries the new count.
  const [streakBurst, setStreakBurst] = useState(0);
  const [celebStreak, setCelebStreak] = useState(0);
  // Pending achievement-toast timers, cleared on unmount so a staggered burst
  // never pops on a later page if the player leaves right after finishing.
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => toastTimers.current.forEach(clearTimeout), []);
  // Normalised score of the most recent completion (drives the modal rank).
  const [lastScore, setLastScore] = useState<number | null>(null);
  // Pre-game brain-insight teaser, dismissible for the session (VIS-5).
  const [teaserDismissed, setTeaserDismissed] = useState(false);
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

      // Snapshot before/after so we can detect a streak bump and freshly-earned
      // achievements (recordResult derives both synchronously in the store).
      const before = useProgress.getState();
      recordResult(gameId, dateISO, finalResult, !isArchive, activeDiff);
      const after = useProgress.getState();

      // A short celebratory beat just before the game's completion modal rises.
      if (result.status === "won") setWinBurst((n) => n + 1);
      setLastScore(typeof result.score === "number" ? result.score : null);

      // The streak just grew: celebrate it — but only on a WIN, so the festive
      // pill never lands over a "NICE TRY" loss modal. The streak still
      // increments silently in the store either way.
      if (result.status === "won" && after.currentStreak > before.currentStreak) {
        setCelebStreak(after.currentStreak);
        setStreakBurst((n) => n + 1);
      }

      // Toast any achievements that just unlocked, lightly staggered so a burst
      // (e.g. on a clean sweep) reads as a sequence rather than a pile.
      const fresh = after.achievements.filter((id) => !before.achievements.includes(id));
      fresh.forEach((id, i) => {
        const a = ACHIEVEMENT_BY_ID[id];
        if (!a) return;
        const t = setTimeout(
          () => toast.show(`${a.emoji} Achievement unlocked — ${a.title}`, { durationMs: 4200 }),
          i * 450,
        );
        toastTimers.current.push(t);
      });

      void syncProgress();
    },
    [recordResult, gameId, dateISO, isArchive, activeDiff, supportsDiff, showHostTimer, toast],
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
            lastScore,
          }
        : null,
    [activeDiff, nextTier, lastScore],
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
    <div className="mx-auto flex min-h-[100svh] max-w-shell flex-col px-4 pt-[62px] pb-[max(0.6rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-24 sm:pb-16">
      <WinCelebration trigger={winBurst} accent={meta.accent} reducedMotion={Boolean(reducedMotion)} />
      <StreakCelebration trigger={streakBurst} streak={celebStreak} reducedMotion={Boolean(reducedMotion)} />
      {/* header */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3 sm:mb-4">
        <Link
          href="/"
          onClick={() => void maybeInterstitial("return-home")}
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
        <div className="mb-3 shrink-0 rounded-xl border border-amber/30 bg-amber/[0.06] px-4 py-2 text-center font-mono text-[11px] text-amber-soft sm:mb-4">
          Archive puzzle · {dateLabel(dateISO)} — does not affect your streak
        </div>
      )}

      {/* Pre-game brain-insight teaser (lead clause only; the full insight is
          the completion payoff). Dismissible for the session. Hidden on small
          screens so the board + controls fit the viewport without scrolling —
          the full insight still lands in the completion modal. */}
      {!teaserDismissed && (
        <div
          className="mb-3 hidden shrink-0 items-start gap-2.5 rounded-xl border px-3.5 py-2.5 sm:mb-4 sm:flex"
          style={{ borderColor: `${meta.accent.solid}2e`, background: `${meta.accent.solid}0f` }}
        >
          <span aria-hidden className="mt-px text-[13px]">🧠</span>
          <span className="flex-1 text-[12.5px] leading-snug text-ink-soft">
            {meta.insight.split(/\s*[—;]\s*/)[0]}
          </span>
          <button
            type="button"
            onClick={() => setTeaserDismissed(true)}
            aria-label="Dismiss insight"
            className="-mr-1 shrink-0 rounded-md px-1.5 text-base leading-none text-ink-faint transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
      )}

      {/* difficulty tier bar + timer */}
      {supportsDiff && (
        <div className="mb-3 flex shrink-0 flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5">
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
        <div className="-mt-1 mb-3 hidden shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-ink-mute sm:mb-4 sm:flex">
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
        className="flex min-h-0 flex-1 flex-col rounded-3xl border border-line bg-gradient-to-b from-[rgba(11,15,31,0.65)] to-[rgba(6,8,18,0.6)] p-2 sm:p-6"
      >
        <DifficultyContext.Provider value={tierNav}>
          {/* Bounded flex region: a game whose root is `flex-1 min-h-0` fills this
              and can size its board to the available height (set by the flex
              column above) so board + controls fit the viewport without page
              scroll. Games that don't opt in simply render at natural height. */}
          <div className="flex min-h-0 flex-1 flex-col">
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
          </div>
        </DifficultyContext.Provider>
      </div>

      {tierResult && (
        <div className="mt-3 flex shrink-0 flex-col items-center gap-2 text-center sm:mt-4">
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

          <Link
            href="/"
            onClick={() => void maybeInterstitial("return-home")}
            className="font-mono text-xs text-cyan"
          >
            Back to today&apos;s puzzles →
          </Link>
        </div>
      )}
    </div>
  );
}
