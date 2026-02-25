# Feature & Data Update (2026-02)

This document summarizes the latest scope reflected in the app and README refresh.

## Newer Product Features

- Added progression systems centered on **XP, levels, and achievement unlock loops**.
- Added **Bucket List Planner** workflows for planned trips and completion tracking.
- Added **Travel Challenges** (including social/challenge detail flows).
- Added **UNESCO overlay support** as an optional map layer.
- Added **Friends data + comparison panels** for side-by-side travel progress.
- Added **Year in Review** cards and yearly travel summary surfaces.
- Expanded mobile-focused UX with swipe/dismiss patterns and bottom-sheet interactions.

## Data Coverage Snapshot

Current in-repo datasets and counts:

| Dataset | Count | Source file |
|---|---:|---|
| World countries | 238 | `src/data/world.json` |
| World capitals | 192 | `src/data/capitals.json` |
| Switzerland cantons | 26 | `src/data/cantons.json` |
| USA states/territories (incl. DC, PR) | 52 | `src/data/usa.json` |
| US National Parks | 63 | `src/data/us-parks.json` |
| NYC neighborhoods | 197 | `src/data/nyc.json` |
| Norway counties + Svalbard | 16 | `src/data/norway.json` |
| Canada provinces/territories | 13 | `src/data/canada.json` |
| Japan prefectures | 47 | `src/data/japan.json` |
| Australia states/territories | 8 | `src/data/australia.json` |
| Philippines regions | 17 | `src/data/philippines.json` |
| UNESCO sites | 270 | `src/data/unesco-sites.json` |

## Notes

- The active tracker menu now spans **11 tracker views** (world + regional + capitals).
- Achievements catalog currently includes **131 definitions** in `src/config/achievements.json`.
- This file is intentionally lightweight and can be used as a quick source of truth for future docs updates.
