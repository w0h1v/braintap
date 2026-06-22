"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ALL_GAMES } from "@/lib/games";
import { useProgress } from "@/lib/progress";
import { addDays, todayISO, fromISODate } from "@/lib/daily";
import { cn } from "@/lib/cn";
import type { GameId } from "@/lib/types";
import type { StoredResult as ProgressStoredResult } from "@/lib/progress";
import { useEntitlement } from "@/lib/entitlement";
import { getMonetizationConfig } from "@/lib/config";
import { Paywall } from "@/components/Paywall";

const DAYS_BACK = 60;
/** Recent days that stay free for non-premium users on native (web = all free). */
const FREE_ARCHIVE_DAYS = 7;

/** Short label like "Mon · Jun 16". */
function dayLabel(iso: string): string {
  const d = fromISODate(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${weekday} · ${month} ${d.getDate()}`;
}

/** A compact one-line summary for a single game's result. */
function resultLabel(r: ProgressStoredResult): string {
  if (r.shareText && r.shareText.length <= 5) return r.shareText;
  if (r.status === "won") return "Solved";
  if (r.status === "lost") return "Missed";
  return "Played";
}

/** Dot colour for a result status against a game accent. */
function dotColor(r: ProgressStoredResult | undefined, accentSolid: string): string {
  if (!r) return "rgba(226,234,255,0.12)";
  if (r.status === "lost") return "rgba(226,234,255,0.4)";
  return accentSolid;
}

export default function ArchivePage() {
  const today = todayISO();
  const hydrated = useProgress((s) => s.hydrated);
  const results = useProgress((s) => s.results);
  const { isPremium, billingAvailable } = useEntitlement();
  const [paywallOpen, setPaywallOpen] = useState(false);
  // Gated only on a native build with billing; on web billingAvailable is false,
  // so the archive stays fully free — unchanged behavior.
  const archiveGated =
    billingAvailable && getMonetizationConfig().premiumUnlocksArchive && !isPremium;

  // Build the list of dates: today back through DAYS_BACK days.
  const days = useMemo(() => {
    return Array.from({ length: DAYS_BACK }, (_, i) => addDays(today, -i));
  }, [today]);

  const totalPlayed = useMemo(() => {
    let n = 0;
    for (const iso of days) n += Object.keys(results[iso] ?? {}).length;
    return n;
  }, [days, results]);

  return (
    <>
      {/* header */}
      <section className="mx-auto max-w-shell px-6 pt-28 sm:px-8">
        <div className="flex animate-rise flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.26em] text-cyan-soft">
              <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-cyan shadow-[0_0_8px_#00e5ff]" />
              <span>The Archive</span>
            </div>
            <h1 className="mt-4 font-display text-[clamp(30px,5vw,56px)] font-semibold leading-none tracking-[-0.03em] text-ink">
              Never miss a day.
            </h1>
            <p className="mt-4 max-w-[520px] text-[15.5px] leading-relaxed text-ink-soft">
              Replay any of the last {DAYS_BACK} days. Pick a date, jump back into a puzzle, and
              fill in the gaps in your streak history.
            </p>
          </div>
          <div className="shrink-0 font-mono text-[11.5px] text-ink-mute">
            {hydrated ? `${totalPlayed} plays` : "—"} in {DAYS_BACK} days
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-amber/25 bg-[rgba(255,176,32,0.06)] px-4 py-3 font-mono text-[11px] leading-relaxed tracking-[0.04em] text-amber-soft">
          Note: archive plays are for practice and do not affect your daily streak.
        </div>

        {archiveGated && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan/25 bg-cyan/[0.06] px-4 py-3">
            <span className="font-mono text-[11px] leading-relaxed text-cyan-soft">
              The last {FREE_ARCHIVE_DAYS} days are free — unlock the full {DAYS_BACK}-day archive with Premium.
            </span>
            <button
              type="button"
              onClick={() => setPaywallOpen(true)}
              className="shrink-0 rounded-pill px-3.5 py-1.5 font-display text-[12px] font-semibold text-[#04060f]"
              style={{ backgroundImage: "linear-gradient(118deg, #00e5ff, #ff2bd6)" }}
            >
              Go Premium
            </button>
          </div>
        )}
      </section>

      {/* day grid */}
      <section className="mx-auto max-w-shell px-6 pb-20 pt-8 sm:px-8">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {days.map((iso, idx) => {
            const dayResults = (results[iso] ?? {}) as Partial<
              Record<GameId, ProgressStoredResult>
            >;
            const playedCount = Object.keys(dayResults).length;
            const isToday = iso === today;
            const locked = archiveGated && idx >= FREE_ARCHIVE_DAYS;

            if (locked) {
              return (
                <div
                  key={iso}
                  className="flex flex-col rounded-2xl border border-line bg-gradient-to-b from-[rgba(13,21,42,0.6)] to-[rgba(8,12,26,0.55)] p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-display text-[15px] font-semibold text-ink-mute">
                      {dayLabel(iso)}
                    </div>
                    <span aria-hidden className="shrink-0 text-[12px]">
                      🔒
                    </span>
                  </div>
                  <div className="mt-3.5 flex flex-1 flex-col items-center justify-center gap-2.5 py-4 text-center">
                    <div className="font-mono text-[10px] tracking-[0.14em] text-ink-faint">
                      PREMIUM
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaywallOpen(true)}
                      className="rounded-pill border border-amber/40 bg-amber/[0.08] px-4 py-1.5 font-mono text-[11px] text-amber-soft transition-colors hover:bg-amber/[0.14]"
                    >
                      Unlock archive →
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={iso}
                className={cn(
                  "flex animate-rise flex-col rounded-2xl border bg-gradient-to-b from-[rgba(13,21,42,0.6)] to-[rgba(8,12,26,0.55)] p-4 transition-colors",
                  isToday
                    ? "border-cyan/35 shadow-glow-cyan"
                    : "border-line hover:border-line-strong",
                )}
                style={{ animationDelay: `${Math.min(idx, 12) * 18}ms` }}
              >
                {/* date header — clicking goes to today's hub or the featured day */}
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-display text-[15px] font-semibold text-[#cdd8f0]">
                    {dayLabel(iso)}
                    {isToday ? (
                      <span className="ml-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-cyan-soft">
                        Today
                      </span>
                    ) : null}
                  </div>
                  <div className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-ink-mute">
                    {hydrated ? `${playedCount}/15` : "—"}
                  </div>
                </div>

                {/* per-game status dots / badges */}
                <div className="mt-3.5 flex flex-1 flex-wrap content-start gap-1.5">
                  {ALL_GAMES.map((g) => {
                    const meta = g.meta;
                    const r = dayResults[meta.id];
                    const color = dotColor(r, meta.accent.solid);
                    const title = r
                      ? `${meta.name} — ${resultLabel(r)}`
                      : `${meta.name} — not played`;
                    return (
                      <Link
                        key={meta.id}
                        href={`/play/${meta.id}?date=${iso}`}
                        title={title}
                        aria-label={`Play ${meta.name} for ${dayLabel(iso)}`}
                        className={cn(
                          "group relative flex h-6 w-6 items-center justify-center rounded-md border transition-transform hover:scale-110",
                          r ? "border-transparent" : "border-line",
                        )}
                        style={
                          r
                            ? {
                                background: `${color}1f`,
                                borderColor: `${color}59`,
                              }
                            : undefined
                        }
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background: color,
                            boxShadow: r ? `0 0 6px ${color}` : "none",
                          }}
                        />
                      </Link>
                    );
                  })}
                </div>

                {/* footer: jump-in link */}
                <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3">
                  <span className="font-mono text-[10px] tracking-[0.08em] text-ink-faint">
                    {playedCount > 0 ? "Tap a game to replay" : "Tap a game to play"}
                  </span>
                  <Link
                    href={`/play/${ALL_GAMES[0]?.meta.id}?date=${iso}`}
                    className="font-mono text-[10.5px] text-cyan transition-colors hover:text-cyan-soft"
                  >
                    Open →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </>
  );
}
