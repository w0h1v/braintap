# BrainTap QA Browser Sweep

- Date: 2026-06-17
- Target: http://localhost:3210
- Tool: Playwright MCP (headless Chromium)
- Viewports: Desktop 1280x800 (all pages/games), Mobile 390x844 (home + sudoku, brainle, connections, 2048)
- Console: 0 uncaught/runtime errors across the entire session. The only console output anywhere is one benign deprecation warning (see note below), which is ignored per the brief.

## Summary

- 15/15 games render and respond to a light interaction. No crashes, no red console errors, no "is not a function"/hydration/failed-to-fetch breakage anywhere.
- All 7 utility pages (stats, archive, leaderboard, login, signup, profile, how-to-play) render meaningful content. Stats radar renders (accessible, data-bound). Auth pages degrade gracefully to a guest flow because Supabase isn't configured (expected, not a bug).
- Settings modal opens, Zen toggle works, closes cleanly.
- Mobile: home + 3 of 4 representative games are clean with no horizontal overflow. One real layout bug found: long Connections tiles overflow and overlap neighbors on mobile. One minor navigation gap: top-nav links disappear on mobile with no hamburger.

No blockers. No majors. 2 minor issues.

## Findings table

| Page/Game | Severity | Issue | Console error | Repro |
|---|---|---|---|---|
| / (home, desktop) | PASS | 15 game cards, 2x2 stat strip (Current Streak / Played Today / Avg Solve / Status), weekly rotation, reset countdown all render. | none | Resize 1280x800, visit / |
| /play/connections | PASS (desktop) | 16-tile grid renders; tile click toggles selected state. | none | Click a tile |
| /play/brainle | PASS | 6x5 board + QWERTY keyboard render; pressing a key fills first cell. | none | Press a letter |
| /play/strands | PASS | 6x8 letter grid, theme + timer render; cell tap enables Clear. | none | Click a letter |
| /play/forge | PASS | 5x5 nonogram with row/col clues; cell click toggles filled. | none | Click a cell |
| /play/weaver | PASS | 7-letter hive (center required) + rank/progress; tapping a letter builds the word. | none | Tap a letter |
| /play/vault | PASS | 5x5 memory grid; Start plays sequence then enables input ("Now rebuild the pattern"). | none | Click Start sequence |
| /play/teasers | PASS | Riddle 1/5 with 4 radio choices; selecting one shows correct/explain + Next. | none | Click an answer |
| /play/sudoku | PASS | 6x6 grid + 1-6 pad + Notes/Erase; select cell + tap number enters value. | none | Select empty cell, tap a number |
| /play/sprint | PASS | 4x4 number grid, target/timer/score; Start enables grid, tap updates "Selected sum". | none | Click Start sprint, tap a cell |
| /play/pips | PASS | Column targets, slots, domino tray with flip; selecting a domino enables slots. | none | Tap a tray domino |
| /play/g2048 | PASS | 4x4 board with 2 starting tiles; ArrowDown slides tiles and spawns a new tile. | none | Press ArrowDown |
| /play/schulte | PASS | 5x5 table (1-25); Start, then tap 1 advances "Find next" to 2 and runs timer. | none | Click Start, tap "1" |
| /play/simon | PASS | 4 colored pads; Start advances Round to 1, shows "Your turn", enables pads. | none | Click Start sequence |
| /play/slide | PASS | 4x4 15-puzzle; tapping tile next to gap slides it, increments Moves, starts timer. | none | Tap a tile beside the gap |
| /play/reversi | PASS | 8x8 board, 4 start discs, legal moves highlighted; placing a disc updates score and AI replies. | none | Click a highlighted legal move |
| /stats | PASS | Radar chart renders with accessible label + all six domains; brain score, top skill, recent activity all present. | none | Visit /stats |
| /archive | PASS | ~60 day cards render with practice-only note. | none | Visit /archive |
| /leaderboard | PASS | 15 game tabs + ranked rows + live counter + discussion; tab switch updates board. | none | Click a different game tab |
| /auth/login | PASS | Graceful "Accounts aren't configured" + Play-as-guest (Supabase not set up; expected). | none | Visit /auth/login |
| /auth/signup | PASS | Same graceful guest notice. | none | Visit /auth/signup |
| /profile | PASS | Guest profile with streak/longest/played + stats link. | none | Visit /profile |
| /how-to-play | PASS | Full content (daily format, streaks, per-category how-to). | none | Visit /how-to-play |
| Settings modal | PASS | Opens from nav gear; Zen toggle flips to checked; Close dismisses dialog. | none | Home > click Settings gear, toggle Zen, Close |
| / (home, mobile 390) | minor | Top-nav links (Today/Archive/Stats/Leaderboard) collapse to 0x0 on mobile and there is NO hamburger/menu to reach them; only logo, streak, Settings, Sign-in remain in header. Footer links + home-page section cards provide alternative access, so not a dead-end. No horizontal overflow. | none | Resize 390x844, visit /, inspect nav |
| /play/connections (mobile 390) | minor | Long tile labels overflow their cells and overlap neighbors. "OLIGODENDROCYTE" scrollWidth 86 > cell clientWidth 76; visually bleeds into the adjacent "EPENDYMAL" tile (text not wrapped/truncated/shrunk). Page-level overflow is 0 (clips per-cell) so still playable, but visually broken/hard to read. Screenshot: mobile-connections.png. | none | Resize 390x844, visit /play/connections |
| /play/sudoku (mobile 390) | PASS | Board 314x314 centered, 1-6 pad in one row, controls fit. No overflow. Screenshot: mobile-sudoku.png | none | Resize 390x844, visit /play/sudoku |
| /play/brainle (mobile 390) | PASS | Board + full keyboard fit; keys ~27x50px. No overflow. Screenshot: mobile-brainle.png | none | Resize 390x844, visit /play/brainle |
| /play/g2048 (mobile 390) | PASS | Board 332x332 centered, controls fit. No overflow. Screenshot: mobile-2048.png | none | Resize 390x844, visit /play/g2048 |

## Notes / non-issues (not flagged)

- Benign console warning (whole session, all pages): `<meta name="apple-mobile-web-app-capable"> is deprecated. Please include <meta name="mobile-web-app-capable" content="yes">`. Cosmetic PWA meta tag; safe to ignore.
- Copy inconsistency (not a runtime bug): home/footer cards say "Five skills" but /stats and /how-to-play describe "six cognitive domains" (Memory, Logic, Verbal, Spatial, Numeric, Focus). Worth aligning the marketing copy, but not a functional defect.

## Screenshots saved (repo root)

- /Users/orie/dev/braintap/mobile-home.png
- /Users/orie/dev/braintap/mobile-sudoku.png
- /Users/orie/dev/braintap/mobile-brainle.png
- /Users/orie/dev/braintap/mobile-connections.png (shows the overflow/overlap bug)
- /Users/orie/dev/braintap/mobile-2048.png
