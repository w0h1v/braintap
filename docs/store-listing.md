# App Store listing — BrainTap

Everything to paste into App Store Connect for the v1.0 submission. Character
counts are against Apple's limits. Screenshot drafts live in `store-assets/`
(untracked — PNGs are gitignored).

## Identity

| Field | Value | Limit |
| --- | --- | --- |
| Name | `BrainTap: Daily Brain Games` | 27/30 |
| Subtitle | `20 daily puzzles. One streak.` | 29/30 |
| Bundle ID | `games.braintap.app` | — |
| SKU | `braintap-ios` | — |
| Primary category | Games › Puzzle | — |
| Secondary category | Games › Word | — |
| Price | Free (one non-consumable IAP: “BrainTap Pro — Lifetime”) | — |

## Promotional text (170 max)

> A fresh deck of 20 bite-sized brain games drops every day — word, logic,
> math, and memory. Same puzzles for everyone, reset at midnight. Keep the
> streak alive.

(168 chars. Editable without a new build — use for events/updates later.)

## Description (4000 max)

> **Twenty science-backed brain games. One fresh challenge every day.**
>
> BrainTap gives your mind a daily workout that actually feels like play.
> Every day at local midnight, all twenty games reset with brand-new puzzles —
> the same puzzles for every player worldwide, so a fair leaderboard race
> starts each morning.
>
> **WORD** — Brainle, Weaver, Strands, Pangrams, Crossword and more: ladders,
> anagram hunts, and grids to untangle.
>
> **LOGIC** — Mini Sudoku, Neural Connections, Pips, Slide: deduce, group,
> and reorder your way to a clean board.
>
> **NUMBER & MEMORY** — Forge equations, chase sequences, and stretch your
> recall a little further than yesterday.
>
> **BUILD A STREAK** — Solve at least one puzzle a day to keep your streak
> alive. Track solve times, stars, and per-game stats, and earn achievements
> as the days stack up.
>
> **THREE DIFFICULTY TIERS** — Every game ships in Easy, Medium, and Hard.
> Solve a tier to unlock the next, and climb a separate daily leaderboard for
> each.
>
> **PLAY YOUR WAY**
> • No account needed — progress saves on your device
> • Optional free account syncs your streak across devices and puts your name
>   on the global daily leaderboards
> • Sign in with Apple or Google
> • A 7-day archive to catch up on puzzles you missed
>
> **FAIR MONETIZATION** — BrainTap is free with occasional ads between games —
> never on the puzzle board itself. Ads are non-personalized and the app never
> asks to track you. A single one-time purchase removes ads forever and
> unlocks the full puzzle archive. No subscriptions.
>
> One puzzle a day keeps the brain fog away. Tap in.

(~1,600 chars — well under the limit.)

## Keywords (100 max)

`logic,word,memory,sudoku,crossword,training,mind,quiz,iq,riddle,focus,smart,number,match`

(88 chars. Deliberately excludes words already indexed from the name/subtitle:
brain, daily, games, puzzles, streak.)

## URLs

| Field | Value |
| --- | --- |
| Support URL | `https://braintap.vercel.app/how-to-play` |
| Marketing URL | `https://braintap.vercel.app` |
| Privacy Policy URL | `https://braintap.vercel.app/privacy` |

Support email in App Store Connect: **support@braintap.app** (mailbox must
exist — MAP-392 item 0).

## What's New (v1.0)

> Welcome to BrainTap: twenty daily brain games, three difficulty tiers,
> streaks, achievements, and global daily leaderboards. See you at midnight.

## Screenshots

Spec: iPhone 6.9" — **1320 × 2868 px**, portrait, up to 10. Only one size set
is required; App Store Connect scales the rest.

Draft set in `store-assets/` (captured from the real app at exact resolution):

1. `01-home.png` — hub with streak/progress stat tiles
2. `02-sudoku.png` — Mini Sudoku board with tier tabs + hint UI
3. `03-connections.png` — Neural Connections
4. `04-weaver.png` — Weaver word ladder
5. `05-slide.png` — Slide puzzle
6. `06-strands.png` — Strands grid
7. `07-leaderboard.png` — daily leaderboard + live counter
8. `08-archive.png` — puzzle archive

Ordering advice: lead with a colorful board (02 or 03), not the hub — the
first 2–3 screenshots carry nearly all conversion. Optionally retake final
shots on-device from TestFlight (adds the real status bar) and overlay
marketing captions; these drafts are submission-legal as-is.

## Age rating questionnaire

All "None" (cartoon violence, realistic violence, sexual content, profanity,
horror, drugs/alcohol/tobacco, gambling, contests). Unrestricted web access:
**No**. Gambling with real currency: **No**. → expected rating **4+**.
(User-entered display names are filtered + reportable in-app, which supports
the UGC answers.)

## App Privacy (nutrition label)

Data linked to the user, NOT used for tracking (`NSPrivacyTracking=false`, no
ATT, non-personalized ads only):

| Data type | Purpose | Linked | Tracking |
| --- | --- | --- | --- |
| Email address | App functionality (account) | Yes | No |
| User ID | App functionality (account, leaderboards) | Yes | No |
| Product interaction (gameplay results) | App functionality | Yes | No |
| Purchase history | App functionality (RevenueCat entitlement) | Yes | No |
| Device ID / crash & performance data | App functionality, advertising (AdMob SDK — non-personalized) | No | No |

Cross-check against the generated Xcode Privacy Report before submitting
(Archive → Generate Privacy Report), which aggregates the app + RevenueCat +
GoogleMobileAds manifests.

## App Review notes (paste into ASC)

> BrainTap is a daily puzzle game. No account is required to play — accounts
> are optional and add cross-device sync + leaderboard entry.
>
> Demo account (email/password sign-in on the Sign in screen):
> — email: appreview@braintap.app
> — password: (stored in password manager; paste when filling this form)
>
> Notes:
> • In-app purchase: “BrainTap Pro” one-time non-consumable (removes ads,
>   unlocks the archive). Restore Purchases is on the paywall.
> • Account deletion: Profile → Delete account.
> • Ads are non-personalized (Google AdMob, npa=1). The app never requests
>   App Tracking Transparency because it does not track.
> • Leaderboard display names are profanity-filtered at creation and every
>   name row has a report (⚑) action.

## Remaining before these fields can be entered

Tracked in Multica **MAP-392**: Apple Developer enrollment → ASC app record →
IAP product → real AdMob/RevenueCat ids → TestFlight pass.
