# Focus Forge - Production Specification

**Game ID:** `forge`  
**Type:** Logic Puzzle / Nonogram (Picross)  
**Daily Rotation:** Once per day  
**Skill Category:** Logic & Spatial Reasoning  
**Target Session Duration:** 5–15 minutes  
**Difficulty:** Medium (no leveling within a session; one fixed puzzle per day)

---

## 1. Core Mechanics & Rules

### Puzzle Format: 5×5 Nonogram (Picross)

Focus Forge uses a **5×5 grid** where each cell can be in one of three states:
- **Empty (0):** Unsolved; displays as a light border with transparent background
- **Filled (1):** Player marked as part of the solution; displays with the gold accent color
- **Marked Empty (2):** Player marked as definitely not filled; displays with an "✕" symbol

### Win Condition

**Solved when:**
- All 25 cells match the solution grid exactly (state[r][c] === sol[r][c] for all r, c)
- Player sees the "Solved!" message followed by success modal

### Clue System: Row & Column Hints

Each row and column displays a **sequence of numbers** that describe **contiguous runs of filled cells** reading left-to-right or top-to-bottom:

- **Example:** Clue `[3, 1]` on a row means: *a run of 3 filled cells, at least one empty cell gap, then a run of 1 filled cell*
- **Empty row/column:** Displays as `[0]` (a single zero indicates no filled cells)
- **All filled:** Displays as `[5]` (a single five for the full row/column)

**Clue placement:**
- **Column clues** displayed above the grid, vertically centered, justified to the bottom of their cell space
- **Row clues** displayed to the left of the grid, right-justified within their row label area
- **Corner cell** left blank (no content)

### No Scoring, No Hints, No Timer

Focus Forge is purely **goal-based** (solve the puzzle), not score-based:
- No points, no stars, no difficulty levels within the puzzle
- No hint system (player must deduce from clues alone)
- No time limit
- Puzzle is **unique per calendar day** (seeded by date or pre-generated from a bank)

### Losing Condition

There is **no explicit loss state**. The player can explore indefinitely:
- Incorrect fills don't prevent further play
- The `check()` function continuously verifies all cells
- Once all cells match the solution, `st_over()` fires immediately

---

## 2. UI Layout, States & Styling

### Screen Container

**Element ID:** `screen-forge` (display:none when inactive, display:block when active)

```
Layout (max-width: 520px, centered, padding: 96px top / 20px sides):

┌─────────────────────────────────────────┐
│ ← Today              [Game Title]        │  (Header with nav)
│                  Focus Forge             │
│                FILL THE PICROSS          │
├─────────────────────────────────────────┤
│                                         │  (Message area, min-height: 20px)
│          [5×5 NONOGRAM GRID]            │  (Gap: 8px above grid)
│                                         │
├─────────────────────────────────────────┤
│  ■ Fill      ✕ Right-click = mark empty │  (Legend/hint text, 11px mono)
│                                         │
└─────────────────────────────────────────┘
```

### Component States

#### 1. Idle/Start State
- Message: *empty* (min-height reserves space)
- Grid: All cells displayed in empty state (light border, transparent background)
- Player can immediately click cells

#### 2. Playing State
- Message: Updates as player interacts (optional; can remain empty)
- Grid: Cells transition colors as player marks fills/empty
- Clues: Always visible in row/column headers

#### 3. Won State (Solved)
- Message: **"Solved!"** (gold text, animated)
- Filled cells: Scale up 1.05× on solve, then scale back (300ms ease)
- Transition to `forgeEnd()` modal after 500ms

#### 4. Replay State (Already Completed Today)
- Message: **"Come back tomorrow for a new grid"**
- Grid: Displayed but cells are read-only (or non-interactive; unclear in prototype)

---

### Cell Styling

**All states use:**
- Size: 46px × 46px
- Border radius: 8px
- Font: JetBrains Mono, 16px
- Transition: inherit from paintCell()

| State         | Background              | Border                  | Box Shadow                      | Text      |
|---------------|-------------------------|-------------------------|----------------------------------|-----------|
| **Empty (0)** | rgba(255,255,255,.04)  | rgba(255,255,255,.1)   | none                            | empty     |
| **Filled (1)**| #ffb020                 | #ffb020                 | 0 0 10px rgba(255,176,32,.5)   | empty     |
| **Marked (2)**| rgba(255,255,255,.04)  | rgba(255,255,255,.1)   | none                            | ✕         |

**Marked (2) text color:** rgba(255,90,140,.85) (pink/magenta)

---

### Clue Display Styling

**Column clues container:**
- Display: flex column
- Align items: center
- Justify: flex-end (bottom-aligned)
- Gap: 1px between numbers
- Font: JetBrains Mono, 12px
- Color: #ffcf7a (gold)
- Padding-bottom: 4px

**Row clues container:**
- Display: flex (horizontal)
- Align items: center
- Justify: flex-end (right-aligned)
- Gap: 5px between numbers
- Font: JetBrains Mono, 12px
- Color: #ffcf7a (gold)
- Padding-right: 6px

---

### Grid Container

**Layout:** CSS Grid
- `grid-template-columns: auto repeat(5, 46px)` (auto for row labels, then 5 fixed columns)
- Gap: 4px between all cells
- Responsive: Scales down on mobile (see Production Polish section)

---

### Success Modal

**Triggered:** `forgeEnd()` function after 500ms delay  
**Modal structure:**
```
┌──────────────────────────────────┐
│   PUZZLE COMPLETE (gold text)     │
│   Glyph revealed.                 │
│   ◆ (large symbol)                │
│                                  │
│   ┌─ BRAIN INSIGHT (gold) ─┐      │
│   │ Logic puzzles light up   │      │
│   │ the parietal lobe...     │      │
│   └──────────────────────────┘      │
│                                  │
│  [Share result] (primary button)  │
│  [Back to today] (ghost button)   │
└──────────────────────────────────┘
```

**Styling:**
- Container: max-width inherited from screen, centered
- Title: JetBrains Mono, 11px, letter-spacing .2em, #ffb020
- Heading: Space Grotesk 600, 30px, #f3f7ff
- Symbol: font-size 42px
- Insight box: background rgba(255,176,32,.07), border 1px rgba(255,176,32,.2), border-radius 14px, padding 16px
  - Label: JetBrains Mono, 10px, letter-spacing .16em, #ffcf7a
  - Text: 14px, line-height 1.55, rgba(226,234,255,.82)
- Buttons:
  - Share: linear-gradient(118deg, #ffb020, #ff7a18), Space Grotesk 600, 14px, color #04060f
  - Back: rgba(255,255,255,.04), border 1px rgba(255,255,255,.16), Space Grotesk 500, 14px, color #eaf1ff

**Share Text Template:**
```
BrainTap · Focus Forge
Picross solved ◆

braintap.app/games
```

---

## 3. Interactions & Input Handling

### Click/Tap Interactions

**Left-click on empty cell:**
- Toggles cell between empty (0) and filled (1)
- If cell is filled, next click returns to empty
- If cell is empty, click marks it filled
- **No intermediate state** (no "1 → 2" progression on left-click)

```javascript
b.onclick = () => {
  if (state[r][c] === 1) {
    state[r][c] = 0;  // Clear filled cell
  } else {
    state[r][c] = 1;  // Mark as filled
  }
  paintCell(r, c);
  check();
};
```

**Right-click on any cell:**
- Toggles between empty (0) and marked (2)
- If cell is marked (2), right-click returns to empty (0)
- If cell is empty (0), right-click marks it (2)
- **No interaction with filled (1) cells from right-click** (filled cells stay filled)

```javascript
b.oncontextmenu = (e) => {
  e.preventDefault();
  state[r][c] = state[r][c] === 2 ? 0 : 2;  // Toggle marked ↔ empty
  paintCell(r, c);
};
```

### Keyboard Input (Not in Prototype)

**Production should support:**
- **Arrow keys:** Navigate between cells (focus-based navigation)
- **Number keys / Spacebar:** Toggle current cell between states
- **Alt/Option + Click:** Right-click equivalent on Mac trackpad
- **Long-press on mobile:** Context menu suppression + mark-as-empty

---

## 4. Animations & Feedback

### Cell-Level Feedback

**Fill animation:**
- Instant visual update (color + border + shadow)
- No transition delay (immediate visual confirmation)

**Mark (✕) animation:**
- Instant visual update
- No transition delay

**On solve (winning condition):**
```javascript
for (let r = 0; r < N; r++)
  for (let c = 0; c < N; c++) {
    if (sol[r][c]) {  // Only filled cells animate
      const b = cells[r + '_' + c];
      b.style.transition = 'transform .3s';
      b.style.transform = 'scale(1.05)';
      setTimeout(() => (b.style.transform = 'scale(1)'), 300);
    }
  }
```
- **Effect:** Scale pulse on solved cells (1.0 → 1.05 → 1.0 over 300ms)
- **Only applies to filled cells** in the solution

### Message Animation

**"Solved!" text:**
- Appears in `forge-msg` element (color #ffcf7a)
- No fade-out (persistent until modal opens)
- Modal opens 500ms after message appears

### Modal Transition

**On success:**
- Delay 500ms after "Solved!" message
- `forgeEnd()` triggers `this.openModal()` with centered modal
- Modal animates in (see framework's modal animation)
- Confetti optional based on `this.S.settings.zen` setting

---

## 5. Embedded Game Data

### Prototype Puzzle Definition

The current prototype uses a hardcoded 5×5 solution:

```javascript
const sol = [
  [0, 0, 1, 0, 0],
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0],
  [0, 0, 1, 0, 0]
];
```

**Visual representation:**
```
  □ ■ □
  ■ ■ ■
■ ■ ■ ■ ■
  ■ ■ ■
  □ ■ □
```

This forms a **diamond shape / cross glyph** (the "revealed glyph" shown in the win message).

**Derived clues:**
- Row 0: [1]
- Row 1: [3]
- Row 2: [5]
- Row 3: [3]
- Row 4: [1]
- Col 0: [1]
- Col 1: [4]
- Col 2: [5]
- Col 3: [4]
- Col 4: [1]

### Clue Generation Algorithm

Given a solution grid `sol[r][c]` (binary: 0 or 1):

```javascript
const rowClue = (r) => {
  const out = [];
  let run = 0;
  for (let c = 0; c < N; c++) {
    if (sol[r][c]) {
      run++;
    } else {
      if (run) out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out.length ? out : [0];  // Return [0] for empty rows
};

const colClue = (c) => {
  const out = [];
  let run = 0;
  for (let r = 0; r < N; r++) {
    if (sol[r][c]) {
      run++;
    } else {
      if (run) out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out.length ? out : [0];  // Return [0] for empty columns
};
```

---

## 6. Daily Level Bank Requirement

### Need for Level Bank: **YES**

**Rationale:**
- Daily puzzle must be unique per calendar day
- Puzzle must be **predetermined and identical for all users** playing on the same day (to enable social sharing)
- To avoid procedural generation complexity and solvability validation in production, **pre-generate a bank of puzzles**

### Bank Size Recommendation

**Minimum 365 puzzles** (one per calendar year, supporting long-term play)  
**Ideal 730+ puzzles** (two years' worth, enabling rotation and seasonal themes)

### Level Data Structure

Each level in the bank is a **JSON object**:

```json
{
  "id": "forge-2025-01-15",
  "date": "2025-01-15",
  "difficulty": "medium",
  "solution": [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0]
  ],
  "rowClues": [[1], [3], [5], [3], [1]],
  "colClues": [[1], [4], [5], [4], [1]],
  "glyphName": "Diamond",
  "difficulty": "medium",
  "estimatedTime": "8 minutes",
  "seed": 1234567890
}
```

### Bank Schema

```typescript
interface PuzzleLevel {
  id: string;                    // Unique identifier (e.g., "forge-2025-01-15")
  date: string;                  // ISO date (YYYY-MM-DD)
  difficulty: "easy" | "medium" | "hard";  // Not used for gameplay, informational
  solution: number[][];          // 5×5 binary grid (0 or 1)
  rowClues: number[][];          // Computed clues for each row
  colClues: number[][];          // Computed clues for each column
  glyphName?: string;            // Optional flavor text (e.g., "Diamond")
  estimatedTime?: string;        // Informational (e.g., "8 minutes")
  seed?: number;                 // Optional seed for reproducibility
}

interface PuzzleBank {
  version: 1;
  puzzles: PuzzleLevel[];
  generatedAt: string;           // ISO timestamp when bank was generated
  totalCount: number;
}
```

### Accessing Daily Puzzle

**Production code pattern:**
```javascript
const getTodaysPuzzle = (bank) => {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return bank.puzzles.find(p => p.date === dateStr);
};
```

---

## 7. Solvability Validation

### Validation Algorithm

Each puzzle in the bank **must pass validation** before deployment. A nonogram is **solvable** if:
1. **Clues are consistent:** Generated clues from the solution match exactly
2. **Unique solution:** Only ONE grid state satisfies all row and column clues

### Step-by-Step Validation Process

#### Step 1: Verify Clue Consistency
```javascript
const validateClues = (solution, N = 5) => {
  // Generate clues from solution
  const rowClue = (r) => { /* compute from solution */ };
  const colClue = (c) => { /* compute from solution */ };
  
  // For each row and column, verify clues match solution
  for (let r = 0; r < N; r++) {
    const clue = rowClue(r);
    // Clue must match the contiguous runs in solution[r]
  }
  for (let c = 0; c < N; c++) {
    const clue = colClue(c);
    // Clue must match the contiguous runs in solution[c]
  }
  return true; // All clues consistent
};
```

#### Step 2: Verify Unique Solution
Use a **constraint satisfaction solver** or **backtracking algorithm**:

```javascript
const findAllSolutions = (rowClues, colClues, N = 5, maxSolutions = 2) => {
  const solutions = [];
  
  const isValid = (state) => {
    // Check all row clues
    for (let r = 0; r < N; r++) {
      const expected = rowClues[r];
      const actual = computeClue(state[r]);
      if (!arraysEqual(expected, actual)) return false;
    }
    // Check all column clues
    for (let c = 0; c < N; c++) {
      const expected = colClues[c];
      const actual = computeClue(state.map(row => row[c]));
      if (!arraysEqual(expected, actual)) return false;
    }
    return true;
  };
  
  const backtrack = (state, row) => {
    if (solutions.length >= maxSolutions) return;
    
    if (row === N) {
      if (isValid(state)) {
        solutions.push(state.map(r => [...r]));
      }
      return;
    }
    
    // Try all 2^5 = 32 combinations for the next row
    for (let mask = 0; mask < 32; mask++) {
      const rowData = [];
      for (let c = 0; c < N; c++) {
        rowData.push((mask >> c) & 1);
      }
      state[row] = rowData;
      
      // Prune: check if current row is compatible with column clues so far
      let compatible = true;
      for (let c = 0; c < N; c++) {
        const colSoFar = state.slice(0, row + 1).map(r => r[c]);
        const colClue = colClues[c];
        if (!canExtend(colSoFar, colClue)) {
          compatible = false;
          break;
        }
      }
      
      if (compatible) {
        backtrack(state, row + 1);
      }
    }
  };
  
  backtrack(Array(N).fill(null), 0);
  return solutions;
};

const validateUniqueness = (rowClues, colClues, N = 5) => {
  const solutions = findAllSolutions(rowClues, colClues, N, 2);
  return solutions.length === 1;  // Exactly one solution
};
```

#### Step 3: Full Validation Routine

```javascript
const validatePuzzle = (puzzle) => {
  try {
    // Step 1: Clues match solution
    if (!validateClues(puzzle.solution)) {
      return { valid: false, reason: 'Clues do not match solution' };
    }
    
    // Step 2: Unique solution from clues alone
    if (!validateUniqueness(puzzle.rowClues, puzzle.colClues)) {
      return { valid: false, reason: 'Solution is not unique' };
    }
    
    // Step 3: No trivial puzzles (nearly all cells filled or empty)
    const filled = puzzle.solution.flat().reduce((a, b) => a + b, 0);
    const fillPercentage = filled / 25;
    if (fillPercentage < 0.2 || fillPercentage > 0.8) {
      console.warn('Puzzle is very sparse or dense; may be too easy/hard');
    }
    
    return { valid: true, fillPercentage };
  } catch (e) {
    return { valid: false, reason: e.message };
  }
};
```

### Validation at Build Time

**In the build/generation pipeline:**
1. Generate puzzle candidates (procedurally or from a curated set)
2. For each candidate, run `validatePuzzle()`
3. **Reject invalid puzzles** (unsolvable, non-unique, trivial)
4. Output only validated puzzles to the bank JSON

---

## 8. Production Polish & Upgrades

### Beyond the Prototype

The prototype demonstrates core mechanics but lacks production refinement. Here are concrete upgrades:

#### **Responsiveness**
- [ ] **Mobile grid scaling:** On screens < 480px, reduce cell size to 38px and adjust gap proportionally
- [ ] **Touch targets:** Ensure cells remain tappable (minimum 44px on mobile)
- [ ] **Label overflow:** Stack row clues vertically if numbers are double-digit; wrap column clues if needed
- [ ] **Breakpoints:** Test at 320px (SE), 375px (iPhone), 480px (tablet portrait), 768px (tablet landscape)

#### **Animation & Haptics**
- [ ] **Cell fill animation:** Subtle 100ms scale-up + color transition (not just instant color change)
- [ ] **Mark (✕) animation:** Fade-in the ✕ symbol (50ms)
- [ ] **Solve pulse:** Current 300ms scale-up is good; extend to ALL filled cells (not just final state)
- [ ] **Haptic feedback:** 
  - Light tap on fill (iOS `UIImpactFeedbackStyle.light`)
  - Medium tap on mark empty
  - Heavy tap on puzzle solve
  - **Note:** Prototype uses no haptics; production should add
- [ ] **Success confetti:** Only if `zen` setting is false (already in code)

#### **Accessibility & Keyboard**
- [ ] **ARIA labels:**
  ```html
  <button
    aria-label="Cell Row 0 Column 2, currently empty"
    aria-pressed="false"
    role="switch"
  >
  </button>
  ```
- [ ] **Focus management:**
  - Tab through cells in reading order (left-to-right, top-to-bottom)
  - Shift-Tab reverses
  - Home/End keys jump to start/end of current row
  - Page Up/Down move 5 rows
- [ ] **Keyboard shortcuts:**
  - **Space / Enter:** Toggle fill on focused cell
  - **M:** Mark current cell as empty
  - **R:** Reset current cell to empty
  - **Escape:** Unfocus cell
- [ ] **High contrast mode:** Ensure borders remain visible on high-contrast system settings
- [ ] **Screen reader testing:** Verify clues are announced correctly

#### **Difficulty Curve (Future)**
- [ ] **Scaling to 7×7, 10×10:** Extend prototype for progression within multiplayer seasons
- [ ] **Difficulty tier system:** Easy (high fill %), Medium (current), Hard (sparse, complex clues)
- [ ] **Hint system (optional):**
  - "Show one row" / "Show one column"
  - Limited hints per puzzle
  - Penalize scoring (if scoring added later)

#### **Hint System (Optional; Not in Prototype)**
- [ ] **Button:** "Hint?" (gray, disabled after one use per session)
- [ ] **Hint behavior:** Highlight one correctly-solved row or column for 3 seconds
- [ ] **Accessibility:** Announce hint via ARIA live region

#### **Share & Social**
- [ ] **Share button:** Already present; test copy-to-clipboard
- [ ] **Share text template:** Include emoji, puzzle stats (e.g., "Solved in 6 minutes")
- [ ] **Open Graph tags:** When link shared, preview game name + icon
- [ ] **Leaderboard integration:** (Future) Track fastest solve times

#### **Error Handling & Edge Cases**
- [ ] **No puzzle found for today:** Fallback message, retry button, offline detection
- [ ] **Very slow solve times (> 60 min):** Auto-save state to localStorage every 30s
- [ ] **Session storage:** Persist `state` grid locally; resume from last position on page reload
- [ ] **Network failure:** Graceful degradation (show cached puzzle, no share)
- [ ] **Double-tap on mobile:** Prevent zoom-to-fill on accidental double-tap (use CSS `user-select: none`)

#### **Visual Polish**
- [ ] **Clue font sizing:** Ensure numbers don't overflow their cells (use `font-size: clamp()`)
- [ ] **Grid background:** Very subtle grid pattern (optional)
- [ ] **Solved state vignette:** Fade dark border around grid on solve
- [ ] **Message area transitions:** Fade in/out messages (50ms opacity transition)
- [ ] **Button hover states:** Already present in CSS; test focus outline visibility

#### **Difficulty Indication (UX)**
- [ ] **Pre-game modal:** Show puzzle difficulty tier before play starts
- [ ] **Estimated time:** "~8 minutes" below title (optional)
- [ ] **Progress indicator:** Bar showing % of cells solved (optional; can distract)

#### **Sound & Ambient**
- [ ] **Cell fill sound:** Subtle beep or click (if `sound` setting is true)
- [ ] **Solve sound:** Chord or victory chime
- [ ] **Setting controls:** Already exist; test volume levels

#### **Performance**
- [ ] **Lazy render:** DOM already minimal (25 cells); no optimization needed
- [ ] **Event delegation:** Currently one click handler per cell; consider event delegation for future scaling
- [ ] **Memory:** Prototype holds state array + cells map; no cleanup issues expected

---

## 9. Implementation Roadmap

### Phase 1: MVP (Week 1)
- [ ] Extract and validate 365 puzzle bank
- [ ] Implement daily puzzle selection (localStorage + server sync)
- [ ] Port prototype code to React/Next.js
- [ ] Test solvability validation on bank

### Phase 2: Polish (Week 2)
- [ ] Add responsive scaling (mobile-first)
- [ ] Implement keyboard navigation + ARIA
- [ ] Add haptic feedback layer
- [ ] Refine animations (scale, transitions)
- [ ] Persistent state (localStorage backup)

### Phase 3: Refinement (Week 3)
- [ ] Difficulty display & hint system
- [ ] Social sharing with metadata
- [ ] Offline fallback + caching
- [ ] A11y audit (screen reader + keyboard testing)
- [ ] Performance profiling

### Phase 4: Launch (Week 4)
- [ ] QA: cross-device testing
- [ ] Monitoring: track solve times, error logs
- [ ] Launch bank rotation system
- [ ] Community feedback loop

---

## 10. Reference: Game Metadata

**Game metadata (from hub configuration):**
```javascript
forge: {
  name: 'Focus Forge',
  color: '#ffb020',      // Gold accent
  how: [
    'It's a picross: the numbers tell you the filled runs in each row and column.',
    'Left-click a cell to fill it.',
    'Right-click to mark a cell you know is empty.',
    'Solve every row and column to reveal the hidden glyph.'
  ],
  tip: 'Start where a clue equals or nearly equals the line length — those cells are forced.'
}
```

**Categorization:**
- **Skill:** Logic & Spatial Reasoning
- **Brain region:** Parietal lobe (spatial processing)
- **Cognitive load:** Medium (pattern recognition, working memory)
- **Stat category:** Logic (shares skill metric with Connections, Sudoku, etc.)

---

## 11. Testing Checklist

- [ ] **Puzzle validity:** Bank contains no unsolvable puzzles
- [ ] **Unique solutions:** All puzzles have exactly one solution
- [ ] **Clue accuracy:** Generated clues match solution
- [ ] **Cross-browser:** Chrome, Safari, Firefox, Edge
- [ ] **Mobile:** iPhone SE, iPhone 12, iPad, Android (Chrome, Samsung)
- [ ] **Accessibility:** Keyboard-only play, screen reader (NVDA, VoiceOver)
- [ ] **State persistence:** Reload page during puzzle; state resumes
- [ ] **Daily reset:** Midnight UTC rollover shows new puzzle
- [ ] **Streak tracking:** Puzzle completion increments daily streak
- [ ] **Share button:** Copy-to-clipboard works, no unescaped HTML
- [ ] **Modal dismiss:** Back button closes modal and returns to hub
- [ ] **Edge cases:**
  - [ ] User solves in < 10 seconds (fast solver)
  - [ ] User leaves puzzle unsolved for 12 hours
  - [ ] User on cellular network (slow load)
  - [ ] User on Dark mode / Light mode
  - [ ] User with reduced motion enabled

---

## Appendix: Code Reference (Prototype)

### initForge() Function
**Location:** `/Users/orie/dev/braintap/design_src/BrainTap Games.dc.html`, lines 1401–1427

Key functions:
- `rowClue(r)` — Generate clue array for row
- `colClue(c)` — Generate clue array for column
- `paintCell(r, c)` — Update visual state of cell
- `check()` — Verify if all cells match solution; fires `st_over()` on match
- `st_over()` — Trigger solve animation and transition to `forgeEnd()`

### forgeEnd() Function
**Location:** Lines 1428–1443

- Calls `this.markPlayed('f')` to increment streak
- Opens modal with success message, brain insight, and share button

### Screen Markup
**Location:** Lines 543–560 (id="screen-forge")

HTML structure with max-width container, game title, message area, and grid container.

