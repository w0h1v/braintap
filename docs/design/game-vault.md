# Memory Vault — Production Specification

## Executive Summary

**Memory Vault** is a pattern-recall game that tests and trains working memory through increasingly difficult spatial sequences. Players watch a grid of cells illuminate in a pattern, then tap the cells back in the correct order. Each successful round adds one more cell to memorize, continuing until the player makes a mistake. The game leverages spatial chunking and pattern recognition to build working memory capacity.

**Game ID:** `vault`  
**Accent Color:** Cyan (#00e5ff)  
**Primary Button Gradient:** `linear-gradient(118deg, #00e5ff, #7b8cff)`  
**Theme:** Cognitive science, minimalist dark UI, spatial focus  

---

## Core Mechanics & Rules

### Round & Level Structure

- **Round:** A single play session. Starts at Round 1, increments by 1 each successful sequence.
- **Level:** Number of cells in the pattern to memorize. Starts at 3, increments by 1 after each successful round.
- **Win Condition:** Clear 10 consecutive rounds (reaching Level 13 and successfully reproducing it). When the player completes a pattern at Level 12, advancing to Level 13 triggers immediate win.
- **Lose Condition:** Tap any cell not in the current pattern during the input phase, or tap a cell already tapped in the current sequence.

### Game Flow (Single Round)

1. **Idle Phase**: Player sees grid in neutral state with "Start sequence" button visible. Header shows current Round and Level (cell count).
2. **Presentation Phase** ("show"):
   - Button hides
   - Message displays "Memorize…"
   - `st.level` cells light up cyan (#00e5ff) with glow effect (box-shadow: 0 0 16px rgba(0,229,255,.7))
   - Cells illuminate simultaneously, all at once
   - Display duration: 900ms + (level × 350ms)
     - Level 3 = 1950ms
     - Level 12 = 5100ms
3. **Input Phase** ("input"):
   - All cells return to neutral (dark background)
   - Message displays "Now rebuild the pattern"
   - Player may tap cells in any order during this phase
   - Tapping order does NOT matter — only the set of cells tapped
4. **Evaluation & Feedback**:
   - **Correct Cell**: Cell lights green (#7CF5C4) with glow (0 0 16px rgba(124,245,196,.6))
   - **Wrong Cell**: Cell lights red (#ff5a7c), message changes to "Wrong cell!", all remaining unrevealed correct cells flash cyan as visual feedback, then vaultEnd(false) is called after 900ms delay
   - **Complete Set**: Once all correct cells are tapped, message shows "Round [N] cleared ✓"
5. **Advance**:
   - Round increments
   - Level increments
   - Button text changes to "Next round"
   - If Level > 12, vaultEnd(true) fires (win state)
   - Otherwise, button becomes visible and waits for player tap

### Pattern Selection Algorithm

- Pool of 25 cells (5x5 grid)
- Fisher-Yates shuffle of cell indices
- Select first `st.level` cells from shuffled pool
- Ensures no repeats within a round's pattern

### Scoring & Completion

- **Reach**: Highest round number achieved (round when player made mistake, or 13 if won)
- **Held**: Number of cells in working memory (level - 1 if lost mid-round, or final level if won)
- **Share Text**: `"BrainTap · Memory Vault\nReached round ${st.round} (${st.level} cells)\n\nbraintap.app/games"`
- **Daily Lock**: Once played today (marked via `this.markPlayed('v')`), game displays "Played today — replay for practice" and allows infinite replays without affecting daily completion status.

---

## UI Layout & Visual Design

### Screen Structure

```
VAULT SCREEN (id="screen-vault")
└── Main Container (max-width: 460px, centered, padding: 96px 20px 40px)
    ├── Header Row
    │   ├── Back Button: "← Today" (bt-go-home)
    │   ├── Title Section
    │   │   ├── "Memory Vault" (Space Grotesk, 600 weight, 18px, #f3f7ff)
    │   │   └── "ROUND [N] · [LEVEL] CELLS" (JetBrains Mono, 10.5px, #9fe9ff, letter-spacing: 0.1em)
    │   └── Spacer (width: 60px, right alignment)
    ├── Status Message (id="vault-msg")
    │   ├── Min-height: 24px, top-margin: 22px
    │   ├── Font: JetBrains Mono, 13px, #9fe9ff
    │   ├── Content varies: "Memorize…" | "Now rebuild the pattern" | "Round N cleared ✓" | "Wrong cell!"
    ├── Grid Container (id="vault-grid")
    │   ├── 5×5 CSS Grid
    │   ├── Grid template: repeat(5, 1fr)
    │   ├── Gap: 9px
    │   ├── Top margin: 10px
    │   └── Cells: see Cell Styling below
    └── Start Button (id="vault-start")
        ├── Class: bt-primary
        ├── Gradient: linear-gradient(118deg, #00e5ff, #7b8cff)
        ├── Text: "Start sequence" (changes to "Next round")
        ├── Padding: 14px 30px
        ├── Font: Space Grotesk, 600 weight, 15px
        ├── Color: #04060f (dark)
        └── Border-radius: 12px
```

### Cell Styling

**Dimensions & Position:**
- Size: 58px × 58px
- Border-radius: 11px
- Cursor: pointer
- Transition: all 0.2s

**States:**

| State | Background | Border | Box-Shadow | Usage |
|-------|-----------|--------|-----------|-------|
| Neutral (off) | rgba(255,255,255, .045) | rgba(255,255,255, .09) | none | Default idle state |
| Show (cyan) | #00e5ff | #00e5ff | 0 0 16px rgba(0,229,255, .7) | During presentation phase |
| Good (green) | #7CF5C4 | #7CF5C4 | 0 0 16px rgba(124,245,196, .6) | Correct cell tapped |
| Bad (red) | #ff5a7c | #ff5a7c | 0 0 16px rgba(255,90,124, .6) | Wrong cell tapped |

### Game States & UI Changes

| Phase | Button Visible | Message | Cells Interactive | Cell States |
|-------|----------------|---------|------------------|------------|
| Idle | Yes | (empty) | No | All neutral |
| Show | No | "Memorize…" | No | N cells cyan (glowing) |
| Input | No | "Now rebuild the pattern" | Yes | All neutral until tapped |
| Win/Advance | Yes | "Round N cleared ✓" | No | All neutral |
| Loss | No | "Wrong cell!" | No | Wrong cell red, unrevealed correct cells cyan |

### Modal (End Screen)

Appears on game over (win or loss):

```
MODAL CONTAINER (centered, text-align: center)
├── Status Label (JetBrains Mono, 11px, letter-spacing: 0.2em)
│   ├── Color: #7CF5C4 if won, #ff7a9c if lost
│   ├── Text: "VAULT MASTERED" | "SEQUENCE BROKEN"
├── Round Display (Space Grotesk, 600 weight, 30px, #f3f7ff, margin-top: 8px)
│   └── "Round [N]"
├── Subtitle (14px, rgba(226,234,255, .6), margin-top: 6px)
│   └── "You held [LEVEL] cells in working memory."
├── Brain Insight Box
│   ├── Background: rgba(0,229,255, .06)
│   ├── Border: 1px solid rgba(0,229,255, .18)
│   ├── Border-radius: 14px
│   ├── Padding: 16px
│   ├── Label: "🧠 BRAIN INSIGHT" (JetBrains Mono, 10px, #9fe9ff)
│   └── Text: "Most people hold about 4 items in working memory at once. Spatial-pattern practice nudges that ceiling upward over time."
├── Share Button (bt-primary, full-width, margin-top: 18px)
│   ├── Gradient: linear-gradient(118deg, #00e5ff, #7b8cff)
│   └── Text: "Share result"
└── Back Button (bt-ghost, full-width, margin-top: 10px)
    └── Text: "Back to today"
```

---

## Interactions & Input Handling

### Click/Tap Interactions

- **"Start sequence" / "Next round" Button**: Initiates `start()`, which launches the show phase.
- **Grid Cells** (during input phase): `pick(cellIndex)` is called.
  - Only works when `st.phase === 'input'`
  - Ignores already-tapped cells (checked via `st.picked.has(i)`)
  - No double-tapping same cell

### Drag & Gesture

- **NOT implemented in prototype** (single-tap only)
- **Production recommendation**: Support swipe-up/down for navigation; cells remain tap-based

### Keyboard

- **NOT implemented in prototype**
- **Production recommendation**: Add arrow keys or number pad (1–25) for accessibility; spacebar to start

### Mobile Gestures

- **Prototype**: Standard touch-tap
- **Production**: Add haptic feedback on cell tap (vibration pulse)

### Hit Detection

- Cells are 58×58px buttons with standard click handlers
- No collision with adjacent cells (9px gap ensures separation)
- Touch targets meet WCAG AA (min 48×48px) ✓

---

## Animations & Feedback

### Cell Reveal (Presentation Phase)

- Cells transition to cyan with 0.2s ease on style change
- Glow effect is instantaneous (box-shadow applied immediately)
- No transform/scale animation; flat appearance (focus on clarity)

### Correct Feedback

- Cell turns green immediately
- Subtle glow reinforces success
- No bounce or scale transform (minimalist aesthetic)

### Error Feedback

- Wrong cell flashes red
- Remaining unrevealed correct cells flash cyan as a "reveal" clue
- After 900ms, `vaultEnd(false)` closes the game

### Success Feedback

- Message updates to "Round N cleared ✓"
- No animation; text change only
- Button reappears after state transition

### Global Animations

The framework includes these keyframes (used elsewhere, not directly in Vault):

```css
@keyframes btPulse  { 0%, 100% { opacity: 0.4; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.2); } }
@keyframes btRise   { 0% { transform: translateY(16px); } 100% { transform: translateY(0); } }
@keyframes btPop    { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
@keyframes btShake  { /* shake pattern */ }
```

**Vault-specific**: Minimal animation. Cell color changes use 0.2s transition; message updates are instant.

---

## Embedded Data

### Game Configuration (Hardcoded in initVault)

```javascript
// Vault-specific constants
const N = 25;                      // Total cells in grid (5×5)
const INITIAL_LEVEL = 3;           // Starting pattern size
const MAX_LEVEL = 13;              // Win condition (reach and complete Level 13)
const SHOW_DURATION_BASE = 900;    // 900ms base
const SHOW_DURATION_PER_LEVEL = 350; // +350ms per level
const LOSS_DELAY = 900;            // Delay before vaultEnd(false) modal

// Initial state structure
const st = {
  round: 1,           // Current round (1-indexed)
  level: 3,           // Current level (number of cells in pattern)
  pattern: new Set(), // Indices of lit cells (0-24)
  picked: new Set(),  // Indices tapped by player this round
  phase: 'idle'       // 'idle' | 'show' | 'input' | 'over' | 'await'
};
```

### Game Metadata (from initTeasers context)

```javascript
vault: {
  name: 'Memory Vault',
  color: '#00e5ff',
  how: [
    'Watch the cells that light up, then rebuild the pattern from memory.',
    'Press Start, memorise the lit cells, then tap them back.',
    'Each cleared round adds one more cell.',
    'One wrong tap ends the run.'
  ],
  tip: 'Chunk the pattern into small shapes rather than individual cells.'
}
```

### No External Data Files

- Vault has NO word lists, riddles, or puzzle definitions to load
- Patterns are procedurally generated each game session
- No daily puzzle bank needed (patterns are seeded by round within session)

---

## Daily-Level Bank Requirements

### Does This Game Need a Pre-Generated Level Bank?

**NO.** Memory Vault generates patterns procedurally within each game session using Fisher-Yates shuffle. Every game produces a unique sequence of patterns, with no two sessions identical (unless seeded identically, which does not happen here).

### Why NOT a Bank?

1. **Infinite Replayability**: Patterns are generated on-the-fly; no need to pre-generate daily puzzles.
2. **Solvability is Trivial**: Every pattern is inherently solvable because:
   - We simply pick N cells from the 25-cell grid
   - The player's task is to recall and tap them
   - There is no "unsolvable" pattern in the memory domain
3. **Seeding is Session-Based**: The prototype does NOT seed patterns by calendar date; it uses runtime RNG (Math.random()). No daily rotation logic exists.

### Prototype Limitation vs. Production

- **Prototype**: `Math.random()` for Fisher-Yates shuffle. Different every session, every play.
- **Production Alternative** (if daily replay consistency desired):
  - Seed RNG by `Math.floor(Date.now() / 864e5)` (day number since epoch)
  - All players see the same sequence within one calendar day
  - Enables daily ranking and leaderboard

### If a Daily Bank Were Desired (Future Consideration)

If production decides to lock sequences per day for leaderboards:

**Bank Size**: 365 pre-generated sequences (one per calendar day).

**Data Shape** (one level/day):
```javascript
{
  date: '2024-01-15',           // ISO date
  sequenceOfLevels: [
    [2, 5, 12, 24],             // Level 3: cell indices
    [2, 5, 12, 24, 18],         // Level 4
    [2, 5, 12, 24, 18, 7],      // Level 5
    // ... up to Level 13
  ]
}
```

**Generation & Storage**:
- Pre-generate 365 entries at build time using a seeded RNG with fixed seed
- Store in `/data/vault-daily-levels.json`
- Load at init; fetch by calendar date

**Validation**: See "Solvability Validation" below.

---

## Solvability Validation

### Memory Vault Solvability

Because patterns are sampled from a finite set (25 cells) and the player's task is pure recall with no search/solve required, **all patterns are trivially solvable by definition**:

- A pattern of N cells can always be "solved" by tapping those N cells in any order
- There is no deduction, logic, or constraint satisfaction (unlike Sudoku or Pips)
- "Solvability" = "pattern is well-defined and reproducible"

### Validation Algorithm

**Not needed for runtime**, but here is the shape for pre-generation validation:

```javascript
function validateVaultLevel(pattern, gridSize = 25) {
  // pattern: Set of cell indices
  // Returns: { valid: boolean, reason: string }
  
  // Constraint 1: Pattern is non-empty
  if (pattern.size === 0) {
    return { valid: false, reason: 'Pattern is empty' };
  }
  
  // Constraint 2: All indices in valid range [0, gridSize)
  for (const idx of pattern) {
    if (idx < 0 || idx >= gridSize) {
      return { valid: false, reason: `Index ${idx} out of range [0, ${gridSize})` };
    }
  }
  
  // Constraint 3: No duplicates (Set ensures this, but check for paranoia)
  if (pattern.size !== new Set(pattern).size) {
    return { valid: false, reason: 'Pattern contains duplicates' };
  }
  
  // Constraint 4: Pattern size matches level expectation
  // (e.g., Level N should have N cells)
  // const expectedSize = level; // pass in if needed
  // if (pattern.size !== expectedSize) {
  //   return { valid: false, reason: `Pattern size ${pattern.size} != expected ${expectedSize}` };
  // }
  
  return { valid: true, reason: 'Pattern is solvable' };
}
```

### Game-Specific Notes

- **Unique Solution**: N/A. There is only one "solution" per pattern: tapping the lit cells.
- **Reachability**: All patterns in levels 3–13 are reachable and completable by a human with typical working memory (cognitive science: 4 ± 2 items).
- **Difficulty Curve**: Built-in via level increment; no adjustment needed per pattern.

---

## Production Polish & Upgrades

### Over the Prototype

The prototype is a working MVP. The following upgrades should be implemented for production:

#### 1. **Responsive Design**
- [ ] Grid scales on mobile: max-width adaptive, cells shrink to fit small screens
- [ ] Button sizes adjust for touch (min 48×48px on mobile, 58×58px on desktop)
- [ ] Font sizes scale: `clamp(12px, 2vw, 18px)` for headers
- [ ] Padding adjusts for mobile (reduce top padding on small viewports)

#### 2. **Animation Enhancements**
- [ ] Cell glow animation (pulse during show phase): subtle opacity flicker or scale-up
- [ ] Transition smoothing: all cell color changes ease over 0.15s (faster than prototype's 0.2s for snappier feel)
- [ ] Modal entry: fade-in + slide-up (btRise animation)
- [ ] Cell tap feedback: very subtle scale (1 → 1.05 → 1) on click

#### 3. **Haptic Feedback**
- [ ] Tap cell during input phase: light vibration (navigator.vibrate([10]))
- [ ] Correct cell tapped: medium vibration ([20, 10, 20])
- [ ] Error (wrong cell): strong vibration pattern ([50, 30, 50, 30, 100])
- [ ] Win condition: celebratory pattern ([100, 50, 100, 50, 200])
- [ ] Graceful fallback: no error if Haptics API unavailable

#### 4. **Accessibility & ARIA**
- [ ] Button aria-labels: "Start sequence, memorize 3 cells" | "Next round, memorize 4 cells"
- [ ] Cell aria-labels (for screen readers): "Cell row X column Y, tap to select"
- [ ] ARIA live region (vault-msg): role="status" aria-live="polite" for message updates
- [ ] Keyboard navigation: Tab to move focus; Space/Enter to activate; Arrow keys (optional, for power users)
- [ ] Reduced motion: Respect prefers-reduced-motion media query (skip animations, keep colors)
- [ ] Contrast: All text meets WCAG AA (4.5:1 for small text, 3:1 for large)

#### 5. **Keyboard Support**
- [ ] Spacebar to start game (when focused on button)
- [ ] Arrow keys (during input phase) or numpad (1–25) to select cells in grid order
- [ ] Escape to abandon game (or just allow back button)
- [ ] Number row (1–25) as alt input for grid cells (9 cells visible at once; may not be practical; skip if UX doesn't support)

#### 6. **Difficulty & Progression**
- [ ] **Current**: Linear (each round +1 cell). Adequate for working memory training.
- [ ] **Recommended**: Keep linear progression; well-researched in cognitive training.
- [ ] **Optional Variant**: Add "Hard Mode" toggle at start (randomize cell locations per level, not just per game).

#### 7. **Hint System**
- [ ] Post-loss hint button: "Reveal one cell you missed" (appears in end modal)
- [ ] Hints are free (not limited)
- [ ] Displays one unrevealed cell in cyan for 1 second

#### 8. **Share & Social**
- [ ] Share button (already in prototype): pre-filled share text, copy-to-clipboard fallback
- [ ] **Production**: Open native share on mobile (navigator.share if available)
- [ ] **Graph generation** (optional): Render mini bar chart of round progression (mock: "█████ rounds cleared")

#### 9. **Timezone & Daily Locking**
- [ ] Use `this.markPlayed('v')` to set daily flag (already in prototype)
- [ ] Display "Played today — replay for practice" when game already completed
- [ ] Reset at midnight in user's local timezone (via localStorage date check; already handled in loadState)

#### 10. **Error Handling & Edge Cases**
- [ ] Grid initialization fails: Show error message, allow retry
- [ ] Level > 12 boundary: Ensure win modal fires, not error
- [ ] Rapid double-clicks on same cell: Deduplicate via `st.picked.has(i)` check (already done)
- [ ] Very fast level presentation (level ≥ 10): Display duration = 900 + (10 × 350) = 4400ms; ensure no mobile lag

#### 11. **Visual Polish**
- [ ] Dark mode fully baked in (prototype is dark; no light mode needed)
- [ ] Cell borders: Add subtle gradient or reflection (optional; keep minimal)
- [ ] Glow effect quality: Ensure box-shadow renders cleanly on mobile (no blur artifacts)
- [ ] Font rendering: Use font-smoothing: antialiased on dark backgrounds

#### 12. **Performance**
- [ ] Grid rendering: Optimize for 25 DOM nodes (minimal overhead)
- [ ] Interval cleanup: Ensure no memory leaks (use _cleanup array, as done in prototype)
- [ ] State management: Use minimal object structure (already lean)
- [ ] No external assets: All CSS/colors inline or in stylesheet

#### 13. **Testing Checklist**
- [ ] Win at level 13 (trigger vaultEnd(true))
- [ ] Lose on first wrong tap (any level)
- [ ] Lose on duplicate cell tap
- [ ] Daily flag persists across sessions
- [ ] Share text copies correctly
- [ ] Mobile touch works on 5x5 grid (no misclicks)
- [ ] Screen reader announces pattern and instructions
- [ ] Keyboard tab order is logical
- [ ] Reduced motion: animations don't play if preferred

---

## Technical Implementation Notes

### State Management

```javascript
const st = {
  round: 1,           // int, increments on win
  level: 3,           // int, increments on win, max 13 for win condition
  pattern: new Set(), // Set<int>, indices [0, 24]
  picked: new Set(),  // Set<int>, player's taps this round
  phase: 'idle'       // string: 'idle' | 'show' | 'input' | 'over' | 'await'
};
```

### Key Functions

| Function | Purpose | Triggers |
|----------|---------|----------|
| `initVault()` | Initialize game, create grid, bind handlers | On screen mount |
| `start()` | Shuffle pattern, show cells, transition to input | Button click |
| `pick(i)` | Handle cell tap, validate, update feedback | Cell click during input |
| `setCell(i, mode)` | Update cell color/glow (show, good, bad, off) | Internal |
| `vaultEnd(won)` | Open end modal, mark played, show stats | Win or loss |
| `clearAll()` | Reset all cells to neutral state | Between phases |
| `updateHead()` | Sync header round/level display | State change |

### Cleanup

The framework stores cleanup functions in `this._cleanup` array, which are invoked on unmount. Vault does not use this pattern (no intervals or listeners), so no cleanup needed beyond default.

### Integration Points

- **Daily marking**: Calls `this.markPlayed('v')` (game id: 'v')
- **State persistence**: Uses `this.S` object (game state from component)
- **Modal opener**: Calls `this.openModal(htmlString)`
- **Home navigation**: Buttons with class `bt-go-home` are handled globally

---

## Variant & Mode Ideas (Future)

### Challenge Modes (Post-MVP)

1. **Speed Mode**: Reduce show duration per level (e.g., 800ms base instead of 900ms)
2. **Darkness Mode**: Flash cells off-screen (cells disappear before input phase starts)
3. **Spatial Shuffle**: Randomize cell positions per round (not just per game)
4. **Dual Grid**: Two 5x5 grids; player alternates between them
5. **Multiplayer**: Two players race to finish same pattern (turn-based or simultaneous)

### Customization

- Allow player to adjust show duration (slider: 600–1200ms)
- Toggle glow effect intensity
- Dark mode contrast adjustment

---

## Summary

Memory Vault is a clean, focused working-memory trainer with simple rules, fast feedback loops, and built-in difficulty scaling. The production build should emphasize mobile responsiveness, haptic feedback, keyboard accessibility, and visual polish. No pre-generated level bank is required; patterns are procedurally generated each session. The game is trivially solvable at every level by design—difficulty comes from working memory constraints, not puzzle complexity.

**Status**: Ready for React/Next.js rebuild. All game logic, UI structure, and interaction patterns are documented. Estimated build time: 2–3 days for full feature parity + polish.

