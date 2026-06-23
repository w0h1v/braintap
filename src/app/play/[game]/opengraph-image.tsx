import { ImageResponse } from "next/og";
import type { GameId } from "@/lib/types";
import { GAME_ORDER, GAME_METAS } from "@/games/_meta";

export const runtime = "edge";
export const alt = "BrainTap Games";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VALID = new Set<string>(GAME_ORDER);

export default function Image({ params }: { params: { game: string } }) {
  const meta = VALID.has(params.game) ? GAME_METAS[params.game as GameId] : null;

  // Graceful fallback for unknown ids — generic BrainTap branding.
  const name = meta?.name ?? "BrainTap Games";
  const category = meta?.category ?? "DAILY BRAIN GAMES";
  const tagline = meta?.tagline ?? "Twenty brain games. One a day.";
  const accentFrom = meta?.accent.from ?? "#00e5ff";
  const accentTo = meta?.accent.to ?? "#ff2bd6";
  const accentSoft = meta?.accent.soft ?? "#9fe9ff";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#03040b",
          position: "relative",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* accent glow tinted to the game */}
        <div
          style={{
            position: "absolute",
            top: -280,
            right: -180,
            width: 720,
            height: 720,
            borderRadius: 9999,
            background: `radial-gradient(closest-side, ${accentFrom}66, ${accentFrom}00)`,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -320,
            left: -200,
            width: 720,
            height: 720,
            borderRadius: 9999,
            background: `radial-gradient(closest-side, ${accentTo}55, ${accentTo}00)`,
            display: "flex",
          }}
        />

        {/* accent hairline */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: `linear-gradient(90deg, ${accentFrom} 0%, ${accentTo} 100%)`,
            display: "flex",
          }}
        />

        {/* header: brand + category */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              color: "#9fe9ff",
              fontSize: 24,
              letterSpacing: 6,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "linear-gradient(135deg, #00e5ff, #ff2bd6)",
                display: "flex",
              }}
            />
            BrainTap Games
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 28px",
              borderRadius: 9999,
              border: `2px solid ${accentFrom}`,
              color: accentSoft,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 4,
            }}
          >
            {category}
          </div>
        </div>

        {/* game name */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 116,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -3,
              background: `linear-gradient(100deg, ${accentFrom} 0%, ${accentTo} 100%)`,
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {name}
          </div>
        </div>

        {/* footer: tagline */}
        <div
          style={{
            display: "flex",
            fontSize: 38,
            fontWeight: 500,
            color: "#cdd6f4",
            maxWidth: 1000,
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    { ...size }
  );
}
