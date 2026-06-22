"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Modal } from "@/components/ui/Modal";
import { useProgress } from "@/lib/progress";
import { todayISO } from "@/lib/daily";
import { shareText as doShare } from "@/lib/share";
import { GAME_METAS } from "@/games/_meta";
import { GAME_COUNT } from "@/lib/games";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const ACCENT = GAME_METAS.weaver.accent;
const TOTAL_GAMES = GAME_COUNT;

const STORAGE_PREFIX = "braintap-cleansweep-";

const CONFETTI_COLORS = [
  "#00e5ff",
  "#ff2bd6",
  "#7CF5C4",
  "#ffb020",
  "#9b8cff",
  "#ff9e3d",
];

interface Piece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotate: number;
  drift: number;
}

function Confetti() {
  const pieces = useMemo<Piece[]>(() => {
    // Deterministic-enough layout; purely decorative, no game logic.
    const arr: Piece[] = [];
    for (let i = 0; i < 70; i++) {
      const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
      arr.push({
        left: r(1) * 100,
        delay: r(2) * 0.6,
        duration: 1.6 + r(3) * 1.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + r(4) * 7,
        rotate: r(5) * 360,
        drift: (r(6) - 0.5) * 80,
      });
    }
    return arr;
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[120] overflow-hidden"
      aria-hidden
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: "-5%",
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            background: p.color,
            borderRadius: 2,
            opacity: 0.9,
            transform: `rotate(${p.rotate}deg)`,
            animation: `btConfetti ${p.duration}s linear ${p.delay}s forwards`,
            ["--drift" as string]: `${p.drift}px`,
          } as CSSProperties}
        />
      ))}
      <style>{`
        @keyframes btConfetti {
          0% { transform: translate3d(0,0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--drift, 0), 110vh, 0) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function shareLine() {
  // A check grid sized to the live game count (5 per row).
  const grid = Array.from({ length: Math.ceil(GAME_COUNT / 5) }, (_, r) =>
    "✅".repeat(Math.min(5, GAME_COUNT - r * 5)),
  ).join("\n");
  return `BrainTap · Clean Sweep! 🧹\nAll ${GAME_COUNT} games solved today.\n\n${grid}\nbraintap.app`;
}

export function CleanSweep() {
  const hydrated = useProgress((s) => s.hydrated);
  const results = useProgress((s) => s.results);
  const reducedMotion = useProgress((s) => s.settings.zen);

  const [open, setOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share Clean Sweep");
  const toast = useToast();

  const today = todayISO();
  const todayCount = useMemo(
    () => Object.keys(results[today] ?? {}).length,
    [results, today],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (todayCount < TOTAL_GAMES) return;
    if (typeof window === "undefined") return;
    const key = `${STORAGE_PREFIX}${today}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // If storage is unavailable, still show once for this mount.
    }
    setOpen(true);
  }, [hydrated, todayCount, today]);

  if (!open) return null;

  const showConfetti = !reducedMotion;

  return (
    <>
      {showConfetti && <Confetti />}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="cleansweep-title"
        className="text-center"
      >
        <div
          className="font-mono text-[11px] tracking-[0.2em]"
          style={{ color: ACCENT.solid }}
        >
          PERFECT DAY
        </div>
        <h2
          id="cleansweep-title"
          className={cn(
            "mt-2 font-display text-4xl font-semibold text-ink",
            !reducedMotion && "animate-pop",
          )}
        >
          Clean Sweep! 🧹
        </h2>

        <div
          className="mt-5 font-display text-[44px] font-semibold tracking-[0.04em]"
          style={{ color: ACCENT.solid }}
        >
          {TOTAL_GAMES}/{TOTAL_GAMES}
        </div>
        <div className="font-mono text-[11px] tracking-[0.1em] text-ink-faint">
          ALL GAMES SOLVED
        </div>

        <div
          className="mt-5 rounded-2xl border p-4 text-left"
          style={{ background: `${ACCENT.solid}14`, borderColor: `${ACCENT.solid}33` }}
        >
          <div
            className="font-mono text-[10px] tracking-[0.16em]"
            style={{ color: ACCENT.soft }}
          >
            🧠 BRAIN INSIGHT
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[rgba(226,234,255,0.82)]">
            You exercised all six cognitive domains today — verbal, logic, memory,
            spatial, numeric and focus. That kind of variety is exactly what keeps
            the brain sharp. See you tomorrow.
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            const r = await doShare(shareLine());
            setShareLabel(
              r === "copied" ? "Copied!" : r === "shared" ? "Shared!" : "Try again",
            );
            setTimeout(() => setShareLabel("Share Clean Sweep"), 1800);
            if (r === "copied") toast.show("Copied to clipboard");
            else if (r === "shared") toast.show("Shared!");
          }}
          className="mt-5 w-full rounded-xl py-3.5 font-display text-[15px] font-semibold text-[#04060f]"
          style={{ backgroundImage: `linear-gradient(118deg, ${ACCENT.from}, ${ACCENT.to})` }}
        >
          {shareLabel}
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-2.5 block w-full rounded-xl border border-line-strong bg-white/[0.04] py-3 font-display text-sm text-[#eaf1ff]"
        >
          Done
        </button>
      </Modal>
    </>
  );
}
