# Game Spec: 2048

**Game ID:** g2048  
**Brain Skill:** Spatial planning, arithmetic, executive function, cost-benefit lookahead  
**Prototype Status:** Complete (HTML prototype in BrainTap Games.dc.html)  
**Framework:** Rebuild in React/Next.js  
**Production Target:** Daily play loop (no level bank required — fully procedural)

---

## 1. Core Mechanics & Rules

### Game Overview
2048 is a classic sliding-tile merging game. The player combines tiles of equal value to reach the 2048 tile. The game is **won** when a 2048 tile is created; it is **lost** when the board fills with no legal moves remaining.

### Board State
- **Grid Size:** 4×4 (16 cells total)
- **Initial State:** Two tiles placed randomly in empty cells
  - 90% of new tiles are valued at **2**
  - 10% of new tiles are valued at **4**
- **Empty cells** are displayed with transparent background (no number shown)

### Move Mechanics
The player slides tiles in one of four directions: **Left (L), Right (R), Up (U), Down (D)**

**Slide Algorithm:**
1. Extract all non-empty tiles in the direction of the slide
2. **Merge Step:** For each consecutive pair of identical values, merge the first into the second (double the value), and remove the first
   - Only one merge per tile per move (no chaining: 4+4+4 → 8, not 12)
   - Merging is the only way to gain points; sliding without merging yields no score
3. **Fill Step:** Append zeros (empty cells) to pad the row/column back to length 4

**Example (Left slide with [2, 4, 4, 2]):**
- Extract non-empty: [2, 4, 4, 2]
- Merge: 4+4 → 8, giving [2, 8, 2]
- Pad: [2, 8, 2, 0]
- Result: Score += 8

### Tile Values & Points
- Merging two tiles yields points equal to the resulting tile value
  - 2+2 → 4 (earn 4 points)
  - 4+4 → 8 (earn 8 points)
  - ... up to 1024+1024 → 2048 (earn 2048 points)
- Total game score is the sum of all points earned across all merges

### Move Validation & Game State
- A move is **valid** if the resulting grid differs from the current grid
  - Sliding into a wall with no mergeable tiles = invalid (no move executes, no new tile spawns)
- After each valid move, a new tile is spawned in a random empty cell
- If no empty cells exist and no adjacent pairs match, **game over**

### Win Condition
- Creating a tile with value **2048**
- Game continues beyond 2048 (player may continue merging for higher scores if desired)
- Win message displays immediately when 2048 is reached

### Lose Condition
- Board is full (no empty cells) AND no valid moves remain (no adjacent tiles match)
- Game locks; no further moves accepted
- Lose message displays: "No moves left — game over"

### Scoring & Persistence
- **Current Score:** Sum of all merge values in this session
- **Best Score:** Highest score ever achieved (persisted in browser localStorage or game state)
- Best score updates after each valid move
- Score resets to 0 on "New Game"

---

## 2. User Interface & Visual Design

### Screen Layout
**Container:** max-width 420px, centered, padding 96px top / 20px sides / 40px bottom

### Header
- **Title:** "2048" (Space Grotesk, weight 600, 18px, color #f3f7ff)
- **Subtitle:** "MERGE TO 2048" (JetBrains Mono, 10.5px, letter-spacing 0.1em, color #c3b8ff)
- **Layout:** Horizontal flex with "← Today" button (left), title (center), spacer (right, 60px)

### Score Displays
Two cards side-by-side (gap 12px, margin-top 22px):

**Card 1 — Current Score**
- Background: rgba(255,255,255,.04), border 1px solid rgba(255,255,255,.1), border-radius 14px, padding 10px 22px
- Number (id="g2048-score"): Space Grotesk, weight 600, 26px, color #9b8cff
- Label: "SCORE" (JetBrains Mono, 9.5px, letter-spacing 0.14em, color rgba(226,234,255,.45), margin-top 5px)

**Card 2 — Best Score**
- Same styling as Card 1
- Number (id="g2048-best"): Space Grotesk, weight 600, 26px, color #00e5ff
- Label: "BEST" (JetBrains Mono, 9.5px, letter-spacing 0.14em, color rgba(226,234,255,.45), margin-top 5px)

### Message Area
- Element: id="g2048-msg"
- Height: min-height 18px
- Margin-top: 14px
- Font: JetBrains Mono, 12.5px, color #c3b8ff, text-align center
- **States:**
  - Empty until game over or win
  - On win: "🎉 You reached 2048!"
  - On lose: "No moves left — game over"

### Game Board
- Element: id="g2048-board"
- Layout: CSS Grid, 4 columns × 4 rows, gap 9px
- Background: rgba(155,140,255,.08), border 1px solid rgba(155,140,255,.18), border-radius 14px, padding 9px
- Size: width min(92vw, 332px), aspect-ratio 1:1 (square)
- Margin-top: 6px

### Tile Styling

**Cell (empty):**
- Border-radius: 9px
- Background: rgba(255,255,255,.035)
- Color: transparent (no text rendered)
- Font: Space Grotesk, weight 700
- No shadow

**Cell (valued 2-2048):**
- Border-radius: 9px
- Background: Dynamic color from colorFor map (see below)
- Color: Dynamic text color from colorFor map
- Font-size: 30px (2-64), 26px (128-512), 22px (1024-2048)
- Box-shadow: 0 2px 10px rgba(0,0,0,.25)
- Animation: btPop 0.18s ease (plays once on spawn/merge)

**Color Palette (from colorFor map):**
```javascript
{
  2:    ['#2a3358', '#cdd8f0'],      // Dark blue bg, light text
  4:    ['#33406e', '#dfe9ff'],      // Slightly lighter blue
  8:    ['#3a5bd9', '#eafcff'],      // Bright blue
  16:   ['#5b8cff', '#04060f'],      // Cyan-ish blue, dark text
  32:   ['#00a8c8', '#04060f'],      // Teal
  64:   ['#00e5ff', '#04060f'],      // Bright cyan, dark text
  128:  ['#7CF5C4', '#04140d'],      // Mint green, very dark text
  256:  ['#16b97e', '#eafcff'],      // Forest green
  512:  ['#ff9e3d', '#04060f'],      // Orange
  1024: ['#ff6b9d', '#04060f'],      // Pink/magenta
  2048: ['#ff2bd6', '#ffffff']       // Magenta, white text
}
```
*Note: Any value not in the map defaults to ['#ff2bd6', '#fff']*

### Control Buttons

**Arrow Button Grid (3×2, centered):**
- Grid: 3 columns × 2 rows, gap 8px, 52px cells
- Margin-top: 20px

**Buttons (id="g2048-{U|L|D|R}"):**
- Border-radius: 11px
- Background: rgba(155,140,255,.14)
- Color: #eafcff
- Font-size: 20px
- Border: none
- Cursor: pointer
- Content: ↑ (U), ← (L), ↓ (D), → (R)

**Below buttons (instructional text):**
- JetBrains Mono, 10.5px, color rgba(226,234,255,.4), margin-top 14px
- Text: "Arrow keys, WASD, or swipe"

### New Game Button
- Element: id="g2048-new"
- Class: bt-ghost
- Style: Space Grotesk, weight 500, 13.5px, color #eaf1ff
- Border: 1px solid rgba(255,255,255,.2)
- Background: rgba(255,255,255,.04)
- Border-radius: 100px
- Padding: 10px 24px
- Margin-top: 14px
- Cursor: pointer
- Text: "New game"

### End-Game Modal

Displayed via `openModal()` after game ends (win or lose). Contains:

**Header:**
- Status line (JetBrains Mono, 11px, letter-spacing 0.2em)
  - On win: "TILE 2048 REACHED" (color #ff2bd6)
  - On lose: "GAME OVER" (color #9b8cff)
- Title (Space Grotesk, weight 600, 30px, color #f3f7ff, margin-top 8px)
  - On win: "You did it."
  - On lose: "Nice run."

**Final Score (Space Grotesk, weight 600, 44px, color #9b8cff, margin-top 10px)**
- Displays final game score

**Label (JetBrains Mono, 11px, letter-spacing 0.1em, color rgba(226,234,255,.5), margin-top 2px):**
- "SCORE"

**Brain Insight Box:**
- Background: rgba(155,140,255,.08)
- Border: 1px solid rgba(155,140,255,.2)
- Border-radius: 14px
- Padding: 16px
- Margin-top: 18px
- Header (JetBrains Mono, 10px, letter-spacing 0.16em, color #c3b8ff): "🧠 BRAIN INSIGHT"
- Text (font-size 14px, line-height 1.55, color rgba(226,234,255,.82), margin-top 8px):
  - "Sliding-tile games blend spatial planning with arithmetic — you're running a constant cost-benefit search several moves ahead, a workout for the brain's executive-function network."

**Buttons:**
1. Share Result (bt-primary)
   - Width: 100%, border: none, border-radius 12px, padding 14px
   - Font: Space Grotesk, weight 600, 15px, color #04060f
   - Background: linear-gradient(118deg, #9b8cff, #00e5ff)
   - Margin-top: 18px
   - Text: "Share result"
   - Behavior: Copy/share formatted result (see Share Format below)

2. Back to Today (bt-ghost)
   - Width: 100%, border 1px solid rgba(255,255,255,.16), border-radius 12px, padding 12px
   - Font: Space Grotesk, weight 500, 14px, color #eaf1ff
   - Background: rgba(255,255,255,.04)
   - Margin-top: 10px
   - Text: "Back to today"
   - Behavior: Close modal, return to home screen

**Share Format:**
```
BrainTap · 2048
[Reached 2048! 🟪 | Score {score}]

braintap.app/games
```

---

## 3. Interactions & Input Handling

### Keyboard Input
Supported keys: **Arrow keys** (↑↓←→) and **WASD**

**Key Mapping:**
- ArrowUp, W → Move Up (U)
- ArrowDown, S → Move Down (D)
- ArrowLeft, A → Move Left (L)
- ArrowRight, D → Move Right (R)

**Behavior:**
- preventDefault() on valid keydown
- Only processes input if active screen is "g2048"
- Invalid moves (no state change) are silently ignored
- Game state locked after win/lose (move() returns early if over=true)

### Touch Input (Swipe)
- Min swipe distance: 24px (ignores touches shorter than this)
- Swipe axes: Prioritizes primary axis (horizontal vs vertical) based on absolute delta
  - If |dx| > |dy|: horizontal swipe (left/right)
    - dx > 0 → Right
    - dx < 0 → Left
  - Otherwise: vertical swipe (up/down)
    - dy > 0 → Down
    - dy < 0 → Up
- Events: touchstart (passive) → capture start coords, touchend (passive) → calculate delta & move
- Listeners attached to boardEl (id="g2048-board")

### Mouse/Touch Buttons
Four directional buttons (id="g2048-{U|L|D|R}") directly trigger move(direction) on click.

### Button Interaction
- "New game" button (id="g2048-new") resets the game state via reset()
- "Back to today" in end modal calls home screen navigation
- "Share result" captures share string and triggers platform share (OS-level or copy-to-clipboard)

---

## 4. Animation & Feedback

### Tile Spawn Animation
- **Trigger:** New tile added after valid move
- **Animation:** `btPop` 0.18s ease cubic
- **Visual:** Tile appears with pop effect (likely scale/opacity in CSS)
- **Affected Element:** Newly created tile cell only

### State Feedback
- **Message Box:** Updates in real-time for win/lose states
- **Score Display:** Updates immediately after each valid move
- **Best Score:** Updates if current score exceeds previous best during gameplay
- **Board Re-render:** Happens after every valid move (synchronous)

### No explicit error animation for invalid moves; they silently fail (no state change, no new tile).

---

## 5. Game Data (Embedded)

### Color Mapping (Complete)
Located in init2048() as `colorFor` object:

```javascript
const colorFor = {
  2:    ['#2a3358', '#cdd8f0'],
  4:    ['#33406e', '#dfe9ff'],
  8:    ['#3a5bd9', '#eafcff'],
  16:   ['#5b8cff', '#04060f'],
  32:   ['#00a8c8', '#04060f'],
  64:   ['#00e5ff', '#04060f'],
  128:  ['#7CF5C4', '#04140d'],
  256:  ['#16b97e', '#eafcff'],
  512:  ['#ff9e3d', '#04060f'],
  1024: ['#ff6b9d', '#04060f'],
  2048: ['#ff2bd6', '#ffffff']
};
```

**Format:** `[backgroundColor, textColor]` for each tile value  
**Fallback:** Any value not in map uses `['#ff2bd6', '#fff']` (magenta bg, white text)

### Procedural Generation
No data bank. All game state is procedurally generated:
- Initial two tiles: Random empty cells, 90/10 distribution (2 vs 4)
- New tiles after moves: Random empty cell, 90/10 distribution
- Random seed is NOT locked; each game is truly random
- No daily-level requirement

---

## 6. Daily-Level Bank Requirements

**DETERMINATION:** **NO LEVEL BANK REQUIRED**

### Rationale
2048 is a pure skill-based game with no preset puzzles or levels. Every board state is unique and generated on-the-fly. The randomness is fundamental to the gameplay (finding empty cells, managing chaos).

### Procedural Generation
- Initial board: 4×4 grid, two random tiles (2 or 4)
- Continuous generation: After each move, one new tile in a random empty cell
- No seeding for daily variation needed; the game is always different

### Solvability
Every board state is solvable in the sense that legal moves always exist until the board fills with no adjacent matches. The game does not have "broken" or "unwinnable" starting conditions because:
1. Two tiles at game start always leave 14 empty cells
2. With 14 empty cells, valid moves always exist
3. Players naturally push toward loss through their own choices (or bad luck with spawns)

**No validation algorithm needed.**

---

## 7. Production Polish & Improvements Over Prototype

### Responsiveness & Accessibility
- [ ] Add ARIA labels to board cells (screen readers)
- [ ] Add ARIA live region for message updates and score changes
- [ ] Ensure keyboard navigation works; support Tab through buttons
- [ ] Test on iOS/Android for touch responsiveness; refine swipe threshold if needed
- [ ] Responsive font sizing for smaller screens; ensure tiles remain tappable (min 44px on mobile)

### Animations & Juice
- [ ] Enhance `btPop` animation: combine scale (1.0 → 1.1 → 1.0) + opacity fade for impact
- [ ] Add merge animation: tiles sliding together + color transition
- [ ] Add slide animation: smooth tile movement across grid (100-150ms per full slide)
- [ ] Particle/confetti burst on reaching 2048
- [ ] Tile scale-up slightly on merge (visual feedback)
- [ ] Game-over screen slide-in/fade-in for modals

### Haptics & Sensory Feedback
- [ ] Haptic feedback on successful merge (light/medium haptic)
- [ ] Haptic feedback on reaching 2048 (strong double-tap)
- [ ] Haptic feedback on game-over (3-pulse error pattern)
- [ ] Sound effects (optional, respecting user settings):
  - Merge sound (subtle chime)
  - 2048 reach sound (victory tone)
  - Game-over sound (deflate/buzzer)

### Difficulty & Progression
- 2048 inherently scales difficulty (as tiles merge, board fills faster)
- No additional levels needed
- Consider optional **variants** for future (3×3, 5×5, different merge targets)

### Hint System
- [ ] Optional hint button: "Suggest best move" using minimax or strategic heuristics
- [ ] Show hint overlay without committing move
- [ ] Limit hints (3 per game, or disable for score tracking)

### Share & Social
- [ ] Enhanced share format with emoji/visual indicator of score tier
  - e.g., "🎉 Reached 2048" vs. "🏅 Scored 8,192"
- [ ] Copy-to-clipboard fallback if native share unavailable
- [ ] Optionally include # of moves + time played in share string
- [ ] QR code or deep link to challenge others

### Persistence & State
- [ ] Persist best score to localStorage or cloud backend
- [ ] Optional: Save last game state and allow "Continue" before reset
- [ ] Optional: Persist game history (timestamps, scores, move counts)

### Edge Cases
- [ ] Detect and handle rapid move spam; debounce if needed
- [ ] Prevent double-spawn if move processes twice (race condition)
- [ ] Handle board resize mid-game gracefully
- [ ] Clear message box on "New Game" immediately
- [ ] Prevent move after win/lose (game.over flag)

### Visual Polish
- [ ] Consistent spacing and padding across all UI
- [ ] Smooth color transitions (not jarring; use CSS transitions)
- [ ] Add subtle tile focus state (border glow) when hovered on desktop
- [ ] Darken background when modal is open (scrim effect)
- [ ] Animate score counter (tally animation for earned points)

### Performance
- [ ] Debounce render() calls if multiple moves queue up
- [ ] Use requestAnimationFrame for smooth animations
- [ ] Lazy-load modal HTML only when needed
- [ ] Minimize reflows/repaints in render()

### Testing Checklist
- [ ] Win condition (2048 tile creation) triggers correctly
- [ ] Lose condition (no moves left) detected accurately
- [ ] Score calculation matches merge values exactly
- [ ] Best score updates and persists across sessions
- [ ] Swipe threshold and direction detection on mobile
- [ ] Keyboard input doesn't conflict with browser shortcuts
- [ ] Touch events don't trigger page scroll/zoom
- [ ] Modal dismiss (back button) returns focus correctly
- [ ] Share string formats cleanly without HTML entities

---

## 8. How to Play (In-Game Help)

**From prototype `showHelp('g2048')` call:**

**Title:** "2048"  
**Accent Color:** #9b8cff

**Steps:**
1. Slide all tiles with the arrows, WASD, or a swipe.
2. Two tiles of the same value merge into their sum.
3. A new tile appears after every move.
4. Combine your way up to the 2048 tile.

**Pro Tip:** "Pick one corner and keep your biggest tile parked there."

---

## 9. Development Notes

### State Management
- `grid` (4×4 array of numbers): Board state
- `score` (number): Current session score
- `best` (number): Best score ever
- `over` (boolean): Lose state flag
- `won` (boolean): Win state flag
- `_s2048Done` (boolean): Prevent duplicate end-game modal

### Key Functions
- `empty()`: Return array of [row, col] for all empty cells
- `addTile()`: Spawn tile in random empty cell (90% = 2, 10% = 4)
- `reset()`: Initialize new game (clear grid, 2 tiles, score=0, over=false, won=false)
- `render()`: Redraw board; update score and best displays
- `slide(row)`: Core merge logic for one row/col; returns {row, gained}
- `move(dir)`: Execute move in direction; spawn new tile if state changed
- `canMove()`: Test if legal moves exist
- `onKey(e)`: Keyboard event handler
- `s2048End(score, won)`: Display end-game modal

### Browser APIs Used
- `document.getElementById()`, `querySelector`, `innerHTML` (DOM manipulation)
- `JSON.stringify()` (state comparison)
- `JSON.stringify(grid) === before` (detect move validity)
- `window.addEventListener('keydown')`, `touchstart`, `touchend`
- `Math.random()` (tile spawn, placement)
- `Date.now()` (not currently used; prototype has no timer)

### State Persistence
- Best score saved to `this.S.best2048` (object/service)
- Calls `this.saveState()` to persist
- On game end, calls `this.markPlayed('g')` and `this.s2048End(score, won)`

### Cleanup
- Listeners pushed to `this._cleanup` array for removal on screen exit
- `_render2048` function stored for potential manual re-renders

---

## 10. Build & Integration Checklist

- [ ] Convert DC script to React component (Game2048)
- [ ] Extract color palette to constants/theme file
- [ ] Replace `this.S` state with React useState/Context or Redux
- [ ] Implement useEffect for keyboard/touch event listeners
- [ ] Create TileCell component with animation support (Framer Motion or CSS-in-JS)
- [ ] Build Board4x4 sub-component for grid layout
- [ ] Implement EndGameModal with conditional rendering
- [ ] Connect to global game state (best scores, play history)
- [ ] Add sound effects library (Web Audio or simple audio tags)
- [ ] Implement haptic feedback (navigator.vibrate API)
- [ ] Set up unit tests for merge logic, move validation, and win/lose detection
- [ ] E2E tests for swipe, keyboard, and button interactions
- [ ] Accessibility audit (WCAG 2.1 AA minimum)
- [ ] Mobile testing on iOS Safari and Android Chrome
- [ ] Performance profiling (render time, frame rate during animations)
- [ ] Localization setup if needed (only "SCORE", "BEST", "No moves left", etc.)
