"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useProgress } from "@/lib/progress";
import { cn } from "@/lib/cn";
import { GAME_METAS, GAME_ORDER } from "@/games/_meta";
import { GAME_COUNT } from "@/lib/games";
import type { SkillDomain } from "@/lib/types";

const ACCENT = GAME_METAS.connections.accent;

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  art: () => ReactNode;
}

const SKILLS: { id: SkillDomain; label: string; color: string }[] = [
  { id: "verbal", label: "Verbal", color: "#00e5ff" },
  { id: "logic", label: "Logic", color: "#9b8cff" },
  { id: "memory", label: "Memory", color: "#ff2bd6" },
  { id: "spatial", label: "Spatial", color: "#7CF5C4" },
  { id: "numeric", label: "Numeric", color: "#ffb020" },
  { id: "focus", label: "Focus", color: "#ff9e3d" },
];

/** A mosaic of the daily deck — one tile per game, in that game's accent. */
function DailyArt() {
  const reducedMotion = useProgress((s) => s.settings.zen);
  return (
    <div className="grid w-full grid-cols-5 gap-1.5" aria-hidden>
      {GAME_ORDER.map((id, i) => {
        const a = GAME_METAS[id].accent;
        return (
          <div
            key={id}
            className={cn("aspect-square rounded-[7px] border", !reducedMotion && "animate-pop")}
            style={{
              borderColor: `${a.solid}66`,
              background: `linear-gradient(140deg, ${a.solid}40, ${a.solid}12)`,
              boxShadow: `inset 0 0 10px -5px ${a.solid}`,
              ...(reducedMotion ? {} : { animationDelay: `${i * 22}ms` }),
            }}
          />
        );
      })}
    </div>
  );
}

function SkillsArt() {
  return (
    <div className="flex flex-wrap justify-center gap-2" aria-hidden>
      {SKILLS.map((s) => (
        <span
          key={s.id}
          className="rounded-pill border px-3 py-1.5 font-mono text-[11px] tracking-[0.12em]"
          style={{
            color: s.color,
            borderColor: `${s.color}40`,
            background: `${s.color}14`,
          }}
        >
          {s.label.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

function StreakArt() {
  return (
    <div className="flex items-end justify-center gap-1.5" aria-hidden>
      {[2, 3, 4, 5, 6, 7].map((n, i) => (
        <div key={n} className="flex flex-col items-center gap-1.5">
          <div
            className="w-7 rounded-md"
            style={{
              height: `${18 + i * 9}px`,
              backgroundImage: `linear-gradient(180deg, ${ACCENT.from}, ${ACCENT.to})`,
              opacity: 0.35 + i * 0.11,
            }}
          />
        </div>
      ))}
      <div
        className="ml-1 font-display text-3xl font-semibold"
        style={{ color: "#ffb020" }}
      >
        🔥
      </div>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    eyebrow: "WELCOME TO BRAINTAP",
    title: `${GAME_COUNT} games. Every day.`,
    body: `A fresh deck of ${GAME_COUNT} bite-sized brain games drops daily — from word puzzles to logic grids to memory tests. Same puzzles for everyone, reset at local midnight.`,
    art: DailyArt,
  },
  {
    eyebrow: "TRAIN SIX SKILLS",
    title: "A full mental workout.",
    body: "Each game trains specific cognitive domains. Play across all of them and watch your brain profile fill out on the radar.",
    art: SkillsArt,
  },
  {
    eyebrow: "BUILD YOUR STREAK",
    title: "Show up daily.",
    body: "Finish at least one game a day to keep your streak alive. No account needed to play — progress is saved on this device. Sign up any time to sync across devices and join the leaderboard.",
    art: StreakArt,
  },
];

export function Onboarding() {
  const hydrated = useProgress((s) => s.hydrated);
  const onboarded = useProgress((s) => s.onboarded);
  const setOnboarded = useProgress((s) => s.setOnboarded);
  const reducedMotion = useProgress((s) => s.settings.zen);
  const pathname = usePathname();
  const [step, setStep] = useState(0);

  // Only greet first-time visitors on the hub — never pop over a game or a
  // deep-linked page the user navigated to directly.
  const open = hydrated && !onboarded && pathname === "/";
  if (!open) return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const Art = slide.art;

  const finish = () => setOnboarded(true);
  const next = () => {
    if (isLast) finish();
    else setStep((s) => s + 1);
  };

  return (
    <Modal open={open} onClose={finish} labelledBy="onboarding-title" className="text-center">
      <div
        className="font-mono text-[11px] tracking-[0.2em]"
        style={{ color: ACCENT.solid }}
      >
        {slide.eyebrow}
      </div>
      <h2
        id="onboarding-title"
        className="mt-2 font-display text-3xl font-semibold text-ink"
      >
        {slide.title}
      </h2>

      <div
        key={step}
        className={cn(
          "mt-6 flex min-h-[120px] items-center justify-center rounded-2xl border p-5",
          !reducedMotion && "animate-pop",
        )}
        style={{
          borderColor: `${ACCENT.solid}26`,
          background: `${ACCENT.solid}0d`,
        }}
      >
        <Art />
      </div>

      <p className="mt-5 text-sm leading-relaxed text-[rgba(226,234,255,0.82)]">
        {slide.body}
      </p>

      {/* progress dots */}
      <div className="mt-6 flex items-center justify-center gap-2" role="presentation">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setStep(i)}
            className={cn(
              "h-1.5 rounded-pill outline-none",
              !reducedMotion && "transition-all duration-300",
            )}
            style={{
              width: i === step ? 22 : 8,
              background: i === step ? ACCENT.solid : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={next}
        className="mt-6 w-full rounded-xl py-3.5 font-display text-[15px] font-semibold text-[#04060f]"
        style={{ backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})` }}
      >
        {isLast ? "Start playing" : "Next"}
      </button>

      {!isLast && (
        <button
          type="button"
          onClick={finish}
          className="mt-2.5 block w-full rounded-xl border border-line-strong bg-white/[0.04] py-3 font-display text-sm text-[#eaf1ff]"
        >
          Skip intro
        </button>
      )}
    </Modal>
  );
}
