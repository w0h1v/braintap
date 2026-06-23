/**
 * Capacitor shell config (MOB-1).
 *
 * `webDir: "out"` consumes the static export from `npm run build:mobile`.
 * Run `npm run build:mobile` before `npx cap sync` so `out/` is fresh.
 */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "games.braintap.app",
  appName: "BrainTap",
  webDir: "out",
};

export default config;
