# BrainTap — Mobile / Monetization Runbook

Companion to `docs/mobile-monetization-plan.md`. The plan is the *why*; this is
the *how* and, crucially, **what still needs a human + native toolchain** that
could not be done or verified in the implementation environment.

## What's already in the repo (web-inert, verified)

These shipped on the `feat/phase-a-mobile-polish` branch and are **completely
inert on the web build** — the website behaves exactly as before because every
gate checks `adsAvailable()` / `billingAvailable`, both false on web:

- `src/lib/config.ts` — `MonetizationConfig` + defaults (free-hint threshold **2**,
  interstitial every **3rd** transition AND ≤ once / **3 min**, `premiumUnlocksArchive: true`),
  overridable at runtime via `setMonetizationConfig()`.
- `src/lib/entitlement.tsx` — `EntitlementProvider` + `useEntitlement()` (web =
  inert: `isPremium:false`, `billingAvailable:false`, no-op purchase/restore).
  Mounted in `src/app/providers.tsx`.
- `src/lib/ads/index.ts` — ads service: `adsAvailable()`, `showRewardedAd()`,
  `maybeInterstitial()`. Web no-op. `NATIVE_ADS_WIRED = false` is the master switch.
- Interstitial hooks on the three return-to-home navigations: `CompletionModal`
  "Back to today", `GameHost` "← Today", and the post-completion
  "Back to today's puzzles" link (`maybeInterstitial("return-home")`).
- Rewarded-hint gate **reference implementation** in `src/games/sudoku/Sudoku.tsx`
  (`handleHint`) — the pattern to copy to the other hint games.
- `capacitor.config.ts` (scaffold), `next.config.mjs` env-gated static export,
  `npm run build:mobile` script.

## What still needs a human (cannot be done/verified headless)

### 1. Install native deps + create the shells (MOB-1)
```
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor/preferences
npm i @capacitor-community/admob @revenuecat/purchases-capacitor
npx cap init   # appId games.braintap.app, appName BrainTap (already in capacitor.config.ts)
npx cap add ios       # needs macOS + Xcode
npx cap add android   # needs Android Studio / SDK
```
Then re-type `capacitor.config.ts`'s export to `CapacitorConfig` from `@capacitor/cli`.

### 2. Make the static export build (MOB-1) — PARTIALLY DONE
`npm run build:mobile` now runs `scripts/build-mobile.mjs`, which temporarily
moves the export-incompatible web-only files out of the tree, runs the export
(`BUILD_TARGET=mobile` → `output: "export"`), then restores them. The web build
(`npm run build`) is completely unaffected. It already clears the first layer of
blockers by excluding: `src/middleware.ts`, `src/app/auth/callback`, and the four
OG/Twitter image routes (`compiled successfully` past all of those).

REMAINING (a real static-export conversion — needs the mobile-auth + routing
calls; intentionally NOT done autonomously since it changes the live web flow):
- `src/app/play/[game]/page.tsx` reads `searchParams.date` server-side (the
  archive `?date=` param), which `output: "export"` forbids. Refactor so the
  date is read CLIENT-side — have `GameHost` read it via `useSearchParams()`
  instead of the `dateParam` server prop, and move the date-keyed remount
  client-side. This touches the live web archive flow, so re-verify it after.
- Re-run `npm run build:mobile` and resolve any further dynamic-rendering
  blockers it surfaces (the export errors per page, so they appear one layer at
  a time).
- Native auth: the excluded web OAuth callback is replaced by a native
  deep-link flow (the app does not use `/auth/callback`).
Once `out/` builds, `npx cap sync` copies it + plugins into both platforms.

### 3. Wire entitlement to RevenueCat (MON-3)
In `src/lib/entitlement.tsx`, replace the web-inert body with a RevenueCat
integration: configure the SDK (`NEXT_PUBLIC_REVENUECAT_*`), read `CustomerInfo`,
set `isPremium` from the `premium` entitlement, `billingAvailable: true`, and
implement `purchase()` / `restore()`. Cache natively via `@capacitor/preferences`
for a synchronous launch read. Pass the Supabase user id (`useAuth()`) as the
RevenueCat app-user-id when signed in.

### 4. Wire AdMob (MON-1, MON-2)
In `src/lib/ads/index.ts`: implement `showRewardedAd()` (resolve `"rewarded"`
**only** on the reward callback) and the `maybeInterstitial()` body (show an
AdMob interstitial), then set `NATIVE_ADS_WIRED = true`. Configure app + ad-unit
ids (`NEXT_PUBLIC_ADMOB_*`); use test ids first. **Never** add a banner/in-board
surface — the rule is no ads on active game pages.

### 5. Roll the rewarded-hint gate to the remaining games (MON-1)
Mirror the Sudoku reference (`src/games/sudoku/Sudoku.tsx` `handleHint`) in the
other hint games: `slide`, `weaver`, `connections`, `strands`, `forge`, `pips`.
In each `useHint`, before revealing:
```
if (adsAvailable() && !isPremium && hintsUsed >= getMonetizationConfig().freeHintThreshold) {
  if ((await showRewardedAd()) !== "rewarded") return; // no ad → no hint, no penalty
}
```
(Add `const { isPremium } = useEntitlement();` and make the handler async.)
Optionally surface a "Watch ad for hint" label on `HintButton` past the threshold.

### 6. Archive premium gate + Paywall (MON-3) — DEFERRED, not wired
Intentionally **not** wired yet (it needs the Paywall screen + billing, which are
native). To add: in `src/app/archive/page.tsx`, compute
`const gated = billingAvailable && getMonetizationConfig().premiumUnlocksArchive && !isPremium`,
keep the most recent N days free, and render a lock + "Go Premium" CTA (→ new
`src/components/Paywall.tsx`) on older days when `gated`. On web `gated` is false,
so the archive stays fully free. Build `Paywall.tsx` with the RevenueCat offering,
a **Restore Purchases** button (required both stores), and Terms/Privacy links.

### 7. Consent / privacy / store compliance (MOB-3)
- iOS **ATT** prompt if AdMob uses IDFA — at a natural moment, not cold launch.
- Google **UMP** consent for EEA/UK; non-personalized ads on denial.
- Update the privacy policy for AdMob + RevenueCat; complete App Store **App
  Privacy** + Play **Data safety** forms.

### 8. Responsive (MOB-2)
Already audited at 360/390/414 (see prior work); re-verify the rewarded-prompt /
paywall surfaces at those widths once built.

## Product decisions baked in as config defaults (retune in `config.ts`)
- Free-hint threshold: **2** · Interstitial cap: **every 3rd transition AND ≤1/3 min**
  · Premium: **remove ads + unlock archive, subscription** (`premiumUnlocksArchive: true`).
All overridable at runtime via `setMonetizationConfig()` (wire to a remote source).
