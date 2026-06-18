import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BrainTap Games — fifteen brain games, one a day";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          background: "#03040b",
          position: "relative",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* neon corner glows */}
        <div
          style={{
            position: "absolute",
            top: -260,
            right: -200,
            width: 640,
            height: 640,
            borderRadius: 9999,
            background:
              "radial-gradient(closest-side, rgba(0,229,255,0.45), rgba(0,229,255,0))",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -300,
            left: -220,
            width: 700,
            height: 700,
            borderRadius: 9999,
            background:
              "radial-gradient(closest-side, rgba(255,43,214,0.40), rgba(255,43,214,0))",
            display: "flex",
          }}
        />

        {/* top gradient hairline */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: "linear-gradient(90deg, #00e5ff 0%, #7b8cff 50%, #ff2bd6 100%)",
            display: "flex",
          }}
        />

        {/* eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#9fe9ff",
            fontSize: 26,
            letterSpacing: 8,
            fontWeight: 600,
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, #00e5ff, #ff2bd6)",
              display: "flex",
            }}
          />
          Daily Brain Training
        </div>

        {/* wordmark */}
        <div
          style={{
            display: "flex",
            fontSize: 132,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: -4,
            background: "linear-gradient(100deg, #00e5ff 0%, #7b8cff 45%, #ff2bd6 100%)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: 28,
          }}
        >
          BRAINTAP GAMES
        </div>

        {/* tagline */}
        <div
          style={{
            display: "flex",
            fontSize: 44,
            fontWeight: 500,
            color: "#e6ecff",
          }}
        >
          Fifteen brain games. One a day.
        </div>
      </div>
    ),
    { ...size }
  );
}
