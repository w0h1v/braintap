# Pips - Production Specification

## Overview

**Game Name:** Pips  
**Game ID:** `pips`  
**Genre:** Constraint satisfaction / Domino logic puzzle  
**Difficulty:** Medium  
**Target Duration:** 3-5 minutes per puzzle  
**Primary Cognitive Domain:** Constraint satisfaction, prefrontal cortex (rule juggling & spatial reasoning)

Pips is a NYT Pips-style puzzle in which the player places flippable dominoes into four slots such that the sum of pips in each column matches a target value. The challenge lies in juggling multiple constraints simultaneously: each domino can flip to reveal different halves, each slot covers two adjacent columns, and all four columns must balance at once.

---

## Core Mechanics

### Game Structure

- **Daily Puzzle:** One unique puzzle per day, seeded by `Math.floor(Date.now() / 864e5)` (86400000ms = 24 hours)
- **4 Columns:** Each with a numeric target (0–10 pips per column)
- **4 Dominoes:** Each with two halves (left and right), each half showing 0–6 pips
- **4 Slots:** Arranged in a 2×2 grid (2 rows × 2 pairs of columns)
  - Slot 0 (top-left pair): covers columns 0 & 1
  - Slot 1 (top-right pair): covers columns 2 & 3
  - Slot 2 (bottom-left pair): covers columns 0 & 1
  - Slot 3 (bottom-right pair): covers columns 2 & 3

### Layout Logic

```
Column indices:  0   1   2   3
Target values:  [T0][T1][T2][T3]

Slots arrangement (2×2):
┌─────────┬─────────┐
│ Slot 0  │ Slot 1  │  (row 0)
│ c0, c1  │ c2, c3  │
├─────────┼─────────┤
│ Slot 2  │ Slot 3  │  (row 1)
│ c0, c1  │ c2, c3  │
└─────────┴─────────┘

Domino orientation:
- Each domino placed horizontally (left-right)
- Left half contributes to left column
- Right half contributes to right column
```

### Domino Mechanics

1. **Selection & Placement:**
   - Tap a domino in the tray to select it (visual outline with orange accent)
   - Tap an empty slot to place the selected domino
   - Only unplaced dominoes are shown in the tray

2. **Flipping:**
   - After placement, tap a domino to flip it (swaps left/right halves)
   - A flip control (↻) button appears on placed dominoes for convenient re-flip
   - Unplaced dominoes can be flipped by tapping them (no selection required)

3. **Removal:**
   - An × button appears on placed dominoes to remove them back to the tray
   - Removal clears the domino's `placed` state

### Win Condition

- All 4 dominoes placed in all 4 slots
- Each column's total equals its target value exactly
- A "Solved!" message displays
- Modal opens with completion feedback

### Lose Condition

- No explicit lose condition; the puzzle remains playable until solved
- Can reset the board at any time with the "Reset board" button

### Scoring

- No numeric score; binary success/failure
- Daily completion tracked in persistent state (`doneD` flag)
- If already solved today, message: "Solved today — replay for practice"

---

## Data Structure

### Puzzle Definition

```javascript
{
  targets: [number, number, number, number],  // target pips per column
  bank: [[a, b], [a, b], [a, b], [a, b]]     // 4 dominoes, each [left, right]
}
```

### Domino Object (Internal)

```javascript
{
  id: number,           // 0–3
  a: number,            // left face (0–6 pips)
  b: number,            // right face (0–6 pips)
  placed: null|number,  // null if in tray, else slot index 0–3
  flip: boolean         // true = swap left/right
}
```

### Domino Display Logic

```javascript
halves(d) {
  left:  d.flip ? d.b : d.a,
  right: d.flip ? d.a : d.b
}
```

If `flip=false`: left=a, right=b  
If `flip=true`: left=b, right=a

### Column Sum Calculation

```javascript
colSums() {
  s = [0, 0, 0, 0]
  For each slot si (0–3):
    if slot has domino id:
      d = bank[id]
      {left, right} = halves(d)
      pairStart = (si % 2) * 2  // 0 or 2
      s[pairStart] += left
      s[pairStart + 1] += right
  return s
}
```

**Example:**
- Slot 0 (si=0, pairStart=0): domino contributes to columns 0 & 1
- Slot 1 (si=1, pairStart=2): domino contributes to columns 2 & 3
- Slot 2 (si=2, pairStart=0): domino contributes to columns 0 & 1
- Slot 3 (si=3, pairStart=2): domino contributes to columns 2 & 3

### Daily Puzzle Bank

The prototype includes **4 hardcoded puzzles**:

```javascript
const puzzles = [
  {targets:[8,4,7,4], bank:[[3,2],[4,1],[5,2],[3,3]]},
  {targets:[3,7,9,7], bank:[[2,4],[6,3],[1,3],[3,4]]},
  {targets:[10,3,6,9], bank:[[6,1],[2,5],[4,2],[4,4]]},
  {targets:[7,7,6,6], bank:[[5,2],[3,4],[2,5],[3,2]]}
];

// Daily selection:
P = puzzles[Math.floor(Date.now() / 864e5) % puzzles.length]
```

**This is insufficient for production.** See "Daily-Level Requirements" below.

---

## UI Layout & Styling

### Screen Container
- **ID:** `screen-pips`
- **Max-width:** 440px (mobile-first, centered)
- **Padding:** 96px top, 20px sides, 40px bottom
- **Display:** Flex column, center-aligned

### Header
- **Left button:** "← Today" (navigate home)
- **Center:** Title "Pips" + subtitle "BALANCE EVERY COLUMN"
- **Right:** Spacer (60px) for layout symmetry

### Status Message
- **ID:** `pips-msg`
- **Font:** 'JetBrains Mono', 12.5px
- **Color:** #ffc58a (warm accent)
- **Content:** Empty by default; shows "Solved!" on win or "Solved today — replay for practice" if already done

### Column Targets Section
- **Label:** "COLUMN TARGETS" (small caps, 10px)
- **Container ID:** `pips-cols`
- **Layout:** CSS Grid, 4 columns, 8px gap
- **Height:** ~60px total
- Each column target displays:
  - **Current sum** (large, 20px, Space Grotesk 600) or "·" if empty
  - **Target** (small, 12px, muted)
  - **Border:** 1px solid, color-coded:
    - Green (#7CF5C4) if sum equals target
    - Red (#ff6b9d) if sum exceeds target
    - White (rgba) if sum < target or zero
  - **Background:** Light tint matching border color; fully transparent if no match
  - **Border-radius:** 10px

### Domino Slots Section
- **Label:** "DOMINO TRAY · TAP TO SELECT, ↻ TO FLIP"
- **Container ID:** `pips-slots`
- **Layout:** CSS Grid, 2 columns, 10px gap
- **Height:** Variable (~140px typical with 2 rows × 2 cols)
- Each slot:
  - **Empty state:**
    - Dashed border, orange (#ff9e3d, rgba .4)
    - Pale orange background (rgba .04)
    - Text: "DROP" (small, muted orange)
    - Cursor: pointer
  - **Filled state:**
    - No border
    - Displays domino inline
    - Domino shows two halves side-by-side with separator
    - Small control buttons (↻, ×) top-right corner

### Domino Tray Section
- **Label:** "DOMINO TRAY · TAP TO SELECT, ↻ TO FLIP"
- **Container ID:** `pips-tray`
- **Layout:** Flex wrap, center, 12px gap
- **Height:** Min 60px
- Each domino chip:
  - Rounded (11px)
  - Padding 3px
  - **Unselected:** Default appearance
  - **Selected:** Orange outline (2px solid #ff9e3d), -2px offset, slight translate-Y (-3px)
  - Transition: 0.15s smooth
  - **Message when all placed:** "All dominoes placed" (gray text, centered)

### Reset Button
- **ID:** `pips-reset`
- **Label:** "Reset board"
- **Classes:** `bt-ghost`
- **Style:** Bordered button, rounded pill (100px), padding 10px 24px
- **Font:** Space Grotesk 600, 13.5px
- **Color:** Pale text (#eaf1ff), subtle border
- **Disabled when:** Game is over (`st.over === true`)

---

## Domino Rendering

### Visual Design

Each domino is rendered as a horizontal pair of squares:

```
┌─────────┬─────────┐
│ LEFT    │ RIGHT   │
│ (pips)  │ (pips)  │
└─────────┴─────────┘
```

- **Gradient:** Linear 160deg from #fff to #e8ecff (light blue-white)
- **Border-radius:** 9px
- **Padding:** 7px
- **Shadow:** 0 4px 14px rgba(0,0,0,.35) (subtle depth)
- **Separator:** 1px solid line between halves (rgba(4,6,15,.45), dark)
- **Pip color:** #1a1030 (dark navy)

### Pip Dots Layout

Each half shows a **3×3 grid of pips** for values 0–6:

```javascript
map = {
  0: [],           // empty
  1: [4],          // center
  2: [0, 8],       // top-left, bottom-right
  3: [0, 4, 8],    // top-left, center, bottom-right
  4: [0, 2, 6, 8], // four corners
  5: [0, 2, 4, 6, 8], // four corners + center
  6: [0, 3, 6, 2, 5, 8] // all six outer positions (domino pattern)
};

// Grid positions:
// [0] [1] [2]
// [3] [4] [5]
// [6] [7] [8]
```

- **Dot size:** 8px diameter, border-radius 50%
- **Grid gap:** 4px
- **Centered** within the half-square

---

## Interaction Model

### Primary Interactions

#### 1. Select a Domino
- **Action:** Tap unplaced domino in tray
- **Effect:** Outline appears (2px solid #ff9e3d, -2px offset), slight upward lift (translate-Y -3px)
- **State:** `st.sel` = domino id
- **Visual feedback:** Immediate outline, 0.15s transition

#### 2. Place a Domino
- **Action:** With domino selected, tap an empty slot
- **Effect:**
  - Domino moves to slot visually
  - Slot border becomes transparent (no longer dashed)
  - Domino id stored in `slots[slotIndex]`
  - Domino's `placed` field set to slot index
  - Selection cleared (`st.sel = null`)
  - Column sums recalculated and rendered
- **Disabled:** If `st.over === true` (game solved)

#### 3. Flip a Placed Domino
- **Option A:** Tap the domino directly
  - Effect: Toggle `d.flip` boolean
- **Option B:** Tap the ↻ control button
  - Effect: Toggle `d.flip` boolean
- **Effect (both):** Domino visually flips (left/right swap), column sums update, check for win

#### 4. Remove a Domino
- **Action:** Tap the × control button on a placed domino
- **Effect:**
  - `slots[slotIndex] = null`
  - `d.placed = null` (back to tray)
  - Domino reappears in tray
  - Slot returns to empty state (dashed border, "DROP" text)
  - Column sums recalculate
- **Disabled:** If `st.over === true`

#### 5. Flip Unplaced Domino
- **Action:** Tap domino in tray (without selecting it first)
- **Behavior:** Toggles flip state without selection
- **Visual:** Domino shows flipped pips immediately

#### 6. Reset Board
- **Action:** Tap "Reset board" button
- **Effect:**
  - All dominoes returned to tray
  - All slots cleared
  - All flip states reset to false
  - Selection cleared
  - Message cleared
  - Board re-rendered
- **Disabled:** If game is over (`st.over === true`)

### Keyboard Support (Prototype)

The prototype has **no keyboard support**. Production should add:
- **Arrow keys / WASD:** Navigate between slots (if implementing touch-less flow)
- **Space / Enter:** Place selected domino in focused slot
- **R / Spacebar:** Flip focused domino
- **Backspace / Delete:** Remove domino from focused slot
- **Shift+R / Shift+Space:** Reset board
- **Escape:** Deselect

### Mobile Gestures (Prototype)

The prototype has **no touch-specific gestures**. Production could add:
- **Swipe up/down on slot:** Rotate through available dominoes
- **Long-press on domino:** Show preview of flipped state
- **Pinch:** Zoom (if needed for accessibility)

### Accessibility (Prototype)

The prototype has **no ARIA labels or semantic HTML**. Production must add:
- `role="button"` on all interactive elements
- `aria-label` for all controls (e.g., "Place domino in slot 1")
- `aria-pressed` for selected state
- `tabindex` for keyboard navigation
- Screen reader announcements for state changes ("Column 0 now at 8, target 8")

---

## Game States & Transitions

```
┌─────────────────┐
│  INIT / RESET   │ (initPips called, board fresh)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PLAYING       │ (dominoes can be placed/flipped/removed)
│  (st.over=false)│
└────────┬────────┘
         │ (all slots filled && all targets met)
         ▼
┌─────────────────┐
│   WON / SOLVED  │ (st.over=true, msg="Solved!")
│   (pipsEnd())   │ (modal opens, state saved)
└─────────────────┘
```

### State Object

```javascript
st = {
  sel: null|number,      // selected domino id for placement
  over: boolean          // true when puzzle solved
}
```

### Cleanup & Persistence

- **Cleanup:** `this._cleanup.push(...)` to remove event listeners when screen hidden
- **Persistence:** `markPlayed('d')` marks daily puzzle as played; `doneD` flag set in `this.S`
- **Share:** Pre-formatted share text via modal button

---

## Animations & Feedback

### Visual Feedback (Prototype)

1. **Selection outline:** 2px solid #ff9e3d, -2px offset, 0.15s transition
2. **Column highlight:** Smooth border/background color change (no explicit transition, but colors update instantly)
3. **Message flash:** "Solved!" appears on win; no fade animation in prototype
4. **Modal:** Slides in from center (CSS not detailed in code; likely fade-in)

### Production Enhancements

1. **Domino placement:** Slide animation into slot (0.3–0.4s)
2. **Domino flip:** Rotate 180deg around Y-axis (0.25s)
3. **Column success pulse:** Subtle scale/glow when target met (0.4s ease-out)
4. **Removal:** Slide back to tray or fade out (0.2s)
5. **Win animation:** All dominoes bounce/glow, then modal slides in (0.5–0.8s total)
6. **Haptic feedback:** Tap vibration on placement, flip, removal (on supported devices)
7. **Sound effects:** Subtle chime on column target met, fanfare on win (optional, respect muted setting)

### Error Feedback

- **Overfull column:** Red border + text color (#ff6b9d) on the target cell
- **User error (e.g., invalid placement):** No explicit feedback in prototype; consider adding a brief message or shake animation
- **Already solved message:** "Solved today — replay for practice" shown in status area

---

## Win Screen & Completion

### Modal Content

```
┌─────────────────────────────────────────────┐
│      [PUZZLE COMPLETE]  (amber header)      │
│                                             │
│         Perfectly balanced.                 │
│         (headline, 30px, Space Grotesk 600) │
│                                             │
│   🁣 🁧 🁫 🁪  (domino emojis, 34px)        │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │ 🧠 BRAIN INSIGHT                      │ │
│  │ Domino logic exercises constraint     │ │
│  │ satisfaction — the prefrontal cortex  │ │
│  │ juggling several rules at once while  │ │
│  │ it searches for the one arrangement   │ │
│  │ that fits them all.                   │ │
│  └────────────────────────────────────────┘ │
│                                             │
│ [Share result] (primary button, gradient)   │
│ [Back to today] (ghost button)              │
└─────────────────────────────────────────────┘
```

### Share Text

```
BrainTap · Pips
Every column balanced 🁫

braintap.app/games
```

---

## Styling & Theme

### Color Palette

- **Accent (Pips):** #ff9e3d (warm orange)
- **Success (column match):** #7CF5C4 (mint green)
- **Error (over-target):** #ff6b9d (hot pink)
- **Primary text:** #f3f7ff (off-white)
- **Secondary text:** rgba(226,234,255,.6) (muted blue-white)
- **Subtle bg:** rgba(255,255,255,.03–.06) (very dim)
- **Dark bg:** #04060f (near-black)
- **Domino gradient:** Linear from #fff to #e8ecff (bright to pale blue)
- **Domino pip color:** #1a1030 (dark navy)

### Typography

- **Titles/Headlines:** Space Grotesk, weight 600, size 18–30px
- **UI Labels:** JetBrains Mono, size 10–12px, letter-spacing 0.1–0.2em
- **Numbers:** Space Grotesk 600, size 20–26px
- **Body text:** Default system font, size 14px, line-height 1.5–1.55

### Spacing

- **Container max-width:** 360px (game area)
- **Gap between slots:** 10px
- **Gap between dominoes in tray:** 12px
- **Section margins:** 6–24px (vertical spacing between sections)

### Border Radius

- **Slots/targets:** 10–12px
- **Buttons:** 100px (pill shape) for reset, 12px for modal buttons
- **Dominoes:** 9px
- **Modal:** 14px

---

## Daily-Level Requirements

### Current Status (Prototype)

The prototype contains **4 hardcoded puzzles**, selected via:
```javascript
puzzles[Math.floor(Date.now() / 864e5) % puzzles.length]
```

This cycles through 4 puzzles every 4 days — **insufficient for production**.

### Production Requirement

**Need:** A pre-generated bank of **minimum 365+ unique, solvable daily puzzles** to support one year of play without repeat.

**Recommended:** 500–730 puzzles to allow for:
- Holidays / special themes
- Rotation flexibility
- A/B testing of difficulty
- Future rotation without immediate repeats

### Level Data Shape

```javascript
{
  id: string,              // unique identifier (e.g., "pips-2025-01-15")
  date: "YYYY-MM-DD",      // publication date
  targets: [n, n, n, n],   // 4-element array, each 0–10
  bank: [[a,b], [a,b], [a,b], [a,b]], // 4 dominoes
  difficulty: "Easy"|"Medium"|"Hard",  // optional rating
  solution: [[si, flip], [si, flip], ...], // optional: correct placement order
  solvable: boolean        // validation flag
}
```

### Solvability Validation

**Algorithm to validate each puzzle is solvable with a unique solution:**

1. **Generate all permutations:**
   - 4 dominoes × (2 positions per domino: flipped or not) = 2^4 = 16 flip states
   - 4! = 24 orderings of domino placement = 576 total configs

2. **For each configuration:**
   - Place dominoes in order: slot 0, 1, 2, 3
   - For each slot, try all 4 remaining dominoes in both flip states
   - Calculate column sums
   - Check if all columns hit targets exactly

3. **Validation criteria:**
   - **Solvable:** At least 1 configuration solves the puzzle
   - **Unique:** Exactly 1 configuration solves the puzzle (recommended for clean logic)
   - **Store:** Mark puzzle `solvable=true` only if it passes

4. **Pseudo-code:**

```javascript
function validatePuzzle(puzzle) {
  const {targets, bank} = puzzle;
  let solutionCount = 0;
  let validSolution = null;

  // Generate all domino orderings (permutations of indices 0–3)
  for (const ordering of permutations([0, 1, 2, 3])) {
    // Generate all flip combinations (2^4 = 16)
    for (let flipBits = 0; flipBits < 16; flipBits++) {
      // Construct board state
      const slots = [null, null, null, null];
      const flips = {};
      for (let i = 0; i < 4; i++) {
        const dId = ordering[i];
        slots[i] = dId;
        flips[dId] = (flipBits & (1 << i)) !== 0;
      }

      // Calculate column sums
      const sums = [0, 0, 0, 0];
      for (let si = 0; si < 4; si++) {
        const dId = slots[si];
        const d = bank[dId];
        const left = flips[dId] ? d[1] : d[0];
        const right = flips[dId] ? d[0] : d[1];
        const pairStart = (si % 2) * 2;
        sums[pairStart] += left;
        sums[pairStart + 1] += right;
      }

      // Check solution
      if (sums.every((v, i) => v === targets[i])) {
        solutionCount++;
        if (solutionCount === 1) {
          validSolution = {ordering, flips};
        }
      }
    }
  }

  return {
    solvable: solutionCount > 0,
    unique: solutionCount === 1,
    solutionCount,
    solution: validSolution
  };
}
```

### Difficulty Curve

**Suggested grading based on solvability complexity:**

- **Easy:** Fewer possible placements; one domino has a clear forced position
  - Indicators: High-value targets (8+), asymmetric targets, narrow solution space
- **Medium:** Multiple possible intermediate states; requires 2–3 lookahead steps
  - Targets balanced 4–7 range, some symmetry
- **Hard:** Many valid intermediate states; requires global constraint reasoning
  - Low targets (0–3), symmetric targets, multiple local optima

**Production tool:** Build a solvability analyzer that flags difficulty and suggests level progression.

---

## Production Polish Checklist

### Core Gameplay

- [ ] Implement efficient solvability checker; validate all 365+ puzzles before shipping
- [ ] Add hint system (reveal next best move, or which column is "closest")
- [ ] Undo/redo stack for moves (last N placements)
- [ ] Undo protection: confirm before reset if unsolved
- [ ] Tutorial flow: first 1–2 puzzles with guided steps
- [ ] Difficulty indicator: display current puzzle's grade (Easy/Medium/Hard)

### Responsiveness & Layout

- [ ] Mobile-first; test on phones (375px–480px width)
- [ ] Tablet layout: consider 2-column screen (game + stats on iPad)
- [ ] Landscape orientation support; adjust domino tray wrapping
- [ ] High-DPI screens: test domino rendering at 2x scale
- [ ] Dark mode: already dark-themed; validate contrast ratios (WCAG AA)

### Animations & Polish

- [ ] Domino placement: slide from tray to slot (0.3s ease-out)
- [ ] Domino flip: 3D rotation effect (0.25s)
- [ ] Column success: subtle glow or scale-up when target hits (0.3s)
- [ ] Win animation: confetti or bouncing dominoes (0.8s), then modal slide-in (0.4s)
- [ ] Removal: slide back to tray or fade (0.2s)
- [ ] Selection outline: smooth 0.15s transition (already done)
- [ ] Message transitions: fade in/out for "Solved!" and error states
- [ ] Haptics: tap feedback on iOS/Android for placement, flip, success (use `navigator.vibrate`)

### Haptics & Sound

- [ ] Haptics:
  - Placement: 50ms pulse
  - Flip: 30ms pulse
  - Success: 3-pulse pattern (50ms, 30ms gap, 50ms)
- [ ] Sounds (optional, respect user mute setting):
  - Column-meet: soft chime (freq ~523 Hz, 200ms)
  - Win: fanfare (3-note sequence)
- [ ] Mute toggle: store in `this.S.settings.sound`

### Accessibility & ARIA

- [ ] Semantic HTML: use `<button>` for all interactive elements
- [ ] ARIA labels:
  - Slots: `aria-label="Slot 1: empty"` or `"Slot 1: Domino 0 (3, 2), flipped"`
  - Columns: `aria-label="Column 0: 5 of 8 pips"`
  - Dominoes: `aria-label="Domino 0: 3 left, 2 right (unflipped)"`
  - Buttons: `aria-label="Flip domino 0"`, `"Remove from slot 1"`, etc.
- [ ] Keyboard navigation:
  - Tab through slots and tray
  - Arrow keys: move focus left/right/up/down
  - Space/Enter: place, flip, remove (context-sensitive)
  - Escape: deselect
- [ ] Screen reader announcements:
  - Column sum updates: "Column 0 now 5, target 8"
  - State changes: "Domino placed, column 0 updated"
  - Win: "Puzzle solved! All columns balanced."
- [ ] Focus indicators: visible outline for keyboard users (use `:focus-visible`)
- [ ] Color contrast: ensure WCAG AA (4.5:1 for text, 3:1 for UI components)
- [ ] Alt text: for emojis in win screen (already semantic)

### Game Flow

- [ ] Navigation: "← Today" button returns to hub
- [ ] Daily state persistence:
  - Track `doneD` flag (puzzle solved today)
  - Store best-time if timed version added
  - Sync with backend (if multi-device)
- [ ] Replay mechanism: allow re-playing solved puzzle with fresh board
- [ ] Share integration:
  - Copy-to-clipboard for share text
  - Social share buttons (Twitter, WhatsApp, etc.) if applicable
  - Dynamic emoji in share (use domino emojis 🁣–🁪)

### Edge Cases & Validation

- [ ] Empty puzzle load: gracefully handle missing daily puzzle (fallback to random)
- [ ] Timezone handling: ensure "daily" respects user's local midnight, not server time
- [ ] Offline support: cache daily puzzle in localStorage if needed
- [ ] Device rotation: maintain state on landscape/portrait switch
- [ ] Rapid interaction: debounce clicks (prevent double-placement, etc.)
- [ ] Very large/small screens: test on foldables, wearables, ultra-wide monitors
- [ ] Browser compatibility: test on Safari, Chrome, Firefox, Edge; iOS Safari; Chrome Mobile

### Performance

- [ ] Rendering: test 60 FPS on target devices (especially dominoes with shadows)
- [ ] Memory: ensure no leaks from event listeners (already use `this._cleanup`)
- [ ] Bundle size: minify/gzip; Pips game JS should be <20KB
- [ ] Load time: puzzle should appear within 2s on 3G
- [ ] Flip animation: smooth 3D rotation without jank

### Testing & QA

- [ ] Unit tests: solvability checker, column sum calculation, flip logic
- [ ] Integration tests: placement, removal, reset flows
- [ ] Visual regression: domino rendering, layout across breakpoints
- [ ] A/B test: optional difficulty ratings; track completion rates by grade
- [ ] User testing: validate hint system is helpful, not spoiling
- [ ] Automated nightly: re-validate all 365+ puzzles still solvable (detect data corruption)

### Documentation

- [ ] In-game help: "How to Play" modal with the prototype's 5-step flow (already done, see `showHelp('pips')`)
- [ ] Tip on load: rotating strategy hints (first playthrough, then alternate tips)
- [ ] Accessibility guide: document keyboard controls and screen-reader setup
- [ ] Developer notes: solvability checker algorithm, data format, daily schedule logic

---

## Prototype Observations vs. Production

### What the Prototype Does Well

1. **Core mechanic is sound:** Flipping & placement constraints work correctly
2. **Visual hierarchy:** Clear column targets, tray, slots separation
3. **Color-coded feedback:** Green for success, red for overfull, muted for pending
4. **Domino rendering:** Realistic pip dots, readable layout
5. **State management:** Clean separation of selection, placement, flip states
6. **Daily seeding:** Deterministic date-based puzzle selection (though limited bank)

### What Production Must Add

1. **Large puzzle bank:** 365+ pre-generated, validated puzzles (currently 4)
2. **Difficulty curve:** Easy/Medium/Hard progression; current puzzles not rated
3. **Animations:** Placement, flip, success, win (currently instant updates)
4. **Accessibility:** ARIA, keyboard nav, screen-reader support (none currently)
5. **Haptics/sound:** Tap feedback, optional audio (not in prototype)
6. **Hint system:** Strategic guidance (not in prototype)
7. **Undo/redo:** Move history (not in prototype)
8. **Mobile gestures:** Swipe, long-press (not in prototype)
9. **Tutorial:** Guided first-play (only a help modal exists)
10. **Share enhancements:** Social buttons, dynamic text, emoji handling

---

## Technical Notes for Developers

### Key Implementation Details

1. **Domino halves function:**
   ```javascript
   const halves = (d) => ({
     left: d.flip ? d.b : d.a,
     right: d.flip ? d.a : d.b
   });
   ```

2. **Column sum calculation is the core loop:**
   ```javascript
   const colSums = () => {
     const s = [0, 0, 0, 0];
     slots.forEach((id, si) => {
       if (id == null) return;
       const d = bank[id];
       const {left, right} = halves(d);
       const ps = (si % 2) * 2;  // pair start: 0 or 2
       s[ps] += left;
       s[ps+1] += right;
     });
     return s;
   };
   ```

3. **Win check is simple:**
   ```javascript
   const check = () => {
     if (!slots.every(x => x != null)) return;  // all filled?
     const s = colSums();
     if (s.every((v, i) => v === targets[i])) {
       st.over = true;
       msg.textContent = 'Solved!';
       setTimeout(() => this.pipsEnd(), 320);
     }
   };
   ```

4. **Pip rendering uses a 9-cell grid with a map:**
   ```javascript
   const map = {
     0: [],
     1: [4],
     2: [0, 8],
     3: [0, 4, 8],
     4: [0, 2, 6, 8],
     5: [0, 2, 4, 6, 8],
     6: [0, 3, 6, 2, 5, 8]
   };
   ```

5. **Event cleanup:**
   - All event listeners pushed to `this._cleanup` array
   - Called when screen is hidden to prevent memory leaks
   - Ensure undo/redo listeners also cleanup

### React/Next.js Migration Notes

- Convert state object `st` to multiple `useState` hooks: `sel`, `over`
- Convert `bank` and `slots` to state as well
- Render functions (`renderCols`, `renderSlots`, `renderTray`) become JSX components
- Event handlers become `onClick` callbacks with proper closures
- Cleanup via `useEffect` return function
- Consider custom hook `usePips(puzzleId)` to encapsulate game logic
- Daily puzzle fetching: use `getStaticProps` for build-time, or API call for dynamic refresh

---

## Embedded Data Summary

### Hardcoded Puzzle Bank (Prototype)

```javascript
[
  {targets:[8,4,7,4], bank:[[3,2],[4,1],[5,2],[3,3]]},
  {targets:[3,7,9,7], bank:[[2,4],[6,3],[1,3],[3,4]]},
  {targets:[10,3,6,9], bank:[[6,1],[2,5],[4,2],[4,4]]},
  {targets:[7,7,6,6], bank:[[5,2],[3,4],[2,5],[3,2]]}
]
```

These 4 puzzles are the current "daily" rotation. **Production must replace with a validated bank of 365+.**

### Pip Mapping (Standard Domino Notation)

```javascript
{
  0: [],           // blank
  1: [4],          // center dot
  2: [0, 8],       // opposite corners (top-left, bottom-right)
  3: [0, 4, 8],    // diagonal line
  4: [0, 2, 6, 8], // all four corners
  5: [0, 2, 4, 6, 8], // four corners + center
  6: [0, 3, 6, 2, 5, 8] // six dots (standard domino pattern, omit 4 center)
}
```

**Note:** Position 4 (center) is omitted for 6-pips to match classic domino layouts.

### Brain Insight (Win Screen)

```
"Domino logic exercises constraint satisfaction — the prefrontal cortex 
juggling several rules at once while it searches for the one arrangement 
that fits them all."
```

This explains the cognitive benefit; keep it in the final version or update based on neuroscience review.

---

## References

- **NYT Pips:** https://www.nytimes.com/games/pips (official inspiration)
- **Domino pips standard:** Standard domino tile layouts (0–6 per side)
- **Constraint satisfaction:** Wikipedia CSP articles for algorithm research
- **Color accessibility:** WCAG 2.1 AA/AAA guidelines (contrast ratios)
- **Date-based seeding:** Use `Math.floor(Date.now() / 86400000) % puzzleCount` for daily reset

---

## Checklist for Build-Ready Status

- [ ] Spec reviewed and approved by design/product
- [ ] Solvability validator implemented and tested (supports 365+ puzzles)
- [ ] Puzzle bank generated, validated, and stored
- [ ] React component structure designed and approved
- [ ] Animation/transition library selected (Framer Motion, React Spring, etc.)
- [ ] Accessibility audit plan defined
- [ ] Keyboard navigation spec approved
- [ ] Haptics strategy approved (vibration API)
- [ ] Daily puzzle delivery mechanism finalized (static vs. API)
- [ ] Share/social integration planned
- [ ] Analytics events defined (puzzle start, placement, win, hint usage, etc.)

---

**Spec Version:** 1.0  
**Last Updated:** 2026-06-17  
**Status:** Ready for production development  
