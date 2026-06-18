# Sum Sprint — Production Specification

**Game ID:** `sprint`  
**Prototype:** `/Users/orie/dev/braintap/design_src/BrainTap Games.dc.html` (lines 645–675 markup, 1669–1718 logic)  
**Framework:** React/Next.js (rebuilding from DC prototype)

---

## 1. Core Game Mechanics

### Objective
Tap numbers that sum exactly to a target value within a 60-second countdown. Each correct target gives +1 score and refreshes the grid with new numbers and a new target.

### Round Structure
- **Duration:** Exactly 60 seconds (hard timer, no pauses)
- **Game Loop:**
  1. Display a 4×4 grid (16 cells) of random numbers 1–9
  2. Show a target sum (2–3 numbers combined)
  3. Player taps cells to select them
  4. **On exact match:** Score +1, replace selected numbers with fresh 1–9, generate new target
  5. **On overshoot:** Clear selection, shake feedback (no score loss, but time wasted)
  6. **On undershoot:** No action, player continues selecting
  7. **On time up (≤0s):** End game, show result modal

### Win/Lose Conditions
- **Win State:** Not applicable; the game is continuous scoring.
- **Loss State:** Timer reaches 0; final score is tallied.
- **Scoring:** Count = number of targets cleared in 60 seconds. No penalty for wrong attempts.

### Target Generation Algorithm
```
const k = 2 + floor(random() * 2);  // k ∈ {2, 3}
const indices = shuffle([0..15]);   // Random permutation of grid indices
target = sum(grid[indices[0..k-1]]);
```
**Key:** Targets are always sums of 2 or 3 randomly-selected grid cells. This ensures variability and prevents trivial single-cell "targets."

---

## 2. UI Layout & Visual Design

### Screen Structure
**Container:** `id="screen-sprint"`, centered max-width 420px, padding 96px top / 20px sides / 40px bottom

#### Header Bar (Flex, space-between)
```
[← Today button] [Title block] [Spacer 60px]
```
- **Left:** "← Today" link (JetBrains Mono, 12px, color `rgba(226,234,255,.6)`)
- **Center:**
  - Game title: "Sum Sprint" (Space Grotesk, weight 600, size 18px, color `#f3f7ff`)
  - Subtitle: "NUMBER · 60 SECONDS" (JetBrains Mono, 10.5px, letter-spacing 0.1em, color `#9bf7d3`)
- **Right:** Empty 60px spacer

#### Stats Bar (Flex, gap 12px, centered, max-width 420px)
Three cards, each with max-width constrained:

1. **Target Card**
   - Background: `linear-gradient(180deg, rgba(124,245,196,.1), rgba(8,12,26,.4))`
   - Border: 1px solid `rgba(124,245,196,.3)`, radius 16px
   - Display: `#sprint-target` (Space Grotesk, weight 600, size 34px, color `#eafcff`, line-height 1)
   - Label: "TARGET" (JetBrains Mono, 9.5px, letter-spacing 0.14em, color `#9bf7d3`)
   - Initial text: "—" (dash)

2. **Time Card**
   - Background: `rgba(255,255,255,.04)`
   - Border: 1px solid `rgba(255,255,255,.1)`, radius 16px
   - Display: `#sprint-time` (Space Grotesk, weight 600, size 34px, color `#ffb020`)
   - Label: "SECONDS" (JetBrains Mono, 9.5px, color `rgba(226,234,255,.45)`)
   - Countdown 60 → 0

3. **Score Card**
   - Background: `rgba(255,255,255,.04)`
   - Border: 1px solid `rgba(255,255,255,.1)`, radius 16px
   - Display: `#sprint-score` (Space Grotesk, weight 600, size 34px, color `#00e5ff`)
   - Label: "SCORE" (JetBrains Mono, 9.5px, color `rgba(226,234,255,.45)`)
   - Increments 0 → final score

#### Selection Feedback
- **Status Line:** "Selected sum: `<span id="sprint-sum" style="color:#7CF5C4">0</span>`"
  - Font: JetBrains Mono, 12px, base color `rgba(226,234,255,.55)`
  - Sum text highlighted in `#7CF5C4`

#### Grid
- **Container:** `#sprint-grid`
- **Layout:** CSS Grid, 4 columns × 4 rows (16 cells)
- **Dimensions:** `width: min(92vw, 332px)`, gap 8px, margin-top 18px
- **Cell States:**
  - **Unselected:**
    - Background: `rgba(255,255,255,.06)`
    - Color: `#eafcff`
    - Border-radius: 12px
    - Font: Space Grotesk, weight 600, size 24px
    - Cursor: pointer (during game) / default (before start)
  - **Selected:**
    - Background: `linear-gradient(160deg, #16b97e, #7CF5C4)`
    - Color: `#04140d`
    - Box-shadow: `0 0 16px rgba(124,245,196,.45)`
    - Transform: `scale(0.95)`
  - **Interaction:** Toggle selection on tap (multi-select allowed)

#### Overlay & Button
- **Start Button:** `#sprint-start`
  - Text: "Start sprint"
  - Styling: `.bt-primary` class
  - Background: `linear-gradient(118deg, #7CF5C4, #00e5ff)`
  - Border-radius: 13px, padding 15px 36px
  - Box-shadow: `0 10px 30px rgba(124,245,196,.22)`
  - Font: Space Grotesk, weight 600, size 15px, color `#04060f`
  - Display: Flex, margin-top 22px
  - On click: Call `start()` function

- **Overlay Container:** `#sprint-overlay`
  - Wraps start button
  - Hidden after game begins (`display: none`)
  - Shown again at end (`display: flex`)
  - Button text changes to "Play again" after first run

### Game States

| State | Visual | Interaction |
|-------|--------|-------------|
| **Pre-Game** | Grid shows random 1–9 numbers. Start button visible. Target shows "—" (dash). | Tap "Start sprint" to begin. |
| **Playing** | 60s countdown running. Grid interactive. Numbers highlight on tap. Targets and score update live. | Tap cells to select. Overshoot triggers shake. Match triggers flash + refresh. |
| **Game Over** | Grid frozen. Overlay shows "Play again" button. Result modal appears (see §5). | Tap "Play again" or "Back to today". |

---

## 3. Interactions

### Tap/Click on Number Cells
- **Unselected → Selected:** Add to `st.sel` (Set), update visual, recalculate sum display
- **Selected → Unselected:** Remove from `st.sel`, update visual, recalculate sum
- **Multi-select allowed:** No upper limit on how many cells can be selected simultaneously
- **Sum recalculation:** Every change updates `#sprint-sum` text in real-time

### Target Match (Exact Sum)
```javascript
if (sumSel() === st.target) {
  st.score++;
  // Replace selected numbers with new random 1-9
  st.sel.forEach(id => st.nums[id] = randCell());
  // Clear selection
  st.sel.clear();
  // Generate new target
  newTarget();
  // Flash feedback (target box color brightens)
  flashGood();
  // Re-render grid
  render();
}
```

### Overshoot (Sum > Target)
```javascript
else if (sumSel() > st.target) {
  st.sel.clear();  // Deselect all
  // Shake animation feedback (grid.style.animation = 'btShake .4s')
  shake();
  // Render (clears selection visuals)
  render();
}
```

### Undershoot (Sum < Target)
- No action. Player continues tapping to add more cells.
- Sum display updates live.

### Start Button
- Initializes fresh grid with 16 random 1–9 numbers
- Clears selection, score reset to 0, time reset to 60
- Hides overlay, shows playing grid
- Starts 1-second tick interval

### Keyboard (Production)
- **Optional:** Keyboard number entry (1–9) to select numbers by value? **Or:** arrow keys to navigate grid cells?
- **Prototype does not implement keyboard.** Recommend: Add arrow key navigation + spacebar to select focused cell for accessibility.

### Mobile Gestures (Production)
- **Prototype uses tap only.** For production, consider:
  - Single tap to select/deselect (as implemented)
  - Drag to multi-select? (Not in prototype; may add for speed if desired)
  - Swipe to dismiss modal? (Standard pattern)

### Back to Today
- "← Today" button in header navigates back to home screen
- Game state is discarded (no resume)

---

## 4. Animations & Feedback

### Target Flash (Good Match)
```javascript
flashGood() {
  if (tEl) {
    tEl.style.color = '#7CF5C4';  // Bright green
    setTimeout(() => tEl.style.color = '#eafcff', 260);  // Reset to white
  }
}
```
**Visual Effect:** Target card text briefly flashes bright cyan-green, then returns to white. Duration ~260ms. Provides instant positive confirmation.

### Shake Animation (Overshoot)
```javascript
shake() {
  grid.style.animation = 'btShake .4s';
  setTimeout(() => grid.style.animation = '', 420);
}
```
**CSS Animation:** `btShake` class (defined in `/Users/orie/dev/braintap/design_src/support.js`). Likely a horizontal wiggle, 400ms duration. Provides error feedback without sound.

**CSS to define (Production):**
```css
@keyframes btShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
```

### Cell Selection Animation
- Selected cells scale to 0.95 and apply gradient background instantly on tap
- Deselection reverses this immediately

### Number Replacement (Post-Match)
- When cells refresh with new numbers, no fade or transition; instant swap
- Production option: Add a brief fade-out/in (200ms) to soften the visual switch

### Countdown Display
- Time updates every 1 second (no animation; direct text swap)
- No visual change at critical moments (e.g., last 10s); could add subtle color change for urgency

---

## 5. Result Modal & End Screen

### Modal Structure
Rendered by `sumSprintEnd(score)` function. Displays:

```html
<div style="text-align:center;">
  <div style="font-family:'JetBrains Mono';font-size:11px;letter-spacing:.2em;color:#7CF5C4;">TIME!</div>
  <div style="font-family:'Space Grotesk';font-weight:600;font-size:30px;color:#f3f7ff;margin-top:8px;">
    {title}
  </div>
  <div style="font-family:'Space Grotesk';font-weight:600;font-size:48px;color:#7CF5C4;margin-top:10px;">
    {score}
  </div>
  <div style="font-family:'JetBrains Mono';font-size:11px;letter-spacing:.1em;color:rgba(226,234,255,.5);margin-top:2px;">
    TARGETS CLEARED · 60S
  </div>
  <div style="background:rgba(124,245,196,.07);border:1px solid rgba(124,245,196,.2);border-radius:14px;padding:16px;margin-top:20px;text-align:left;">
    <div style="font-family:'JetBrains Mono';font-size:10px;letter-spacing:.16em;color:#9bf7d3;">🧠 BRAIN INSIGHT</div>
    <div style="font-size:14px;line-height:1.55;color:rgba(226,234,255,.82);margin-top:8px;">
      {insight}
    </div>
  </div>
  <button data-share="{share_text}">Share result</button>
  <button data-home>Back to today</button>
</div>
```

### Scoring Tiers & Titles
```javascript
const title = score >= 12 ? 'Lightning math.'
            : score >= 7  ? 'Quick thinker.'
            : score >= 3  ? 'Solid run.'
            : 'Warm-up done.';
```

### Share Text
```
BrainTap · Sum Sprint
{score} targets in 60s

{share_grid}
braintap.app/games
```

**`share_grid`:** Visual representation of score (emoji bar)
```javascript
const sq = '🟩'.repeat(Math.max(1, Math.min(12, score)));
// Examples:
// Score 5:   🟩🟩🟩🟩🟩
// Score 15:  🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩 (capped at 12)
```

### Brain Insight Text
```
"Fast mental arithmetic trains processing speed and your brain's approximate number system — the circuitry that estimates quantities at a glance."
```

### Buttons
- **"Share result"** (`.bt-primary`, gradient `linear-gradient(118deg, #7CF5C4, #00e5ff)`)
  - Copies or opens share UI with pre-formatted text
- **"Back to today"** (`.bt-ghost`, subtle border)
  - Navigates to home screen

---

## 6. Embedded Data

### Number Generation
No predefined lists. Numbers are procedurally generated on each play:

```javascript
const randCell = () => 1 + Math.floor(rnd() * 9);
// Produces uniformly random integers 1–9
```

### Random Number Generator
**Seeded LCG (Linear Congruential Generator):**
```javascript
let seed = ((Math.floor(Date.now() / 864e5) * 22695477) + 1) & 0x7fffffff;
const rnd = () => {
  seed = ((seed * 22695477) + 1) & 0x7fffffff;
  return seed / 0x7fffffff;  // [0, 1)
};
```

**Seed Logic:**
- `Date.now() / 864e5` = days since epoch (864e5 ms = 24 hours)
- Multiplied by LCG multiplier (22695477) and offset (+1)
- Ensures **same game per day across all players** (useful for daily challenges)
- Seed value is reset at midnight UTC (or app timezone if implemented)

---

## 7. Daily Level Bank Requirements

### Strategy: **Procedurally Generated (Seeded)**
Sum Sprint does **not** require a pre-generated level bank. Instead:

- **Single seed per day** generates a unique game instance
- **LCG seeding** ensures reproducibility (same day = same numbers and targets)
- **No solvability concerns** because the game is continuous, always playable

### Why Not a Bank?
1. Numbers 1–9 are always solvable (any two numbers sum to 3–18; ample combinations)
2. Targets are derived from the grid itself (always achievable)
3. Procedural generation is efficient and infinite

### If a Bank Is Desired (e.g., for offline play, replay archive, or daily leaderboards):
- **Bank Size:** 365 entries minimum (one per day of year)
- **Entry Structure:**
  ```json
  {
    "date": "2025-01-15",
    "seed": 12345678,
    "gridNumbers": [3, 7, 1, 9, 5, 2, 8, 4, 6, 1, 9, 3, 2, 5, 7, 4],
    "expectedTargets": [10, 12, 8, 11, ...]
  }
  ```
- **Generation:** Pre-compute 365+ entries and store in a static JSON file or database

---

## 8. Solvability & Validation

### Solvability Algorithm
Since targets are always derived from actual grid numbers, **every generated game is trivially solvable:**

1. Target is `sum(grid[randIndices[0..k-1]])` where k ∈ {2, 3}
2. Those indices and numbers will remain in the grid until matched
3. Player simply taps those cells → exact match → target cleared

**Validation is automatic.** No need for explicit solvability checking.

### Uniqueness
Not applicable. Multiple combinations may sum to the same target (e.g., 1+9 = 2+8 = 10). This is a feature, not a bug—it adds strategic choice.

### Testing Recommendations (Production)
- **Unit Test:** Verify LCG seeding is deterministic (same seed → same sequence)
- **Integration Test:** Confirm the generated grid always contains at least one combination matching each target
- **Regression Test:** After randomness changes, ensure targets are always achievable within 60s
- **Load Test:** If using a level bank, verify lookup latency is <1ms

---

## 9. Production Polish & Upgrades

### Responsiveness
- **Prototype:** Fixed layout with `min(92vw, 332px)` widths ✓
- **Production Upgrades:**
  - Test on phones (375px), tablets (768px), desktops (1920px)
  - Adjust grid gap and cell sizes for very small screens (<320px)
  - Ensure touch targets are ≥44px minimum (currently cells are ~70px, safe)
  - Test landscape orientation on mobile; consider locking to portrait or supporting both

### Animations
- **Prototype:** Basic flash and shake ✓
- **Production Upgrades:**
  - Add smooth number transitions (fade-out → swap → fade-in) when cells refill after match
  - Animate score increment with a +1 indicator that drifts upward and fades
  - Celebrate major milestones (e.g., score ≥10) with a subtle pulse or glow on the score card
  - Add hover states on desktop (subtle brightening of unselected cells)

### Haptics & Audio
- **Prototype:** No haptics, no audio
- **Production Upgrades:**
  - **Haptic Feedback:**
    - Light tap on cell selection (iOS: `UIImpactFeedback`, Android: `HapticFeedback`)
    - Medium tap on target match
    - Heavy tap + medium buzz on overshoot
  - **Sound (Optional):**
    - Match success: Short, bright chime (e.g., 440 Hz sine tone, 200ms)
    - Overshoot: Descending buzz (lower frequency, 300ms)
    - Time running out: Subtle warning beep at 10s, 5s, 3s, 1s (toggleable in settings)
    - End of game: Fanfare or bell tone (varies by score tier)

### Accessibility & Keyboard
- **Prototype:** Tap-only, no keyboard support
- **Production Upgrades:**
  - **Keyboard Navigation:**
    - Arrow keys to move focus through grid cells (4×4)
    - Spacebar or Enter to toggle cell selection
    - Tab to navigate buttons (Start, Back, Share)
  - **Screen Reader (ARIA):**
    - Grid role: `role="grid"`
    - Cells: `role="gridcell"`, `aria-selected="true|false"`
    - Status updates: `aria-live="polite"` for sum display and target changes
    - Screen reader announcements:
      - "Cell [row] [col] selected, current sum 12, target 15"
      - "Target matched! +1 score. New target: 11."
      - "Overshoot. Selection cleared."
      - "Game over. Final score: 5 targets in 60 seconds."
  - **Color Contrast:** Verify WCAG AA compliance (4.5:1 for text, 3:1 for UI)
    - Selected cell gradient `#16b97e` to `#7CF5C4` on dark background—likely passes
    - Test with WAVE or Axe DevTools

### Difficulty Curve
- **Prototype:** Single difficulty (random 1–9 numbers, 2–3-cell targets)
- **Production Options:**
  - **Hard Mode:** Numbers 1–9 with higher targets (4–5 cells), fewer easy doubles
  - **Zen Mode:** Unlimited time, just score for fun
  - **Daily Challenge:** Leaderboard with fixed daily seed (tie-breaking by time to 5 targets, then final score)
  - **Survival:** Each round shortens time window for next target (e.g., 60s → 50s → 40s …)

### Hint System
- **Prototype:** None
- **Production Options:**
  - **Hint Button:** Reveals one valid combination (e.g., "Try cells in positions 3 and 12")
  - **Auto-Hint:** If player goes 8s without matching, offer a subtle hint
  - **Accessibility Hint:** Text-only hint for screen reader users (reads aloud two cell indices)

### Share & Social
- **Prototype:** Share button with pre-formatted text ✓
- **Production Upgrades:**
  - **Native Share Sheet:** Use `navigator.share()` API on mobile
  - **Copy to Clipboard:** Fallback for desktop; copy button shows "Copied!" feedback
  - **Share Image:** Generate a graphic (score card, emoji bar) and attach to share
  - **Leaderboard:** Link to daily leaderboard page if applicable

### Edge Cases & Robustness
- **Timer Precision:** Use `Date.now()` not `setInterval` for final elapsed time (avoid drift)
- **Page Visibility:** Pause timer if tab is hidden; resume on focus (battery + fairness)
- **Network Loss:** If game data is sent to server, graceful fallback to local storage
- **Mobile Back Button:** Confirm before exiting mid-game (Android)
- **State Persistence:** Save score to local state during play; recover if page reloads
- **Max Score Display:** No hardcoded limit visible; scores can exceed 12 (emoji bar caps at 12 for visual brevity, but actual score is unbounded)

### Localisation (Optional)
- **Prototype:** English-only
- **Production:** Consider translations of:
  - Button text ("Start sprint", "Play again", "Back to today", "Share result")
  - Label text ("TARGET", "SECONDS", "SCORE")
  - Modal text ("TIME!", titles, insight, brain description)
  - Subtitle ("NUMBER · 60 SECONDS")
  - Use `.json` i18n files keyed by game ID and string key

---

## 10. Technical Implementation Notes

### Prototype Codebase
- **File:** `/Users/orie/dev/braintap/design_src/BrainTap Games.dc.html`
- **Framework:** Custom "DC" reactive framework (not React)
- **Markup Scope:** Lines 645–675 (`#screen-sprint`)
- **Logic Scope:** Lines 1669–1718 (game loop, render, event handlers)

### Production Tech Stack
- **Frontend:** React or Next.js
- **State Management:** React hooks (`useState`, `useEffect`, `useCallback`) or Zustand
- **Timer:** `setInterval` with cleanup on unmount; optional `requestAnimationFrame` for smooth animations
- **Animations:** CSS keyframes or Framer Motion
- **Accessibility:** `react-aria` or manual ARIA attributes

### Component Structure (Suggested)
```
<SumSprintGame>
  ├── <Header title="Sum Sprint" subtitle="NUMBER · 60 SECONDS" />
  ├── <StatsBar target={st.target} time={st.time} score={st.score} />
  ├── <SelectionStatus sum={sumSel()} />
  ├── <Grid 
  │     numbers={st.nums}
  │     selected={st.sel}
  │     running={st.running}
  │     onCellTap={handleTap}
  │   />
  ├── <StartButton onClick={handleStart} visible={!st.running} />
  └── <ResultModal score={st.score} visible={gameEnded} onShare={share} onHome={goHome} />
```

### State Shape (Redux/Zustand)
```typescript
interface GameState {
  nums: number[];           // 16 numbers 1-9
  sel: Set<number>;        // Selected cell indices
  score: number;           // Targets cleared
  time: number;            // Seconds remaining
  running: boolean;        // Game active?
  target: number;          // Current target sum
  timer: NodeJS.Timeout | null;
}
```

### Performance Notes
- Grid re-render is O(16) (constant)
- Target generation is O(16) shuffle + O(k) sum (k ≤ 3)
- No expensive DOM queries; cache references to `#sprint-*` elements
- Animations use CSS (offload to GPU) not JavaScript

---

## 11. File Structure (Production)

```
/apps/web/src/games/
├── sprint/
│   ├── Sprint.tsx              # Main component
│   ├── useSprintGame.ts        # Game logic hook
│   ├── SprintGrid.tsx          # Grid sub-component
│   ├── SprintStats.tsx         # Stats bar
│   ├── SprintResultModal.tsx   # End-of-game modal
│   ├── sprint.styles.css       # Scoped styles
│   ├── sprint.utils.ts         # LCG seed, helpers
│   └── sprint.constants.ts     # Color palette, thresholds
└── (same structure for other games)

/docs/design/
└── game-sprint.md              # This spec
```

---

## 12. Appendix: Prototype Code Reference

### Seed Function (Deterministic Daily RNG)
```javascript
let seed = ((Math.floor(Date.now() / 864e5) * 22695477) + 1) & 0x7fffffff;
const rnd = () => {
  seed = ((seed * 22695477) + 1) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const randCell = () => 1 + Math.floor(rnd() * 9);
```

### Target Generation
```javascript
const newTarget = () => {
  const k = 2 + Math.floor(rnd() * 2);  // 2 or 3
  const ids = [...Array(SIZE).keys()];
  // Fisher-Yates shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  let s = 0;
  for (let i = 0; i < k; i++) s += st.nums[ids[i]];
  st.target = s;
  if (tEl) tEl.textContent = s;
};
```

### Cell Tap Handler
```javascript
b.onclick = () => {
  if (!st.running) return;
  if (st.sel.has(i)) st.sel.delete(i);
  else st.sel.add(i);
  const s = sumSel();
  if (sumEl) sumEl.textContent = s;
  
  if (s === st.target) {
    st.score++;
    if (scoreEl) scoreEl.textContent = st.score;
    [...st.sel].forEach(id => st.nums[id] = randCell());
    st.sel.clear();
    if (sumEl) sumEl.textContent = '0';
    newTarget();
    flashGood();
    render();
  } else if (s > st.target) {
    st.sel.clear();
    if (sumEl) sumEl.textContent = '0';
    shake();
    render();
  } else {
    render();
  }
};
```

### Result Modal Generation
```javascript
sumSprintEnd(score) {
  this.markPlayed('p');
  const sq = '🟩'.repeat(Math.max(1, Math.min(12, score)));
  const share = `BrainTap · Sum Sprint\n${score} targets in 60s\n\n${sq}\nbraintap.app/games`;
  const insight = 'Fast mental arithmetic trains processing speed...';
  const title = score >= 12 ? 'Lightning math.' : score >= 7 ? 'Quick thinker.' : ...;
  this.openModal(`<div style="..."> ... </div>`);
}
```

---

**END OF SPECIFICATION**

*This document is comprehensive and self-contained. A developer with React/Next.js experience should be able to build Sum Sprint from this spec, the prototype, and the code references provided.*
