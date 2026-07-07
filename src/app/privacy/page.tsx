import type { Metadata } from "next";
import { Card, Pill } from "@/components/ui/Card";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = {
  title: "Privacy — BrainTap Games",
  description:
    "How BrainTap handles your data: local-first progress, optional accounts, and no selling of personal information.",
};

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "The short version",
    body: (
      <>
        BrainTap is a free daily brain-games site. You can play entirely on your
        own device without an account. We do not sell your personal information,
        and we collect as little as we reasonably can.
      </>
    ),
  },
  {
    heading: "Playing without an account",
    body: (
      <>
        By default, your game progress — completed puzzles, streaks, settings,
        and results — is stored in your browser&apos;s <strong>localStorage</strong>{" "}
        on your own device. This data never leaves your browser unless you choose
        to create an account. Clearing your browser data or playing in private
        mode will remove it, and your progress will not follow you to another
        device.
      </>
    ),
  },
  {
    heading: "Optional accounts",
    body: (
      <>
        If you choose to create an account, we store the information needed to run
        it — such as your email address, a username, and your game results and
        streaks — so your progress can sync across devices and appear on
        leaderboards. You can play forever without signing up; accounts are
        entirely optional.
      </>
    ),
  },
  {
    heading: "What we collect",
    body: (
      <>
        Without an account: only the local data described above, which we cannot
        see. With an account: your email, username, and gameplay results. We may
        also collect basic, aggregated technical information (such as
        anonymous usage and error logs) to keep the site working and improve it.
        We do not request sensitive personal information and ask that you not send
        it to us.
      </>
    ),
  },
  {
    heading: "How we use it",
    body: (
      <>
        We use your data to run the game, save and sync your progress, calculate
        streaks and leaderboards, and fix problems. We do not sell your personal
        information, and we do not use it for third-party advertising profiles.
      </>
    ),
  },
  {
    heading: "Service providers",
    body: (
      <>
        Account data is stored with a hosting and database provider acting on our
        behalf. They process this data only to provide the service and are not
        permitted to use it for their own purposes.
      </>
    ),
  },
  {
    heading: "Mobile app: ads, purchases, and sign-in",
    body: (
      <>
        Our mobile app shows ads through Google AdMob. We request{" "}
        <strong>non-personalized ads only</strong> — they are not tailored using a
        cross-app advertising profile, and the app does not ask to track you or use
        Apple&apos;s Advertising Identifier for advertising. Optional in-app
        purchases (such as removing ads) are processed by Apple and managed via
        RevenueCat; we receive a purchase receipt and entitlement status, not your
        payment details. If you choose Sign in with Apple or Google, that provider
        authenticates you and shares your name and email according to your choices
        — with Sign in with Apple you may hide your email.
      </>
    ),
  },
  {
    heading: "Your choices",
    body: (
      <>
        You can clear local progress at any time from your browser settings or the
        in-app reset option. If you have an account, you can permanently delete it
        — along with your synced results, streaks, and leaderboard entries — from
        the <strong>Profile</strong> page, or by emailing us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan hover:text-cyan-soft">
          {SUPPORT_EMAIL}
        </a>
        . Deleting your account removes your synced progress from our records.
      </>
    ),
  },
  {
    heading: "Children",
    body: (
      <>
        BrainTap is intended for a general audience and is not directed at
        children under 13. We do not knowingly collect personal information from
        children. If you believe a child has provided us personal information,
        please contact us so we can remove it.
      </>
    ),
  },
  {
    heading: "Changes",
    body: (
      <>
        We may update this policy from time to time. When we make material
        changes, we will update the date below. Continuing to use BrainTap after a
        change means you accept the updated policy.
      </>
    ),
  },
  {
    heading: "Contact",
    body: (
      <>
        Questions about privacy? Email BrainTap Labs at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan hover:text-cyan-soft">
          {SUPPORT_EMAIL}
        </a>{" "}
        and we will do our best to help.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
      <header className="animate-rise">
        <Pill color="#00e5ff">PRIVACY</Pill>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] text-ink-mute">
          LAST UPDATED · JULY 7, 2026
        </p>
      </header>

      <Card className="mt-10 p-7 sm:p-9">
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-lg font-semibold text-ink">
                {s.heading}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                {s.body}
              </p>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
