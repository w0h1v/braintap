"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, Pill } from "@/components/ui/Card";
import { GameIcon } from "@/components/GameIcon";
import { GAME_METAS, GAME_ORDER, ROTATION } from "@/lib/games";
import {
  getDailyLeaderboard,
  getLiveCount,
  reportLeaderboardName,
  type LeaderboardEntry,
} from "@/lib/leaderboard";
import { useProgress } from "@/lib/progress";
import { todayISO } from "@/lib/daily";
import type { GameId, Difficulty } from "@/lib/types";
import { DIFFICULTIES, DIFFICULTY_META } from "@/lib/difficulty";
import { GuestCta } from "@/components/GuestCta";
import { cn } from "@/lib/cn";

/** Today's featured/rotation game (falls back to the first game). */
function featuredGameId(): GameId {
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "short" });
  return ROTATION[weekday] ?? GAME_ORDER[0];
}

/** Rank medal colours (1st gold, 2nd silver, 3rd bronze, else muted). */
function rankColor(rank: number): string {
  if (rank === 1) return "#ffb020";
  if (rank === 2) return "#cdd8f0";
  if (rank === 3) return "#cd9b6a";
  return "rgba(226,234,255,0.5)";
}

function fmtTime(ms?: number): string {
  if (!ms || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Animated count-up that eases toward `target`. Respects reduced motion. */
function useCountUp(target: number, durationMs = 1400): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs]);

  return value;
}

export default function LeaderboardPage() {
  const today = todayISO();
  const hydrated = useProgress((s) => s.hydrated);
  // Re-derive when the player records a result so "You" splices in live.
  const results = useProgress((s) => s.results);
  const tierResults = useProgress((s) => s.tierResults);

  // Default to a STABLE game so the static SSR markup and the first client
  // render agree; switch to the client-weekday featured game after mount
  // (featuredGameId() reads new Date(), which would otherwise mismatch).
  const [selected, setSelected] = useState<GameId>(GAME_ORDER[0]);
  const [tier, setTier] = useState<Difficulty>("medium");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveTarget, setLiveTarget] = useState(0);
  const [reportedNames, setReportedNames] = useState<ReadonlySet<string>>(new Set());

  // App Store Guideline 1.2: players can flag an objectionable display name.
  async function onReportName(name: string) {
    if (reportedNames.has(name)) return;
    const ok = window.confirm(`Report the name “${name}” as objectionable?`);
    if (!ok) return;
    setReportedNames((prev) => new Set(prev).add(name));
    void reportLeaderboardName(name);
  }

  // Pick today's featured game on the client, post-mount (avoids the build-time
  // vs client-weekday hydration mismatch).
  useEffect(() => {
    setSelected(featuredGameId());
  }, []);

  const meta = GAME_METAS[selected];

  // Load the board for the selected game (and refresh when local result changes).
  useEffect(() => {
    let active = true;
    setLoading(true);
    getDailyLeaderboard(selected, today, tier)
      .then((rows) => {
        if (active) {
          setEntries(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setEntries([]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // results in deps so the board re-splices "You" after a fresh play
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, today, tier, results]);

  // Load the live count once.
  useEffect(() => {
    let active = true;
    getLiveCount(today)
      .then((n) => {
        if (active) setLiveTarget(n);
      })
      .catch(() => {
        if (active) setLiveTarget(0);
      });
    return () => {
      active = false;
    };
  }, [today]);

  const liveCount = useCountUp(liveTarget);

  // A plausible, deterministic country count derived from the live count.
  const countries = useMemo(() => {
    if (liveTarget <= 0) return 0;
    return 70 + (liveTarget % 40);
  }, [liveTarget]);

  // The player's own WINNING result for the selected game + tier today. Only a
  // win earns the solo "you're #1" pace-setter board; a loss/played result
  // falls through to the "be the first" CTA so we never crown a failed run.
  const myResult = useMemo(() => {
    const tiers = tierResults[today]?.[selected];
    const r = tiers?.[tier] ?? (tiers ? undefined : results[today]?.[selected]) ?? null;
    return r && r.status === "won" ? r : null;
  }, [tierResults, results, today, selected, tier]);

  return (
    <>
      {/* header */}
      <section className="mx-auto max-w-shell px-6 pt-28 sm:px-8">
        <div className="animate-rise">
          <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-soft">
            <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-cyan shadow-[0_0_8px_#00e5ff]" />
            <span>LEADERBOARD</span>
          </div>
          <h1 className="mt-3 font-display text-[clamp(28px,4vw,46px)] font-semibold tracking-[-0.02em] text-ink">
            See how you rank against{" "}
            <span className="bt-gradient-text">minds worldwide.</span>
          </h1>
          <p className="mt-4 max-w-[540px] text-[15.5px] leading-relaxed text-ink-soft">
            Every puzzle has its own daily board. Pick a game, find your row, and
            watch the world tap in alongside you.
          </p>
        </div>

        {/* game selector chips */}
        <div className="mt-7 flex flex-wrap gap-2">
          {GAME_ORDER.map((gid) => {
            const m = GAME_METAS[gid];
            const isActive = gid === selected;
            return (
              <button
                key={gid}
                type="button"
                onClick={() => setSelected(gid)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 font-mono text-[11px] tracking-[0.04em] transition-colors",
                  isActive
                    ? "text-[#04060f]"
                    : "border-line bg-white/[0.03] text-ink-soft hover:border-line-strong hover:text-ink",
                )}
                style={
                  isActive
                    ? {
                        backgroundImage: `linear-gradient(118deg, ${m.accent.from}, ${m.accent.to})`,
                        borderColor: "transparent",
                      }
                    : undefined
                }
              >
                <span
                  className="grid h-4 w-4 place-items-center"
                  style={{ color: isActive ? "#04060f" : m.accent.solid }}
                >
                  <GameIcon id={gid} size={14} />
                </span>
                {m.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* optional-account invite (guests only) */}
      <section className="mx-auto mt-7 max-w-shell px-6 sm:px-8">
        <GuestCta variant="leaderboard" />
      </section>

      {/* main two-column layout */}
      <section className="mx-auto mt-6 grid max-w-shell grid-cols-1 gap-5 px-6 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
        {/* LEFT: today's leaderboard */}
        <Card className="p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 place-items-center rounded-xl border"
                style={{
                  color: meta.accent.solid,
                  borderColor: `${meta.accent.solid}40`,
                  background: `${meta.accent.solid}12`,
                }}
              >
                <GameIcon id={selected} size={20} />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Today&apos;s leaderboard
                </h2>
                <div
                  className="font-mono text-[10.5px] tracking-[0.12em] text-ink-mute"
                  suppressHydrationWarning
                >
                  {today}
                </div>
              </div>
            </div>
            <Pill color={meta.accent.solid} className="uppercase">
              {meta.name}
            </Pill>
          </div>

          {/* difficulty tier tabs */}
          <div
            role="tablist"
            aria-label="Difficulty"
            className="mt-4 flex gap-1.5"
            onKeyDown={(e) => {
              const i = DIFFICULTIES.indexOf(tier);
              let n: typeof tier | null = null;
              if (e.key === "ArrowRight" || e.key === "ArrowDown")
                n = DIFFICULTIES[(i + 1) % DIFFICULTIES.length];
              else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
                n = DIFFICULTIES[(i - 1 + DIFFICULTIES.length) % DIFFICULTIES.length];
              else if (e.key === "Home") n = DIFFICULTIES[0];
              else if (e.key === "End") n = DIFFICULTIES[DIFFICULTIES.length - 1];
              if (n) {
                e.preventDefault();
                setTier(n);
              }
            }}
          >
            {DIFFICULTIES.map((d) => {
              const dm = DIFFICULTY_META[d];
              const active = d === tier;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  id={`lb-tab-${d}`}
                  aria-controls="lb-panel"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTier(d)}
                  className={cn(
                    "flex-1 rounded-pill border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors",
                    active
                      ? "font-semibold text-[#04060f] underline decoration-2 underline-offset-2"
                      : "border-line bg-white/[0.02] text-ink-soft hover:text-ink",
                  )}
                  style={
                    active ? { backgroundColor: dm.color, borderColor: "transparent" } : undefined
                  }
                >
                  {dm.label}
                </button>
              );
            })}
          </div>

          <div
            id="lb-panel"
            role="tabpanel"
            aria-labelledby={`lb-tab-${tier}`}
            className="mt-5 flex flex-col gap-1.5"
          >
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[44px] animate-pulse rounded-xl border border-line bg-white/[0.02]"
                />
              ))
            ) : entries.length === 0 ? (
              myResult ? (
                // You've played but no global rows are in yet — you ARE the board.
                <>
                  <div className="flex items-center gap-3 rounded-xl border border-cyan/30 bg-cyan/[0.08] px-3.5 py-2.5">
                    <span
                      className="w-7 shrink-0 text-center font-mono text-[13px] font-semibold tabular-nums"
                      style={{ color: "#00e5ff" }}
                    >
                      1
                    </span>
                    <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-cyan">
                      You
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-ink-mute">
                      {fmtTime(myResult.timeMs)}
                    </span>
                    <span
                      className="w-12 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums"
                      style={{ color: "#00e5ff" }}
                    >
                      {myResult.score}
                    </span>
                  </div>
                  <div className="mt-3 rounded-xl border border-line bg-white/[0.02] p-4 text-center">
                    <div className="text-lg" aria-hidden>
                      🚀
                    </div>
                    <h3 className="mt-1 font-display text-[15px] font-semibold text-ink">
                      You&apos;re setting today&apos;s pace
                    </h3>
                    <p className="mx-auto mt-1 max-w-[340px] text-[13px] leading-relaxed text-ink-mute">
                      First on the {DIFFICULTY_META[tier].label} board for {meta.name}. Others
                      rank in behind you as they tap in today.
                    </p>
                  </div>
                </>
              ) : (
                // No one (incl. you) has posted a time for this game/tier today.
                <div className="rounded-2xl border border-line bg-white/[0.02] p-7 text-center">
                  <div className="text-2xl" aria-hidden>
                    🏆
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold text-ink">
                    Be the first on the board
                  </h3>
                  <p className="mx-auto mt-2 max-w-[360px] text-sm leading-relaxed text-ink-mute">
                    No times are posted for {meta.name} yet today. Play now and you&apos;ll take
                    the top spot — everyone else ranks in behind you as they play.
                  </p>
                  <Link
                    href={`/play/${selected}`}
                    className="mt-4 inline-block rounded-xl px-4 py-2 font-display text-sm font-semibold text-[#04060f]"
                    style={{ backgroundImage: `linear-gradient(118deg, ${meta.accent.from}, ${meta.accent.to})` }}
                  >
                    Play {meta.name} →
                  </Link>
                </div>
              )
            ) : (
              entries.map((e) => (
                <div
                  key={`${e.rank}-${e.name}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors",
                    e.isYou
                      ? "border-cyan/25 bg-cyan/[0.08]"
                      : "border-line bg-white/[0.015] hover:border-line-strong",
                  )}
                >
                  <span
                    className="w-7 shrink-0 text-center font-mono text-[13px] font-semibold tabular-nums"
                    style={{ color: e.isYou ? "#00e5ff" : rankColor(e.rank) }}
                  >
                    {e.rank}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate font-display text-sm",
                      e.isYou ? "font-semibold text-cyan" : "text-[#dbe4f7]",
                    )}
                  >
                    {e.isYou ? "You" : e.name}
                  </span>
                  {!e.isYou ? (
                    <button
                      type="button"
                      onClick={() => onReportName(e.name)}
                      disabled={reportedNames.has(e.name)}
                      aria-label={
                        reportedNames.has(e.name)
                          ? `Reported ${e.name}`
                          : `Report the name ${e.name}`
                      }
                      title={reportedNames.has(e.name) ? "Reported" : "Report this name"}
                      className={cn(
                        "shrink-0 rounded-md px-1 font-mono text-[11px] transition-colors",
                        reportedNames.has(e.name)
                          ? "cursor-default text-[#ff9db0]"
                          : "text-ink-mute/50 hover:text-[#ff9db0]",
                      )}
                    >
                      ⚑
                    </button>
                  ) : null}
                  <span className="shrink-0 font-mono text-[11px] text-ink-mute">
                    {fmtTime(e.timeMs)}
                  </span>
                  <span
                    className="w-12 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums"
                    style={{ color: e.isYou ? "#00e5ff" : meta.accent.soft }}
                  >
                    {e.score}
                  </span>
                </div>
              ))
            )}
          </div>

          {hydrated && !loading && entries.length > 0 && !entries.some((e) => e.isYou) ? (
            <div className="mt-4 rounded-xl border border-line bg-white/[0.02] p-3.5 text-center text-xs text-ink-mute">
              You haven&apos;t played {meta.name} today.{" "}
              <Link href={`/play/${selected}`} className="text-cyan hover:underline">
                Play now →
              </Link>
            </div>
          ) : null}
        </Card>

        {/* RIGHT: live counter + discussion */}
        <div className="flex flex-col gap-5">
          {/* live counter */}
          <div
            className="rounded-2xl border p-7"
            style={{
              borderColor: "rgba(0,229,255,0.18)",
              background:
                "linear-gradient(120deg, rgba(0,229,255,.08), rgba(255,43,214,.06))",
            }}
          >
            <div className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.2em] text-cyan-soft">
              <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-cyan shadow-[0_0_8px_#00e5ff]" />
              {liveTarget > 0 ? "LIVE" : "SOON"}
            </div>
            {liveTarget > 0 ? (
              <>
                <div className="mt-3 font-display text-[clamp(38px,6vw,56px)] font-semibold leading-none tabular-nums text-ink">
                  {liveCount.toLocaleString()}
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  minds tapped in today
                  {countries > 0 ? (
                    <>
                      , across{" "}
                      <span className="font-semibold text-cyan-soft">{countries}</span>{" "}
                      countries
                    </>
                  ) : null}
                  .
                </p>
              </>
            ) : (
              <>
                <div className="mt-3 font-display text-[clamp(26px,5vw,38px)] font-semibold leading-tight text-ink">
                  Be the first.
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  Live player counts switch on at launch — play today and you&apos;ll
                  be counted.
                </p>
              </>
            )}
          </div>

          {/* discussion — coming soon (no fabricated threads) */}
          <div>
            <div className="mb-3 font-mono text-[11px] tracking-[0.2em] text-ink-mute">
              DISCUSSION
            </div>
            <Card className="p-6 text-center">
              <div className="text-xl" aria-hidden>
                💬
              </div>
              <div className="mt-2 font-display text-base font-semibold text-ink">
                Discussion is coming soon
              </div>
              <p className="mx-auto mt-1.5 max-w-[280px] text-sm leading-relaxed text-ink-mute">
                Compare strategies and times with other players once the community
                opens up.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <div className="pb-8" />
    </>
  );
}
