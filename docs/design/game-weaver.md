# IDEA WEAVER — PRODUCTION SPEC

**Game ID:** `weaver` | **Type:** Word-finding / Spelling Bee variant | **Duration:** Open-ended (typical 2-5 min)

---

## 1. CORE MECHANICS & RULES

### Objective
Find all valid words that can be formed from a set of 7 letters, where one designated letter (the center) **must be used in every word**. Bonus points awarded for finding the "pangram" — a word using all 7 letters exactly once.

### Game Setup (Daily Level)
- **7 letters total:**
  - 1 center letter (fixed, glowing accent)
  - 6 outer letters (arranged in hexagon)
- **All letters are uppercase** (A–Z only; no duplicates in this version)
- **Shuffle button** reorders the outer 6 letters (visual refresh only; does not change the hive)

### Win/Loss & Scoring

#### Scoring Rules
- **4-letter word:** 1 point
- **5-letter word:** 5 points
- **6-letter word:** 6 points
- **7-letter word (pangram):** 7 points + 7 bonus = **14 points**
  - Pangram detection: A word is a pangram if it contains the center letter AND all 6 outer letters.
  - Visual reward: ✨ PANGRAM indicator shown in flash message.

#### Win Condition
- Find **all valid words** in the puzzle's word list → game ends with "HIVE CLEARED" modal
- Player sees final rank (Novice, Spark, Thinker, Sharp, Brilliant, Genius, Mastermind) based on score % of maximum possible
- **No time limit** or lives system

#### Lose Condition
- None; player can keep guessing until finding all words or quitting

### Word Validation Pipeline
1. **Length check:** Must be ≥ 4 letters
2. **Center letter check:** Must contain the center letter
3. **Valid alphabet check:** All letters must be in the hive (center + 6 outer)
4. **Dictionary check:** Word must be in the hard-coded valid word list
5. **Duplicate check:** Cannot submit the same word twice
6. **On success:** Play flash feedback, add to found list, update stats, check win condition

### Input Methods
- **Hexagon tap/click:** Select a letter from the hive (appended to current word)
- **Delete button:** Remove last character from current word
- **Enter button:** Submit current word
- **Shuffle button:** Rearrange outer 6 letters randomly
- **Keyboard (desktop):**
  - Letter keys (A–Z) → if letter is in hive, append it
  - Enter → submit word
  - Backspace → delete last character

---

## 2. UI LAYOUT & VISUAL DESIGN

### Screen Structure (id="screen-weaver")
```
┌─────────────────────────────────────────┐
│ Header Row                              │
│ [← Today]  IDEA WEAVER  [blank 60px]   │
│            SPELL · 4+ LETTERS           │
├─────────────────────────────────────────┤
│ Rank & Progress                         │
│ RANK · Novice | 0/28 words · 0 pts     │
│ [============================== 0%]     │
├─────────────────────────────────────────┤
│ Current Input Display                   │
│ (min-height: 34px)                      │
│ R A I N (letter styling below)          │
│                                         │
│ ✓ NICE or 💡 Feedback msg (11.5px)     │
├─────────────────────────────────────────┤
│ Hexagon Control                         │
│       B                                 │
│     A   I                               │
│   R (center, cyan gradient)             │
│     N   E                               │
│       D                                 │
│ (260×280px container)                   │
├─────────────────────────────────────────┤
│ Action Buttons                          │
│ [Delete] [↻] [Enter]                    │
├─────────────────────────────────────────┤
│ Found Words List                        │
│ (flex wrap, sorted alphabetically)      │
│ [BRAID] [BRAIN] [BRAINED*] [BRAND] ... │
│ *pangram = gradient bg + bold           │
└─────────────────────────────────────────┘
```

### Typography & Colors

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Title | Space Grotesk | 18px | 600 | #f3f7ff |
| Subtitle | JetBrains Mono | 10.5px | — | #9bf7d3 |
| Current word | Space Grotesk | 24px | 600 | #f3f7ff (non-center), #7CF5C4 (center) |
| Feedback msg | JetBrains Mono | 11.5px | — | #9bf7d3 (success), #ffb3ec (error) |
| Stats row | JetBrains Mono | 11px | — | #7CF5C4 (accent), rgba(226,234,255,.5) (dim) |
| Found words (normal) | JetBrains Mono | 11px | — | rgba(226,234,255,.7) on rgba(255,255,255,.06) |
| Found words (pangram) | JetBrains Mono | 11px | **600** | #04060f on linear-gradient(118deg, #7CF5C4, #00e5ff) |
| Button labels | Space Grotesk | 14px | 500–600 | #eaf1ff |

### Component Styling

#### Hexagon Letter Buttons
- **Shape:** Clip-path polygon (hexagon) — `polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)`
- **Size:** 78×88px
- **Center letter:**
  - Background: `linear-gradient(160deg, #7CF5C4, #00e5ff)`
  - Color: #04060f
  - Font: Space Grotesk 26px bold
- **Outer letters:**
  - Background: `rgba(255,255,255,.07)`
  - Color: #eafcff
  - Font: Space Grotesk 26px bold
- **Position:** Absolute, arranged in hexagon positions:
  ```javascript
  positions = [
    [130, 140],  // center (index 0)
    [130, 42],   // top (index 1)
    [214, 91],   // top-right
    [214, 189],  // bottom-right
    [130, 238],  // bottom
    [46, 189],   // bottom-left
    [46, 91]     // top-left
  ]
  ```
- **Interaction:** On click → scale down 0.92 for 100ms, then restore

#### Progress Bar
- **Height:** 6px, **Border-radius:** 6px
- **Background:** `rgba(255,255,255,.06)`
- **Fill:** `linear-gradient(90deg, #7CF5C4, #00e5ff)` with 0.5s ease transition

#### Buttons (Delete, Shuffle, Enter)
- **Font:** Space Grotesk 14px
- **Padding:** 11px 22px (Delete), 11px 18px (Shuffle), 11px 26px (Enter)
- **Border-radius:** 100px (pill shape)
- **Delete & Shuffle (ghost style):**
  - Background: `rgba(255,255,255,.04)`
  - Border: 1px `rgba(255,255,255,.2)`
  - Color: #eaf1ff
- **Enter (primary):**
  - Background: `linear-gradient(118deg, #7CF5C4, #00e5ff)`
  - Color: #04060f
  - Font-weight: 600

#### Found Words List
- **Container:** `display: flex; flex-wrap: wrap; gap: 7px;`
- **Each tag:** `border-radius: 7px; padding: 5px 10px;`
- **Normal word:** 11px JetBrains Mono, `rgba(226,234,255,.7)` on `rgba(255,255,255,.06)`
- **Pangram word:** 11px JetBrains Mono **bold**, #04060f on gradient, with glow effect

### Rank Progression
Based on score as % of `totalScore` (max points for a puzzle):

| Score % | Rank |
|---------|------|
| 0–4% | Novice |
| 5–14% | Spark |
| 15–29% | Thinker |
| 30–49% | Sharp |
| 50–69% | Brilliant |
| 70–89% | Genius |
| ≥90% | Mastermind |

---

## 3. GAME STATES & SCREEN FLOW

### States
1. **Idle (initial):** Hexagon displayed, stats showing 0/total words, user selects letters
2. **Entering:** Current word appended to display as user taps letters
3. **Submit:** Validate word (see validation pipeline above)
   - **Valid:** Flash green success msg, add to found list, increment score, re-render stats
   - **Invalid:** Flash red error msg, clear current word, remain in entering state
4. **Win:** Auto-trigger when `found.length === valid.length` → 600ms delay, then `weaverEnd()` modal

### Screen Transitions
- **To Weaver:** Click game tile on home screen → init → render hexagon
- **From Weaver:** Click "← Today" button OR "Back to today" in end modal → hide screen, show home

### End Modal (weaverEnd function)
```
┌──────────────────────────────────┐
│ HIVE CLEARED (green accent)      │
│                                  │
│ Mastermind.                      │
│ 28 words · 156 points            │
│                                  │
│ [Share result]  ← primary button │
│ [Back to today] ← ghost button   │
└──────────────────────────────────┘
```

---

## 4. INTERACTIONS & INPUT HANDLING

### Mouse/Tap (All Platforms)
| Action | Target | Behavior |
|--------|--------|----------|
| Tap letter | Hexagon button | Append letter to `st.cur`, animate button scale 0.92→1 |
| Tap Delete | Button | Remove last char from `st.cur` |
| Tap Shuffle | Button | Fisher-Yates shuffle of `st.outer` array, re-render hexagon |
| Tap Enter | Button | Validate word via submit pipeline |
| Tap ← Today | Header | Hide screen, return to home |

### Keyboard (Desktop Only)
| Key | Behavior |
|-----|----------|
| A–Z | If letter is in hive, append to `st.cur` |
| Backspace | Delete last char |
| Enter | Submit word |
| (active only if `this.activeScreen === 'weaver'`) |

### Mobile Gestures
- **No swipe/drag required** (tap-only game)
- **Landscape/portrait responsive:** Container uses `max-width: 480px; margin: 0 auto;` for centering on any screen size

---

## 5. ANIMATIONS & FEEDBACK

### Success Feedback
- **Flash message:** Green text (#9bf7d3) appears below current word
  - Text: "✨ PANGRAM! +14" (for pangram) or "+5" (for 5-letter word)
  - Duration: 1400ms auto-clear
- **Word added to list:** Smooth render (no explicit animation in prototype, but can add fade-in)
- **Progress bar:** Width expands 0.5s ease

### Error Feedback
- **Flash message:** Pink text (#ffb3ec) with error message
  - "Too short — 4+ letters"
  - "Must use the center letter"
  - "Uses a letter not in the hive"
  - "Already found"
  - "Not in word list"
  - Duration: 1400ms auto-clear
- **Current word cleared:** Immediate reset
- **No visual shake** (minimal feedback in prototype)

### Button Animations
- **Hexagon button tap:** `scale(.92)` for 100ms on `transform .1s transition`
- **No other button animations** in prototype (production may add hover states)

### List Rendering
- Found words re-sorted alphabetically on each addition
- Pangram words highlight with gradient background

---

## 6. EMBEDDED DATA

### Valid Word List (28 words)
```javascript
const valid = [
  'BRAIN', 'BRAID', 'BRAN', 'BARN', 'BARE', 'BARED', 'BEAR',
  'BEARD', 'BRAND', 'BRED', 'BRIDE', 'BRINE', 'DARE', 'DARN',
  'DEAR', 'DINER', 'DRAIN', 'DRAB', 'NEAR', 'RAID', 'RAIN',
  'RAND', 'READ', 'REIN', 'RIDE', 'RIND', 'RIDER', 'BRAINED'
];
```

### Daily Level Definition (Example)
```javascript
{
  center: 'R',
  outer: ['B', 'A', 'I', 'N', 'E', 'D'],
  valid: [/* 28-word list above */],
  totalScore: 158  // sum of all scoreOf(word) values
}
```

### Scoring Rules (Embedded)
```javascript
const scoreOf = (w) => {
  const baseScore = w.length === 4 ? 1 : w.length;
  const isPangram = w => {
    const s = new Set(w.split(''));
    return [center, ...outer].every(l => s.has(l));
  };
  return baseScore + (isPangram(w) ? 7 : 0);
};
```

### Rank Progression (Embedded)
```javascript
const ranks = [
  [0,    'Novice'],
  [0.05, 'Spark'],
  [0.15, 'Thinker'],
  [0.3,  'Sharp'],
  [0.5,  'Brilliant'],
  [0.7,  'Genius'],
  [0.9,  'Mastermind']
];
// Threshold is (thresholdScore / totalScore)
```

---

## 7. DAILY LEVEL BANK & SOLVABILITY

### Daily Generation Model
- **Daily Level Bank:** Required
  - Must pre-generate or curate a bank of **365+ Idea Weaver puzzles** (one per day, +leap year buffer)
  - Each puzzle is a fixed JSON object: `{ center: 'X', outer: ['A','B','C','D','E','F'], valid: [...], totalScore: N }`
  - **Seeding:** Use daily timestamp modulo bank size to pick puzzle for today
    ```javascript
    const puzzleIndex = Math.floor(Date.now() / 864e5) % bankSize;
    const today = puzzleBank[puzzleIndex];
    ```

### Level Data Shape
```typescript
interface DailyLevel {
  // Daily identifier (human-readable)
  date: string;              // "2025-06-17"
  
  // Letter grid
  center: string;            // Single uppercase letter, must be in outer list
  outer: string[];           // Exactly 6 uppercase letters, no duplicates
  
  // Word list (curated/verified)
  valid: string[];           // All valid words findable from hive
  
  // Scoring metadata
  totalScore: number;        // Sum of scoreOf(word) for all valid words
  pangramWord?: string;      // (optional) The expected pangram, if any
  
  // Difficulty metadata (for frontend display/difficulty curve)
  difficulty: 1 | 2 | 3 | 4 | 5;  // 1=easiest, 5=hardest
  estimatedTime: number;           // Rough completion time in seconds (2–5 min = 120–300s)
}
```

### Solvability Validation Algorithm

For each daily level, **pre-validate offline** (during level curation/generation) that:

1. **All words use only letters in the hive:**
   ```
   For each word in valid[]:
     If NOT all(char in word are in [center + outer]):
       REJECT level
   ```

2. **Center letter is required in every word:**
   ```
   For each word in valid[]:
     If center NOT in word:
       REJECT level
   ```

3. **No duplicate words in valid list:**
   ```
   If Set(valid).size !== valid.length:
     REJECT level
   ```

4. **Pangram exists and is solvable (optional but recommended):**
   ```
   Let pangram = word using all 7 letters exactly once
   If no pangram exists in valid[]:
     WARNING: Level lacks pangram bonus (less engaging)
   Else:
     Verify pangram is in valid[]
   ```

5. **Minimum word count (gameplay balance):**
   ```
   If valid.length < 15:
     WARNING: Too few words (feels incomplete)
   If valid.length > 50:
     WARNING: Too many words (overwhelming)
   ACCEPT if 15 <= valid.length <= 50
   ```

6. **Word frequency distribution (optional elegance check):**
   ```
   Count 4-letter, 5-letter, 6-letter, 7-letter words
   Recommend ratio of ~40–50% 4-letter (base points), ~30% 5-letter, ~15% 6-letter, ~5–10% 7-letter
   ```

### Solvability Test Suite
**Pre-generation script** (Node.js) to validate all levels:

```javascript
function validateLevel(level) {
  const hive = new Set([level.center, ...level.outer]);
  
  // Check 1: All words in hive
  for (const word of level.valid) {
    for (const char of word) {
      if (!hive.has(char)) {
        throw new Error(`Word '${word}' uses letter '${char}' not in hive`);
      }
    }
  }
  
  // Check 2: Center required
  for (const word of level.valid) {
    if (!word.includes(level.center)) {
      throw new Error(`Word '${word}' does not contain center letter '${level.center}'`);
    }
  }
  
  // Check 3: No duplicates
  if (new Set(level.valid).size !== level.valid.length) {
    throw new Error('Duplicate words in valid list');
  }
  
  // Check 4: Scoring consistency
  const calculated = level.valid.reduce((sum, w) => sum + scoreOf(w, level.center, level.outer), 0);
  if (calculated !== level.totalScore) {
    throw new Error(`Total score mismatch: expected ${calculated}, got ${level.totalScore}`);
  }
  
  // Check 5: Pangram validation (if specified)
  if (level.pangramWord) {
    const letters = new Set(level.pangramWord);
    const required = new Set([level.center, ...level.outer]);
    if (letters.size !== 7 || ![...required].every(l => letters.has(l))) {
      throw new Error(`Pangram '${level.pangramWord}' does not use all 7 letters exactly once`);
    }
    if (!level.valid.includes(level.pangramWord)) {
      throw new Error(`Pangram '${level.pangramWord}' not in valid list`);
    }
  }
  
  return true; // Valid
}
```

### Bank Size Recommendation
- **Minimum:** 365 puzzles (one per year)
- **Recommended:** 730+ puzzles (2-year rotation, reduces repeat fatigue)
- **Storage:** JSON file ~50–100 KB (1000 puzzles)

---

## 8. PRODUCTION POLISH & QUALITY UPGRADES

### Over Prototype

#### Responsiveness & Layout
- [ ] **Responsive hexagon sizing:** Use CSS `max(8vw, 78px)` for letter buttons to scale on mobile
- [ ] **Adaptive container max-width:** Adjust based on viewport (320px–480px)
- [ ] **Touch target size:** Ensure hexagon buttons ≥48×48px tap zone (WCAG 2.1 AAA)
- [ ] **Landscape mode:** Test on iPad/wide screens; ensure layout doesn't break

#### Animations & Polish
- [ ] **Letter button hover state:** Subtle background glow or border highlight on desktop
- [ ] **Found word fade-in:** Animate new tags sliding into list (100ms cubic-bezier)
- [ ] **Feedback message transitions:** Fade in/out (200ms) instead of instant
- [ ] **Progress bar animate:** Current implementation uses transition; verify smooth 0.5s easing
- [ ] **Shuffle animation:** Spin rotate the outer letters 360° while shuffling (300ms)
- [ ] **Bounce on error:** Light shake animation (10px left/right) when word is rejected
- [ ] **Win celebration:** Confetti or particle burst (opt-in, can be disabled in settings)

#### Haptic Feedback
- [ ] **On letter tap:** Subtle haptic buzz (iOS/Android native feedback)
- [ ] **On word submit:** Strong haptic on success, weak on error
- [ ] **On pangram:** Double haptic pulse
- [ ] **On win:** Sustained haptic feedback (200–300ms)

#### Accessibility & ARIA
- [ ] **Hexagon buttons:** `aria-label="Letter A"` for each button
- [ ] **Current word display:** `role="region" aria-live="polite"` to announce changes
- [ ] **Feedback messages:** `aria-live="assertive"` for errors and success
- [ ] **Progress bar:** `role="progressbar" aria-valuenow="X" aria-valuemin="0" aria-valuemax="100"`
- [ ] **Keyboard navigation:** Tab through buttons in a sensible order (center first, then outer in order)
- [ ] **Color contrast:** All text meets WCAG AA (4.5:1 minimum)
- [ ] **Dark mode support:** Verify colors work in forced colors mode (Windows High Contrast)

#### Keyboard Enhancements
- [ ] **Vim keybindings (optional):** hjkl or arrows to navigate hexagon (advanced)
- [ ] **Repeat key:** Allow holding letter key to append multiple times (if accessible)
- [ ] **Shift+Enter:** Submit and shuffle (power-user shortcut)
- [ ] **Tab focus visible:** Clear outline on focused button (not default browser)

#### Difficulty Curve & Balancing
- [ ] **Word bank selection:** Curate ~30 high-quality puzzles by hand
- [ ] **Difficulty tiers:** Start with easier hives (many 4-letter words), gradually add longer words
- [ ] **Accessibility difficulty:** Ensure first ~7 days are "Novice" level, increasing after
- [ ] **Avoid homograph ambiguity:** If a word has multiple meanings, prefer clearer definition

#### Hint System (Optional)
- [ ] **Reveal hint:** Show first letter of a random unfound word (costs bonus points or limited)
- [ ] **Hint counter:** Display "2 hints remaining" in a subtle badge
- [ ] **Hint types:**
  - "A word starting with B"
  - "A 6-letter word"
  - "A word using all 7 letters"

#### Feedback & Share
- [ ] **Share button:** Opens native share or copy-to-clipboard
- [ ] **Share text:** "`BrainTap · Idea Weaver\n28/28 words · 156 pts\nRank: Mastermind\nbraintap.app/games`"
- [ ] **Share image (optional):** Generate a visual summary (word count, rank emoji, bar chart)
- [ ] **Replay option:** "Play again" button in end modal to reset and try same puzzle

#### Edge Cases & Polish
- [ ] **Prevent accidental exits:** Confirm "Leave game?" if user navigates away mid-play
- [ ] **Duplicate letter detection:** If center letter appears in outer, reject during level validation
- [ ] **Very long words:** Cap display to avoid text overflow (truncate with ellipsis if >12 chars)
- [ ] **Empty hive state:** If no letters loaded, show error message instead of blank screen
- [ ] **Network fallback:** If daily level fails to load, show cached last-working level or placeholder
- [ ] **Performance optimization:** Lazy-render found words list (virtualize if >100 words, unlikely)

#### Testing Checklist
- [ ] **A/B test word lists:** Verify 15–50 words feels balanced (not too easy/hard)
- [ ] **Cross-browser keyboard input:** Test on Firefox, Safari, Chrome for any key event quirks
- [ ] **Mobile gesture conflicts:** Ensure double-tap doesn't trigger unwanted browser zoom
- [ ] **Screen reader testing:** Use NVDA/JAWS/VoiceOver to verify all interactive elements are labeled
- [ ] **Performance profile:** Ensure initialization <100ms, submit validation <50ms
- [ ] **Offline play:** Cache today's level so it works without internet

---

## 9. TECHNICAL SPECIFICATIONS FOR DEVELOPERS

### State Management
The game maintains a single state object during play:

```javascript
{
  cur: "",                    // Current word being typed (uppercase)
  found: [],                  // Array of successfully found words
  score: 0,                   // Total points
  outer: [],                  // Shuffled copy of outer 6 letters (permutable)
  // (center letter is constant, not in state)
}
```

### Rendering Order (DOM Updates)
1. **paintCur()** → Update current word display with color coding (center green, others white)
2. **updateStats()** → Update found count, score, rank, progress bar, and found words list
3. **renderHex()** → Rebuild hexagon buttons (only on shuffle or init)

### Performance Notes
- **Validation:** O(n) for word length check, O(1) for set membership (hive lookup)
- **Sorting:** Found words sorted alphabetically on each update (inefficient for large lists, unlikely to exceed 50 words)
- **Rendering:** Found words list re-rendered fully on each addition; optimize by appending DOM node instead

### Integration with Parent App
- **Init trigger:** `run('weaver', () => this.initWeaver())`
- **Cleanup:** Handlers registered in `this._cleanup` array, removed on screen hide
- **State persistence:** No persistent save (stateless daily puzzle)
- **Analytics hooks:** Call `this.markPlayed('w')` on win (already in weaverEnd)

---

## 10. PROTOTYPE vs. PRODUCTION NOTES

### What Works Well (Keep)
- Core game loop (select letters, validate, score, check win)
- Hexagon visual layout and positioning
- Scoring formula with pangram bonus
- Keyboard support (A–Z, Backspace, Enter)
- Rank progression system

### What to Improve (See Section 8)
- **Animations:** Add more polish (fade, slide, spin, bounce)
- **Mobile first:** Ensure responsive touch targets and landscape mode
- **Accessibility:** Full ARIA labels, screen reader testing, keyboard navigation
- **Hint system:** Prototype has none; add optional hints for production
- **Share feature:** Currently stubbed; implement proper share sheet/clipboard
- **Level curation:** Prototype has only 1 hand-coded puzzle; need 365+ daily rotation
- **Error handling:** Show friendly errors instead of silent failures
- **Performance:** Profile and optimize rendering for large word lists (unlikely to be needed)

---

## 11. DEPLOYMENT & OPERATIONS

### Daily Level Rotation
- Store 365+ levels in a JSON file or database
- On app load, calculate `Math.floor(Date.now() / 864e5) % bankSize` to pick today's level
- **No fetching required** if levels are bundled; otherwise, cache with 24-hour TTL

### A/B Testing Opportunities
1. Test different hint mechanics (cost vs. count-limited)
2. Test different word list sizes (smaller puzzles vs. longer challenges)
3. Test pangram presence: does puzzles with pangrams drive higher engagement?
4. Test difficulty curve: do easier first puzzles increase return rate?

### Analytics Events to Track
- **game_start:** User enters Idea Weaver
- **word_submit:** Each word submission (valid or invalid)
- **word_found:** Valid word added to list
- **game_complete:** Win condition reached
- **game_abandon:** User exits before win
- **hint_used:** If hint system implemented
- **share_clicked:** Share button pressed
- **time_to_win:** Duration from start to win (session duration)

---

## 12. SUMMARY

**Idea Weaver** is a word-finding puzzle game where players find all valid words from a 7-letter hive, earning points based on word length and achieving a bonus "Mastermind" rank by finding the pangram. The game is **stateless, daily-rotated, and requires no backend** beyond serving the level bank. Production focuses on polish (animations, accessibility, responsiveness), expansion (365+ level bank with solvability validation), and engagement (share, hints, difficulty curve).

