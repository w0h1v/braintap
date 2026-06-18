import type { Config } from "tailwindcss";

/**
 * BrainTap design tokens, distilled from the prototype.
 * Aesthetic: deep-space dark, neon cyan/magenta, glassmorphism.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/games/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#03040b",
          soft: "#06080f",
          raise: "#0b0f1f",
        },
        ink: {
          DEFAULT: "#f3f7ff",
          soft: "rgba(226,234,255,0.6)",
          mute: "rgba(226,234,255,0.45)",
          faint: "rgba(226,234,255,0.3)",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.14)",
        },
        // accents
        cyan: { DEFAULT: "#00e5ff", soft: "#9fe9ff" },
        magenta: { DEFAULT: "#ff2bd6", soft: "#ffb3ec" },
        peri: { DEFAULT: "#86a3ff", soft: "#b3c2ff" },
        amber: { DEFAULT: "#ffb020", soft: "#ffcf7a" },
        mint: { DEFAULT: "#7CF5C4", soft: "#9bf7d3" },
        violet: { DEFAULT: "#9b8cff", soft: "#c3b8ff" },
        orange: { DEFAULT: "#ff9e3d", soft: "#ffc58a" },
      },
      fontFamily: {
        display: ['var(--font-grotesk)', "Space Grotesk", "system-ui", "sans-serif"],
        mono: ['var(--font-mono)', "JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        pill: "100px",
      },
      boxShadow: {
        "glow-cyan": "0 0 22px rgba(0,229,255,0.18)",
        "glow-magenta": "0 0 22px rgba(255,43,214,0.18)",
        "btn": "0 14px 44px rgba(0,229,255,0.32), 0 6px 24px rgba(255,43,214,0.26)",
        "card": "0 18px 50px rgba(0,0,0,0.45)",
      },
      keyframes: {
        btPulse: {
          "0%,100%": { opacity: "0.4", transform: "scale(0.85)" },
          "50%": { opacity: "1", transform: "scale(1.2)" },
        },
        btRise: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        btPop: {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "60%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        btFlip: {
          "0%": { transform: "rotateX(0)" },
          "50%": { transform: "rotateX(90deg)" },
          "100%": { transform: "rotateX(0)" },
        },
        btShake: {
          "10%,90%": { transform: "translateX(-2px)" },
          "20%,80%": { transform: "translateX(4px)" },
          "30%,50%,70%": { transform: "translateX(-7px)" },
          "40%,60%": { transform: "translateX(7px)" },
        },
        btSolve: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)" },
        },
        btFloaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-7px)" },
        },
      },
      animation: {
        pulse2: "btPulse 2.4s ease-in-out infinite",
        rise: "btRise 0.7s cubic-bezier(.2,.7,.2,1) both",
        pop: "btPop 0.35s cubic-bezier(.2,.7,.2,1) both",
        flip: "btFlip 0.6s ease",
        shake: "btShake 0.5s",
        solve: "btSolve 0.5s ease",
        floaty: "btFloaty 4s ease-in-out infinite",
      },
      maxWidth: {
        shell: "1120px",
      },
    },
  },
  plugins: [],
};

export default config;
