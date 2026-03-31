# ToDo: Icons, Logos & Visual Assets — Replace Emojis with Custom Art

**Date:** 2026-02-24
**Status:** Partially complete — logo/brand assets exist, but the full emoji-to-custom-icon migration has not started
**Priority:** High
**Scope:** Replace all emoji usage across the app with custom-designed icons, logos, and imagery

---

## Overview

The app currently uses emoji characters for all visual elements — achievement badges (👣🚀🧭🎒💯), tracker icons (🇨🇭🇺🇸), navigation labels, and map layer indicators. This creates an inconsistent cross-platform look (emojis render differently on iOS/Android/Windows) and feels generic. Replace every emoji with a custom-designed icon set in a unified visual style.

## Reality Check (2026-03-25)

- Brand assets now exist under `public/logo*`, `public/icons/`, and `public/brand/`
- The app still renders emoji in achievements, tracker labels, some game cards, and activity UI
- This plan is now more of a visual-system migration than a greenfield asset creation task

## Current Emoji Usage Audit

### Achievement Icons (`src/config/achievements.json` — 80+ achievements)
Every achievement uses an emoji as its `"icon"` field:
- **General:** 👣🚀🧭🎒💯🗺️🌍🎯🏅🔥🏆👑🌟
- **Switzerland:** 🧀⛰️🏔️🇨🇭
- **USA:** 🦅🌽🗽🎸🇺🇸
- **National Parks:** 🌿🌲🏞️🦌🐻🦬⭐
- **Manhattan/NYC:** 🏦🎭🌆🎨🗼🏙️🚇🚕🌭🍕🌃🗽
- **Norway:** 🐟🎿🇳🇴🌌❄️
- **Canada:** 🦫🍁🇨🇦🐻‍❄️🏔️
- **World:** 🌐✈️🛫🗺️🧳🌏🛩️💎🚀🛸🧭🌐🗺️🌍🌎🎯🏅🔥🏆🇪🇺🌍🌏🌎🗽🏝️
- **Capitals:** 🏛️🏰🕌🏛️🗼⛩️🏟️🌆👑
- **Geographic Feats:** 🧊🐧🌅🌇🧭🌐🗺️♨️🔬🔎
- **Fun Facts:** 🏝️🚤⛵🏜️🐪🏔️💼🏦❄️📐🌍🪐👤👥🌆
- **Collector:** 🎖️🏅🎪💎🗿🎭
- **UNESCO:** 🏛️🏺🗿🏰🌍🎨🌏📜
- **Challenges:** 🎯🏆🥇🤝✨
- **Secret:** 🕎

### Sidebar / Tab Icons (`src/components/Sidebar.jsx`)
- Tracker selection tabs use emoji flags (🇨🇭🇺🇸🇳🇴🇨🇦🇯🇵🇦🇺) and symbols
- Modal triggers: 👥 (Friends), 📊 (Stats), 📌 (Bucket List), 🏆 (Achievements)

### Map Layers (`src/config/mapLayers.json`)
- Layer icons use emoji

### Other Components
- `src/components/ChallengesPanel.jsx` — challenge type/difficulty icons
- `src/components/BucketListPanel.jsx` — priority indicators (🔴🟡🟢)
- `src/components/ActivityFeed.jsx` — action type icons
- `src/components/YearInReview.jsx` — stat card icons
- `src/components/Leaderboard.jsx` — ranking medals
- `src/components/StatsModal.jsx` — stat category icons
- `src/components/Onboarding.jsx` — step icons
- `src/components/EasterEggPrompt.jsx` — easter egg icons
- App logo: `public/logo.png` (only static asset)

## Goals

1. Design a cohesive visual identity with consistent style across ALL icons
2. Create AI prompts for batch-generating every icon type
3. Define output specs (format, sizes, color palette)
4. Replace emoji usage with `<img>` or inline SVGs
5. Create app logo, favicon, and social sharing images

## Icon Style Guide

### Recommended Style
**Flat illustration with warm palette** — matches the app's existing glassmorphism aesthetic:
- Clean outlines (2px stroke)
- Warm amber/sand fill palette (matching `#c07a30`, `#d89648`, `#f5e6d0`)
- Soft shadows (no hard drop shadows)
- Rounded corners/caps
- Consistent canvas size: 64×64 base, exported at 1x/2x/3x
- Format: SVG (primary) + PNG fallback (for complex illustrations)
- Background: transparent

### Color Palette for Icons
| Token | Color | Use |
|-------|-------|-----|
| Primary | `#c07a30` | Main icon color |
| Primary Light | `#d89648` | Highlights, fills |
| Accent | `#e8a849` | Warm glow, active states |
| Neutral | `#8b7355` | Outlines, secondary |
| Background | `#f5e6d0` | Fill backgrounds |
| Success | `#7cb342` | Completed/visited states |
| Warning | `#e67e22` | High priority, alerts |
| White | `#ffffff` | Internal details |

## AI Prompts for Icon Generation

### Base Prompt Preamble (use for ALL icons)
```
Create a flat illustration icon on a transparent background.
Style: clean, modern, minimal flat design with soft warm colors.
Color palette: amber (#c07a30), warm gold (#d89648), sand (#f5e6d0), with white (#ffffff) details.
Canvas: square, centered composition, 2px consistent outline weight.
No text. No gradients. No 3D effects. No shadows.
Output: SVG-ready, single object, clean edges.
```

### Achievement Icons — Per-Category Prompts

#### General Achievements (13 icons)
```
[Base Preamble]
Create an icon for a travel achievement badge:
1. "First Steps" — a single footprint on a path
2. "Getting Started" — a compass rose with a glowing needle
3. "Explorer" — binoculars looking at horizon
4. "Adventurer" — a hiking backpack with a flag
5. "Centurion" — stylized "100" with laurel wreath
6. "Cartographer" — an unrolled map with pin markers
7. "Globe Trotter" — a spinning globe with dotted trail
8. "Quarter Way" — a pie chart 25% filled
9. "Half Way There" — a medal with "50%" engraved
10. "Almost There" — a flame/fire symbol
11. "Completionist" — a golden trophy cup
12. "Double Crown" — two crowns stacked
13. "Triple Star" — three stars in triangle formation
```

#### Switzerland Achievements (4 icons)
```
[Base Preamble]
Create an icon for a Swiss travel achievement:
1. "Swiss Start" — a wedge of Swiss cheese with an alpine flower
2. "Alpine Explorer" — mountain peaks with a Swiss cross flag
3. "Swiss Pro" — the Matterhorn with a golden star
4. "Swiss Complete" — a Swiss shield with all 26 canton symbols abstracted as dots
```

#### USA Achievements (5 icons)
```
[Base Preamble]
Create an icon for a USA travel achievement:
1. "American Start" — a bald eagle head in profile
2. "Road Tripper" — a highway disappearing into sunset
3. "State Explorer" — Statue of Liberty torch
4. "Cross Country" — an electric guitar with stars
5. "Coast to Coast" — USA silhouette with east & west coast highlighted
```

#### National Parks (7 icons)
```
[Base Preamble]
Create an icon for a US National Parks achievement:
1. "First Park" — a green leaf with a park ranger hat
2. "Nature Lover" — an evergreen tree (single, proud)
3. "Park Ranger" — a mountain valley with a river
4. "Wildlife Watcher" — a deer silhouette in a forest
5. "Park Master" — a bear paw print
6. "Park Legend" — a bison/buffalo head in profile
7. "Every Park" — a radiant gold star with forest silhouette
```

#### World Achievements (20 icons)
```
[Base Preamble]
Create an icon for a world travel achievement:
1. "First Country" — a globe with a single pin
2. "Five Countries" — an airplane taking off
3. "Ten Countries" — airplane in flight with trail
4. "Twenty Countries" — a folded world map
5. "Thirty Countries" — a suitcase with travel stickers
6. "Fifty Countries" — an eastern hemisphere globe
7. "75 Countries" — a private jet silhouette
8. "Century Club" — a diamond gemstone
9. "150 Nations" — a rocket ship
10. "200 Nations" — a flying saucer/UFO
[... continue for continent achievements, percent achievements ...]
```

#### Capital Achievements (9 icons)
```
[Base Preamble]
Create an icon for a world capitals achievement:
1. "First Capital" — a classical building with columns (parliament)
2. "Capital Start" — a medieval castle tower
3. "Capital Explorer" — a mosque dome and minaret
4. "Power Traveler" — a capitol dome building
5. "Capital Connoisseur" — the Eiffel Tower
6. "Capital Collector" — a Japanese torii gate
7. "Century Capitals" — a colosseum/arena
8. "Capital Master" — a city skyline at dusk
9. "Every Capital" — a golden crown
```

#### Geographic Feats (10 icons)
```
[Base Preamble]
Create an icon for a geographic feat achievement:
1. "Top of the World" — an ice crystal / snowflake
2. "Bottom of the World" — a penguin on ice
3. "Where the Sun Rises" — a sunrise over ocean
4. "Where the Sun Sets" — a sunset over ocean
5. "Pole to Pole" — a compass with N and S highlighted
6. "Both Hemispheres" — a globe with N/S dividing line
7. "Four Corners" — a map with 4 corner pins
8. "Equator Straddler" — a thermometer / hot springs symbol
9. "Micro Explorer" — a magnifying glass over a tiny island
10. "Tiny Trio" — three tiny flags on miniature map
```

#### UNESCO Achievements (8 icons)
```
[Base Preamble]
Create an icon for a UNESCO heritage achievement:
1. "World Heritage Explorer" — a classical temple with UNESCO diamond
2. "Heritage Hunter" — an ancient vase/amphora
3. "Heritage Collector" — a moai stone head
4. "Heritage Master" — a castle/fortress
5. "Heritage Legend" — a golden globe with laurel
6. "Cultural & Natural" — palette + leaf combined
7. "Global Heritage" — globe with heritage pins on all continents
8. "Time Traveler" — an ancient scroll
```

#### Challenge Achievements (5 icons)
```
[Base Preamble]
Create an icon for a travel challenge achievement:
1. "First Challenge" — a target/bullseye with an arrow
2. "Challenge Enthusiast" — a trophy with the number 5
3. "Champion" — a gold medal with the number 1
4. "Team Player" — a handshake
5. "Challenge Creator" — a sparkle/wand creating something
```

### App Logo & Branding
```
[Base Preamble]
Create an app logo for "World Tracker" — a travel tracking app.
Concept: a stylized globe with a winding dotted path around it, with a pin/marker at the destination.
Colors: warm amber (#c07a30) globe, gold (#d89648) path, sand (#f5e6d0) continents.
Style: modern, minimal, recognizable at small sizes (app icon).
Variations needed: full logo (with text), icon only (square for app stores), favicon (16x16).
```

### Tracker Icons (10 trackers)
```
[Base Preamble]
Create a tracker icon set — each icon represents a country/region tracker:
1. Switzerland — Matterhorn peak with Swiss cross
2. United States — stylized US map silhouette with stars
3. US National Parks — a ranger hat with mountain
4. NYC — city skyline (Brooklyn Bridge + Empire State)
5. Norway — fjord with northern lights
6. Canada — maple leaf with mountain
7. Japan — torii gate with cherry blossoms
8. Australia — kangaroo silhouette with outback
9. World Map — a globe with continents
10. World Capitals — a capitol building dome
```

### Navigation / UI Icons
```
[Base Preamble]
Create a UI icon set for a travel app navigation:
1. Friends/Social — two person silhouettes
2. Statistics — bar chart with upward trend
3. Bucket List — a pushpin with checklist
4. Achievements — a trophy/badge
5. Settings — a gear wheel
6. Search — a magnifying glass
7. Export — an outward arrow from a box
8. Share — a share/branch icon
9. Dark Mode — a moon
10. Map Layers — stacked squares
11. Filter — a funnel
12. Calendar — a calendar page
```

## Implementation Plan

### Step 1: Generate Assets
- Use AI image generation (Midjourney / DALL-E / Stable Diffusion) with the prompts above
- Generate at 512×512 minimum, then trace to SVG or export at required sizes
- Save to `public/icons/` folder structure:
  ```
  public/icons/
    logo/
      logo-full.svg
      logo-icon.svg
      favicon.ico
      favicon-16.png
      favicon-32.png
      apple-touch-icon.png
    achievements/
      first-steps.svg
      getting-started.svg
      explorer.svg
      ... (80+ files)
    trackers/
      ch.svg
      us.svg
      usparks.svg
      nyc.svg
      no.svg
      ca.svg
      jp.svg
      au.svg
      world.svg
      capitals.svg
    ui/
      friends.svg
      stats.svg
      bucket-list.svg
      achievements.svg
      settings.svg
      search.svg
      export.svg
      share.svg
      dark-mode.svg
      map-layers.svg
      filter.svg
      calendar.svg
  ```

### Step 2: Create Icon Component
```jsx
// src/components/Icon.jsx
function Icon({ name, size = 24, className = '' }) {
  return (
    <img
      src={`/icons/${name}.svg`}
      alt=""
      width={size}
      height={size}
      className={`app-icon ${className}`}
      loading="lazy"
    />
  );
}
```

### Step 3: Replace Emojis
- Update `src/config/achievements.json` — change `"icon": "👣"` to `"icon": "achievements/first-steps"`
- Update `AchievementCard.jsx` — render `<Icon name={achievement.icon} />` instead of emoji text
- Update `Sidebar.jsx` — replace all emoji labels with `<Icon>` components
- Update `mapLayers.json` — replace emoji icons
- Update all other components that render emojis

### Step 4: Branding
- Replace `public/logo.png` with new logo
- Add favicon.ico + apple-touch-icon to `index.html`
- Add Open Graph / social sharing meta images

## Files to Create
| File | Purpose |
|------|---------|
| `src/components/Icon.jsx` | Reusable icon component |
| `public/icons/` (directory tree) | All icon assets |
| `index.html` (modify) | Add favicon, apple-touch-icon meta tags |

## Files to Modify
| File | Change |
|------|--------|
| `src/config/achievements.json` | Replace emoji `icon` fields with asset paths |
| `src/components/AchievementCard.jsx` | Render `<Icon>` instead of emoji text |
| `src/components/Achievements.jsx` | Update icon rendering |
| `src/components/Sidebar.jsx` | Replace emoji tab labels with `<Icon>` |
| `src/config/mapLayers.json` | Replace emoji icons |
| `src/components/BucketListPanel.jsx` | Replace priority emoji indicators |
| `src/components/ChallengesPanel.jsx` | Replace challenge type icons |
| `src/components/ActivityFeed.jsx` | Replace action type icons |
| `src/components/YearInReview.jsx` | Replace stat card icons |
| `src/components/Leaderboard.jsx` | Replace ranking emojis |
| `src/components/StatsModal.jsx` | Replace stat icons |
| `src/components/Onboarding.jsx` | Replace step icons |

## Estimated Effort
- Prompt creation & asset generation: ~8-10 hours
- SVG cleanup & organization: ~4-5 hours
- Icon component + integration: ~6-8 hours
- **Total: ~18-23 hours**
