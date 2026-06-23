import type { Metadata } from "next";
import Link from "next/link";
import { Card, Pill } from "@/components/ui/Card";
import { GAME_COUNT_WORD } from "@/lib/games";

export const metadata: Metadata = {
  title: "How to play — BrainTap Games",
  description:
    "How the daily format works, how streaks are built, and a quick how-to for every game category in BrainTap.",
};

const STEPS = [
  {
    n: "01",
    title: "One fresh set, every day",
    body: "Every day at local midnight a new batch of puzzles unlocks. Each game has a single daily challenge — the same for everyone — so there is always a finish line and never an infinite scroll.",
  },
  {
    n: "02",
    title: "Play in any order",
    body: "Open the hub, pick whatever looks good, and play. Most games take one to six minutes. Finished games are marked so you can see at a glance what is left.",
  },
  {
    n: "03",
    title: "Build your streak",
    body: "Solve at least one game in a day to keep your streak alive. Miss a day and the streak resets — so a quick one-minute Schulte Table still counts.",
  },
  {
    n: "04",
    title: "Watch your profile climb",
    body: "Each game feeds one or more cognitive domains. Over time your results sketch a profile of where you are sharp and where there is room to grow.",
  },
];

const CATEGORIES = [
  {
    label: "VERBAL",
    color: "#ff2bd6",
    title: "Word & language games",
    games: "Neural Connections · Synapse Wordle · Mind Strands · Idea Weaver",
    how: "Read the prompt, then tap letters, tiles, or terms to form answers. In grouping games, select a set and submit; in spelling games, build as many valid words as you can. Wrong guesses usually cost a try, so look before you leap.",
  },
  {
    label: "LOGIC",
    color: "#ffb020",
    title: "Deduction puzzles",
    games: "Focus Forge · Tap Teasers · Mini Sudoku",
    how: "Use the clues, not luck. Fill cells that must be true, eliminate what cannot be, and let the constraints close in on the single solution. Take your time — there is no clock on pure-logic games.",
  },
  {
    label: "MEMORY",
    color: "#00e5ff",
    title: "Recall challenges",
    games: "Memory Vault · Sequence Echo",
    how: "Watch the pattern or sequence play out, then reproduce it from memory. Each correct round adds one more step. Focus during the reveal — once it starts you only have what you held onto.",
  },
  {
    label: "NUMBER",
    color: "#7CF5C4",
    title: "Math & merge games",
    games: "Sum Sprint · Pips · 2048",
    how: "Hit a target, balance the columns, or merge tiles toward a goal. Speed games run on a timer, so trust quick estimates; merge games reward planning a move or two ahead.",
  },
  {
    label: "FOCUS · SPEED",
    color: "#00e5ff",
    title: "Attention drills",
    games: "Schulte Table · Sum Sprint",
    how: "Find and tap targets in order, as fast as you can, while keeping the whole field in view. Soften your gaze, let your peripheral vision do the work, and chase your personal best.",
  },
  {
    label: "SPATIAL · STRATEGY",
    color: "#86a3ff",
    title: "Board & tile games",
    games: "Tile Slide · Reversi",
    how: "Plan a sequence of moves toward an ordered board, or outflank the BrainTap AI to flip the most pieces. Corners and edges are powerful — claim them early and think a few moves ahead.",
  },
];

export default function HowToPlayPage() {
  return (
    <div className="mx-auto max-w-shell px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
      <header className="animate-rise">
        <Pill color="#00e5ff">HOW TO PLAY</Pill>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
          One puzzle a day,
          <br />
          <span className="bg-gradient-to-r from-cyan via-peri to-magenta bg-clip-text text-transparent">
            built into a habit.
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-soft">
          BrainTap is a daily brain-games ritual. A fresh set of{" "}
          {GAME_COUNT_WORD.toLowerCase()} puzzles unlocks each day — play what you
          like, build a streak, and watch your mind sharpen over time.
        </p>
      </header>

      <section className="mt-14">
        <h2 className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">
          THE DAILY FORMAT
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {STEPS.map((s) => (
            <Card key={s.n} className="p-6">
              <span className="font-mono text-sm tracking-[0.12em] text-ink-faint">
                {s.n}
              </span>
              <h3 className="mt-2 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                {s.body}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">
          STREAKS, EXPLAINED
        </h2>
        <Card className="mt-6 p-7">
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Your streak counts the number of days in a row you have finished at
            least one game. It updates the moment you solve your first puzzle of
            the day. There is no penalty for playing only one game — and no bonus
            for cramming all {GAME_COUNT_WORD.toLowerCase()} — so a streak is purely a measure of showing
            up. If a day passes with nothing solved, the streak returns to zero
            and you start fresh. Progress is saved on your device, so you can pick
            up right where you left off.
          </p>
        </Card>
      </section>

      <section className="mt-16">
        <h2 className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">
          A QUICK HOW-TO PER CATEGORY
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <Card key={c.label} className="flex flex-col p-6">
              <Pill color={c.color} className="self-start">
                {c.label}
              </Pill>
              <h3 className="mt-3 font-display text-lg font-semibold">{c.title}</h3>
              <p className="mt-1 font-mono text-[11px] tracking-[0.08em] text-ink-mute">
                {c.games}
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {c.how}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16 text-center">
        <Card className="bg-gradient-to-b from-[rgba(0,229,255,0.08)] to-[rgba(255,43,214,0.05)] p-10">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Ready when you are.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
            Today&apos;s set is waiting. Solve one and start your streak.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-peri px-7 py-3 font-display text-sm font-semibold text-bg shadow-btn transition-transform hover:-translate-y-0.5"
          >
            Play today&apos;s puzzles →
          </Link>
        </Card>
      </section>
    </div>
  );
}
