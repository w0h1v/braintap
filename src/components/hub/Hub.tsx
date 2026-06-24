"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GAME_METAS, ROTATION, GAME_COUNT, GAME_COUNT_WORD } from "@/lib/games";
import { GAME_ORDER } from "@/games/_meta";
import { GameCard } from "./GameCard";
import { RecommendedRail } from "./RecommendedRail";
import { ResetCountdown } from "./ResetCountdown";
import { StatBox } from "@/components/ui/Card";
import { useProgress, liveStreak } from "@/lib/progress";
import { dateLabel, todayISO } from "@/lib/daily";
import { SKILL_DOMAINS, SKILL_META } from "@/lib/skills";
import type { GameId, GameMeta, SkillDomain } from "@/lib/types";
import { cn } from "@/lib/cn";

type SkillFilter = SkillDomain | "all";

const TOTAL_GAMES = GAME_COUNT;
/** Card metadata in hub display order — pure data, pulls in no game modules. */
const GAMES: GameMeta[] = GAME_ORDER.map((id) => GAME_METAS[id]);

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
  // A returning player (has played before) doesn't need the full marketing hero
  // every day. Stays false until hydrated, so the static HTML/first paint keeps
  // the full pitch (good for SEO + first-time visitors); it collapses to a
  // compact header only once we know this person has played.
  const isReturning = hydrated && lastPlayedISO != null;

  const avgSolve = useMemo(() => {
    const times = Object.values(todayResults)
      .map((r) => r?.timeMs)
      .filter((t): t is number => typeof t === "number" && t > 0);
    if (!times.length) return "—";
    return fmtTime(times.reduce((a, b) => a + b, 0) / times.length);
  }, [todayResults]);

  // Cognitive domains exercised by the games completed today (VIS-4).
  const domainsToday = useMemo(() => {
    const set = new Set<SkillDomain>();
    for (const id of Object.keys(todayResults)) {
      GAME_METAS[id as GameId]?.skills.forEach((s) => set.add(s));
    }
    return [...set];
  }, [todayResults]);

  const weekday = new Date().toLocaleDateString("en-US", { weekday: "short" });

  // Favourites (persisted) — pinned in their own row at the top, in GAME_ORDER.
  const favorites = useProgress((s) => s.favorites);
  const favoriteGames = useMemo(() => {
    if (!hydrated || favorites.length === 0) return [];
    const fav = new Set(favorites);
    return GAME_ORDER.filter((id) => fav.has(id)).map((id) => GAME_METAS[id]);
  }, [hydrated, favorites]);

  // Skill-domain filter for the full grid.
  const [skill, setSkill] = useState<SkillFilter>("all");
  const filteredGames = useMemo(
    () => (skill === "all" ? GAMES : GAMES.filter((m) => m.skills.includes(skill))),
    [skill],
  );

  const renderCard = (meta: GameMeta) => {
    const r = todayResults[meta.id];
    const label =
      r?.shareText && r.shareText.length <= 5 ? r.shareText : r ? "Replay" : undefined;
    return <GameCard key={meta.id} meta={meta} done={Boolean(r)} resultLabel={label} />;
  };

  return (
    <>
      {/* hero — full pitch for first-time visitors; compact for returning players */}
      <section className={cn("mx-auto max-w-shell px-6 sm:px-8", isReturning ? "pt-24" : "pt-28")}>
        <div className="flex animate-rise flex-col items-center text-center">
          <div className="flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.26em] text-cyan-soft">
            <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-cyan shadow-[0_0_8px_#00e5ff]" />
            <span>{dateLabel(today)}</span>
          </div>
          {isReturning ? (
            <>
              <h1 className="mt-3 font-display text-[clamp(26px,4.2vw,40px)] font-semibold leading-tight tracking-[-0.02em] text-ink">
                Welcome back.
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                {streak > 0 ? (
                  <>
                    🔥 <span className="font-medium text-ink">{streak}-day streak</span> — keep it alive.
                  </>
                ) : (
                  <>Today&apos;s puzzles are ready.</>
                )}
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-4 font-display text-[clamp(34px,5.4vw,68px)] font-semibold leading-none tracking-[-0.03em] text-ink">
                Tap into your mind,
                <br />
                <span className="bt-gradient-text">one puzzle a day.</span>
              </h1>
              <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-ink-soft">
                {GAME_COUNT_WORD} science-backed brain games, one fresh challenge every day. Build a streak,
                level up your cognition, and see your mind sharpen.
              </p>
            </>
          )}
        </div>

        {/* stat strip */}
        <div className="mt-10 grid animate-rise grid-cols-2 gap-3.5 sm:mt-11 md:grid-cols-4">
          <StatBox value={String(streak)} sub=" days" label="CURRENT STREAK" color="#ffb020" />
          <StatBox value={String(playedCount)} sub={`/${TOTAL_GAMES}`} label="PLAYED TODAY" color="#00e5ff" />
          <StatBox value={avgSolve} label="AVG SOLVE" color="#86a3ff" />
          <StatBox value={streak > 0 ? "Active" : "—"} label="STATUS" color="#ff2bd6" />
        </div>

        {/* daily completion summary (VIS-4) */}
        <div
          className="mt-4 animate-rise rounded-2xl border p-5 sm:p-6"
          style={{
            borderColor: "rgba(0,229,255,0.18)",
            background: "linear-gradient(120deg, rgba(0,229,255,.06), rgba(255,43,214,.05))",
          }}
        >
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">
                TODAY&apos;S PROGRESS
              </div>
              <div className="mt-1.5 font-display text-[clamp(20px,3vw,26px)] font-semibold text-ink">
                {playedCount >= TOTAL_GAMES
                  ? `Clean sweep — all ${TOTAL_GAMES} done 🧹`
                  : `${playedCount} / ${TOTAL_GAMES} completed`}
              </div>
            </div>
            <div className="font-mono text-[11.5px] text-ink-mute">
              {streak > 0 ? (
                <>
                  <span className="font-semibold text-amber">{streak}</span>-day streak
                </>
              ) : (
                "Play one to start a streak"
              )}
            </div>
          </div>

          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-white/[0.06]"
            role="progressbar"
            aria-valuenow={playedCount}
            aria-valuemin={0}
            aria-valuemax={TOTAL_GAMES}
            aria-label="Games completed today"
          >
            <div
              className="h-full rounded-pill transition-[width] duration-500"
              style={{
                width: `${(playedCount / TOTAL_GAMES) * 100}%`,
                backgroundImage: "linear-gradient(90deg, #00e5ff, #ff2bd6)",
              }}
            />
          </div>

          {domainsToday.length > 0 && (
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 font-mono text-[10px] tracking-[0.14em] text-ink-faint">
                DOMAINS TODAY
              </span>
              {domainsToday.map((d) => (
                <span
                  key={d}
                  className="rounded-pill border border-line bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* what to play next — tames the 20-card grid for quick/first-time sessions */}
      <RecommendedRail />

      {/* favourites (pinned at the top once the player stars a game) */}
      {favoriteGames.length > 0 && (
        <section className="mx-auto max-w-shell px-6 pt-16 sm:px-8 sm:pt-[70px]">
          <div className="flex items-center gap-2.5">
            <span className="text-lg leading-none text-[#ffd66b]" aria-hidden>
              ★
            </span>
            <h2 className="font-display text-[clamp(22px,2.6vw,30px)] font-semibold tracking-[-0.02em] text-ink">
              Your favourites
            </h2>
            <span className="font-mono text-[11px] text-ink-mute">{favoriteGames.length}</span>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteGames.map(renderCard)}
          </div>
        </section>
      )}

      {/* today's puzzles */}
      <section className="mx-auto max-w-shell px-6 pt-16 sm:px-8 sm:pt-[70px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">
              TODAY&apos;S PUZZLES
            </div>
            <h2 className="mt-2 font-display text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.02em] text-ink">
              {GAME_COUNT_WORD} ready to play
            </h2>
          </div>
          <div className="font-mono text-[11.5px] text-ink-mute">
            Resets in <ResetCountdown />
          </div>
        </div>

        {/* skill-domain filter */}
        <div
          className="mt-5 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter games by skill"
        >
          <FilterChip label="All" active={skill === "all"} onClick={() => setSkill("all")} />
          {SKILL_DOMAINS.map((d) => (
            <FilterChip
              key={d}
              label={SKILL_META[d].label}
              color={SKILL_META[d].color}
              active={skill === d}
              onClick={() => setSkill(d)}
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGames.map(renderCard)}
        </div>
        {filteredGames.length === 0 && (
          <div className="mt-6 rounded-2xl border border-line bg-white/[0.02] py-10 text-center font-mono text-[12px] text-ink-mute">
            No games match this filter.
          </div>
        )}
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
                prefetch={false}
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

function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-pill border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/40",
        active
          ? "font-semibold text-[#04060f]"
          : "border-line bg-white/[0.03] text-ink-soft hover:border-line-strong hover:text-ink",
      )}
      style={active ? { background: color ?? "#00e5ff", borderColor: color ?? "#00e5ff" } : undefined}
    >
      {label}
    </button>
  );
}
