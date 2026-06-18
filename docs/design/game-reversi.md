# Reversi Game Production Spec

**Game ID:** `reversi`  
**Type:** Turn-based 2-player (Human vs AI)  
**Prototype:** `/Users/orie/dev/braintap/design_src/BrainTap Games.dc.html` (lines 801–2121)

---

## 1. CORE MECHANICS & RULES

### Objective
Outflank the AI opponent by surrounding and flipping their discs. The player with the most discs on the board at game end wins.

### Starting State
8×8 board. Each player begins with 2 discs placed in the center:
- Player (YOU): discs at (3,3) and (4,4) — **cyan gradient** (`#aef6ff` to `#00e5ff`)
- AI (BRAINTAP): discs at (3,4) and (4,3) — **magenta gradient** (`#ffd0f2` to `#ff2bd6`)

### Turn Structure
1. **Player's turn:** Player selects a valid legal move.
2. **Flip logic:** All opponent discs in contiguous lines (orthogonal & diagonal) between the placed disc and an existing player disc are flipped to the player's color.
3. **AI's turn:** AI evaluates all legal moves, selects one using a positional-weight heuristic (see AI Strategy).
4. **Pass logic:** If a player has no legal moves, they pass and the turn goes to the opponent.
5. **End condition:** Game ends when both players have no legal moves.

### Legal Move Definition
A move is legal if:
- The target cell is empty.
- Placing a disc there flips at least one opponent disc (using the 8-directional flip logic).

**Flip algorithm** (applies in all 8 directions: up, down, left, right, and 4 diagonals):
- From the placed disc, trace along a direction.
- Collect all contiguous opponent discs.
- If the trace ends with a player disc, all collected opponent discs flip.
- Repeat for all 8 directions; union the flips.

### Win/Loss/Tie Conditions
- **Win:** Player has more discs than AI when game ends.
- **Tie:** Equal disc counts.
- **Loss:** AI has more discs.

---

## 2. UI LAYOUT & COMPONENTS

### Screen ID: `screen-reversi`
**Viewport:** 100vh minimum height, centered max-width 440px container.

### Header
- **Back button** (left): `← Today` — returns to game hub.
- **Title** (center): 
  - "Reversi" (Space Grotesk, 600, 18px, `#f3f7ff`)
  - Subtitle: "OUTFLANK THE AI" (JetBrains Mono, 10.5px, `#9bf7d3`, letter-spacing 0.1em)
- **Spacer** (right): 40px wide, balances layout.

### Score Display (below header, margin-top 22px)
Two score cards with 12px gap:

**Player card (YOU):**
- Background: `rgba(0,229,255,.08)`
- Border: `1px solid rgba(0,229,255,.25)`
- Border-radius: 14px
- Padding: 9px 20px
- Content: cyan radial-gradient disc (16×16px) + score number + "YOU" label
- Score ID: `reversi-you`
- Font: Space Grotesk 600, 22px (`#eafcff`), label JetBrains Mono 9px (`#9fe9ff`)

**AI card (BRAINTAP):**
- Background: `rgba(255,43,214,.08)`
- Border: `1px solid rgba(255,43,214,.25)`
- Border-radius: 14px
- Padding: 9px 20px
- Content: magenta radial-gradient disc (16×16px) + score number + "BRAINTAP" label
- Score ID: `reversi-ai`
- Font: Space Grotesk 600, 22px (`#eafcff`), label JetBrains Mono 9px (`#ffb3ec`)

### Turn Indicator
- ID: `reversi-msg`
- Font: JetBrains Mono, 12.5px, `#9bf7d3`, center-aligned
- Content: "Your move · turn: {You|BrainTap|—}"
- ID for turn text: `reversi-turn`
- Styling notes: "turn:" has opacity 0.5; turn text is `#eafcff`

### Game Board
- **Parent ID:** `reversi-board`
- **Layout:** CSS Grid, 8 columns, 3px gap
- **Dimensions:** `min(94vw, 372px)`, 1:1 aspect ratio
- **Background:** `rgba(124,245,196,.1)`
- **Border:** `1px solid rgba(124,245,196,.22)`, border-radius 12px
- **Padding:** 6px

#### Board Cell Styling
- **Layout:** Flex center
- **Background:** `rgba(6,20,16,.5)` (dark greenish)
- **Border-radius:** 5px
- **Cursor:** pointer if legal move, default otherwise
- **Width/Height:** Equal, 1/8 of board dimension
- **Padding:** 0

#### Disc Rendering
- **Placed discs:** Filled circles (78% of cell size), border-radius 50%
- **Player disc (YOU):** Radial gradient `circle at 35% 30%`: `#aef6ff` → `#00e5ff` (60%) → `#0090c8`
- **AI disc (BRAINTAP):** Radial gradient `circle at 35% 30%`: `#ffd0f2` → `#ff2bd6` (60%) → `#b3168f`
- **Box-shadow:** `0 2px 6px rgba(0,0,0,.4)`
- **Last-move indicator:** If this cell was the last move placed, outline with `2px solid #fff`, outline-offset -2px

#### Legal Move Indicators
- **Movable empty cells:** Show a dot (24% of cell size) with `background:rgba(124,245,196,.5)`
- **Interactive:** Click-enabled; firing `playYou(r,c)`

### "New Game" Button
- **ID:** `reversi-new`
- **Class:** `bt-ghost`
- **Font:** Space Grotesk 500, 13.5px
- **Color:** `#eaf1ff`
- **Border:** `1px solid rgba(255,255,255,.2)`
- **Background:** `rgba(255,255,255,.04)`
- **Border-radius:** 100px
- **Padding:** 10px 24px
- **Margin-top:** 18px
- **Cursor:** pointer

### Result Modal
- **ID:** `bt-modal`
- **Backdrop:** `rgba(2,3,9,.7)` with `backdrop-filter: blur(8px)`
- **Card ID:** `bt-modal-card`
- **Card gradient:** `linear-gradient(180deg, rgba(16,24,48,.96), rgba(8,12,26,.96))`
- **Card border:** `1px solid rgba(0,229,255,.22)`, border-radius 24px
- **Card padding:** 32px
- **Card shadow:** `0 30px 80px rgba(0,0,0,.6)`

#### Result Content Structure
- **Status label:** JetBrains Mono 11px, letter-spacing 0.2em
  - VICTORY: `#7CF5C4`
  - DEAD HEAT (tie): `#9b8cff`
  - DEFEAT: `#ff7a9c`
- **Main message:** Space Grotesk 600, 30px, `#f3f7ff`, margin-top 8px
- **Score display:** Flex gap 28px
  - Player score: 36px Space Grotesk 600, `#00e5ff`
  - AI score: 36px Space Grotesk 600, `#ff2bd6`
  - Labels: JetBrains Mono 10px, `rgba(226,234,255,.5)`
- **Brain insight box:** Background `rgba(124,245,196,.06)`, border `1px solid rgba(124,245,196,.2)`, border-radius 14px, padding 16px, margin-top 18px
  - Label: JetBrains Mono 10px, `#9bf7d3`, letter-spacing 0.16em
  - Text: 14px, `rgba(226,234,255,.82)`, line-height 1.55
- **Share button:** Width 100%, padding 14px, border-radius 12px, margin-top 18px
  - Font: Space Grotesk 600, 15px, `#04060f`
  - Background: `linear-gradient(118deg, #7CF5C4, #00e5ff)`
  - Border: none
  - Contains `data-share` attribute with full share text
- **Back button:** Width 100%, padding 12px, border-radius 12px, margin-top 10px
  - Font: Space Grotesk 500, 14px, `#eaf1ff`
  - Border: `1px solid rgba(255,255,255,.16)`
  - Background: `rgba(255,255,255,.04)`

---

## 3. INTERACTIONS

### Player Actions

#### Click/Tap to Place Disc
- **Trigger:** Click or tap a legal move cell (shows cyan dot indicator)
- **Function:** `playYou(r, c)`
- **Validation:**
  - Game not over
  - Current turn is YOU
  - Move is legal (flips ≥ 1 opponent disc)
- **Effect:**
  - Place disc at (r,c)
  - Flip all captured discs in all 8 directions
  - Update board state
  - Set `st.last = [r,c]` for last-move outline
  - Increment turn to AI
  - Trigger render
  - Check end condition; if not end, schedule `aiTurn()` after 520ms

#### New Game Button
- **Trigger:** Click `reversi-new`
- **Function:** `reset()`
- **Effect:**
  - Reinitialize board to starting position
  - Clear state (turn=YOU, over=false, last=null, flipping=[])
  - Render board with legal moves indicated

#### Share Result (in modal)
- **Trigger:** Click "Share result" button in end modal
- **Content:** Structured text string from `data-share` attribute
  ```
  BrainTap · Reversi
  Won/Tied/Lost {score}–{ai_score} vs BrainTap AI
  
  braintap.app/games
  ```
- **Behavior:** Uses platform's native share API (implementation in parent framework)

#### Back to Today (in modal)
- **Trigger:** Click "Back to today" button in end modal
- **Behavior:** Returns to game hub/home screen

### AI Turn (Automatic)
- **Trigger:** Fires 520ms after player's move (unless end condition met)
- **Function:** `aiTurn()`
- **Logic:**
  1. Check if AI has legal moves
  2. If no moves: pass turn back to YOU; update msg to "BrainTap passes — your move"; render
  3. Check if YOU also has no moves: end game
  4. If YOU has no moves but AI does: set turn to AI, msg "No move — you pass"; schedule `aiTurn()` after 700ms
  5. If AI has moves:
     - Evaluate all moves using **heuristic:** `score = W[r][c] + flips_count * 2`
     - W is 8×8 positional weight matrix (corners=120, edges weighted lower, center lower)
     - Select move with highest score
     - Place disc, flip captures, set `st.last`
     - Turn reverts to YOU
     - Render
     - Check end condition

### Keyboard (Future Enhancement)
- Arrow keys to navigate board cells
- Enter/Space to place disc on selected cell
- R to restart game
- H to show help/rules

### Mobile Gestures (Future Enhancement)
- Tap to place disc (already enabled)
- Swipe left to return to hub (fallback to button)

### Accessibility
- ARIA labels for board cells
- Role="button" on cells
- Keyboard focus management
- High contrast mode support (matches cyan/magenta palette)

---

## 4. ANIMATIONS & FEEDBACK

### Disc Flip Animation
- **When:** A capture occurs
- **Visual:** Discs flip smoothly from one color to the other (180° rotation or cross-fade)
- **Duration:** 200–300ms per flip
- **Staggering:** Slight delay between flips in different directions for clarity
- **Prototype note:** Stored in `st.flipping` but animation is handled by render loop with timing

### Board Render Transition
- **When:** Board updates after any move or state change
- **Visual:** Smooth re-render (CSS transitions on opacity/background if using CSS grid)
- **Timing:** Immediate for player moves, 520ms delay before AI move displays

### Modal Appearance
- **When:** Game ends
- **Animation:** Card scales from 0.92 to 1.0 over 300ms with cubic-bezier timing (0.2, 0.7, 0.2, 1)
- **Transition:** `transform 0.3s cubic-bezier(.2,.7,.2,1)`

### Turn Indicator Update
- **When:** Turn changes or game ends
- **Animation:** Text fade or color shift (smooth, non-disruptive)
- **Color codes:**
  - Player's turn: "You" in `#eafcff`
  - AI's turn: "BrainTap" in `#eafcff`
  - Game over: "—" (em-dash) in same color

### Score Update Animation
- **When:** Disc count changes
- **Animation:** Number counter animates from old to new value or pulse effect
- **Duration:** 200ms

### Help Button (?)
- **ID:** `bt-help-btn`
- **Style:** Fixed bottom-right, 48×48px, border-radius 50%
- **Border:** `1px solid rgba(0,229,255,.4)`
- **Background:** `rgba(3,4,11,.82)` with backdrop blur
- **Color:** `#9fe9ff`
- **Hover:** Scale to 1.08, border-color to `rgba(0,229,255,.7)`
- **Content:** "?" in Space Grotesk 600, 22px
- **Interaction:** Click to show rules/how-to-play modal

---

## 5. EMBEDDED DATA

### Positional Weight Matrix (AI Heuristic)
The AI uses an 8×8 matrix `W` to evaluate board positions. Corners are highest-value (120), edges lower, interior lowest.

```javascript
const W = [
  [120, -20,  20,   5,   5,  20, -20, 120],
  [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
  [ 20,  -5,  15,   3,   3,  15,  -5,  20],
  [  5,  -5,   3,   3,   3,   3,  -5,   5],
  [  5,  -5,   3,   3,   3,   3,  -5,   5],
  [ 20,  -5,  15,   3,   3,  15,  -5,  20],
  [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
  [120, -20,  20,   5,   5,  20, -20, 120]
];
```

**Scoring:** For each legal move (r,c):
```
score = W[r][c] + (number_of_flipped_discs * 2)
```
Select the move with the highest score.

### Color Palette
| Element | Color | Usage |
|---------|-------|-------|
| Player disc | `#aef6ff` → `#00e5ff` → `#0090c8` | Radial gradient, start pos (35%,30%) |
| AI disc | `#ffd0f2` → `#ff2bd6` → `#b3168f` | Radial gradient, start pos (35%,30%) |
| Player accent | `#00e5ff` | Score card, buttons |
| AI accent | `#ff2bd6` | Score card |
| Primary green | `#7CF5C4` | Win state, success feedback |
| Victory color | `#7CF5C4` | Victory label |
| Tie color | `#9b8cff` | Tie label |
| Loss color | `#ff7a9c` | Loss label |
| Legal move indicator | `rgba(124,245,196,.5)` | Cyan dot on empty cells |
| Board background | `rgba(124,245,196,.1)` | Light green tint |
| Board border | `rgba(124,245,196,.22)` | Medium green tint |
| Cell background | `rgba(6,20,16,.5)` | Dark greenish |
| Text primary | `#f3f7ff` | Headers, main text |
| Text secondary | `#eafcff` | Scores, turn text |
| Text tertiary | `rgba(226,234,255,.5)` | Labels, helper text |
| Text hint | `#9bf7d3` | Mono labels, insights |

---

## 6. DAILY LEVEL SYSTEM

### Does This Game Need a Level Bank?
**No.** Reversi is **procedurally deterministic**. Every game starts from the same fixed board state (2v2 in center). No randomization is needed; the game depends entirely on player vs AI skill, not on randomized level data.

### Game Structure
- **Daily game:** One instance per calendar day (UTC)
- **Persistence:** `doneR` flag in localStorage tracks whether player has played today
- **Replay:** After playing, player can click "New game" to replay for practice
- **Status message:** "Played today — replay for practice" (if `this.S.doneR` is true)

### Seed/Determinism
If future designs want daily variation (e.g., AI difficulty level, starting position variation), those could be:
- **Seeded by date:** Use `Math.seeded(dayNum())` to generate a daily variant
- **Configuration tiers:** Easy/Normal/Hard AI strategies (different W matrix or evaluation depth)

For now, the game is **deterministic and stateless per day**.

---

## 7. SOLVABILITY & VALIDATION

### Solvability Definition
For Reversi, "solvability" means the game is playable and reachable end state (not stuck in infinite loop). Since the game has a fixed starting state and deterministic rules, **all instances are solvable by definition**.

However, **quality validation** can check:
1. **Gameability:** Both players have at least one move in early turns (not forced into immediate pass/loss)
2. **AI behavior:** AI correctly evaluates all legal moves and selects a valid one

### Validation Algorithm

```javascript
function validateReversiGame() {
  // Initialize fresh board
  const board = Array.from({length:8}, ()=>Array(8).fill(EMPTY));
  board[3][3] = YOU;
  board[3][4] = AI;
  board[4][3] = AI;
  board[4][4] = YOU;
  
  let turn = YOU;
  let moveCount = 0;
  const maxMoves = 60; // Game typically ends by move 60 for 8x8
  
  while (moveCount < maxMoves) {
    const legalMoves = legal(board, turn);
    
    // Check for stuck state
    if (legalMoves.length === 0) {
      const opponentMoves = legal(board, turn === YOU ? AI : YOU);
      if (opponentMoves.length === 0) {
        // Both players have no moves: game end ✓
        return { valid: true, movesPlayedCount: moveCount, reason: "Game reached natural end" };
      }
      // Current player passes
      turn = turn === YOU ? AI : YOU;
      continue;
    }
    
    // Make a move (use first legal move or AI heuristic)
    const [r, c] = legalMoves[0];
    apply(board, r, c, turn);
    
    // Verify move was applied
    if (board[r][c] !== turn) {
      return { valid: false, movesPlayedCount: moveCount, reason: "Move application failed" };
    }
    
    turn = turn === YOU ? AI : YOU;
    moveCount++;
  }
  
  return { valid: false, movesPlayedCount: moveCount, reason: "Game exceeded max moves" };
}
```

### Test Suite
- **Run simulation:** 100 complete games from start to end, auto-playing both sides
- **Check:** No board state errors, all captures valid, move counts between 30–60
- **AI consistency:** Same position always produces same AI move (deterministic)
- **End state validity:** Final disc counts ≥ 0 and sum to 64 (or close, if board not full)

---

## 8. PRODUCTION POLISH & UPGRADES

### Over the Prototype

#### Responsiveness & Layout
- [ ] **Fluid scaling:** Board size scales smoothly with viewport; test on 320px–1200px widths
- [ ] **Safe area insets:** Respect notches and safe areas on mobile (iOS 11+, Android)
- [ ] **Aspect ratio fix:** Use `aspect-ratio: 1` for board (no layout shift)
- [ ] **Font loading:** Preload Space Grotesk and JetBrains Mono; use system fallbacks
- [ ] **DPI handling:** Ensure disc gradients and borders render crisply on 2x/3x screens

#### Animations
- [ ] **Disc flip transition:** Implement smooth 3D flip or cross-fade on capture (CSS or WebGL)
- [ ] **Flip sequence:** Stagger flips by direction so player sees flips propagate naturally
- [ ] **Score counter:** Animate score numbers incrementing (0 → N over 300ms) when discs placed
- [ ] **Last move highlight:** Pulse or glow effect on last-placed disc instead of just outline
- [ ] **Turn change feedback:** Fade/slide in new message, not instant text swap

#### Haptics & Sensory Feedback
- [ ] **Vibration on move:** Micro-haptic buzz on iOS/Android when disc placed (navigator.vibrate)
- [ ] **AI move confirmation:** Brief vibration + sound when AI completes move
- [ ] **Invalid move feedback:** Short buzz + visual feedback (cell flash red) if move rejected
- [ ] **Sound FX:** (Optional, respect `this.S.settings.sound`)
  - Disc place: soft chime
  - Disc flip: subtle pop per disc or batch pop
  - Game end: fanfare (win) or minor chord (loss)
  - Button: confirm tone

#### Accessibility & Keyboard
- [ ] **ARIA labels:** `aria-label="Reversi board, 8 by 8"`, `aria-label="Column C, Row 4, empty, legal move"`
- [ ] **Focus indicators:** Clear 2px outline on focused cells (not outline-offset, use :focus-visible ring)
- [ ] **Keyboard nav:**
  - Arrow keys move selection around board
  - Enter/Space places disc on selected cell
  - Tab moves between buttons
  - Escape cancels selection
- [ ] **Screen reader:** Announce turn changes, scores, game end
- [ ] **High contrast mode:** Increase border/shadow contrast; darken backgrounds if prefers-contrast

#### Difficulty & Progression
- [ ] **AI difficulty levels:** (Future) Easy (random legal move) / Normal (current W matrix) / Hard (minimax or alpha-beta pruning)
- [ ] **Tutorial overlay:** First-time players see move instructions and flip explanation
- [ ] **Suggested moves:** (Optional) Show best move after user passes or loses

#### Hint System
- [ ] **Manual hint button:** Highlights top 3 legal moves after a delay (only if player idle >5s)
- [ ] **Contextual advice:** Show strategy tip after certain board states (e.g., "Corners are valuable in Reversi")

#### Share & Social
- [ ] **Share result:** Pre-fill share text with score + emoji + link; use Web Share API (with fallback to copy-to-clipboard)
- [ ] **Share image:** (Optional) Generate PNG thumbnail of final board state for social sharing
- [ ] **Leaderboard:** (Optional) Post daily win/loss record to account profile

#### Edge Cases & Error Handling
- [ ] **Out of sync:** If board state corrupts (rare), auto-reset with warning
- [ ] **Memory cleanup:** Ensure event listeners removed when screen unmounts
- [ ] **Reduced motion:** Respect `prefers-reduced-motion: reduce`; skip animations, show state instantly
- [ ] **Offline support:** Game logic is all client-side; works fully offline
- [ ] **Rapid taps:** Debounce/throttle move clicks to prevent double-places or race conditions

#### Visual Polish
- [ ] **Disc shadow:** Add subtle glow under discs (box-shadow with spread-radius)
- [ ] **Cell hover state:** Lighten cell background on hover if legal move
- [ ] **Button ripple:** (Optional) Material Design ripple on button click
- [ ] **Smooth scrolling:** Use `scroll-behavior: smooth` on container if needed
- [ ] **Dark mode only:** Game assumes dark theme; no light-mode adaptation needed

#### Data & Persistence
- [ ] **Persist game in progress:** (Optional) Save board state if user navigates away mid-game; resume on return
- [ ] **Stats tracking:** Record win/loss ratio over time in localStorage
- [ ] **Replay recording:** (Optional) Save move sequence to replay games later

#### Testing Checklist
- [ ] Unit tests: `flips()`, `legal()`, `apply()` with edge cases (corners, edges, multiple directions)
- [ ] Integration tests: Full game flow from reset → player move → AI move → end
- [ ] Visual regression: Screenshots of board, scores, modals on multiple viewports
- [ ] Gameplay tests: 10 full AI vs AI games; check end states are valid
- [ ] Accessibility audit: axe DevTools, Lighthouse, NVDA/JAWS screen reader
- [ ] Performance: Load time <1s, 60 FPS animations, no jank on move placement

---

## 9. STATE MANAGEMENT

### Game State Object (`st`)
```javascript
st = {
  turn: YOU | AI,        // Whose turn
  over: false | true,    // Game ended
  last: [r, c] | null,   // Last move placed (for highlight)
  flipping: []           // (Reserved for flip animation queue)
}
```

### Board Array
```javascript
board[r][c] = EMPTY (0) | YOU (1) | AI (2)
```

### Player State (localStorage, `BT_GAMES_V1`)
```javascript
S = {
  date: "2024-6-17",          // Today's date key
  streak: 7,                  // Consecutive days played
  streakDay: 19536,           // Day number of last streak
  doneR: true | false,        // Played Reversi today
  settings: {
    zen: false,               // Disable confetti/animations
    sound: true               // Enable sound effects
  },
  ...other games...
}
```

---

## 10. IMPLEMENTATION NOTES

### Framework Migration
- **Source:** DC (custom React-like framework in support.js)
- **Target:** React + Next.js
- **Key functions to port:**
  - `initReversi()` → React component with useState
  - `reset()` → useEffect reset on component mount
  - `render()` → Render function with board grid
  - `playYou()` → onClick handler
  - `aiTurn()` → useCallback + useEffect with timeout
  - `reversiEnd()` → Modal component with result data

### Component Structure (React)
```
ReversiGame
├── Header
│   ├── BackButton
│   ├── Title
│   └── Spacer
├── ScoreDisplay
│   ├── PlayerScore
│   └── AIScore
├── TurnIndicator
├── GameBoard (8x8 grid)
│   └── Cell[] (64 cells)
├── NewGameButton
├── ResultModal
│   ├── StatusLabel
│   ├── MainMessage
│   ├── ScoreComparison
│   ├── BrainInsight
│   ├── ShareButton
│   └── BackButton
└── HelpButton (?)
```

### API & State Hooks
```javascript
// Board state
const [board, setBoard] = useState(initialBoard);
const [turn, setTurn] = useState(YOU);
const [gameOver, setGameOver] = useState(false);
const [lastMove, setLastMove] = useState(null);

// UI state
const [showModal, setShowModal] = useState(false);
const [result, setResult] = useState(null);

// Handlers
const handleMove = (r, c) => { /* playYou logic */ }
const handleNewGame = () => { /* reset logic */ }
const scheduleAITurn = () => { /* aiTurn logic with timeout */ }
```

### Constants
```javascript
const BOARD_SIZE = 8;
const EMPTY = 0;
const YOU = 1;
const AI = 2;
const DIRECTIONS = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];
const WEIGHT_MATRIX = [ /* see section 5 */ ];
const AI_MOVE_DELAY = 520; // ms
const FLIP_ANIMATION_DURATION = 250; // ms per flip
```

### Assets Required
- **Fonts:** Space Grotesk (600), JetBrains Mono (regular)
- **Icons:** None (uses text "?", symbols like "←", "✓")
- **Animations:** CSS transitions, optional WebGL for 3D disc flip

---

## 11. BRAIN INSIGHT MESSAGE

**Static text shown in result modal:**

> "Territory games train look-ahead and inhibition — resisting the move that flips the most discs now in favour of the corner that wins the board later."

This message is always shown on game end, regardless of win/loss/tie.

---

## 12. KEYBOARD SHORTCUTS (PROPOSED)

| Shortcut | Action |
|----------|--------|
| Arrow keys (↑↓←→) | Move focus around board |
| Enter / Space | Place disc on focused cell |
| `R` | New game / Reset |
| `H` | Show help/rules modal |
| `T` | Return to Today hub |
| `?` | Toggle help button |
| Tab | Move between UI elements |
| Escape | Unfocus board selection |

---

## END OF SPEC

**Game Ready For Production:** All mechanics, visuals, interactions, and data defined above.  
**Estimated Dev Time (React):** 8–12 hours (core game + UI) + 4–6 hours (animations + polish) + 2–3 hours (testing + a11y).  
**Prototype Source:** `/Users/orie/dev/braintap/design_src/BrainTap Games.dc.html` (game code lines 2058–2121, screen markup lines 801–819).

