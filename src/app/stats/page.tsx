"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  computeSkills,
  overallSkill,
  SKILL_METAS,
  type ResultsMap,
} from "@/lib/skills";
import type { SkillDomain, GameId } from "@/lib/types";
import { useProgress, liveStreak, type StoredResult } from "@/lib/progress";
import { GAME_METAS } from "@/games/_meta";
import { StatBox, Pill, Card } from "@/components/ui/Card";
import { GameIcon } from "@/components/GameIcon";
import { todayISO } from "@/lib/daily";
import { GuestCta } from "@/components/GuestCta";
import { cn } from "@/lib/cn";

/** Headline tier for the overall brain score. */
function tierFor(score: number): { title: string; copy: string } {
  if (score <= 0)
    return {
      title: "Untapped potential",
      copy: "Play a few daily puzzles and your brain profile will take shape. Each game you finish maps onto one of six cognitive domains.",
    };
  if (score < 35)
    return {
      title: "Warming up",
      copy: "Your mind is just starting to leave a trace. Keep tapping in daily — variety across games rounds out every skill.",
    };
  if (score < 60)
    return {
      title: "Finding your rhythm",
      copy: "A balanced profile is forming. Lean into your weaker domains to even out the radar and push the overall score higher.",
    };
  if (score < 80)
    return {
      title: "Sharp and steady",
      copy: "Strong, consistent form across the board. You're outpacing most casual players — a streak away from peak shape.",
    };
  return {
    title: "Peak brainpower",
    copy: "Elite, well-rounded cognition. Your radar is glowing on every axis — now it's about holding the line day after day.",
  };
}

/** Flatten the results map into a recency-sorted list of stored results. */
function recentResults(results: ResultsMap, limit = 10): StoredResult[] {
  const flat: StoredResult[] = [];
  for (const day of Object.values(results)) {
    if (!day) continue;
    for (const r of Object.values(day)) {
      if (r) flat.push(r);
    }
  }
  flat.sort((a, b) => b.playedAt - a.playedAt);
  return flat.slice(0, limit);
}

function relTime(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  return `${w}w ago`;
}

/* ===================== Radar canvas ===================== */

interface RadarVertex {
  label: string;
  color: string;
  value: number; // 0..100
}

function Radar({ vertices }: { vertices: RadarVertex[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep latest data in a ref so the resize observer's draw uses fresh values.
  const dataRef = useRef(vertices);
  dataRef.current = vertices;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let raf = 0;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const data = dataRef.current;
      const n = data.length;

      const cssW = wrap.clientWidth || 320;
      const cssH = cssW; // square
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const cx = cssW / 2;
      const cy = cssH / 2;
      const labelPad = Math.max(34, cssW * 0.12);
      const radius = Math.max(20, cssW / 2 - labelPad);
      const startAngle = -Math.PI / 2; // first axis points up
      const angleFor = (i: number) => startAngle + (i / n) * Math.PI * 2;
      const point = (i: number, r: number): [number, number] => {
        const a = angleFor(i);
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      };

      // Grid rings
      const rings = 4;
      for (let ring = 1; ring <= rings; ring++) {
        const r = (radius * ring) / rings;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const [x, y] = point(i % n, r);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle =
          ring === rings ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Spokes
      for (let i = 0; i < n; i++) {
        const [x, y] = point(i, radius);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Data polygon
      const valPoint = (i: number): [number, number] => {
        const v = Math.max(0, Math.min(100, data[i].value)) / 100;
        return point(i, radius * v);
      };

      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const [x, y] = valPoint(i % n);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, cy - radius, 0, cy + radius);
      grad.addColorStop(0, "rgba(0,229,255,0.30)");
      grad.addColorStop(1, "rgba(255,43,214,0.22)");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,229,255,0.85)";
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Vertices + labels
      ctx.font =
        "600 11px ui-monospace, 'JetBrains Mono', monospace";
      for (let i = 0; i < n; i++) {
        const [vx, vy] = valPoint(i);
        ctx.beginPath();
        ctx.arc(vx, vy, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = data[i].color;
        ctx.shadowColor = data[i].color;
        ctx.shadowBlur = reduced ? 0 : 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label outside the ring
        const [lx, ly] = point(i, radius + labelPad * 0.62);
        const a = angleFor(i);
        ctx.fillStyle = data[i].color;
        ctx.textBaseline = "middle";
        const cos = Math.cos(a);
        ctx.textAlign = cos > 0.3 ? "left" : cos < -0.3 ? "right" : "center";
        ctx.fillText(data[i].label.toUpperCase(), lx, ly);

        // Value under label
        ctx.fillStyle = "rgba(226,234,255,0.55)";
        ctx.font = "500 10px ui-monospace, 'JetBrains Mono', monospace";
        ctx.fillText(String(Math.round(data[i].value)), lx, ly + 13);
        ctx.font = "600 11px ui-monospace, 'JetBrains Mono', monospace";
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [vertices]);

  return (
    <div ref={wrapRef} className="relative mx-auto aspect-square w-full max-w-[380px]">
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
      <span className="sr-only">
        Radar chart of six cognitive skills:{" "}
        {vertices.map((v) => `${v.label} ${Math.round(v.value)}`).join(", ")}.
      </span>
    </div>
  );
}

/* ===================== Skill bars ===================== */

function SkillBar({
  label,
  color,
  value,
  hydrated,
}: {
  label: string;
  color: string;
  value: number;
  hydrated: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          {label}
        </span>
        <span className="font-display text-sm font-semibold" style={{ color }}>
          {Math.round(pct)}
          <span className="text-[11px] text-ink-faint">%</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-white/[0.06]">
        <div
          className="h-full rounded-pill transition-[width] duration-700 ease-out"
          style={{
            width: hydrated ? `${pct}%` : "0%",
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            boxShadow: `0 0 12px ${color}55`,
          }}
        />
      </div>
    </div>
  );
}

/* ===================== Page ===================== */

export default function StatsPage() {
  const today = todayISO();
  const hydrated = useProgress((s) => s.hydrated);
  const results = useProgress((s) => s.results);
  const currentStreak = useProgress((s) => s.currentStreak);
  const longestStreak = useProgress((s) => s.longestStreak);
  const lastPlayedISO = useProgress((s) => s.lastPlayedISO);

  const scores = useMemo<Record<SkillDomain, number>>(
    () => computeSkills(results, today),
    [results, today],
  );
  const overall = useMemo(() => overallSkill(scores), [scores]);
  const streak = hydrated ? liveStreak(currentStreak, lastPlayedISO) : 0;

  const vertices = useMemo<RadarVertex[]>(
    () => SKILL_METAS.map((m) => ({ label: m.label, color: m.color, value: scores[m.domain] })),
    [scores],
  );

  const gamesPlayed = useMemo(() => {
    let total = 0;
    for (const day of Object.values(results)) {
      if (day) total += Object.keys(day).length;
    }
    return total;
  }, [results]);

  const daysActive = useMemo(
    () => Object.values(results).filter((d) => d && Object.keys(d).length > 0).length,
    [results],
  );

  const recent = useMemo(() => recentResults(results, 10), [results]);
  const now = Date.now();
  const tier = tierFor(overall);

  // Strongest / weakest domain for summary copy.
  const ranked = useMemo(
    () => SKILL_METAS.map((m) => ({ ...m, value: scores[m.domain] })).sort((a, b) => b.value - a.value),
    [scores],
  );
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];

  return (
    <div className="mx-auto max-w-shell px-6 pb-24 pt-28 sm:px-8 sm:pt-32">
      {/* header */}
      <div className="flex animate-rise flex-col items-center text-center">
        <div className="flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.26em] text-cyan-soft">
          <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-cyan shadow-[0_0_8px_#00e5ff]" />
          <span>Your brain profile</span>
        </div>
        <h1 className="mt-4 font-display text-[clamp(30px,4.6vw,52px)] font-semibold leading-none tracking-[-0.03em] text-ink">
          {hydrated ? tier.title : "Mapping your mind…"}
        </h1>
        <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-ink-soft">
          {hydrated ? tier.copy : "Reading your last 30 days of play across six cognitive domains."}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Pill color="#00e5ff">{gamesPlayed} GAMES PLAYED</Pill>
          <Pill color="#ffb020">{streak} DAY STREAK</Pill>
          <Pill color="#86a3ff">{daysActive} DAYS ACTIVE</Pill>
          {longestStreak > 0 ? <Pill color="#7CF5C4">BEST {longestStreak}</Pill> : null}
        </div>
      </div>

      {/* optional-account invite (guests only) */}
      <GuestCta variant="stats" className="mt-8 animate-rise" />

      {/* stat strip */}
      <div className="mt-8 grid animate-rise grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatBox value={String(overall)} sub="/100" label="BRAIN SCORE" color="#00e5ff" />
        <StatBox
          value={top && top.value > 0 ? top.label : "—"}
          label="TOP SKILL"
          color={top && top.value > 0 ? top.color : "#86a3ff"}
        />
        <StatBox
          value={bottom && top && top.value > 0 ? bottom.label : "—"}
          label="GROW NEXT"
          color={bottom ? bottom.color : "#ff2bd6"}
        />
        <StatBox value={String(gamesPlayed)} label="TOTAL PLAYS" color="#7CF5C4" />
      </div>

      {/* radar + bars */}
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-6 sm:p-8">
          <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">
            SKILL RADAR
          </div>
          <div className="mt-4">
            <Radar vertices={vertices} />
          </div>
        </Card>

        <Card className="flex flex-col p-6 sm:p-8">
          <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">
            SIX DOMAINS
          </div>
          <div className="mt-5 flex flex-1 flex-col justify-center gap-4">
            {SKILL_METAS.map((m) => (
              <SkillBar
                key={m.domain}
                label={m.label}
                color={m.color}
                value={scores[m.domain]}
                hydrated={hydrated}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* recent activity */}
      <div className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] text-ink-mute">
              RECENT ACTIVITY
            </div>
            <h2 className="mt-2 font-display text-[clamp(22px,3vw,30px)] font-semibold tracking-[-0.02em] text-ink">
              Your last plays
            </h2>
          </div>
          <Link
            href="/archive"
            className="font-mono text-xs text-cyan transition-colors hover:text-cyan-soft"
          >
            Open archive →
          </Link>
        </div>

        <Card className="mt-5 p-2 sm:p-3">
          {recent.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-ink-soft">No plays recorded yet.</p>
              <Link
                href="/"
                className="mt-3 inline-block font-mono text-xs text-cyan transition-colors hover:text-cyan-soft"
              >
                Play today&apos;s puzzles →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((r, i) => {
                const meta = GAME_METAS[r.gameId as GameId];
                const accent = meta?.accent.solid ?? "#00e5ff";
                return (
                  <li
                    key={`${r.dateISO}-${r.gameId}-${i}`}
                    className="flex items-center gap-3.5 px-3 py-3 sm:px-4"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                      style={{
                        color: accent,
                        borderColor: `${accent}40`,
                        background: `${accent}12`,
                      }}
                    >
                      <GameIcon id={r.gameId as GameId} size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-[15px] font-medium text-ink">
                        {meta?.name ?? r.gameId}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[10.5px] text-ink-mute">
                        <span
                          className={cn(
                            r.status === "won"
                              ? "text-mint-soft"
                              : r.status === "lost"
                                ? "text-magenta-soft"
                                : "text-ink-mute",
                          )}
                        >
                          {r.status === "won"
                            ? "WON"
                            : r.status === "lost"
                              ? "LOST"
                              : "PLAYED"}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{relTime(r.playedAt, now)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      {typeof r.stars === "number" && r.stars > 0 ? (
                        <span
                          className="font-display text-sm"
                          style={{ color: accent }}
                          aria-label={`${r.stars} stars`}
                        >
                          {"★".repeat(Math.min(3, r.stars))}
                          <span className="text-ink-faint">
                            {"★".repeat(Math.max(0, 3 - r.stars))}
                          </span>
                        </span>
                      ) : (
                        <span
                          className="font-display text-base font-semibold"
                          style={{ color: accent }}
                        >
                          {Math.round(r.score)}
                          <span className="text-[11px] text-ink-faint">/100</span>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
