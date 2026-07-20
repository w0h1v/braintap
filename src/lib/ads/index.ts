/**
 * Ads service (MON-1 rewarded, MON-2 interstitial) — AdMob via
 * `@capacitor-community/admob`.
 *
 * The WEB build is a complete no-op: `adsAvailable()` is false off-native, so no
 * ad code ever runs on the website and every ad gate is inert. The hard product
 * rule — NO ads on active game pages — is enforced by *what we never call*:
 * there is no banner/in-board surface here at all, only an opt-in rewarded flow
 * and a return-to-home interstitial. The AdMob module is loaded lazily (dynamic
 * import) inside the native-only paths so it never enters the web bundle's
 * execution.
 *
 * Ad-unit ids default to Google's official TEST units so a native build shows
 * test ads out of the box; set BOTH `NEXT_PUBLIC_ADMOB_*` ids to your real
 * units for release — that also switches the SDK off test mode. The native
 * AdMob *app id* must also be set in the iOS Info.plist
 * (`GADApplicationIdentifier`) / Android manifest — see docs/mobile-runbook.md.
 */
import { Capacitor } from "@capacitor/core";
import { getMonetizationConfig } from "@/lib/config";

export type RewardOutcome = "rewarded" | "failed";

/** The native AdMob bridge is implemented; `adsAvailable()` still gates per-platform. */
const NATIVE_ADS_WIRED = true;

/** True only inside a native Capacitor shell. */
export function adsAvailable(): boolean {
  return NATIVE_ADS_WIRED && Capacitor.isNativePlatform();
}

// Google's official test ad units (safe to ship; serve test ads only).
const TEST_REWARDED_IOS = "ca-app-pub-3940256099942544/1712485313";
const TEST_REWARDED_ANDROID = "ca-app-pub-3940256099942544/5224354917";
const TEST_INTERSTITIAL_IOS = "ca-app-pub-3940256099942544/4411468910";
const TEST_INTERSTITIAL_ANDROID = "ca-app-pub-3940256099942544/1033173712";

function rewardedAdId(): string {
  return (
    process.env.NEXT_PUBLIC_ADMOB_REWARDED_ID ||
    (Capacitor.getPlatform() === "ios" ? TEST_REWARDED_IOS : TEST_REWARDED_ANDROID)
  );
}
function interstitialAdId(): string {
  return (
    process.env.NEXT_PUBLIC_ADMOB_INTERSTITIAL_ID ||
    (Capacitor.getPlatform() === "ios" ? TEST_INTERSTITIAL_IOS : TEST_INTERSTITIAL_ANDROID)
  );
}

// Real ad units configured → live traffic; otherwise stay on test mode. This
// makes the release flip a pure env-var change (plus the native app ids).
const REAL_ADS_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_ADMOB_REWARDED_ID && process.env.NEXT_PUBLIC_ADMOB_INTERSTITIAL_ID,
);

/** Initialize the AdMob SDK exactly once per app session. */
let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const { AdMob, AdmobConsentStatus } = await import("@capacitor-community/admob");
      // Google UMP consent (EEA/UK): show the consent form when Google says one
      // is required. The form only exists once a consent message is configured
      // for the app in the AdMob console; until then (and everywhere consent
      // isn't required) this resolves without UI. Failures never block ads init
      // — we serve NON-PERSONALIZED ads only (npa:true per request) and never
      // call ATT, so no tracking prompt fires either way.
      try {
        const consent = await AdMob.requestConsentInfo();
        if (consent.status === AdmobConsentStatus.REQUIRED && consent.isConsentFormAvailable) {
          await AdMob.showConsentForm();
        }
      } catch (e) {
        console.warn("[ads] consent flow failed", e);
      }
      await AdMob.initialize({ initializeForTesting: !REAL_ADS_CONFIGURED });
    })();
  }
  return initPromise;
}

/**
 * Show a rewarded ad. Resolves `"rewarded"` ONLY when AdMob fires its reward
 * callback; no-fill / skip / error / dismiss-without-reward all resolve
 * `"failed"`. The caller grants the reward only on `"rewarded"` (and never
 * penalizes a fail). Web → `"failed"` (callers gate on `adsAvailable()`).
 */
export async function showRewardedAd(): Promise<RewardOutcome> {
  if (!adsAvailable()) return "failed";
  try {
    const { AdMob, RewardAdPluginEvents } = await import("@capacitor-community/admob");
    await ensureInit();
    let rewarded = false;
    const handle = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewarded = true;
    });
    try {
      await AdMob.prepareRewardVideoAd({ adId: rewardedAdId(), npa: true });
      await AdMob.showRewardVideoAd();
    } finally {
      await handle.remove();
    }
    return rewarded ? "rewarded" : "failed";
  } catch (e) {
    console.warn("[ads] rewarded ad failed", e);
    return "failed";
  }
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
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    await ensureInit();
    await AdMob.prepareInterstitial({ adId: interstitialAdId(), npa: true });
    await AdMob.showInterstitial();
  } catch (e) {
    console.warn("[ads] interstitial failed", e);
  }
}
