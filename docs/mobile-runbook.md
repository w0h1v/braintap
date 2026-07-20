# BrainTap — Mobile / Monetization Runbook

Companion to `docs/mobile-monetization-plan.md` (the *why*). This is the *how*
and the **current state**: the native shell + both monetization bridges are
implemented and on `main`; what remains is store/account work that needs a human.

The whole layer is **web-inert** — every gate checks
`Capacitor.isNativePlatform()` / `adsAvailable()` / `billingAvailable`, all false
on the website, so `braintap.vercel.app` behaves exactly as before.

## Implemented (on `main`, web-inert)

- **Native iOS Capacitor shell** in `ios/` (Capacitor 8, **Swift Package
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
  web OAuth callback is excluded, **native auth uses id-token sign-in** (below),
  not the web redirect flow.
- **Native auth** (`feat/auth-siwa-launch-prep`, PR #12): **Sign in with Apple +
  Google**, both native on iOS via `@capgo/capacitor-social-login` →
  `supabase.auth.signInWithIdToken` with nonce handling
  (`src/lib/native/{nonce,socialLogin,exchange}.ts`). `auth.tsx` branches on
  `Capacitor.isNativePlatform()`; web OAuth-redirect path unchanged. SIWA is
  required by Guideline 4.8 because a Google login button ships. Console/Xcode
  setup (Apple Services ID + key, Google OAuth clients, SIWA capability, Supabase
  providers) is in the PR #12 handoff.
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

### Store-compliance sprint (2026-07-07, `feat/store-compliance`)

- **In-app account deletion** (Guideline 5.1.1(v)): edge function
  `supabase/functions/delete-account` (verifies the caller's JWT, calls
  `auth.admin.deleteUser`; profiles/game_results cascade) + a confirm-to-delete
  flow on the Profile page (`useAuth().deleteAccount`).
- **UGC moderation** (Guideline 1.2): migration `0005_ugc_compliance.sql` —
  charset + profanity check on usernames (`is_username_allowed`, NOT VALID
  constraint, `handle_new_user` falls back to `player_xxxxxx`), plus a
  `report_leaderboard_name` RPC + `leaderboard_reports` table. Client twin in
  `src/lib/username.ts` (signup validation) and a ⚑ report button on
  leaderboard rows. **Keep the two blocklists in sync.**
- **Support contact**: `src/lib/support.ts` → **support@braintap.app** on the
  privacy + terms pages (set up this mailbox before submission).
- **UMP consent (EEA/UK)**: `requestConsentInfo`/`showConsentForm` run before
  `AdMob.initialize` in `src/lib/ads/index.ts`. The form only appears once a
  consent *message* is configured for the app in the AdMob console — that part
  is still human work.
- **Ads test-mode flip is now automatic**: `initializeForTesting` is true only
  while the `NEXT_PUBLIC_ADMOB_*` ids are unset — setting both real ids IS the
  release flip (no code change).
- **iOS shell**: `App/App.entitlements` with the **Sign in with Apple**
  capability (wired via `CODE_SIGN_ENTITLEMENTS`); **iPhone-only**
  (`TARGETED_DEVICE_FAMILY = 1`) and **portrait-only**; full Google
  SKAdNetworkItems list; `ITSAppUsesNonExemptEncryption=false`. AppIcon/Splash
  PNGs are now exempt from the root `*.png` gitignore and committed.
- `npm run sync:ios` = `build:mobile` + `cap sync ios` — always run before
  archiving so the bundled web assets aren't stale.

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

0. **Native auth (Sign in with Apple + Google).** Apple Developer: enable SIWA on
   the App ID, create a Services ID + `.p8` key. Google Cloud: iOS + web OAuth
   clients. Xcode: set the **team/signing** and fill in the real
   reversed-client-id URL scheme in `Info.plist` (the SIWA entitlement file is
   already wired). Supabase: enable Apple + Google providers (authorized client
   ids). Set `NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `_WEB_CLIENT_ID`. Full ordered
   steps in PR #12.
1. **Real store apps + products + public SDK keys.** Add a real **iOS app** and
   **Android app** to the RevenueCat project (this generates the public
   `appl_…` / `goog_…` SDK keys → set `NEXT_PUBLIC_REVENUECAT_*`). Create the
   matching **non-consumable `lifetime` IAP** in App Store Connect / Play Console
   and attach it to `Braintap Pro` + the `default` offering. (Needs Apple $99/yr +
   Google $25 accounts.)
2. **Real AdMob ids.** Create the app + a **rewarded** and **interstitial** unit
   in AdMob; set `NEXT_PUBLIC_ADMOB_*` and the real `GADApplicationIdentifier`
   (iOS) / Android manifest app id. Test units are wired meanwhile (and test
   mode switches off automatically once both env ids are set). Also configure a
   **UMP consent message** for the app in the AdMob console — the client code
   already shows it when required.
3. **Android shell — GENERATED (2026-07-20).** `android/` is in the repo:
   builds with Android Studio's bundled JBR
   (`JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug`),
   verified running on the Pixel 9 emulator (brand launcher icons + splash,
   portrait-locked, test AdMob app id in the manifest). `npm run sync:android`
   before building. Still needed for Play: a release **keystore**, Play Console
   account ($25), real AdMob/RevenueCat Android ids, Data safety form, and
   note Google's 12-tester/14-day closed-testing requirement for new personal
   accounts. NB: the empty-RevenueCat-key crash on Android was fixed in
   `src/lib/entitlement.tsx` (skip configure + `billingAvailable=false` when
   the platform key is unset).
4. **On-device test.** Open `ios/App/App.xcodeproj` in Xcode → run on a
   simulator/device, then exercise the flows by hand: Archive → a locked day →
   Paywall → purchase (StoreKit/Test Store sheet); use hints past the free
   threshold → a test rewarded ad. Requires Apple code-signing for a real device.
5. **Consent / privacy / store compliance.** We ship **non-personalized ads (no
   ATT prompt)** — no `NSUserTrackingUsageDescription`, `npa:true` per request,
   and a `PrivacyInfo.xcprivacy` with `NSPrivacyTracking=false`. The UMP consent
   *code* is implemented (see sprint above); the consent *message* must be
   configured in the AdMob console. Complete App Store **App Privacy** (email +
   user id + gameplay, Linked, NOT tracking) + Play **Data safety** forms, and
   set up the **support@braintap.app** mailbox referenced by the policy pages.
6. **Responsive** — the 20 games were visually inspected at iPhone width (393px)
   and render cleanly; re-check the paywall / rewarded-ad surfaces once they're
   testable on device.

## Product decisions baked in as config defaults (retune in `config.ts`)
- Free-hint threshold **2** · interstitial **every 3rd transition AND ≤1/3 min**
  · premium = **remove ads + unlock archive**.
- The remove-ads purchase is a **one-time lifetime unlock** (non-consumable) —
  confirmed with the user (2026-06-24), not a subscription.
- Ads are **non-personalized, no ATT prompt** — confirmed 2026-06-24.
