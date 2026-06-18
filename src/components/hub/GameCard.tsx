"use client";

import Link from "next/link";
import type { GameMeta } from "@/lib/types";
import { GameIcon } from "@/components/GameIcon";
import { cn } from "@/lib/cn";

export function GameCard({
  meta,
  done,
  resultLabel,
}: {
  meta: GameMeta;
  done?: boolean;
  resultLabel?: string;
}) {
  const a = meta.accent;
  return (
    <Link
      href={`/play/${meta.id}`}
      className={cn(
        "group flex min-h-[230px] flex-col rounded-[20px] border p-6 transition-all duration-300",
        "hover:-translate-y-1.5",
        "focus-visible:-translate-y-1.5",
      )}
      style={{
        borderColor: `${a.solid}52`,
        background: `linear-gradient(165deg, ${a.solid}14, rgba(8,12,26,0.55))`,
        boxShadow: done ? `inset 0 2px 0 ${a.solid}, 0 0 22px ${a.solid}14` : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border"
          style={{ background: `${a.solid}1f`, borderColor: `${a.solid}4d`, color: a.solid }}
        >
          <GameIcon id={meta.icon} />
        </div>
        <span
          className="rounded-pill border px-2.5 py-1 font-mono text-[9.5px] tracking-[0.12em]"
          style={{ color: a.soft, borderColor: `${a.solid}4d` }}
        >
          {meta.category}
        </span>
      </div>

      <div className="mt-4 font-display text-xl font-semibold text-ink">{meta.name}</div>
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
    </Link>
  );
}
