"use client";

import Link from "next/link";
import type { GameMeta } from "@/lib/types";
import { GameIcon } from "@/components/GameIcon";
import { useProgress } from "@/lib/progress";
import { cn } from "@/lib/cn";

export function GameCard({
  meta,
  done,
  resultLabel,
  showFavorite = true,
}: {
  meta: GameMeta;
  done?: boolean;
  resultLabel?: string;
  /** Show the favourite star toggle (hub only). */
  showFavorite?: boolean;
}) {
  const a = meta.accent;
  const hydrated = useProgress((s) => s.hydrated);
  const isFav = useProgress((s) => s.favorites.includes(meta.id));
  const toggleFavorite = useProgress((s) => s.toggleFavorite);
  // Only reflect the persisted star once hydrated, so SSR (empty) and the first
  // client render agree — avoiding a hydration mismatch.
  const fav = hydrated && isFav;

  return (
    <div
      className={cn(
        "group relative flex min-h-[230px] flex-col rounded-[20px] border p-6 transition-all duration-300",
        "hover:-translate-y-1.5 focus-within:-translate-y-1.5",
      )}
      style={{
        borderColor: `${a.solid}52`,
        background: `linear-gradient(165deg, ${a.solid}14, rgba(8,12,26,0.55))`,
        boxShadow: done ? `inset 0 2px 0 ${a.solid}, 0 0 22px ${a.solid}14` : undefined,
      }}
    >
      {/* Stretched link makes the whole card navigate; the star button below
          sits above it (higher z) so it toggles without navigating. */}
      <Link
        href={`/play/${meta.id}`}
        aria-label={`Play ${meta.name}`}
        className="absolute inset-0 z-[1] rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      />

      <div className="flex items-center justify-between">
        <div
          className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border"
          style={{ background: `${a.solid}1f`, borderColor: `${a.solid}4d`, color: a.solid }}
        >
          <GameIcon id={meta.icon} />
        </div>
        {showFavorite && (
          <button
            type="button"
            onClick={() => toggleFavorite(meta.id)}
            aria-label={fav ? `Remove ${meta.name} from favourites` : `Add ${meta.name} to favourites`}
            aria-pressed={fav}
            title={fav ? "Remove from favourites" : "Add to favourites"}
            className={cn(
              "relative z-[2] flex h-9 w-9 items-center justify-center rounded-full text-[17px] leading-none outline-none transition-all",
              "hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40 active:scale-90",
              fav ? "text-[#ffd66b]" : "text-ink-faint hover:text-ink-soft",
            )}
            style={fav ? { textShadow: "0 0 10px rgba(255,214,107,0.55)" } : undefined}
          >
            {fav ? "★" : "☆"}
          </button>
        )}
      </div>

      <div
        className="mt-3.5 font-mono text-[10.5px] tracking-[0.14em]"
        style={{ color: a.soft }}
      >
        {meta.category}
      </div>
      <div className="mt-1 font-display text-xl font-semibold text-ink">{meta.name}</div>
      <div className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-ink-soft">
        {meta.tagline}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-[11px] text-ink-mute">~{meta.estMinutes} min</span>
        {done ? (
          <span
            className="rounded-[10px] px-4 py-2 font-display text-[13px] font-semibold text-mint"
            style={{ background: "rgba(124,245,196,0.18)" }}
          >
            ✓ {resultLabel ?? "Replay"}
          </span>
        ) : (
          <span
            className="rounded-[10px] px-4 py-2 font-display text-[13px] font-semibold text-[#04060f] transition-transform group-hover:-translate-y-0.5"
            style={{ backgroundImage: `linear-gradient(118deg, ${a.from}, ${a.to})` }}
          >
            Play →
          </span>
        )}
      </div>
    </div>
  );
}
