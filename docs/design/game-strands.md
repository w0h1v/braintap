# BrainTap: Mind Strands — Production Spec

**Game ID:** `strands`  
**Genre:** Word Search / Word Puzzle (NYT Strands-inspired)  
**Target Completion Time:** 5–15 minutes  
**Frequency:** Daily (one level per day)  
**Accent Color:** Cyan (`#86a3ff` / `#a9f6ff` for spangram)

---

## 1. CORE GAME MECHANICS & RULES

### Objective
Find all themed words hidden in an 8×8 letter grid. One word—the **spangram**—must touch both the top and bottom (or left and right) edges of the grid, spanning the full width or height.

### Word List Structure
Each level defines:
- **Theme name:** A category (e.g., "BRAIN ANATOMY")
- **Theme words:** 5–6 words related to the theme
- **Spangram:** A single word that touches two opposite sides of the grid and reinforces the theme

**Example:**
```
Theme: BRAIN ANATOMY
Words:
  - CORTEX
  - NEURON
  - SYNAPSE
  - AXON
  - MEMORY
  - DENDRITE
Spangram: CEREBRUM
```

### Placement Rules
1. Words are placed in the 8×8 grid in one of 8 directions:
   - Horizontal (left-to-right, right-to-left)
   - Vertical (top-to-bottom, bottom-to-top)
   - Diagonal (4 diagonal directions)
2. The spangram is **always** placed across the full width or height (row 3, columns 0–7, in the current prototype).
3. Other words are placed using a seed-based random search to ensure deterministic placement.
4. Remaining cells are filled with random letters.

### Selection Mechanics
- **Start:** Tap/click any letter to begin a selection.
- **Draw:** Tap a second letter at the end of a straight line (horizontal, vertical, or diagonal).
- **Valid Lines:** Selection must form a perfect straight line.
- **Reverse Matching:** A word can be found in either direction (e.g., AXON or NOXA).
- **Submit:** Automatically submit when the line is complete.

### Win/Lose Conditions
- **Win:** Find all theme words + spangram (all words found).
- **No lose condition:** Puzzle remains available to complete at any time.
- **Daily reset:** New level every UTC midnight.

### Scoring
No numeric score. Success is binary: puzzle complete or in progress.

---

## 2. UI LAYOUT & VISUAL DESIGN

### Screen Structure
```
┌──────────────────────────────────────┐
│ ← Today    Mind Strands    [spacer]   │  (Header: 96px top padding)
├──────────────────────────────────────┤
│ THEME · BRAIN PARTS                  │  (Subtitle, blue text)
├──────────────────────────────────────┤
│                                      │
│ 2 / 7 found · spangram ✓             │  (Progress, cyan accent)
│                                      │
│ [8×8 letter grid with selection]     │  (340px wide, 6px gap, 64px cells)
│                                      │
│ Tap connected letters to spell...    │  (Help text, secondary color)
│                                      │
└──────────────────────────────────────┘
```

### Typography
- **Title:** Space Grotesk, 18px, weight 600, color #f3f7ff
- **Theme subtitle:** JetBrains Mono, 10.5px, letter-spacing 0.1em, color #b3c2ff
- **Progress text:** JetBrains Mono, 12.5px, color #9fe9ff
- **Helper text:** JetBrains Mono, 11px, color rgba(226,234,255,.45)
- **Message:** JetBrains Mono, 12px, color #b3c2ff (changes for feedback)

### Cell Styling
Each letter cell is a 46×46px button (aspect ratio 1:1) with:
- **Default (unselected):** 
  - Background: rgba(255,255,255,.05)
  - Color: #dfe9ff
  - Border: 1px solid (implicit from background)
  - Border-radius: 9px
- **Selected (start of path):**
  - Background: #9fe9ff (cyan)
  - Color: #04060f (dark text)
  - Box-shadow: 0 0 10px rgba(158,233,255,0.53)
- **Found word (part of completed word):**
  - Background: theme color (varies by word, see palette below)
  - Color: #04060f
  - Box-shadow: 0 0 10px [color]88

### Color Palette
Word-completion colors (one per theme word):
```javascript
palette = [
  '#00e5ff',  // Cyan
  '#ff2bd6',  // Magenta
  '#ffb020',  // Orange
  '#7CF5C4',  // Green
  '#86a3ff',  // Blue
  '#ff7a9c'   // Pink
]
```

**Spangram color:** `#a9f6ff` (lighter cyan with glow)

### Canvas Overlay
- A `<canvas id="strands-lines">` behind the grid (z-index 1) draws connecting lines when dragging between cells.
- Lines are **not implemented** in the prototype but should be added in production.

---

## 3. INTERACTIONS & STATE TRANSITIONS

### Tap/Click Interaction
1. **First tap:** Select starting cell (highlight in cyan).
2. **Second tap:** If it forms a valid straight line from the first cell:
   - Check if the word (or its reverse) matches any target word.
   - If match and not yet found: mark all cells with the word's color, update progress, play feedback, display flash message.
   - If match but already found: flash "Already found [WORD]".
   - If no match: flash "Not a theme word", deselect.
3. **Tap same cell again:** Deselect and reset.

### Drag (Future Enhancement)
- Current prototype uses tap-tap; production should support drag-to-select.
- Draw line on canvas while dragging.
- Release to complete selection.

### Mobile Swipe
- Swipe from start letter to end letter to select path.
- Snap to nearest grid letter.

### Keyboard Input
- **Future:** Consider arrow keys for navigation + Enter to submit (if implementing a note-taking mode).

### State Machine
```
IDLE
  → tap letter → START (cell highlighted)
    → tap another letter → (validate)
      → VALID_WORD → update progress, render → back to IDLE
      → INVALID → flash error → back to IDLE
    → tap same letter → back to IDLE
```

---

## 4. ANIMATIONS & FEEDBACK

### Cell Reveal
- When a word is found, each cell transitions to its theme color instantly (or quick fade).
- Optional: scale animation (pulse) on each cell.

### Flash Messages
- Flash text appears in the #strands-msg div for 1500ms.
- Success: `"✓ [WORD]"` or `"🌟 Spangram — [WORD]"`
- Error: `"Letters must form a straight line"`
- Error: `"Not a theme word"`
- Error: `"Already found [WORD]"`

### Canvas Line Drawing (Production)
- Smooth line from start cell center to current mouse/touch position.
- Color: theme color of the word being attempted (or neutral cyan if unknown).
- Line width: 3–4px.
- Erase on release or when selection completes.

### Spangram Highlight
- When spangram is found, the progress text shows: `"[count] / [total] found · <span style="color:#a9f6ff;">spangram ✓</span>"`
- Emoji: 🌟

### Victory Modal
- Modal appears 500ms after the last word is found.
- Shows: puzzle complete message, theme name, word count, brain insight.
- Share button includes theme + completion count.

---

## 5. EMBEDDED DATA & LEVEL DEFINITIONS

### Hardcoded Prototype Level
```javascript
const theme = {
  name: 'BRAIN ANATOMY',
  words: ['CORTEX', 'NEURON', 'SYNAPSE', 'AXON', 'MEMORY', 'DENDRITE'],
  spangram: 'CEREBRUM'
};
```

### Grid Generation
**Algorithm:**
1. Create empty 8×8 grid.
2. Seed RNG using current date (ensures daily determinism).
3. Place spangram at row 3, columns 0–7 (full width).
4. For each word (sorted by length, longest first):
   - Try all starting positions and 8 directions in randomized order.
   - Place word on first valid fit.
   - Track placed words and cells.
5. Fill remaining cells with random letters.

**Seeding Code (from prototype):**
```javascript
let seed = Math.floor(Date.now() / 864e5) * 40503 % 2147483647 + 7;
const rnd = () => {
  seed = (seed * 48271) % 2147483647;
  return seed / 2147483647;
};
```

This ensures:
- Same level across all users on a given day.
- Different level each day.

---

## 6. VICTORY CONDITION & END STATE

### Completion
When `st.found.length === target.length`:
1. Set `st.over = true`.
2. Wait 500ms.
3. Call `this.strandsEnd(target, theme)`.

### Result Modal
```html
<div style="text-align:center;">
  <div style="font-family:'JetBrains Mono';font-size:11px;letter-spacing:.2em;color:#86a3ff;">
    PUZZLE COMPLETE
  </div>
  <div style="font-family:'Space Grotesk';font-weight:600;font-size:30px;color:#f3f7ff;margin-top:8px;">
    Every strand found.
  </div>
  <div style="font-size:14px;color:rgba(226,234,255,.6);margin-top:6px;">
    Theme · BRAIN ANATOMY
  </div>
  <div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.18);border-radius:14px;padding:16px;margin-top:20px;text-align:left;">
    <div style="font-family:'JetBrains Mono';font-size:10px;letter-spacing:.16em;color:#9fe9ff;">
      🧠 BRAIN INSIGHT
    </div>
    <div style="font-size:14px;line-height:1.55;color:rgba(226,234,255,.82);margin-top:8px;">
      [Theme-specific brain science fact]
    </div>
  </div>
  <button data-share="[share text]" class="bt-primary">Share result</button>
  <button data-home class="bt-ghost">Back to today</button>
</div>
```

### Share Format
```
BrainTap · Mind Strands
Theme: BRAIN ANATOMY
6/6 + spangram 🌟

braintap.app/games
```

---

## 7. DAILY LEVEL BANK REQUIREMENTS

### Bank Size
**Required:** 365+ levels (one year without repetition)  
**Recommended:** 730+ levels (two years, buffer for special events)

### Level Data Structure
```typescript
interface StrandsLevel {
  id: string;                    // date or UUID
  date: string;                  // "YYYY-MM-DD"
  theme: {
    name: string;               // e.g., "BRAIN ANATOMY"
    words: string[];            // 5–6 words (length 4–10)
    spangram: string;           // 7–10 letters
    insight: string;            // brain science fact for modal
  };
  grid: string[][];             // 8×8 letter grid (pre-generated)
  placements: {
    [word: string]: {           // word → list of [r,c] positions
      positions: [number, number][];
      direction: string;        // "H", "V", "D1", "D2", etc.
    };
  };
  seedValue: number;            // RNG seed used for reproducibility
}
```

### Example Banked Level
```json
{
  "id": "2025-06-17",
  "date": "2025-06-17",
  "theme": {
    "name": "BRAIN ANATOMY",
    "words": ["CORTEX", "NEURON", "SYNAPSE", "AXON", "MEMORY", "DENDRITE"],
    "spangram": "CEREBRUM",
    "insight": "The cerebrum is the brain's largest region — its folded cortex handles thought, language and voluntary action across two mirror-image hemispheres."
  },
  "grid": [
    ["C", "O", "R", "T", "E", "X", "A", "P"],
    ["N", "E", "U", "R", "O", "N", "B", "Q"],
    ...
  ],
  "placements": {
    "CEREBRUM": { "positions": [[0,0],[0,1],[0,2],...,[0,7]], "direction": "H" },
    "CORTEX": { "positions": [[0,0],[1,0],[2,0],[3,0],[4,0]], "direction": "V" },
    ...
  },
  "seedValue": 123456789
}
```

### Bank Generation Strategy
1. **Curate theme sets:** Identify 365+ distinct brain/science/education themes.
2. **Source word lists:** For each theme, curate 5–6 on-topic words (4–10 letters) + a spangram (7–10 letters, encompasses theme).
3. **Generate grids:**
   - Use the seeded RNG algorithm to place words.
   - Validate solvability (see section 8).
   - If placement fails or is invalid, re-seed and retry.
4. **Store in database:** Serialize as JSON and store by date or import as JavaScript object in client-side.

---

## 8. SOLVABILITY VALIDATION ALGORITHM

### Validation Goals
1. **Placement success:** All words (including spangram) must fit in the 8×8 grid.
2. **Word isolation:** Each word must appear exactly once in the grid (no accidental duplicates from other words).
3. **Unique path:** Each word has a unique, unambiguous path in the grid (no cross-contamination).
4. **Spangram verification:** Spangram must touch two opposite edges (row 3, columns 0–7, for horizontal spangram).

### Validation Process

#### Step 1: Grid Placement Check
```
For each word in [words + spangram]:
  1. Search grid for all occurrences of word (forward and reverse).
  2. Count occurrences.
  3. If count !== 1, level is INVALID (word missing or duplicated).
```

#### Step 2: Spangram Edge Check
```
Verify spangram cells:
  - Row = 3 (middle row)
  - Columns = [0, 1, 2, 3, 4, 5, 6, 7] (full width)
  - Touches both sides: column 0 and column 7
  If not met, level is INVALID.
```

#### Step 3: Path Uniqueness Check
```
For each word:
  1. Record the exact cells occupied (as [r,c] pairs).
  2. Verify no two words share more than 0 cells.
     (Words may overlap at shared letters, but should not share full paths.)
  3. If overlap detected, level is INVALID.
```

#### Step 4: Word Recognizability Check
```
For each word:
  1. Can it be found by drawing a straight line in the grid?
  2. All 8 directions valid: H, V, 4 diagonals.
  3. Forward and reverse both valid.
  If any word cannot be formed by a straight line, level is INVALID.
```

### Automated Validation Script (Node.js Pseudocode)
```javascript
function validateLevel(level) {
  const grid = level.grid;
  const targetWords = [...level.theme.words, level.theme.spangram];
  const placements = level.placements;
  
  // Check 1: All words present and unique
  for (const word of targetWords) {
    const occurrences = findWordInGrid(grid, word);
    if (occurrences.length !== 1) {
      throw new Error(`Word "${word}" found ${occurrences.length} times (expected 1)`);
    }
  }
  
  // Check 2: Spangram at row 3, full width
  const spangram = level.theme.spangram;
  const spangramCells = placements[spangram].positions;
  if (spangramCells.length !== 8 || 
      !spangramCells.every(([r, c], i) => r === 3 && c === i)) {
    throw new Error(`Spangram not at row 3, full width`);
  }
  
  // Check 3: No unintended overlaps (optional strict check)
  const allCells = new Set();
  for (const word of targetWords) {
    const cells = placements[word].positions;
    cells.forEach(([r, c]) => {
      const key = `${r},${c}`;
      if (allCells.has(key) && word !== spangram) {
        // Allow overlap; log warning if desired
      }
      allCells.add(key);
    });
  }
  
  return true; // Level valid
}
```

### Solvability Testing (Daily Check)
Run validation on each level before it goes live:
1. Generate level at seed = dayNum.
2. Validate grid.
3. Solve grid programmatically (brute-force search for all words).
4. Confirm all words are found.
5. Log results; alert on failure.

---

## 9. PRODUCTION POLISH & UPGRADES

### Over the Prototype
The prototype is a single-screen demo. Production must add:

#### Responsiveness
- [ ] Mobile-first design: test on iPhone 12, 14, Android.
- [ ] Grid scales to fit viewport (current: 340px fixed).
- [ ] Touch targets >= 44px (current cells are 46px, good).
- [ ] Landscape mode support (rotate grid if needed).
- [ ] Tablet layout: larger grid, side panels for theme/progress.

#### Animations
- [ ] Canvas line drawing (drag to select).
- [ ] Cell pulse or scale animation on word completion.
- [ ] Smooth modal entrance (scale from 0.9 to 1.0, 300ms).
- [ ] Word list entry animation in result modal.
- [ ] Progress bar animation (found count update).

#### Haptics
- [ ] Tap feedback (light) on cell tap.
- [ ] Success feedback (medium) on word found.
- [ ] Spangram found (strong + double) on spangram complete.
- [ ] Error feedback (light negative) on invalid line.

#### Accessibility & ARIA
- [ ] `aria-label` on grid: "8 by 8 letter grid, select start and end to spell words."
- [ ] `aria-label` on each cell: "[LETTER], row [R], column [C]".
- [ ] Focus ring (visible) on selected cell.
- [ ] Keyboard navigation: arrow keys to move cursor.
- [ ] Screen reader announcements for found words: "Cortex found!"
- [ ] Contrast >= WCAG AA (current colors mostly pass; test #dfe9ff on rgba(255,255,255,.05)).

#### Keyboard Shortcuts
- [ ] Arrow keys: navigate grid.
- [ ] Enter: submit current selection.
- [ ] Backspace: clear current selection.
- [ ] ?/H: show help modal.

#### Difficulty Curve
- [ ] Week 1: shorter theme words (4–5 letters), easy spangram (7 letters).
- [ ] Weeks 2–4: medium difficulty (5–7 letters theme, 8–9 letters spangram).
- [ ] Months 2+: hard (6–10 letters, obscure themes, spangrams that are less obvious).
- [ ] Seasonal/weekly themes (e.g., "Neurotransmitters" during Mental Health Awareness Month).

#### Hint System
- [ ] "Show one letter" (1× per day).
- [ ] "Reveal theme category" (unlimited).
- [ ] "Show spangram length" (unlimited).
- [ ] Hints reduce daily streak multiplier (optional).

#### Share Improvements
- [ ] Copy to clipboard (one-click).
- [ ] Share to Twitter/X with link.
- [ ] Share to Facebook with custom image.
- [ ] WhatsApp integration.
- [ ] Generate shareable image (grid + theme + result).

#### Edge Cases & QA
- [ ] Offline mode: cache today's level, allow replay.
- [ ] Replay completed puzzle: show "Played today — replay for practice."
- [ ] Undo last selection (Ctrl+Z or swipe back).
- [ ] Puzzle timeout (if timed variant): show results after 30 min.
- [ ] Grid generation failure: fallback to hardcoded backup level.
- [ ] Browser storage full: graceful degradation (play without history).

#### Code Quality
- [ ] Separation of concerns: grid logic, UI render, state management.
- [ ] Type safety (TypeScript or JSDoc).
- [ ] Unit tests for word placement, validation, spangram detection.
- [ ] E2E tests for full game flow.
- [ ] Performance: grid rendering < 100ms, no layout shifts.

---

## 10. IMPLEMENTATION CHECKLIST

### Phase 1: Core Gameplay
- [ ] Implement 8×8 grid component.
- [ ] Add tap-to-select-line interaction.
- [ ] Implement seeded RNG and word placement algorithm.
- [ ] Add word validation and flash messages.
- [ ] Implement progress tracking and modal on completion.
- [ ] Test with 3–5 hardcoded levels.

### Phase 2: Daily & Persistence
- [ ] Build level bank (curate 365+ theme sets + word lists).
- [ ] Generate and validate all levels.
- [ ] Implement daily level selector (by date).
- [ ] Add localStorage persistence (today's progress).
- [ ] Implement replay detection ("Played today").

### Phase 3: Polish & UX
- [ ] Add canvas line drawing for drag-to-select.
- [ ] Implement haptics feedback.
- [ ] Add animations (cell pulse, modal entrance, progress bar).
- [ ] ARIA labels and keyboard navigation.
- [ ] Responsive design testing (mobile, tablet, desktop).
- [ ] Share button with image generation.

### Phase 4: QA & Launch
- [ ] Validate 100% of banked levels for solvability.
- [ ] Manual gameplay testing (10 levels per difficulty).
- [ ] Accessibility audit (WCAG AA).
- [ ] Performance profiling (Lighthouse).
- [ ] User testing (5–10 players, gather feedback).
- [ ] Launch to production.

---

## 11. TECHNICAL ARCHITECTURE (React/Next.js)

### Component Structure
```
<StrandsGame>
  <StrandsHeader theme={theme} progress={progress} />
  <StrandsGrid grid={grid} onSelect={handleSelect} found={found} />
  <StrandsHelp />
  {gameOver && <ResultModal result={result} theme={theme} />}
</StrandsGame>
```

### State Management
```typescript
interface StrandsState {
  grid: string[][];
  targetWords: string[];
  spangram: string;
  theme: ThemeData;
  found: Set<string>;
  selectedStart: [number, number] | null;
  selectedEnd: [number, number] | null;
  gameOver: boolean;
  startTime: number;
}
```

### Key Functions
- `generateGrid(seed: number): string[][]` — seeded grid generation.
- `validateSelection(start, end): {valid: boolean, word?: string}` — check line and word.
- `updateProgress()` — refresh progress display.
- `openResultModal()` — show end-game modal.
- `shareResult()` — copy share text to clipboard or generate image.

---

## 12. DATA SOURCES & BRAIN INSIGHTS

### Theme + Insight Pairs (Sample)
Each level includes a "Brain Insight" displayed in the result modal:

| Theme | Spangram | Insight |
|-------|----------|---------|
| BRAIN ANATOMY | CEREBRUM | The cerebrum is the brain's largest region — its folded cortex handles thought, language and voluntary action across two mirror-image hemispheres. |
| MEMORY | MNEMONICS | Chunking and spacing are powerful memory techniques; repeating information with time gaps strengthens long-term storage. |
| LEARNING | NEUROPLASTICITY | Your brain physically rewires itself when you learn — new pathways form with practice, even in adulthood. |
| ATTENTION | PREFRONTAL | The prefrontal cortex is your brain's CEO, managing focus, impulse control, and decision-making. |
| EMOTIONS | AMYGDALA | Your amygdala processes emotions in milliseconds, often before your conscious mind catches up. |

### Word List Curation Guidelines
- All words must be 4–10 letters.
- All words must be common English (no proper nouns, abbreviations).
- All words must fit the theme (no surprises).
- Spangram must be 7–10 letters and directly relate to the theme.
- At least one word should be < 6 letters (easier), one > 7 letters (harder).

---

## 13. REFERENCE: PROTOTYPE CODE SNIPPETS

### Seeded RNG
```javascript
let seed = Math.floor(Date.now() / 864e5) * 40503 % 2147483647 + 7;
const rnd = () => {
  seed = (seed * 48271) % 2147483647;
  return seed / 2147483647;
};
```

### Word Placement Check
```javascript
const fits = (word, sr, sc, dir) => {
  const len = word.length;
  const er = sr + dir[0] * (len - 1);
  const ec = sc + dir[1] * (len - 1);
  if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) return null;
  const cells = [];
  for (let i = 0; i < len; i++) {
    const r = sr + dir[0] * i;
    const c = sc + dir[1] * i;
    const cur = grid[r][c];
    if (cur && cur !== word[i]) return null;
    cells.push([r, c]);
  }
  return cells;
};
```

### Line Validation
```javascript
const lineCells = (a, b) => {
  const dr = b[0] - a[0];
  const dc = b[1] - a[1];
  if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
  const len = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  const cells = [];
  for (let i = 0; i < len; i++) {
    cells.push([a[0] + sr * i, a[1] + sc * i]);
  }
  return cells;
};
```

---

## 14. FUTURE VARIANTS

### Timed Mode
- 10-minute timer.
- Bonus points for finding words faster.
- Leaderboard integration.

### Multiplayer
- Race another player to find all words.
- Turn-based (alternate selections).
- Async (compare completion times/order).

### Difficulty Levels
- Easy: smaller grid (6×6), shorter words, visible theme.
- Hard: 10×10 grid, obscure theme, hidden category until 50% complete.
- Expert: multiple themes, same grid.

### Seasonal Events
- "Summer Brains" (July): beach/ocean themes.
- "Neuroplasticity Month" (October): science-heavy themes.

---

## 15. SUCCESS METRICS & INSTRUMENTATION

### Tracking Events
- `strands_level_started` — game initialized.
- `strands_word_found` — user finds a word (with word name, time).
- `strands_spangram_found` — spangram found.
- `strands_level_completed` — puzzle finished (with total time, hints used).
- `strands_hint_used` — user requests a hint (type: show_letter, reveal_theme, etc.).
- `strands_result_shared` — user shares result.

### Key Metrics
- **Daily active users (DAU)** — games started per day.
- **Completion rate** — % of started games completed.
- **Average time to completion** — mean + median solve time.
- **Hint usage rate** — % of games using hints.
- **Repeat play** — % of users replaying same level (after completion).
- **Share rate** — % of completed games shared.

---

**End of Spec**

*Generated from prototype: /Users/orie/dev/braintap/design_src/BrainTap Games.dc.html*  
*Last updated: 2025-06-17*
