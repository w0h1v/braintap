import type { Metadata } from "next";
import Link from "next/link";
import { Card, Pill } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "The science — BrainTap Games",
  description:
    "An honest look at the six cognitive domains BrainTap exercises and why short, consistent daily practice is a sensible way to stay sharp.",
};

const DOMAINS = [
  {
    label: "MEMORY",
    color: "#00e5ff",
    title: "Memory",
    body: "Holding information in mind and recalling it on demand. Pattern- and sequence-recall games gently push the limits of how much you can keep active at once before retrieving it.",
    games: "Memory Vault · Sequence Echo",
  },
  {
    label: "LOGIC",
    color: "#ffb020",
    title: "Logic & reasoning",
    body: "Working through constraints to reach a conclusion. Deduction puzzles ask you to combine known facts, rule out the impossible, and arrive at the one answer that fits.",
    games: "Mini Sudoku · Focus Forge · Tap Teasers",
  },
  {
    label: "VERBAL",
    color: "#ff2bd6",
    title: "Verbal & language",
    body: "Retrieving and recombining words. Word games tap your vocabulary and your ability to spot relationships between terms, which keeps language flexible and quick.",
    games: "Neural Connections · Synapse Wordle · Mind Strands · Idea Weaver",
  },
  {
    label: "FOCUS",
    color: "#9b8cff",
    title: "Attention & focus",
    body: "Directing and sustaining concentration while ignoring distraction. Timed search and scan tasks train you to take in a whole field at once and act on it without losing your place.",
    games: "Schulte Table · Sum Sprint",
  },
  {
    label: "SPEED",
    color: "#7CF5C4",
    title: "Processing speed",
    body: "How quickly you take something in and respond. Against-the-clock games reward fast, confident decisions and push your reaction time over repeated rounds.",
    games: "Sum Sprint · Sequence Echo",
  },
  {
    label: "SPATIAL",
    color: "#86a3ff",
    title: "Spatial reasoning",
    body: "Mentally manipulating shapes, positions, and moves. Tile and board games ask you to picture an outcome before you make it and plan a path to get there.",
    games: "Tile Slide · 2048 · Reversi",
  },
];

export default function SciencePage() {
  return (
    <div className="mx-auto max-w-shell px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
      <header className="animate-rise">
        <Pill color="#86a3ff">THE SCIENCE</Pill>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
          Six domains,
          <br />
          <span className="bg-gradient-to-r from-peri via-cyan to-mint bg-clip-text text-transparent">
            a little every day.
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-soft">
          BrainTap&apos;s games span six broad areas of thinking. We want to be
          straight with you about what that means: this is a fun way to give a
          range of mental skills a regular workout, not a medical treatment or a
          guarantee of a higher IQ.
        </p>
      </header>

      <section className="mt-14">
        <h2 className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">
          THE SIX COGNITIVE DOMAINS
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DOMAINS.map((d) => (
            <Card key={d.label} className="flex flex-col p-6">
              <Pill color={d.color} className="self-start">
                {d.label}
              </Pill>
              <h3 className="mt-3 font-display text-lg font-semibold">{d.title}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-soft">
                {d.body}
              </p>
              <p className="mt-4 font-mono text-[11px] tracking-[0.08em] text-ink-mute">
                {d.games}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">
          WHY A DAILY HABIT
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card className="p-7">
            <h3 className="font-display text-lg font-semibold">
              Consistency over intensity
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              A few focused minutes most days is easier to sustain than a long
              session once in a while — and it is the routine, far more than any
              single puzzle, that makes a habit stick. The daily format is built
              to make that small commitment feel achievable.
            </p>
          </Card>
          <Card className="p-7">
            <h3 className="font-display text-lg font-semibold">
              Variety keeps it interesting
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              Rotating across word, number, logic, memory, and spatial challenges
              keeps things fresh and stops any one skill from getting all the
              attention. Novelty is part of what makes the daily set worth coming
              back to.
            </p>
          </Card>
        </div>
      </section>

      <section className="mt-12">
        <Card className="p-7">
          <h3 className="font-mono text-[11px] tracking-[0.2em] text-amber-soft">
            AN HONEST NOTE
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            The evidence on whether brain-training games make you broadly
            &ldquo;smarter&rdquo; is genuinely mixed. People reliably improve at
            the specific games they practice, and that progress feels good and is
            worth enjoying for its own sake — but how much that carries over to
            everyday tasks is still debated by researchers. We would rather you
            play BrainTap because it is a fun, low-stakes daily ritual than
            because of any inflated promise. For meaningful, lasting cognitive
            health, the boring classics still win: sleep, exercise, social
            connection, and learning new things.
          </p>
        </Card>
      </section>

      <section className="mt-16 text-center">
        <Card className="bg-gradient-to-b from-[rgba(134,163,255,0.08)] to-[rgba(0,229,255,0.05)] p-10">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Give your mind a stretch.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
            Today&apos;s puzzles cover all six domains. See where you land.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-peri to-cyan px-7 py-3 font-display text-sm font-semibold text-bg shadow-btn transition-transform hover:-translate-y-0.5"
          >
            Start playing →
          </Link>
        </Card>
      </section>
    </div>
  );
}
