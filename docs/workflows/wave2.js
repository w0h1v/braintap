export const meta = {
  name: 'braintap-wave2',
  description: 'Wave 2: Strands drag-select, undo/redo (Sudoku, Pips), difficulty selectors (Reversi/Simon/Schulte), confetti + share-as-image, modal focus-trap a11y, keyboard nav, CI + Playwright e2e',
  phases: [
    { title: 'Build', detail: 'feature agents on disjoint files, each re-verifying tests' },
  ],
}

const ROOT = '/Users/orie/dev/braintap'

const GAME_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['id', 'testsPass', 'summary'],
  properties: {
    id: { type: 'string' }, testsPass: { type: 'boolean' },
    filesWritten: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' }, testTail: { type: 'string' },
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

const COMMON = `BrainTap is a Next.js 14 + TS + Tailwind daily brain-games app at ${ROOT}. Match the dark-neon design (tokens in tailwind.config.ts: bg, ink/ink-soft/ink-mute, line/line-strong, accents cyan/magenta/peri/amber/mint/violet/orange +-soft; font-display, font-mono, rounded-pill, max-w-shell; animate-rise/pop/shake/solve). Reference: src/games/sudoku/Sudoku.tsx. Shared helpers: @/components/play/CompletionModal, @/components/play/HintButton, @/components/ui/Modal, @/lib/useGameClock, @/lib/share (formatClock, shareText), @/lib/haptics, @/lib/sound (sfx), @/lib/cn, GAME_METAS.<id>.accent. ALWAYS honour the reducedMotion prop. Keep determinism (no Math.random/Date.now in puzzle logic). Preserve contracts: onComplete called exactly once; savedState restore + onPersistState (JSON-serialisable, keep new fields OPTIONAL for backward-compat with old saves). Verify games with /opt/homebrew/bin/npx vitest run src/games/<id> (must pass). Do NOT edit files outside the scope listed in your task. Do NOT run the full build/tsc.`

const tasks = [
  // ---- undo/redo ----
  { kind: 'game', id: 'sudoku', label: 'undo:sudoku', schema: GAME_SCHEMA, prompt: `${COMMON}

TASK: Add UNDO/REDO to Sudoku (edit ONLY ${ROOT}/src/games/sudoku/Sudoku.tsx).
- Maintain a history stack of board states (entries + notes snapshots) on each value/note/erase/hint action. Add Undo and Redo buttons in the controls row (small, consistent with Notes/Erase), plus keyboard Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo. Disable when nothing to undo/redo or when won.
- Undo must restore the selected cell context sensibly. Keep persistence working (you may persist the history or just current state; if you skip persisting history, ensure undo simply resets within the session). Keep it JSON-serialisable and backward compatible.
- Honour reducedMotion. Re-run vitest src/games/sudoku (engine unchanged → must still pass). Return id "sudoku".` },

  { kind: 'game', id: 'pips', label: 'undo:pips', schema: GAME_SCHEMA, prompt: `${COMMON}

TASK: Add UNDO/REDO to Pips (edit ONLY files in ${ROOT}/src/games/pips/, primarily Pips.tsx).
- Maintain a history of placements; add Undo/Redo buttons + Ctrl/Cmd+Z / redo shortcut. Disable appropriately. Also add keyboard support to move between slots and place/flip a domino if not already present.
- Preserve onComplete-once, savedState/onPersistState (optional new fields), determinism. Re-run vitest src/games/pips (must pass). Return id "pips".` },

  // ---- keyboard nav for connections ----
  { kind: 'game', id: 'connections', label: 'kbd:connections', schema: GAME_SCHEMA, prompt: `${COMMON}

TASK: Add FULL KEYBOARD NAVIGATION + a11y polish to Neural Connections (edit ONLY ${ROOT}/src/games/connections/Connections.tsx).
- Make the 4x4 tile grid keyboard-operable: arrow keys move a focus/cursor between tiles, Enter/Space toggles selection of the focused tile, and Enter (when 4 selected) or a dedicated key submits. Ensure visible focus ring, roving tabindex, and aria-activedescendant or per-tile focus. Keep existing mouse/touch behaviour and the hint system intact.
- Preserve onComplete-once + savedState/onPersistState. Re-run vitest src/games/connections (must pass). Return id "connections".` },

  // ---- strands drag-select ----
  { kind: 'game', id: 'strands', label: 'drag:strands', schema: GAME_SCHEMA, prompt: `${COMMON}

TASK: Add DRAG-TO-SELECT to Mind Strands (edit ONLY ${ROOT}/src/games/strands/Strands.tsx).
- Support NYT-Strands-style pointer drag: press on a letter and drag across adjacent letters to build a path (pointer events: pointerdown/move/up; works for mouse + touch). Releasing submits the traced word. KEEP the existing tap-tap selection working too (both input modes coexist). Respect 8-directional adjacency + no cell reuse rules already in the engine/component.
- Keep the hint system + connector overlay intact, honour reducedMotion, preserve onComplete-once + savedState/onPersistState. Re-run vitest src/games/strands (must pass). Return id "strands".` },

  // ---- difficulty selectors ----
  { kind: 'game', id: 'reversi', label: 'diff:reversi', schema: GAME_SCHEMA, prompt: `${COMMON}

TASK: Add an AI DIFFICULTY selector to Reversi (edit ONLY files in ${ROOT}/src/games/reversi/).
- Add an Easy / Normal / Hard control (segmented control or pills) that sets the AI strength (e.g. search depth / randomness / corner-weighting). Default = Normal. The DAILY board seed stays canonical; difficulty only changes AI play strength. Persist the chosen difficulty (optional savedState field) and include it in result.detail.
- You MAY add an AI-strength parameter to the engine's AI function (additive, don't break existing exports/tests). Add board keyboard navigation if reasonable. Re-run vitest src/games/reversi (must pass). Return id "reversi".` },

  { kind: 'game', id: 'simon', label: 'diff:simon', schema: GAME_SCHEMA, prompt: `${COMMON}

TASK: Add a DIFFICULTY/SPEED selector to Sequence Echo (Simon) (edit ONLY files in ${ROOT}/src/games/simon/).
- Add Easy / Normal / Hard (or Slow/Normal/Fast) controlling playback speed (and optionally pad count if your design supports it) WITHOUT breaking the deterministic daily sequence. Default Normal. Persist choice (optional savedState field).
- Keep determinism + onComplete-once. Re-run vitest src/games/simon (must pass). Return id "simon".` },

  { kind: 'game', id: 'schulte', label: 'diff:schulte', schema: GAME_SCHEMA, prompt: `${COMMON}

TASK: Add a GRID-SIZE selector to Schulte Table (edit ONLY files in ${ROOT}/src/games/schulte/).
- Add 3x3 / 5x5 / 7x7 size options (default 5x5). Regenerate the grid deterministically per (date, size) using the seeded rng (no Math.random). The daily default remains 5x5; other sizes are practice variants. Persist the chosen size (optional savedState field). Adjust scoring/labels accordingly.
- You MAY parameterise the engine/generator by size (additive; keep existing exports + tests passing; update tests if needed but keep a "solvable"/permutation test). Re-run vitest src/games/schulte (must pass). Return id "schulte".` },

  // ---- completion: confetti + share-as-image ----
  { kind: 'plat', label: 'completion-fx', schema: PLAT_SCHEMA, prompt: `${COMMON}

TASK: Add WIN CONFETTI + SHARE-AS-IMAGE to the shared completion flow.
1. Create ${ROOT}/src/components/play/Confetti.tsx ("use client"): a canvas confetti burst (particles in the accent palette) that runs for ~1.4s when active; props { active: boolean; accent: Accent }. Render NOTHING / no animation when the user prefers reduced motion or zen mode (check the prefers-reduced-motion media query AND the progress store's settings.zen via useProgress). DPR-aware, cleans up rAF on unmount.
2. Create ${ROOT}/src/lib/shareImage.ts: export async function shareResultImage(opts: { gameName: string; title: string; statValue?: string; statLabel?: string; accent: Accent; shareText?: string }) that draws a branded ~1080x1080 (or 1200x630) card on an offscreen canvas (dark #03040b bg, accent gradient, BrainTap wordmark, game name, the big stat, and a footer braintap.app), then tries navigator.share({ files:[png] }) if supported, else triggers a download of the PNG. Never throw.
3. Edit ${ROOT}/src/components/play/CompletionModal.tsx ONLY: render <Confetti active={open && won} accent={accent}/> and add a secondary "Share image" button next to the existing share button that calls shareResultImage with the modal's props (gameName from title/eyebrow, statValue, statLabel, accent, share). Keep the existing API/props of CompletionModal unchanged so all games keep working.
Do NOT edit Modal.tsx, game folders, or other files. Return area "completion-fx".` },

  // ---- a11y: modal focus trap ----
  { kind: 'plat', label: 'a11y-modal', schema: PLAT_SCHEMA, prompt: `${COMMON}

TASK: Improve ACCESSIBILITY of the shared Modal (edit ONLY ${ROOT}/src/components/ui/Modal.tsx).
- Add a focus trap: when open, focus moves into the dialog; Tab/Shift+Tab cycle only within focusable elements inside it; focus returns to the previously-focused trigger element on close. Keep the existing behaviour (Escape closes, backdrop click closes, body scroll lock, role=dialog/aria-modal, animate-pop). Do NOT change the component's public props/signature (open, onClose, children, labelledBy, className) so CompletionModal/SettingsModal/Onboarding keep working. Robust to SSR.
Return area "a11y-modal".` },

  // ---- CI + e2e ----
  { kind: 'plat', label: 'ci-e2e', schema: PLAT_SCHEMA, prompt: `${COMMON}

TASK: Add CI + Playwright E2E scaffolding (new files; you may edit package.json ONLY for scripts/devDeps).
1. ${ROOT}/playwright.config.ts — Playwright Test config: testDir "e2e", baseURL http://localhost:3000, a webServer that runs the production build (command "npm run build && npm run start", reuseExistingServer in dev), chromium project + a mobile viewport project.
2. ${ROOT}/e2e/smoke.spec.ts — smoke tests: home loads + shows 15 game cards; visiting /play/<each of the 15 ids> renders a board with no uncaught page errors (listen for 'pageerror'); /play/notagame returns/shows 404; settings modal opens from the nav; a basic mobile-viewport check that there's no horizontal overflow on home. Use page.on('pageerror') to fail on real JS errors.
3. ${ROOT}/e2e/games.spec.ts — light interaction per game (click a cell/tile/key) asserting the UI reacts and no pageerror.
4. ${ROOT}/.github/workflows/ci.yml — GitHub Actions: on push/PR, Node 20, npm ci, then run typecheck, lint, vitest (npm test), build, and Playwright e2e (with browser install). Sensible caching.
5. Edit ${ROOT}/package.json: add "test:e2e": "playwright test" and add @playwright/test to devDependencies (pick a recent version). Do not remove existing scripts/deps.
You do NOT need to run the e2e locally (browser binaries are heavy; CI runs them) but ensure the config + specs are syntactically valid TypeScript and import correctly. Return area "ci-e2e".` },
]

phase('Build')

const results = await parallel(
  tasks.map((t) => () =>
    agent(t.prompt, { label: t.label, phase: 'Build', schema: t.schema, effort: t.label === 'ci-e2e' ? 'medium' : 'high' })
      .then((r) => r ?? { error: t.label }),
  ),
)

return results.filter(Boolean)