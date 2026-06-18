import type { GameId } from "@/lib/types";

/**
 * Per-game glyph reproduced from the prototype. Uses `currentColor` so callers
 * set the accent via `style={{ color }}` or a text-color class.
 */
export function GameIcon({ id, size = 22 }: { id: GameId; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none" } as const;
  switch (id) {
    case "connections":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="7" height="7" rx="2" fill="currentColor" opacity=".9" />
          <rect x="14" y="3" width="7" height="7" rx="2" fill="currentColor" opacity=".5" />
          <rect x="3" y="14" width="7" height="7" rx="2" fill="currentColor" opacity=".5" />
          <rect x="14" y="14" width="7" height="7" rx="2" fill="currentColor" opacity=".9" />
        </svg>
      );
    case "brainle":
      return (
        <svg {...p}>
          <rect x="3" y="8" width="4.5" height="8" rx="1.4" fill="currentColor" opacity=".9" />
          <rect x="9.7" y="8" width="4.5" height="8" rx="1.4" fill="currentColor" opacity=".55" />
          <rect x="16.4" y="8" width="4.5" height="8" rx="1.4" fill="currentColor" opacity=".9" />
        </svg>
      );
    case "strands":
      return (
        <svg {...p}>
          <path d="M5 6c3 4 11 4 14 0M5 12c3 4 11 4 14 0M5 18c3 4 11 4 14 0" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "forge":
      return (
        <svg {...p}>
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" stroke="currentColor" strokeWidth="1.2" opacity=".4" />
        </svg>
      );
    case "weaver":
      return (
        <svg {...p}>
          <path d="M6 4v16M18 4v16M6 8c6 0 6 8 12 8M6 16c6 0 6-8 12-8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "vault":
      return (
        <svg {...p}>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="2.6" fill="currentColor" />
        </svg>
      );
    case "teasers":
      return (
        <svg {...p}>
          <path d="M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9.5 20h5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "sudoku":
      return (
        <svg {...p}>
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.1" opacity=".5" />
          <path d="M8 4v16M16 4v16M4 8h16M4 16h16" stroke="currentColor" strokeWidth="0.8" opacity=".22" />
        </svg>
      );
    case "sprint":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "pips":
      return (
        <svg {...p}>
          <rect x="3" y="7" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 7v10" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="7.5" cy="12" r="1.3" fill="currentColor" />
          <circle cx="15.2" cy="9.8" r="1.2" fill="currentColor" />
          <circle cx="16.8" cy="14.2" r="1.2" fill="currentColor" />
        </svg>
      );
    case "g2048":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="8" height="8" rx="1.6" fill="currentColor" opacity=".85" />
          <rect x="13" y="3" width="8" height="8" rx="1.6" fill="currentColor" opacity=".4" />
          <rect x="3" y="13" width="8" height="8" rx="1.6" fill="currentColor" opacity=".55" />
          <rect x="13" y="13" width="8" height="8" rx="1.6" fill="currentColor" />
        </svg>
      );
    case "schulte":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="currentColor" strokeWidth="1" opacity=".35" />
        </svg>
      );
    case "simon":
      return (
        <svg {...p}>
          <path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 12a9 9 0 0 1 4.5-7.8" stroke="currentColor" strokeWidth="1.6" opacity=".5" />
          <circle cx="12" cy="12" r="2.4" fill="currentColor" />
        </svg>
      );
    case "slide":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="13.5" y="13.5" width="6" height="6" rx="1" fill="currentColor" opacity=".18" />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="currentColor" strokeWidth="1" opacity=".3" />
        </svg>
      );
    case "reversi":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="9" cy="9" r="2.4" fill="currentColor" />
          <circle cx="15" cy="15" r="2.4" fill="currentColor" opacity=".5" />
          <circle cx="15" cy="9" r="2.4" fill="currentColor" opacity=".35" />
          <circle cx="9" cy="15" r="2.4" fill="currentColor" opacity=".7" />
        </svg>
      );
    default:
      return null;
  }
}

/** The BrainTap hexagon logo mark. */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="btg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00e5ff" />
          <stop offset="1" stopColor="#ff2bd6" />
        </linearGradient>
      </defs>
      <path d="M12 2 L20 7 V17 L12 22 L4 17 V7 Z" fill="none" stroke="url(#btg)" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.4" fill="url(#btg)" />
    </svg>
  );
}
