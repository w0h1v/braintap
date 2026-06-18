# Mini Sudoku Game — Production Specification

**Title:** Mini Sudoku  
**Category:** Number Deduction  
**Grid Size:** 6×6 (composed of 2×3 boxes)  
**Digits:** 1–6  
**Daily Delivery:** Once per day, seeded puzzle  
**ID:** sudoku (flag key: 'doneK')

---

## 1. Core Mechanics & Rules

### Objective
Fill a 6×6 grid with digits 1–6 such that:
- Each row contains exactly one of each digit (1–6)
- Each column contains exactly one of each digit (1–6)
- Each 2×3 box (6 boxes total in a 6×6 grid, arranged 2 boxes wide × 3 boxes tall) contains exactly one of each digit (1–6)

### Puzzle Generation
1. **Generate a complete valid solution** using backtracking with randomized candidate selection.
2. **Create the puzzle** by removing clues from the solution.
   - Target: Remove 22 clues (leaving 14 clues from 36 cells).
   - Removal order: Randomized.
   - Constraint: Each puzzle must have **exactly one unique solution** (validated before inclusion).

### Win Condition
Player has filled all 36 cells such that the grid exactly matches the solution. Validation happens in real-time after each digit entry (check occurs after every move).

### Conflict Detection
A **conflict** occurs when the same digit appears more than once in:
- The same row
- The same column
- The same 2×3 box

**Visual Feedback:** Conflicting cells show in red (#ff6b9d); non-conflicting entries appear in the standard cell color.

### Game States
- **Start:** Grid displayed with given clues locked; empty cells ready for input. Timer starts immediately.
- **Playing:** Player enters/erases digits; timer continues; real-time conflict detection active.
- **Won:** All cells correctly filled; timer stops; completion modal shown with solve time.
- **Replaying:** If player has already solved today, show "Solved today — replay for practice" message.

---

## 2. UI Layout & Components

### Screen Layout
```
┌─────────────────────────────────────┐
│  ← Today  |  Mini Sudoku  | [spacer] │  Header
│          | NUMBER · 6×6 · 00:00     │
├─────────────────────────────────────┤
│        [message area]                │  Min-height: 20px
├─────────────────────────────────────┤
│    ┌──────────────────────────────┐  │
│    │  [6×6 Grid · 36 cells]       │  │  Grid container
│    │  (348px max width)           │  │
│    └──────────────────────────────┘  │
├─────────────────────────────────────┤
│  [1] [2] [3] [4] [5] [6]            │  Numpad (6 buttons)
├─────────────────────────────────────┤
│  [Notes · Off]  [Erase]             │  Control buttons
└─────────────────────────────────────┘
```

### Grid Styling
- **Container:** 348px max width (min(92vw, 348px)), aspect-ratio 1:1, centered
- **Layout:** CSS Grid, 6×6, gap: 0
- **Background:** rgba(155, 140, 255, 0.1)
- **Border:** 2px solid rgba(155, 140, 255, 0.4), border-radius: 12px
- **Cell borders:** 
  - Internal: 1px solid rgba(255, 255, 255, 0.07)
  - Box dividers (stronger): 2px solid rgba(155, 140, 255, 0.4) on right (after column 2, 5) and bottom (after row 1, 3)

### Cell States & Colors

| State | Background | Text Color | Font Weight | Notes |
|-------|-----------|-----------|------------|-------|
| **Given clue** | rgba(6, 10, 22, 0.55) | #c3b8ff | 700 (bold) | Locked, not editable |
| **Selected (empty)** | rgba(155, 140, 255, 0.3) | #eafcff | 500 | User tapped this cell |
| **Peer (same row/col/box as selected)** | rgba(255, 255, 255, 0.05) | #eafcff | 500 | Highlighted for context |
| **Same value as selected** | rgba(0, 229, 255, 0.18) | #eafcff | 500 | Matching digit highlighting |
| **Entered (no conflict)** | rgba(6, 10, 22, 0.55) | #eafcff | 500 | User-filled cell |
| **Conflict** | rgba(6, 10, 22, 0.55) | #ff6b9d | 500 | Duplicate in row/col/box |

### Notes Mode Display
When Notes mode is active and a cell contains candidates:
- Display a 3×3 grid of candidate numbers inside the cell
- Font: JetBrains Mono, 9px, rgba(226, 234, 255, 0.5)
- Each position represents candidate 1–6 (left-to-right, top-to-bottom):
  ```
  [1] [2] [3]
  [4] [5] [6]
  ```

### Typography
- **Game title:** Space Grotesk, 600 weight, 18px, #f3f7ff
- **Subtitle (timer/info):** JetBrains Mono, 10.5px, letter-spacing 0.1em, #c3b8ff
- **Message area:** JetBrains Mono, 12.5px, #c3b8ff
- **Grid numbers:** Space Grotesk, 22px, 500–700 weight (varies by state)
- **Button text:** Space Grotesk, 13.5px, 500 weight, #eaf1ff (or active state color)

### Control Buttons

**Numpad (6 buttons, 1–6)**
- Each: 46px × 54px
- Border: none, border-radius: 9px
- Background: rgba(155, 140, 255, 0.14)
- Text color: #eafcff
- Font: Space Grotesk, 600 weight, 20px
- Cursor: pointer

**Notes Button**
- State OFF: 
  - Text: "Notes · Off"
  - Color: #eaf1ff
  - Border: 1px solid rgba(255, 255, 255, 0.2)
  - Background: rgba(255, 255, 255, 0.04)
- State ON:
  - Text: "Notes · On"
  - Color: #c3b8ff
  - Border: 1px solid rgba(155, 140, 255, 0.6)
  - Background: rgba(255, 255, 255, 0.04)
- Both: border-radius: 100px, padding: 10px 20px, font-size: 13.5px

**Erase Button**
- Text: "Erase"
- Styling: Same as Notes button OFF state

---

## 3. Interactions

### Tap/Click
- **Select Cell:** Tap any empty (non-given) cell to select it. Re-tapping the same cell keeps it selected.
- **Enter Digit:** Tap a numpad button (1–6) to:
  - If Notes mode OFF: Set/toggle the digit in the selected cell (tapping same digit again clears it)
  - If Notes mode ON: Add/remove the candidate digit from the cell's note set
- **Toggle Notes:** Tap "Notes · Off/On" button to enter/exit note-taking mode
- **Erase:** Tap "Erase" button to clear the selected cell (both value and notes)

### Keyboard
- **Digit Keys (1–6):** Same as numpad tap
- **Backspace/Delete:** Same as Erase button
- **Only active** when sudoku screen is visible and puzzle not yet won

### Mobile Gestures
- **Tap:** All primary interactions via tap (same as click)
- **Long-press:** Not used in prototype; production may add context menu for hint/peek

### Edge Cases
- Cannot select given (clue) cells; they are read-only
- Cannot enter a digit into a cell that already contains that digit (first tap sets it, second tap clears it)
- Notes and value are mutually exclusive: setting a value clears notes; setting notes when a value exists does nothing
- Conflicts do not prevent entry; they are visual feedback only

---

## 4. Animations & Feedback

### Animations
- **Cell pop on entry:** When a tile appears (given clue on initial render), use `btPop` animation (0.18s ease): scale from 0.5 → 1.08 → 1, opacity 0 → 1
- **Grid shake on conflict:** When user completes grid with incorrect value(s), grid shakes 0.4s using `btShake` (horizontal translation pattern)
- **Success flash:** When solution is complete, no animation needed; immediate modal transition

### Keyframe Definitions
```css
@keyframes btPop {
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes btShake {
  10%, 90% { transform: translateX(-2px); }
  20%, 80% { transform: translateX(4px); }
  30%, 50%, 70% { transform: translateX(-7px); }
  40%, 60% { transform: translateX(7px); }
}
```

### Feedback Messages
- **Before puzzle solved:** Show message area empty (cleared after any interaction message fades)
- **After solving today:** Show "Solved today — replay for practice" on screen load (if doneK flag set)
- **On win:** Clear grid area and show completion modal (after 260ms delay to allow final render)

---

## 5. Completion Modal

Triggered when puzzle is solved. Content:

```
┌─────────────────────────────────────┐
│    PUZZLE COMPLETE                  │  (JetBrains Mono, 11px, letter-spacing 0.2em, #9b8cff)
│                                     │
│    Grid solved.                     │  (Space Grotesk, 600, 30px, #f3f7ff)
│                                     │
│    [MM:SS]                          │  (Space Grotesk, 600, 44px, #9b8cff, letter-spacing 0.04em)
│                                     │
│    SOLVE TIME                       │  (JetBrains Mono, 11px, letter-spacing 0.1em, rgba(226,234,255,0.5))
│                                     │
│  ┌──────────────────────────────┐  │
│  │ 🧠 BRAIN INSIGHT             │  │  (box with gradient background & border)
│  │                              │  │
│  │ Sudoku leans on working      │  │  (14px, line-height 1.55, rgba(226,234,255,0.82))
│  │ memory and deductive logic — │  │
│  │ you hold candidate numbers   │  │
│  │ in mind while systematically │  │
│  │ ruling out the impossible.   │  │
│  └──────────────────────────────┘  │
│                                     │
│  [Share result]                     │  (Primary button: gradient, 15px Space Grotesk 600)
│  [Back to today]                    │  (Ghost button: border, 14px Space Grotesk 500)
└─────────────────────────────────────┘
```

**Box Background:** rgba(155, 140, 255, 0.08)  
**Box Border:** 1px solid rgba(155, 140, 255, 0.2), border-radius: 14px

**Share Button:**
- Background: linear-gradient(118deg, #9b8cff, #00e5ff)
- Text color: #04060f
- Border: none, border-radius: 12px, padding: 14px, width: 100%, margin-top: 18px

**Back Button:**
- Background: rgba(255, 255, 255, 0.04)
- Border: 1px solid rgba(255, 255, 255, 0.16)
- Text color: #eaf1ff
- Border-radius: 12px, padding: 12px, width: 100%, margin-top: 10px

**Share Text:**
```
BrainTap · Mini Sudoku
Solved in MM:SS

🟪 6×6 deduction
braintap.app/games
```

---

## 6. Daily Level Bank & Solvability

### Strategy
**SEEDED PUZZLE (Procedural Generation)**

The prototype uses a **seeded LCG (Linear Congruential Generator)** to deterministically generate a unique puzzle for each calendar day. This approach eliminates the need for a pre-generated bank.

### Daily Seed Generation
```javascript
const seed = ((Math.floor(Date.now() / 864e5) * 1103515245) + 12345) & 0x7fffffff;
```

- **864e5** = milliseconds in one day (86,400,000)
- Math.floor(Date.now() / 864e5) = day counter since epoch
- LCG parameters: multiplier = 1103515245, increment = 12345, modulus = 2^31 − 1

**Result:** One unique seed per calendar day, deterministic across all users, same puzzle globally.

### Puzzle Generation Algorithm

1. **Generate full solution:**
   ```javascript
   const solveFill = (g) => {
     const p = g.indexOf(0);
     if (p < 0) return true;
     const r = Math.floor(p / N), c = p % N;
     for (const n of shuf([1, 2, 3, 4, 5, 6])) {
       if (okAt(g, r, c, n)) {
         g[p] = n;
         if (solveFill(g)) return true;
         g[p] = 0;
       }
     }
     return false;
   };
   ```
   - Start with empty 36-cell array
   - Fill cells left-to-right in scanning order
   - At each empty cell, try digits 1–6 in shuffled order
   - Recursively solve; backtrack if dead-end
   - Returns: Fully valid solution grid

2. **Create puzzle by removing clues:**
   ```javascript
   const puz = sol.slice();
   const order = shuf([...Array(36).keys()]);
   let removed = 0;
   for (const p of order) {
     if (removed >= 22) break;
     const bak = puz[p];
     puz[p] = 0;
     if (countSol(puz.slice(), 2) !== 1) {
       puz[p] = bak;
     } else {
       removed++;
     }
   }
   ```
   - Start with complete solution
   - Shuffle cell removal order
   - Attempt to remove each clue
   - **Uniqueness check:** Verify that removing a clue leaves exactly 1 solution
   - Continue until 22 clues are removed (or all cells attempted)
   - Result: 14 clues remain, puzzle has unique solution

### Solvability Validation Algorithm

**Uniqueness Check: `countSol(g, lim)`**
```javascript
const countSol = (g, lim) => {
  const p = g.indexOf(0);
  if (p < 0) return 1;
  const r = Math.floor(p / N), c = p % N;
  let cnt = 0;
  for (let n = 1; n <= 6; n++) {
    if (okAt(g, r, c, n)) {
      g[p] = n;
      cnt += countSol(g, lim);
      g[p] = 0;
      if (cnt >= lim) break;
    }
  }
  return cnt;
};
```

**Usage:** `countSol(puz.slice(), 2)` counts solutions up to a limit of 2.
- If it returns exactly 1: Puzzle has a unique solution → valid
- If it returns ≥2: Puzzle is ambiguous → clue is kept in

**Validity Check: `okAt(g, r, c, n)`**
```javascript
const okAt = (g, r, c, n) => {
  for (let i = 0; i < N; i++) {
    if (g[idx(r, i)] === n || g[idx(i, c)] === n) return false;
  }
  const br = Math.floor(r / BR) * BR, bc = Math.floor(c / BC) * BC;
  for (let i = 0; i < BR; i++)
    for (let j = 0; j < BC; j++) {
      if (g[idx(br + i, bc + j)] === n) return false;
    }
  return true;
};
```

Checks if placing digit `n` at (r, c) violates:
- Row constraint (same digit elsewhere in row)
- Column constraint (same digit elsewhere in column)
- 2×3 box constraint (same digit elsewhere in box)

### Data Shape (Single Level)

```typescript
interface SudokuPuzzle {
  solution: number[];        // 36 values: [0..35] -> 1..6, fully solved
  puzzle: number[];          // 36 values: [0..35] -> 1..6 or 0 (empty)
  given: boolean[];          // 36 bools: true = clue (locked), false = empty
  seed: number;              // LCG seed used to generate this puzzle
  timestamp: number;         // UTC milliseconds of generation (start of day)
  difficulty: 'easy' | 'medium' | 'hard';  // Based on clue count/placement pattern
}
```

Example:
```json
{
  "seed": 2147234567,
  "puzzle": [1, 0, 3, 0, 5, 6, 0, 2, 0, 4, 0, 0, 0, 0, 1, 3, 6, 0, ...],
  "given": [true, false, true, false, true, true, false, true, false, ...],
  "solution": [1, 4, 3, 2, 5, 6, 5, 2, 6, 4, 3, 1, 2, 1, 1, 3, 6, 5, ...]
}
```

### Why Seeded?
- **No storage overhead:** No need for a pre-built bank of 365+ puzzles
- **Infinite variety:** Same algorithm generates new puzzles from different seeds
- **Deterministic:** All users see the same puzzle each day
- **Reproducible:** If needed, same seed regenerates same puzzle
- **Scales:** Works for any time period without maintenance

---

## 7. Production Polish Over Prototype

### Responsiveness & Layout
- [ ] **Tablet layout:** Increase grid to 400px max-width on 600px+ screens
- [ ] **Large screens (desktop):** Increase to 460px max-width; center in viewport
- [ ] **Safe area insets:** Add padding on notch devices (iPhone X+)
- [ ] **Viewport meta tag:** Ensure `width=device-width, initial-scale=1, viewport-fit=cover`

### Animations & Micro-interactions
- [ ] **Cell selection bloom:** Smoothly animate cell background transition (200ms) rather than instant
- [ ] **Numpad button press feedback:** Subtle scale (0.95) on active state; add 80ms transition
- [ ] **Conflict pulse:** When cell enters conflict state, add a subtle red pulse (opacity 0.8 → 1) repeated 2x
- [ ] **Solve reveal:** On puzzle completion, animate cells one by one (staggered 20ms per cell) or grid flash
- [ ] **Haptic feedback:** Trigger `navigator.vibration.vibrate([50])` on:
  - Successful digit entry (25ms)
  - Conflict detection (100, 50, 100ms pattern)
  - Puzzle solved (pattern: 100, 50, 100, 50, 150ms)

### Accessibility & Keyboard
- [ ] **ARIA labels:** Add `aria-label="Cell row X column Y, value"` to each grid cell
- [ ] **ARIA live region:** Announce "Puzzle complete" and timer on solve
- [ ] **Tab navigation:** Enable tab-based cell selection (left/right/up/down arrows move focus)
- [ ] **Screen reader:** Announce conflict detection: "Duplicate in row/column/box"
- [ ] **Keyboard shortcuts:** (optional) arrow keys move selection; spacebar toggles note mode on current cell
- [ ] **Touch targets:** Minimum 44×44px for numpad buttons (already 46×54, good)

### Difficulty Curve & Variants (Future)
- [ ] **Difficulty tiers:**
  - Easy: 18+ clues
  - Medium: 14–17 clues
  - Hard: <14 clues
  - Select difficulty on entry screen before puzzle loads
- [ ] **Time attack mode:** 5-minute scramble, score based on correctness
- [ ] **Puzzle difficulty selector:** On daily completion, offer "Yesterday's puzzle" (easier) or "Next puzzle preview" (harder)

### Hint System
- [ ] **Hint button:** "Get a hint" reveals one correct digit
  - Show as modal: "A 5 goes in row 3, column 2"
  - Limit: 3 hints per puzzle (show counter)
  - Disable after puzzle solved
- [ ] **Candidate list:** On-demand show all possible candidates for selected cell
- [ ] **Naked singles highlight:** Auto-highlight cells where only one digit is valid
- [ ] **Hidden singles highlight:** (advanced) Highlight cells whose value is forced by row/col/box analysis

### Share Result
- [ ] **Share modal:** Customize share text with puzzle metadata (difficulty, solve time, moves)
- [ ] **Social integration:** Deep links to share pre-filled message on Twitter, Facebook, WhatsApp
- [ ] **Share image:** Generate and download a screenshot of the completed grid with stats
- [ ] **Leaderboard:** Track personal best times; compare with weekly/monthly leaderboards

### Edge Cases & Robustness
- [ ] **Undo/redo:** Stack of moves, undo back to start, redo forward to latest
- [ ] **Pause & resume:** Freeze timer and grid if user leaves screen; resume exactly where they left off
- [ ] **Backup state:** Periodic auto-save to localStorage so session survives accidental close
- [ ] **Offline support:** Pre-generate and cache seed-based puzzles for next 7 days at app startup
- [ ] **Puzzle validation:** On load, verify solution correctness (sanity check for any seeded corruption)
- [ ] **Conflict resolver:** If user has set conflicting digits and must correct, highlight the conflict and suggest which to change

### Notes Mode Enhancements
- [ ] **Keyboard entry for notes:** When in Notes mode, number keys add/remove from current cell's candidates
- [ ] **Notes persistence:** Save note state to localStorage so notes survive page reload
- [ ] **Clear all notes:** Button to clear all notes for current cell or entire grid
- [ ] **Auto-candidate inference:** Option to auto-populate candidates based on current grid state (solve for player, show only valid options)

### Theme & Visual Polish
- [ ] **Dark mode (current, no change):** Already implemented
- [ ] **Light mode (future):** Invert colors; adjust contrast ratios
- [ ] **Color-blind mode:** Option to use patterns (instead of colors alone) for conflict highlighting
- [ ] **Animations toggle:** Disable animations for accessibility / lower-motion preferences (prefers-reduced-motion)

### Performance
- [ ] **Memoization:** Cache `okAt()` results during solve to avoid redundant constraint checks
- [ ] **Web Worker:** Move puzzle generation to a worker thread so UI remains responsive
- [ ] **Lazy rendering:** Only render visible grid cells on large grids (not applicable to 6×6 but plan ahead for future variants)

### Error Handling
- [ ] **Seed collision recovery:** If two days yield same seed (impossible in practice, but plan for): add salt to seed
- [ ] **Corrupted localStorage:** Fall back to fresh solve if session state is unreadable
- [ ] **RNG fallback:** If LCG fails, fall back to Math.random() with warning in logs

---

## 8. Color Palette & Brand

### Primary Accent Color
**#9b8cff** (Lavender/Purple)

Used for:
- Game title
- Solve time display
- Grid border & box dividers
- Conflict highlight (secondary: #ff6b9d for conflict text)
- Button backgrounds (notes mode active)

### Secondary Accent Color
**#c3b8ff** (Light Purple)

Used for:
- Subtitle text
- Message area
- Given clue digits
- Brain Insight label

### Highlight Colors
- **Active/success:** #00e5ff (Cyan) — matching digits, button active gradient, peer highlight
- **Conflict:** #ff6b9d (Pink/Red) — conflicting cell text
- **Correct state (after solve):** #7CF5C4 (Green) — not used in sudoku, but in other games

### Background Colors
- **Primary dark:** #04060f (Almost black) — buttons, modals
- **Card surface:** rgba(155, 140, 255, 0.1) — grid container
- **Subtle highlight:** rgba(6, 10, 22, 0.55) — cell default background
- **Selection glow:** rgba(155, 140, 255, 0.3) — selected cell
- **Peer highlight:** rgba(255, 255, 255, 0.05) — row/col/box mates
- **Same value highlight:** rgba(0, 229, 255, 0.18) — cells with same digit as selected

### Text Colors
- **Primary text:** #f3f7ff (Off-white) — game title, main content
- **Secondary text:** #eaf1ff (Slightly warmer white) — cell entries, buttons
- **Tertiary text:** rgba(226, 234, 255, 0.5–0.82) — hints, timers, captions

---

## 9. Summary

Mini Sudoku is a **daily 6×6 deduction puzzle** that leverages working memory and logical constraint satisfaction. The game uses **procedural seeding** to generate a unique puzzle each calendar day, ensuring fairness and no storage overhead. Solvability is validated via exhaustive search (counting solutions up to 2). The UI is clean, spacious, and touch-optimized, with real-time conflict feedback and an optional Notes mode for candidate tracking. On solve, players see a completion modal with their time, a brain insight, and options to share or return home.

**Key metrics:**
- **Puzzle generation:** ~50ms on modern device
- **Uniqueness validation:** ~100–200ms (pruned search)
- **Grid render:** <16ms (60fps)
- **User interaction latency:** <100ms (input to cell update)
- **Target completion time:** 2–8 minutes (difficulty varies)

---

## 10. Embedded Data & Constants

### Puzzle Difficulty Guidance
```javascript
const difficultyThresholds = {
  easy: { minClues: 18, maxClues: 25 },
  medium: { minClues: 14, maxClues: 17 },
  hard: { minClues: 6, maxClues: 13 }
};
```

### Brain Insight Text
```
"Sudoku leans on working memory and deductive logic — you hold candidate 
numbers in mind while systematically ruling out the impossible."
```

### Game Help / How to Play
From prototype TILEFLAGS:
```json
{
  "name": "Mini Sudoku",
  "color": "#9b8cff",
  "how": [
    "Fill the 6×6 grid so every row, column and 2×3 box holds 1–6.",
    "Tap a cell, then a number from the pad.",
    "Toggle Notes to pencil in candidates.",
    "Conflicts turn red. The given numbers can't change."
  ],
  "tip": "Hunt for a row, column or box that already has five numbers — the sixth is forced."
}
```

### Share Message Template
```
BrainTap · Mini Sudoku
Solved in {MM:SS}

🟪 6×6 deduction
braintap.app/games
```

---

## 11. Implementation Checklist for Next.js/React Rebuild

- [ ] Create `SudokuGame.tsx` component with React hooks (useState, useEffect, useCallback)
- [ ] Implement seeded RNG: LCG with day-based seed
- [ ] Implement puzzle generation: `solveFill()`, `countSol()`, `okAt()` as separate utility functions
- [ ] Create `SudokuGrid.tsx` sub-component with memoization (React.memo) for cell rendering
- [ ] Create `SudokuNumpad.tsx` sub-component for digit buttons
- [ ] Implement timer with setInterval and cleanup (useEffect return cleanup)
- [ ] Implement conflict detection as a memo'd function
- [ ] Create `SudokuComplete.tsx` modal component with share button
- [ ] Implement localStorage state persistence (lastAttempt, bestTime, notesMap)
- [ ] Add keyboard event listeners (useEffect hook)
- [ ] Implement Notes mode toggle and candidate tracking (Set<number> per cell)
- [ ] Implement haptic feedback via navigator.vibrate (optional feature flag)
- [ ] Add ARIA labels and live regions for accessibility
- [ ] Ensure responsive layout with CSS Grid for different breakpoints
- [ ] Add unit tests for solvability validation (countSol, okAt)
- [ ] Performance: Profile puzzle generation time, optimize with memoization/Workers if needed
- [ ] Test offline behavior: cache seed-based puzzles on service worker

