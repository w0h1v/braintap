"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

/**
 * A tasteful, guest-only invitation to create a (free, optional) account.
 *
 * Playing BrainTap never requires an account — progress is saved locally on the
 * device. This banner only appears for guests (and only when accounts are
 * actually available, i.e. Supabase is configured) to explain the upside of
 * signing up: cross-device sync and a spot on the global leaderboard. It renders
 * nothing for signed-in users or while auth is still resolving, so it never
 * nags people who've already made the choice.
 */

type Variant = "stats" | "leaderboard" | "compact";

const COPY: Record<Variant, { title: string; body: string }> = {
  stats: {
    title: "You're playing as a guest",
    body: "Your stats and streak are saved on this device. Create a free account to sync them everywhere and keep them backed up — no account needed to keep playing.",
  },
  leaderboard: {
    title: "You're playing as a guest",
    body: "Your scores stay on this device. Create a free account to claim your place on the global leaderboard and compete with players worldwide.",
  },
  compact: {
    title: "Playing as a guest",
    body: "Create a free account to save your streak across devices and join the leaderboard.",
  },
};

export function GuestCta({
  variant = "compact",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const { user, enabled, loading } = useAuth();

  // Only invite genuine guests, and only when accounts exist at all.
  if (!enabled || loading || user) return null;

  const { title, body } = COPY[variant];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6",
        className,
      )}
      style={{
        borderColor: "rgba(0,229,255,0.2)",
        background:
          "linear-gradient(120deg, rgba(0,229,255,0.08), rgba(155,140,255,0.06))",
      }}
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan/30 bg-cyan/[0.1] text-cyan"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M16 17v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx="9.5" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M19 8v6M22 11h-6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div>
          <div className="font-display text-[15px] font-semibold text-ink">{title}</div>
          <p className="mt-1 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-soft">
            {body}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <Link
          href="/auth/signup"
          className={cn(
            "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan to-peri px-4 py-2.5",
            "font-display text-sm font-semibold text-[#04060f] transition-[transform,box-shadow] duration-200",
            "hover:-translate-y-0.5 hover:shadow-btn",
          )}
        >
          Create free account
        </Link>
        <Link
          href="/auth/login"
          className={cn(
            "inline-flex items-center justify-center rounded-xl border border-line-strong bg-white/[0.03] px-4 py-2.5",
            "font-display text-sm font-medium text-ink-soft transition-colors duration-300",
            "hover:border-cyan/55 hover:bg-cyan/[0.06] hover:text-[#eaf6ff]",
          )}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
