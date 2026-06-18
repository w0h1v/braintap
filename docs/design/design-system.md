# BrainTap Design System

**Source:** `/Users/orie/dev/braintap/design_src/BrainTap Games.dc.html`

A neon-lit, glassmorphic dark design system for a cognitive brain-training game platform. Core aesthetic: deep void backgrounds, vibrant accent colors, sharp typography, smooth glass-like surfaces with subtle gradients.

---

## 1. COLOR SYSTEM

### Base Colors
- **Background (Void):** `#03040b` (darkest night, used for body/root)
- **Surface/Card Base:** `rgba(15,23,46,0.5)` to `rgba(13,21,42,0.6)` (slightly luminous dark)
- **Text Primary:** `#f3f7ff` (off-white, high contrast)
- **Text Secondary:** `#eaf1ff` (slightly cooler white)
- **Text Muted:** `rgba(226,234,255,0.45)` to `rgba(226,234,255,0.6)` (desaturated blue)
- **Border/Stroke:** `rgba(255,255,255,0.08)` to `rgba(255,255,255,0.18)` (subtle light borders)

### Primary Accent Colors (Neon)

| Color | Hex | RGB | Use Cases |
|-------|-----|-----|-----------|
| **Cyan** | `#00e5ff` | Primary brand accent | Primary buttons, nav links, highlights, "TODAY" badge |
| **Magenta/Pink** | `#ff2bd6` | Secondary accent | Alt buttons, connections game, accent gradients |
| **Periwinkle** | `#86a3ff` | Tertiary accent | Mind Strands game, aux gradients, secondary highlights |
| **Amber/Gold** | `#ffb020` | Quaternary accent | Focus Forge, streak badge, emphasis |
| **Mint/Teal** | `#7CF5C4` | Quinary accent | Idea Weaver, Sum Sprint, health-positive states |
| **Purple** | `#9b8cff` | Senary accent | Mini Sudoku, 2048, depth/alternative |
| **Orange** | `#ff9e3d` | Septenary accent | Pips game, warm emphasis |

### Gradient Definitions

**Primary gradient (multi-accent):**
```css
linear-gradient(100deg, #00e5ff, #86a3ff 50%, #ff2bd6)
```

**Game-specific accent gradients (all 118deg):**
- Neural Connections: `linear-gradient(118deg, #00e5ff, #7b8cff)`
- Synapse Wordle: `linear-gradient(118deg, #ff2bd6, #ff7ae0)`
- Mind Strands: `linear-gradient(118deg, #86a3ff, #00e5ff)`
- Focus Forge: `linear-gradient(118deg, #ffb020, #ff7a18)`
- Idea Weaver: `linear-gradient(118deg, #7CF5C4, #00e5ff)`
- Memory Vault: `linear-gradient(118deg, #00e5ff, #7b8cff)`
- Tap Teasers: `linear-gradient(118deg, #ff2bd6, #ff7ae0)`
- Mini Sudoku: `linear-gradient(118deg, #9b8cff, #00e5ff)`
- Sum Sprint: `linear-gradient(118deg, #7CF5C4, #00e5ff)`
- Pips: `linear-gradient(118deg, #ff9e3d, #ff6b9d)`
- 2048: `linear-gradient(118deg, #9b8cff, #00e5ff)`
- Schulte Table: `linear-gradient(118deg, #00e5ff, #7b8cff)`
- Sequence Echo: `linear-gradient(118deg, #ff2bd6, #ff7ae0)`
- Tile Slide: `linear-gradient(118deg, #00e5ff, #7b8cff)`
- Reversi: `linear-gradient(118deg, #7CF5C4, #00e5ff)`

**Card/Surface gradients:**
- Standard card: `linear-gradient(180deg, rgba(13,21,42,0.6), rgba(8,12,26,0.55))`
- Stat box: `linear-gradient(180deg, rgba(15,23,46,0.55), rgba(8,12,26,0.5))`
- Game tile: `linear-gradient(165deg, rgba([color],0.6), rgba(8,12,26,0.55))` (color varies by game accent)
- CTA section: `radial-gradient(120% 140% at 50% 0%, rgba(10,30,60,0.8), rgba(6,10,24,0.7))`

**Radial glows (ambient backdrop):**
- Cyan: `radial-gradient(120% 80% at 50% -10%, rgba(0,229,255,0.10), transparent 55%)`
- Magenta: `radial-gradient(90% 70% at 85% 12%, rgba(255,43,214,0.08), transparent 60%)`
- Glow orb: `radial-gradient(circle, rgba(0,229,255,0.16), transparent 60%)`

### Opacity Patterns
- Heavy opacity (disabled/muted): 0.4–0.5
- Medium opacity (secondary): 0.55–0.62
- Light opacity (hint/background): 0.06–0.12
- Hover state: +0.04–0.06 boost from base

---

## 2. TYPOGRAPHY SCALE

### Font Families
- **UI/Headlines:** `'Space Grotesk'` (Google Fonts: 400, 500, 600, 700 weights)
- **Monospace/Labels:** `'JetBrains Mono'` (Google Fonts: 400, 500, 600 weights)
- **Fallback:** `system-ui, sans-serif` (Space Grotesk) or `ui-monospace, monospace` (JetBrains)

### Font Sizes & Scales

| Component | Family | Weight | Size | Letter-spacing | Line-height | Notes |
|-----------|--------|--------|------|-----------------|-------------|-------|
| **Hero Heading** | Space Grotesk | 600 | `clamp(38px, 5.4vw, 68px)` | -0.03em | 1.0 | Main page title |
| **Section Heading** | Space Grotesk | 600 | `clamp(26px, 3vw, 38px)` | -0.02em | — | Page section titles |
| **CTA Large** | Space Grotesk | 600 | `clamp(30px, 4.4vw, 52px)` | -0.03em | 1.0 | Final CTA hero |
| **Game Title** | Space Grotesk | 600 | 18px | — | — | Game screen headers |
| **Card Title** | Space Grotesk | 600 | 21px | — | — | Game tile title |
| **Button Text** | Space Grotesk | 600 | 13–15px | — | — | Primary/secondary buttons |
| **Body Copy** | Space Grotesk | 400 | 15.5–17px | — | 1.6 | Descriptive text |
| **Body Small** | Space Grotesk | 400 | 13.5px | — | 1.5 | Card descriptions |
| **Label/Tag** | JetBrains Mono | 500–600 | 9.5–11.5px | .12em–.2em | — | Section labels, badges |
| **UI Helper** | JetBrains Mono | 400 | 11–12.5px | .04em–.14em | — | Inline helper text |
| **Nav Link** | JetBrains Mono | 600 | 12–12.5px | .04em–.2em | — | Navigation items |
| **Timestamp/Meta** | JetBrains Mono | 400 | 10–10.5px | .1em–.14em | — | Metadata, small info |

### Font Weight Usage
- **Bold (700):** Unused; prefer 600 for emphasis
- **Semibold (600):** Headlines, buttons, important UI
- **Medium (500):** Secondary buttons, labels
- **Regular (400):** Body text, helpers, descriptions

---

## 3. SPACING & LAYOUT

### Spacing Scale
```
4px, 7px, 8px, 9px, 10px, 11px, 12px, 13px, 14px, 16px, 18px, 20px, 22px, 24px, 26px, 28px, 30px, 32px, 34px, 36px, 40px, 44px, 48px, 64px, 70px, 80px, 90px, 96px, 100px, 128px
```

### Key Spacing Values
- **Section padding (vertical):** 64px, 70px, 80px, 90px (responsive via `max-width: 1120px` wrapper)
- **Section padding (horizontal):** 32px (sides), 20px (mobile)
- **Card padding:** 18–32px (interior content)
- **Gap (flex/grid):** 7px (compact), 8px (standard), 10px, 12px (loose), 14px, 16px, 18px, 22px–24px (sections)
- **Page max-width:** 1120px (content container)
- **Game screen width:** 420px–600px (centered, constrained)

### Grid Systems
- **Game tiles:** `grid-template-columns: repeat(3, 1fr); gap: 18px` (hub)
- **Archive/rotation:** `grid-template-columns: repeat(4, 1fr); gap: 14px` (hub), `repeat(7, 1fr); gap: 10px` (week)
- **Keyboard (Wordle):** `grid-template-columns: repeat(10, 1fr); gap: 7px`
- **Connections:** `grid-template-columns: repeat(4, 1fr); gap: 8px`
- **Simon pads:** `grid-template-columns: repeat(2, 1fr); gap: 12px`

---

## 4. BORDER RADIUS

Consistent radius scale (in pixels):

| Value | Usage |
|-------|-------|
| **50%** | Full circles (profile avatar, help button) |
| **100px** | Pill buttons, badges |
| **20px** | Large cards, game tiles |
| **18px** | Standard cards, stat boxes |
| **16px** | Secondary cards, input backgrounds |
| **14px** | Smaller UI elements |
| **13px** | Button borders (primary actions) |
| **12px** | Memory Vault grid, control buttons |
| **11px** | 2048 arrow buttons |
| **10px** | Action button text (`Play →`) |
| **9px** | Ghost button (hint) |
| **8px** | Scrollbar, minor dividers |
| **6px** | Progress bar, minimal |
| **4px–3px** | Checkbox, very small element |

---

## 5. SHADOWS & GLOWS

### Shadow System
```css
/* Subtle shadow for cards in hover state */
box-shadow: 0 0 0 rgba(0,229,255, 0);  /* at rest */
box-shadow: 0 14px 44px rgba(0,229,255, 0.32), 0 6px 24px rgba(255,43,214, 0.26);  /* hover */

/* Modal depth */
box-shadow: 0 30px 80px rgba(0,0,0, 0.6);

/* Button glow (primary) */
box-shadow: 0 10px 34px rgba(0,229,255, 0.24);  /* cyan primary button */
box-shadow: 0 10px 30px rgba(124,245,196, 0.22);  /* mint primary button */
box-shadow: 0 10px 30px rgba(255,43,214, 0.22);  /* magenta primary button */

/* Floating glow */
box-shadow: 0 0 8px #00e5ff;  /* on pulse animation dot */
```

### Filter/Blur Effects
- **Standard blur (nav background):** Not visible; transparent until scroll
- **Backdrop blur (modal, help button):** `backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);`
- **Radial blur (ambient glow):** `filter: blur(30px);`
- **Saturation boost (hover):** `filter: saturate(1.06) brightness(1.04);`

---

## 6. ANIMATIONS & KEYFRAMES

### Defined Keyframes

```css
@keyframes btPulse {
  0%, 100% { opacity: 0.4; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.2); }
}
/* Duration: 2.4s ease-in-out infinite; used on status indicator dots */

@keyframes btRise {
  0% { transform: translateY(16px); }
  100% { transform: translateY(0); }
}
/* Duration: 0.7s cubic-bezier(0.2, 0.7, 0.2, 1); entrance animation for hero sections */

@keyframes btPop {
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
}
/* Pop-in effect for solved cards */

@keyframes btFlip {
  0% { transform: rotateX(0); }
  50% { transform: rotateX(90deg); }
  100% { transform: rotateX(0); }
}
/* Card flip animation */

@keyframes btShake {
  10%, 90% { transform: translateX(-2px); }
  20%, 80% { transform: translateX(4px); }
  30%, 50%, 70% { transform: translateX(-7px); }
  40%, 60% { transform: translateX(7px); }
}
/* Error/mistake shake */

@keyframes btSolve {
  0% { transform: scale(1); }
  40% { transform: scale(1.06); }
  100% { transform: scale(1); }
}
/* Solve success pulse */

@keyframes btFloaty {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}
/* Gentle floating hover effect */
```

### Component Transition Classes

```css
.bt-card {
  transition: transform 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease;
}

.bt-tile {
  transition: transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1), border-color 0.3s ease, box-shadow 0.3s ease;
  cursor: pointer;
  &:hover { transform: translateY(-5px); }
}

.bt-primary {
  transition: transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 44px rgba(0,229,255,0.32), 0 6px 24px rgba(255,43,214,0.26);
    filter: saturate(1.06) brightness(1.04);
  }
}

.bt-ghost {
  transition: border-color 0.3s ease, background 0.3s ease, color 0.3s ease;
  &:hover {
    border-color: rgba(0,229,255,0.55);
    background: rgba(0,229,255,0.06);
    color: #eaf6ff;
  }
}

.bt-nav-link {
  transition: color 0.25s ease;
  &:hover { color: #cfeeff; }
}

.bt-foot-link {
  transition: color 0.2s ease;
  &:hover { color: #9fe9ff; }
}

.bt-key {
  transition: transform 0.08s ease, background 0.15s ease, color 0.15s ease;
  cursor: pointer;
  user-select: none;
  &:active { transform: translateY(1px) scale(0.96); }
}

.bt-conn-tile {
  transition: transform 0.12s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
  user-select: none;
  &:active { transform: scale(0.95); }
}
```

### Entry Animation
```css
.bt-rise {
  opacity: 1;
  animation: btRise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
```

### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.001s !important;
  }
}

[data-zen] * {
  animation-duration: 0.001s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.05s !important;
}
```

---

## 7. COMPONENT PATTERNS

### Navigation
- **Container:** Fixed top, `z-index: 50`
- **Padding:** 18px vertical, 34px horizontal
- **Font:** JetBrains Mono, 12–13.5px, letter-spacing 0.04em–0.2em
- **Logo:** Inline SVG (22×22) + branding text
- **Link states:** Active (cyan), inactive (muted rgba)
- **Streak badge:** Amber pill with icon, border 1px solid `rgba(255,176,32,0.3)`, bg `rgba(255,176,32,0.07)`
- **Avatar:** 32×32 circle with gradient `linear-gradient(135deg, #00e5ff, #ff2bd6)`

### Primary Button (`.bt-primary`)
```
border: none
border-radius: 10px–13px
padding: 9–15px vertical, 18–30px horizontal
font-family: 'Space Grotesk'
font-weight: 600
font-size: 13–15px
color: #04060f (dark text on light gradient)
background: linear-gradient(118deg, [accent], [accent2])
box-shadow: 0 10px 30–34px rgba([accent], 0.22–0.24)
cursor: pointer
transition: transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease
```

Hover: translateY(-2px) + shadow boost + saturate(1.06) brightness(1.04)

### Ghost Button (`.bt-ghost`)
```
border: 1px solid rgba(255,255,255, 0.18–0.2)
border-radius: 13px (buttons), 100px (pill), 9px (hint)
padding: 10–14px vertical, 18–26px horizontal
font-family: 'Space Grotesk'
font-weight: 500
font-size: 14–15px
color: #eaf1ff
background: rgba(255,255,255, 0.035–0.04)
cursor: pointer
transition: border-color 0.3s ease, background 0.3s ease, color 0.3s ease
```

Hover: border `rgba(0,229,255,0.55)`, bg `rgba(0,229,255,0.06)`, color `#eaf6ff`

### Card (`.bt-card`)
```
background: linear-gradient(180deg, rgba(13,21,42,0.6), rgba(8,12,26,0.55))
border: 1px solid rgba(255,255,255, 0.08)
border-radius: 18–24px
padding: 22–32px
box-shadow: none (at rest)
transition: transform 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease
```

### Game Tile (`.bt-tile`)
```
background: linear-gradient(165deg, rgba([accent], 0.5–0.6), rgba(8,12,26,0.55))
border: 1px solid rgba([accent], 0.26–0.32)
border-radius: 20px
padding: 24px
display: flex
flex-direction: column
min-height: 230px
cursor: pointer
transition: transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1), border-color 0.3s ease, box-shadow 0.3s ease
```

Hover: translateY(-5px)

### Badge/Pill (`.bt-badge`, `.bt-pill`)
```
border: 1px solid rgba([accent], 0.25–0.3)
border-radius: 100px
padding: 4–6px vertical, 9–13px horizontal
font-family: 'JetBrains Mono'
font-size: 9.5–11px
letter-spacing: 0.12em
color: [accent muted] or [accent bright]
background: rgba([accent], 0.07–0.12)
text-transform: uppercase
```

Variants:
- Cyan: `#9fe9ff` text, `rgba(0,229,255,0.3)` border
- Magenta: `#ffb3ec` text, `rgba(255,43,214,0.3)` border
- Periwinkle: `#b3c2ff` text, `rgba(134,163,255,0.3)` border
- Mint: `#9bf7d3` text, `rgba(124,245,196,0.3)` border

### Keyboard Key (`.bt-key`)
```
border: none
border-radius: 8–11px
background: rgba([accent], 0.14)
color: #eafcff
font-size: 12–20px
cursor: pointer
user-select: none
transition: transform 0.08s ease, background 0.15s ease, color 0.15s ease
```

Active state: transform scale(0.96) translateY(1px)

### Stat Box
```
background: linear-gradient(180deg, rgba(15,23,46,0.55), rgba(8,12,26,0.5))
border: 1px solid rgba(255,255,255,0.08)
border-radius: 16px
padding: 18px vertical, 20px horizontal
text-align: center
display: flex; flex-direction: column
```

Content:
- Large number: Space Grotesk 600, 30px, `[accent color]`
- Unit: 15px gray
- Label: JetBrains Mono 10.5px, letter-spacing 0.12em, muted color

### Modal
```
position: fixed
inset: 0
z-index: 100
background: rgba(2,3,9,0.7)
backdrop-filter: blur(8px)
display: flex
align-items: center
justify-content: center
padding: 20px

.bt-modal-card:
  width: 100%
  max-width: 420px
  background: linear-gradient(180deg, rgba(16,24,48,0.96), rgba(8,12,26,0.96))
  border: 1px solid rgba(0,229,255,0.22)
  border-radius: 24px
  padding: 32px
  box-shadow: 0 30px 80px rgba(0,0,0,0.6)
  transform: scale(0.92)
  transition: transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1)
```

---

## 8. RESPONSIVE DESIGN NOTES

### Current Strategy
The prototype is **desktop-centric** with a 3-column grid and wide 1120px max-width. Mobile adaptation required.

### Mobile Breakpoints & Adaptations

```css
/* Tablet (768px) */
@media (max-width: 768px) {
  .game-grid { grid-template-columns: repeat(2, 1fr); }
  .archive-grid { grid-template-columns: repeat(2, 1fr); }
  nav { padding: 12px 20px; gap: 16px; }
  .section-heading { font-size: clamp(20px, 2.5vw, 28px); }
  .content-wrapper { padding: 40px 20px; }
}

/* Mobile (480px and below) */
@media (max-width: 480px) {
  .game-grid { grid-template-columns: repeat(1, 1fr); }
  .archive-grid { grid-template-columns: repeat(1, 1fr); }
  .rotation-strip { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  nav {
    padding: 12px 16px;
    flex-wrap: wrap;
    font-size: 11px;
  }
  nav .links { display: none; } /* hamburger menu needed */
  .stats-strip { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .stat-box { padding: 12px 16px; font-size: 20px; }
  
  /* Ensure safe areas for notch/home indicator */
  nav { padding-top: max(12px, env(safe-area-inset-top)); }
  body { padding-bottom: max(0, env(safe-area-inset-bottom)); }
}
```

### Touch Target Sizing
- Minimum interactive element: **44×44px** (WCAG AAA)
- Button padding: Ensure all buttons meet this; current 12–15px vertical + padding works for most

### Safe Area Implementation
```css
/* For notched phones */
nav { padding-right: max(34px, env(safe-area-inset-right)); }
.help-button { bottom: max(22px, env(safe-area-inset-bottom)); right: max(22px, env(safe-area-inset-right)); }
```

### Bottom Navigation / Mobile Nav
- Current fixed nav is not mobile-optimized; recommend drawer or bottom tab bar
- Keep bottom 60px clear for mobile nav on small screens

---

## 9. REDUCED MOTION & ACCESSIBILITY

### Media Query Implementation
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.001s !important;
  }
}
```
All animations collapse to instant/near-instant; transitions remain but at native speed.

### Zen Mode (`[data-zen]` attribute)
```css
[data-zen] * {
  animation-duration: 0.001s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.05s !important;
}
```
Used for relaxed gameplay mode; faster response, no looping effects.

### Scrollbar Styling
```css
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: rgba(120,150,200,0.22); border-radius: 8px; }
::-webkit-scrollbar-track { background: transparent; }
```

---

## 10. TAILWIND v3 THEME EXTENSION

```javascript
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        // Base
        'bt-void': '#03040b',
        'bt-dark-surface': 'rgba(15,23,46,0.5)',
        'bt-card-dark': 'rgba(13,21,42,0.6)',
        
        // Text
        'bt-text-primary': '#f3f7ff',
        'bt-text-secondary': '#eaf1ff',
        'bt-text-muted': 'rgba(226,234,255,0.45)',
        'bt-text-muted-light': 'rgba(226,234,255,0.6)',
        
        // Accents
        'bt-cyan': '#00e5ff',
        'bt-magenta': '#ff2bd6',
        'bt-periwinkle': '#86a3ff',
        'bt-amber': '#ffb020',
        'bt-mint': '#7CF5C4',
        'bt-purple': '#9b8cff',
        'bt-orange': '#ff9e3d',
      },
      fontFamily: {
        'space': ["'Space Grotesk'", 'system-ui', 'sans-serif'],
        'jetbrains': ["'JetBrains Mono'", 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'hero': ['clamp(38px, 5.4vw, 68px)', { lineHeight: '1.0', letterSpacing: '-0.03em' }],
        'h1': ['clamp(26px, 3vw, 38px)', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'h2': ['clamp(30px, 4.4vw, 52px)', { lineHeight: '1.0', letterSpacing: '-0.03em' }],
        'game-title': ['18px', { fontWeight: '600', lineHeight: '1.2' }],
        'tile-title': ['21px', { fontWeight: '600' }],
        'body': ['15.5px', { lineHeight: '1.6' }],
        'body-sm': ['13.5px', { lineHeight: '1.5' }],
        'label': ['9.5px', { letterSpacing: '0.12em', fontWeight: '600' }],
        'mono-sm': ['11px', { fontFamily: "'JetBrains Mono'", letterSpacing: '0.04em' }],
      },
      letterSpacing: {
        'mono-tight': '0.04em',
        'mono-normal': '0.12em',
        'mono-wide': '0.2em',
        'title': '-0.02em',
      },
      borderRadius: {
        'circle': '50%',
        'pill': '100px',
        'card': '20px',
        'sm-card': '18px',
        'tile': '20px',
        'button': '13px',
        'button-sm': '11px',
        'ghost': '9px',
        'input': '16px',
      },
      boxShadow: {
        'bt-primary-cyan': '0 10px 34px rgba(0,229,255,0.24)',
        'bt-primary-mint': '0 10px 30px rgba(124,245,196,0.22)',
        'bt-primary-magenta': '0 10px 30px rgba(255,43,214,0.22)',
        'bt-primary-amber': '0 10px 30px rgba(255,176,32,0.24)',
        'bt-hover': '0 14px 44px rgba(0,229,255,0.32), 0 6px 24px rgba(255,43,214,0.26)',
        'bt-modal': '0 30px 80px rgba(0,0,0,0.6)',
        'bt-glow': '0 0 8px #00e5ff',
      },
      keyframes: {
        'bt-pulse': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(0.85)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        'bt-rise': {
          '0%': { transform: 'translateY(16px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'bt-pop': {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '60%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'bt-flip': {
          '0%': { transform: 'rotateX(0)' },
          '50%': { transform: 'rotateX(90deg)' },
          '100%': { transform: 'rotateX(0)' },
        },
        'bt-shake': {
          '10%, 90%': { transform: 'translateX(-2px)' },
          '20%, 80%': { transform: 'translateX(4px)' },
          '30%, 50%, 70%': { transform: 'translateX(-7px)' },
          '40%, 60%': { transform: 'translateX(7px)' },
        },
        'bt-solve': {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        'bt-floaty': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
      },
      animation: {
        'bt-pulse': 'bt-pulse 2.4s ease-in-out infinite',
        'bt-rise': 'bt-rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'bt-pop': 'bt-pop 0.5s ease-out',
        'bt-flip': 'bt-flip 0.6s ease-in-out',
        'bt-shake': 'bt-shake 0.5s ease-in-out',
        'bt-solve': 'bt-solve 0.4s ease-out',
        'bt-floaty': 'bt-floaty 3s ease-in-out infinite',
      },
      spacing: {
        'safe-notch': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
    },
  },
};
```

---

## 11. CSS CUSTOM PROPERTIES / GLOBALS

```css
:root {
  /* Colors */
  --color-void: #03040b;
  --color-surface: rgba(15,23,46,0.5);
  --color-card: rgba(13,21,42,0.6);
  --color-text-primary: #f3f7ff;
  --color-text-secondary: #eaf1ff;
  --color-text-muted: rgba(226,234,255,0.45);
  
  --color-cyan: #00e5ff;
  --color-magenta: #ff2bd6;
  --color-periwinkle: #86a3ff;
  --color-amber: #ffb020;
  --color-mint: #7CF5C4;
  --color-purple: #9b8cff;
  --color-orange: #ff9e3d;
  
  /* Typography */
  --font-space: 'Space Grotesk', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  
  /* Sizing */
  --size-radius-sm: 8px;
  --size-radius-button: 13px;
  --size-radius-card: 18px;
  --size-radius-tile: 20px;
  --size-radius-pill: 100px;
  --size-radius-circle: 50%;
  
  /* Shadows */
  --shadow-glow: 0 0 8px var(--color-cyan);
  --shadow-elevation: 0 14px 44px rgba(0,229,255,0.32), 0 6px 24px rgba(255,43,214,0.26);
  --shadow-modal: 0 30px 80px rgba(0,0,0,0.6);
  
  /* Transitions */
  --transition-fast: 0.08s ease;
  --transition-normal: 0.25s ease;
  --transition-slow: 0.35s ease;
  --transition-card: transform 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease;
  
  /* Safe areas (mobile notch) */
  --safe-inset-top: env(safe-area-inset-top);
  --safe-inset-bottom: env(safe-area-inset-bottom);
}

/* Global resets */
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  background: var(--color-void);
  -webkit-font-smoothing: antialiased;
  font-family: var(--font-space);
}

html {
  scroll-behavior: smooth;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-thumb {
  background: rgba(120,150,200,0.22);
  border-radius: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}
```

---

## 12. REACT PRIMITIVE COMPONENTS

### Component Props & Shapes

#### Button
```typescript
interface ButtonProps {
  variant?: 'primary' | 'ghost' | 'key';  // default: 'primary'
  accent?: 'cyan' | 'magenta' | 'mint' | 'amber' | 'purple' | 'orange';  // default: 'cyan'
  size?: 'sm' | 'md' | 'lg';  // default: 'md'
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

// Usage: <Button variant="primary" accent="cyan">Play →</Button>
```

#### GhostButton
```typescript
interface GhostButtonProps {
  accent?: string;  // optional glow color
  size?: 'sm' | 'md' | 'lg';
  pill?: boolean;  // border-radius: 100px
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

// Usage: <GhostButton pill>Shuffle</GhostButton>
```

#### Card
```typescript
interface CardProps {
  variant?: 'default' | 'stat' | 'game-tile';
  accent?: string;  // for game-tile gradient
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

// Usage: <Card variant="game-tile" accent="cyan">Game content</Card>
```

#### Pill / Badge
```typescript
interface PillProps {
  accent?: 'cyan' | 'magenta' | 'mint' | 'amber' | 'purple';  // default: 'cyan'
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

// Usage: <Pill accent="amber">7 days</Pill>
```

#### StatBox
```typescript
interface StatBoxProps {
  label: string;  // uppercase label
  value: string | number;
  unit?: string;  // smaller text suffix
  color?: 'cyan' | 'magenta' | 'mint' | 'amber' | 'purple' | 'orange';  // default: 'cyan'
  className?: string;
}

// Usage: <StatBox label="Current Streak" value="7" unit="days" color="amber" />
```

#### Modal
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;  // footer button group
  className?: string;
}

// Usage: <Modal isOpen={true} onClose={close}>Modal content</Modal>
```

#### NeonText
```typescript
interface NeonTextProps {
  text: string;
  accent?: 'cyan' | 'magenta' | 'periwinkle' | 'mint' | 'orange';  // default: 'cyan'
  gradient?: boolean;  // use multi-color gradient
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';  // default: 'span'
  className?: string;
}

// Usage: <NeonText text="one puzzle a day" gradient>
//   with background-clip and multi-color gradient
// </NeonText>
```

#### AmbientBackdrop
```typescript
interface AmbientBackdropProps {
  primaryColor?: 'cyan' | 'magenta';  // default: 'cyan'
  secondaryColor?: string;  // default: 'magenta'
  blur?: number;  // in px; default: 30
  intensity?: 'low' | 'medium' | 'high';  // opacity multiplier; default: 'medium'
  className?: string;
}

// Usage: <AmbientBackdrop primaryColor="cyan" intensity="medium" />
// Renders canvas + radial gradient overlays
```

---

## 13. BUILD & EXPORT CHECKLIST

### Validation
- [x] All 7 accent colors defined and used consistently
- [x] All keyframe animations captured
- [x] All component transition classes identified
- [x] Responsive mobile breakpoints specified
- [x] Reduced motion media queries included
- [x] Zen mode accessibility pattern documented
- [x] Border radius scale complete
- [x] Shadow/glow system defined
- [x] Safe area (notch) handling noted

### Next Steps for Implementation
1. **Tailwind setup:** Copy the theme extension into `tailwind.config.js`
2. **CSS globals:** Paste custom properties into base stylesheet
3. **Component library:** Build React primitives matching the prop signatures
4. **Mobile responsiveness:** Implement media query breakpoints
5. **Testing:** Verify on light/dark themes, reduced-motion mode, actual devices
6. **Accessibility audit:** WCAG 2.1 AA/AAA contrast, keyboard nav, screen reader

---

**Last Updated:** June 2026  
**Source Prototype:** BrainTap Games.dc.html (Deck Card HTML)  
**Design Language:** Neon Glassmorphism, Dark Mode, Cognitive Game UI
