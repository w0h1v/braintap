/**
 * Monetization + ads tuning (MON-1 / MON-2 / MON-3).
 *
 * Defaults ship safe and the app is fully correct on these alone. A remote
 * source (a Supabase row, or AdMob/RevenueCat remote config) can override them
 * at launch — and afterwards — WITHOUT an app release, by calling
 * `setMonetizationConfig()` once at startup. Values chosen per the plan in
 * docs/mobile-monetization-plan.md and confirmed as the launch defaults.
 */
export interface MonetizationConfig {
  /** MON-1 — free hints before a rewarded ad is required (rec. 2). */
  freeHintThreshold: number;
  /** MON-2 — show an interstitial only every Nth qualifying transition (rec. 3). */
  interstitialEveryNTransitions: number;
  /** MON-2 — and never more than once per this many minutes (rec. 3). */
  interstitialMinMinutes: number;
  /** MON-3 — premium also unlocks the full /archive (rec. true; reversible). */
  premiumUnlocksArchive: boolean;
}

export const DEFAULT_CONFIG: MonetizationConfig = {
  freeHintThreshold: 2,
  interstitialEveryNTransitions: 3,
  interstitialMinMinutes: 3,
  premiumUnlocksArchive: true,
};

let current: MonetizationConfig = { ...DEFAULT_CONFIG };

/** The live config (defaults unless a remote source has overridden it). */
export function getMonetizationConfig(): MonetizationConfig {
  return current;
}

/**
 * Merge a remote/partial override over the defaults (call once at startup).
 * Intentionally unwired today — the native build (or a remote-config source)
 * calls this; `premiumUnlocksArchive` is likewise read only by the deferred
 * archive gate (see docs/mobile-runbook.md). Extension points, not dead code.
 */
export function setMonetizationConfig(patch: Partial<MonetizationConfig>): void {
  current = { ...current, ...patch };
}
