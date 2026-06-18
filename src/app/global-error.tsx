"use client";

import { useEffect } from "react";

/**
 * Top-level error boundary. Replaces the root layout when an error escapes it,
 * so it must render its own <html> and <body>. Kept dependency-free and
 * inline-styled (the layout's fonts / Tailwind layer may not be mounted).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== "undefined") console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background:
            "radial-gradient(120% 120% at 50% -10%, #0b0f1f 0%, #03040b 60%)",
          color: "#f3f7ff",
          fontFamily:
            "'Space Grotesk', system-ui, -apple-system, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            textAlign: "center",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            background:
              "linear-gradient(to bottom, rgba(13,21,42,0.6), rgba(8,12,26,0.55))",
            padding: "40px 32px",
            boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11.5,
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: "#ffb3ec",
            }}
          >
            Critical error
          </div>

          <h1
            style={{
              margin: "20px 0 0",
              fontSize: 34,
              lineHeight: 1.05,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              background:
                "linear-gradient(100deg, #00e5ff, #86a3ff 50%, #ff2bd6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            BrainTap hit a snag.
          </h1>

          <p
            style={{
              margin: "20px auto 0",
              maxWidth: 360,
              fontSize: 15,
              lineHeight: 1.6,
              color: "rgba(226,234,255,0.6)",
            }}
          >
            The app ran into an unexpected problem. Reloading usually clears it —
            your saved progress lives safely on this device.
          </p>

          {error?.digest ? (
            <p
              style={{
                marginTop: 16,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10.5,
                letterSpacing: "0.08em",
                color: "rgba(226,234,255,0.3)",
              }}
            >
              ref: {error.digest}
            </p>
          ) : null}

          <div
            style={{
              marginTop: 28,
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                cursor: "pointer",
                border: "none",
                borderRadius: 100,
                padding: "12px 24px",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#03040b",
                background: "linear-gradient(90deg, #00e5ff, #ff2bd6)",
                boxShadow:
                  "0 14px 44px rgba(0,229,255,0.32), 0 6px 24px rgba(255,43,214,0.26)",
              }}
            >
              Reload
            </button>
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 100,
                padding: "12px 24px",
                border: "1px solid rgba(255,255,255,0.08)",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(226,234,255,0.6)",
                textDecoration: "none",
              }}
            >
              Back home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
