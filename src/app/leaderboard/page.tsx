"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, Pill } from "@/components/ui/Card";
import { GameIcon } from "@/components/GameIcon";
import { GAME_METAS, GAME_ORDER, ROTATION } from "@/lib/games";
import { getDailyLeaderboard, getLiveCount, type LeaderboardEntry } from "@/lib/leaderboard";
import { useProgress } from "@/lib/progress";
import { todayISO } from "@/lib/daily";
import type { GameId } from "@/lib/types";
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

/** Sample discussion threads (static / offline-safe). */
const DISCUSSIONS = [
  { title: "Best Theta vs sleep-onset strategy?", tag: "strategy", replies: 248 },
  { title: "Today's Connections purple group was brutal", tag: "connections", replies: 176 },
  { title: "Schulte under 18s — share your scan pattern", tag: "focus", replies: 94 },
];

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

  const [selected, setSelected] = useState<GameId>(() => featuredGameId());
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveTarget, setLiveTarget] = useState(0);

  const meta = GAME_METAS[selected];

  // Load the board for the selected game (and refresh when local result changes).
  useEffect(() => {
    let active = true;
    setLoading(true);
    getDailyLeaderboard(selected, today)
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
  }, [selected, today, results]);

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
                <div className="font-mono text-[10.5px] tracking-[0.12em] text-ink-mute">
                  {today}
                </div>
              </div>
            </div>
            <Pill color={meta.accent.solid} className="uppercase">
              {meta.name}
            </Pill>
          </div>

          <div className="mt-5 flex flex-col gap-1.5">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[44px] animate-pulse rounded-xl border border-line bg-white/[0.02]"
                />
              ))
            ) : entries.length === 0 ? (
              <div className="rounded-xl border border-line bg-white/[0.02] p-6 text-center text-sm text-ink-mute">
                No scores yet today. Be the first to tap in.
              </div>
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

          {hydrated && !loading && !entries.some((e) => e.isYou) ? (
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
              LIVE
            </div>
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
          </div>

          {/* discussion */}
          <div>
            <div className="mb-3 font-mono text-[11px] tracking-[0.2em] text-ink-mute">
              DISCUSSION
            </div>
            <div className="flex flex-col gap-3">
              {DISCUSSIONS.map((d) => (
                <Card
                  key={d.title}
                  className="cursor-pointer p-5 transition-colors hover:border-cyan/30"
                >
                  <div className="font-display text-base font-semibold text-ink">
                    {d.title}
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-ink-mute">
                    <span className="text-cyan-soft">#{d.tag}</span> ·{" "}
                    {d.replies} replies
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="pb-8" />
    </>
  );
}
