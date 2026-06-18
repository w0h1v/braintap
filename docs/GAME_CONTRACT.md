# BrainTap Game Module Contract

Every game is a self-contained module in `src/games/<id>/`. **The reference
implementation is `src/games/sudoku/` — read it in full and mirror its structure,
quality, and conventions.** Do not modify files outside your own game folder.

## Files you create (all inside `src/games/<id>/`)

| File | Purpose |
|------|---------|
| `engine.ts` | Pure, deterministic game logic + types. No React, no DOM, no globals. Fully unit-testable. |
| `generator.ts` | `getDailyPuzzle(dateISO)` — deterministic, memoised per date. |
| `levels.ts` / `levels.json` | (bank-based games only) the validated level bank. |
| `<Pascal>.tsx` | The `"use client"` React component. Polished, responsive, accessible. |
| `index.ts` | The `GameModule` default export wiring it together. |
| `engine.test.ts` | Vitest suite proving solvability/correctness. |

## The contract (from `src/lib/types.ts`)

```ts
interface GameModule<P, S> {
  meta: GameMeta;                        // import from "@/games/_meta": GAME_METAS.<id> — DO NOT redefine
  getDailyPuzzle: (dateISO: string) => P;
  Component: React.ComponentType<GameComponentProps<P, S>>;
  validatePuzzle?: (puzzle: P) => boolean;
}

interface GameComponentProps<P, S> {
  puzzle: P;
  dateISO: string;
  onComplete: (result: GameResult) => void;   // call EXACTLY once when finished
  savedState?: S | null;                       // resume in-progress state
  onPersistState?: (state: S) => void;         // persist resumable state (JSON-serialisable!)
  reducedMotion?: boolean;                      // honour it: skip long animations
  isArchive?: boolean;                          // past puzzle; same gameplay
}

interface GameResult {
  status: "won" | "lost" | "played";
  score: number;            // normalised 0–100 for cross-game leaderboards
  timeMs?: number; moves?: number; mistakes?: number; stars?: 1|2|3;
  shareText?: string;       // emoji/share string (Wordle tradition)
  detail?: Record<string, unknown>;
}
```

`index.ts` pattern (note the `any` for the state generic — required by the registry):
```ts
import { defineGame } from "@/lib/types";
import { GAME_METAS } from "@/games/_meta";
import { Foo } from "./Foo";
import { getDailyPuzzle } from "./generator";
import { validateFoo, type FooPuzzle } from "./engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineGame<FooPuzzle, any>({
  meta: GAME_METAS.<id>,
  getDailyPuzzle,
  Component: Foo,
  validatePuzzle: validateFoo,
});
```

## Determinism (critical)

- Same date ⇒ same puzzle for all players. NEVER use `Math.random()`, `Date.now()`,
  or `new Date()` inside `engine.ts`/`generator.ts`.
- Seed from the date using the shared helpers:
  ```ts
  import { rngFromString } from "@/lib/rng";   // Rng: next/int/float/pick/shuffle/chance
  import { dailySeed, bankIndex } from "@/lib/daily";
  const rng = rngFromString(`<id>:${dailySeed("<id>", dateISO)}`);
  ```
- Bank-based games pick with `bankIndex("<id>", BANK.length, dateISO)` so consecutive
  days walk the bank without repeats.
- Memoise `getDailyPuzzle` in a `Map<string, P>` (see sudoku/generator.ts).

## Shared utilities you SHOULD use (do not reinvent)

- `@/components/play/CompletionModal` — win/end modal (accent, title, statValue, statLabel, insight, share, extra, won).
- `@/lib/useGameClock` — `useGameClock(autostart, initialMs)` → `{ ms, running, start, stop, reset }`.
- `@/lib/share` — `shareText(text)` and `formatClock(ms)`.
- `@/lib/haptics` — `haptics.tap/success/error/win`.
- `@/lib/sound` — `sfx.tap/place/correct/wrong/win` (respects the sound setting).
- `@/lib/cn` — `cn(...classes)`.
- `@/games/_meta` — `GAME_METAS.<id>.accent` is `{ from, to, solid, soft }` (hex). Use it for your colours.

## Design system

Dark neon glassmorphism. Tailwind tokens are configured (`tailwind.config.ts`):
colors `bg`, `ink`/`ink-soft`/`ink-mute`/`ink-faint`, `line`/`line-strong`, accents
`cyan/magenta/peri/amber/mint/violet/orange` (+ `-soft`); fonts `font-display`
(Space Grotesk) and `font-mono` (JetBrains Mono); animations `animate-rise/pop/shake/
solve/floaty/pulse2`; `rounded-pill`, `shadow-glow-cyan`, `max-w-shell`. Match the
look of the sudoku game and the hub. Use your game's accent (`GAME_METAS.<id>.accent`)
for primary surfaces/buttons.

## Quality bar (every game)

- **Mobile-first + desktop**: fluid sizing (`clamp`, `min(92vw, …)`), touch targets ≥44px,
  works 320px→large. No horizontal scroll. Use `aspect-square`/grid for boards.
- **Accessibility**: semantic roles, `aria-label`s, keyboard support where sensible,
  `aria-live` for status, visible focus.
- **Feedback**: sfx + haptics + animation on key events; honour `reducedMotion`.
- **Resume**: persist in-progress state via `onPersistState`; restore from `savedState`.
  State MUST be JSON-serialisable (convert `Set`/`Map` to arrays).
- **Completion**: call `onComplete` once with a sensible 0–100 `score`, `shareText`,
  and a one-sentence brain-science `insight` in the modal.
- **Replay**: if `savedState` shows already-won, it's fine to let the user replay.

## Level banks & solvability

- Procedural games (sudoku, vault, schulte, simon, slide, 2048, sprint): generate from
  the daily seed; no stored bank. STILL validate invariants in tests (determinism +
  always-winnable, e.g. slide parity must be solvable).
- Bank games (connections, brainle, strands, forge, pips, teasers, weaver): ship an
  **extensive validated bank** in your folder. Target **≥365 entries** (≥120 acceptable
  only for heavily-curated riddle/category content, but go bigger if you can generate).
  Each entry validated by `validatePuzzle` and by tests.

## Tests (`engine.test.ts`) — REQUIRED

- Name the solvability test so it contains the word **"solvable"**.
- Bank games: assert EVERY bank entry passes `validatePuzzle` (unique/solvable, well-formed).
- Procedural games: assert determinism (same date ⇒ same puzzle), and that the daily
  puzzle is always winnable across ≥180 consecutive days from `2025-01-01`.
- Use `import { addDays } from "@/lib/daily"` to iterate dates.
- Validate with: `npx vitest run src/games/<id>` — it MUST pass before you finish.

## Hard rules

1. Only write inside `src/games/<id>/`. Never touch other games, `_meta.ts`, `lib/`, or shared components.
2. `meta` comes from `GAME_METAS.<id>` — never redefine it.
3. No `Math.random`/`Date.now`/`new Date` in engine/generator.
4. `onPersistState` payloads must be JSON-serialisable.
5. Your `npx vitest run src/games/<id>` must pass.
