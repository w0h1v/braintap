export const meta = {
  name: 'braintap-polish-games',
  description: 'Design-specialist polish pass on every game UI — visual fidelity, micro-interactions, mobile responsiveness, accessibility — without touching validated engine/tests',
  phases: [
    { title: 'Polish', detail: 'one design specialist per game, component-only, re-verifies tests' },
  ],
}

const ROOT = '/Users/orie/dev/braintap'

const GAMES = [
  { id: 'connections', comp: 'Connections' },
  { id: 'brainle', comp: 'Brainle' },
  { id: 'strands', comp: 'Strands' },
  { id: 'forge', comp: 'Forge' },
  { id: 'weaver', comp: 'Weaver' },
  { id: 'vault', comp: 'Vault' },
  { id: 'teasers', comp: 'Teasers' },
  { id: 'sudoku', comp: 'Sudoku' },
  { id: 'sprint', comp: 'Sprint' },
  { id: 'pips', comp: 'Pips' },
  { id: 'g2048', comp: 'G2048' },
  { id: 'schulte', comp: 'Schulte' },
  { id: 'simon', comp: 'Simon' },
  { id: 'slide', comp: 'Slide' },
  { id: 'reversi', comp: 'Reversi' },
]

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['id', 'testsPass', 'changed', 'improvements'],
  properties: {
    id: { type: 'string' },
    testsPass: { type: 'boolean' },
    changed: { type: 'boolean', description: 'did you modify the component' },
    improvements: { type: 'array', items: { type: 'string' } },
    testTail: { type: 'string' },
  },
}

phase('Polish')

const results = await parallel(
  GAMES.map((g) => () =>
    agent(
      `You are a senior product designer + front-end engineer doing a POLISH pass on ONE BrainTap game's UI. The game already works and its tests pass — your job is to elevate it from "functional" to "delightful and production-grade", WITHOUT breaking anything.

GAME: "${g.id}" — component at ${ROOT}/src/games/${g.id}/${g.comp}.tsx

READ FIRST:
- ${ROOT}/src/games/${g.id}/${g.comp}.tsx (the component you will polish)
- ${ROOT}/docs/design/game-${g.id}.md — especially the "Production Polish" section.
- ${ROOT}/src/games/sudoku/Sudoku.tsx — the quality/template reference.
- ${ROOT}/docs/design/design-system.md (skim) and ${ROOT}/docs/qa-report.md (known issues).

POLISH GOALS (apply what genuinely improves THIS game; be surgical, not a rewrite):
- Visual fidelity to the dark neon glassmorphism system; consistent use of the game's accent (GAME_METAS.${g.id}.accent), spacing, radii, typography (font-display / font-mono).
- Mobile-first responsiveness: NO horizontal overflow at 360–390px, boards use fluid sizing (clamp / min(92vw, …) / aspect-square), touch targets ≥44px, no text overflowing cells (use overflow-wrap/break-word or shrink fonts), comfortable thumb reach.
- Micro-interactions & feedback: smooth transitions, tasteful enter/success/error animations, sfx + haptics on key events — ALL gated by the reducedMotion prop. Don't add motion that ignores reducedMotion.
- Clear states: start/instructions, in-progress, won, lost; a polished CompletionModal with the brain-science insight + share; helpful empty/disabled styles.
- Accessibility: aria-labels/roles, aria-live for status, visible focus, keyboard support where sensible.

HARD CONSTRAINTS (do NOT violate):
- Edit ONLY ${ROOT}/src/games/${g.id}/${g.comp}.tsx. You MAY add a new presentational sub-component file inside ${ROOT}/src/games/${g.id}/ if helpful. Do NOT edit engine.ts, generator.ts, index.ts, *.test.ts, any data/bank file, or anything outside this game folder.
- Preserve behavior contracts: onComplete called exactly once with a sensible 0–100 score + shareText; savedState restore + onPersistState (JSON-serialisable); determinism untouched (no Math.random/Date.now in logic paths that affect the puzzle); honour reducedMotion.
- Keep imports valid; keep it TypeScript-clean.

VERIFY BEFORE FINISHING (required): run /opt/homebrew/bin/npx vitest run src/games/${g.id} (fallback: npx). It MUST still pass. Do NOT run the full build/tsc (parallel work).

Return the structured result (testsPass true only if vitest actually passed; list the concrete improvements you made; testTail = last lines of vitest).`,
      { label: `polish:${g.id}`, phase: 'Polish', schema: SCHEMA, effort: 'high' },
    ).then((r) => (r ? { ...r, id: g.id } : { id: g.id, testsPass: false, changed: false, improvements: ['agent returned null'] })),
  ),
)

const failed = results.filter((r) => !r.testsPass)
log(`Polish done. Tests passing: ${results.length - failed.length}/${results.length}`)
return { results, failed }
