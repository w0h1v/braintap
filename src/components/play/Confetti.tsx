"use client";

import { useEffect, useRef } from "react";
import { useProgress } from "@/lib/progress";
import type { Accent } from "@/lib/types";

const DURATION_MS = 1400;
const COUNT = 110;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  shape: 0 | 1; // 0 = rect, 1 = circle
}

/** A short, accent-tinted canvas confetti burst. Inert under reduced motion / zen. */
export function Confetti({ active, accent }: { active: boolean; accent: Accent }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const zen = useProgress((s) => s.settings.zen);

  useEffect(() => {
    if (!active) return;

    // Honour reduced-motion preference and zen mode: no animation at all.
    const prefersReduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || zen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const palette = [
      accent.solid,
      accent.from,
      accent.to,
      accent.soft,
      "#00e5ff",
      "#ff2bd6",
      "#7CF5C4",
      "#ffb020",
    ];

    // Deterministic-enough local RNG (no need for puzzle determinism here).
    let seed = 0x9e3779b9;
    const rnd = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) % 100000) / 100000;
    };

    const cx = w / 2;
    const particles: Particle[] = Array.from({ length: COUNT }, () => {
      const angle = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 0.95;
      const speed = 6 + rnd() * 12;
      return {
        x: cx + (rnd() - 0.5) * w * 0.3,
        y: h * 0.38 + (rnd() - 0.5) * 40,
        vx: Math.cos(angle) * speed + (rnd() - 0.5) * 4,
        vy: Math.sin(angle) * speed,
        rot: rnd() * Math.PI * 2,
        vr: (rnd() - 0.5) * 0.4,
        size: 5 + rnd() * 7,
        color: palette[Math.floor(rnd() * palette.length)],
        shape: rnd() > 0.5 ? 1 : 0,
      };
    });

    const gravity = 0.32;
    const drag = 0.99;
    const start = performance.now();

    const frame = (now: number) => {
      const t = now - start;
      const life = Math.min(t / DURATION_MS, 1);
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.vy += gravity;
        p.vx *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        ctx.save();
        ctx.globalAlpha = 1 - life * life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }

      if (life < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      ctx.clearRect(0, 0, w, h);
    };
  }, [active, zen, accent]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}
