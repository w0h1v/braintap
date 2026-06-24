# BrainTap — Mobile / Monetization Runbook

Companion to `docs/mobile-monetization-plan.md` (the *why*). This is the *how*
and the **current state**: the native shell + both monetization bridges are
implemented and on `main`; what remains is store/account work that needs a human.

The whole layer is **web-inert** — every gate checks
`Capacitor.isNativePlatform()` / `adsAvailable()` / `billingAvailable`, all false
on the website, so `braintap.vercel.app` behaves exactly as before.

## Implemented (on `main`, web-inert)

- **Native iOS Capacitor shell** in `ios/` (Capacitor 7, **Swift Package
  Manager** — no CocoaPods). `npm run build:mobile` → `out/`, then
  `npx cap sync ios`. **Verified**: `xcodebuild ... BUILD SUCCEEDED` and the app
  **launches in the iOS simulator**; both plugins resolve via SPM
  (`@revenuecat/purchases-capacitor@13.2.0` → `purchases-ios 5.78.0`;
  `@capacitor-community/admob@8.0.0` → `GoogleMobileAds 12.14.0`). `Package.resolved`
  pins the graph. `capacitor.config.ts` is typed (`webDir: "out"`).
- **Static export** (`scripts/build-mobile.mjs`): temporarily moves the
  export-incompatible web-only files out (`src/middleware.ts`,
  `src/app/auth/callback`, the four OG/Twitter image routes), runs
  `BUILD_TARGET=mobile` (`output: "export"`), restores them. Produces a complete
  `out/` (35 pages). The web build (`npm run build`) is unaffected. Because the
  web OAuth callback is excluded, mobile auth must use a native deep-link flow.
- **RevenueCat** wired in `src/lib/entitlement.tsx`: configures the SDK with the
  per-platform public key (`NEXT_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`),
  reads `CustomerInfo`, sets `isPremium` from the **`Braintap Pro`** entitlement,
  `purchase()` buys the current offering's lifetime package, `restore()`,
  customer-info listener, Supabase user id (`useAuth()`) as app-user-id.
- **AdMob** wired in `src/lib/ads/index.ts`, **`NATIVE_ADS_WIRED = true`**:
  `showRewardedAd()` resolves `"rewarded"` only on AdMob's reward callback;
  `maybeInterstitial()` shows a return-to-home interstitial (frequency-capped).
  Plugin dynamic-imported in native-only paths. Defaults to Google **test** ad
  units (`NEXT_PUBLIC_ADMOB_REWARDED_ID` / `_INTERSTITIAL_ID` to override). **No
  banner / in-board surface** — no ads on active game pages. iOS `Info.plist`
  carries a test `GADApplicationIdentifier`.
- **Rewarded-hint gate** live in all 7 hint games (`sudoku`, `slide`, `weaver`,
  `connections`, `strands`, `forge`, `pips`).
- **Archive premium gate + `src/components/Paywall.tsx`** (purchase / Restore /
  Terms+Privacy): `archive/page.tsx` keeps the last 7 days free and locks older
  days when gated. Inert on web (`billingAvailable` false → archive fully free).
- `src/lib/config.ts` — `MonetizationConfig` defaults (free-hint threshold **2**,
  interstitial every **3rd** transition AND ≤ once / **3 min**,
  `premiumUnlocksArchive: true`), retunable via `setMonetizationConfig()`.

### RevenueCat catalog — configured (Test Store only)

Project **Braintap** (`proj32ced423`), verified via the v2 API. The chain is
coherent (a purchase grants the entitlement):

| Thing | Value |
| --- | --- |
| Entitlement (app checks this) | **`Braintap Pro`** |
| Offering | **`default`** → **Lifetime** package (`$rc_lifetime`) → product `lifetime` |
| Product model | one-time **`lifetime`** unlock — **NOT a subscription** (confirm intent) |
| Apps | only RevenueCat's built-in **Test Store** so far |

The v2 secret key lives in `.env.local` (gitignored); public SDK keys come from
real apps (below).

## Remaining to launch (human + accounts — not doable headless)

1. **Real store apps + products + public SDK keys.** Add a real **iOS app** and
   **Android app** to the RevenueCat project (this generates the public
   `appl_…` / `goog_…` SDK keys → set `NEXT_PUBLIC_REVENUECAT_*`). Create the
   matching **subscription/IAP products** in App Store Connect / Play Console and
   attach them to `Braintap Pro` + the `default` offering. (Needs Apple $99/yr +
   Google $25 accounts.)
2. **Real AdMob ids.** Create the app + a **rewarded** and **interstitial** unit
   in AdMob; set `NEXT_PUBLIC_ADMOB_*` and the real `GADApplicationIdentifier`
   (iOS) / Android manifest app id. Test units are wired meanwhile.
3. **Android shell.** `cap add android` needs a **JDK** (not installed on the
   build machine). Install a JDK + Android Studio, then `npx cap add android` →
   `npm run build:mobile && npx cap sync android`.
4. **On-device test.** Open `ios/App/App.xcodeproj` in Xcode → run on a
   simulator/device, then exercise the flows by hand: Archive → a locked day →
   Paywall → purchase (StoreKit/Test Store sheet); use hints past the free
   threshold → a test rewarded ad. Requires Apple code-signing for a real device.
5. **Consent / privacy / store compliance.** iOS **ATT** prompt (call
   `AdMob.requestTrackingAuthorization()` at a natural moment, not cold launch);
   Google **UMP** consent for EEA/UK; update the privacy policy for AdMob +
   RevenueCat; complete App Store **App Privacy** + Play **Data safety** forms.
6. **Responsive** — the 20 games were visually inspected at iPhone width (393px)
   and render cleanly; re-check the paywall / rewarded-ad surfaces once they're
   testable on device.

## Product decisions baked in as config defaults (retune in `config.ts`)
- Free-hint threshold **2** · interstitial **every 3rd transition AND ≤1/3 min**
  · premium = **remove ads + unlock archive**.
- ⚠️ The live RevenueCat product is a **one-time lifetime unlock**, not the
  subscription the original plan assumed — decide which you want before creating
  the real store products.
