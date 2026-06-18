# Tile Slide Production Spec

## Game Identity

**Title:** Tile Slide (Identifier: `slide`)  
**Accent Color:** `#00e5ff` (Cyan)  
**Brain Category:** Spatial reasoning, mental rotation, look-ahead planning  
**Daily Frequency:** One puzzle per day (procedurally generated)  
**Difficulty:** Easy to Moderate  

## Core Mechanics

### Win Condition
Slide all numbered tiles into ascending order (1 → 15) with the blank space in the bottom-right corner.

**Solved State:**
```
[ 1] [ 2] [ 3] [ 4]
[ 5] [ 6] [ 7] [ 8]
[ 9] [10] [11] [12]
[13] [14] [15] [  ]
```

### Board & Grid
- **Grid Size:** 4 × 4 (16 positions total)
- **Tiles:** 15 numbered (1–15) + 1 blank (empty space)
- **Tile Dimensions:** Responsive: `min(92vw, 340px)` width, 4-column grid with 8px gap
- **Tile Size (computed):** ~76px on desktop, scales responsively
- **Board Padding:** 8px inner padding, 1px border

### Movement Rules
1. Only tiles **adjacent to the blank space** can move.
2. Tapping a tile slides it into the blank space (blank takes its place).
3. Adjacent means horizontal or vertical neighbors only (not diagonal).
4. **Constraint:** If a player achieves a solved state immediately after shuffle, re-shuffle to guarantee non-trivial puzzles.

### Scoring & Metrics
- **Primary Metric:** Number of moves to solve (lower is better)
- **Secondary Metric:** Time elapsed (minutes:seconds format)
- **Display:** Both shown during play and in result modal
- **No difficulty levels or multiple game modes** — every daily puzzle is equivalent

### Round Structure
1. **Start:** User taps "Shuffle / new" button to initialize puzzle
2. **Playing:** Count moves and elapsed time; update display on every move
3. **Win:** When grid matches solved state, stop timer and show result modal
4. **Result:** Display moves, time, brain insight, and share button

---

## UI Layout & Components

### Screen Container
**Element ID:** `screen-slide`  
**Parent Layout:** Max-width 420px, centered, vertical flex, 96px top padding, 40px bottom padding

### Header Bar
- **Home Button:** Left-aligned, "← Today" text, small monospace font
- **Title:** Center, "Tile Slide" in Space Grotesk weight-600 size-18px, color #f3f7ff
- **Subtitle:** "ORDER 1 → 15" in JetBrains Mono size-10.5px, cyan accent #9fe9ff
- **Spacer:** Right side (60px width for layout balance)

### Stats Bar
**Layout:** Horizontal flex, gap 12px, margin-top 22px

**Moves Counter:**
- **Element ID:** `slide-moves`
- **Value:** Number (starting at 0)
- **Styling:** Space Grotesk weight-600 size-26px, color #eafcff
- **Container:** Cyan-accented card (background `rgba(0,229,255,.07)`, border `rgba(0,229,255,.22)`, border-radius 14px, padding 10px 24px)
- **Label:** "MOVES" in small monospace below, color #9fe9ff

**Time Display:**
- **Element ID:** `slide-time`
- **Value:** Format "M:SS" (e.g., "0:00", "1:45")
- **Styling:** Space Grotesk weight-600 size-26px, color #86a3ff
- **Container:** Subtle card (background `rgba(255,255,255,.04)`, border `rgba(255,255,255,.1)`, border-radius 14px, padding 10px 24px)
- **Label:** "TIME" in small monospace below, color semi-transparent

### Message Area
- **Element ID:** `slide-msg`
- **Height:** Minimum 18px (prevents layout shift)
- **Content:** Empty at start; shows "Solved!" when puzzle complete; shows "Solved today — replay for a better time" on replay
- **Styling:** JetBrains Mono size-12.5px, color #9fe9ff, centered
- **Margin:** 14px above board

### Game Board
- **Element ID:** `slide-board`
- **Grid:** CSS Grid, 4 columns, 8px gap
- **Dimensions:** `min(92vw, 340px)` width, 1:1 aspect ratio
- **Container Styling:** 
  - Background: `rgba(0,229,255,.06)`
  - Border: 1px solid `rgba(0,229,255,.16)`
  - Border-radius: 14px
  - Padding: 8px
- **Margin:** 6px above, buttons below

### Tile Styling

**Regular Tiles (numbered 1–15):**
- **Border:** None
- **Border-radius:** 10px
- **Background:** Linear gradient `linear-gradient(160deg, rgba(0,229,255,.16), rgba(123,140,255,.12))`
- **Text Color:** #eafcff
- **Font:** Space Grotesk weight-600 size-26px
- **Box-shadow:** `0 2px 8px rgba(0,0,0,.2)`
- **Cursor:** pointer
- **Interaction:** Tap to slide; only enabled when adjacent to blank

**Blank Tile:**
- **Background:** transparent (appears empty)
- **Cursor:** default

### Action Buttons

**"Shuffle / new" Button:**
- **Element ID:** `slide-new`
- **Text:** "Shuffle / new" (changes to "New puzzle" after first solve)
- **Styling:** Ghost button variant
  - Background: `rgba(255,255,255,.04)`
  - Border: 1px solid `rgba(255,255,255,.2)`
  - Color: #eaf1ff
  - Font: Space Grotesk weight-500 size-13.5px
  - Border-radius: 100px
  - Padding: 10px 24px
- **Margin:** 18px top
- **Function:** Calls `reset()` → scrambles, zeroes moves/time, clears message, restarts play

### Result Modal

**Trigger:** When `isSolved()` returns true, after 300ms delay

**Modal Container:**
- **Overlay:** Fixed inset, semi-transparent dark backdrop with blur
- **Card:** Max-width 420px, centered, gradient background, cyan border, 24px border-radius, 32px padding

**Result Content Structure:**
1. **Status Label:** "PUZZLE COMPLETE" in small monospace, cyan accent
2. **Achievement Text:** "Order restored." in Space Grotesk weight-600 size-30px
3. **Stats Display:**
   - Moves: Large cyan text (size-34px), "MOVES" label below
   - Time: Large purple text (size-34px), "TIME" label below
   - Layout: Flex row, 28px gap, centered
4. **Brain Insight Box:**
   - Background: `rgba(0,229,255,.06)`, border `rgba(0,229,255,.18)`
   - Border-radius: 14px, padding: 16px
   - Title: "🧠 BRAIN INSIGHT" in small monospace, color #9fe9ff
   - Content: Multi-line educational text about spatial reasoning and mental rotation
5. **Share Button:** Full width, gradient primary style, calls share functionality
6. **Back Button:** Full-width ghost style, returns to hub

**Brain Insight Copy (Fixed):**
> Sliding puzzles build mental rotation and look-ahead planning — you simulate moves in your mind's eye before committing, the same spatial machinery that maps a city or packs a suitcase.

---

## Interactions

### Mouse/Touch Input

**Tile Tap:**
- **Condition:** User taps a numbered tile
- **Logic:** 
  - Check if tile is adjacent to blank (via `neighbors()` function)
  - If yes: swap tile with blank, increment moves, update render
  - If no: no effect
- **Visual Feedback:** Cursor becomes `pointer` for tiles, `default` for blank
- **Performance:** Direct DOM update, no animation delay (immediate slide)

**"Shuffle / new" Button:**
- **Condition:** User clicks button
- **Logic:** Call `reset()` function → re-scramble, zero counters, clear message
- **Visual Feedback:** Button hover lifts up slightly (standard ghost button animation)

**Home/Back Navigation:**
- **Element:** `.bt-go-home` button in header
- **Function:** Navigate back to hub screen
- **Behavior:** Inherited from global framework

### Keyboard Input
- **Not implemented in prototype**
- **Recommendation for production:** Support arrow keys to move focus between tiles and Enter to slide, for accessibility

### Mobile Gestures
- **Swipe/Drag:** Not implemented in prototype
- **Recommendation for production:** Optional swipe-to-slide feature for tablet users (slide finger from tile toward blank to slide it)

### Timing & State
- **Timer Start:** Triggers on first move (when user taps first tile)
- **Timer Update Frequency:** Every 250ms (prevents excessive DOM updates)
- **Timer Stop:** When puzzle solved or user navigates away
- **Cleanup:** `setInterval` IDs stored in `this._cleanup` array for proper teardown

---

## Visual Styling

### Color Palette
- **Game Accent:** #00e5ff (Cyan) — used in borders, labels, highlights
- **Secondary Accent:** #86a3ff (Purple) — used for time display
- **Tile Background Gradient:** 
  - Start: `rgba(0,229,255,.16)` (transparent cyan)
  - End: `rgba(123,140,255,.12)` (transparent purple)
  - Angle: 160deg
- **Text Primary:** #f3f7ff (Off-white)
- **Text Secondary:** #9fe9ff (Light cyan)
- **Text Tertiary:** `rgba(226,234,255,.45)` (Muted)
- **Blank Space:** Transparent (shows board background)

### Fonts
- **Headings & Numbers:** Space Grotesk (weight 600)
- **Labels & UI Text:** JetBrains Mono (weight 400–600, monospace)
- **Fallback:** system-ui, sans-serif

### Animations
- **Tile Click:** No transition delay; movement is instant
- **Button Hover:** `transform: translateY(-2px)` (button lift)
- **Modal Entrance:** Scale-up animation (defined in framework, `cubic-bezier(.2,.7,.2,1)`)
- **Respect Reduced Motion:** All animations disabled if `prefers-reduced-motion: reduce` is set

---

## State Management

### Game State Variables

```javascript
grid            // Array of 16 numbers (1–15 + blank 0)
moves           // Integer, incremented on each valid tile tap
t0              // Timestamp when first move is made
timer           // setInterval ID for time display
over            // Boolean, true when puzzle solved
solved          // Array [1,2,3,...,15,0] (target state)
```

### Persistence
- **Local State:** Not persisted between sessions
- **Daily Completion:** Tracked via `this.S.doneL` flag (set by `markPlayed('l')` on win)
- **Replay Detection:** If `this.S.doneL` is true on init, show "Solved today — replay for a better time" message

---

## Puzzle Generation

### Scrambling Algorithm
```
1. Start with solved state [1,2,3,...,15,0]
2. For 200 iterations:
   a. Find blank position
   b. Get neighbors (up/down/left/right, not diagonal)
   c. Exclude previous position (to avoid undoing last move)
   d. Pick random neighbor, swap with blank
   e. Record previous position for next iteration
3. Check if result is already solved; if yes, re-scramble
```

### Guarantee of Solvability
- This algorithm is **guaranteed to produce solvable puzzles** because:
  - Each move is a legal swap of blank with neighbor
  - Every reachable state via legal moves is part of the solvable permutation group
  - Starting from solved state and applying only valid moves keeps us in the solvable group
  - The inverse of any sequence of moves is also a valid sequence, so it can always be reversed to solved state

### Daily Level Bank Requirements

**Daily Puzzle Delivery:**
- **Needed:** One new puzzle per day for continuous play
- **Recommendation:** Pre-generate a bank of 365+ puzzles (one full year) at app initialization or via server
- **Seeding:** Use a deterministic seed based on current date (e.g., hash of date string) to ensure:
  - Same puzzle for all users on the same day
  - Reproducible across app restarts
  - Ability to pre-generate or generate on-demand

**Level Data Shape (Single Puzzle):**
```json
{
  "date": "2026-06-17",
  "dayNum": 47000,
  "seed": "2026-06-17",
  "scrambleSteps": 200,
  "solvable": true,
  "minSolvable": 52
}
```
- `date`: ISO string for human readability
- `dayNum`: Epoch days since Unix zero (for deterministic seeding)
- `seed`: String for RNG seeding (date hash)
- `scrambleSteps`: Number of random swaps (fixed at 200)
- `solvable`: Boolean confirmation (always true for bank)
- `minSolvable`: Theoretically optimal move count (see solvability validation section)

---

## Solvability Validation

### Algorithm to Verify Solvability

A permutation of 1–15 is solvable if:
1. Count inversions in the permutation
2. If blank is on even row from bottom (1-indexed from bottom):
   - Inversion count must be **odd**
3. If blank is on odd row from bottom:
   - Inversion count must be **even**

**Implementation Example:**
```javascript
function isSolvable(grid) {
  // grid is [1,2,...,15,0]
  const blankRow = Math.floor(grid.indexOf(0) / 4);
  const blankRowFromBottom = 4 - blankRow;
  
  // Count inversions: pairs (i,j) where i < j but grid[i] > grid[j] and both > 0
  let inversions = 0;
  for(let i = 0; i < 16; i++) {
    if(grid[i] === 0) continue;
    for(let j = i + 1; j < 16; j++) {
      if(grid[j] === 0) continue;
      if(grid[i] > grid[j]) inversions++;
    }
  }
  
  // Check parity
  const isEven = (blankRowFromBottom % 2 === 0);
  const inversionsOdd = (inversions % 2 === 1);
  
  return isEven === inversionsOdd;
}
```

### Minimum Moves Estimation

- **No closed formula** exists for the exact minimal move count for a 15-puzzle.
- **Practical approach:** Use **IDA* (Iterative Deepening A\*) algorithm** with a good heuristic (e.g., Manhattan distance) to compute minimum moves for validation.
- **Manhattan Distance Heuristic:**
  ```
  For each tile, calculate |actual_row - goal_row| + |actual_col - goal_col|
  Sum all tiles (excluding blank)
  ```
- **For bank generation:** Run IDA* on a sample of puzzles; store minimum moves as reference (for future difficulty scaling or hint generation).

### Testing Solvability During Development
1. Generate puzzle via scramble algorithm
2. Verify `isSolvable(grid)` returns `true`
3. Optionally verify with IDA* that solution exists and find minimum moves
4. Store puzzle + minimum moves in bank
5. Confirm user can always solve it (no dead-lock states)

---

## Animations & Feedback

### Tile Movement
- **Type:** Immediate swap (no slide animation in prototype)
- **Production Improvement:** Add smooth CSS transform or anime.js slide over 200ms for visual polish

### Success Feedback
- **Message Update:** "Solved!" text appears in message area (color #9fe9ff)
- **Timer Stop:** Timer freezes, no further updates
- **Button Disable:** Further taps have no effect (checked via `if(over) return`)
- **Modal Trigger:** After 300ms delay, result modal fades in with scale-up animation

### Error Feedback
- **No visual shake in prototype for invalid taps** (tile simply doesn't move if not adjacent)
- **Production Improvement:** Add brief red flash or wiggle animation for non-adjacent tile taps

### Loading States
- **Not applicable:** Puzzle generation is instant (no server fetch in this version)

---

## How-to-Play Modal

**Trigger:** Help button (?) in bottom-right corner (inherited from global framework)

**Slide-Specific Content:**
```
Game Name: Tile Slide
Accent Color: #00e5ff

Instructions (4 steps):
1. Slide the numbered tiles into order, 1 to 15.
2. Tap any tile next to the empty space to slide it.
3. Only the blank lets tiles move.
4. Solve it in as few moves and as little time as possible.

Pro Tip (✨):
"Solve the top row and left column first, then never disturb them."
```

---

## Production Polish Checklist

### Responsiveness
- [ ] Test on mobile (375px width) — board should scale to fit within 92vw
- [ ] Test on tablet (768px width) — layout should remain centered and balanced
- [ ] Test on desktop (1920px+) — max-width 420px enforced, no overflow
- [ ] Ensure buttons remain tappable on mobile (min 44px touch target)

### Animations & Performance
- [ ] Add smooth slide animation to tiles (0.2–0.3s cubic-bezier)
- [ ] Debounce timer updates to prevent excessive DOM thrashing
- [ ] Use `will-change: transform` on tiles for GPU acceleration
- [ ] Verify 60fps animation on low-end phones (throttled CPU)

### Accessibility
- [ ] Add `aria-label` to tiles (e.g., "Tile 5, position row 2 column 1")
- [ ] Make tiles keyboard-accessible (Tab focus, arrow keys to move, Enter to slide)
- [ ] Implement screen reader announcements for moves ("Moved tile 5 in 3 moves")
- [ ] Ensure color contrast passes WCAG AA (background #03040b vs. text #eafcff)
- [ ] High-contrast mode support (detect `prefers-contrast`)
- [ ] Haptic feedback on mobile (optional: vibrate on successful moves)

### Difficulty Curve
- **Single difficulty level** — not applicable for this game
- **Optional future:** Add "Challenge Mode" with time limits or move limits

### Hint System
- **Not in prototype**
- **Optional production add:** 
  - "Show Next Move" button (reveal which tile to move)
  - "Auto-solve top row" (guided sequence)
  - Linked to move counter (hint deducts points or adds move penalty)

### Share Functionality
- **Button Text:** "Share result"
- **Share Data:** Moves count, time, and link to braintap.app/games
- **Format:**
  ```
  BrainTap · Tile Slide
  Solved in {moves} moves · {time}
  
  braintap.app/games
  ```
- **Implementation:** Via `data-share` attribute on button; handled by global framework

### Replay & Daily Reset
- [ ] Confirm message changes after daily solve: "Solved today — replay for a better time"
- [ ] Button text changes to "New puzzle" instead of "Shuffle / new"
- [ ] No penalty for replaying (same daily puzzle, same score tracking)
- [ ] Ensure streak is marked only once per day (check `markPlayed('l')` logic)

### Edge Cases
- [ ] User navigates away mid-game → timer stops, state not saved, restarting resets
- [ ] User goes from solved to replay → button text changes, message clears on new shuffle
- [ ] Multiple rapid taps on same tile → queuing or debouncing prevents double-swaps
- [ ] Extreme mobile viewport (320px) → board stacks vertically, readability preserved
- [ ] User disables JavaScript → fallback messaging (not applicable for DC framework)

### Visual Polish
- [ ] Tile drop shadows should react to tilt/perspective (optional 3D effect on hover)
- [ ] Modal entrance smooth and not jarring (check easing function)
- [ ] Loading skeleton or placeholder while puzzle initializes (not needed if instant)
- [ ] Empty state messaging if scramble fails (re-scramble handles this)
- [ ] Dark mode consistent with brand (already embedded in #03040b background)

### Sound & Haptics
- **Sound:** Inherited from `this.S.settings.sound` flag; implement via framework's audio player
  - Tile slide SFX: short click (150ms)
  - Solve confirmation: ascending tone (300ms)
  - Can be disabled in Settings
- **Haptics (Mobile):** Via `navigator.vibrate()` or Web Vibration API
  - Tile slide: 20ms pulse
  - Solve: 3× 50ms pulses with 50ms gaps

---

## Technical Implementation Notes

### State Cleanup
- All timers and intervals are stored in `this._cleanup` array
- On unmount, framework calls cleanup functions: `this._cleanup.forEach(fn => fn())`
- Prevents memory leaks on screen navigation

### DOM Lifecycle
- Render is called after every move: rebuilds all 16 button elements
- Performance: O(16) operations, negligible for modern devices
- Optimization opportunity: Use React/Next.js reconciliation instead of full rebuild

### Puzzle Determinism
- Scramble uses `Math.random()` — **not deterministic across sessions**
- **For daily mode:** Pass a seeded PRNG or pre-generated puzzle grid
- Example: `seeded(date) → shuffle → grid for day`

### Color System Integration
- Accent color is parameterized in help modal (`showHelp('slide')`)
- All references to `#00e5ff` and `#9fe9ff` use the game's defined accent
- Easy to rebrand if cyan → other color swap needed

---

## Success Metrics & Analytics

### Tracking (Inherited from Framework)
- **Completion:** `markPlayed('l')` called on solve → `this.S.doneL = true`
- **Streak:** Incremented if played same day
- **Stats:** Displayed in hub and leaderboard

### Recommended Logging
```javascript
{
  gameId: 'slide',
  date: '2026-06-17',
  moves: 42,
  timeMs: 125000,
  minOptimal: 52,
  efficiency: 52/42, // moves / optimal
  hintsUsed: 0,
  timeoutOccurred: false,
  deviceWidth: 375,
  reduceMotion: false,
  timestamp: Date.now()
}
```

---

## Appendix: Code Reference

### Core Functions (from prototype)

**Initialization:**
```javascript
initSlide(){
  const boardEl=document.getElementById('slide-board'), movesEl=document.getElementById('slide-moves'), timeEl=document.getElementById('slide-time'), msg=document.getElementById('slide-msg'), newBtn=document.getElementById('slide-new');
  const N=4, BLANK=0;
  const solved=[...Array(N*N-1).keys()].map(i=>i+1).concat([BLANK]);
  let grid, moves, t0, timer, over;
  const idx=(r,c)=>r*N+c;
  const blankPos=()=>grid.indexOf(BLANK);
  const neighbors=(p)=>{ const r=Math.floor(p/N),c=p%N; const out=[]; if(r>0)out.push(p-N); if(r<N-1)out.push(p+N); if(c>0)out.push(p-1); if(c<N-1)out.push(p+1); return out; };
  // ... rest of functions
}
```

**Scramble:**
```javascript
const scramble=()=>{ 
  grid=solved.slice(); 
  let prev=-1; 
  for(let i=0;i<200;i++){ 
    const b=blankPos(); 
    const nb=neighbors(b).filter(x=>x!==prev); 
    const pick=nb[(Math.random()*nb.length)|0]; 
    [grid[b],grid[pick]]=[grid[pick],grid[b]]; 
    prev=b; 
  } 
  if(isSolved()) scramble(); 
};
```

**Tap Handler:**
```javascript
const tap=(p)=>{ 
  if(over)return; 
  const b=blankPos(); 
  if(!neighbors(b).includes(p))return; 
  [grid[b],grid[p]]=[grid[p],grid[b]]; 
  moves++; 
  // Timer start + render + solve check
};
```

---

## Version History

**v1.0** — Initial extraction from BrainTap Games prototype (June 2026)
- Core 15-puzzle mechanics
- Dual metric tracking (moves + time)
- Daily puzzle integration
- Share result functionality

