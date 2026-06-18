export const meta = {
  name: 'braintap-build-games',
  description: 'Build the 14 remaining BrainTap games in parallel — engine, generator, validated level bank, polished React UI, and passing solvability tests',
  phases: [
    { title: 'Build', detail: 'one specialist agent per game, each validates with vitest' },
    { title: 'Verify', detail: 'independent reviewer confirms tests pass + contract compliance' },
  ],
}

const ROOT = '/Users/orie/dev/braintap'

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'testsPass', 'filesWritten', 'summary'],
  properties: {
    id: { type: 'string' },
    testsPass: { type: 'boolean', description: 'did `npx vitest run src/games/<id>` pass' },
    bankSize: { type: 'number', description: 'number of validated levels/entries (0 if purely procedural)' },
    filesWritten: { type: 'array', items: { type: 'string' } },
    testCommandOutputTail: { type: 'string', description: 'last ~15 lines of the vitest run' },
    summary: { type: 'string', description: 'what was built + any caveats' },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'pass', 'issues'],
  properties: {
    id: { type: 'string' },
    pass: { type: 'boolean', description: 'tests actually pass AND contract is followed' },
    testsPass: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
}

const GAMES = [
  { id: 'connections', pascal: 'Connections', bank: 'BANK. Curate a POOL of >=44 themed brain-science categories (label, accent colour, >=4 member terms, one-sentence insight). The daily generator deterministically picks 4 categories -> 16 unique terms, and MUST verify no chosen term plausibly belongs to another chosen category set (ambiguity guard). validatePuzzle: 4 groups, 16 unique words, no cross-membership. Test: 180 days valid + unambiguous.' },
  { id: 'brainle', pascal: 'Brainle', bank: 'BANK. Answers bank >=365 five-letter words (brain/cognition-themed first, then common words) + a large valid-guess set. Copy the word data you need from design_src/brainle-words.js into your folder. Daily answer = bank[bankIndex]. validatePuzzle: 5 letters, uppercase, present in the valid-guess set. Test: every answer well-formed + in dictionary + the 5-letter feedback evaluator is correct (exact/present/absent incl. duplicate-letter handling).' },
  { id: 'strands', pascal: 'Strands', bank: 'BANK + PACKER. Curate >=60 theme sets (theme title, 4-6 theme words, one spangram that uses all letters / spans the grid). Build a deterministic grid packer (backtracking) that lays every theme word + spangram into a grid (e.g. 6 wide x 8 tall) as connected paths (8-directional adjacency, no cell reused) covering ALL cells, then validate every word is findable and the spangram touches both required edges. validatePuzzle + test: 180 days fully packable & every word findable.' },
  { id: 'forge', pascal: 'Forge', bank: 'PROCEDURAL with uniqueness. Generate a nonogram (start 5x5; you may scale difficulty) — seed a solution, derive row/col clues, and run a line-solver to confirm the clues yield a UNIQUE solution; reseed/tweak until unique. Optionally seed from a curated set of pleasing glyph solutions. validatePuzzle: clues match solution AND unique. Test: 180 days unique-solvable.' },
  { id: 'weaver', pascal: 'Weaver', bank: 'DICTIONARY + generator. Bundle a word list in your folder. Daily: pick 7 distinct letters that form at least one pangram (a valid word using all 7), choose a required center letter, and precompute the set of all valid words (>= ~20). validatePuzzle: pangram exists, center letter in every valid word, >= min words. Test: 180 days have a pangram + minimum word count; scoring (1pt 4-letter, length-based, +bonus pangram) is correct.' },
  { id: 'vault', pascal: 'Vault', bank: 'PROCEDURAL. Deterministic per-day light-up pattern sequence on a grid (rounds add a cell). Winnable by construction. Persist progress. Test: determinism (same date => same sequence) + every round target is a valid in-bounds cell.' },
  { id: 'teasers', pascal: 'Teasers', bank: 'BANK. Curate >=120 lateral-thinking riddles: {question, choices[4], answerIndex, aha}. Daily picks 5 distinct (deterministic). validatePuzzle: 4 unique choices, valid answerIndex, non-empty aha. Test: ALL riddles well-formed + daily 5 are distinct across 180 days sampled.' },
  { id: 'sprint', pascal: 'Sprint', bank: 'PROCEDURAL. 60s timed. Generate a number grid + sequence of targets where each target is reachable by tapping a subset that sums to it (guarantee solvable). Deterministic. validatePuzzle/Test: for 180 days, every target has at least one achievable subset from the available numbers.' },
  { id: 'pips', pascal: 'Pips', bank: 'PROCEDURAL with solver (NYT Pips style). Build a board of regions/columns each with a target sum (or equality) constraint; place dominoes (each 2 pip-cells) to tile the board satisfying all constraints. Generate by tiling first (guarantees a solution), derive constraints, then optionally verify uniqueness with a solver. validatePuzzle: the known solution satisfies all constraints. Test: 180 days solvable.' },
  { id: 'g2048', pascal: 'G2048', bank: 'PROCEDURAL. Classic 4x4 2048. Deterministic seeded spawn sequence (2/4 tiles, positions) so the daily start + spawn order is reproducible; merges/move logic correct. Score-based. validatePuzzle/Test: determinism + move/merge engine correctness (slide+merge on rows/cols, no double-merge per move) + spawns land on empty cells.' },
  { id: 'schulte', pascal: 'Schulte', bank: 'PROCEDURAL. 5x5 grid of 1..25 in a deterministic shuffle per day. Tap in order, timed. Test: determinism + the grid is always a valid permutation of 1..25.' },
  { id: 'simon', pascal: 'Simon', bank: 'PROCEDURAL. Deterministic growing colour/tone sequence per day (4 pads). Watch then echo; grows each round. Test: determinism + sequence prefix-stability (round k sequence is prefix of round k+1) + pad indices in range.' },
  { id: 'slide', pascal: 'Slide', bank: 'PROCEDURAL with parity. 15-puzzle (4x4). Generate a deterministic scramble that is SOLVABLE (correct inversion+blank-row parity) and not already solved. validatePuzzle: solvable parity. Test: 180 days solvable & shuffled; move engine (slide tiles adjacent to blank) correct.' },
  { id: 'reversi', pascal: 'Reversi', bank: 'PROCEDURAL + AI. Standard 8x8 Reversi/Othello vs AI. Correct legal-move generation, flipping, pass/end rules. AI: greedy/minimax with corner & mobility weighting; deterministic given seed. Daily seed may pick the player colour / AI aggressiveness. Win = more discs than AI. Score from disc differential. Test: legal-move + flip correctness, AI always returns a legal move when one exists, full-game terminates.' },
]

function buildPrompt(g) {
  return `You are a senior game engineer building ONE production game for BrainTap (a daily brain-games web app, Next.js 14 + TypeScript + Tailwind).

GAME: "${g.id}" — implement it in ${ROOT}/src/games/${g.id}/ ONLY.

MANDATORY READING (read these fully before coding):
1. ${ROOT}/docs/GAME_CONTRACT.md — the contract you MUST follow.
2. ${ROOT}/docs/design/game-${g.id}.md — the full spec for THIS game (mechanics, data, UI, validation). Copy any embedded data (word lists, riddles, levels) from it.
3. The REFERENCE implementation — read every file: ${ROOT}/src/games/sudoku/engine.ts, generator.ts, Sudoku.tsx, index.ts, engine.test.ts. Mirror its structure and quality EXACTLY.
4. Skim ${ROOT}/src/lib/types.ts, rng.ts, daily.ts and the shared components in ${ROOT}/src/components/play/ and ${ROOT}/src/lib/ (useGameClock, share, haptics, sound, cn) — use them, do not reinvent.

DELIVERABLES (all inside src/games/${g.id}/):
- engine.ts (pure logic + types + validate function), generator.ts (deterministic getDailyPuzzle, memoised), the React component <${g.pascal}>.tsx ("use client"), index.ts (GameModule default export using GAME_METAS.${g.id}), engine.test.ts.
- LEVELS / SOLVABILITY APPROACH for this game: ${g.bank}

HARD REQUIREMENTS:
- Determinism: seed from the date via rngFromString(\`${g.id}:\${dailySeed("${g.id}", dateISO)}\`). NEVER use Math.random/Date.now/new Date in engine or generator.
- The component: call onComplete exactly once with a 0-100 score + shareText; restore from savedState; persist via onPersistState (JSON-serialisable only); honour reducedMotion; use the CompletionModal with a one-sentence brain-science insight; use GAME_METAS.${g.id}.accent colours.
- Mobile-first + desktop responsive, touch targets >=44px, ARIA labels, keyboard support where sensible.
- The id stub currently in index.ts (re-exporting stubModule) must be fully replaced.

VALIDATE BEFORE FINISHING (REQUIRED):
- Run: /opt/homebrew/bin/npx vitest run src/games/${g.id}
  (fallback: npx vitest run src/games/${g.id}). It MUST pass. Fix until green. The solvability test name must contain "solvable".
- Do NOT run the full Next build or full tsc (other agents are working in parallel). Keep all changes inside your folder. Do not edit _meta.ts, lib/, or other games.

Return the structured result. Set testsPass=true only if vitest actually passed; paste the tail of the vitest output.`
}

phase('Build')

const built = await parallel(
  GAMES.map((g) => () =>
    agent(buildPrompt(g), {
      label: `build:${g.id}`,
      phase: 'Build',
      schema: RESULT_SCHEMA,
      effort: 'high',
    }).then((r) => (r ? { ...r, id: g.id } : { id: g.id, testsPass: false, filesWritten: [], summary: 'agent returned null' })),
  ),
)

log(`Built ${built.filter((b) => b && b.testsPass).length}/${GAMES.length} games with passing tests`)

phase('Verify')

const verified = await parallel(
  GAMES.map((g) => () =>
    agent(
      `Independently verify the BrainTap game "${g.id}" at ${ROOT}/src/games/${g.id}/.
Steps:
1. Run: /opt/homebrew/bin/npx vitest run src/games/${g.id}  (fallback npx). Report whether it passes.
2. Read ${ROOT}/docs/GAME_CONTRACT.md and confirm the module complies: index.ts default-exports a GameModule using GAME_METAS.${g.id}; getDailyPuzzle is deterministic (seeded, no Math.random/Date.now); the component calls onComplete once, uses savedState/onPersistState (JSON-serialisable), CompletionModal, and the game's accent; engine.test.ts has a test containing "solvable".
3. Check the file is NOT still the placeholder stub.
4. Do NOT modify files. Only report.
Return the structured verdict (pass=true only if tests pass AND contract followed). List concrete issues if any.`,
      { label: `verify:${g.id}`, phase: 'Verify', schema: VERIFY_SCHEMA, effort: 'low' },
    ).then((r) => (r ? { ...r, id: g.id } : { id: g.id, pass: false, issues: ['verifier returned null'] })),
  ),
)

const failing = verified.filter((v) => v && !v.pass)
log(`Verify: ${verified.length - failing.length}/${verified.length} games pass`)

return { built, verified, failing }
