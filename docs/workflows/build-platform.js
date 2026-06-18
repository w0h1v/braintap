export const meta = {
  name: 'braintap-build-platform',
  description: 'Build the BrainTap platform: Supabase schema + sync, auth (Google + email/password), stats/brain-profile, archive, leaderboard, profile, content pages, PWA',
  phases: [
    { title: 'Foundation', detail: 'schema + sync + skills + leaderboard libs + auth callback/middleware + manifest/icon' },
    { title: 'Pages', detail: 'auth, profile, stats, archive, leaderboard, content pages (parallel)' },
  ],
}

const ROOT = '/Users/orie/dev/braintap'
const NPX = '/opt/homebrew/bin/npx'

const COMMON = `CONTEXT: BrainTap is a Next.js 14 (App Router) + TypeScript + Tailwind daily brain-games app.
READ FIRST: ${ROOT}/docs/design/platform.md, ${ROOT}/docs/design/design-system.md, and these existing files to match conventions and APIs:
- ${ROOT}/src/lib/types.ts, daily.ts, progress.ts (the zustand progress store with results/streak), auth.tsx (useAuth), games.ts (ALL_GAMES, GAME_METAS), cn.ts
- ${ROOT}/src/lib/supabase/client.ts + server.ts (getSupabaseBrowser/Server, isSupabaseConfigured)
- ${ROOT}/src/components/Nav.tsx, Footer.tsx, ui/Card.tsx (Card, Pill, StatBox), ui/Button.tsx (Button, GhostButton), ui/Modal.tsx, GameIcon.tsx
- ${ROOT}/src/app/layout.tsx, providers.tsx, globals.css, page.tsx, components/hub/Hub.tsx
DESIGN: dark neon glassmorphism. Tailwind tokens: bg, ink/ink-soft/ink-mute/ink-faint, line/line-strong, accents cyan/magenta/peri/amber/mint/violet/orange (+ -soft), font-display, font-mono, rounded-pill, max-w-shell, animate-rise/pop. Match the hub's look.
CRITICAL: The app MUST work fully OFFLINE when Supabase is NOT configured (isSupabaseConfigured=false / useAuth().enabled=false): fall back to the local zustand progress store and synthesized/local data. Never crash when Supabase env is absent.
Do NOT touch ${ROOT}/src/games/** (other agents own those). Do NOT run the full \`next build\` or full \`tsc\` (parallel work in progress) — typecheck only your own new files if needed via the editor; keep changes scoped to the files listed for your task.`

const FOUND_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['filesWritten', 'apiSurface', 'summary'],
  properties: {
    filesWritten: { type: 'array', items: { type: 'string' } },
    apiSurface: { type: 'string', description: 'exported function/type signatures from skills.ts, sync.ts, leaderboard.ts that page agents will call' },
    summary: { type: 'string' },
  },
}
const PAGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['filesWritten', 'summary'],
  properties: {
    filesWritten: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

phase('Foundation')

const foundation = await agent(
  `${COMMON}

TASK: Build the platform DATA FOUNDATION. Create these files:

1. ${ROOT}/supabase/migrations/0001_init.sql — Postgres schema for Supabase Auth integration:
   - profiles (id uuid PK refs auth.users on delete cascade, username text unique, avatar_seed text, current_streak int, longest_streak int, last_played date, settings jsonb, created_at, updated_at)
   - game_results (id, user_id refs auth.users, game_id text, puzzle_date date, status text, score int, time_ms int, moves int, mistakes int, stars int, detail jsonb, played_at; UNIQUE(user_id, game_id, puzzle_date))
   - daily_leaderboard VIEW or query support: an index on game_results(game_id, puzzle_date, score desc).
   - RLS: enable on both; policies so users select/insert/update/delete only their own rows; allow public SELECT of aggregate leaderboard via a SECURITY DEFINER function get_daily_leaderboard(game text, day date) returning top N (rank, username, score, time_ms) and a get_live_count(day date).
   - a trigger to auto-create a profile row on new auth user (handle_new_user) + updated_at trigger.
   Make it idempotent where reasonable (create table if not exists / drop policy if exists).

2. ${ROOT}/src/lib/skills.ts — brain-profile computation. Export: the 6 SkillDomain metadata (label, color) using the SkillDomain type from types.ts; computeSkills(results) that maps stored results (from progress store, keyed by date->gameId->StoredResult, using GAME_METAS[gameId].skills + score) into a Record<SkillDomain, number> (0-100), with sensible decay/weighting over recent days; and a helper to get per-skill recent history for charts.

3. ${ROOT}/src/lib/leaderboard.ts — Export types LeaderboardEntry {rank, name, score, timeMs?, isYou?} and async getDailyLeaderboard(gameId, dateISO): when Supabase configured, call the RPC; otherwise synthesize a DETERMINISTIC plausible local leaderboard (seeded by gameId+date via rngFromString, inserting the local player's today result if present). Also getLiveCount(dateISO): real via RPC or deterministic synthesized number. Never throw.

4. ${ROOT}/src/lib/sync.ts — Export syncProgress(): when a user is logged in (getSupabaseBrowser + session), push local game_results from the progress store (upsert) and pull remote results merging into the store, and upsert the profile (streak). Guard everything in try/catch; no-op offline.

5. ${ROOT}/src/components/ProfileSync.tsx ("use client") — a render-null component that calls syncProgress on auth change; then EDIT ${ROOT}/src/app/providers.tsx to mount <ProfileSync/> inside AuthProvider (only add this; keep ZenController).

6. ${ROOT}/src/app/auth/callback/route.ts — OAuth/email code exchange (exchangeCodeForSession) then redirect to '/'. Use getSupabaseServer(); if not configured, redirect home.

7. ${ROOT}/src/middleware.ts — refresh the Supabase session cookie on navigation using @supabase/ssr createServerClient with the request/response cookie bridge; NO-OP (pass through) when env not configured. Add an appropriate matcher excluding static assets.

8. ${ROOT}/public/manifest.webmanifest — PWA manifest (name "BrainTap Games", short_name "BrainTap", theme/background #03040b, display standalone, start_url "/", icons referencing /icon.svg). And ${ROOT}/src/app/icon.svg — the BrainTap hexagon logo (cyan->magenta gradient) so Next generates the favicon.

Use the seeded rng from @/lib/rng and date helpers from @/lib/daily for any synthesized data. Return the exact exported API surface (signatures) of skills.ts, sync.ts, leaderboard.ts so page builders can call them precisely.`,
  { label: 'platform:foundation', phase: 'Foundation', schema: FOUND_SCHEMA, effort: 'high' },
)

log('Foundation built; fanning out pages')

phase('Pages')

const api = foundation?.apiSurface ?? '(see ${ROOT}/src/lib/skills.ts, sync.ts, leaderboard.ts)'

const pageTasks = [
  {
    label: 'page:auth',
    prompt: `Build authentication UI. Files:
- ${ROOT}/src/app/auth/login/page.tsx and ${ROOT}/src/app/auth/signup/page.tsx ("use client"): email/password forms + "Continue with Google" button, using useAuth() (signInWithPassword, signUpWithPassword, signInWithGoogle). Validate inputs, show errors and the email-confirmation notice. When useAuth().enabled is false, show a friendly "Accounts aren't configured — you can still play as a guest; progress saves on this device" with a link to '/'. Redirect to '/' on success (useRouter). Polished, centered card, matches design.
- ${ROOT}/src/app/profile/page.tsx ("use client"): if logged in, show avatar/name/email, current+longest streak (from progress store), total games played, and a Sign out button (useAuth().signOut). If accounts disabled or not logged in, show guest state + link to /auth/login. Link to /stats.`,
  },
  {
    label: 'page:stats',
    prompt: `Build ${ROOT}/src/app/stats/page.tsx ("use client"): the "Your brain profile" screen. Use computeSkills from @/lib/skills over the progress store results. Render a 6-point radar chart on a <canvas> (filled polygon, grid rings, colored vertices + labels) AND skill bars (label, animated bar, %). Show headline + summary copy and small badges (e.g. games played, current streak). Add a compact recent-activity list (last ~10 results from the store with game name + score/stars). Fully responsive; canvas redraws on resize and DPR-aware. API available: ${api}`,
  },
  {
    label: 'page:archive',
    prompt: `Build ${ROOT}/src/app/archive/page.tsx ("use client"): "The Archive — never miss a day". Show a grid of recent days (e.g. last 60 days from today backwards using @/lib/daily addDays/todayISO). For each day show the date and, for that day's results in the progress store, small per-game status dots/badges; clicking a day (or a game within it) links to /play/<game>?date=YYYY-MM-DD (the GameHost already supports the ?date param for archive play). Include a header matching the design and a note that archive plays don't affect streak. Responsive grid.`,
  },
  {
    label: 'page:leaderboard',
    prompt: `Build ${ROOT}/src/app/leaderboard/page.tsx ("use client"): the leaderboard screen. Left: "Today's leaderboard" list for a selectable game (default the daily featured/rotation game) using getDailyLeaderboard from @/lib/leaderboard (highlight the "You" row). Right: a LIVE counter card that animates up to getLiveCount(today) ("minds tapped in today, across N countries"), plus 2-3 discussion cards (static/sample is fine). Add a small game selector (chips of the 15 games). Everything must work offline via the synthesized local data. API available: ${api}`,
  },
  {
    label: 'page:content',
    prompt: `Build static content pages (server components, no "use client" needed) matching the design (max-w-shell, prose-like styling with the app's colors):
- ${ROOT}/src/app/how-to-play/page.tsx — overview of the daily format, streaks, and a short how-to per game category.
- ${ROOT}/src/app/science/page.tsx — "The science": short, credible copy on the 6 cognitive domains and daily practice (no fake citations; keep it honest/general).
- ${ROOT}/src/app/privacy/page.tsx and ${ROOT}/src/app/terms/page.tsx — concise, reasonable privacy policy and terms for a free daily games site (mention localStorage + optional accounts). Each page exports metadata (title). Keep tasteful and brand-consistent.`,
  },
]

const pages = await parallel(
  pageTasks.map((t) => () =>
    agent(`${COMMON}\n\nTASK (${t.label}): ${t.prompt}\n\nReturn filesWritten + a short summary.`, {
      label: t.label, phase: 'Pages', schema: PAGE_SCHEMA, effort: 'high',
    }),
  ),
)

return { foundation, pages: pages.filter(Boolean) }
