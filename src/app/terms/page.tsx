import type { Metadata } from "next";
import { Card, Pill } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Terms — BrainTap Games",
  description:
    "The simple terms for using BrainTap: a free daily brain-games site offered as-is for personal enjoyment.",
};

const SECTIONS: { heading: string; body: React.ReactNode }[] = [
  {
    heading: "Welcome",
    body: (
      <>
        These terms cover your use of BrainTap, a free daily brain-games website
        offered by BrainTap Labs. By using the site, you agree to them. If you do
        not agree, please do not use BrainTap.
      </>
    ),
  },
  {
    heading: "Using BrainTap",
    body: (
      <>
        BrainTap is provided for your personal, non-commercial enjoyment. You may
        play the daily puzzles, build a streak, and share your results. Please do
        not misuse the service — for example by attempting to break, overload, or
        gain unauthorized access to it, scraping it at scale, or interfering with
        other players.
      </>
    ),
  },
  {
    heading: "Local progress and accounts",
    body: (
      <>
        You can play without an account, in which case your progress is stored in
        your browser&apos;s <strong>localStorage</strong> on your own device and may
        be lost if you clear your browser data. Creating an account is optional and
        lets your progress sync across devices. You are responsible for keeping
        your account credentials secure and for activity under your account.
      </>
    ),
  },
  {
    heading: "Fair play",
    body: (
      <>
        Leaderboards and streaks are meant to be fun. We may adjust, reset, or
        remove scores and accounts that appear to use automation, exploits, or
        other forms of cheating, at our discretion.
      </>
    ),
  },
  {
    heading: "Content and intellectual property",
    body: (
      <>
        The puzzles, games, design, name, and logos that make up BrainTap belong
        to BrainTap Labs or its licensors and are protected by intellectual
        property laws. You may enjoy them through the site but may not copy,
        resell, or redistribute them without permission.
      </>
    ),
  },
  {
    heading: "No warranty",
    body: (
      <>
        BrainTap is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo;
        without warranties of any kind. We do not promise the site will always be
        available, error-free, or that your progress will never be lost. Brain
        games are for entertainment and are not a substitute for medical or
        professional advice.
      </>
    ),
  },
  {
    heading: "Limitation of liability",
    body: (
      <>
        To the fullest extent permitted by law, BrainTap Labs is not liable for
        any indirect, incidental, or consequential damages arising from your use
        of the site, including any loss of progress or data. The service is free,
        and you use it at your own discretion.
      </>
    ),
  },
  {
    heading: "Changes and availability",
    body: (
      <>
        We may add, change, or remove games and features, and we may suspend or
        discontinue the service at any time. We may also update these terms; when
        we make material changes, we will update the date below. Continuing to use
        BrainTap means you accept the updated terms.
      </>
    ),
  },
  {
    heading: "Contact",
    body: (
      <>
        Questions about these terms? Reach out to BrainTap Labs and we will be
        happy to help.
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
      <header className="animate-rise">
        <Pill color="#ff2bd6">TERMS</Pill>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
          Terms of Use
        </h1>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] text-ink-mute">
          LAST UPDATED · JUNE 17, 2026
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
