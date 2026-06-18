# PRODUCTION SPEC: Sequence Echo (Simon)

**Game ID:** `simon`  
**Prototype:** BrainTap Games.dc.html (lines 754–777 markup, 1926–1969 logic)  
**Brain Category:** Working Memory & Phonological Sequencing  
**Accent Color:** `#ff2bd6` (Magenta) with secondary glow `#ff7ae0`  
**Status:** Read-only exploration of working prototype. Rebuild in React/Next.js.

---

## 1. CORE MECHANICS & RULES

### Win/Lose Conditions

- **Win State:** Not applicable — Sequence Echo is an *endless* game. The player plays until they make a mistake.
- **Lose State:** Player taps the **wrong pad** at any point, or taps out of sequence. The game immediately ends with "Wrong — game over".
- **Round Structure:**
  1. Game begins with an empty sequence.
  2. Each **round** adds exactly **one new random colour** (0–3) to the end of the sequence.
  3. AI plays the **complete sequence** back to the player with visual and audio feedback.
  4. Player **must tap all pads in the exact order** shown.
  5. If player completes the sequence correctly, message shows "✓ Nice" and the next round begins automatically.
  6. If player makes one mistake, the game **ends immediately**.

### Scoring & Progression

- **Score Metric:** **Rounds completed** (or "steps recalled" in the modal).
  - Rounds = sequence length = number of colours memorized and repeated.
  - Displayed as `ROUND` (current in-game counter, e.g., "1", "2", "15").
  - **Best Score** tracked and persisted to `S.bestSimon`.
  
- **Difficulty Curve:**
  - Gap between tone playback starts at **620ms**, decreases by **22ms per round** down to a floor of **280ms**.
  - Formula: `gap = Math.max(280, 620 - round * 22)`
  - Each tone plays for **62% of gap** duration; player has **~38% of gap** to mentally process before next tone plays.
  - This creates **exponential cognitive load** — early rounds are forgiving, later rounds demand chunking and pattern recognition.

- **Session Daily Reset:**
  - Game tracks whether played today (`this.S.doneM` or "m" for Sequence Echo).
  - First play unlocks the "Start sequence" button.
  - After completion, button changes to "Play again" and message says "Played today — replay to beat your streak".

---

## 2. UI LAYOUT & VISUAL DESIGN

### Screen Structure (id="screen-simon")

```
┌─────────────────────────────────────┐
│  ← Today          Sequence Echo     [60px space]
│                  WATCH, THEN REPEAT
│
│  ┌──────────────┐  ┌──────────────┐
│  │  0           │  │  0           │
│  │  ROUND       │  │  BEST        │
│  └──────────────┘  └──────────────┘
│
│         [message area]
│
│  ┌─────────┬─────────┐
│  │ Pad 0   │ Pad 1   │
│  │ (cyan)  │(magenta)│
│  ├─────────┼─────────┤
│  │ Pad 2   │ Pad 3   │
│  │(purple) │(green)  │
│  └─────────┴─────────┘
│
│       [Start sequence]
│
└─────────────────────────────────────┘
```

### Components & Styling

#### Header Row (lines 756–763)
- **Left:** Home button ("← Today") — `JetBrains Mono`, 12px, `rgba(226,234,255,.6)`
- **Center:** Title "Sequence Echo" — `Space Grotesk` 600-weight, 18px, `#f3f7ff`
  - Subtitle "WATCH, THEN REPEAT" — `JetBrains Mono`, 10.5px, letter-spacing .1em, `#ffb3ec`
- **Right:** 60px spacer (for balance)

#### Stats Boxes (lines 764–767)
- **Round Counter:**
  - Background: `rgba(255,43,214,.07)` with border `1px solid rgba(255,43,214,.25)`, radius 14px, padding 10px 24px
  - Number: `Space Grotesk` 600-weight, 26px, `#ffd0f2`
  - Label: `JetBrains Mono`, 9.5px, letter-spacing .14em, `#ffb3ec`
  - ID: `simon-round`

- **Best Score:**
  - Background: `rgba(255,255,255,.04)` with border `1px solid rgba(255,255,255,.1)`, radius 14px, padding 10px 24px
  - Number: `Space Grotesk` 600-weight, 26px, `#9b8cff`
  - Label: `JetBrains Mono`, 9.5px, letter-spacing .14em, `rgba(226,234,255,.45)`
  - ID: `simon-best`

#### Message Area (line 768)
- **Min-height:** 20px
- **ID:** `simon-msg`
- **Font:** `JetBrains Mono`, 13px, `#ffb3ec`
- **Text Align:** Center
- **States:**
  - Empty (initial)
  - "Watch…" (during playback)
  - "Your turn" (awaiting player input)
  - "✓ Nice" (correct round completed)
  - "Wrong — game over" (game over)

#### Pad Grid (lines 769–774)
- **Container ID:** `simon-pads`
- **Layout:** CSS Grid, 2 columns, 12px gap
- **Dimensions:** `width: min(86vw, 300px)`, `aspect-ratio: 1`
- **4 Buttons** (`.simon-pad`, `.bt-key`):
  - data-pad="0", "1", "2", "3"
  - `border: none`, `transition: all .12s`
  - **Pad 0:** Top-left — `#00e5ff` (Cyan), radius `18px 6px 6px 6px`
  - **Pad 1:** Top-right — `#ff2bd6` (Magenta), radius `6px 18px 6px 6px`
  - **Pad 2:** Bottom-left — `#9b8cff` (Purple), radius `6px 6px 6px 18px`
  - **Pad 3:** Bottom-right — `#7CF5C4` (Green), radius `6px 6px 18px 6px`

**Pad Colors Array (lines 1929):**
```javascript
const cols = [
  ['#00e5ff', 'rgba(0,229,255,.18)'],      // Pad 0: [bright, dim]
  ['#ff2bd6', 'rgba(255,43,214,.18)'],     // Pad 1: [bright, dim]
  ['#9b8cff', 'rgba(155,140,255,.18)'],    // Pad 2: [bright, dim]
  ['#7CF5C4', 'rgba(124,245,196,.18)']     // Pad 3: [bright, dim]
];
```

#### Start Button (line 775)
- **ID:** `simon-start`
- **Classes:** `.bt-primary`
- **Text:** "Start sequence"
- **Styling:** 
  - `border-radius: 13px`, `padding: 14px 34px`, `margin-top: 22px`
  - `font-family: 'Space Grotesk'`, `font-weight: 600`, `font-size: 15px`
  - Color: `#04060f` (dark)
  - **Gradient:** `linear-gradient(118deg, #ff2bd6, #ff7ae0)`
  - **Shadow:** `0 10px 30px rgba(255,43,214,.22)`
  - **Cursor:** Pointer

### Screen States

1. **Start State (idle):**
   - All pads show dim color (second value from cols array)
   - Round counter: "0"
   - Message area: Empty
   - Start button visible and enabled

2. **Playing State (accepting input):**
   - Round counter incremented
   - Message: "Your turn" (after playback completes)
   - Pads responsive to clicks; lit pads show bright color and glow

3. **Feedback States:**
   - **Correct Sequence Completed:** Message "✓ Nice", pads remain dim, auto-advance to next round after 650ms
   - **Wrong Tap:** Message "Wrong — game over", pads become unresponsive, game over modal shows after 700ms

4. **Game Over State:**
   - Start button text changes to "Play again"
   - Best score updates if current round exceeds previous best
   - Modal appears with result summary (see section 4)

---

## 3. INTERACTIONS

### Touch/Click

- **Pad Tap:** Click or touch any of the four pads while `accepting=true` and `over=false`
  - **Action:** Calls `onPad(index)` where index is 0–3
  - **Immediate Feedback:** Pad lights up (bright color + glow), plays tone
  - **Validation:**
    - Compares tapped pad to `seq[step]`
    - If match: increments `step`
    - If complete sequence: triggers `nextRound()`
    - If mismatch: sets `over=true`, shows error, ends game
  - **Tap Outside Pads:** No effect (handler only on `.simon-pad` buttons)

- **Start Button:**
  - Click to trigger `start()` function
  - Initializes sequence and starts game
  - After game ends, text updates to "Play again" and re-click restarts

### Keyboard

- **Current Prototype:** No keyboard support
- **Production TODO:** Should support:
  - Number keys 0–3 to tap pads
  - Enter/Space to start (only valid when button visible)
  - Escape to return home (optional)

### Mobile Gestures

- **Current Prototype:** Standard touch/tap only
- **Production TODO:**
  - Ensure pads are large enough (min 80x80px) for thumb taps on mobile
  - Consider haptic feedback on Android/iOS (vibration.feedback())
  - Test on 4" to 6" screens; current design uses `min(86vw, 300px)` which should scale well

### Drag/Swipe

- **Not Used:** Sequence Echo is tap-only, no drag interactions

---

## 4. ANIMATIONS & FEEDBACK

### Tone Playback

- **Audio Setup (line 1934):**
  - Creates Web Audio `AudioContext` on first interaction
  - Respects `S.settings.sound` flag (muted if false)
  - Graceful fallback if AudioContext unavailable

- **Tones Array (line 1930):**
  ```javascript
  const tones = [329.63, 415.30, 493.88, 587.33];  // Hz (frequencies)
  ```
  - Pad 0: 329.63 Hz (E4 note)
  - Pad 1: 415.30 Hz (G#4 note)
  - Pad 2: 493.88 Hz (B4 note)
  - Pad 3: 587.33 Hz (D5 note)

- **Tone Generation (line 1934, function `tone(f, d)`):**
  - Creates sine-wave oscillator at frequency `f`
  - Envelope: Exponential ramp up to 0.18 gain over 20ms, ramp down over `d` ms
  - Duration: `d` milliseconds (typically ~386ms for gap=620ms playback)
  - Stops cleanly after silence

### Pad Lighting (line 1935, function `lite(i, ms)`)

```javascript
const lite = (i, ms) => {
  const p = pads[i];
  p.style.background = cols[i][0];           // Bright color
  p.style.boxShadow = `0 0 30px ${cols[i][0]}`; // Glow
  p.style.transform = 'scale(.97)';          // Compress
  tone(tones[i], ms/1000*0.9);               // Play for 90% of duration
  
  setTimeout(() => {
    p.style.background = cols[i][1];         // Revert to dim
    p.style.boxShadow = 'none';
    p.style.transform = 'scale(1)';
  }, ms * 0.7);  // Revert after 70% of duration
};
```

- **Duration:** Each light display lasts `ms` (calculated per-round based on gap)
- **Color Transition:** Instant to bright, reverts after 70% of lit duration
- **Scale Feedback:** Subtle press-in effect (scale 0.97) while lit
- **Glow:** Box-shadow with pad's color creates glowing effect
- **Tone Timing:** Begins when pad lights, sustains 90% of pad display time

### Playback Sequence (line 1936, function `playback()`)

```javascript
const playback = () => {
  st.accepting = false;
  msg.textContent = 'Watch…';
  
  let t = 0;
  const gap = Math.max(280, 620 - st.round * 22);
  
  st.seq.forEach((i) => {
    setTimeout(() => lite(i, gap * 0.62), t);
    t += gap;
  });
  
  setTimeout(() => {
    st.accepting = true;
    st.step = 0;
    msg.textContent = 'Your turn';
  }, t + 120);
};
```

- **Gap Calculation:** Decreases by 22ms per round, floor at 280ms
- **Playback Timing:** Each pad plays for 62% of gap; 38% is silent between tones
- **Message Flow:** "Watch…" during playback, "Your turn" when ready
- **Delay Before Turn:** 120ms additional pause after final pad plays

### Round Transition (line 1940, function `nextRound()`)

```javascript
const nextRound = () => {
  st.seq.push((Math.random() * 4) | 0);  // Add random pad 0-3
  st.round++;
  roundEl.textContent = st.round;
  setTimeout(playback, 650);  // 650ms delay before next playback
};
```

- **Sequence Growth:** Exactly one random pad (0–3) added each round
- **Round Counter Update:** Immediate
- **Playback Delay:** 650ms gap gives player time to breathe

### Error Feedback (line 1941, function `onPad(i)`)

- **Wrong Pad:** 
  - Message: "Wrong — game over"
  - `st.over = true` (pads become unresponsive)
  - Game ends after 700ms delay
  - Best score updated if beaten

- **Correct Tap:**
  - Pad lights for 300ms
  - If sequence complete: Message "✓ Nice", auto-advance to next round

### Result Modal (lines 1950–1968, function `simonEnd(rounds)`)

Displays after wrong pad with 700ms delay. Modal shows:

- **Header:** "SEQUENCE BROKEN" in `JetBrains Mono`, 11px, letter-spacing .2em, `#ff2bd6`
- **Title (Contextual):**
  ```javascript
  const title = 
    rounds >= 12 ? 'Photographic.' :
    rounds >= 8  ? 'Steel-trap memory.' :
    rounds >= 4  ? 'Solid recall.' :
    'Warm-up done.';
  ```
- **Score:** Large number in `Space Grotesk` 600-weight, 46px, `#ff2bd6`
- **Label:** "STEPS RECALLED" in `JetBrains Mono`, 11px, letter-spacing .1em, `rgba(226,234,255,.5)`

- **Brain Insight Box:**
  ```
  Background: rgba(255,43,214,.07)
  Border: 1px solid rgba(255,43,214,.2)
  Radius: 14px
  Padding: 16px
  
  Header: "🧠 BRAIN INSIGHT" in #ffb3ec
  Text: "Repeating a growing sequence taxes your phonological loop and 
         spatial sketchpad at once — the two scratchpads of working memory. 
         Chunking the pattern into groups is how experts push past seven."
  Font: 14px, line-height 1.55, rgba(226,234,255,.82)
  ```

- **Buttons:**
  - **Share Result** (primary): Gradient `#ff2bd6` to `#ff7ae0`, text includes rounds count
  - **Back to today** (ghost): Subtle border, returns to hub screen

---

## 5. EMBEDDED DATA

### Colour-Frequency Mapping

```javascript
const cols = [
  ['#00e5ff', 'rgba(0,229,255,.18)'],      // Cyan (Pad 0)
  ['#ff2bd6', 'rgba(255,43,214,.18)'],     // Magenta (Pad 1)
  ['#9b8cff', 'rgba(155,140,255,.18)'],    // Purple (Pad 2)
  ['#7CF5C4', 'rgba(124,245,196,.18)']     // Green (Pad 3)
];

const tones = [
  329.63,  // E4 (Cyan)
  415.30,  // G#4 (Magenta)
  493.88,  // B4 (Purple)
  587.33   // D5 (Green)
];
```

### Help Content (line 2036)

**From `showHelp('simon')`:**

```javascript
{
  name: 'Sequence Echo',
  color: '#ff2bd6',
  how: [
    'Watch the pads light up in sequence, then repeat it.',
    'Each round the sequence grows by one step.',
    'Sound and colour both encode the pattern.',
    'One wrong pad ends the game.'
  ],
  tip: 'Say the colours aloud — voicing the sequence engages a second memory channel.'
}
```

### Share Message Template (line 1954)

```
BrainTap · Sequence Echo
Recalled ${rounds} steps

braintap.app/games
```

---

## 6. STATE MANAGEMENT

### Game State Object (line 1932)

```javascript
const st = {
  seq: [],           // Array of pad indices [0–3]
  step: 0,           // Current position in sequence being repeated by player
  accepting: false,  // True when awaiting player input
  round: 0,          // Current round (sequence length)
  over: false,       // True when game ends (wrong tap)
  best: +(this.S.bestSimon || 0)  // Persisted best score
};
```

### Persistence

- **Best Score:** Stored in `this.S.bestSimon` (S = game state object)
- **Daily Flag:** `this.S.doneM` = true after first play today
- **Save Method:** `this.saveState()` called when new best achieved
- **Load Method:** On init, `bestEl.textContent = st.best`

---

## 7. DAILY-LEVEL BANK REQUIREMENTS

### Architecture Decision

**Sequence Echo does NOT require a pre-generated level bank.** Instead, it uses **procedural generation**:

- New sequence generated on each game via `Math.random() * 4 | 0`
- No pre-computation, no daily seed, no uniqueness validation needed
- Every play generates a new random sequence at game time

### Rationale

1. **Infinite Variability:** Sequence can grow to arbitrary length (no fixed puzzle size).
2. **No Solvability Concerns:** Game is self-balancing — difficulty increases naturally as round progresses.
3. **Player Skill-Gated:** Progression depends entirely on player memory, not puzzle design.
4. **Daily Reset:** Game resets by calendar day naturally via `doneM` flag.

### Daily Mechanics

- **First Play:** Unlocks game with "Start sequence" button visible.
- **Subsequent Plays:** Button changes to "Play again" and message shows "Played today — replay to beat your streak".
- **New Day:** `doneM` flag clears; reset button and message.

**No level bank needed. Proceed with React implementation using `Math.random()` for sequence generation.**

---

## 8. SOLVABILITY & VALIDATION

Since Sequence Echo is **procedurally generated and skill-gated** (not puzzle-based), there is **no formal solvability test required**.

### Sanity Checks (if needed for QA)

If you want to validate the game behaves correctly:

1. **Sequence Growth:** After each correct round, verify `seq.length` increments by exactly 1.
2. **Tap Validation:** 
   - Correct pad at correct step advances `step`; verify no false positives.
   - Wrong pad triggers game-over immediately; verify no delayed failures.
3. **Gap Calculation:** Verify gap formula `Math.max(280, 620 - round * 22)` floors at 280ms by round 12.
4. **Tone Playback:** Test audio on all pads; verify frequencies match `tones` array exactly.

### Example Validation Flow (QA)

```
1. Start game
2. Tap "Start sequence"
3. Watch sequence playback (should show "Watch…")
4. Tap correct pads in order
5. After all correct: message should show "✓ Nice" before next playback
6. Verify new random pad added to sequence
7. Repeat until intentional wrong tap
8. Verify modal appears with correct round count and title
9. Verify best score persists and updates if beaten
```

---

## 9. PRODUCTION POLISH CHECKLIST

### Responsiveness

- [ ] Pads scale properly on mobile (min 80x80px per tap target)
- [ ] Test on 4", 5", 6" screens; ensure grid doesn't overflow
- [ ] Portrait/landscape layout: consider vertical centering on landscape
- [ ] Touch targets have adequate padding (no accidental adjacent taps)

### Animation Polish

- [ ] Pad scale animation is smooth (`.12s` transition timing function — consider `cubic-bezier(.4, 0, .2, 1)`)
- [ ] Glow shadow is performant (avoid excessive repaints; use GPU-accelerated properties)
- [ ] Playback gap properly accounts for tone envelope time (ensure no overlap)
- [ ] Modal entry animation: scale in with easing (prototype uses `.scale(.92)` initial, `.3s cubic-bezier(.2,.7,.2,1)`)

### Haptics & Sensory Feedback

- [ ] On correct tap: Light haptic feedback (10–20ms vibration pulse)
- [ ] On wrong tap: Stronger haptic (40–60ms double pulse)
- [ ] On round advance: Subtle haptic accent (5ms)
- [ ] **Fallback:** Ensure game is fully playable without haptics (graceful degradation)

### Accessibility

- [ ] **ARIA Labels:**
  - Pads: `aria-label="Pad 1"` or color name
  - Start button: `aria-label="Start sequence game"`
  - Score display: `aria-live="polite"` for round updates
  - Message area: `aria-live="assertive"` for "Wrong — game over"
  
- [ ] **Keyboard Navigation:**
  - Focus visible on all buttons (ring or underline)
  - Tab order: Home button → Start button → Pads (in visual grid order)
  - Number keys 0–3 mapped to pads
  - Escape to close modals / return to home
  - Screen reader announces round number and best score on load
  
- [ ] **Color Contrast:**
  - Verify WCAG AA compliance on all text (especially `#ffb3ec` on dark background)
  - Don't rely solely on colour for pad distinction (ensure spatial layout is clear)
  - Consider high-contrast mode override (lighten dim pad colours)

- [ ] **Semantic HTML:**
  - Use `<button>` for all interactive elements (not divs)
  - Use `<output>` or `aria-live` for score updates
  - Modal should have `role="dialog"`, `aria-modal="true"`, focus trap

### Difficulty & Progression

- [ ] Gap floor (280ms) is challenging but not frustrating
- [ ] **Playtesting goal:** Average player should reach round 5–7 on first attempt
- [ ] Consider **optional difficulty settings** (if product roadmap permits):
  - **Easy:** Gap floors at 400ms, starting gap 700ms
  - **Normal:** Current (280ms floor, 620ms start)
  - **Hard:** Gap floors at 200ms, starting gap 550ms

### Hint System

- [ ] **Optional Feature:** If desired, add a "Hint" button that:
  - Replays the current sequence once without penalty
  - Costs nothing (daily free replay)
  - Appears after 3 wrong taps in a round, or on request

### Share & Social

- [ ] **Share Button:**
  - Pre-populated message: `BrainTap · Sequence Echo\nRecalled ${rounds} steps\n\nbraintap.app/games`
  - Supports native share on mobile (`.navigator.share()` API)
  - Fallback copy-to-clipboard on desktop
  - Include optional emoji: 🧠 Recalled ${rounds} steps

- [ ] **Leaderboard Integration (future):**
  - If app has global leaderboard, submit final round count
  - Only count best score per day per user

### Sound Settings

- [ ] **Mute Toggle:** Respect global `S.settings.sound` flag
- [ ] **Volume Control:** Consider slider (0–100%) instead of binary
- [ ] **Tone Quality:** Sine waves are clear; consider triangle or sawtooth if requested
- [ ] **Fade Envelope:** Current exponential ramp is smooth; test on mobile speakers

### Edge Cases

- [ ] **Rapid Taps:** Debounce pad clicks during playback (ensure `accepting=false` prevents all input)
- [ ] **Page Tab Loss:** Pause audio playback if tab becomes hidden; resume on re-focus
- [ ] **Device Rotation:** Pause game, re-render pads on orientation change
- [ ] **Long Sessions:** Ensure no memory leaks; audio context cleanup on game end
- [ ] **Network Offline:** Game is fully offline-capable (no server calls except score sync)
- [ ] **First Load:** Verify best score loads from persistent storage, displays as "0" if never played

### Visual Polish

- [ ] **Padding & Spacing:** Verify margin-top 22px between components is consistent
- [ ] **Font Loading:** Ensure `Space Grotesk` and `JetBrains Mono` load before render (avoid FOUT)
- [ ] **Blur Backdrop:** Test `backdrop-filter: blur(8px)` on modal across browsers (add `-webkit` fallback)
- [ ] **Gradient Angle:** 118deg gradient on buttons is slightly skewed; verify it aligns with design intent
- [ ] **Icon/Emoji:** Verify 🧠 and checkmark (✓) render consistently on all platforms

---

## 10. CODE STRUCTURE FOR REBUILD

### Component Hierarchy (React/Next.js)

```
<SimonGame>
  <Header />           // Home button, title, subtitle
  <StatsRow />         // Round counter, Best score
  <MessageArea />      // Dynamic text feedback
  <PadGrid />          // 2x2 grid of buttons
    <Pad index={0} />  // Cyan
    <Pad index={1} />  // Magenta
    <Pad index={2} />  // Purple
    <Pad index={3} />  // Green
  <StartButton />      // Or PlayAgainButton when over
  <ResultModal />      // Shows only after game-over
    <ResultContent />  // Title, score, insight, buttons
```

### State Variables (React Hooks)

```javascript
// Game state
const [seq, setSeq] = useState([]);            // Sequence of pad indices
const [step, setStep] = useState(0);           // Player progress in sequence
const [round, setRound] = useState(0);         // Current round (seq length)
const [accepting, setAccepting] = useState(false); // Awaiting input
const [gameOver, setGameOver] = useState(false);   // End state

// UI state
const [message, setMessage] = useState('');
const [litPad, setLitPad] = useState(null);    // Index of currently lit pad (for animation)
const [best, setBest] = useState(0);           // Best score from storage
const [showModal, setShowModal] = useState(false);
const [modalRounds, setModalRounds] = useState(0);

// Audio
const audioContextRef = useRef(null);
```

### Key Functions to Implement

```javascript
// Core game loop
function startGame() { /* initialize, trigger first nextRound */ }
function nextRound() { /* add random pad, increment round, schedule playback */ }
function playback() { /* animate sequence, set accepting=true when done */ }
function onPadTap(index) { /* validate, light, check win/loss */ }
function endGame(finalRounds) { /* disable pads, show modal */ }

// Audio
function playTone(frequency, duration) { /* Web Audio API */ }
function lightPad(index, duration) { /* animate pad, play tone */ }

// Persistence
function loadBestScore() { /* from localStorage */ }
function saveBestScore(rounds) { /* to localStorage */ }

// Utilities
function calculateGap(round) { return Math.max(280, 620 - round * 22); }
```

### Key Props & Configuration

```javascript
const COLORS = [
  { bright: '#00e5ff', dim: 'rgba(0,229,255,.18)' },
  { bright: '#ff2bd6', dim: 'rgba(255,43,214,.18)' },
  { bright: '#9b8cff', dim: 'rgba(155,140,255,.18)' },
  { bright: '#7CF5C4', dim: 'rgba(124,245,196,.18)' }
];

const FREQUENCIES = [329.63, 415.30, 493.88, 587.33];

const MESSAGES = {
  WATCH: 'Watch…',
  YOUR_TURN: 'Your turn',
  CORRECT: '✓ Nice',
  WRONG: 'Wrong — game over'
};

const TITLES_BY_ROUND = {
  12: 'Photographic.',
  8: 'Steel-trap memory.',
  4: 'Solid recall.',
  0: 'Warm-up done.'
};
```

---

## 11. TESTING CHECKLIST

### Functional Testing

- [ ] Sequence grows by exactly 1 pad per round
- [ ] Random sequence generation produces varied patterns
- [ ] Correct tap advances player step; incorrect tap ends game immediately
- [ ] Playback gap decreases correctly and floors at 280ms
- [ ] All four tones play at correct frequencies
- [ ] Best score persists across sessions
- [ ] Daily `doneM` flag prevents replay message until new day

### Performance

- [ ] Web Audio initialization doesn't block main thread
- [ ] Animations run at 60 FPS on target device (iOS 12+, Android 8+)
- [ ] No memory leaks after 100+ consecutive games
- [ ] Audio context properly cleaned up on game end

### Cross-Browser

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (iOS 12+, macOS)
- [ ] Samsung Internet (Android)
- [ ] Fallback for browsers without Web Audio API

### Mobile

- [ ] Touch events fire correctly (no phantom clicks)
- [ ] Pads responsive within 100ms on 4G
- [ ] Haptics vibrate on correct/wrong taps (if available)
- [ ] Orientation change re-renders without losing game state
- [ ] Safe area insets respected (notch/punch-hole phones)

### Accessibility

- [ ] Screen reader announces round updates
- [ ] Keyboard navigation works (Tab, arrows, number keys)
- [ ] High contrast mode doesn't break layout
- [ ] Focus ring visible on all interactive elements
- [ ] Color-only instructions supplemented with icons/shapes

---

## 12. MIGRATION NOTES FROM PROTOTYPE

### What to Keep (1:1 port)

- Colour palette and component layout (exact pixel spacing)
- Tone frequencies (329.63, 415.30, 493.88, 587.33 Hz)
- Gap formula: `Math.max(280, 620 - round * 22)`
- Pad light animation (scale .97, glow shadow, 70% revert timing)
- Round progression (1 new pad per round, unlimited growth)
- Score titles by round threshold (12→Photographic, 8→Steel-trap, 4→Solid, 0→Warm-up)
- Brain insight text (phonological loop, chunking, working memory)
- Share message template

### What to Improve

1. **Keyboard Support:** Add 0–3 keys and Enter/Space
2. **Accessibility:** Full ARIA labels, semantic HTML, keyboard focus trap in modal
3. **Responsive Design:** Test on 3 breakpoints (mobile, tablet, desktop); adjust grid for landscape
4. **Animation Easing:** Replace linear transitions with cubic-bezier curves
5. **Haptics:** Add light vibration feedback on iOS/Android
6. **Settings Panel:** Expose difficulty levels, sound toggle, contrast options
7. **Error Handling:** Graceful fallback if Web Audio unavailable; show text prompt "Sorry, audio unavailable"
8. **Offline Support:** Pre-cache game assets (fonts, colors) for offline play
9. **Analytics:** Track game plays, best scores, average round reached (send to telemetry)
10. **Hint System:** Optional replay button (free once per round or daily limit)

### What to Remove

- Prototype's DC framework code (specific to old HTML template system)
- Legacy state management via `this.S` and `this.saveState()` — replace with React context or Zustand
- Direct DOM manipulation with `getElementById`, `querySelector` — use React refs only where necessary
- Inline style strings — move to CSS modules or Tailwind classes

---

## 13. SUMMARY FOR DEVELOPER

**Sequence Echo (Simon)** is a **working-memory game** where players memorize and repeat a growing colour/tone sequence. 

**Key Facts:**
- No pre-generated levels needed (procedurally random)
- Game ends on first wrong tap (no second chances)
- Difficulty increases exponentially as gap shrinks (620ms → 280ms)
- Tracks best score locally; daily reset with `doneM` flag
- All 4 pads have distinct colors (cyan, magenta, purple, green) and frequencies
- Modal displays contextual title based on final round count and includes "brain insight" educational text
- Fully offline-capable, no server calls except optional analytics/leaderboard sync

**Next Steps:**
1. Set up React component structure
2. Implement state hooks for game logic
3. Create `<Pad>` component with animation
4. Integrate Web Audio API for tone playback
5. Add keyboard + ARIA accessibility
6. Test on mobile (iOS/Android)
7. Optional: Add difficulty settings, hint system, leaderboard

