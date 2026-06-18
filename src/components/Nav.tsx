"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./GameIcon";
import { SettingsModal } from "./SettingsModal";
import { useAuth } from "@/lib/auth";
import { useProgress, liveStreak } from "@/lib/progress";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/archive", label: "Archive" },
  { href: "/stats", label: "Stats" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, enabled, avatarLetter } = useAuth();
  const hydrated = useProgress((s) => s.hydrated);
  const currentStreak = useProgress((s) => s.currentStreak);
  const lastPlayedISO = useProgress((s) => s.lastPlayedISO);
  const streak = hydrated ? liveStreak(currentStreak, lastPlayedISO) : 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <nav
        className={cn(
          "fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 px-5 py-3.5 transition-all duration-300 sm:px-8",
          scrolled
            ? "border-b border-line bg-bg/80 backdrop-blur-md"
            : "border-b border-transparent",
        )}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="hidden font-mono text-[13px] font-semibold tracking-[0.2em] text-ink sm:inline">
            BRAINTAP <span className="text-cyan">GAMES</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 font-mono text-xs tracking-[0.04em] md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-ink-mute transition-colors hover:text-[#cfeeff]"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-pill border border-amber/30 bg-amber/[0.07] px-3 py-1.5 font-mono text-xs text-amber">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2c1.5 4 5 5.5 5 9.5a5 5 0 0 1-10 0C7 9 9 7 12 2Z" fill="#ffb020" opacity=".9" />
            </svg>
            <span aria-label={`${streak} day streak`}>{streak}</span>
          </div>

          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-white/[0.04]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="rgba(231,238,255,.7)" strokeWidth="1.6" />
              <path
                d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                stroke="rgba(231,238,255,.7)"
                strokeWidth="1.4"
              />
            </svg>
          </button>

          <Link
            href={user ? "/profile" : "/auth/login"}
            aria-label={enabled && user ? "Your profile" : "Sign in (optional)"}
            title={enabled && user ? "Your profile" : "Sign in — optional, for cross-device sync & leaderboard"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-magenta font-display text-[13px] font-semibold text-[#04060f]"
          >
            {enabled && user ? (
              avatarLetter
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 19v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1"
                  stroke="#04060f"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="8" r="3.4" stroke="#04060f" strokeWidth="1.8" />
              </svg>
            )}
          </Link>

          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-white/[0.04] md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="rgba(231,238,255,.8)" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="rgba(231,238,255,.8)" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="absolute inset-x-0 top-full mx-3 mt-1 flex flex-col gap-1 rounded-2xl border border-line bg-bg/95 p-2 backdrop-blur-md md:hidden">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-4 py-3 font-mono text-sm text-ink-soft transition-colors hover:bg-white/[0.05] hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
