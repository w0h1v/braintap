# Synapse Wordle ("Brainle") — Production Specification

## Overview
**Game ID:** `brainle`  
**Title:** Synapse Wordle  
**Theme:** THE MIND  
**Type:** Daily puzzle; Wordle-like word-guessing game  
**Core Loop:** Guess a 5-letter word in 6 tries with color-coded feedback.

---

## 1. Core Mechanics & Rules

### Win/Loss Conditions
- **WIN:** Player submits a guess that matches the answer word exactly before row 6. Trigger `brainleEnd(true, rows, answer, lastRes)`.
- **LOSS:** Player exhausts all 6 rows without matching the answer. Trigger `brainleEnd(false, rows, answer, lastRes)`.
- **GAME OVER:** Once win or loss occurs, no further guesses are accepted.

### Round Structure
1. **Setup:** Load daily answer from `answerForToday()` (30-word curated set, seeded by day).
2. **Play:** Player types letters (A–Z), submits rows via ENTER, deletes via BACKSPACE.
3. **Evaluation:** Each submitted guess is evaluated for correctness:
   - **CORRECT (green/cyan):** Letter is in the word AND in the correct position.
   - **PRESENT (amber/yellow):** Letter is in the word but in a different position.
   - **ABSENT (dark gray):** Letter is not in the word.
4. **Feedback:** Animated flip of cells (one by one, 180ms apart), keyboard colors update, message flashes.
5. **End State:** Modal with result, grid emoji visualizer, brain insight hint, share button.

### Scoring
**Not score-based.** Result is binary: won in N/6 or lost X/6. Share shows guess count.

### Word Data
**Answer Set (30 words):** Brain/cognition-themed, curated, 5 letters each.
```
BRAIN, FOCUS, SLEEP, DREAM, LOGIC, ALPHA, THETA, GAMMA, SENSE, NERVE,
AWAKE, RELAX, LEARN, THINK, PULSE, LUCID, VIVID, HABIT, SMART, QUIET,
CHILL, DRIVE, STUDY, CALMS, MOODS, ALERT, SHARP, NEURO, SYNCH, WAVES
```

**Valid Guess Set:** ~500+ common 5-letter English words. Includes all answer words plus words like ABOUT, ABOVE, ACTOR, etc. (See brainle-words.js for full list.)

**Daily Selection:** `answerForToday() = answers[Math.floor(Date.now() / 86400000) % 30]` — maps current UTC day to answer index.

---

## 2. UI Layout & Components

### Screen Structure
- **ID:** `screen-brainle`
- **Max-width:** 520px centered; padding 96px top, 20px sides, 40px bottom.
- **Flex layout:** column, center-aligned.

### Header (Lines 474–480)
```
[← Today] [Synapse Wordle | THEME · THE MIND] [Tap hint]
```
- **Left button:** `class="bt-go-home"` — returns to hub.
- **Center:** Title (Space Grotesk, 18px, #f3f7ff) + subtitle (JetBrains Mono, 10.5px, #ffb3ec).
- **Right button:** `id="brainle-hint"` — ghost style, cyan text (#9fe9ff), triggers `brainleHint(answer)`.

### Message Box
- **ID:** `brainle-msg`
- **Min-height:** 24px; JetBrains Mono, 12.5px, #9fe9ff.
- **Content:** Error messages ("Not enough letters", "Not in word list"), hints, or empty.
- **Auto-clear:** 1800ms after message set (unless game over).

### Game Board
- **ID:** `brainle-board`
- **Grid:** 6 rows × 5 columns; gap 7px; margin-top 8px.
- **Cell styling per row:**
  - **Rows 0–(current-1):** Submitted guesses, colored per feedback.
  - **Row (current):** Player's in-progress guess, border cyan on non-empty cells.
  - **Rows (current+1)–5:** Empty, gray border.
- **Cell dimensions:** 58px × 58px; Space Grotesk 600 weight, 28px, uppercase.
- **Border:** 2px, rounded 10px.
- **Colors (initial):** `rgba(255,255,255,.14)`.

### Keyboard
- **ID:** `brainle-keys`
- **Layout:** 3 rows (QWERTY), centered flex, gap 5px.
- **Rows:**
  1. [QWERTYUIOP]
  2. [ASDFGHJKL]
  3. [ENTER] [ZXCVBNM] [⌫]
- **Button styling (class="bt-key"):**
  - Flex: normal 1, wide (ENTER/⌫) 1.5.
  - Height: 50px; border-radius: 7px.
  - Background: `rgba(255,255,255,.08)`.
  - Color: #eaf1ff; Space Grotesk 600, 15px (11px for wide keys).
- **Feedback states:**
  - **CORRECT:** #00e5ff background, #04060f text.
  - **PRESENT:** #ffb020 background, #04060f text.
  - **ABSENT:** `rgba(255,255,255,.03)` background, `rgba(226,234,255,.35)` text.

### Hint System
- **Button:** `id="brainle-hint"` in header.
- **Hint object:** 30 hints (one per answer), pulled from `brainleHint(answer)`.
- **Format:** "💡 [insight text]".
- **Example:**
  - BRAIN: "Three pounds of you that rewires itself every day."
  - FOCUS: "Attention is a spotlight — this is where you point it."
  - SLEEP: "When the brain clears metabolic waste and files memory."
  - (All 30 provided in code at lines 1204–1206.)

### End Modal
- **Trigger:** `brainleEnd(win, rows, answer, lastRes)`.
- **Content:**
  - Header: "PUZZLE COMPLETE" (cyan, #00e5ff) or "BETTER LUCK TOMORROW" (pink, #ff7a9c).
  - Title: "Solved!", "Sharp.", "Locked in.", or "Nice synapse." (for win); "Out of guesses" (for loss).
  - Large answer word: Space Grotesk 600, 30px, #9fe9ff.
  - Grid visualization: JetBrains Mono, 18px, emoji (🟦=correct, 🟧=present, ⬛=absent).
  - Brain Insight: Background cyan+dark, padded box, JetBrains Mono label + insight text.
  - **Share button:** `data-share` attribute with formatted string, gradient cyan-to-blue-to-magenta.
  - **Back button:** Ghost style, returns to hub.

---

## 3. Interactions

### Keyboard Input (Physical & On-Screen)
- **Physical Keyboard Listener:** `window.addEventListener('keydown', onKey)` (lines 1194–1195).
  - **a–z:** Type letter (uppercased).
  - **ENTER:** Submit row.
  - **BACKSPACE:** Delete last letter.
  - Ignored if `!this.brainleActive` or `st.over`.
- **On-Screen Keyboard:**
  - **Letter buttons:** Click to type.
  - **ENTER button:** Click to submit.
  - **⌫ button:** Click to backspace.
  - All buttons disabled once game is over.

### Input Validation
1. **Length check:** Must be exactly 5 letters. Flash "Not enough letters" if < 5.
2. **Word list check:** Must be in `this.BW.valid` (Set of ~500 words). Flash "Not in word list" if invalid.
3. **Duplicate prevention:** None — same word can be guessed twice (but is pointless).

### Submission Flow
```
submit() {
  if (game over) return;
  if (cur.length < 5) flash("Not enough letters", rowIndex);
  if (!valid.has(cur.uppercase)) flash("Not in word list", rowIndex);
  
  evaluate(guess) → color feedback [correct/present/absent per cell]
  
  // Animate flip: stagger 180ms per cell
  for each cell: set animation btFlip .5s; at 250ms mark, apply colors
  
  // Update keyboard colors (rank: absent < present < correct)
  
  // Check win: all 5 cells = correct?
  if (win) st.over=true; call brainleEnd(true, ...)
  
  // Check loss: row 6 submitted without win?
  if (st.rows.length >= 6) st.over=true; call brainleEnd(false, ...)
}
```

### Mobile Gestures
- **No swipe or drag.** Touch input mapped to on-screen keyboard buttons only.
- **Tap button = click event.**

---

## 4. Animations & Feedback

### Flip Animation (Cell Reveal)
- **CSS:** `@keyframes btFlip { 0%{rotateX(0)} 50%{rotateX(90deg)} 100%{rotateX(0)} }`
- **Applied to:** Each submitted cell, staggered 180ms apart.
- **Duration:** 0.5s.
- **Color applied at 250ms mark** (mid-flip for visual pop).

### Shake Animation (Error)
- **CSS:** `@keyframes btShake { 10%,90%{translateX(-2px)} 20%,80%{translateX(4px)} 30%,50%,70%{translateX(-7px)} 40%,60%{translateX(7px)} }`
- **Applied to:** Entire row (if "Not enough letters" or "Not in word list") or selected tile group (Connections).
- **Duration:** 0.5s (Brainle) / 0.35s (Simon).

### Solve Animation (Connections)
- **CSS:** `@keyframes btSolve { 0%{scale(1)} 40%{scale(1.06)} 100%{scale(1)} }`
- **Applied to:** Solved group row.
- **Duration:** 0.5s.

### Message Flash
- **Fade-in:** Message appears immediately.
- **Display time:** 1800ms, then auto-cleared (unless game over).
- **Examples:** "Not enough letters", "Not in word list", hints.

### Hint Display
- **Trigger:** User clicks "Tap hint" button.
- **Action:** `brainleHint(answer)` returns hint; flash it in message box.
- **Format:** Emoji + text, 1800ms display then auto-clear.

---

## 5. Daily-Level Requirements

### Need Level Bank?
**YES.** This game requires a pre-generated or procedurally generated daily bank.

### Bank Size & Shape
- **Minimum bank size:** 365 answers (one per day, non-repeating for a year).
- **Recommended:** 1,000+ to avoid repeats over multi-year usage.
- **Current prototype:** 30 hard-coded answers; cycles every 30 days.

### Daily Selection Logic
```javascript
function answerForToday() {
  const day = Math.floor(Date.now() / 86400000); // UTC day number since epoch
  return answers[day % answers.length];
}
```
**Deterministic:** Same day always returns same answer (globally across all users).

### Level Data Shape
```json
{
  "id": "brainle-2025-06-17",
  "date": "2025-06-17",
  "answer": "BRAIN",
  "theme": "THE MIND",
  "hint": "Three pounds of you that rewires itself every day.",
  "difficulty": "easy" // optional: track for analytics
}
```

### Solvability Validation
**Algorithm:**
1. **Valid guess check:** Ensure answer is a real English word in a comprehensive dictionary.
2. **Unique solution check:** Use a Wordle solver algorithm:
   - For each valid guess, compute feedback (correct/present/absent).
   - Recursively prune the guess set by feedback.
   - Verify that only one word (the answer) survives a worst-case strategy.
3. **Word list compatibility:** Ensure answer is in the valid guess set (otherwise players cannot guess it as a secondary guess, though it won't matter for the first guess).

**Pseudocode:**
```javascript
function isSolvable(answer, validGuesses) {
  // Verify answer exists in guess set
  if (!validGuesses.includes(answer)) return false;
  
  // BFS to find worst-case guess path
  function canResolve(remaining, guesses) {
    if (remaining.length === 1) return true; // One answer left
    if (guesses.length === 0) return false;  // No guesses left, ambiguous
    
    // Pick the guess that best partitions the remaining set
    let bestGuess = guesses[0];
    let bestPartition = partition(remaining, bestGuess);
    
    for (let g of guesses) {
      const p = partition(remaining, g);
      if (maxPartitionSize(p) < maxPartitionSize(bestPartition)) {
        bestGuess = g;
        bestPartition = p;
      }
    }
    
    // Check if all partitions are solvable
    for (let subset of bestPartition.values()) {
      if (!canResolve(subset, guesses.filter(g => g !== bestGuess))) {
        return false;
      }
    }
    return true;
  }
  
  return canResolve([answer], validGuesses);
}
```

---

## 6. Production Polish & Upgrades

### vs. Prototype — Improvements for Production

#### Responsiveness & Layout
- [ ] **Mobile optimization:** Test cell/keyboard sizes on iPhone SE, iPad. Adjust 58px cells & 50px keys if cramped.
- [ ] **Landscape mode:** Support iPad landscape; consider wider board layout or side-by-side hints.
- [ ] **Tablet support:** Increase font sizes and padding on large screens (>1200px).

#### Animation & Haptics
- [ ] **Haptic feedback:** Trigger `navigator.vibrate()` on:
  - Cell flip completion (success): 50ms.
  - Error (shake): 30ms × 2 (double tap).
  - Hint reveal: 20ms.
- [ ] **Sound effects** (optional):
  - Positive (win): short uplifting chime.
  - Negative (error): soft error tone.
  - Flip: subtle whoosh.

#### Accessibility & ARIA
- [ ] **Semantic HTML:** Use `<button>` with proper `aria-label` for each key.
- [ ] **Keyboard focus:** Visible focus ring on keyboard buttons (outline or shadow).
- [ ] **Screen reader support:**
  - Board: Announce current guess state after each submission.
  - Keyboard: Label each button with letter or action (e.g., "enter", "backspace").
  - Hint: Announce hint text when revealed.
  - End modal: Announce result (win/loss, guess count).
- [ ] **Color contrast:** Ensure all text/background combos meet WCAG AA (4.5:1 minimum for text).

#### Difficulty & Hint System
- [ ] **Hint categories:**
  - Level 1 (free): First-letter clue (e.g., "Starts with B").
  - Level 2 (limited): Category or definition (current system).
  - Level 3 (paid/subscription): Full hint without spoiling.
- [ ] **Hint tracking:** Log hint usage per user per day for analytics.
- [ ] **Hard mode (optional):** Require all letters with green/yellow feedback in subsequent guesses.

#### Share & Social
- [ ] **Share button:** Copy to clipboard or open share sheet.
  - **Format:** Grid emoji + guess count + game name + URL.
  - **Fallback:** If Web Share API unavailable, show copyable text box.
- [ ] **Link preview:** Generate OG meta tags for shared links (custom card with result preview).

#### Edge Cases
- [ ] **Same answer submitted twice:** Prevent (second occurrence shows "Already found" or similar).
- [ ] **Game resume:** If user leaves mid-game, restore board state on return (use localStorage).
- [ ] **Timezone edge cases:** Always use UTC day (not local day) to ensure consistency.
- [ ] **Network failure:** Cache answer + word lists locally; allow offline play.
- [ ] **Browser back button:** Prevent accidental navigation; show confirmation.

#### Polish & UX
- [ ] **Animations:** Add subtle fade-in on game load; slide keyboard in.
- [ ] **Keyboard animation:** Bounce keys on click for tactile feedback.
- [ ] **Message animations:** Fade in/out instead of instant.
- [ ] **Winning animation:** Confetti or bounce cells on win (optional, subtle).
- [ ] **Daily reminder:** Notify user at a set time that new puzzle is available (if push notifications enabled).

#### Difficulty Curve & Progression
- [ ] **Analytics:** Track win rate, avg guess count, most-guessed words.
- [ ] **Word rotation:** Ensure answer pool doesn't skew to common or hard words over time.
- [ ] **Difficulty label (optional):** Mark hard answers in calendar view (e.g., "🔥 Challenge").

#### Performance
- [ ] **Lazy-load word lists:** Import only at game init, not at page load.
- [ ] **Debounce animations:** Ensure 60fps on older devices; reduce keyframe complexity if needed.
- [ ] **CSS optimization:** Use `will-change` on animated elements; avoid layout thrashing.

---

## 7. Technical Implementation Notes

### Data Import & Initialization
```javascript
// In init:
import('./brainle-words.js').then(m => {
  this.BW = m; // Module exports { answers, valid, answerForToday }
  run('brainle', () => this.initBrainle());
}).catch(e => console.warn('words', e));
```

### State Management
```javascript
const st = {
  rows: [],           // Array of submitted guesses (uppercase strings)
  cur: '',            // Current in-progress guess
  over: false,        // Game finished?
  keys: {}            // Map of letter → feedback status (correct/present/absent)
};
```

### Evaluate Function (Wordle Logic)
```javascript
const evaluate = (guess) => {
  const res = Array(COLS).fill('absent');
  const pool = {};
  
  // Count letters in answer
  for (let i = 0; i < COLS; i++) {
    const a = answer[i];
    pool[a] = (pool[a] || 0) + 1;
  }
  
  // First pass: exact matches
  for (let i = 0; i < COLS; i++) {
    if (guess[i] === answer[i]) {
      res[i] = 'correct';
      pool[guess[i]]--;
    }
  }
  
  // Second pass: present (in word but wrong position)
  for (let i = 0; i < COLS; i++) {
    if (res[i] === 'correct') continue;
    const g = guess[i];
    if (pool[g] > 0) {
      res[i] = 'present';
      pool[g]--;
    }
  }
  
  return res; // Array of 5 feedback strings
};
```

### Color Mapping
```javascript
const colorOf = {
  correct: ['#00e5ff', '#04060f', '#00e5ff'],   // [bg, fg, border]
  present: ['#ffb020', '#04060f', '#ffb020'],
  absent: ['rgba(255,255,255,.06)', 'rgba(226,234,255,.5)', 'rgba(255,255,255,.1)']
};
```

### Cleanup
```javascript
// In init, push cleanup function:
this._cleanup.push(() => window.removeEventListener('keydown', onKey));
```

### Daily Check
```javascript
// Mark as played for that day
this.markPlayed('b'); // 'b' = brainle

// Show "Come back tomorrow" message if already played
if (this.S.doneB) {
  msg.textContent = 'Come back tomorrow for a new word';
}
```

---

## 8. Hint Database

All 30 hints verbatim (from brainleHint function, lines 1204–1206):

```javascript
{
  BRAIN: 'Three pounds of you that rewires itself every day.',
  FOCUS: 'Attention is a spotlight — this is where you point it.',
  SLEEP: 'When the brain clears metabolic waste and files memory.',
  DREAM: 'REM theatre where the mind rehearses and consolidates.',
  LOGIC: 'The prefrontal cortex doing its slow, careful thing.',
  ALPHA: '8–12 Hz — the relaxed, idling rhythm of a calm mind.',
  THETA: '4–8 Hz — drowsy, creative, deep-meditation territory.',
  GAMMA: '40 Hz — bound-together perception and peak focus.',
  SENSE: 'Five streams of data your cortex stitches into reality.',
  NERVE: 'A cable of axons carrying the body's electrical mail.',
  AWAKE: 'Cortical arousal, courtesy of your reticular system.',
  RELAX: 'Down-shift the sympathetic nervous system.',
  LEARN: 'Neurons that fire together, wire together.',
  THINK: 'Default-mode and executive networks taking turns.',
  PULSE: 'The rhythmic beat entrainment locks onto.',
  LUCID: 'Aware that you are dreaming, mid-dream.',
  VIVID: 'High-salience memory the amygdala tagged as important.',
  HABIT: 'Behaviour the basal ganglia automated for you.',
  SMART: 'Fluid reasoning plus the knowledge you've stored.',
  QUIET: 'The low-noise state where insight tends to surface.',
  CHILL: 'Parasympathetic tone, rest-and-digest.',
  DRIVE: 'Dopamine's pull toward a goal.',
  STUDY: 'Spaced repetition beats cramming, every time.',
  CALMS: 'What slow breathing does to your vagus nerve.',
  MOODS: 'Affective weather, set partly by neurotransmitters.',
  ALERT: 'Norepinephrine sharpening your signal-to-noise.',
  SHARP: 'Cognitive acuity on a good day.',
  NEURO: 'The prefix for everything in this game.',
  SYNCH: 'When brain regions oscillate in phase.',
  WAVES: 'What an EEG actually measures.'
}
```

---

## 9. Share Format

**Template (from brainleEnd, line 1213):**
```
BrainTap · Synapse Wordle
{WIN_COUNT}/6   // e.g., "3/6" or "X/6" for loss

{GRID_EMOJI}

braintap.app/games
```

**Example (3 guesses, won):**
```
BrainTap · Synapse Wordle
3/6

🟦🟧⬛⬛🟧
⬛🟦⬛🟧⬛
🟦🟦🟦🟦🟦

braintap.app/games
```

---

## 10. Color Palette (Brain-Themed)

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| **Correct** | Cyan | #00e5ff | Letter correct & position |
| **Present** | Amber | #ffb020 | Letter in word, wrong position |
| **Absent** | Dark Gray | rgba(255,255,255,.06) | Letter not in word |
| **Text Primary** | Off-white | #f3f7ff | Title, primary text |
| **Text Secondary** | Light Blue | #eaf1ff | Button text, secondary |
| **Text Accent** | Cyan | #9fe9ff | Message, hints |
| **Text Theme** | Magenta | #ffb3ec | Theme label |
| **Background Dark** | Very Dark Blue | #04060f | Tile backgrounds when colored |
| **Button Neutral** | Transparent Gray | rgba(255,255,255,.08) | Default keyboard key |

---

## 11. Fonts

- **Title, Large Text:** Space Grotesk, 600 weight (semi-bold).
- **Body, Hints, Messages:** JetBrains Mono, 400 weight (monospace).
- **Letters in cells:** Space Grotesk, 600 weight.

---

## Checklist for Developer

- [ ] Implement game board with 6×5 grid.
- [ ] Implement keyboard (on-screen + physical).
- [ ] Implement word evaluation logic (correct/present/absent).
- [ ] Import/use word data from brainle-words.js (or equivalent).
- [ ] Implement flip animation (staggered per cell).
- [ ] Implement shake animation (error feedback).
- [ ] Implement hint system (30 hints from table above).
- [ ] Implement end modal with share button.
- [ ] Ensure daily answer from `answerForToday()` logic (seeded by UTC day).
- [ ] Add keyboard listener (physical A–Z, ENTER, BACKSPACE).
- [ ] Add screen reader labels (ARIA).
- [ ] Test responsiveness (mobile, tablet, desktop).
- [ ] Test haptic feedback.
- [ ] Implement localStorage restore (mid-game save).
- [ ] Create/validate 365+ answer bank for production.
- [ ] Set up solvability checker in build pipeline.
- [ ] Configure daily answer rotation.

---

## Summary

**Synapse Wordle** is a Wordle clone with brain-themed words and pedagogy. The prototype has all core mechanics working; production focus should be responsiveness, accessibility, haptics, hint-tiering, and a robust answer bank with solvability validation. The 30-word cycle should expand to 365+ for multi-year sustainable play.
