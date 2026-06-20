# BrainTap — Native Mobile + Monetization Implementation Plan

- Status: PLAN ONLY (no code, no installs, no new dependencies)
- Audience: engineering + product
- Date: 2026-06-19
- Source of truth: QA/handoff requirements (`MOB-1`, `MON-1`, `MON-2`, `MON-3`, `MOB-2`, `MOB-3`) — cited inline.

---

## 1. Executive summary

BrainTap is a Next.js 14 (app-router) / React 18 / Zustand / Supabase / Tailwind web app with PWA
metadata already in place (`src/app/layout.tsx`, `public/manifest.webmanifest`). The goal is to ship it
as native iOS + Android apps with a free, ad-supported tier and a paid ad-removal option — without
forking the codebase or rewriting the games.

**Recommendation: wrap the existing web app with Capacitor (`MOB-1`).** One codebase continues to power
web and both stores; the native shell exposes the two capabilities the web cannot provide — an ads SDK and
native billing — through thin JS bridges. We add a small client-side **entitlement + config + ads service
layer** and gate it at exactly the points the product rules require.

### Hard product rule (applies everywhere)

> **NO ads on active game pages. Ads only at transitions + opt-in rewarded placements.**

This is non-negotiable and shapes every ad decision below. There are **no banners, no in-board ads, no
auto-playing interstitials mid-puzzle**. The only ad surfaces are: (a) an opt-in **rewarded** video the
player explicitly taps to earn an extra hint (`MON-1`), and (b) an **interstitial** shown *between* games or
on return-to-home, *after* the completion payoff, frequency-capped (`MON-2`).

### Recommended stack

| Concern | Recommendation | Alternatives considered |
| --- | --- | --- |
| Native delivery (`MOB-1`) | **Capacitor** (wrap existing web build) | React Native / Expo rewrite (rejected: full reimplementation of 15 games); Trusted Web Activity + iOS WKWebView hand-roll (rejected: reinvents Capacitor's bridge, plugin ecosystem, and store tooling); keep PWA-only (rejected: no native billing, weak iOS install, no store distribution) |
| Ads (`MON-1`, `MON-2`) | **Google AdMob** via the official Capacitor community plugin (`@capacitor-community/admob`) — rewarded + interstitial only | AppLovin MAX / ironSource mediation (more yield, more SDK weight + compliance surface — revisit post-launch); Meta Audience Network (declining iOS fill). Mediation can be layered on later behind the same ads service interface. |
| Billing / entitlement (`MON-3`) | **RevenueCat** over StoreKit 2 (iOS) + Google Play Billing (Android) | Raw StoreKit + Play Billing via `@capacitor-community` IAP plugins (no server-side entitlement, you build receipt validation + restore + cross-platform reconciliation yourself). RevenueCat trade-off: a third-party dependency and a revenue-share tier, bought in exchange for receipt validation, restore-purchases, entitlement caching, and a single cross-platform `Entitlement` abstraction. For a solo/small team this is the right buy. |
| Config / thresholds | **Remote config** (Supabase table or RevenueCat/AdMob remote config) read at launch, cached, with hardcoded safe defaults | Hardcoded constants (rejected by `MON-1`/`MON-2`: thresholds must be server/config-driven). |

**Net new dependencies (deferred — do not install as part of this plan):** `@capacitor/core`,
`@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`, `@capacitor-community/admob`, RevenueCat's
Capacitor SDK (`@revenuecat/purchases-capacitor`), a Capacitor preferences plugin
(`@capacitor/preferences`) for native-side persistence of the entitlement cache.

---

## 2. Grounding: what the repo looks like today

Confirmed by reading the repo (no code modified):

- **No native, ad, or IAP dependencies exist yet.** `package.json` deps are `@supabase/ssr`,
  `@supabase/supabase-js`, `next@14.2.15`, `react@18.3.1`, `react-dom`, `zustand@4.5.5`. Dev deps include
  Playwright (`@playwright/test@^1.49.1`) — already wired (`npm run test:e2e`).
- **Next.js runs in server mode**, not static export. `next.config.mjs` has no `output: "export"`;
  scripts are `next dev` / `next build` / `next start`. The app uses `next/font/google`
  (`src/app/layout.tsx`), dynamic routes (`src/app/play/[game]/page.tsx`), and dynamic OG/Twitter image
  routes (`src/app/play/[game]/opengraph-image.tsx`, `twitter-image.tsx`). **This is the single biggest
  `MOB-1` decision** — see §4 Phase 0.
- **PWA metadata present**: `src/app/layout.tsx` sets `manifest: "/manifest.webmanifest"`,
  `appleWebApp.capable`, and `other: { "mobile-web-app-capable": "yes" }`. The manifest
  (`public/manifest.webmanifest`) is `display: standalone`, `orientation: portrait`, themed `#03040b`.
- **Guest/streak state is Zustand + `localStorage`** via `persist` in `src/lib/progress.ts`
  (store name `braintap-progress-v1`, `createJSONStorage(() => localStorage)`, explicit `partialize` over
  `settings/onboarded/results/tierResults/states/tierStates/currentStreak/longestStreak/lastPlayedISO`).
  No entitlement is stored today.
- **Hint system** (drives `MON-1`):
  - Shared, presentational trigger: `src/components/play/HintButton.tsx` (props `used`, `max`, `onHint`,
    `accent`, `disabled`). It renders `left = max - used` and disables itself when `out`. It owns **no
    logic** — the comment says "Games own the hint *logic*".
  - Per-difficulty budget: `src/games/strands/engine.ts` exports
    `MAX_HINTS_BY_DIFFICULTY = { easy: 3, medium: 1, hard: 0 }`, consumed by
    `src/games/strands/generator.ts` and baked into each puzzle as `puzzle.maxHints`.
  - In-game gate: `src/games/strands/Strands.tsx` reads `const maxHints = puzzle.maxHints ?? DEFAULT_MAX_HINTS`
    (`DEFAULT_MAX_HINTS = 2`), tracks `hintsUsed` in state, and the actual spend is guarded in
    `useHint()`: `if (won || hintsUsed >= maxHints) return;`. The button is rendered only when
    `maxHints > 0` (hard tier shows no button at all).
  - The **same pattern recurs** across games that use hints: `slide`, `sudoku`, `weaver`, `connections`,
    `strands`, `forge`, `pips` all import `HintButton`. This is the surface area `MON-1` must cover.
- **Tiers / completion flow**: `src/components/play/GameHost.tsx` owns difficulty tabs (`easy/medium/hard`
  from `src/lib/difficulty.ts`), the per-tier timer, solve-to-unlock, and `onComplete`. The completion
  payoff is `src/components/play/CompletionModal.tsx` (share text, share image, "next tier" CTA,
  "Back to today"). **Interstitials must never cover this modal (`MON-2`).**
- **Archive** (`MON-3` scope): `src/app/archive/page.tsx` renders the last 60 days
  (`DAYS_BACK = 60`) as a grid of dates, each linking to `/play/[game]?date=<iso>`. Archive plays are
  flagged as not affecting the streak (`isArchive` in `GameHost.tsx`). Today the entire archive is free.
- **Config / feature flags today**: there is **no config module**. The only runtime configuration is
  public env vars (`.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SITE_URL`). `MON-1`/`MON-2` thresholds therefore need a **new config layer** (§3).
- **Auth**: `src/lib/auth.tsx` exposes `useAuth()` with a Supabase `user | null` (guest by default). This
  is the natural anchor for associating a RevenueCat app-user-id when signed in.
- **Dense boards to verify (`MOB-2`)**: Mind Strands is **6×8** (`src/games/strands/engine.ts`:
  `COLS = 6`, `ROWS = 8`); Reversi is **8×8** (`src/games/reversi/engine.ts`, columns `a–h`). Connections
  is already flagged in `docs/qa-report.md` for tile overflow on mobile.

---

## 3. Architecture: where the new layer lives

Three new client-only modules, all under `src/lib/` alongside the existing helpers, plus a handful of
gate edits in components that already exist. No game engine logic changes.

```
src/lib/
  config.ts        # NEW — remote+default config: thresholds, frequency caps, premium scope flags
  entitlement.tsx  # NEW — useEntitlement(): { isPremium, restore(), purchase(), loading }
  ads/
    index.ts       # NEW — ads service: rewarded() -> Promise<"rewarded"|"failed">, maybeInterstitial(reason)
    native.ts      # NEW — AdMob bridge impl (Capacitor)
    web.ts         # NEW — no-op/dev impl (web build shows nothing; ads are native-only)
```

### 3.1 `config.ts` — server/config-driven thresholds (`MON-1`, `MON-2`)

Single source for every tunable number, with **hardcoded safe defaults** so the app is correct even if the
remote fetch fails. Fetched once at launch (Supabase row or RevenueCat/AdMob remote config), cached in
memory, never blocks first render.

```
interface MonetizationConfig {
  freeHintThreshold: number;        // MON-1, default 2 — hints beyond this require a rewarded ad
  interstitialEveryNTransitions: number; // MON-2, default 3
  interstitialMinMinutes: number;   // MON-2, default 3 (per-X-minutes cap)
  premiumUnlocksArchive: boolean;   // MON-3, default true
}
```

### 3.2 `entitlement.tsx` — `useEntitlement()` (`MON-3`)

A React context/provider wrapping the app (mounted in `src/app/providers.tsx`, next to `AuthProvider`).
Exposes:

- `isPremium: boolean` — true if RevenueCat reports the `premium` entitlement active. On web (no native
  billing) this is always `false` unless we later add a web entitlement source.
- `loading: boolean`, `purchase(): Promise<...>`, `restore(): Promise<...>` (restore-purchases is required
  on **both** platforms by `MON-3` and by store policy).
- The entitlement is cached natively (`@capacitor/preferences`) so the gates have a synchronous answer at
  launch and don't flicker. RevenueCat refreshes it in the background.
- When a Supabase `user` exists (`useAuth()`), pass its id as the RevenueCat app-user-id so premium follows
  the account across devices; otherwise use RevenueCat's anonymous id (still restorable via the store
  account).

### 3.3 `ads/index.ts` — ads service (`MON-1`, `MON-2`)

Platform-agnostic interface; native impl uses AdMob, web impl is a no-op.

- `rewarded(): Promise<"rewarded" | "failed">` — loads + shows a rewarded ad. **Resolves `"rewarded"`
  only on the SDK's reward callback.** No-fill / skip / error / dismiss-without-reward all resolve
  `"failed"`. This is the contract that makes `MON-1` correct: the caller grants the hint **only** on
  `"rewarded"`.
- `maybeInterstitial(reason: "next-game" | "return-home"): Promise<void>` — internally consults `config.ts`
  caps + a transition counter + a `lastShownAt` timestamp (persisted), checks `isPremium`, and shows an
  interstitial only if all gates pass. No-ops otherwise (`MON-2`). Never called at launch or first action.

### 3.4 Gating points (real files)

| Gate | File | Change |
| --- | --- | --- |
| `MON-1` rewarded hint | `src/components/play/HintButton.tsx` + each game's `useHint()` (e.g. `src/games/strands/Strands.tsx:176`) | When `hintsUsed >= freeHintThreshold` (config) **and** `hintsUsed < maxHints` **and** not premium, the next hint requires a rewarded ad. See §5. |
| `MON-2` interstitial | `src/components/play/CompletionModal.tsx` (on `onClose` / "Back to today") and the inter-game nav back to `/` | `await maybeInterstitial("return-home")` fires **after** the modal closes — never over it. |
| `MON-3` premium check | `useEntitlement()` consumed at both gates above | Premium bypasses the hint gate and the interstitial entirely. |
| `MON-3` archive unlock | `src/app/archive/page.tsx` + `src/components/play/GameHost.tsx` (`isArchive`) | If `premiumUnlocksArchive`, gate archive dates behind `isPremium`; free users see a paywall/upsell card instead of the date links. |

---

## 4. Phased roadmap

Each phase lists concrete tasks and the repo files/modules it touches. Phases are independently shippable
to TestFlight / internal track.

### Phase 0 — Capacitor shell (`MOB-1`)

Goal: the existing app runs inside native iOS + Android wrappers with state intact, **no monetization yet**.

**The Next.js build-mode decision (the crux of `MOB-1`).** Capacitor loads a *web build* it serves from
the device (`capacitor://` / `https://localhost`). It does not run a Node server. The app today is in
**server mode** and uses server-only features (dynamic OG image routes, server components, `next/font`
fetched at build). Two viable approaches:

- **Option A — Static export (`output: "export"`).** Convert the app to a fully static export and bundle
  the `out/` directory as Capacitor's `webDir`. Cleanest offline behavior, no network needed for the shell.
  Cost: must make every route statically exportable — `generateStaticParams` for `/play/[game]`, drop or
  pre-render the dynamic OG/Twitter image routes (they're only for web link previews, irrelevant inside the
  app), confirm `next/font` works in export (it does, fonts are inlined at build). The games are already
  client components driven by deterministic daily seeds, so the gameplay needs no server. **Recommended.**
- **Option B — Remote URL (`server.url` points at `braintap.vercel.app`).** Capacitor loads the live Vercel
  deployment; the wrapper is a thin shell over the hosted server-mode app. Fastest to stand up and keeps
  server features. Cost: the app *requires* network to launch (bad for a "one puzzle a day" offline-capable
  feel), Apple review sometimes scrutinizes "just a website" wrappers, and native plugins must be injected
  into a remote origin. **Use only as a stopgap** for an early TestFlight while Option A is finished.

> Recommendation: **Option A (static export)** as the shipping configuration; the games and progress are
> already client-side and seed-driven, so static export is a natural fit. Supabase calls remain client-side
> network calls (already the case via `@supabase/ssr` client). Use Option B only to unblock an early build.

Tasks:

1. Add `capacitor.config.ts` at repo root: `appId` (e.g. `games.braintap.app`), `appName "BrainTap"`,
   `webDir: "out"` (Option A), `server` block only if using Option B.
2. Set `output: "export"` and `images: { unoptimized: true }` in `next.config.mjs`; add
   `generateStaticParams` for `src/app/play/[game]/page.tsx`; remove/guard the dynamic image routes from the
   export. Add a `build:mobile` script (`next build` producing `out/`).
3. Generate native projects: `npx cap add ios` and `npx cap add android` → creates `ios/` and `android/`
   directories (committed). `npx cap sync` copies `out/` + plugins into both.
4. **State persistence inside the wrapper (`MOB-1`):** Capacitor's WebView **has working `localStorage`**,
   so `src/lib/progress.ts` (`persist` → `localStorage`, `braintap-progress-v1`) and the Zustand guest/streak
   state work **unchanged**. Add: (a) configure the WebView so storage is durable (iOS `WKWebView` persists by
   default in the app sandbox; verify it survives app restarts on both platforms), and (b) optionally migrate
   to `@capacitor/preferences` later only if we hit storage-clearing edge cases. **No change to the store
   shape is required for Phase 0.** Existing Supabase cloud sync (`src/lib/sync.ts`) continues to back up
   signed-in users.
5. Map the manifest to native config: `display: standalone` + `orientation: portrait` (manifest) →
   set portrait lock and status-bar style in `capacitor.config.ts`; reuse `theme_color #03040b`. The
   `appleWebApp`/`mobile-web-app-capable` meta (`src/app/layout.tsx`) stays for web/PWA.
6. Handle safe areas / notches: the layout already sets `viewportFit: "cover"`; verify `env(safe-area-inset-*)`
   padding on `Nav`/`Footer` inside the shell.
7. Smoke test: launch both wrappers, play a daily puzzle across tiers, kill + relaunch, confirm streak +
   in-progress state survive.

Touches: `capacitor.config.ts` (new), `next.config.mjs`, `src/app/play/[game]/page.tsx`,
`src/app/play/[game]/opengraph-image.tsx` + `twitter-image.tsx` (export-guard), `ios/`, `android/` (new),
`package.json` scripts. **No game or store logic.**

### Phase 1 — Entitlement + billing (`MON-3`)

Goal: a user can buy "Remove ads" (and optionally unlock the archive), and `isPremium` is readable
everywhere. Ship this **before** ads so the "remove" path exists the moment ads appear.

1. Create `src/lib/entitlement.tsx` (`useEntitlement()`), mount its provider in `src/app/providers.tsx`
   beside `AuthProvider`.
2. Integrate RevenueCat: configure the SDK with the public API key (a new `NEXT_PUBLIC_REVENUECAT_*` env
   var in `.env.example`), define a `premium` entitlement, wire `purchase()` / `restore()`.
3. Configure store products: App Store Connect + Google Play Console product(s). See §6 for the
   one-time-vs-subscription decision (recommended: **subscription**, given archive inclusion).
4. Build a paywall screen/modal (new component under `src/components/`, e.g. `Paywall.tsx`) with the
   offering, a **Restore Purchases** button (required both platforms), and links to Terms + Privacy.
5. Surface an entry point: a "Remove ads" / "Go Premium" CTA in `src/components/Nav.tsx` and/or
   `src/app/profile` and Settings.
6. Cache the entitlement natively for synchronous launch reads; reconcile with Supabase `user` id.
7. Tests: purchase (sandbox), restore on a fresh install, web build reports `isPremium=false` cleanly.

Touches: `src/lib/entitlement.tsx` (new), `src/lib/config.ts` (new, defaults), `src/app/providers.tsx`,
`src/components/Paywall.tsx` (new), `src/components/Nav.tsx`, `.env.example`.

### Phase 2 — Ads (`MON-1`, `MON-2`)

Goal: rewarded hints and frequency-capped interstitials, premium bypass, honoring the hard "no ads on
active game pages" rule.

1. Create `src/lib/ads/` (interface + native AdMob impl + web no-op). Configure AdMob app + ad unit ids
   (test ids first) in `capacitor.config.ts` / native config; add `NEXT_PUBLIC_ADMOB_*` placeholders to
   `.env.example`.
2. **`MON-1` rewarded hints** — the precise behavior:
   - Read `freeHintThreshold` from `config.ts` (default **2**).
   - In each game's hint flow (start with `src/games/strands/Strands.tsx`, then `sudoku`, `connections`,
     `weaver`, `slide`, `forge`, `pips`): the first `min(freeHintThreshold, maxHints)` hints are free as
     today. Beyond the threshold (but still `< maxHints`), tapping the hint triggers
     `await ads.rewarded()`.
   - Grant the hint (`setHintsUsed(n+1)`, reveal) **only if** the promise resolves `"rewarded"`. On
     `"failed"` (no-fill / skip / error / dismiss): **do not increment, do not penalize, do not reveal** —
     show a small "couldn't load an ad, try again" toast. This is the literal `MON-1` requirement.
   - **Premium bypasses the gate**: if `isPremium`, all hints up to `maxHints` are free, no ad.
   - Surface it in `HintButton.tsx`: pass an optional `requiresAd`/`label` so the button reads e.g.
     "Watch ad for hint" past the threshold (presentational only; logic stays in the game's `useHint`).
   - Note the existing `maxHints === 0` games (hard tier) show **no** hint button — they get **no** rewarded
     prompt either, per design.
3. **`MON-2` interstitials** — only on inter-game navigation and return-to-home, **after** the
   `CompletionModal` is dismissed, never over it:
   - Call `ads.maybeInterstitial("return-home")` from the modal's `onClose`/"Back to today" handler
     (`src/components/play/CompletionModal.tsx`) and from the inter-game nav-to-home path
     (`GameHost.tsx` header "← Today" link / `Nav`).
   - `maybeInterstitial` enforces: frequency cap (`interstitialEveryNTransitions` default 3 AND
     `interstitialMinMinutes` default 3, configurable), **never at launch or first action**, and
     `isPremium ⇒ no-op`.
   - Guarantee ordering: the interstitial fires after `open` is false and the modal has unmounted/animated
     out, so it can never overlay the share/payoff surface.
4. Tests: rewarded failure does not consume a hint; premium sees zero ads anywhere; interstitial respects
   both caps; no ad ever appears on an active board.

Touches: `src/lib/ads/*` (new), `src/lib/config.ts`, `src/components/play/HintButton.tsx`,
`src/games/*/*.tsx` (hint flows — at minimum strands/sudoku/connections/weaver/slide/forge/pips),
`src/components/play/CompletionModal.tsx`, `src/components/play/GameHost.tsx`, `.env.example`.

### Phase 3 — Consent / privacy / compliance (`MOB-3`)

Goal: legally and store-policy compliant ad personalization + data disclosure.

1. **iOS ATT**: if the AdMob configuration uses IDFA/tracking, present the App Tracking Transparency prompt
   (via a Capacitor ATT plugin) **before** requesting personalized ads — and **not** on cold launch /
   first action (coordinate with the "never at launch" interstitial rule). Show it at a natural moment with
   a pre-prompt explainer. If the user denies, request non-personalized ads only.
2. **GDPR/UMP**: integrate Google's User Messaging Platform (UMP) consent form for EEA/UK users; gate
   personalized ad requests on UMP consent. AdMob's plugin supports requesting consent info on launch.
3. **Privacy policy / Terms**: publish/extend a privacy policy covering AdMob + RevenueCat data, link it
   from the Paywall (Phase 1) and Settings. Update `Footer`/Settings links.
4. **Store data-disclosure forms**: complete App Store **App Privacy** "Nutrition Label" and Google Play
   **Data safety** form (declare ad identifiers, purchase data, any analytics).
5. Ensure non-personalized ads still serve when consent is denied (fill must not break the free tier).

Touches: native config, `src/components/Paywall.tsx`, `Footer`/Settings, store console forms (no app logic
beyond the consent gate in `src/lib/ads`).

### Phase 4 — Store submission

1. App icons / splash from the existing brand (`public/icon.svg`, theme `#03040b`); generate the native
   asset sets.
2. Store listings, screenshots at the `MOB-2` target widths, age rating, category (`games`).
3. Build signing: iOS provisioning + App Store Connect; Android keystore + Play Console; internal/TestFlight
   tracks first, then production.
4. Pre-submission pass against §7 gotchas (especially: no web payment path for digital goods; ATT/UMP
   present; restore-purchases works on a clean install).

---

## 5. `MON-1` mapped onto the real hint plumbing

Concrete because the handoff requires it. Today, in `src/games/strands/Strands.tsx`:

```
const maxHints = puzzle.maxHints ?? DEFAULT_MAX_HINTS;   // easy 3 / medium 1 / hard 0
const useHint = useCallback(() => {
  if (won || hintsUsed >= maxHints) return;              // <-- the gate
  // ...reveal a word, setHintsUsed(hintsUsed + 1)...
}, [won, hintsUsed, maxHints, ...]);
```

The rewarded gate slots in **inside `useHint`**, leaving the per-tier `maxHints` budget intact:

```
const { isPremium } = useEntitlement();
const { freeHintThreshold } = useConfig();   // default 2

const useHint = useCallback(async () => {
  if (won || hintsUsed >= maxHints) return;
  const needsAd = !isPremium && hintsUsed >= freeHintThreshold;  // beyond free threshold
  if (needsAd) {
    const r = await ads.rewarded();
    if (r !== "rewarded") return;   // no-fill/skip/error: no increment, no penalty, no reveal
  }
  // ...existing reveal + setHintsUsed(hintsUsed + 1)...
}, [won, hintsUsed, maxHints, isPremium, freeHintThreshold, ...]);
```

Notes that make this safe across the 7 hint-using games (`strands`, `sudoku`, `connections`, `weaver`,
`slide`, `forge`, `pips`):

- The **shared `HintButton`** stays presentational. We extend it with an optional flag so the label/icon can
  switch to "Watch ad for hint" when `hintsUsed >= freeHintThreshold && !isPremium`; the game still owns the
  decision and the await.
- `freeHintThreshold` is **config-driven** (not the hardcoded `DEFAULT_MAX_HINTS = 2`). When
  `freeHintThreshold >= maxHints` for a tier (e.g. medium `maxHints=1`, threshold `2`), **no hint ever needs
  an ad** — the tier's small budget is entirely free. Hard tier (`maxHints=0`) never shows a hint and never
  an ad.
- Premium users keep the existing pure behavior — no awaits, no ads.

---

## 6. Open product decisions

The three decisions the handoff flagged, each with a recommendation + rationale. These are **config-driven**
(`src/lib/config.ts`), so they can be tuned remotely without an app update.

### D1 — Free-hint threshold before a rewarded ad is required (`MON-1`)

- **Recommendation: 2** (the handoff's recommended value; matches the existing `DEFAULT_MAX_HINTS = 2`
  intuition).
- Rationale: Easy gives 3 hints → the first **2** are free, the **3rd** requires a rewarded ad — a single,
  rare upsell that doesn't feel punitive. Medium (`maxHints=1`) and Hard (`maxHints=0`) never hit the gate,
  so the rewarded prompt only ever appears on Easy's last hint and in any game whose budget exceeds 2. Low
  friction, preserves the "free tier is genuinely playable" promise. Tunable up/down remotely.

### D2 — Interstitial frequency cap (`MON-2`)

- **Recommendation: every 3rd qualifying transition AND at most once per 3 minutes**, never at launch/first
  action, none for premium.
- Rationale: with 15 daily games a player can rack up many transitions in a session; an uncapped or
  per-transition interstitial would dominate the experience and invite churn/poor reviews (and risk store
  scrutiny for ad spamming). A combined N-transitions + time cap keeps ads to a few per session, always at
  a natural break (after the completion payoff, on the way home), respecting the hard rule. Both numbers are
  config-driven for post-launch tuning against retention/eCPM.

### D3 — Premium scope + purchase model (`MON-3`)

- **Recommendation (scope): premium = remove interstitials + remove the rewarded-hint gate + unlock the
  full `/archive`.** Three tangible benefits beat a single "no ads".
- **Recommendation (model): a subscription** (monthly, ideally with an annual option), **not** a one-time
  purchase.
- Rationale:
  - The product is a **daily** service ("one puzzle a day", 60-day rolling archive in
    `src/app/archive/page.tsx`, daily-seeded content). Premium delivers **ongoing** value (every future
    day's archive, every future ad avoided), which aligns with recurring billing far better than a one-time
    fee — a lifetime unlock undervalues content that grows daily.
  - Including the archive turns premium from a pure "annoyance remover" into a **content/utility** offer
    (replay history, streak repair), which materially lifts willingness to subscribe and reduces the
    perception of "paying to remove a problem you created."
  - Trade-off acknowledged: subscriptions have higher churn and require clear renewal disclosure + easy
    cancel (store-mandated). If conversion testing shows resistance, offer a **lifetime one-time** as a
    secondary product alongside the sub (RevenueCat handles both as the same `premium` entitlement).
  - `premiumUnlocksArchive` is a config flag (D3 is reversible): if we want to launch ads-only and add
    archive later, flip the flag without an app update.

---

## 7. Risks & store-review gotchas

- **Web-payment workaround = rejection.** Digital goods (premium) **must** use Apple IAP / Google Play
  Billing. Do **not** route premium through Stripe/Supabase/web checkout inside the app, and don't link out
  to web payment for it (Apple's anti-steering rules; Google's Billing policy). RevenueCat enforces the
  native rails — keep it that way. (Physical goods/donations are different; premium isn't either.)
- **Capacitor + Next.js routing pitfalls.** Server-mode features don't exist on-device: dynamic OG/Twitter
  image routes (`src/app/play/[game]/opengraph-image.tsx`, `twitter-image.tsx`), any server components, and
  `next start` are unavailable in static export. `/play/[game]` needs `generateStaticParams`. App-router
  client navigation works, but verify deep links and back-button behavior inside `WKWebView`/Android
  WebView. `next/image` needs `unoptimized: true` for export.
- **`localStorage` durability in the WebView.** Streaks/progress rely on `localStorage`
  (`braintap-progress-v1`). It works in both WebViews, but verify it survives app updates and isn't evicted
  under storage pressure on iOS; if risk is real, mirror to `@capacitor/preferences`. Signed-in users are
  additionally protected by existing Supabase sync (`src/lib/sync.ts`).
- **ATT / UMP timing.** ATT must not fire on cold launch or first interaction (poor UX + can conflict with
  the "no ad at launch" rule and Apple guidance); present a pre-prompt then ATT at a natural beat. UMP
  consent must be resolved before requesting personalized ads, and the free tier must still serve
  **non-personalized** ads on denial — otherwise fill drops and the model breaks.
- **Ads on game pages.** The hard rule is also a review/quality risk: interstitials that cover the
  completion modal, or any ad on an active board, read as deceptive/intrusive. The ordering guarantees in
  §3.3 (interstitial only after modal unmount) are there specifically to avoid this.
- **Rewarded-ad correctness.** A bug that grants a hint on no-fill/skip both violates `MON-1` and trains
  users to exploit it; conversely, consuming a hint when the ad fails is a refund/complaint magnet. The
  promise contract (`"rewarded"` only) must be covered by tests.
- **Subscription disclosures.** Both stores require explicit price/renewal/cancel disclosure on the
  paywall; missing this is a common rejection. Restore-purchases must be reachable without an account.
- **"Just a website" rejection (Apple 4.2).** Mitigated by static export (Option A) + genuine native
  capabilities (IAP, rewarded ads, offline play) rather than a thin remote-URL wrapper (Option B).

---

## 8. Effort & sequencing (relative sizing — not calendar promises)

| Phase | Relative size | Notes / risk |
| --- | --- | --- |
| 0 — Capacitor shell (`MOB-1`) | **L** | Biggest unknowns are the static-export conversion (`generateStaticParams`, dropping dynamic image routes) and verifying `localStorage` durability. Everything downstream depends on it. |
| 1 — Entitlement + billing (`MON-3`) | **M** | RevenueCat removes most of the hard parts; bulk of effort is store product config + paywall + restore testing in sandbox. |
| 2 — Ads (`MON-1`, `MON-2`) | **M** | Service layer is small; the spread is touching ~7 games' hint flows for `MON-1`. `MON-2` is concentrated in two files. |
| 3 — Consent / compliance (`MOB-3`) | **S–M** | Low code, high attention-to-detail; ATT/UMP timing + store privacy forms. |
| 4 — Store submission | **M** | Signing, listings, screenshots, review iteration (expect at least one round). |
| `MOB-2` responsive verification | **S** (ongoing) | Folded into Phases 0/2 via the §9 checklist; Playwright already set up. |

Critical path: **0 → 1 → 2 → 3 → 4.** Phase 1 ships before Phase 2 so the "remove ads" purchase exists the
moment ads appear. `MOB-2` and `MOB-3` run alongside their respective UI phases. The ads service interface
(§3.3) is designed so mediation (AppLovin/ironSource) can be added later without touching the gates.

---

## 9. `MOB-2` responsive verification checklist (Playwright)

Playwright is already configured (`npm run test:e2e`, `@playwright/test`). Verify at **360 / 390 / 414 px**
widths (the `MOB-2` targets), portrait. Pass criteria: no horizontal overflow, all tap targets ≥ **44px**
(`HintButton.tsx` already enforces `min-h-[44px]`; confirm every interactive control does), boards fully
visible without clipping.

- **Dense boards:**
  - Mind Strands **6×8** (`src/games/strands/`): full grid + the "Clear"/"Hint"/"Submit" control row fit at
    360px; hint cell highlights aren't clipped.
  - Reversi **8×8** (`src/games/reversi/`): all 64 cells + `a–h` / row labels fit; discs tappable at 44px.
  - Connections: re-verify the tile-overflow bug already noted in `docs/qa-report.md` at all three widths.
- **Completion surface (`MON-2`-adjacent):** `CompletionModal` (eyebrow + tier badge + 3xl title + 44px
  stat + insight card + "next tier" CTA + share buttons + "Back to today") fits without scroll-trapping at
  360px; share/image buttons are ≥44px.
- **Tier tabs:** the `role="tablist"` bar in `GameHost.tsx` (Easy/Medium/Hard pills with lock/check icons
  and best-time) doesn't wrap awkwardly or shrink targets below 44px at 360px.
- **Rewarded prompt:** the "Watch ad for hint" state of `HintButton` and any "ad failed, try again" toast
  render and remain tappable at small widths.
- **Safe areas:** with `viewportFit: "cover"`, content respects `env(safe-area-inset-*)` inside the shell
  (notch / home indicator) — verify on a device/simulator, not just the browser.

---

## 10. Summary of file touch-points (quick reference)

- New: `capacitor.config.ts`, `ios/`, `android/`, `src/lib/config.ts`, `src/lib/entitlement.tsx`,
  `src/lib/ads/{index,native,web}.ts`, `src/components/Paywall.tsx`.
- Edited: `next.config.mjs` (export), `src/app/providers.tsx` (entitlement provider),
  `src/app/play/[game]/page.tsx` (+ image routes export-guard), `src/components/play/HintButton.tsx`,
  `src/components/play/CompletionModal.tsx`, `src/components/play/GameHost.tsx`, hint flows in
  `src/games/{strands,sudoku,connections,weaver,slide,forge,pips}/*.tsx`, `src/components/Nav.tsx`,
  `.env.example`, `package.json` (mobile build scripts).
- Unchanged: game engines/seeds, `src/lib/progress.ts` store shape, `src/lib/difficulty.ts`,
  `MAX_HINTS_BY_DIFFICULTY`.
