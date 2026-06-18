# SCHULTE TABLE - Production Spec

**Game ID:** `schulte`  
**Accent Color:** Cyan (`#00e5ff`)  
**Category:** Attention / Visual Perception  
**Daily Reset:** Yes (one play per day)

---

## 1. CORE MECHANICS & RULES

### Win/Lose/Scoring

- **Objective:** Tap all numbers 1–25 in ascending order as fast as possible.
- **Win Condition:** Successfully tap all 25 numbers in sequence (1 → 2 → 3 ... → 25).
- **Lose Condition:** N/A. The game continues until the player taps all 25 numbers correctly.
- **Score:** Time in milliseconds (lower is better). Displayed as seconds with one decimal place (e.g., "18.3s").
- **Personal Best:** Persisted across sessions. On replay, the player can try to beat their personal best time.

### Round/Level Structure

- **Single Round:** One complete table of 1–25 tapped in order.
- **No Levels:** The game has no escalating difficulty levels. The challenge is purely the speed/accuracy on a single 5×5 table.
- **Replay Mechanic:** After winning, a "Play again" button replaces the start button. Tapping it re-randomizes the grid layout and resets the timer.

### Layout & Randomization

- **Grid:** 5×5 (25 cells total).
- **Grid Size:** `min(94vw, 360px)` width, square aspect ratio.
- **Cell Spacing:** 6px gap between cells.
- **Number Assignment:** Numbers 1–25 are randomly shuffled into the grid using Fisher-Yates shuffle (unbiased).
- **No Solvability Constraint:** Every shuffled grid is valid; there is no puzzle to solve beyond finding and tapping.

---

## 2. UI LAYOUT & STATES

### Screen Structure

**Header (Fixed, 100% width)**
- Back button: "← Today" (left), returns to hub
- Title: "Schulte Table" (center, Space Grotesk 18px bold, #f3f7ff)
- Subtitle: "FIND 1 → 25 IN ORDER" (center, JetBrains Mono 10.5px, #9fe9ff, letter-spacing 0.1em)
- Spacer: 60px right (for button symmetry)

**Stat Boxes (Below header, two columns)**
1. **Find Next Box**
   - Large number (26px, Space Grotesk bold, #eafcff): current target (e.g., "1", "15", "25")
   - Label: "FIND NEXT" (JetBrains Mono 9.5px, #9fe9ff, letter-spacing 0.14em)
   - Background: `rgba(0,229,255,.07)` with 1px border `rgba(0,229,255,.25)`, 14px radius, padding 10px 24px

2. **Time Box**
   - Large number (26px, Space Grotesk bold, #ffb020): elapsed time (e.g., "0.0s", "18.3s")
   - Label: "TIME" (JetBrains Mono 9.5px, letter-spacing 0.14em, rgba(226,234,255,.45))
   - Background: `rgba(255,255,255,.04)` with 1px border `rgba(255,255,255,.1)`, 14px radius, padding 10px 24px

**Message Area**
- Min-height 18px, centered, above grid
- Font: JetBrains Mono 12.5px, #9fe9ff
- Displays: 
  - At start (before tapping): "Find 1 → 25 in order"
  - On wrong tap: "Tap N next" (where N is the correct next number)
  - Auto-clears 1.1 seconds after display (unless new message overwrites)
  - On replay: "Played today — replay to beat your time"

**Grid Area**
- Centered container: `display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; width: min(94vw, 360px); margin-top: 8px`
- 25 buttons, each `aspect-ratio: 1`, 9px border-radius, Space Grotesk 20px bold
- **Default state (not yet tapped):**
  - Background: `rgba(255,255,255,.06)`
  - Color: `#eafcff`
  - Cursor: pointer
  - Transition: `background 0.15s, transform 0.1s`
- **Tapped state (number < current target):**
  - Background: `rgba(0,229,255,.16)` (faded cyan)
  - Color: `rgba(0,229,255,.55)` (muted cyan)
  - Indicates already found; visually deemphasized

**Start Button**
- ID: `schulte-start`
- Text: "Start table" (initially), "Play again" (after first win)
- Style: Space Grotesk 15px bold, #04060f (dark text)
- Background: `linear-gradient(118deg, #00e5ff, #7b8cff)` (cyan to violet gradient)
- Padding: 14px 34px, border-radius 13px
- Box-shadow: `0 10px 30px rgba(0,229,255,.22)` (cyan glow)
- Cursor: pointer
- Hidden after start button is clicked (display: none)
- Reappears with new text after game ends

### Game States

1. **Initial / Idle**
   - Grid is rendered with a shuffled layout
   - All cells show default styling
   - Start button is visible and clickable
   - Timer shows "0.0s"
   - "Find Next" shows "1"
   - Message: (blank) or "Played today — replay to beat your time" (if already played today)

2. **Running**
   - Start button is hidden
   - Timer updates every 100ms
   - "Find Next" updates to the next target number (1–25)
   - Message shows feedback on wrong taps
   - Correct taps change cell styling to faded cyan
   - Grid is interactive; taps are processed in real time

3. **Won**
   - Timer stops and displays final time
   - Start button reappears with text "Play again"
   - Modal appears with results (see Result Modal section)
   - Grid remains visible but taps are ignored

4. **Post-Play (Daily)**
   - After marking as played, the grid and UI remain visible
   - Message shows: "Played today — replay to beat your time"
   - Player can still replay to improve time

---

## 3. INTERACTIONS

### Tap / Click

- **Target:** Any number button in the grid
- **Active During:** Running state only (after start button is tapped, before all 25 are found)
- **Correct Tap (button number === current target):**
  - Button immediately transitions to tapped state (rgba(124,245,196,.25) background, rgba(124,245,196,.7) color, scale 0.9)
  - Internal counter increments (`st.next++`)
  - "Find Next" updates to show new target
  - If all 25 found, `finish()` is called (see below)
- **Incorrect Tap (button number !== current target):**
  - Button plays `btShake` animation (0.35s, lateral shake 2–7px horizontal displacement)
  - Message flashes: "Tap N next" (where N is the correct target)
  - Message auto-clears after 1.1s
  - No penalty (game continues; wrong taps cost only time, not lives)

### Start Button

- **Tap:** Initiates game
  - Calls `layout()` → shuffles grid with Fisher-Yates
  - Calls `render()` → repaints grid, hides start button
  - Sets `st.running = true`
  - Records start time `st.t0 = Date.now()`
  - Starts 100ms interval timer that updates the time display
  - Shows message "Find 1 → 25 in order"

### Keyboard

- **Desktop:** None defined in prototype. Production should add:
  - Arrow keys or mouse clicks for accessibility
  - Escape key to abandon a game (optional pause / forfeit)

### Mobile Gestures

- **Prototype:** None defined.
- **Production:** Should support:
  - Single tap on any grid button (already works via click)
  - Touch-friendly sizing (grid size scales with viewport, min cell size should remain ≥40px on mobile)

---

## 4. ANIMATIONS & FEEDBACK

### CSS Keyframes Used

```css
@keyframes btShake {
  10%, 90% { transform: translateX(-2px); }
  20%, 80% { transform: translateX(4px); }
  30%, 50%, 70% { transform: translateX(-7px); }
  40%, 60% { transform: translateX(7px); }
}
```

### Wrong Tap Feedback

- **Animation:** `btShake 0.35s`
- **Duration:** 350ms (animation ends), then 10ms delay before clearing, total ~360ms
- **Visual:** Lateral vibration (±7px max displacement)
- **Audio:** None in prototype. Production may add: error beep or buzzer tone.

### Successful Tap Feedback

- **Immediate:** Button background and color transition smoothly (0.15s for background, 0.1s for transform)
- **Transform:** `scale(0.9)` while tapped state applies
- **Opacity:** No fade; remains visible as "completed"
- **Audio:** Optional in production (success chime)

### Result Modal Animation

- **Open:** Modal card scales from 0.92 to 1.0 (via `requestAnimationFrame`, transforms in cubic-bezier easing 0.3s)
- **Close:** Card scales back to 0.92, then modal display hidden after 200ms
- **Backdrop:** Blurred, fade in with modal

### Timer Update

- **Interval:** Every 100ms (10 updates per second)
- **Display:** Formatted as `(ms / 1000).toFixed(1)` + "s" (e.g., "0.0s", "18.3s")
- **Precision:** One decimal place

---

## 5. EMBEDDED DATA

### Colors (Palette)

| Element | HEX | RGBA | Usage |
|---------|-----|------|-------|
| Cyan Primary | #00e5ff | rgba(0, 229, 255, 1) | Headers, active highlights |
| Cyan Dark Accent | #0090c8 | - | Gradient depth |
| Violet Accent | #7b8cff | - | Gradient button end |
| Light Text | #f3f7ff | - | Title, main text |
| Muted Cyan Text | #9fe9ff | - | Labels, secondary text |
| Tapped Green | #7CF5C4 | - | Completed cell feedback |
| Gold Time | #ffb020 | - | Timer display |
| Light Gray Text | #eafcff | - | Button, default cell text |

### Typography

| Element | Font | Weight | Size | Letter-Spacing |
|---------|------|--------|------|-----------------|
| Title | Space Grotesk | 600 | 18px | — |
| Subtitle | JetBrains Mono | 400 | 10.5px | 0.1em |
| Grid Numbers | Space Grotesk | 600 | 20px | — |
| Stat Label | JetBrains Mono | 400 | 9.5px | 0.14em |
| Stat Number | Space Grotesk | 600 | 26px | — |
| Message | JetBrains Mono | 400 | 12.5px | — |
| Time Label | JetBrains Mono | 400 | 9.5px | 0.14em |

### Grid Data

- **Grid Dimensions:** 5×5 (25 cells)
- **Numbers:** 1–25 (no gaps, no duplicates)
- **Randomization Method:** Fisher-Yates shuffle of array [1, 2, ..., 25]
  ```javascript
  const a = [...Array(25).keys()].map(i => i + 1); // [1, 2, ..., 25]
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  // a is now shuffled
  ```

### Timing Constants

| Event | Duration | Notes |
|-------|----------|-------|
| Wrong tap animation | 350ms | btShake |
| Wrong tap message clear | 1100ms | Auto-clears after display |
| Timer update interval | 100ms | Fires every 100ms while running |
| Result modal open | 300ms | Cubic-bezier ease |
| Result modal close | 200ms | After card scale-down |
| Post-win timeout | 300ms | Delay before opening result modal |

---

## 6. RESULT MODAL

### Triggering

- Fires when all 25 numbers are found (on the 25th correct tap)
- Delay: 300ms after the 25th tap completes
- Updates "best" time in session state (`this.S.bestSchulte`) if new time is faster

### Modal Content

```html
<div style="text-align:center;">
  <div style="font-family:'JetBrains Mono';font-size:11px;letter-spacing:.2em;color:#00e5ff;">
    TABLE CLEARED
  </div>
  <div style="font-family:'Space Grotesk';font-weight:600;font-size:30px;color:#f3f7ff;margin-top:8px;">
    ${title}
  </div>
  <div style="font-family:'Space Grotesk';font-weight:600;font-size:46px;color:#00e5ff;margin-top:8px;">
    ${secs}<span style="font-size:20px;color:rgba(226,234,255,.5);">s</span>
  </div>
  <div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.18);border-radius:14px;padding:16px;margin-top:18px;text-align:left;">
    <div style="font-family:'JetBrains Mono';font-size:10px;letter-spacing:.16em;color:#9fe9ff;">
      🧠 BRAIN INSIGHT
    </div>
    <div style="font-size:14px;line-height:1.55;color:rgba(226,234,255,.82);margin-top:8px;">
      Schulte tables train peripheral vision and visual attention — keeping your eyes fixed on the centre while the numbers are found widens your useful field of view.
    </div>
  </div>
  <button data-share="..." class="bt-primary">
    Share result
  </button>
  <button data-home class="bt-ghost">
    Back to today
  </button>
</div>
```

### Title (Based on Time)

- `ms < 18000` (18s): "Eagle eyes."
- `ms < 30000` (30s): "Sharp focus."
- `ms >= 30000`: "Locked in."

### Share Text

```
BrainTap · Schulte Table
Full 5×5 in ${secs}s

braintap.app/games
```

---

## 7. STATE PERSISTENCE

### Stored in Session State (`this.S`)

| Key | Type | Notes |
|-----|------|-------|
| `bestSchulte` | number (ms) | Personal best time; persisted across sessions |
| `doneH` | boolean | Flag: has player played Schulte today? |

### Daily Play Flag

- Set via `markPlayed('h')` when game ends
- Checks `this.S.doneH` to display message: "Played today — replay to beat your time"
- Prevents earning streaks twice in one day
- Resets daily (calendar date based)

---

## 8. SOLVABILITY & DAILY LEVEL BANK

### Solvability Validation

**Schulte Table does NOT require a pre-generated bank.** Every shuffled 5×5 grid of numbers 1–25 is trivially solvable:
- The grid is just a randomized *visual layout* of fixed, unique numbers
- There is no "puzzle" to solve; the player must simply find and tap each number in sequence
- Every arrangement of 1–25 is automatically valid and completable

### Procedural vs. Banked

- **Approach:** Procedural (seeded random shuffle per play)
- **Why:** No solvability constraint; Fisher-Yates shuffle guarantees each grid is a valid permutation

### Daily Seed (Optional Enhancement)

If the design requires *consistent* grids for a given day (so all players see the same table), implement:
```javascript
// Deterministic shuffle using date as seed
const seed = Math.floor(Date.now() / 86400000); // Day number since epoch
const rng = new SeededRandom(seed);
const a = [...Array(25).keys()].map(i => i + 1);
for (let i = a.length - 1; i > 0; i--) {
  const j = Math.floor(rng.next() * (i + 1));
  [a[i], a[j]] = [a[j], a[i]];
}
```

This is **optional** and not required by the prototype. The prototype uses `Math.random()`, so each play gets a fresh shuffle.

---

## 9. PRODUCTION POLISH & ENHANCEMENTS

### Critical Improvements (Must-Have)

1. **Responsive Design & Mobile Optimization**
   - Test grid sizing on small screens (<360px viewport)
   - Ensure minimum tap target size ≥44px (accessibility)
   - Scale fonts responsively (e.g., grid numbers smaller on mobile)

2. **Accessibility**
   - Add ARIA labels to all buttons: `aria-label="Tap 1"`, `aria-label="Start"`, etc.
   - Keyboard navigation: Tab to cycle through buttons, Enter to tap (or Enter during game to submit)
   - Keyboard shortcut: Space or Enter to start (with focus on button)
   - High contrast mode support (test with prefers-contrast media query)
   - Reduced motion support (honor prefers-reduced-motion; disable or simplify animations)

3. **Haptic Feedback** (Mobile)
   - Correct tap: Brief pulse vibration (10–20ms)
   - Wrong tap: Strong buzz feedback (50–100ms)
   - Use Web Haptics API if available (`navigator.vibrate`)

4. **Audio Feedback**
   - Success: Ascending tone or chime (optional; gate behind sound setting)
   - Error: Error buzz or descending tone (optional; gate behind sound setting)
   - Use Web Audio API or pre-recorded `.mp3` / `.webm` assets

5. **Animation Smoothness**
   - Use `transform` and `opacity` only (GPU-accelerated)
   - Avoid animating layout properties (width, height, padding)
   - Test 60 FPS on mid-range devices; optimize if frame drops occur

6. **Difficulty Curve (Optional)**
   - Currently flat: all grids are equally hard
   - Future enhancement: offer "Easy" (3×3), "Normal" (5×5), "Hard" (6×6, harder to scan) variants
   - Each variant tracks separate personal best

7. **Hint System** (Optional)
   - Flash button location of next number (1-second fade-in of the cell)
   - Limited to 1 hint per game (or time penalty: +5 seconds)

8. **Pause Mechanic** (Optional)
   - Pause button to freeze timer and hide grid
   - Resume to continue
   - Improves game feel on long plays

9. **Share & Analytics**
   - Share button copies result to clipboard (already implemented)
   - Optional: Open native share dialog on mobile
   - Track completion time distribution (percentiles)

10. **Error Edge Cases**
    - Handle rapid double-taps on same button (ignore second tap)
    - Detect swipe/scroll within grid area; don't trigger grid taps
    - Test on slow networks (timer should not desync)

### Nice-to-Have Polish

- Particle effect or confetti on win
- Leaderboard integration (if multi-player mode exists)
- Time-of-day indicator on modal (e.g., "Beat your morning time by 2s")
- Replay mini-tutorial on first play ("Keep eyes on centre, let periphery find the numbers")
- Performance stats: taps per second, error rate, focus metrics

---

## 10. HOW-TO-PLAY HELP

From the prototype's help system:

**Name:** Schulte Table  
**Color:** #00e5ff (Cyan)

**Steps:**
1. Find the numbers 1 to 25 and tap them in order.
2. The timer runs until you reach 25.
3. Wrong taps just shake — no penalty but they cost time.
4. Beat your personal best.

**Tip:** Keep your eyes on the centre and let peripheral vision find the next number.

---

## 11. TESTING CHECKLIST

### Functional

- [ ] Grid renders with 25 unique numbers, each 1–25
- [ ] Start button hides after tap; timer begins
- [ ] Correct tap advances to next target; cell visual changes
- [ ] Wrong tap triggers btShake animation and error message
- [ ] Message auto-clears after 1.1s
- [ ] Timer increments every 100ms, displays correctly
- [ ] Final 25th tap triggers modal after 300ms delay
- [ ] Personal best is saved and compared correctly
- [ ] "Play again" button re-shuffles and restarts
- [ ] Share button copies text to clipboard
- [ ] "Back to today" closes modal and returns to hub
- [ ] "Played today" message appears on replay

### Responsive

- [ ] Grid fits on iPhone SE (375px), fits on iPad (768px)
- [ ] Tap targets ≥44px on all screen sizes
- [ ] Fonts scale appropriately
- [ ] No horizontal scrolling on mobile

### Performance

- [ ] Timer stays in sync (no drift >50ms over 30s)
- [ ] No jank during animations on throttled device (6x CPU slowdown)
- [ ] Modal opens/closes smoothly
- [ ] No memory leaks after multiple replays

### Accessibility

- [ ] Screen reader announces "Schulte Table", "Find 1 to 25 in order"
- [ ] All buttons have accessible labels
- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Reduced-motion mode disables animations
- [ ] Color contrast ≥4.5:1 (WCAG AA)

### Cross-Browser

- [ ] Chrome/Chromium, Firefox, Safari, Edge
- [ ] iOS Safari, Chrome (Android)
- [ ] No console errors

---

## 12. TECHNICAL NOTES

### No External Dependencies Required

- Grid randomization: Native `Math.random()` + Fisher-Yates
- Timer: Native `Date.now()` + `setInterval()`
- Animations: CSS keyframes + inline styles
- State: Browser localStorage (via `this.S` and `saveState()`)

### State Cleanup

- On component unmount or screen change, `clearInterval(st.timer)` must fire
- Prototype: `this._cleanup.push(() => clearInterval(st.timer))`
- Production: Ensure all intervals/listeners are cleared to prevent memory leaks

### Localization

- Current: English only
- Strings to externalize:
  - "Schulte Table"
  - "FIND 1 → 25 IN ORDER"
  - "FIND NEXT"
  - "TIME"
  - "Find 1 → 25 in order" (message)
  - "Tap N next"
  - "Start table" / "Play again"
  - Titles: "Eagle eyes.", "Sharp focus.", "Locked in."
  - "TABLE CLEARED"
  - "BRAIN INSIGHT" + insight text
  - "Share result", "Back to today"
  - "Played today — replay to beat your time"

---

## APPENDIX: Prototype Code Reference

**Screen HTML:** ID `screen-schulte` (lines 733–751)  
**Init Function:** `initSchulte()` (lines 1880–1905)  
**End Function:** `schulteEnd(ms)` (lines 1906–1923)  
**Help Data:** `H.schulte` (lines 2035–2036)  

---

**Document Status:** Complete  
**Last Updated:** 2026-06-17  
**Format:** Markdown (Build-Ready)

