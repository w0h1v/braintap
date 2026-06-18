# Tap Teasers — Production Game Specification

**Game ID:** `teasers`
**Game Type:** Lateral-thinking riddle quiz
**Daily Play Mode:** One daily game per user
**Target Audience:** Players aged 8+, riddle enthusiasts, lateral-thinking puzzle fans

---

## 1. Core Game Mechanics & Rules

### 1.1 Game Flow

Tap Teasers is a **5-riddle multiple-choice quiz** with a reveal-and-learn structure:

1. **Riddle Presentation:** Player reads a lateral-thinking riddle and four multiple-choice options
2. **Answer Selection:** Player taps one of four option buttons
3. **Immediate Feedback:** 
   - All options freeze; the correct answer highlights in green
   - Player's selection highlights: green if correct, red if wrong
   - Unselected wrong answers fade to 50% opacity
   - A styled explanation box appears below with either "✓ NICE" (correct) or "💡 THE AHA" (wrong)
4. **Explanation Reveal:** The explanation explains *why* the answer is correct—teaching the lateral thinking concept
5. **Progress to Next:** A "Next riddle →" (or "See results →" on final riddle) button advances

### 1.2 Scoring & Win/Lose Conditions

- **Score Tracking:** Count of correct answers across the 5 riddles (0–5 possible)
- **Win Condition:** Complete all 5 riddles; score displays at end
- **Lose Condition:** No explicit lose state; all selections count, no time limit, no wrong-answer penalty
- **End Results:**
  - 5/5: "Flawless lateral thinking."
  - 3–4/5: "Sharp instincts."
  - 0–2/5: "The aha takes practice."

### 1.3 Progress Bar & Metadata

- **Progress Indicator:** A horizontal progress bar (`#teasers-bar`) fills left-to-right, width = (currentRiddleIndex / 5) × 100%
- **Riddle Counter:** "RIDDLE 1/5", "RIDDLE 2/5", etc., displayed in top center header
- **Replay Detection:** If player has already completed today's game, a "Replaying today's riddles" label appears above the first riddle card

---

## 2. UI Layout & Styling

### 2.1 Screen Structure

**Screen ID:** `screen-teasers`

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ← Today      Tap Teasers              [spacer]    │  (Header, 96px top padding)
│               RIDDLE 1/5                           │  (Space Grotesk 18px, #ffb3ec accent)
│                                                     │
│  ─────────────────────────────────────────────────  │  (Progress bar, 5px height)
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ RIDDLE 1                                    │   │  (Riddle card, 20px border-radius)
│  │                                             │   │
│  │ I can be cracked, made, told, and played.  │   │
│  │ What am I?                                  │   │
│  │                                             │   │
│  │ [  A code                              ]   │   │  (4 option buttons, 14px v-padding)
│  │ [  A joke                              ]   │   │
│  │ [  A promise                           ]   │   │
│  │ [  A record                            ]   │   │
│  │                                             │   │
│  │ ┌─────────────────────────────────────┐   │   │
│  │ │ ✓ NICE                              │   │   │  (Reveal box, after answer)
│  │ │                                     │   │   │
│  │ │ A joke is cracked, made, told and   │   │   │
│  │ │ played on someone — four verbs, one │   │   │
│  │ │ answer.                             │   │   │
│  │ └─────────────────────────────────────┘   │   │
│  │                                             │   │
│  │ [ Next riddle → ]                          │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2.2 Color Scheme & Brand Accents

- **Primary Accent (Teasers):** Magenta/Pink gradient
  - Bright: `#ff2bd6`, `#ff7ae0`
  - Dark: `#ffb3ec` (accent text)
  - Highlight box: `rgba(255,43,214,.06)` background, `rgba(255,43,214,.45)` border on hover
- **Correct Answer Feedback:** `#7CF5C4` (green), `rgba(124,245,196,.14)` background
- **Wrong Answer Feedback:** `#ff5a7c` (light red), `rgba(255,90,124,.12)` background
- **Explanation Box:** Cyan accent `#9fe9ff`, `rgba(0,229,255,.06)` background
- **Main Text:** `#f3f7ff`, `#e7eeff`, `#eafcff` (light blues)
- **Secondary Text:** `rgba(226,234,255,.65)` (muted)
- **Dark Background:** `rgba(20,12,30,.7)` to `rgba(8,12,26,.6)` gradient

### 2.3 Typography

- **Headers (Title, Game Name):** Space Grotesk, weight 600, size 18px
- **Riddle Text:** Space Grotesk, weight 600, size 21px, line-height 1.4
- **Riddle Label:** JetBrains Mono, font-size 11px, letter-spacing .16em
- **Option Buttons:** Space Grotesk, weight 500, size 15px
- **Explanation Text:** Standard body, size 13.5px, line-height 1.55
- **Top Counter:** JetBrains Mono, size 10.5px, letter-spacing .1em

### 2.4 Component Styling

#### Riddle Card
- Class: `bt-rise`
- Background: `linear-gradient(180deg,rgba(20,12,30,.7),rgba(8,12,26,.6))`
- Border: `1px solid rgba(255,43,214,.2)`
- Border-radius: 20px
- Padding: 28px
- Animation: `btRise` (0.7s cubic-bezier, translateY from +16px to 0)

#### Option Buttons (Before Answer)
- Background: `rgba(255,255,255,.045)`
- Border: `1px solid rgba(255,255,255,.1)`, border-radius 12px
- Padding: 14px 18px
- Text-align: left
- Cursor: pointer
- Transition: all 0.2s
- **Hover (unanswered):** Border → `rgba(255,43,214,.45)`, background → `rgba(255,43,214,.06)`

#### Option Buttons (After Answer)
- Cursor: default
- **Correct option:** Background `rgba(124,245,196,.14)`, border `#7CF5C4`, text `#cffff0`
- **Wrong selection:** Background `rgba(255,90,124,.12)`, border `#ff5a7c`, text `#ffd0da`
- **Unselected wrong:** Opacity 0.5

#### Explanation Box
- Background: `rgba(0,229,255,.06)`
- Border: `1px solid rgba(0,229,255,.18)`
- Border-radius: 12px
- Padding: 14px
- Margin-top: 18px
- Label color: `#9fe9ff`
- Text color: `rgba(226,234,255,.82)`
- Initially hidden (`display:none`), revealed after answer

#### "Next" / "See results" Button
- Class: `bt-primary`
- Width: 100%
- Background: `linear-gradient(118deg,#ff2bd6,#ff7ae0)`
- Border-radius: 12px
- Padding: 13px
- Margin-top: 14px
- Text: Space Grotesk, weight 600, size 14px, color `#04060f`
- **Hover:** Transform `translateY(-2px)`, enhanced shadow

#### Progress Bar Container
- Height: 5px
- Border-radius: 5px
- Background: `rgba(255,255,255,.06)`
- Margin-top: 20px

#### Progress Bar Fill
- Background: `linear-gradient(90deg,#ff2bd6,#ff7ae0)`
- Height: 100%, border-radius 5px
- Width: (currentIndex / totalRiddles) × 100%
- Transition: width 0.4s ease

### 2.5 Layout Constraints

- **Container max-width:** 520px
- **Margins:** 96px top (to clear header), 20px sides, 40px bottom
- **Flex layout:** Center aligned, flex-direction column
- **Mobile responsive:** `min(92vw, [max-width])` ensures works on small screens

---

## 3. Game States & Interactions

### 3.1 States

1. **Idle/Loaded:** Card displayed, riddle visible, all option buttons active (hover-ready)
2. **Answered:** All buttons disabled (cursor: default), colors applied, explanation box revealed
3. **Transition:** After "Next" click but before re-render (state advances)
4. **Completed:** Final results modal displayed

### 3.2 User Interactions

#### Tap/Click
- **Option Button (Unanswered):** Calls `answer(idx, button, optionsContainer, riddleObject)`
  - Records the selected answer
  - Freezes all buttons
  - Applies visual feedback (colors, opacity)
  - Triggers explanation reveal
  - Only allowed once per riddle (`st.answered` flag prevents re-entry)
  
- **"Next" Button:** Increments riddle index and re-renders (or calls `teasersEnd()` if final)

#### Hover (Desktop)
- **Option buttons (unanswered only):**
  - Border color lightens to `rgba(255,43,214,.45)`
  - Background shifts to `rgba(255,43,214,.06)`
  - Reverts on mouse leave if not yet answered

#### Keyboard
- **Prototype:** No keyboard input implemented
- **Production:** Consider arrow keys (↑/↓ to navigate options) + Enter/Space to select

#### Mobile Gestures
- **Tap:** Standard button interaction (no swipe or multi-touch detected in prototype)
- **Production:** Ensure touch targets are ≥44px for accessibility

### 3.3 State Management

```javascript
const st = {
  i: 0,                    // Current riddle index (0-4)
  score: 0,                // Correct answers (0-5)
  answered: false          // Locks buttons after selection
};
```

---

## 4. Animations & Feedback

### 4.1 Entrance Animation

**Card Rise Animation**
- Class: `.bt-rise`
- Duration: 0.7s
- Easing: cubic-bezier(0.2, 0.7, 0.2, 1)
- Effect: Card slides up from `translateY(+16px)` to 0, opacity fades in
- Applied to the riddle card each time it renders

```css
@keyframes btRise {
  0% { transform: translateY(16px); }
  100% { transform: translateY(0); }
}
.bt-rise {
  opacity: 1;
  animation: btRise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
```

### 4.2 Answer Selection Feedback

**Immediate:**
- Wrong answer clicked: Button background shifts to error red `rgba(255,90,124,.12)`
- Correct answer: Highlights in success green `rgba(124,245,196,.14)`
- All other unselected: Fade to 50% opacity
- Transition: 0.2s (smooth color change)

**Explanation Reveal:**
- Box appears with `display: block`
- No fade-in animation (appears instantly)
- Contains either "✓ NICE" (correct) or "💡 THE AHA" (wrong)

### 4.3 Button Hover State

**Primary Button (.bt-primary) Hover**
```css
.bt-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 44px rgba(0,229,255,.32), 0 6px 24px rgba(255,43,214,.26);
  filter: saturate(1.06) brightness(1.04);
}
```

---

## 5. All Embedded Data

### 5.1 Riddle Dataset (Hardcoded in Prototype)

The prototype includes 5 riddles. Each riddle object has this shape:

```javascript
{
  q: "Question text",
  opts: ["Option 1", "Option 2", "Option 3", "Option 4"],
  a: 1,  // Correct answer index (0-3)
  why: "Explanation text"
}
```

#### Complete Riddle Set

```javascript
const riddles = [
  {
    q: 'I can be cracked, made, told, and played. What am I?',
    opts: ['A code', 'A joke', 'A promise', 'A record'],
    a: 1,
    why: 'A joke is cracked, made, told and played on someone — four verbs, one answer.'
  },
  {
    q: 'The more of me you take, the more you leave behind. What am I?',
    opts: ['Memories', 'Footsteps', 'Time', 'Breaths'],
    a: 1,
    why: 'Every footstep you take leaves one behind you — the classic lateral flip of "take vs leave".'
  },
  {
    q: 'What gets bigger the more you take away from it?',
    opts: ['A debt', 'A hole', 'A shadow', 'A secret'],
    a: 1,
    why: 'Remove more earth and the hole only grows — subtraction that adds.'
  },
  {
    q: 'I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?',
    opts: ['A ghost', 'An echo', 'A thought', 'A flag'],
    a: 1,
    why: 'An echo answers you with no mouth and rides on moving air.'
  },
  {
    q: 'What has many keys but opens no locks?',
    opts: ['A map', 'A piano', 'A river', 'A keyring'],
    a: 1,
    why: 'A piano has 88 keys and not one of them opens a lock — your brain loves these category swaps.'
  }
];
```

---

## 6. Daily-Level Requirements & Solvability

### 6.1 Daily Level Model

Tap Teasers is **NOT PROCEDURALLY GENERATED**. Instead, it requires a **pre-built level bank**:

- **Bank Size:** Minimum 365+ unique riddle sets (one per day of the year)
- **Selection:** Each day, serve `riddles[Math.floor(Date.now() / 864e5) % bank.length]` to ensure same riddles for all players on a given day (daily synchronization)
- **Refresh:** On each calendar day (UTC midnight), the daily selection advances

### 6.2 Level Data Shape

Each daily level is a simple array:

```javascript
{
  date: "2025-01-15",  // ISO date string
  riddles: [
    {
      q: "...",
      opts: ["...", "...", "...", "..."],
      a: 0 | 1 | 2 | 3,  // Correct index
      why: "..."
    },
    // ... 4 more riddles
  ]
}
```

### 6.3 Solvability Validation

Each level must satisfy:

1. **Structural Integrity:**
   - Exactly 5 riddles
   - Each riddle has exactly 4 options
   - Correct answer index `a` is in range [0, 3]
   - All text fields (`q`, `opts`, `why`) are non-empty strings

2. **Quality Checks:**
   - No duplicate riddles within a single daily level
   - Each correct answer is semantically justified (tested by human review, not algorithmic)
   - Explanations (`why`) are clear, educational, and not generic

3. **Testing Algorithm:**
   ```
   function validateLevel(level) {
     if (!level.riddles || level.riddles.length !== 5) return false;
     for (const riddle of level.riddles) {
       if (!riddle.q || !Array.isArray(riddle.opts) || riddle.opts.length !== 4) return false;
       if (typeof riddle.a !== 'number' || riddle.a < 0 || riddle.a > 3) return false;
       if (!riddle.why || riddle.opts.some(o => !o || typeof o !== 'string')) return false;
     }
     return true;
   }
   ```

4. **Uniqueness Validation:**
   - Before adding to bank, compare the 5 riddle questions against all existing riddles in the bank
   - Reject duplicates or near-duplicates (>80% text similarity)

### 6.4 Level Bank Generation Strategy

1. **Source:** Curated riddles from published lateral-thinking puzzle collections (e.g., "Lateral Thinking Puzzles," Edward de Bono)
2. **Grouping:** Assemble into sets of 5, ensuring variety (different topics, different trick types)
3. **Review:** Human QA pass: verify each answer is correct, explanations are clear
4. **Storage:** Store as JSON array or database table with indexed date field
5. **Fallback:** If date is beyond bank length, modulo back to start (circular rotation)

---

## 7. Production Polish & Improvements Over Prototype

### 7.1 Responsiveness & Layout

- [ ] **Mobile Optimization:** Ensure text sizes scale on screens < 400px width
- [ ] **Orientation:** Test landscape and portrait on tablets; riddle card must fit viewport without scrolling
- [ ] **Safe Areas:** Add padding for notches (iPhone X+ notch, dynamic islands)
- [ ] **Touch Targets:** Ensure all buttons are ≥48px height (WCAG AAA)

### 7.2 Animation & Polish

- [ ] **Progress Bar Animation:** Smooth width transition (0.4s ease in prototype; keep or enhance to 0.6s)
- [ ] **Explanation Fade-In:** Add a gentle 0.3s fade-in (currently instant)
- [ ] **Wrong Answer Shake:** If wrong selection, add a subtle shake (like Sum Sprint's `btShake` animation)
- [ ] **Correct Answer Pulse:** Add a 0.4s pulse or glow on the correct answer button when revealed
- [ ] **Card Transitions:** Stagger option button reveals (delay each by 50–100ms for visual interest)

### 7.3 Haptic & Sensory

- [ ] **Button Press Haptic:** Light haptic feedback on option selection (iOS: UIImpactFeedback .light, Android: HapticFeedback)
- [ ] **Correct Answer Haptic:** Stronger haptic on correct answer (medium impact)
- [ ] **Wrong Answer Haptic:** Double-tap pattern on wrong answer
- [ ] **Progress Bar Haptic:** Tiny haptic when advancing to next riddle

### 7.4 Accessibility & Keyboard

- [ ] **ARIA Labels:** 
  - Add `role="group"` to options container
  - Add `aria-label="Option A"`, `aria-label="Option B"` etc. to buttons
  - Add `aria-live="polite"` to explanation box for screen readers
  - Add `aria-current="step"` to progress bar
- [ ] **Keyboard Navigation:**
  - Arrow keys (Up/Down or Left/Right) to cycle through options
  - Enter/Space to select
  - Tab to navigate buttons in order
  - Home/End to jump to first/last option
- [ ] **Focus Ring:** Visible focus outline on all buttons (`:focus-visible`), color `#ff2bd6` with 2px solid
- [ ] **Color Contrast:** Verify all text meets WCAG AA (4.5:1 for body, 3:1 for UI); test red/green colorblind simulation
- [ ] **Screen Reader Support:** Test with NVDA, JAWS, or VoiceOver; ensure correct answer feedback is announced

### 7.5 Difficulty & Progression

- [ ] **Difficulty Curve:** Ensure riddles 1–2 are easier, 3–5 progressively harder
- [ ] **Hint System (Optional):**
  - Add a "Tap hint" button (like Brainle) that reveals a clue without spoiling
  - Store hints in riddle data: `hint: "Think about movement..."`
  - Limit hints to 1 per riddle (or all hints available)
  - Hint reveal does not affect score
- [ ] **Time Tracking (Optional):** Measure time-to-answer for each riddle (psychology research shows timing patterns)

### 7.6 Share & Social Features

- [ ] **Enhanced Share:** Current share text works (e.g., "BrainTap · Tap Teasers\n4/5 riddles cracked\n\nbraintap.app/games"), ensure it copies to clipboard
- [ ] **Social Emoji Encoding:** Optionally encode results as emoji (e.g., 🟩 for correct, 🟥 for wrong, but spoiler-free)
  - Example: `4 correct, 1 wrong` → Show a grid-based visual without revealing which riddles were missed
  - OR: Simple "5 correct" without per-riddle breakdown to avoid spoilers
- [ ] **Share Tracking:** Log shares via analytics; track click-through rate
- [ ] **Replay Discouragement:** After first play, show "Replaying today's riddles" label (already in prototype); consider opacity/mute to de-emphasize replays

### 7.7 State & Persistence

- [ ] **Daily Completion Tracking:** Store `doneT` flag (today's date) to show "Replaying" message on revisit
- [ ] **Score History:** Log all play sessions: date, score, time-to-completion
- [ ] **Streak Tracking:** Count consecutive days of play (if desired)
- [ ] **Backend Sync:** POST result to server; store in player progress table

### 7.8 Error Handling & Edge Cases

- [ ] **No Internet:** Gracefully degrade if daily riddle fetch fails; cache riddles locally or serve embedded fallback
- [ ] **Rapid Clicking:** Prevent double-submission if player clicks option twice in quick succession (already handled by `st.answered` flag)
- [ ] **Back Button:** If user navigates back mid-game, prompt "Are you sure? Progress will be lost"
- [ ] **Timezone Handling:** Daily riddle should reset at UTC midnight (current code uses `Date.now() / 864e5`, which is correct)
- [ ] **Missing Data:** If riddle object is malformed, log error and skip to next riddle or show fallback message

### 7.9 Visual Enhancements

- [ ] **Dark Mode:** Prototype is dark by default (good); ensure light mode variant exists if site offers theme toggle
- [ ] **Glassmorphism (Optional):** Consider frosted-glass effect on riddle card (blur + semi-transparency backdrop)
- [ ] **Gradient Accents:** Explore bolder gradients on progress bar or buttons for visual impact
- [ ] **Icon Support:** Add small icons next to correct/wrong labels (✓, ✗, 💡)
- [ ] **Riddle Icon/Illustration:** Optional: small decorative icon or illustration on riddle cards (e.g., light bulb for "Aha")

### 7.10 Performance

- [ ] **Code Splitting:** Lazy-load riddle data (if bank is large); only fetch current + next riddle
- [ ] **CSS-in-JS Optimization:** If using styled-components or Tailwind, ensure no unused styles ship
- [ ] **Animation Performance:** Use `will-change: transform` on animated elements; avoid repaints
- [ ] **Mobile Performance:** Profile on low-end devices (Moto G class); aim for <2.5s to interactive
- [ ] **Bundle Size:** Minify and gzip; target <50KB for game logic

### 7.11 Testing Checklist

- [ ] **Unit Tests:** Validate riddle data schema, answer scoring logic, state transitions
- [ ] **E2E Tests:** Full game flow (load → answer all 5 → see results → share)
- [ ] **Visual Regression:** Screenshot tests for each state (unanswered, correct, wrong, final results)
- [ ] **Localization (Future):** Prepare data structure for i18n (separate riddle/option/why into translatable keys)
- [ ] **A/B Testing:** Test different button colors, explanation lengths, hint availability

---

## 8. Implementation Notes for Developers

### 8.1 React/Next.js Conversion

The prototype is written in a custom "DC" language interpreted by `support.js`. For production in React/Next.js:

1. **Component Structure:**
   ```
   src/games/TapTeasers/
   ├── TapTeasers.tsx          // Main game component
   ├── RiddleCard.tsx          // Single riddle card
   ├── AnswerButton.tsx        // Option button with states
   ├── ExplanationBox.tsx      // Reveal box
   ├── ProgressBar.tsx
   ├── ResultsModal.tsx        // End-game modal
   └── useTapTeasers.ts        // Game logic hook
   ```

2. **State Management:**
   - Use `useState` for riddle index, score, answered flag
   - Use `useEffect` for animations
   - Consider `useReducer` for complex state if multiple games share logic

3. **Styling:**
   - Option A: Tailwind CSS (for consistency with other games)
   - Option B: Styled-components (matches prototype's inline styles)
   - Option C: CSS Modules (scoped styles, no conflicts)

4. **Data Source:**
   - Fetch daily riddles from API endpoint: `GET /api/games/teasers/daily`
   - Cache in localStorage with date key
   - Include game ID and date in request to validate consistency

5. **Mobile Responsiveness:**
   - Use `max-w-[520px]` container width (Tailwind)
   - Responsive font sizes: `text-sm md:text-base lg:text-lg`
   - Touch-friendly button sizing

### 8.2 API Contract

**Fetch Daily Riddles**
```
GET /api/games/teasers/daily
Response:
{
  date: "2025-01-15",
  riddles: [
    {
      q: "...",
      opts: ["...", "...", "...", "..."],
      a: 0-3,
      why: "...",
      hint?: "..." // Optional
    },
    // ... 5 riddles total
  ]
}
```

**Submit Result**
```
POST /api/games/teasers/result
Body:
{
  date: "2025-01-15",
  score: 0-5,
  timeTaken: 120,  // seconds
  answers: [0, 1, 1, 3, 2]  // Selected indices
}
```

### 8.3 CSS Class Reference

Use these class names for consistent button styling across games:

- `.bt-primary` — Primary action button (gradient, elevated)
- `.bt-ghost` — Secondary button (minimal, outlined)
- `.bt-rise` — Entrance animation (fade + slide up)

Keyframes to include in global styles:

```css
@keyframes btRise {
  0% { transform: translateY(16px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes btShake {
  10%, 90% { transform: translateX(-2px); }
  20%, 80% { transform: translateX(4px); }
  30%, 50%, 70% { transform: translateX(-7px); }
  40%, 60% { transform: translateX(7px); }
}
```

### 8.4 Localization Keys

Prepare for translation:

```javascript
const i18n = {
  labels: {
    gameTitle: "Tap Teasers",
    riddleLabel: "RIDDLE",
    nextButton: "Next riddle →",
    resultsButton: "See results →",
    correct: "✓ NICE",
    wrong: "💡 THE AHA",
    complete: "RIDDLES COMPLETE"
  },
  resultMessages: {
    perfect: "Flawless lateral thinking.",
    good: "Sharp instincts.",
    learning: "The aha takes practice."
  }
};
```

---

## 9. Summary

**Tap Teasers** is a daily lateral-thinking riddle quiz that teaches creative problem-solving through a reveal-and-learn mechanic. The 5-riddle structure is fast-paced, visually polished with a magenta/pink color accent, and designed for quick daily engagement.

**Key production enhancements** focus on mobile responsiveness, keyboard/accessibility support, subtle animations (explanation fade, card transitions), and a curated 365+ riddle bank with daily rotation.

The game does **not** require level generation or complex solvability algorithms—it relies on a pre-curated, human-reviewed riddle database that ensures quality and correctness.

