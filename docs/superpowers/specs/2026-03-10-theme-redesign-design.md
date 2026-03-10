# Right World Tracker — Full Theme Redesign

**Date:** 2026-03-10
**Status:** Approved
**Scope:** Full CSS redesign — color tokens, glassmorphism, typography, component CSS files, map colors

---

## Overview

Replace the current warm sand/brown palette with the Deep Navy & Gold explorer identity that matches the RWT logo. Two distinct modes: Warm Parchment (light) and Deep Navy (dark), both anchored by gold accents and warm amber for visited regions.

---

## Color Palette

### Light Mode — Warm Parchment + Navy + Gold

| Token | Value | Description |
|-------|-------|-------------|
| `--body-bg` | `linear-gradient(135deg, #fdf8ee 0%, #f7edce 40%, #ede0b8 100%)` | Warm parchment gradient |
| `--text-primary` | `#0d1b2a` | Deep navy — maximum contrast |
| `--text-secondary` | `#1b3a5c` | Medium navy |
| `--text-tertiary` | `#4a6a8a` | Slate blue |
| `--text-muted` | `#8a9aaa` | Blue-grey |
| `--text-on-glass` | `#0d1b2a` | Deep navy |
| `--glass-bg` | `rgba(255, 248, 220, 0.28)` | Warm gold-tinted glass |
| `--glass-bg-heavy` | `rgba(255, 248, 220, 0.52)` | |
| `--glass-bg-subtle` | `rgba(255, 248, 220, 0.14)` | |
| `--glass-border` | `rgba(201, 168, 76, 0.35)` | Gold border |
| `--glass-border-subtle` | `rgba(201, 168, 76, 0.18)` | |
| `--glass-highlight` | `rgba(255, 248, 220, 0.70)` | |
| `--glass-shadow` | `0 8px 32px rgba(13, 27, 42, 0.08)` | Navy shadow |
| `--glass-shadow-elevated` | `0 12px 40px rgba(13, 27, 42, 0.12)` | |
| `--glass-specular` | `inset 1px 1px 0 rgba(255,248,220,0.60), inset 0 0 8px rgba(201,168,76,0.12)` | |
| `--glass-specular-strong` | `inset 1px 1px 0 rgba(255,248,220,0.80), inset 0 0 12px rgba(201,168,76,0.18)` | |
| `--glass-hover-glow` | `0 0 20px rgba(201, 168, 76, 0.25)` | Gold glow |
| `--bar-track` | `rgba(13, 27, 42, 0.08)` | |
| `--divider` | `rgba(201, 168, 76, 0.30)` | Gold divider |
| `--input-bg` | `rgba(255, 248, 220, 0.40)` | |
| `--hover-bg` | `rgba(255, 248, 220, 0.30)` | |
| `--accent` | `#c9a84c` | Gold |
| `--accent-hover` | `#b8972e` | Darker gold |
| `--visited` | `#d4933a` | Warm amber |

### Dark Mode — Deep Navy + Gold + Antique Cream

| Token | Value | Description |
|-------|-------|-------------|
| `--body-bg` | `linear-gradient(135deg, #050e18 0%, #0d1b2a 40%, #112236 100%)` | Deep navy gradient |
| `--text-primary` | `#e8d5a3` | Antique cream |
| `--text-secondary` | `#b8a870` | Gold-tan |
| `--text-tertiary` | `#7a8a9a` | Slate |
| `--text-muted` | `#4a5a6a` | Dark slate |
| `--text-on-glass` | `#e8d5a3` | Antique cream |
| `--glass-bg` | `rgba(13, 27, 42, 0.55)` | Navy glass |
| `--glass-bg-heavy` | `rgba(13, 27, 42, 0.78)` | |
| `--glass-bg-subtle` | `rgba(13, 27, 42, 0.30)` | |
| `--glass-border` | `rgba(201, 168, 76, 0.22)` | Gold border |
| `--glass-border-subtle` | `rgba(201, 168, 76, 0.12)` | |
| `--glass-highlight` | `rgba(201, 168, 76, 0.08)` | |
| `--glass-shadow` | `0 8px 32px rgba(0, 0, 0, 0.45)` | Deep shadow |
| `--glass-shadow-elevated` | `0 12px 40px rgba(0, 0, 0, 0.55)` | |
| `--glass-specular` | `inset 1px 1px 0 rgba(201,168,76,0.14), inset 0 0 8px rgba(201,168,76,0.06)` | |
| `--glass-specular-strong` | `inset 1px 1px 0 rgba(201,168,76,0.20), inset 0 0 12px rgba(201,168,76,0.10)` | |
| `--glass-hover-glow` | `0 0 20px rgba(201, 168, 76, 0.18)` | Subtle gold glow |
| `--bar-track` | `rgba(201, 168, 76, 0.10)` | |
| `--divider` | `rgba(201, 168, 76, 0.16)` | Gold divider |
| `--input-bg` | `rgba(5, 14, 24, 0.60)` | |
| `--hover-bg` | `rgba(27, 58, 92, 0.45)` | Navy hover |
| `--accent` | `#c9a84c` | Gold |
| `--accent-hover` | `#d4b85c` | Lighter gold (dark mode) |
| `--visited` | `#d4933a` | Warm amber |

---

## Map Colors

| State | Color | Notes |
|-------|-------|-------|
| Visited | `#d4933a` | Warm amber — replaces current tan/sand |
| Wishlist | `#e8c87a` | Pale gold |
| Unvisited | `#ddd6c8` | Light parchment (unchanged) |
| Selected | `#0d1b2a` | Deep navy |
| Hover | `#c9a84c` | Gold |

Applied in: `WorldMap.jsx`, `SwissMap.jsx`, and all other tracker map components.

---

## Typography

| Role | Font | Weight | Notes |
|------|------|--------|-------|
| App title, section headings, stat numbers | Playfair Display | 400/600/700 | Elegant serif, matches lettermark style |
| Body, labels, buttons, inputs | Inter | 300/400/500/600 | Clean, legible system font |

Google Fonts import added to `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
```

Applied to:
- `.sidebar-title` — Playfair Display 700
- `.stats-numbers`, `.level-number` — Playfair Display 700
- Section headings in StatsModal, Achievements, BucketList — Playfair Display 600
- Everything else — Inter (already system default, just make explicit)

---

## Files to Update

### Core
| File | Change |
|------|--------|
| `src/App.css` | Full rewrite of `:root` and `[data-theme="dark"]` blocks + all hard-coded hex audit |
| `src/xp-styles.css` | XP bar, level badge colors → gold system |
| `index.html` | Add Playfair Display + Inter Google Fonts link |

### Component CSS (hard-coded color audit)
| File | Key changes |
|------|-------------|
| `src/components/GamesPanel.css` | Button colors, card borders, score highlights |
| `src/components/Screen.css` | Navigation bar background, back button |
| `src/components/BottomTabBar.css` | Tab bar bg, active indicator color |
| `src/components/ProfileScreen.css` | Stats cards, progress ring color |
| `src/components/SocialScreen.css` | Friend cards, challenge cards |
| `src/components/ExploreScreen.css` | List items, search bar |
| `src/components/FriendsPanel.css` | Friend list, comparison bars |
| `src/components/ChallengesPanel.css` | Challenge progress, streak colors |
| `src/components/YearInReview.css` | Summary cards, timeline |
| `src/components/UnescoPanel.css` | Site cards, category badges |
| `src/components/ActivityFeed.css` | Feed items, timestamps |
| `src/components/Leaderboard.css` | Rank colors, podium |
| `src/components/ComparisonView.css` | Comparison bars |
| `src/components/ConfirmDialog.css` | Dialog buttons |
| `src/components/MapSkeleton.css` | Skeleton shimmer colors |
| `src/components/EasterEggPrompt.css` | Special theming |

### Map Components (visited color)
| File | Change |
|------|--------|
| `src/components/WorldMap.jsx` | Default visited fill → `#d4933a` |
| `src/components/SwissMap.jsx` | Canton visited fill → `#d4933a` |
| All other tracker map components | Same visited fill update |

---

## Glassmorphism Retuning

The existing glass effects use warm sand tones (`rgba(255, 248, 240, ...)`). Both modes need retuning:

- **Light mode glass**: switch from sandy-white to gold-cream (`rgba(255, 248, 220, ...)`) with gold borders
- **Dark mode glass**: switch from warm-brown (`rgba(60, 38, 18, ...)`) to deep navy (`rgba(13, 27, 42, ...)`) with gold specular highlights
- **Shadow color**: switch from `rgba(80, 40, 10, ...)` (brown) to `rgba(13, 27, 42, ...)` (navy) in light mode

---

## Accessibility

- Light mode: `#0d1b2a` on `#fdf8ee` background = ~14:1 contrast ratio (WCAG AAA)
- Dark mode: `#e8d5a3` on `#0d1b2a` background = ~9:1 contrast ratio (WCAG AAA)
- Gold accent `#c9a84c` on navy `#0d1b2a` = ~6.5:1 (WCAG AA for large text)
- Amber visited `#d4933a` on map parchment = sufficient for map polygon fills

---

## Out of Scope

- No changes to layout, component structure, or JavaScript logic
- No changes to localStorage keys or data model
- Dark/light mode toggle mechanism unchanged
