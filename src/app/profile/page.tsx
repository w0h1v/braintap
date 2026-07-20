"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, StatBox } from "@/components/ui/Card";
import { Button, GhostButton } from "@/components/ui/Button";
import { AchievementsGrid } from "@/components/AchievementsGrid";
import { useAuth } from "@/lib/auth";
import { useProgress, liveStreak } from "@/lib/progress";

export default function ProfilePage() {
  const router = useRouter();
  const { user, enabled, loading, displayName, avatarLetter, signOut, deleteAccount } = useAuth();

  const hydrated = useProgress((s) => s.hydrated);
  const results = useProgress((s) => s.results);
  const currentStreak = useProgress((s) => s.currentStreak);
  const longestStreak = useProgress((s) => s.longestStreak);
  const lastPlayedISO = useProgress((s) => s.lastPlayedISO);

  const [signingOut, setSigningOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalPlayed = useMemo(() => {
    let n = 0;
    for (const day of Object.values(results)) n += Object.keys(day ?? {}).length;
    return n;
  }, [results]);

  const streak = hydrated ? liveStreak(currentStreak, lastPlayedISO) : 0;
  const longest = hydrated ? longestStreak : 0;

  async function onSignOut() {
    setSigningOut(true);
    await signOut();
    router.push("/");
    router.refresh();
  }

  async function onDeleteAccount() {
    setDeleteError(null);
    setDeleting(true);
    const { error } = await deleteAccount();
    if (error) {
      setDeleteError(error);
      setDeleting(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  const loggedIn = enabled && Boolean(user);
  const email = user?.email ?? null;
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null;

  return (
    <section className="mx-auto max-w-shell px-6 pb-20 pt-28 sm:px-8">
      <div className="mx-auto w-full max-w-[560px] animate-rise">
        <div className="mb-7 text-center">
          <div className="font-mono text-[11px] tracking-[0.22em] text-cyan-soft">PROFILE</div>
          <h1 className="mt-3 font-display text-[clamp(28px,4.4vw,40px)] font-semibold tracking-[-0.02em] text-ink">
            {loggedIn ? "Your brain profile" : "Playing as guest"}
          </h1>
        </div>

        {enabled && loading ? (
          <Card className="p-8 text-center text-sm text-ink-mute">Loading your profile…</Card>
        ) : loggedIn ? (
          <>
            <Card className="flex flex-col items-center gap-4 p-7 text-center sm:flex-row sm:items-center sm:gap-5 sm:p-8 sm:text-left">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-16 w-16 rounded-full border border-line-strong object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-magenta font-display text-2xl font-semibold text-[#04060f]">
                  {avatarLetter}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-display text-xl font-semibold text-ink">
                  {displayName}
                </div>
                {email ? (
                  <div className="mt-0.5 truncate font-mono text-xs text-ink-mute">{email}</div>
                ) : null}
              </div>
            </Card>

            <div className="mt-4 grid grid-cols-3 gap-3.5">
              <StatBox
                value={String(streak)}
                sub=" d"
                label="CURRENT STREAK"
                color="#ffb020"
              />
              <StatBox
                value={String(longest)}
                sub=" d"
                label="LONGEST STREAK"
                color="#ff2bd6"
              />
              <StatBox value={String(totalPlayed)} label="GAMES PLAYED" color="#00e5ff" />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/stats" className="sm:flex-1">
                <Button className="w-full">View detailed stats →</Button>
              </Link>
              <GhostButton
                type="button"
                onClick={onSignOut}
                disabled={signingOut}
                className="w-full sm:w-auto"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </GhostButton>
            </div>

            <Card className="mt-7 p-6 sm:p-7">
              <h2 className="font-display text-base font-semibold text-ink">Delete account</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-mute">
                Permanently deletes your account, synced results, streaks, and leaderboard
                entries. Progress saved on this device stays on this device. This cannot be
                undone.
              </p>
              {deleteError ? (
                <p className="mt-3 rounded-xl border border-[#ff5c7a]/30 bg-[#ff5c7a]/[0.08] px-3.5 py-2.5 text-sm text-[#ff9db0]">
                  {deleteError}
                </p>
              ) : null}
              {confirmingDelete ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={onDeleteAccount}
                    disabled={deleting}
                    className="rounded-xl border border-[#ff5c7a]/50 bg-[#ff5c7a]/[0.12] px-4 py-2.5 font-display text-sm font-semibold text-[#ff9db0] transition-colors hover:bg-[#ff5c7a]/[0.2] disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Yes, permanently delete"}
                  </button>
                  <GhostButton
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="sm:w-auto"
                  >
                    Cancel
                  </GhostButton>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="mt-4 rounded-xl border border-line px-4 py-2.5 font-display text-sm font-semibold text-[#ff9db0] transition-colors hover:border-[#ff5c7a]/40"
                >
                  Delete account…
                </button>
              )}
            </Card>
          </>
        ) : (
          <>
            <Card className="flex flex-col items-center gap-5 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-magenta font-display text-2xl font-semibold text-[#04060f]">
                ?
              </div>
              <div>
                <div className="font-display text-xl font-semibold text-ink">Guest player</div>
                <p className="mx-auto mt-2 max-w-[380px] text-sm leading-relaxed text-ink-soft">
                  {enabled
                    ? "Sign in to sync your streak across devices and join the leaderboard. Your progress on this device stays put either way."
                    : "Accounts aren't configured, so you're playing as a guest. Your progress and streak save right here on this device."}
                </p>
              </div>

              <div className="grid w-full max-w-[360px] grid-cols-3 gap-3">
                <StatBox value={String(streak)} sub=" d" label="STREAK" color="#ffb020" />
                <StatBox value={String(longest)} sub=" d" label="LONGEST" color="#ff2bd6" />
                <StatBox value={String(totalPlayed)} label="PLAYED" color="#00e5ff" />
              </div>

              <div className="flex w-full max-w-[360px] flex-col gap-3">
                {enabled ? (
                  <Link href="/auth/login" className="w-full">
                    <Button className="w-full">Sign in →</Button>
                  </Link>
                ) : null}
                <Link href="/stats" className="w-full">
                  <GhostButton className="w-full">View your stats</GhostButton>
                </Link>
              </div>
            </Card>
          </>
        )}

        {hydrated && (
          <div className="mt-7">
            <AchievementsGrid />
          </div>
        )}
      </div>
    </section>
  );
}
