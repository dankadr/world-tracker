# Theme Redesign — Deep Navy & Gold Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the warm sand/brown palette with the Deep Navy & Gold explorer identity across all CSS files in the app.

**Architecture:** Update CSS custom properties in `App.css` as the source of truth for both modes, then audit every component CSS file for hard-coded colors and update them to use the new palette. Add Playfair Display + Inter via Google Fonts. Update map visited fill colors in JSX.

**Tech Stack:** Plain CSS custom properties, React JSX (map color values only), Google Fonts

**Design spec:** `docs/superpowers/specs/2026-03-10-theme-redesign-design.md`

---

## Palette Reference (copy-paste ready)

```
LIGHT MODE
--body-bg:              linear-gradient(135deg, #fdf8ee 0%, #f7edce 40%, #ede0b8 100%)
--text-primary:         #0d1b2a
--text-secondary:       #1b3a5c
--text-tertiary:        #4a6a8a
--text-muted:           #8a9aaa
--text-on-glass:        #0d1b2a
--glass-bg:             rgba(255, 248, 220, 0.28)
--glass-bg-heavy:       rgba(255, 248, 220, 0.52)
--glass-bg-subtle:      rgba(255, 248, 220, 0.14)
--glass-border:         rgba(201, 168, 76, 0.35)
--glass-border-subtle:  rgba(201, 168, 76, 0.18)
--glass-highlight:      rgba(255, 248, 220, 0.70)
--glass-blur:           16px  (unchanged)
--glass-blur-heavy:     24px  (unchanged)
--glass-blur-light:     10px  (unchanged)
--glass-shadow:         0 8px 32px rgba(13, 27, 42, 0.08)
--glass-shadow-elevated:0 12px 40px rgba(13, 27, 42, 0.12)
--glass-specular:       inset 1px 1px 0 rgba(255,248,220,0.60), inset 0 0 8px rgba(201,168,76,0.12)
--glass-specular-strong:inset 1px 1px 0 rgba(255,248,220,0.80), inset 0 0 12px rgba(201,168,76,0.18)
--glass-hover-glow:     0 0 20px rgba(201, 168, 76, 0.25)
--bar-track:            rgba(13, 27, 42, 0.08)
--divider:              rgba(201, 168, 76, 0.30)
--input-bg:             rgba(255, 248, 220, 0.40)
--hover-bg:             rgba(255, 248, 220, 0.30)

DARK MODE
--body-bg:              linear-gradient(135deg, #050e18 0%, #0d1b2a 40%, #112236 100%)
--text-primary:         #e8d5a3
--text-secondary:       #b8a870
--text-tertiary:        #7a8a9a
--text-muted:           #4a5a6a
--text-on-glass:        #e8d5a3
--glass-bg:             rgba(13, 27, 42, 0.55)
--glass-bg-heavy:       rgba(13, 27, 42, 0.78)
--glass-bg-subtle:      rgba(13, 27, 42, 0.30)
--glass-border:         rgba(201, 168, 76, 0.22)
--glass-border-subtle:  rgba(201, 168, 76, 0.12)
--glass-highlight:      rgba(201, 168, 76, 0.08)
--glass-shadow:         0 8px 32px rgba(0, 0, 0, 0.45)
--glass-shadow-elevated:0 12px 40px rgba(0, 0, 0, 0.55)
--glass-specular:       inset 1px 1px 0 rgba(201,168,76,0.14), inset 0 0 8px rgba(201,168,76,0.06)
--glass-specular-strong:inset 1px 1px 0 rgba(201,168,76,0.20), inset 0 0 12px rgba(201,168,76,0.10)
--glass-hover-glow:     0 0 20px rgba(201, 168, 76, 0.18)
--bar-track:            rgba(201, 168, 76, 0.10)
--divider:              rgba(201, 168, 76, 0.16)
--input-bg:             rgba(5, 14, 24, 0.60)
--hover-bg:             rgba(27, 58, 92, 0.45)

ACCENT (both modes)
--accent:               #c9a84c  (gold)
--accent-hover light:   #b8972e
--accent-hover dark:    #d4b85c
--visited:              #d4933a  (warm amber)
```

---

## Chunk 1: Foundation — Fonts + App.css Token Rewrite

### Task 1: Add Google Fonts to index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add font imports**

In `index.html`, inside `<head>`, after the existing `<link rel="shortcut icon" ...>` line, add:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Verify fonts load**

Run: `npm run dev`
Open browser → DevTools → Network tab → filter "fonts.googleapis" → confirm 200 response
Also check: the word "Right World Tracker" in the sidebar should now render in Playfair Display serif (you'll see it change immediately once Task 3 applies the font).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(theme): add Playfair Display + Inter Google Fonts"
```

---

### Task 2: Rewrite App.css — Light Mode Tokens (:root)

**Files:**
- Modify: `src/App.css` (lines 2–29, the `:root { }` block)

- [ ] **Step 1: Replace the entire :root block**

Find the existing `:root { ... }` block (lines 2–29) and replace it entirely with:

```css
:root {
  --glass-bg: rgba(255, 248, 220, 0.28);
  --glass-bg-heavy: rgba(255, 248, 220, 0.52);
  --glass-bg-subtle: rgba(255, 248, 220, 0.14);
  --glass-border: rgba(201, 168, 76, 0.35);
  --glass-border-subtle: rgba(201, 168, 76, 0.18);
  --glass-highlight: rgba(255, 248, 220, 0.70);
  --glass-blur: 16px;
  --glass-blur-heavy: 24px;
  --glass-blur-light: 10px;
  --glass-shadow: 0 8px 32px rgba(13, 27, 42, 0.08);
  --glass-shadow-elevated: 0 12px 40px rgba(13, 27, 42, 0.12);
  --glass-specular: inset 1px 1px 0 rgba(255, 248, 220, 0.60),
                     inset 0 0 8px rgba(201, 168, 76, 0.12);
  --glass-specular-strong: inset 1px 1px 0 rgba(255, 248, 220, 0.80),
                            inset 0 0 12px rgba(201, 168, 76, 0.18);
  --glass-hover-glow: 0 0 20px rgba(201, 168, 76, 0.25);
  --body-bg: linear-gradient(135deg, #fdf8ee 0%, #f7edce 40%, #ede0b8 100%);
  --text-primary: #0d1b2a;
  --text-secondary: #1b3a5c;
  --text-tertiary: #4a6a8a;
  --text-muted: #8a9aaa;
  --text-on-glass: #0d1b2a;
  --bar-track: rgba(13, 27, 42, 0.08);
  --divider: rgba(201, 168, 76, 0.30);
  --input-bg: rgba(255, 248, 220, 0.40);
  --hover-bg: rgba(255, 248, 220, 0.30);
}
```

- [ ] **Step 2: Verify light mode**

Run: `npm run dev` (if not already running)
Open the app in light mode. Check:
- Background: warm parchment/cream gradient (not the old warm sand)
- Sidebar text: deep navy, not dark brown
- Dividers between list items: faint gold, not sandy brown
- Progress bar track: very light navy tint

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "feat(theme): rewrite light mode CSS tokens — parchment + navy + gold"
```

---

### Task 3: Rewrite App.css — Dark Mode Tokens ([data-theme="dark"])

**Files:**
- Modify: `src/App.css` (the `[data-theme="dark"] { ... }` block, around line 1259)

- [ ] **Step 1: Replace the dark mode token block**

Find the `[data-theme="dark"] {` block (the one with all the `--glass-*` and `--text-*` vars, ending around line 1283) and replace it with:

```css
[data-theme="dark"] {
  --glass-bg: rgba(13, 27, 42, 0.55);
  --glass-bg-heavy: rgba(13, 27, 42, 0.78);
  --glass-bg-subtle: rgba(13, 27, 42, 0.30);
  --glass-border: rgba(201, 168, 76, 0.22);
  --glass-border-subtle: rgba(201, 168, 76, 0.12);
  --glass-highlight: rgba(201, 168, 76, 0.08);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  --glass-shadow-elevated: 0 12px 40px rgba(0, 0, 0, 0.55);
  --glass-specular: inset 1px 1px 0 rgba(201, 168, 76, 0.14),
                     inset 0 0 8px rgba(201, 168, 76, 0.06);
  --glass-specular-strong: inset 1px 1px 0 rgba(201, 168, 76, 0.20),
                            inset 0 0 12px rgba(201, 168, 76, 0.10);
  --glass-hover-glow: 0 0 20px rgba(201, 168, 76, 0.18);
  --body-bg: linear-gradient(135deg, #050e18 0%, #0d1b2a 40%, #112236 100%);
  --text-primary: #e8d5a3;
  --text-secondary: #b8a870;
  --text-tertiary: #7a8a9a;
  --text-muted: #4a5a6a;
  --text-on-glass: #e8d5a3;
  --bar-track: rgba(201, 168, 76, 0.10);
  --divider: rgba(201, 168, 76, 0.16);
  --input-bg: rgba(5, 14, 24, 0.60);
  --hover-bg: rgba(27, 58, 92, 0.45);
}
```

- [ ] **Step 2: Verify dark mode**

Toggle to dark mode. Check:
- Background: deep navy (not dark brown)
- Sidebar text: antique cream, not warm beige
- Glass cards: navy-tinted with gold border highlights
- Dividers: faint gold lines

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "feat(theme): rewrite dark mode CSS tokens — deep navy + gold"
```

---

### Task 4: Audit App.css for hard-coded brown/sand colors

**Files:**
- Modify: `src/App.css`

The `[data-theme="dark"]` section below the token block (lines ~1285–1430) has dozens of one-off overrides that reference old brown values. These need updating.

- [ ] **Step 1: Find all hard-coded old-palette colors in App.css**

Run:
```bash
grep -n "rgba(192, 122\|rgba(180, 130\|rgba(80, 40\|rgba(60, 38\|rgba(38, 30\|#1c1510\|#251a\|#2a1f\|c07a30\|e8a84a\|d8964\|C07A30\|192, 122, 48" src/App.css
```

- [ ] **Step 2: Replace old accent/brown colors throughout App.css**

For each match from Step 1, apply these substitutions:

| Old value | New value | Context |
|-----------|-----------|---------|
| `rgba(192, 122, 48, ...)` | `rgba(201, 168, 76, ...)` | Gold accent references |
| `rgba(180, 130, 70, ...)` | `rgba(201, 168, 76, ...)` | Gold border references |
| `rgba(80, 40, 10, ...)` | `rgba(13, 27, 42, ...)` | Shadow color (light mode) |
| `rgba(60, 38, 18, ...)` | `rgba(13, 27, 42, ...)` | Dark glass bg |
| `rgba(38, 30, 22, ...)` | `rgba(13, 27, 42, ...)` | Dark bg |
| `#1c1510` / `#251a12` / `#2a1f15` | `#0d1b2a` | Dark background |
| `rgba(216, 150, 72, ...)` | `rgba(201, 168, 76, ...)` | Accent references |
| `rgba(200, 140, 60, ...)` | `rgba(201, 168, 76, ...)` | Accent references |

Also update `[data-theme="dark"] body` color from `#e0e0e0` → `#e8d5a3`.

- [ ] **Step 3: Verify — no rogue brown colors remain**

```bash
grep -n "rgba(192, 122\|rgba(180, 130\|rgba(80, 40\|rgba(60, 38\|rgba(38, 30\|#1c1510\|#251a\|#2a1f" src/App.css
```
Expected: 0 matches (or only in comments)

- [ ] **Step 4: Visual check both modes**

Toggle light ↔ dark, click through sidebar, achievements, and search. No jarring brown/sandy remnants.

- [ ] **Step 5: Commit**

```bash
git add src/App.css
git commit -m "feat(theme): replace hard-coded brown/amber colors in App.css"
```

---

### Task 5: Apply Playfair Display typography

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Update sidebar title font**

Find `.sidebar-title` in App.css and add `font-family`:

```css
.sidebar-title {
  font-family: 'Playfair Display', Georgia, serif;
  /* keep all other existing properties */
}
```

- [ ] **Step 2: Update stats numbers font**

Find `.stats-numbers`, `.stats-summary-num`, `.overall-count` (or equivalent large stat number classes) and add:

```css
font-family: 'Playfair Display', Georgia, serif;
```

- [ ] **Step 3: Verify typography**

In the app, the sidebar header "Right World Tracker" should now render in the elegant Playfair Display serif. The stat numbers (19 / 238) should also use the serif.

- [ ] **Step 4: Commit**

```bash
git add src/App.css
git commit -m "feat(theme): apply Playfair Display to title and stat numbers"
```

---

## Chunk 2: Mobile + Games CSS

### Task 6: Update BottomTabBar.css

**Files:**
- Modify: `src/components/BottomTabBar.css`

- [ ] **Step 1: Replace hard-coded colors**

| Line | Old | New |
|------|-----|-----|
| `.dark .bottom-tab-bar` background | `rgba(38, 30, 22, 0.92)` | `rgba(5, 14, 24, 0.92)` |
| `.dark .bottom-tab-bar` border-top | `rgba(180, 130, 70, 0.14)` | `rgba(201, 168, 76, 0.18)` |
| `.bottom-tab-bar` box-shadow | `rgba(80, 40, 10, 0.08)` | `rgba(13, 27, 42, 0.12)` |

Leave the `.tab-bar-notification` badge (`#e53e3e`) unchanged — red is correct for notification dots.

- [ ] **Step 2: Commit**

```bash
git add src/components/BottomTabBar.css
git commit -m "feat(theme): update BottomTabBar to navy dark mode"
```

---

### Task 7: Update Screen.css

**Files:**
- Modify: `src/components/Screen.css`

- [ ] **Step 1: Replace hard-coded colors**

Find the dark nav bar background values:

| Old | New |
|-----|-----|
| `rgba(30, 22, 18, 0.92)` | `rgba(5, 14, 24, 0.92)` |
| `rgba(180, 130, 70, 0.1)` | `rgba(201, 168, 76, 0.14)` |

- [ ] **Step 2: Commit**

```bash
git add src/components/Screen.css
git commit -m "feat(theme): update Screen nav bar to navy dark mode"
```

---

### Task 8: Update ProfileScreen.css

**Files:**
- Modify: `src/components/ProfileScreen.css`

- [ ] **Step 1: Replace hard-coded colors**

| Old | New |
|-----|-----|
| `rgba(30, 22, 18, 0.92)` | `rgba(5, 14, 24, 0.92)` (header bg) |
| `rgba(180, 130, 70, 0.1)` | `rgba(201, 168, 76, 0.14)` (border) |
| `rgba(255, 255, 255, 0.07)` | `rgba(201, 168, 76, 0.06)` (subtle card bg) |
| `rgba(255, 255, 255, 0.12)` | `rgba(201, 168, 76, 0.10)` (card bg) |
| `rgba(255, 255, 255, 0.1)` | `rgba(201, 168, 76, 0.08)` (alt card bg) |
| `rgba(0, 0, 0, 0.55)` | `rgba(5, 14, 24, 0.70)` (overlay) |

- [ ] **Step 2: Commit**

```bash
git add src/components/ProfileScreen.css
git commit -m "feat(theme): update ProfileScreen to navy gold palette"
```

---

### Task 9: Update SocialScreen.css + ExploreScreen.css

**Files:**
- Modify: `src/components/SocialScreen.css`
- Modify: `src/components/ExploreScreen.css`

- [ ] **Step 1: Audit both files**

```bash
grep -n "rgba\|#[0-9a-fA-F]" src/components/SocialScreen.css src/components/ExploreScreen.css | grep -v "var(--\|transparent\|#000\b\|#fff\b"
```

- [ ] **Step 2: Replace brown/sand hard-coded colors**

Apply the same substitution table as Task 4:
- `rgba(180, 130, 70, ...)` → `rgba(201, 168, 76, ...)`
- `rgba(38, 30, 22, ...)` / `rgba(30, 22, 18, ...)` → `rgba(5, 14, 24, ...)`
- `rgba(80, 40, 10, ...)` → `rgba(13, 27, 42, ...)`

- [ ] **Step 3: Commit**

```bash
git add src/components/SocialScreen.css src/components/ExploreScreen.css
git commit -m "feat(theme): update SocialScreen + ExploreScreen to navy gold"
```

---

### Task 10: Update GamesPanel.css + games/games.css

**Files:**
- Modify: `src/components/GamesPanel.css`
- Modify: `src/components/games/games.css`

- [ ] **Step 1: Replace hard-coded colors in GamesPanel.css**

| Old | New |
|-----|-----|
| `rgba(180, 130, 70, 0.14)` | `rgba(201, 168, 76, 0.18)` |
| `rgba(180, 130, 70, 0.15)` | `rgba(201, 168, 76, 0.20)` |
| `rgba(0,0,0,0.05)` (progress track) | `rgba(13, 27, 42, 0.08)` (light) / keep as-is in dark overrides |

Also update `--card-bg`, `--border`, `--text` fallback values in `GamesPanel.css`:
- `--card-bg, #fff` → `--glass-bg-heavy, rgba(255,248,220,0.52)`
- `--border, rgba(0,0,0,0.08)` → `--glass-border, rgba(201,168,76,0.35)`
- `--text, #1a1a1a` → `--text-primary, #0d1b2a`
- `--text-secondary, #6b7280` → `--text-secondary, #1b3a5c`

- [ ] **Step 2: Audit games/games.css**

```bash
grep -n "rgba\|#[0-9a-fA-F]" src/components/games/games.css | grep -v "var(--\|transparent\|#000\b\|#fff\b"
```
Apply same substitutions for any brown/sand values found.

- [ ] **Step 3: Commit**

```bash
git add src/components/GamesPanel.css src/components/games/games.css
git commit -m "feat(theme): update Games UI to navy gold palette"
```

---

## Chunk 3: Content Components + XP

### Task 11: Update YearInReview.css

YearInReview has its own dark card theming with many hard-coded brown values — it needs the most work.

**Files:**
- Modify: `src/components/YearInReview.css`

- [ ] **Step 1: Audit**

```bash
grep -n "rgba\|#[0-9a-fA-F]" src/components/YearInReview.css | grep -v "var(--\|transparent\|#000\b\|#fff\b"
```

- [ ] **Step 2: Replace all old-palette values**

Key substitutions:
| Old | New |
|-----|-----|
| `#1c1510` | `#0d1b2a` |
| `linear-gradient(165deg, #1c1510 0%, #251a0e 40%, #2f1e0a 100%)` | `linear-gradient(165deg, #050e18 0%, #0d1b2a 40%, #112236 100%)` |
| `rgba(192, 122, 48, 0.1)` (glow shadow) | `rgba(201, 168, 76, 0.12)` |
| `rgba(192, 122, 48, 0.4)` (box-shadow) | `rgba(201, 168, 76, 0.35)` |
| `rgba(192, 122, 48, 0.6)` (progress fill) | `rgba(201, 168, 76, 0.70)` |
| `#c07a30` / `#e8a84a` / `#f0c070` (gradient stops) | `#c9a84c` / `#d4b85c` / `#e8d5a3` |
| `linear-gradient(135deg, #c07a30 0%, #e8a84a 50%, #f0c070 100%)` | `linear-gradient(135deg, #c9a84c 0%, #d4b85c 50%, #e8d5a3 100%)` |
| `linear-gradient(135deg, #c07a30, #a06020)` | `linear-gradient(135deg, #c9a84c, #a88a30)` |
| `linear-gradient(to top, #c07a30, #e8a84a)` | `linear-gradient(to top, #d4933a, #c9a84c)` |
| `#e8a84a` (standalone text color) | `#c9a84c` |
| `#1c1510` (modal bg) | `#0d1b2a` |

- [ ] **Step 3: Visual check**

Open Year in Review. The dark card should now be deep navy, gold gradient elements should shift to the new gold tones.

- [ ] **Step 4: Commit**

```bash
git add src/components/YearInReview.css
git commit -m "feat(theme): update YearInReview to deep navy + gold"
```

---

### Task 12: Update FriendsPanel.css + ChallengesPanel.css

**Files:**
- Modify: `src/components/FriendsPanel.css`
- Modify: `src/components/ChallengesPanel.css`

- [ ] **Step 1: Audit both**

```bash
grep -n "rgba\|#[0-9a-fA-F]" src/components/FriendsPanel.css src/components/ChallengesPanel.css | grep -v "var(--\|transparent\|#000\b\|#fff\b"
```

- [ ] **Step 2: Replace**

| Old | New |
|-----|-----|
| `rgba(216, 150, 72, 0.2)` | `rgba(201, 168, 76, 0.18)` |
| `rgba(216, 150, 72, 0.3)` | `rgba(201, 168, 76, 0.28)` |
| Any `rgba(180, 130, 70, ...)` | `rgba(201, 168, 76, ...)` |
| Any `rgba(192, 122, 48, ...)` | `rgba(201, 168, 76, ...)` |

- [ ] **Step 3: Commit**

```bash
git add src/components/FriendsPanel.css src/components/ChallengesPanel.css
git commit -m "feat(theme): update Friends + Challenges panels to gold"
```

---

### Task 13: Update remaining component CSS files

**Files:**
- Modify: `src/components/UnescoPanel.css`
- Modify: `src/components/ActivityFeed.css`
- Modify: `src/components/Leaderboard.css`
- Modify: `src/components/ComparisonView.css`
- Modify: `src/components/ConfirmDialog.css`
- Modify: `src/components/MapSkeleton.css`
- Modify: `src/components/EasterEggPrompt.css`

- [ ] **Step 1: Audit all 7 files at once**

```bash
grep -n "rgba\|#[0-9a-fA-F]" \
  src/components/UnescoPanel.css \
  src/components/ActivityFeed.css \
  src/components/Leaderboard.css \
  src/components/ComparisonView.css \
  src/components/ConfirmDialog.css \
  src/components/MapSkeleton.css \
  src/components/EasterEggPrompt.css \
  | grep -v "var(--\|transparent\|#000\b\|#fff\b\|#e53e3e\|#48bb78\|#fc8181"
```

- [ ] **Step 2: Apply standard substitutions to all matches**

Same rules as Task 4:
- Brown glass bgs → navy glass bgs
- `rgba(180–216, 130–150, 70–72, ...)` → `rgba(201, 168, 76, ...)`
- `rgba(192, 122, 48, ...)` → `rgba(201, 168, 76, ...)`
- Dark brown backgrounds → `rgba(5, 14, 24, ...)` or `rgba(13, 27, 42, ...)`

Note: leave red (`#e53e3e`), green (`#48bb78`), error/success colors as-is — these are semantic, not brand colors.

- [ ] **Step 3: Commit**

```bash
git add \
  src/components/UnescoPanel.css \
  src/components/ActivityFeed.css \
  src/components/Leaderboard.css \
  src/components/ComparisonView.css \
  src/components/ConfirmDialog.css \
  src/components/MapSkeleton.css \
  src/components/EasterEggPrompt.css
git commit -m "feat(theme): update remaining component CSS to navy gold palette"
```

---

### Task 14: Update xp-styles.css

**Files:**
- Modify: `src/xp-styles.css`

- [ ] **Step 1: Audit**

```bash
grep -n "rgba\|#[0-9a-fA-F]" src/xp-styles.css | grep -v "var(--\|transparent\|#000\b\|#fff\b"
```

- [ ] **Step 2: Update XP/level colors**

The XP system uses tier colors (`--tier-color`) and `#CD7F32` (bronze default). These are intentional tier colors — leave tier-specific colors (`#CD7F32` bronze, `#C0C0C0` silver, `#FFD700` gold) alone as they're semantic achievement tiers.

Update only background/glass values:
- Any `rgba(205, 127, 50, 0.12)` (bronze glow) — keep, it's tier-specific
- Any `rgba(180, 130, 70, ...)` → `rgba(201, 168, 76, ...)`
- Any `rgba(192, 122, 48, ...)` → `rgba(201, 168, 76, ...)`

- [ ] **Step 3: Commit**

```bash
git add src/xp-styles.css
git commit -m "feat(theme): update XP styles to gold palette"
```

---

## Chunk 4: Map Colors + Final QA

### Task 15: Update visited fill color in WorldMap.jsx

**Files:**
- Modify: `src/components/WorldMap.jsx`

- [ ] **Step 1: Find the visited fill color**

```bash
grep -n "fillColor\|fill.*visited\|visitedColor\|#d4\|#c8\|#e8c\|tan\|sandybrown" src/components/WorldMap.jsx | head -20
```

- [ ] **Step 2: Update visited fill to warm amber**

Find the default visited country fill color (currently a warm tan/sand, something like `#d4a96a` or `#c8a878`) and replace with `#d4933a`.

Also find the wishlist/planned fill and update to `#e8c87a`.

- [ ] **Step 3: Verify**

In the app, mark a country as visited. It should appear as warm amber (`#d4933a`), clearly distinct from the pale parchment of unvisited countries.

- [ ] **Step 4: Commit**

```bash
git add src/components/WorldMap.jsx
git commit -m "feat(theme): update map visited fill to warm amber #d4933a"
```

---

### Task 16: Update visited fill in all other map components

**Files:**
- Modify: `src/components/SwissMap.jsx`
- Modify: all other tracker map components (check with grep below)

- [ ] **Step 1: Find all map components with fill colors**

```bash
grep -rln "fillColor\|visitedColor\|fill.*#" src/components/ | grep -v ".css"
```

- [ ] **Step 2: Apply same #d4933a update to each**

For each file found, apply the same update as Task 15 — visited fill → `#d4933a`, wishlist fill → `#e8c87a`.

- [ ] **Step 3: Commit**

```bash
git add src/components/SwissMap.jsx  # plus any others found
git commit -m "feat(theme): update all tracker map fills to warm amber"
```

---

### Task 17: Final visual QA + push

- [ ] **Step 1: Full visual audit in light mode**

Open the app in light mode. Click through:
- [ ] Main sidebar — navy text on parchment, gold dividers
- [ ] Achievements panel — gold accent on unlocked badges
- [ ] Stats modal — Playfair Display headings, gold progress bars
- [ ] Bucket List — gold UI elements
- [ ] Games panel — navy/gold card theme
- [ ] Friends panel — gold comparison bars

- [ ] **Step 2: Full visual audit in dark mode**

Toggle dark mode. Check:
- [ ] Background is deep navy, not dark brown
- [ ] Text is antique cream, not warm beige
- [ ] Glass cards have gold-tinted borders
- [ ] Year in Review dark card is navy, gold gradients
- [ ] Bottom tab bar is deep navy
- [ ] Mobile screens (Profile, Social, Explore) are navy

- [ ] **Step 3: Check map colors**

Mark a country visited → amber `#d4933a`. Mark wishlist → pale gold. Unvisited → parchment.

- [ ] **Step 4: Create PR**

```bash
git push origin <branch-name>
gh pr create --title "feat(theme): full Deep Navy & Gold CSS redesign" \
  --body "Full palette overhaul per design spec docs/superpowers/specs/2026-03-10-theme-redesign-design.md. Warm Parchment light / Deep Navy dark, gold glassmorphism, Playfair Display + Inter typography, warm amber map visited color."
```
