/**
 * Ads service (MON-1 rewarded, MON-2 interstitial).
 *
 * The WEB build is a complete no-op: `adsAvailable()` is false, so no ad code
 * ever runs on the website and every ad gate is inert. The hard product rule —
 * NO ads on active game pages — is enforced by *what we never call*: there is
 * no banner/in-board surface here at all, only an opt-in rewarded flow and a
 * transition interstitial.
 *
 * A native (Capacitor + AdMob) build flips `NATIVE_ADS_WIRED` and fills in the
 * two impl bodies — see docs/mobile-runbook.md.
 */
import { getMonetizationConfig } from "@/lib/config";

export type RewardOutcome = "rewarded" | "failed";

/**
 * Flipped to `true` by the native build once the AdMob bridge is implemented.
 * Until then every gate that checks `adsAvailable()` stays inert (web + native).
 */
const NATIVE_ADS_WIRED = false;

/** True only inside a native Capacitor shell with the ads SDK wired. */
export function adsAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  return NATIVE_ADS_WIRED && Boolean(cap?.isNativePlatform?.());
}

/**
 * Show a rewarded ad. Resolves `"rewarded"` ONLY on the SDK's reward callback;
 * no-fill / skip / error / dismiss-without-reward all resolve `"failed"`. The
 * caller grants the reward only on `"rewarded"` (and never penalizes a fail).
 * Web → `"failed"` (there is no ad to show; callers gate on `adsAvailable()`).
 */
export async function showRewardedAd(): Promise<RewardOutcome> {
  if (!adsAvailable()) return "failed";
  // Native impl: load + show AdMob rewarded; resolve "rewarded" on reward only.
  return "failed";
}

// --- interstitial frequency state (per app session) ---
let transitionCount = 0;
let lastShownMs = 0;

/**
 * Maybe show an interstitial when the player leaves the board for home, AFTER
 * the completion modal is dismissed — never during active play on the board
 * itself, never at launch. Frequency-capped per config. No-op on web and
 * whenever a cap blocks it. Premium is checked at the call-site. (Only
 * "return-home" is wired today; the param is kept for future transition kinds.)
 */
export async function maybeInterstitial(reason: "return-home"): Promise<void> {
  void reason;
  if (!adsAvailable()) return; // web → never
  const cfg = getMonetizationConfig();
  transitionCount += 1;
  if (transitionCount % cfg.interstitialEveryNTransitions !== 0) return;
  const now = Date.now();
  if (now - lastShownMs < cfg.interstitialMinMinutes * 60_000) return;
  lastShownMs = now;
  // Native impl: show an AdMob interstitial here.
}
