# Neural Connections – Production Specification

## Game Overview

**Title:** Neural Connections  
**Game ID:** connections  
**Type:** Daily Puzzle (NYT Connections style)  
**Duration:** ~5–10 minutes  
**Difficulty:** Medium (requires pattern recognition and lateral thinking)

Neural Connections challenges players to identify hidden connections between sixteen terms and group them into four categories. Each group must be exactly four items that share a common semantic or thematic link. Players have four mistakes before losing; correct guesses reveal the category and remove those tiles.

---

## Core Mechanics & Rules

### Win/Loss Conditions

- **WIN:** Successfully group all four categories (all 16 terms cleared) before reaching 4 mistakes.
- **LOSS:** Player makes 4 incorrect guesses (mistakes). On the 4th mistake, the puzzle is immediately over; remaining unsolved categories are revealed.

### Scoring & Mistakes

- **Mistakes Tracker:** Display a visual row of 4 circles; filled circles represent mistakes incurred.
  - Color: Filled = `rgba(226,234,255,.7)` (light), Unfilled = `rgba(255,255,255,.12)` (dim).
  - Update immediately upon failed submission.
- **Correct Guess Reward:** No points awarded per se, but reveals category with celebratory animation.
- **Tie-breaker Logic:** If player runs out of guesses mid-puzzle, reveal remaining categories without penalty (for transparency).

### Round Structure

1. **Initialization:** 
   - Load today's puzzle (seeded by date for consistent daily experience).
   - Display all 16 terms in a shuffled 4×4 grid.
   - Player has 4 mistakes available.

2. **Playing Phase:**
   - Player selects up to 4 tiles by tapping/clicking.
   - Selected tiles highlight and lock into selection.
   - Player can deselect individual tiles or clear entire selection.
   - Once 4 tiles selected, Submit button becomes active and clickable.
   - Player submits guess.

3. **Feedback & Validation:**
   - If guess matches a category (all 4 tiles are correct):
     - ✓ Category row appears above grid with label, color, and words.
     - Matched tiles disappear.
     - Grid reflows to show remaining tiles.
     - "One away" detection not relevant here (exact match required).
   - If guess is close (3 of 4 correct):
     - Flash message: "So close — one away"
     - Tiles shake (btShake animation, 0.5s).
     - Increment mistake counter.
   - If guess is incorrect (0–2 matches):
     - Flash message: "Not a group"
     - Tiles shake.
     - Increment mistake counter.
   - If 4 mistakes reached:
     - Game ends immediately.
     - All remaining categories are revealed below grid.
     - Player cannot continue.

4. **End State:**
   - All four categories solved → Victory screen with emoji grid, share button, insight, and "Back to today" button.
   - 4 mistakes reached → Defeat screen showing mistakes made and remaining categories revealed.

---

## UI Layout & Components

### Screen Layout

```
┌─────────────────────────────────────────┐
│ ← Today              Neural Connections  │  (Header)
│                  CREATE FOUR GROUPS OF   │
│                        FOUR             │
├─────────────────────────────────────────┤
│ [Message: "So close — one away"]        │  (Message area)
├─────────────────────────────────────────┤
│ [Solved categories appear here]         │  (Solved row 1)
│ [Solved categories appear here]         │  (Solved row 2)
├─────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┬───┐ │
│  │ DOPAMINE │ SEROTON. │ CORTISOL │...│  (4×4 grid)
│  ├──────────┼──────────┼──────────┼───┤
│  │...       │...       │...       │...│
│  └──────────┴──────────┴──────────┴───┘
├─────────────────────────────────────────┤
│ Mistakes ● ● ○ ○                        │  (Mistake tracker)
├─────────────────────────────────────────┤
│ [Shuffle] [Deselect all] [Submit]       │  (Action buttons)
└─────────────────────────────────────────┘
```

### Component Specifications

#### Header
- **Back Button ("← Today"):**
  - Text: "← Today"
  - Style: JetBrains Mono, 12px, color `rgba(226,234,255,.6)`
  - Action: Navigate home (confirm unsaved progress will be lost)
- **Title:**
  - Text: "Neural Connections"
  - Style: Space Grotesk, 600, 18px, color `#f3f7ff`
- **Subtitle:**
  - Text: "CREATE FOUR GROUPS OF FOUR"
  - Style: JetBrains Mono, 10.5px, letter-spacing 0.1em, color `#9fe9ff`

#### Message Area
- **Element ID:** `conn-msg`
- **Min Height:** 22px
- **Font:** JetBrains Mono, 12.5px, letter-spacing 0.04em, color `#9fe9ff`
- **Content:** Displays feedback (empty by default, populated on guess, clears after 1.8s)
  - Examples: "So close — one away", "Not a group", "Come back tomorrow for a new puzzle"

#### Solved Categories Display
- **Element ID:** `conn-solved`
- **Layout:** Flex column, gap 8px
- **Per Category Row:**
  - **Background:** Category color (one of: `#ffb020`, `#7CF5C4`, `#00e5ff`, `#ff2bd6`)
  - **Border Radius:** 12px
  - **Padding:** 12px
  - **Label:**
    - Font: JetBrains Mono, 11px, letter-spacing 0.14em, color `rgba(4,6,15,.7)`, font-weight 600
    - Text: Category label in uppercase (e.g., "NEUROTRANSMITTERS")
  - **Words:**
    - Font: Space Grotesk, 600, 15px, color `#04060f`, margin-top 3px
    - Text: Words joined by " · " (e.g., "DOPAMINE · SEROTONIN · CORTISOL · OXYTOCIN")
  - **Animation:** btSolve (0.5s, scale pulse from 1 → 1.06 → 1)

#### Game Grid
- **Element ID:** `conn-grid`
- **Layout:** CSS Grid, 4 columns, 8px gap
- **Tile Dimensions:** aspect-ratio 1.35:1 (slightly wider than square)
- **Tile Count:** 16 (dynamically updated as categories are solved)
- **Tile Styling:**
  - **Default (unselected):**
    - Background: `rgba(255,255,255,.055)`
    - Color: `#e7eeff`
    - Border: none
    - Border Radius: 11px
    - Font: Space Grotesk, 600, dynamic font-size (see below), letter-spacing 0.01em, text-transform uppercase
    - Padding: 4px
    - Line Height: 1.1
    - Transition: 0.12s (background 0.2s, border-color 0.2s, color 0.2s)
  - **Selected:**
    - Background: `linear-gradient(160deg,#1b2a52,#243a6e)`
    - Color: `#eafcff`
    - Border: inset 0 0 0 2px `rgba(0,229,255,.55)`
    - (Other properties same as default)
  - **Font Size Scaling by Word Length:**
    - ≥9 letters: 12px
    - ≥7 letters: 13.5px
    - <7 letters: 15px
  - **Active State:** scale(0.95) on click
  - **Error State (shake on wrong guess):** btShake animation (0.5s)

#### Mistake Tracker
- **Label:** "Mistakes" in JetBrains Mono, 11.5px, color `rgba(226,234,255,.55)`
- **Indicators:** 4 circles, each:
  - Diameter: 12px
  - Border Radius: 50%
  - Gap: 7px
  - Filled (mistakes incurred): `rgba(226,234,255,.7)`
  - Unfilled (available): `rgba(255,255,255,.12)`
  - Updated immediately upon mistake

#### Action Buttons
- **Layout:** 3-button row, gap 10px, margin-top 22px
- **Shuffle Button (ID: `conn-shuffle`):**
  - Text: "Shuffle"
  - Class: `bt-ghost`
  - Font: Space Grotesk, 500, 14px, color `#eaf1ff`
  - Border: 1px solid `rgba(255,255,255,.2)`
  - Background: `rgba(255,255,255,.04)`
  - Border Radius: 100px
  - Padding: 11px 22px
  - Action: Reshuffle remaining tiles (disabled if game over)
- **Deselect All Button (ID: `conn-deselect`):**
  - Text: "Deselect all"
  - Same styling as Shuffle
  - Action: Clear selection (disabled if game over)
- **Submit Button (ID: `conn-submit`):**
  - Text: "Submit"
  - Font: Space Grotesk, 600, 14px
  - Border Radius: 100px
  - Padding: 11px 26px
  - **Inactive State:** (0–3 tiles selected, or game over)
    - Color: `rgba(226,234,255,.4)`
    - Border: 1px solid `rgba(255,255,255,.14)`
    - Background: `rgba(255,255,255,.05)`
    - Opacity: 0.5
  - **Active State:** (exactly 4 tiles selected, game not over)
    - Color: `#04060f`
    - Border: transparent
    - Background: `linear-gradient(118deg,#00e5ff,#7b8cff)`
    - Opacity: 1.0
  - Transition: all properties over 0.25s

---

## Game States & Transitions

```
┌─────────────┐
│  IDLE/INIT  │ (Game loaded, tiles displayed)
└──────┬──────┘
       │ Player selects 0–3 tiles
       ▼
┌─────────────────────┐
│  PLAYING/SELECT     │ (Player selecting 1–3 tiles, Submit inactive)
└──────┬──────────────┘
       │ Player selects 4th tile
       ▼
┌─────────────────────┐
│  READY_TO_SUBMIT    │ (Exactly 4 tiles, Submit active)
└──────┬──────────────┘
       │ Player taps Shuffle/Deselect
       ├────► Back to PLAYING/SELECT
       │
       │ Player taps Submit
       ▼
┌─────────────────────────────────────┐
│  VALIDATING                         │ (Server-side or client logic)
└──────┬────────────────┬─────────────┘
       │ Exact match     │ Not a match (or 3 of 4)
       ▼                 ▼
┌────────────┐    ┌────────────────────┐
│  CORRECT   │    │  ERROR/SHAKE       │
└──────┬─────┘    └────────┬───────────┘
       │                   │ Increment mistakes
       │ Solved all 4?     │ Render updated tracker
       │      ↓            │
       │     YES: ▼        │ 4 mistakes now?
       │    ┌──────┐       │      ↓
       │    │  WIN │       │      YES: ▼
       │    │ MODAL│       │    ┌────────┐
       │    └──────┘       │    │  LOSS  │
       │                   │    │ REVEAL │
       │                   │    │ MODAL  │
       │                   │    └────────┘
       │                   │
       │                   └─→ Back to PLAYING/SELECT
       │
       └─ Back to PLAYING/SELECT

(Game Over states show modals preventing further play)
```

---

## Interactions

### Touch/Click Interactions

- **Tile Selection:**
  - **Action:** Tap/click a tile.
  - **Behavior:** 
    - If unselected, add to selection (max 4).
    - If selected, remove from selection.
    - Immediately update tile visual (background, border, text color).
  - **Feedback:** Scale down 0.95 briefly on press.

- **Shuffle Button:**
  - **Action:** Tap/click "Shuffle".
  - **Behavior:** Reshuffle remaining tiles using seeded RNG (preserve seed for consistency).
  - **Disabled:** If game is over.

- **Deselect All Button:**
  - **Action:** Tap/click "Deselect all".
  - **Behavior:** Clear all selected tiles (entire selection set becomes empty).
  - **Disabled:** If game is over.

- **Submit Button:**
  - **Action:** Tap/click "Submit".
  - **Precondition:** Exactly 4 tiles selected and game not over.
  - **Behavior:** Validate guess, apply feedback, update game state.
  - **Visual:** Only clickable (opacity 1.0) when precondition met.

- **Back Button ("← Today"):**
  - **Action:** Tap/click "← Today".
  - **Behavior:** Navigate to home/hub screen. (Consider: confirm dialog if puzzle not yet completed?)

### Keyboard Interactions

The prototype does not implement keyboard shortcuts for tile selection (unlike Idea Weaver). However, for production:

- **Optional:** Consider number/arrow keys to select tiles or press Enter to submit (for accessibility).
- **Tab Navigation:** Ensure all buttons are keyboard-focusable (tab order).
- **Enter Key on Submit Button:** Naturally submit when focused.

### Mobile Gestures

- **Tap:** All primary interactions (select tile, press button).
- **Long Press:** Consider a "hint" gesture (not in prototype; optional enhancement).
- **Swipe:** Not used in this game.

---

## Animations & Feedback

### Success Animations

1. **Category Solve (btSolve):**
   - **Duration:** 0.5s
   - **Timing Function:** ease (default)
   - **Animation Curve:** scale 1 → 1.06 → 1
   - **Applied To:** Solved category row as it appears above grid.
   - **Effect:** Satisfying "pop" that draws attention to newly completed category.

2. **Tile Disappearance:**
   - Tiles matching solved category fade/disappear (implicit via DOM removal + reflow).

### Error Animations

1. **Wrong Guess Shake (btShake):**
   - **Duration:** 0.5s
   - **Applied To:** Tiles in the incorrect guess.
   - **Animation Curve:**
     ```
     10%, 90%: translateX(-2px)
     20%, 80%: translateX(4px)
     30%, 50%, 70%: translateX(-7px)
     40%, 60%: translateX(7px)
     ```
   - **Effect:** Visual feedback that guess was invalid; player immediately understands failure.
   - **Timeout:** Animation cleared after 520ms.

### Message Flash

- **Duration:** 1.8s
- **Text Inserted:** "So close — one away" or "Not a group"
- **Color:** `#9fe9ff` (cyan)
- **Behavior:** Displays in message area, auto-clears after 1.8s if no new message.

### Feedback Timing

- **Immediate (on submit):** Tile shake, message display.
- **Delayed (0.42s):** Victory modal (allows time for visual feedback before interruption).
- **Delayed (0.52s):** Defeat modal (reveals remaining categories, then shows modal).

---

## End-of-Game Modals

### Victory Modal

**Trigger:** Player solves all 4 categories.

**Content:**
```
┌─────────────────────────────────┐
│  PUZZLE COMPLETE               │ (cyan, JetBrains Mono, 11px, letter-spacing 0.2em)
│                                │
│  Solved!                        │ (or "Flawless." if 0 mistakes)
│  (Space Grotesk, 600, 30px)    │
│                                │
│  ┌──────────────────────────────┤
│  │ 🟨🟩🟦🟪                      │ Emoji grid (share preview)
│  │ 🟨🟩🟦🟪                      │
│  │ 🟨🟩🟦🟪                      │
│  │ 🟨🟩🟦🟪                      │
│  └──────────────────────────────┘
│                                │
│  ┌──────────────────────────────┤
│  │ 🧠 BRAIN INSIGHT            │
│  │                              │
│  │ "[Category Name]" — [Insight]
│  └──────────────────────────────┘
│                                │
│ [Share result button (cyan→blue)] │
│ [Back to today button (ghost)]    │
└─────────────────────────────────┘
```

**Details:**
- **Title:** "PUZZLE COMPLETE" (cyan `#00e5ff`)
- **Large Text:** "Solved!" or "Flawless." (Space Grotesk, 600, 30px, `#f3f7ff`)
- **Emoji Grid:** Pre-rendered `<pre>` element showing colored emoji squares representing each guess (color mapping: `#ffb020` → 🟨, `#7CF5C4` → 🟩, `#00e5ff` → 🟦, `#ff2bd6` → 🟪)
  - Each row of history shown on a separate line (4 guesses = 4 lines, 4 emojis per line).
  - Font: JetBrains Mono, 18px, line-height 1.25, letter-spacing 2px
- **Brain Insight Box:**
  - Background: `rgba(0,229,255,.06)`
  - Border: 1px solid `rgba(0,229,255,.18)`
  - Border Radius: 14px
  - Padding: 16px
  - Label: "🧠 BRAIN INSIGHT" (JetBrains Mono, 10px, letter-spacing 0.16em, color `#9fe9ff`)
  - Text: Category insight (14px, line-height 1.55, color `rgba(226,234,255,.82)`)
- **Share Button:**
  - Text: "Share result"
  - Class: `bt-primary`
  - Style: Space Grotesk, 600, 15px, color `#04060f`, background `linear-gradient(118deg,#00e5ff,#7b8cff 52%,#ff2bd6)`
  - Full width, border-radius 12px, padding 14px
  - Action: Copy/share string (formatted below)
- **Back Button:**
  - Text: "Back to today"
  - Class: `bt-ghost`
  - Margin-top: 10px
  - Action: Navigate home/hub

**Share String Format:**
```
BrainTap · Neural Connections
Solved · [mistakes] mistake[s]

[emoji grid]
braintap.app/games
```

Example:
```
BrainTap · Neural Connections
Solved · 1 mistake

🟨🟨🟨🟨
🟩🟩🟩🟩
🟦🟦🟦🟦
🟪🟪🟪🟪
braintap.app/games
```

### Defeat Modal

**Trigger:** Player makes 4th mistake.

**Content:** Similar to victory modal but with:
- **Title:** "OUT OF MISTAKES" (pink/red `#ff7a9c`)
- **Large Text:** "So close." (Space Grotesk, 600, 30px)
- **Emoji Grid:** Shows all guesses made (may be fewer than 4 rows if less than 4 mistakes before hitting 4th).
- **Brain Insight Box:** Same format, but insight is from a remaining (unsolved) category or generic brain-related tip.
- **Buttons:** Same as victory.
- **Share String:**
```
BrainTap · Neural Connections
Missed it

[emoji grid]
braintap.app/games
```

---

## Embedded Game Data

### Category Definitions

All four categories are hardcoded in the `initConnections()` function. Each category has:
- **label** (uppercase)
- **color** (hex)
- **words** (array of 4 strings, uppercase)
- **insight** (educational/fun brain science fact)

```javascript
const groups=[
  {
    label:'NEUROTRANSMITTERS',
    color:'#ffb020',
    words:['DOPAMINE','SEROTONIN','CORTISOL','OXYTOCIN'],
    insight:'These chemical messengers tune mood, stress and bonding across synapses.'
  },
  {
    label:'BRAINWAVE BANDS',
    color:'#7CF5C4',
    words:['DELTA','THETA','ALPHA','GAMMA'],
    insight:'EEG frequency bands, from deep-sleep Delta to high-focus Gamma.'
  },
  {
    label:'MEMORY TYPES',
    color:'#00e5ff',
    words:['WORKING','EPISODIC','SENSORY','SEMANTIC'],
    insight:'Distinct systems: a mental scratchpad, life events, raw senses, and facts.'
  },
  {
    label:'COGNITIVE BIASES',
    color:'#ff2bd6',
    words:['ANCHORING','HALO','RECENCY','FRAMING'],
    insight:'Systematic shortcuts that quietly skew judgement and decisions.'
  }
];
```

---

## Daily Puzzle Generation & Randomization

### Seeding for Daily Consistency

The game uses a **date-based seed** to ensure the same puzzle appears for all players on a given day:

```javascript
let seed = Math.floor(Date.now() / 864e5) * 2654435761 % 2147483647;
const rnd = () => { 
  seed = (seed * 48271) % 2147483647; 
  return seed / 2147483647; 
};
```

**Explanation:**
- `Date.now() / 864e5` = days since epoch (86400000 ms/day).
- `Math.floor(...)` gives integer day.
- Multiply by large prime and mod to create deterministic seed per day.
- `rnd()` uses Linear Congruential Generator (LCG) to produce pseudo-random floats [0,1).

### Shuffle Algorithm

```javascript
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
```

**Behavior:** Fisher-Yates shuffle using seeded RNG (not cryptographic).  
**Usage:** `st.tiles = shuffle(groups.flatMap(g => g.words));` creates random tile order.

### Level Bank Requirements

**CRITICAL DECISION:** Does production need a pre-generated level bank or procedural generation?

**Recommendation:** **PRE-GENERATED LEVEL BANK** (strongly preferred for daily games).

**Rationale:**
1. **Consistency:** Ensures puzzle is vetted before release (no accidentally unsolvable or ambiguous levels).
2. **Variety Control:** Curate categories to maintain difficulty curve and educational value.
3. **Replayability Across Years:** If same seed formula reused, players can replay old puzzles; bank gives explicit control.
4. **Quality:** Human editorial review ensures categories are clever but fair (no obscure/niche terms).

### Level Bank Specification

**Size:** Minimum 365+ levels (daily puzzle for a year + buffer for holidays, events).

**Data Structure per Level:**

```javascript
{
  id: "conn-2024-06-17",
  date: "2024-06-17",
  groups: [
    {
      label: "NEUROTRANSMITTERS",
      color: "#ffb020",
      words: ["DOPAMINE", "SEROTONIN", "CORTISOL", "OXYTOCIN"],
      insight: "These chemical messengers..."
    },
    // ... 3 more groups
  ],
  difficulty: "medium",     // "easy", "medium", "hard"
  tags: ["neuroscience", "chemistry", "psychology"]
}
```

**Storage Options:**
- JSON file (simple, static).
- Database (Supabase, Firebase) with admin CMS for scheduling.
- Hybrid: Static JSON for next ~90 days, dynamically load from DB.

**Generation Workflow:**
1. Create puzzle via editorial/admin panel.
2. Validate solvability (see below).
3. Schedule release date.
4. Push to production (static or live DB).

---

## Solvability Validation

### Algorithm

For each level, validate:

1. **Each category must have exactly 4 words:** Verify `group.words.length === 4`.
2. **No duplicate words across categories:** Check that union of all words has length 16 with no overlaps.
3. **Exact-match grouping only:** Ensure each group's 4 words are semantically/thematically linked such that:
   - No subset of 3 words + any word from another category could form an alternative valid group.
   - No ambiguity (e.g., a word that fits multiple categories).

### Validation Procedure

**Manual Editorial Review (Primary):**
1. Read each category label and its four words.
2. Verify the connection is clear and unambiguous.
3. Ask: "Could a player reasonably think word X belongs to group Y instead of group Z?"
4. Test: Have 3–5 people attempt the puzzle; all should solve without ambiguity.

**Automated Checks (Secondary):**
```javascript
function validateLevel(level) {
  const allWords = new Set();
  let errors = [];
  
  if (level.groups.length !== 4) {
    errors.push("Must have exactly 4 groups");
  }
  
  level.groups.forEach((g, i) => {
    if (!g.label || g.label.length === 0) {
      errors.push(`Group ${i}: missing label`);
    }
    if (!Array.isArray(g.words) || g.words.length !== 4) {
      errors.push(`Group ${i}: must have exactly 4 words`);
    }
    g.words.forEach(w => {
      if (allWords.has(w)) {
        errors.push(`Duplicate word: ${w}`);
      }
      allWords.add(w);
    });
    if (!g.color || !/^#[0-9a-f]{6}$/.test(g.color)) {
      errors.push(`Group ${i}: invalid color`);
    }
    if (!g.insight || g.insight.length === 0) {
      errors.push(`Group ${i}: missing insight`);
    }
  });
  
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
```

**Ambiguity Testing (Advanced):**
- Generate all possible 4-word subsets (969 combinations).
- For each subset, ask: "Is this a plausible alternative grouping?"
- If yes, mark as ambiguous; require category redesign.

### No Single-Solution Guarantee

**Unlike Sudoku:** This game does NOT require a unique solution (i.e., only one valid way to partition the 16 words into 4 groups). However, it DOES require:
- Each of the 4 intended groups is semantically coherent.
- No plausible alternative grouping exists.

Example of acceptable ambiguity:
- Group 1: DOPAMINE, SEROTONIN, ADRENALINE, CORTISOL (neurotransmitters).
- Group 2: SAD, HAPPY, ANGRY, CALM (emotions).
- If a word like DOPAMINE could plausibly refer to emotion, disambiguate via context or change the word.

---

## Color & Visual Design

### Color Palette

```
Primary Accent (Cyan):        #00e5ff
Secondary Accent (Teal):      #7CF5C4
Tertiary Accent (Orange):     #ffb020
Error/Pink Accent:            #ff2bd6, #ff7a9c
Text Primary:                 #f3f7ff
Text Secondary:               #e7eeff
Text Tertiary:                #9fe9ff, rgba(226,234,255,.x)
Background (Dark):            #03040b (body), #04060f (contrast)
Subtle Overlay:               rgba(255,255,255,.05) – .12)
```

### Typography

- **Primary UI Font:** Space Grotesk (Google Fonts)
  - Weights: 400, 500, 600, 700
  - Usage: Titles, buttons, main labels
- **Monospace Font:** JetBrains Mono (Google Fonts)
  - Weights: 400, 500, 600
  - Usage: Subtitles, progress labels, code/stats, share preview

### Per-Category Color Assignments

```
Neurotransmitters → #ffb020 (orange/gold)
Brainwave Bands   → #7CF5C4 (teal/mint)
Memory Types      → #00e5ff (cyan)
Cognitive Biases  → #ff2bd6 (magenta/pink)
```

---

## Production Enhancements Over Prototype

The prototype is functional but requires refinement for production. Here are must-have and nice-to-have upgrades:

### Must-Have (Critical for Release)

1. **Responsive Design:**
   - Test and optimize on mobile (320px–375px width).
   - Ensure tiles don't overflow; scale font sizes and grid gaps for small screens.
   - Tap targets ≥44px (WCAG) on mobile.

2. **Accessibility (ARIA + Keyboard):**
   - Add `role="button"` to all tiles and action buttons.
   - Add `aria-label` to each tile (e.g., "DOPAMINE, unselected").
   - Add `aria-pressed="true|false"` to tiles to reflect selection state.
   - Implement keyboard navigation: Tab to cycle through tiles, Space/Enter to select, Escape to deselect all.
   - Announce message updates to screen readers.

3. **Error Handling:**
   - Graceful fallback if puzzle data fails to load.
   - Display "Puzzle unavailable" message if data is missing.

4. **Haptic Feedback (Mobile):**
   - Subtle haptic on tile selection (light tap).
   - Stronger haptic on correct guess (medium).
   - Distinct haptic on error (double-tap or buzz).
   - Use navigator.vibrate() for Android, UIFeedbackGenerator for iOS.

5. **Animations Performance:**
   - Use `will-change: transform` on tiles to optimize animations.
   - Ensure btShake, btSolve run at 60 FPS on mid-range devices.
   - Respect `prefers-reduced-motion` (prototype has this; verify it works).

6. **Today-Already-Played State:**
   - Prototype shows "Come back tomorrow for a new puzzle" and disables game.
   - Ensure user can still view their yesterday's result in replay mode.

### Nice-to-Have (Polishing)

7. **Hint System (Optional):**
   - "Reveal one category" button (limited uses, e.g., 1 per day).
   - "Show connections for a word" (hover/long-press tooltip).

8. **Undo/Take-Back (Optional):**
   - Allow player to undo the last guess (revert mistake counter).
   - Limited to 1 per game or unlimited (design choice).

9. **Difficulty Indication:**
   - Show difficulty badge ("Easy", "Medium", "Hard") before starting.
   - Use difficulty to tune hint availability.

10. **Share Enhancements:**
    - Clipboard copy + notification ("Copied!").
    - Deep link to see puzzle solution (e.g., `braintap.app/games/connections/2024-06-17`).
    - Social media pre-fill (Twitter, Bluesky, etc.) with emoji grid.

11. **Sound/Audio (Optional):**
    - Subtle sound on correct guess (satisfying chime).
    - Error beep on wrong guess.
    - Mute button in settings.

12. **Daily Leaderboard/Stats (Engagement):**
    - Track best time to solve.
    - Show personal streak (days in a row without missing a day).
    - Aggregate statistics (total score, accuracy %).

13. **Visual Polish:**
    - Confetti or particle effect on solving all 4 categories (subtle, respects motion preference).
    - Glow/shadow enhancement on category rows as they appear.
    - Smooth transitions when grid reflows after a solve.

---

## Implementation Notes for Developers

### React/Next.js Conversion

The prototype uses a DC (custom framework) interpreter. For production rebuild in React/Next.js:

1. **Component Structure:**
   ```
   <ConnectionsGame>
     <Header />
     <MessageArea />
     <SolvedCategories />
     <TileGrid />
     <MistakeTracker />
     <ActionButtons />
   </ConnectionsGame>
   ```

2. **State Management:**
   - Use React hooks (useState, useContext) or Zustand for:
     - Selected tiles
     - Solved categories
     - Mistake count
     - Game over state
     - History (for emoji grid)

3. **Daily Persistence:**
   - Store played state in localStorage or backend.
   - Seed RNG based on date (same logic as prototype).
   - Load level data from JSON or API.

4. **Animations:**
   - Framer Motion or CSS transitions for btShake, btSolve.
   - Conditional rendering for solved categories (appear with animation).

5. **Theming:**
   - CSS variables or Tailwind for color palette.
   - Ensure dark mode is default (prototype uses dark theme).

### Level Data Integration

- **Option A (Static):** Import levels from JSON file, index by date.
- **Option B (Dynamic):** Fetch from Supabase/Firebase on page load.
- **Option C (Hybrid):** Preload next 30 days from JSON, sync with API for scheduling changes.

### Testing Checklist

- [ ] All 4 categories solvable in one attempt (full solve test).
- [ ] Invalid guess correctly detected and shaken (error test).
- [ ] Mistake counter increments (mistake test).
- [ ] Game over on 4 mistakes, remaining categories revealed (loss test).
- [ ] Victory modal appears with correct emoji grid (victory test).
- [ ] Shuffle reorders tiles (shuffle test).
- [ ] Deselect clears all tiles (deselect test).
- [ ] Mobile responsiveness (<640px width).
- [ ] Keyboard navigation (tab, space, enter).
- [ ] Screen reader announces selections and messages.
- [ ] Share string copies to clipboard (optional).
- [ ] Replay mode prevents new plays (doneC flag).

---

## Summary

**Neural Connections** is a polished daily puzzle game challenging players to recognize semantic/thematic groupings. The core mechanic is simple but satisfying: select 4 tiles, validate, and repeat until all categories are found or mistakes run out. Production requirements focus on responsiveness, accessibility, haptic feedback, and a pre-generated level bank (365+ validated puzzles) to ensure consistency and editorial control.

The game is educational (includes brain science insights), shareable (emoji grid), and replayable within a day (daily resets). With the enhancements outlined above, it will be a polished, inclusive, and engaging experience for all players.

