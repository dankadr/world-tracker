# Achievement Popup Persistence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix achievement popups firing repeatedly on mark/unmark cycles, remove XP toasts, and add a per-country toggle cooldown to prevent accidental double-taps.

**Architecture:** Three targeted changes to `App.jsx` and one file deletion — no new components, no schema changes.

**Tech Stack:** React (useRef, useState), localStorage, Vitest + React Testing Library

---

## Background

Three bugs / UX issues motivate this work:

1. **Achievement toast replay** — `AchievementToasts` in `App.jsx` tracks "previously unlocked" achievements to detect new ones. When a country is unmarked, achievements that drop below threshold are removed from `previouslyUnlockedIds`. Re-marking that country re-unlocks the achievement and the toast fires again. This can repeat indefinitely.

2. **No toggle cooldown** — Rapidly tapping a country (e.g. a mis-tap followed by a correction) fires two toggles in quick succession, emits two `visitedchange` events, re-evaluates achievements twice, and can cause spurious toast triggers.

3. **XP toasts are noisy** — The `+25 XP` popup that appears on every country mark adds visual clutter. XP still accumulates (needed for levels and achievements), but the toast itself is unwanted.

---

## Design

### 1. Per-country toggle cooldown

**Where:** `handleToggleWorldCountry(countryCode)` in `App.jsx`

**How:** A `useRef(new Map())` called `toggleCooldowns` stores the last-toggled timestamp per country code. At the top of the handler, if `Date.now() - (toggleCooldowns.current.get(countryCode) ?? 0) < 1500`, return early without toggling.

**Scope:** World countries only. Canton, state, and park toggles have separate handlers and do not need this guard.

**Cooldown duration:** 1500ms

### 2. Achievement popup shown only once, lifetime

**Where:** `AchievementToasts` component in `App.jsx`

**How:** Add a `shownAchievementIds` ref, persisted to localStorage under `swiss-tracker-shown-ach-{userId}` (plain, non-encrypted — same pattern as the existing seen-achievements key). This set is **append-only**: IDs are added when a toast fires, never removed.

Before queuing a toast for a newly-unlocked achievement, check `shownAchievementIds` — if the ID is already there, skip it. `previouslyUnlockedIds` continues to track the current unlock state unchanged; only the toast-gate logic changes.

On mount, load `shownAchievementIds` from localStorage. On every new toast, persist the updated set.

**Key distinction from existing behaviour:** The existing `previouslyUnlockedIds` ref shrinks when achievements un-unlock. `shownAchievementIds` never shrinks.

### 3. Remove XP toast component

**Where:** `App.jsx` (remove render), `src/components/XpNotification.jsx` (delete file)

**What stays:** `useXp.jsx`, `xpSystem.js`, `xp-styles.css` — XP accumulation, levels, and achievement triggers are unaffected.

---

## Files

| Action | Path |
|--------|------|
| Modify | `src/App.jsx` |
| Delete | `src/components/XpNotification.jsx` |
| Modify (tests) | `src/components/__tests__/AchievementToasts.test.jsx` (if exists) or create new |

---

## Out of Scope

- Cooldown for canton, state, park, or UNESCO toggles
- Visual feedback during cooldown (dimming, cursor change)
- Removing the XP hook or XP data — only the toast UI is removed
- Server-side achievement tracking
