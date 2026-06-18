"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ALL_GAMES, GAME_METAS, ROTATION } from "@/lib/games";
import { GAME_ORDER } from "@/games/_meta";
import { GameCard } from "./GameCard";
import { ResetCountdown } from "./ResetCountdown";
import { StatBox } from "@/components/ui/Card";
import { useProgress, liveStreak } from "@/lib/progress";
import { dateLabel, todayISO } from "@/lib/daily";
import { cn } from "@/lib/cn";

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Hub() {
  const today = todayISO();
  const hydrated = useProgress((s) => s.hydrated);
  const results = useProgress((s) => s.results);
  const currentStreak = useProgress((s) => s.currentStreak);
  const lastPlayedISO = useProgress((s) => s.lastPlayedISO);

  const todayResults = useMemo(() => results[today] ?? {}, [results, today]);
  const playedCount = Object.keys(todayResults).length;
  const streak = hydrated ? liveStreak(currentStreak, lastPlayedISO) : 0;

  const avgSolve = useMemo(() => {
    const times = Object.values(todayResults)
      .map((r) => r?.timeMs)
      .filter((t): t is number => typeof t === "number" && t > 0);
    if (!times.length) return "—";
    return fmtTime(times.reduce((a, b) => a + b, 0) / times.length);
  }, [todayResults]);

  const weekday = new Date().toLocaleDateString("en-US", { weekday: "short" });

  return (
    <>
      {/* hero */}
      <section className="mx-auto max-w-shell px-6 pt-28 sm:px-8">
        <div className="flex animate-rise flex-col items-center text-center">
          <div className="flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.26em] text-cyan-soft">
            <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-cyan shadow-[0_0_8px_#00e5ff]" />
            <span>{dateLabel(today)}</span>
          </div>
          <h1 className="mt-4 font-display text-[clamp(34px,5.4vw,68px)] font-semibold leading-none tracking-[-0.03em] text-ink">
            Tap into your mind,
            <br />
            <span className="bt-gradient-text">one puzzle a day.</span>
          </h1>
          <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-ink-soft">
            Fifteen science-backed brain games, one fresh challenge every day. Build a streak,
            level up your cognition, and see your mind sharpen.
          </p>
        </div>

        {/* stat strip */}
        <div className="mt-10 grid animate-rise grid-cols-2 gap-3.5 sm:mt-11 md:grid-cols-4">
          <StatBox value={String(streak)} sub=" days" label="CURRENT STREAK" color="#ffb020" />
          <StatBox value={String(playedCount)} sub="/15" label="PLAYED TODAY" color="#00e5ff" />
          <StatBox value={avgSolve} label="AVG SOLVE" color="#86a3ff" />
          <StatBox value={streak > 0 ? "Active" : "—"} label="STATUS" color="#ff2bd6" />
        </div>
      </section>

      {/* today's puzzles */}
      <section className="mx-auto max-w-shell px-6 pt-16 sm:px-8 sm:pt-[70px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">
              TODAY&apos;S PUZZLES
            </div>
            <h2 className="mt-2 font-display text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.02em] text-ink">
              Fifteen ready to play
            </h2>
          </div>
          <div className="font-mono text-[11.5px] text-ink-mute">
            Resets in <ResetCountdown />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_GAMES.map((g) => {
            const r = todayResults[g.meta.id];
            const label =
              r?.shareText && r.shareText.length <= 5 ? r.shareText : r ? "Replay" : undefined;
            return (
              <GameCard key={g.meta.id} meta={g.meta} done={Boolean(r)} resultLabel={label} />
            );
          })}
        </div>
      </section>

      {/* weekly rotation */}
      <section className="mx-auto max-w-shell px-6 pt-16 sm:px-8">
        <div className="font-mono text-[11px] tracking-[0.2em] text-ink-mute">
          THIS WEEK&apos;S ROTATION
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-7">
          {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((d) => {
            const gid = ROTATION[d];
            const meta = GAME_METAS[gid];
            const isToday = d === weekday;
            return (
              <Link
                key={d}
                href={`/play/${gid}`}
                className={cn(
                  "rounded-[14px] border p-3 text-center transition-colors",
                  isToday
                    ? "border-cyan/35 shadow-glow-cyan"
                    : "border-line bg-[rgba(15,23,46,0.5)] hover:border-line-strong",
                )}
                style={
                  isToday
                    ? {
                        background:
                          "linear-gradient(180deg, rgba(0,229,255,.1), rgba(255,43,214,.07))",
                      }
                    : undefined
                }
              >
                <div
                  className={cn(
                    "font-mono text-[10.5px]",
                    isToday ? "text-cyan-soft" : "text-ink-mute",
                  )}
                >
                  {d.toUpperCase()}
                  {isToday ? " · TODAY" : ""}
                </div>
                <div className="mt-2 font-display text-[13px] font-medium text-[#cdd8f0]">
                  {meta.name.replace(/^(Neural |Synapse |Mind |Idea |Tap |Mini |Sum )/, "")}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* explore links */}
      <section className="mx-auto mt-16 max-w-shell px-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { href: "/stats", label: "Your brain profile", desc: "Six skills, measured every day." },
            { href: "/archive", label: "The archive", desc: "Never miss a day — replay any puzzle." },
            {
              href: "/leaderboard",
              label: "Leaderboard",
              desc: "See how you rank against minds worldwide.",
            },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="rounded-2xl border border-line bg-[rgba(15,23,46,0.4)] p-6 transition-colors hover:border-cyan/40"
            >
              <div className="font-display text-lg font-semibold text-ink">{c.label}</div>
              <div className="mt-1 text-sm text-ink-soft">{c.desc}</div>
              <div className="mt-3 font-mono text-xs text-cyan">Open →</div>
            </Link>
          ))}
        </div>
      </section>

      <div className="pb-4" />
      {GAME_ORDER.length === 0 ? null : null}
    </>
  );
}
