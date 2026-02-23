# Color Scheme — Warm Amber Harmonization

**Date:** 2026-02-23
**Status:** Approved
**Scope:** Replace all cold blue/purple accent colors with warm amber across all CSS files

## Problem

The app uses a warm sand glassmorphism palette but several component CSS files contain cold blue (`#3498db`, `rgba(52,152,219,...)`, `#4169E1`) and purple/indigo (`#6366f1`, `#7c3aed`, `#a78bfa`) accent colors that clash with the warm aesthetic.

## Warm Amber Accent System

| Role | Value |
|---|---|
| Primary amber | `#c07a30` |
| Amber dark | `#a06020` |
| Amber light | `#e8a84a` |
| Amber with opacity | `rgba(192, 122, 48, α)` |

## Color Mapping

| Old (cold) | New (warm amber) | Used for |
|---|---|---|
| `#3498db` | `#c07a30` | Primary accent (buttons, borders, text) |
| `rgba(52, 152, 219, α)` | `rgba(192, 122, 48, α)` | Accent with opacity |
| `#2980b9` | `#a06020` | Darker accent variant |
| `#4169E1` | `#c07a30` | Royal blue (UnescoPanel focus) |
| `rgba(65, 105, 225, α)` | `rgba(192, 122, 48, α)` | Royal blue opacity |
| `rgba(100, 140, 220, α)` | `rgba(192, 122, 48, α)` | Blue opacity (App.css tab shadow) |
| `#6366f1` / `#7c3aed` / `#a78bfa` / `#c084fc` | amber gradient | YearInReview purple/indigo accents |
| `rgba(99, 102, 241, α)` | `rgba(192, 122, 48, α)` | Indigo opacity |

## Files Changed

| File | Change summary |
|---|---|
| `src/App.css` | Dark mode search focus glow, dark mode active tab shadow |
| `src/components/ChallengesPanel.css` | ~35 instances — buttons, inputs, active/selected states, focus rings, bar fills, avatars |
| `src/components/Leaderboard.css` | Self-row highlight + border, self bar fill gradient, avatar initials |
| `src/components/ActivityFeed.css` | Avatar initials gradient |
| `src/components/FriendsPanel.css` | Tab active border, badge bg, add/compare button colors |
| `src/components/ComparisonView.css` | "You" bar fill, "only me" stat color, compare button |
| `src/components/UnescoPanel.css` | Search/select focus borders and glows, hover borders |
| `src/components/YearInReview.css` | Container background (navy → warm dark) + all purple/indigo → amber gradients |

## YearInReview Container Background

The YIR story-mode overlay changes from cold navy to warm dark:
- **Old:** `linear-gradient(165deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)`
- **New:** `linear-gradient(165deg, #1c1510 0%, #251a0e 40%, #2f1e0a 100%)`

Internal purple gradients (`#6366f1 → #a78bfa → #c084fc`) become:
- `linear-gradient(135deg, #c07a30 0%, #e8a84a 50%, #f0c070 100%)`

## Unchanged Colors

These colors are intentional and must NOT be changed:
- Visit/success green: `#27ae60`, `#2ecc71`, `rgba(46, 204, 113, ...)`
- Danger/reset red: `#d32f2f`, `#e74c3c`, `rgba(211, 47, 47, ...)`, `rgba(231, 76, 60, ...)`
- Rank badge colors: `#f39c12` (gold), `#95a5a6` (silver), `#cd6839` (bronze)
- All existing `var(--glass-*)`, `var(--text-*)`, `var(--body-bg)` tokens
