# BrainTap Games Platform – Production Specification

**Source:** `/design_src/BrainTap Games.dc.html` + `support.js` (Design Components)  
**Framework:** React/Next.js App Router (Target)  
**Date:** June 2026

---

## 1. Top Navigation Bar

**Structure:** Fixed, z-index: 50  
**Scroll Behavior:** Transparent background on scroll; border-bottom animates in on scroll.

### Components:

- **Logo / Brand** (left)
  - BrainTap Games logo (SVG gradient: cyan → magenta)
  - Text: "BRAINTAP GAMES" (Space Grotesk 600, 13.5px)
  - Links to home (anchor: #)

- **Main Nav Links** (center)
  - "Today" (text: #00e5ff, links to hub)
  - "Archive" (text: rgba(231,238,255,.5), anchor: #archive)
  - "Stats" (text: rgba(231,238,255,.5), anchor: #skills)
  - "Leaderboard" (text: rgba(231,238,255,.5), anchor: #leaderboard)
  - Font: JetBrains Mono, 12px, 0.04em letter-spacing

- **Right Side:**
  - **Streak Chip** (7-day example)
    - Border: 1px rgba(255,176,32,.3)
    - Background: rgba(255,176,32,.07)
    - Text: "7" days (id: nav-streak)
    - Color: #ffb020 (orange)
    - Icon: flame SVG
  
  - **Settings Button** (id: bt-settings-btn)
    - 32x32px, circular, gear icon
    - Opens settings modal on click
  
  - **Avatar** (32x32px)
    - Circular gradient: #00e5ff → #ff2bd6
    - Text: "A" (first letter, white)

---

## 2. Hub / Hero Section

**Max-width:** 1120px, centered padding 128px 32px 0

### Date Line & Headline:
- **Date**: "Tuesday · June 16" (id: hub-date)
  - Animated pulsing cyan dot
  - Font: JetBrains Mono, 11.5px, 0.26em letter-spacing, #9fe9ff
  
- **Headline**: "Tap into your mind, one puzzle a day."
  - Font: Space Grotesk 600, clamp(38px, 5.4vw, 68px), line-height 1.0
  - Second line gradient: #00e5ff → #86a3ff → #ff2bd6
  
- **Subheading**: "Fifteen science-backed brain games, one fresh challenge every day. Build a streak, level up your cognition, and see your mind sharpen."
  - Font: 17px, line-height 1.6, rgba(226,234,255,.6)
  - Max-width: 520px, centered

### 4-Stat Strip:
Grid: 4 columns, gap 14px, margin-top 44px

1. **Current Streak** (id: stat-streak)
   - Value: "7 days"
   - Color: #ffb020
   - Label: "CURRENT STREAK"

2. **Played Today** (id: stat-played)
   - Value: "0/14" (id: stat-total)
   - Color: #00e5ff
   - Label: "PLAYED TODAY"

3. **Avg Solve Time**
   - Value: "2:41"
   - Color: #86a3ff
   - Label: "AVG SOLVE"

4. **Global Rank**
   - Value: "#214"
   - Color: #ff2bd6
   - Label: "GLOBAL RANK"

Each stat: background gradient (180deg, rgba(15,23,46,.55) → rgba(8,12,26,.5)), 1px border rgba(255,255,255,.08), border-radius 16px, padding 18px 20px

---

## 3. Today's Puzzles Grid

**Layout:** 3-column grid, gap 18px, margin-top 26px  
**Section ID:** game-grid

### Header:
- Title: "TODAY'S PUZZLES"
- Subtitle: "Fifteen ready to play"
- Right: "Resets in HH:MM:SS" (id: reset-countdown)

### 15 Game Cards

Each card: `.bt-tile`, 230px min-height, flex column, click to play

#### Card Structure:
```
[icon (42x42)]  [category badge]
[title]         
[description] (flex: 1)
[time] [Play → button]
```

#### Game Cards (Complete List):

| # | Name | Category | Icon Color | Accent (bg) | Est. Time | Blurb |
|---|------|----------|-----------|-------------|-----------|-------|
| 1 | Neural Connections | VERBAL | #00e5ff | cyan | ~4 min | Group 16 terms into four hidden brain-science categories. |
| 2 | Synapse Wordle | VERBAL | #ff2bd6 | magenta | ~3 min | Guess the 5-letter mind word in six tries. Tap hints reveal a cognitive insight. |
| 3 | Mind Strands | VERBAL | #86a3ff | blue | ~6 min | Find the hidden words in a themed letter grid — including the BrainTap spangram. |
| 4 | Focus Forge | LOGIC · NONOGRAM | #ffb020 | gold | ~4 min | Solve the picross from the number clues to reveal today's hidden glyph. |
| 5 | Idea Weaver | CREATIVE · SPELL | #7CF5C4 | teal | ~5 min | Spell as many words as you can from seven letters — the center one is required. |
| 6 | Memory Vault | MEMORY · RECALL | #00e5ff | cyan | ~2 min | Watch the pattern light up, then rebuild it from memory. Each round adds a cell. |
| 7 | Tap Teasers | LATERAL · RIDDLE | #ff2bd6 | magenta | ~3 min | Five lateral-thinking riddles. Pick the answer, then unlock the aha. |
| 8 | Mini Sudoku | NUMBER · 6×6 | #9b8cff | purple | ~5 min | Fill the grid so every row, column and 2×3 box holds 1 to 6. Pure deduction. |
| 9 | Sum Sprint | NUMBER · SPEED | #7CF5C4 | teal | ~1 min | Tap numbers that add up to the target before the clock runs out. Sixty seconds. |
| 10 | Pips | NUMBER · DOMINOES | #ff9e3d | orange | ~3 min | Place and flip dominoes so every column's pips add up to its target. |
| 11 | 2048 | NUMBER · SPATIAL | #9b8cff | purple | ~5 min | Slide and merge matching tiles. Plan ahead to reach the 2048 tile. |
| 12 | Schulte Table | FOCUS · SPEED | #00e5ff | cyan | ~1 min | Tap 1 to 25 in order as fast as you can. Trains attention and peripheral vision. |
| 13 | Sequence Echo | MEMORY · RECALL | #ff2bd6 | magenta | ~2 min | Watch the colors and tones, then echo the growing sequence back. How far can you go? |
| 14 | Tile Slide | SPATIAL · 15-PUZZLE | #00e5ff | cyan | ~4 min | Slide the tiles to order them 1 to 15. Fewer moves, faster time — beat your best. |
| 15 | Reversi | STRATEGY · VS AI | #7CF5C4 | teal | ~6 min | Outflank the BrainTap AI to flip the board your colour. Claim the corners. |

#### Card Badge / Play Button States:
- **Unplayed**: "Play →" button with gradient background (game-specific)
- **Played Today**: Button shows "✓ Replay", background rgba(124,245,196,.18), text #7CF5C4
- **Completion Visual**: Tile gets inset shadow: "inset 0 2px 0 #7CF5C4", outer glow: "0 0 22px rgba(124,245,196,.08)"

#### Category Badge:
Font: JetBrains Mono, 9.5px, 0.12em letter-spacing, color matches accent, border 1px, border-radius 100px, padding 4px 9px

---

## 4. This Week's Rotation Strip

**Layout:** 7 columns (one per day), gap 10px  
**Section ID:** rotation

### Rotation Map (rotMap):
```javascript
{
  Mon: 'connections',
  Tue: 'brainle',
  Wed: 'strands',
  Thu: 'forge',
  Fri: 'weaver',
  Sat: 'vault',
  Sun: 'teasers'
}
```

### Day Card Structure:
- Today's entry is highlighted: border: 1px rgba(0,229,255,.35), background: rgba(0,229,255,.1) + rgba(255,43,214,.07), box-shadow: 0 0 22px rgba(0,229,255,.12), text "TUE · TODAY"
- Past/future: background rgba(15,23,46,.5), border: 1px rgba(255,255,255,.08)
- Each shows: day abbreviation, game name (Space Grotesk 600, 13.5px)
- Clickable; navigates to game screen

---

## 5. Your Brain Profile – Radar Chart & Skill Bars

**Section ID:** skills, scroll-margin-top: 90px  
**Layout:** Two-column grid (left: text, right: radar + bars)

### Left Column:
- **Label**: "YOUR BRAIN PROFILE" (JetBrains Mono, 11px, #9fe9ff)
- **Headline**: "Five skills, measured every day."
- **Description**: "Each game trains a different cognitive domain. We track your performance over time so you can watch the curve climb."
- **Stats**:
  - "↑ 12% this month" (badge, #9fe9ff)
  - "Top 14% globally" (badge, rgba(226,234,255,.55))

### Right Column (Card):
Background: linear-gradient(180deg, rgba(13,21,42,.6), rgba(8,12,26,.55)), border 1px rgba(255,255,255,.08), border-radius 20px, padding 28px

#### Radar Chart (Canvas id: skill-radar):
- 5-point radar polygon
- Center: 260x260 canvas (display 230x230)
- Skills plotted as (name, percentage, color):

```javascript
[
  ['Memory', 82, '#00e5ff'],
  ['Logic', 71, '#86a3ff'],
  ['Verbal', 90, '#ff2bd6'],
  ['Focus', 64, '#ffb020'],
  ['Speed', 77, '#7CF5C4']
]
```

- Radar rendering:
  - Background hexagon: rgba(255,255,255,.03)
  - Grid lines: rgba(255,255,255,.05)
  - Filled polygon: rgba(0,229,255,.15)
  - Vertices: 3px circles, color-matched per skill
  - Labels: centered text outside polygon

#### Skill Bars (id: skill-bars):
- Vertical stack, gap 14px
- Each bar: label (name), percentage (large text, skill color), subtle background bar
- Example HTML structure:
  ```html
  <div style="flex:1;display:flex;align-items:center;gap:12px;">
    <span style="color:skill_color;font-weight:600;">Memory</span>
    <div style="flex:1;height:6px;background:rgba(255,255,255,.06);border-radius:6px;overflow:hidden;">
      <div style="height:100%;width:82%;background:skill_color;"></div>
    </div>
    <span style="color:skill_color;font-weight:600;">82%</span>
  </div>
  ```

---

## 6. The Archive

**Section ID:** archive, scroll-margin-top: 90px  
**Layout:** 4-column grid, gap 14px

### Header:
- Label: "THE ARCHIVE"
- Title: "Never miss a day"
- Right link: "Browse all 248 →" (clickable, blue)

### Archive Items (Example Set):
Each card shows: accent dot, day abbreviation, game name, result, replay arrow

```
Connections  Mon  Solved → Replay
Wordle       Sun  3/6 → Replay
Strands      Sat  Solved → Replay
... (8 cards minimum shown)
```

- Cards are `.bt-tile` (clickable to replay that game)
- Background: rgba(15,23,46,.5)
- Border: 1px rgba(255,255,255,.07)
- Accent dot: per-game color with glow

---

## 7. Leaderboard Section

**Section ID:** leaderboard, scroll-margin-top: 90px  
**Layout:** 2-column grid

### Left Column: Today's Leaderboard
**Card ID:** leaderboard-list  
Background: linear-gradient(180deg, rgba(13,21,42,.6), rgba(8,12,26,.55))

Header: "Today's leaderboard" (left), "SYNAPSE WORDLE" (right, label)

**Leaderboard Rows** (5 entries shown):
```
1  quanta_owl      1/6  (#ffb020)
2  sera.codes      2/6  (#cdd8f0)
3  mind_drift      2/6  (#cd9b6a)
4  nori            3/6  (rgba(226,234,255,.5))
...
214 You            —    (#00e5ff, highlighted bg)
```

- Rank (JetBrains Mono, 13px, color-coded)
- Name (Space Grotesk, 14px)
- Score (JetBrains Mono, 12px)
- Current user row highlighted: background rgba(0,229,255,.08), border 1px rgba(0,229,255,.25)

### Right Column: Live Counter + Discussion

**Live Counter Card**:
- Label: "LIVE" (with pulsing dot)
- Count: `data-count="48210"` (animates up)
- Text: "minds tapped in today, across 92 countries"
- Background: linear-gradient(120deg, rgba(0,229,255,.08), rgba(255,43,214,.06))
- Border: 1px rgba(0,229,255,.18)

**Discussion Cards** (2 examples):
```
"Best Theta vs sleep-onset strategy?"
#strategy · 248 replies

"Today's Connections purple group was brutal"
#connections · 176 replies
```

- Each: background rgba(15,23,46,.55), border 1px rgba(255,255,255,.08)
- Title: Space Grotesk 600, 16px
- Tags + reply count: JetBrains Mono, 11px

---

## 8. Footer

**Styling:** border-top 1px rgba(255,255,255,.06), padding 48px 34px 40px

**Content** (3-column flex, centered max-width 1120px):
- **Left**: Logo + "BRAINTAP GAMES"
- **Center**: Links: "How to play" | "The science" | "Privacy" | "Terms"
- **Right**: "© 2026 BrainTap Labs"

All links: `.bt-foot-link`, font JetBrains Mono 12px, color rgba(226,234,255,.5), transition 0.2s

---

## 9. Settings Modal

**ID:** bt-modal (fixed, inset: 0, z-index: 100)  
**Backdrop:** rgba(2,3,9,.7), blur 8px

**Card Content** (id: bt-modal-card):
- Max-width: 420px
- Background: linear-gradient(180deg, rgba(16,24,48,.96), rgba(8,12,26,.96))
- Border: 1px rgba(0,229,255,.22)
- Border-radius: 24px
- Padding: 32px
- Transform: scale 0.92 (open: scale 1)

### Modal Sections:

#### 1. Help & Onboarding
```
BRAINTAP GAMES
Fifteen science-backed brain games, refreshed daily. Train memory, logic, language, numbers and focus — and build a streak.

🔥 Solve at least one game a day to grow your streak.
```

#### 2. Settings Toggles
Two rows (Zen mode, Sound):
```
Zen mode             [Toggle] ◆ Reduce motion and ambient effects
Sound effects        [Toggle] ◇ Audio feedback during gameplay
```

#### 3. Reset Progress
Button: "Reset today's progress" (danger style)

#### 4. Close Button
`[data-close]` attribute, top-right X icon

---

## 10. Zen Mode ([data-zen]) Behavior

Applied to: `[data-bt-root]` when settings.zen = true

**Effects:**
- All animations: duration 0.001s (effectively disabled)
- Iteration count: 1 (no loops)
- Transitions: 0.05s (snappy, minimal)
- Ambient canvas: hidden (display: none)
- Reduce-motion media query respected

**Data:**
- Key in localStorage: `settings.zen` (boolean)

---

## 11. Reset Countdown Logic

**Ticker ID:** reset-countdown  
**Updated:** every 1000ms  
**Formula:**
```javascript
const now = new Date();
const midnight = new Date(now);
midnight.setHours(24, 0, 0, 0);
let secondsRemaining = Math.floor((midnight - now) / 1000);
const h = String(Math.floor(s / 3600)).padStart(2, '0');
const m = String(Math.floor(s / 60) % 60).padStart(2, '0');
const ss = String(s % 60).padStart(2, '0');
// Format: "HH:MM:SS"
```

---

## 12. Ambient Canvas Backdrop

**Canvas ID:** bt-ambient  
**Fixed, inset: 0, z-index: 0, opacity: 0.5, pointer-events: none**

- Procedural noise/particle animation (p5.js pattern expected)
- Radial gradient overlays: cyan (top-left), magenta (right)
- Hidden when zen mode enabled

---

## 13. LocalStorage Structure

**Key:** `BT_GAMES_V1`  
**Type:** JSON object

### Schema:
```javascript
{
  date: "2026-6-17",           // YYYY-M-D (string)
  streak: 7,                   // Current streak count (number)
  streakDay: <dayNum>,         // Last day played (number, dayNum = Math.floor(Date.now()/864e5))
  settings: {
    zen: false,                // Boolean
    sound: true                // Boolean
  },
  onboarded: false,            // Boolean
  celebrated: false,           // Tracks if celebration modal was shown today
  
  // Game completion flags (per game per day):
  doneC: true,                 // Connections
  doneB: true,                 // Brainle (Wordle)
  doneS: true,                 // Strands
  doneF: false,                // Focus Forge
  doneW: false,                // Weaver
  doneV: false,                // Vault
  doneT: false,                // Teasers
  doneK: false,                // Sudoku
  doneP: false,                // Sprint
  doneD: false,                // Pips
  doneG: false,                // 2048
  doneH: false,                // Schulte
  doneM: false,                // Simon
  doneL: false,                // Slide
  doneR: false                 // Reversi
}
```

### Reset Logic:
- On page load, if `date` !== today, all `done*` flags are deleted
- `celebrated` is reset to false
- Streak increments if `streakDay === today - 1`, else resets to 1

---

## 14. Proposed Next.js App Router Architecture

### Directory Structure:
```
app/
├── layout.tsx                 # Root layout (nav, providers)
├── page.tsx                   # Hub page (/)
├── play/
│   └── [gameName]/
│       └── page.tsx           # Individual game screen
├── archive/
│   └── page.tsx               # Archive grid
├── stats/
│   └── page.tsx               # Brain profile + radar
├── leaderboard/
│   └── page.tsx               # Leaderboard + discussion
├── auth/
│   ├── login/page.tsx
│   └── signup/page.tsx
└── api/
    ├── user/route.ts          # GET /api/user (current user profile)
    ├── games/route.ts         # GET/POST /api/games/[name] (daily puzzle)
    ├── results/route.ts        # POST /api/results (save game result)
    ├── leaderboard/route.ts    # GET /api/leaderboard/[game]
    └── streaks/route.ts        # GET /api/streaks (user streak data)

components/
├── Nav.tsx                    # Top navigation bar
├── HeroSection.tsx            # Hub headline + date
├── StatStrip.tsx              # 4-stat cards
├── GameGrid.tsx               # 15-game card grid
├── RotationStrip.tsx          # Weekly rotation
├── BrainProfile.tsx           # Radar + skill bars
├── Archive.tsx                # Archive grid
├── Leaderboard.tsx            # Leaderboard + live counter
├── SettingsModal.tsx          # Modal container
├── GameScreen.tsx             # Generic game wrapper
└── Footer.tsx

lib/
├── localStorage.ts            # Client-side persistence wrapper
├── streakLogic.ts             # Streak calculation / reset
├── gameEngine.ts              # Base game logic (shared)
└── api.ts                     # Fetch wrappers

styles/
├── globals.css                # Theme, animations, base styles
└── components/                # Per-component overrides
```

---

## 15. Supabase Postgres Schema Sketch

### Tables:

#### **users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  avatar_seed VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **user_profiles**
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_played_date DATE,
  global_rank INT,
  total_games_played INT DEFAULT 0,
  settings JSONB DEFAULT '{"zen": false, "sound": true}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);
```

#### **daily_puzzles**
```sql
CREATE TABLE daily_puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_date DATE NOT NULL UNIQUE,
  -- Rotation mapping for the day
  featured_game VARCHAR(50),
  -- Puzzle data per game (JSON structure varies by game)
  puzzle_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### **game_results**
```sql
CREATE TABLE game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_name VARCHAR(50) NOT NULL,
  puzzle_date DATE NOT NULL,
  result_data JSONB NOT NULL,  -- {solved: bool, score: int, time_ms: int, moves: int, etc.}
  played_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, game_name, puzzle_date)
);
```

#### **leaderboard_daily**
```sql
CREATE TABLE leaderboard_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_name VARCHAR(50) NOT NULL,
  puzzle_date DATE NOT NULL,
  score INT NOT NULL,
  rank INT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, game_name, puzzle_date)
);
```

#### **user_skill_snapshots**
```sql
CREATE TABLE user_skill_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_name VARCHAR(50) NOT NULL,  -- Memory, Logic, Verbal, Focus, Speed
  score INT NOT NULL,  -- 0-100
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, skill_name, snapshot_date)
);
```

#### **discussion_threads**
```sql
CREATE TABLE discussion_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  game_name VARCHAR(50),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reply_count INT DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **discussion_replies**
```sql
CREATE TABLE discussion_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes (Performance):
```sql
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_game_results_user_puzzle ON game_results(user_id, puzzle_date);
CREATE INDEX idx_leaderboard_daily_game_date ON leaderboard_daily(game_name, puzzle_date, score DESC);
CREATE INDEX idx_user_skill_snapshots_user_date ON user_skill_snapshots(user_id, snapshot_date);
```

---

## 16. Key Behaviors & Interactions

### Streak Logic:
1. On first load each day (new date key), reset all `done*` flags
2. When any game is completed, mark `done[game]` = true
3. Increment streak if last_played_date == today - 1
4. Reset streak to 1 if gap in days
5. Display "Clean Sweep" modal if all 15 games completed before midnight

### Navigation:
- Clicking a game card calls `showScreen(gameName)` 
- Maps game name → screen element via TILEFLAGS() or GAMEFLAGS()
- Hides all screens, shows target, scrolls to top
- Help button (?) appears only on game screens

### Countdown:
- Updates every second with server-aware midnight
- Resets when date boundary crossed

### Animations:
- `.bt-rise`: entry animation (opacity + translateY)
- `.bt-tile:hover`: translateY(-5px)
- `.bt-primary:hover`: scale + shadow + brightness boost
- Disabled in Zen mode or prefers-reduced-motion

### Sound:
- Tone generation (Web Audio API) on game events
- Respects `settings.sound` flag; muted in Zen mode

---

## 17. Session Handoff Notes

This spec captures the platform layer only. **Game implementations** (Connections, Wordle, Strands, etc.) have their own complex logic and are separate concerns. 

**Next steps:**
1. Initialize Next.js project with TypeScript
2. Set up Supabase project; migrate schema
3. Build component library (shared styles, animations)
4. Implement auth flow (email/OAuth)
5. Wire up API endpoints to CRUD game results
6. Port individual game engines (or integrate existing libraries)
7. Test streak/countdown logic edge cases (midnight, timezone)
8. Build admin dashboard for puzzle seeding

---

## 18. Color Palette Reference

| Use | Color | CSS |
|-----|-------|-----|
| Primary Accent | Cyan | #00e5ff |
| Secondary | Magenta | #ff2bd6 |
| Tertiary | Blue-Purple | #86a3ff |
| Info/Focus | Purple | #9b8cff |
| Success | Teal | #7CF5C4 |
| Warning/Streak | Gold | #ffb020 |
| Orange | Orange | #ff9e3d |
| Background | Dark Navy | #03040b |
| Card BG | Deep Navy | rgba(15,23,46,.5) |
| Text Primary | Off-white | #f3f7ff |
| Text Secondary | Light Gray | rgba(226,234,255,.6) |

---

**Generated spec from: BrainTap Games.dc.html**  
**Framework: Design Components (dc-runtime)**  
**Target: React/Next.js App Router**

