# Plan: Friend Comparison View

## Overview
Add a side-by-side (or overlay) comparison showing your visited regions vs a friend's visited regions on the same map. Users can select a friend and see what they've visited that you haven't, and vice versa.

## UX Design

### Entry Point
- In `FriendsPanel.jsx`, add a "Compare" button next to each friend
- Clicking opens a comparison modal or toggles comparison mode on the current map

### Comparison Modes
1. **Overlay Mode** (default): On the current map, show 3 colors:
   - 🟢 Green: Both visited
   - 🔵 Blue: Only you visited
   - 🟠 Orange: Only friend visited
   - ⬜ Gray: Neither visited
2. **Stats Comparison**: Side-by-side stat cards (total count, %, continent breakdown)

### Legend
- Floating legend box in bottom-left explaining the 3 colors
- Show friend's avatar + name in the legend

## Files to Create

### `src/components/ComparisonView.jsx`
- Main comparison component
- Props: `myVisited: Set`, `friendVisited: Set`, `geoData`, `friendInfo`
- Computes three sets: `both`, `onlyMe`, `onlyFriend`
- Renders color-coded GeoJSON layers
- Renders a floating legend

### `src/components/ComparisonLegend.jsx`
- Small floating box with color swatches + labels
- Shows friend avatar (from `avatarParts.js` system) + name

### `src/components/ComparisonStats.jsx`
- Two-column stat comparison
- "You: 15 / 26 (58%)" vs "Friend: 20 / 26 (77%)"
- "In common: 12" / "You're ahead: 3" / "They're ahead: 8"
- Bar chart or simple visual

## Files to Modify

### `src/components/FriendsPanel.jsx`
- Add "Compare" button per friend row
- On click: set `comparisonFriend` state (lift to parent or use context)

### `src/components/WorldMap.jsx` (and each sub-tracker map)
- When `comparisonFriend` is active, switch `getColor()` to use comparison logic
- Pass `comparisonFriend` visited data down

### `src/hooks/useFriendsData.js`
- May already fetch friend visited data — verify it returns per-tracker visited sets
- If not, add `fetchFriendVisited(friendCode, trackerId)` API call

### Backend: `backend/main.py`
- Verify endpoint exists: `GET /api/visited/{tracker_id}?friend_code=XXXX`
- If not, add an endpoint that returns a friend's visited list for a given tracker
  (respecting privacy — only if they are mutual friends)

## State Management
```
comparisonFriend: null | { code, name, avatar, visited: Set }
```
- Stored in the map page's state (e.g., `SwissPage`, `WorldPage`)
- Passed to both `MapComponent` and `ComparisonLegend`
- Clear comparison when switching trackers or closing panel

## Edge Cases
- Friend hasn't visited any region on this tracker → show message "They haven't started this tracker yet"
- Comparing on World map vs sub-tracker → comparison is per-tracker
- Guest users can't compare (no friends) → hide Compare button in guest mode

## Testing Checklist
- [ ] Compare button appears for each friend
- [ ] Clicking Compare loads friend's visited data
- [ ] Map colors update correctly (3-way split)
- [ ] Legend renders with correct friend info
- [ ] Stats comparison shows accurate numbers
- [ ] Exiting comparison restores normal map colors
- [ ] Works on mobile (legend doesn't overlap controls)
- [ ] Works in dark mode

## Estimated Effort
~6-8 hours
