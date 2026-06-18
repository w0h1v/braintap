export const meta = {
  name: 'braintap-wave1',
  description: 'First enhancement wave: hint systems across puzzle games, real tile animations for 2048 & Tile Slide, onboarding + clean-sweep celebration, OG images, error/loading boundaries',
  phases: [
    { title: 'Games', detail: 'hint systems + animations (disjoint per game folder)' },
    { title: 'Platform', detail: 'onboarding + celebration, OG images, error/loading boundaries' },
  ],
}

const ROOT = '/Users/orie/dev/braintap'

const GAME_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['id', 'testsPass', 'summary'],
  properties: {
    id: { type: 'string' },
    testsPass: { type: 'boolean' },
    filesWritten: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    testTail: { type: 'string' },
  },
}
const PLAT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['area', 'filesWritten', 'summary'],
  properties: {
    area: { type: 'string' },
    filesWritten: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
}

const COMMON = `BrainTap is a Next.js 14 + TS + Tailwind daily brain-games app at ${ROOT}. Match the existing dark-neon design. Reference quality: ${ROOT}/src/games/sudoku/Sudoku.tsx. Shared helpers: @/components/play/CompletionModal, @/components/play/HintButton (use this for hints), @/lib/useGameClock, @/lib/share (formatClock, shareText), @/lib/haptics, @/lib/sound (sfx), @/lib/cn, GAME_METAS.<id>.accent. Honour the reducedMotion prop. Keep determinism (no Math.random/Date.now in puzzle logic). Preserve contracts: onComplete called exactly once; savedState restore + onPersistState (JSON-serialisable). Use /opt/homebrew/bin/npx vitest run src/games/<id> to verify (must pass). Do NOT touch files outside your game folder. Do NOT run the full build/tsc.`

// ---- HINT GAMES ----
const HINTS = [
  { id: 'connections', comp: 'Connections', max: 1, logic: 'A hint auto-solves ONE not-yet-solved category (reveal its 4 tiles as a solved row), or if you prefer, highlights the 4 tiles of one unsolved group. Pick the most user-friendly. Treat it like a wrong-cost: each hint reduces the final score notably (e.g. -20) and counts toward detail.hintsUsed; a hinted win should not award 3 stars.' },
  { id: 'strands', comp: 'Strands', max: 2, logic: 'A hint reveals ONE not-yet-found theme word by highlighting/animating its path cells (or, as a first hint, light up the first cell of an unfound word). Prefer revealing a full short word. Deduct score per hint (e.g. -12) and record detail.hintsUsed.' },
  { id: 'forge', comp: 'Forge', max: 3, logic: 'A hint reveals ONE correct cell (fill a cell that should be filled, or correctly mark an empty one) from the solution, choosing a still-wrong/empty cell. Deduct score per hint and record detail.hintsUsed.' },
  { id: 'weaver', comp: 'Weaver', max: 3, logic: 'A hint reveals ONE not-yet-found valid word (add it to the found list with its points, or reveal the first two letters of an unfound word). Prefer revealing a medium-length unfound word. Deduct score per hint and record detail.hintsUsed.' },
  { id: 'pips', comp: 'Pips', max: 3, logic: 'A hint correctly places (and locks) ONE domino in its solution position/orientation from the known solution. Deduct score per hint and record detail.hintsUsed.' },
]

// Sudoku already has the reference structure; add a hint there too for parity.
const SUDOKU_HINT = { id: 'sudoku', comp: 'Sudoku', max: 3, logic: 'A hint fills ONE empty cell with its correct solution value (prefer a logically-forced "naked single" cell if one exists, else any empty cell), marks it visually as hint-filled, and selects it. Deduct score per hint (e.g. -8) and record detail.hintsUsed; a hinted solve should cap stars.' }

function hintPrompt(g) {
  return `${COMMON}

TASK: Add a HINT SYSTEM to the "${g.id}" game (component ${ROOT}/src/games/${g.id}/${g.comp}.tsx).
Read the component + its engine first, plus ${ROOT}/docs/design/game-${g.id}.md.
- Max hints: ${g.max}. Render the shared <HintButton used={...} max={${g.max}} onHint={...} accent={ACCENT}/> in the controls row.
- Hint behaviour: ${g.logic}
- You MAY add a pure helper to ${ROOT}/src/games/${g.id}/engine.ts (e.g. getHint(puzzle, currentState) returning the cell/word/placement to reveal) — but do NOT change or remove existing exports or behaviour, and existing tests MUST still pass. Add a small test for the hint helper if you add one (keep the "solvable" test intact).
- Persist hintsUsed in savedState (extend onPersistState payload, keep it JSON-serialisable). Include detail.hintsUsed and reduce the final score in onComplete accordingly. Disable the hint button when the game is over or hints are exhausted.
- Honour reducedMotion for any reveal animation.
VERIFY: /opt/homebrew/bin/npx vitest run src/games/${g.id} must pass. Return structured result.`
}

phase('Games')

const gameTasks = [
  ...[SUDOKU_HINT, ...HINTS].map((g) => () =>
    agent(hintPrompt(g), { label: `hint:${g.id}`, phase: 'Games', schema: GAME_SCHEMA, effort: 'high' })
      .then((r) => (r ? { ...r, id: g.id } : { id: g.id, testsPass: false, summary: 'null' })),
  ),
  // 2048 animations
  () => agent(`${COMMON}

TASK: Add real TILE ANIMATIONS to 2048 (${ROOT}/src/games/g2048/G2048.tsx). Read the component + engine first.
Currently tiles re-render instantly. Implement smooth motion:
- Render tiles as absolutely-positioned elements with stable identities (ids) so React can animate them. On a move, animate each surviving tile sliding (CSS transform translate) from its old cell to its new cell; merged tiles slide together then "pop" (scale) on merge; newly spawned tiles fade/scale in AFTER the slide.
- Keep the existing engine move/merge logic, scoring, determinism (seeded spawns), and tests intact (you may add helpers but don't break exports). If you need per-move position/merge metadata, derive it in the component or add a pure helper to engine.ts without changing existing behaviour.
- Honour reducedMotion (instant, no transitions when true). Smooth 60fps; no layout thrash.
VERIFY: /opt/homebrew/bin/npx vitest run src/games/g2048 must pass. Return structured result (id: "g2048").`,
    { label: 'anim:g2048', phase: 'Games', schema: GAME_SCHEMA, effort: 'high' })
    .then((r) => (r ? { ...r, id: 'g2048' } : { id: 'g2048', testsPass: false, summary: 'null' })),
  // slide animations + hint
  () => agent(`${COMMON}

TASK: Add real TILE-SLIDE ANIMATION and a HINT to Tile Slide (${ROOT}/src/games/slide/Slide.tsx). Read the component + engine first.
- Animate the tile sliding into the blank (CSS transform translate transition ~120-160ms) instead of an instant swap. Use absolutely-positioned tiles with stable ids keyed by tile value so moves animate smoothly.
- Add a HINT (max 3) using <HintButton/>: highlight (and optionally auto-make) the next tile move that reduces distance toward the solved state — compute a sensible next-move via a pure helper in engine.ts (e.g. a BFS/greedy next-step or move a tile whose target is adjacent to the blank). Don't break the existing solvable/parity tests or exports. Deduct score per hint; record detail.hintsUsed; persist hintsUsed.
- Honour reducedMotion (instant when true). Keep determinism + onComplete-once + savedState/onPersistState.
VERIFY: /opt/homebrew/bin/npx vitest run src/games/slide must pass. Return structured result (id: "slide").`,
    { label: 'anim+hint:slide', phase: 'Games', schema: GAME_SCHEMA, effort: 'high' })
    .then((r) => (r ? { ...r, id: 'slide' } : { id: 'slide', testsPass: false, summary: 'null' })),
]

const games = await parallel(gameTasks)
log(`Games phase: ${games.filter((g) => g.testsPass).length}/${games.length} passing`)

phase('Platform')

const platTasks = [
  () => agent(`${COMMON}

TASK: ONBOARDING + CLEAN-SWEEP CELEBRATION.
1. Create ${ROOT}/src/components/Onboarding.tsx ("use client"): a first-run modal (use @/components/ui/Modal) that introduces BrainTap — the daily 15-game format, the six brain skills, and how streaks work — in 2-3 tasteful slides or one rich panel, with a "Start playing" button. Gate it on the progress store's onboarded flag: show only when !onboarded && hydrated, and call setOnboarded(true) on dismiss/finish. Read useProgress from @/lib/progress (it already has onboarded + setOnboarded). Match the design.
2. Create ${ROOT}/src/components/CleanSweep.tsx ("use client"): a render-aware component that watches the progress store; when ALL 15 games are completed for today (Object.keys(results[todayISO()]).length === 15), show a celebratory modal ("Clean Sweep!" — all 15 solved) with confetti/particle flair (gated by reducedMotion/zen) and a share button (use @/lib/share). Show it only ONCE per day — guard with a localStorage key like braintap-cleansweep-<date> (do NOT modify @/lib/progress.ts). Use ALL_GAMES count = 15 from @/lib/games or the constant 15.
3. Edit ${ROOT}/src/app/providers.tsx to mount <Onboarding/> and <CleanSweep/> inside the provider tree, PRESERVING the existing AuthProvider, ZenController, and ProfileSync. This is the ONLY shared file you may edit.
Do not touch game folders, layout.tsx, or other lib files. Return structured result (area: "onboarding+cleansweep").`,
    { label: 'plat:onboarding', phase: 'Platform', schema: PLAT_SCHEMA, effort: 'high' }),

  () => agent(`${COMMON}

TASK: OPEN GRAPH / SOCIAL IMAGES + metadata.
Using Next.js App Router ImageResponse (next/og):
1. Create ${ROOT}/src/app/opengraph-image.tsx (and re-export or duplicate as twitter-image.tsx) — a 1200x630 branded card: dark #03040b background, neon cyan→magenta gradient accents, the "BRAINTAP GAMES" wordmark + tagline "Fifteen brain games. One a day." Use the runtime/size/contentType exports the API expects.
2. Create ${ROOT}/src/app/play/[game]/opengraph-image.tsx — a per-game card that reads the game from params (use GAME_METAS by id) showing the game name, category, and its accent colour. Provide generateImageMetadata or use params; handle unknown ids gracefully.
3. Edit ${ROOT}/src/app/layout.tsx metadata to add openGraph + twitter (card: summary_large_image) fields (title, description, siteName, type) and metadataBase. This is the ONLY shared file you may edit (preserve existing metadata + viewport + fonts + body structure).
Keep it edge-safe (next/og). Do not touch game folders or providers.tsx. Return structured result (area: "og-images").`,
    { label: 'plat:og', phase: 'Platform', schema: PLAT_SCHEMA, effort: 'high' }),

  () => agent(`${COMMON}

TASK: ERROR + LOADING + NOT-FOUND boundaries (all NEW files, no shared-file edits).
Create, matching the dark-neon design (use the app's colours/fonts, a centered card, links back home):
- ${ROOT}/src/app/error.tsx ("use client", with reset()) — friendly route error screen.
- ${ROOT}/src/app/global-error.tsx ("use client") — top-level fallback (must render its own <html><body>).
- ${ROOT}/src/app/not-found.tsx — branded 404 with a link to today's puzzles.
- ${ROOT}/src/app/loading.tsx — a tasteful top-level loading state (spinner/skeleton in brand style).
- Per-section loading skeletons: ${ROOT}/src/app/stats/loading.tsx, ${ROOT}/src/app/archive/loading.tsx, ${ROOT}/src/app/leaderboard/loading.tsx — simple skeleton placeholders consistent with each page's layout.
Do not edit any existing file. Return structured result (area: "error-loading").`,
    { label: 'plat:boundaries', phase: 'Platform', schema: PLAT_SCHEMA, effort: 'medium' }),
]

const platform = await parallel(platTasks)

return { games, platform: platform.filter(Boolean) }
