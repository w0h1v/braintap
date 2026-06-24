"use client";

import { useMemo } from "react";
import { GAME_METAS, GAME_ORDER, ROTATION } from "@/lib/games";
import { GameCard } from "./GameCard";
import { useProgress } from "@/lib/progress";
import { todayISO } from "@/lib/daily";
import type { GameId } from "@/lib/types";

const MAX_PICKS = 3;

/**
 * A short "what to play next" rail above the full 20-card grid. Tames choice
 * overload for the 5-minute / first-time visitor and gives a returning player a
 * one-tap way to keep their day going. Picks the day's rotation game first, then
 * fills with other unplayed games. Renders nothing once everything's done (the
 * progress summary already celebrates a clean sweep) or before hydration (so the
 * server render and first client render agree).
 */
export function RecommendedRail() {
  const hydrated = useProgress((s) => s.hydrated);
  const results = useProgress((s) => s.results);
  const today = todayISO();
  const todayResults = useMemo(() => results[today] ?? {}, [results, today]);

  const { picks, heading, sub } = useMemo(() => {
    const weekday = new Date().toLocaleDateString("en-US", { weekday: "short" });
    const featured = ROTATION[weekday] as GameId | undefined;
    const playedCount = Object.keys(todayResults).length;

    const ordered: GameId[] = [];
    if (featured && !todayResults[featured]) ordered.push(featured);
    for (const id of GAME_ORDER) {
      if (todayResults[id] || ordered.includes(id)) continue;
      ordered.push(id);
      if (ordered.length >= MAX_PICKS) break;
    }

    return {
      picks: ordered.slice(0, MAX_PICKS),
      heading: playedCount === 0 ? "Start here" : "Keep your day going",
      sub:
        playedCount === 0
          ? "A quick few to warm up."
          : `${playedCount} done — here's what's next.`,
    };
  }, [todayResults]);

  if (!hydrated || picks.length === 0) return null;

  return (
    <section className="mx-auto max-w-shell px-6 pt-14 sm:px-8 sm:pt-16" aria-labelledby="recommended-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">RECOMMENDED</div>
          <h2
            id="recommended-heading"
            className="mt-1.5 font-display text-[clamp(20px,2.6vw,28px)] font-semibold tracking-[-0.02em] text-ink"
          >
            {heading}
          </h2>
        </div>
        <div className="font-mono text-[11.5px] text-ink-mute">{sub}</div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((id) => (
          <GameCard key={id} meta={GAME_METAS[id]} showFavorite={false} />
        ))}
      </div>
    </section>
  );
}
