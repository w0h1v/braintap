/**
 * Capacitor shell config (MOB-1).
 *
 * NOTE: the Capacitor deps + native toolchain are NOT installed in this repo
 * yet — this file is the scaffold. See docs/mobile-runbook.md for the exact
 * `npm install` + `npx cap add ios/android` steps. It is typed loosely on
 * purpose so the repo type-checks without `@capacitor/cli` present; re-type the
 * export to `CapacitorConfig` from "@capacitor/cli" once that's installed.
 *
 * `webDir: "out"` consumes the static export from `npm run build:mobile`.
 */
const config = {
  appId: "games.braintap.app",
  appName: "BrainTap",
  webDir: "out",
};

export default config;
