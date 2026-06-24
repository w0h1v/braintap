# BrainTap Games

**Twenty science-backed brain games, one fresh challenge every day.** Build a
streak, train six cognitive domains, and watch your mind sharpen. A production
Next.js app with a deterministic daily-puzzle engine, validated level banks, and
optional accounts + cloud sync.

![stack](https://img.shields.io/badge/Next.js-14-black) ![ts](https://img.shields.io/badge/TypeScript-strict-blue) ![tests](https://img.shields.io/badge/tests-168_passing-brightgreen)

## The games

| Game | Type | Trains | Daily content |
|------|------|--------|---------------|
| Neural Connections | Group 16 terms into 4 hidden categories | verbal, logic | 47-category curated pool, ambiguity-guarded |
| Synapse Wordle | Guess the 5-letter mind word | verbal | curated answer bank, full ~12,900-word Wordle guess set |
| Mind Strands | Themed word search + spangram | verbal, focus | 63 themes, backtracking grid packer |
| Focus Forge | Nonogram / picross | logic, spatial | procedural, unique-solution verified |
| Idea Weaver | Spelling-bee from 7 letters | verbal | dictionary + daily pangram hive |
| Memory Vault | Reproduce a growing light pattern | memory | procedural seeded |
| Tap Teasers | Lateral-thinking riddles | logic, verbal | 120+ riddle bank |
| Mini Sudoku | 6×6 deduction | logic, numeric | procedural, unique-solution verified |
| Sum Sprint | Tap numbers to a target, 60s | numeric, focus | procedural, solvable targets |
| Pips | Domino column sums | logic, numeric | procedural with solver |
| 2048 | Slide & merge tiles | numeric, spatial | procedural seeded spawns |
| Schulte Table | Tap 1→25 in order | focus | procedural permutation |
| Sequence Echo | Simon-style recall | memory, focus | procedural prefix-stable sequence |
| Tile Slide | 15-puzzle | spatial, logic | procedural, parity-solvable |
| Reversi | Othello vs AI | logic, spatial | minimax AI w/ corner weighting |
| Mini Crossword | Across/down clue grid | verbal, memory | curated mini-grid clue bank |
| Pattern Matrix | Find the rule, complete the 3×3 | logic, spatial | procedural rule sets |
| Stroop Rush | Tap the ink colour, not the word | focus, logic | procedural, timed |
| Mental Math Sprint | Rapid-fire arithmetic, timed | numeric, focus | procedural, solvable |
| Spot the Change | Memorise the grid, spot the change | memory, spatial | procedural seeded |

Every daily puzzle is **deterministic** (same date → same puzzle for everyone)
and **validated solvable** by the test suite across 200 consecutive days.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The app runs **fully offline** out of the box — progress, streaks, and stats are
stored in `localStorage`. No account or backend required to play.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Full Vitest suite (solvability + engine correctness) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |

## Architecture

```
src/
  app/                 Next.js App Router (hub, /play/[game], auth, stats, archive,
                       leaderboard, profile, content pages, /auth/callback, middleware)
  components/          Nav, Footer, hub, play host, settings, auth UI, ui/ primitives
  games/<id>/          self-contained game modules (see docs/GAME_CONTRACT.md)
    engine.ts          pure deterministic logic + validation
    generator.ts       getDailyPuzzle(dateISO), memoised
    <Game>.tsx         "use client" UI
    index.ts           GameModule default export
    engine.test.ts     solvability + correctness tests
  lib/                 types, rng (seeded), daily (date→seed), progress (zustand+persist),
                       auth, supabase clients, skills, leaderboard, sync, sound, haptics, share
supabase/migrations/   Postgres schema (profiles, game_results, RLS, leaderboard RPCs)
docs/                  design specs (per game + design system + platform), contracts, QA
```

### Daily puzzle model

A game is a `GameModule` (`src/lib/types.ts`). `getDailyPuzzle(dateISO)` seeds a
PRNG from the date (`rngFromString(\`<id>:${dailySeed(id, date)}\`)`) so puzzles
are reproducible and offline-generatable — no per-day server fetch. Bank-based
games walk a curated pool via `bankIndex(...)`; procedural games generate from the
seed. The host (`src/components/play/GameHost.tsx`) wires puzzle → component →
result persistence, and supports archive replay via `?date=YYYY-MM-DD`.

## Accounts & cloud sync (optional)

Set Supabase env to enable Google + email/password sign-in, cross-device sync, and
global leaderboards. Without it, everything still works locally.

```bash
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

See **[docs/SETUP.md](docs/SETUP.md)** for the full Supabase + Google OAuth setup
(apply `supabase/migrations/0001_init.sql`, enable providers, set redirect URLs)
and Vercel deployment.

## Testing & quality

- `npm test` — 168 tests. Every game has an `engine.test.ts` with a `*solvable*`
  suite asserting daily puzzles are well-formed and winnable across ≥180 days, plus
  engine-correctness tests (evaluators, move/flip logic, uniqueness solvers).
- Strict TypeScript, accessible components (ARIA, keyboard), reduced-motion / Zen
  mode, mobile-first responsive layouts with ≥44px touch targets.

## License

Prototype design © BrainTap Labs. Built as a production reference implementation.
