# Mobile Bug Fixes & Settings Panel — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 mobile UI bugs and add a Settings panel with appearance/data/about sections.

**Architecture:** New `SettingsPanel` component slots into ProfileScreen (mobile tab) and Sidebar (desktop footer). Redundant header buttons hidden on mobile via `isMobile` prop. Map action buttons grouped into a single positioned container. Bottom sheet safe-area padding fixed in CSS.

**Tech Stack:** React, CSS custom properties, `env(safe-area-inset-*)`, `useTheme` hook, `useDeviceType` hook

**Spec:** `docs/superpowers/specs/2026-03-10-mobile-bug-fixes-design.md`

---

## Chunk 1: Foundation fixes (Bugs 1, 3, 4, 5)

### Task 1: Fix bottom sheet safe-area cut-off (Bug 1)

**Files:**
- Modify: `src/App.css` (around line 2936 — the `@supports (padding-bottom: env(safe-area-inset-bottom))` block)

**Context:** When the sheet is at full height (92vh), the content at the top gets hidden under the iOS status bar. The fix is to add `padding-top: env(safe-area-inset-top, 44px)` to `.sheet-body` when the sheet is at full snap, and ensure the sheet itself can use `100dvh` correctly.

- [ ] **Step 1: Read the current safe-area block in App.css**

Read `src/App.css` lines 2936–2955 to confirm the current safe-area CSS.

- [ ] **Step 2: Add top safe-area padding to the sheet**

In `src/App.css`, find the `@supports (padding-bottom: env(safe-area-inset-bottom))` block (around line 2937) and add inside it:

```css
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .mobile-bottom-sheet {
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* NEW: when sheet is at full snap, push content below status bar */
  .mobile-bottom-sheet[data-snap="92"] .sheet-body {
    padding-top: env(safe-area-inset-top, 44px);
  }

  @media (max-width: 768px) {
    .floating-stats {
      top: calc(12px + env(safe-area-inset-top));
    }

    .export-btn {
      top: calc(8px + env(safe-area-inset-top));
    }

    .share-banner {
      padding-top: calc(8px + env(safe-area-inset-top));
    }
  }
}
```

- [ ] **Step 3: Verify `data-snap` attribute is set on the sheet element**

Read `src/components/MobileBottomSheet.jsx` line 153 — confirm the sheet renders `<div ref={sheetRef} className="mobile-bottom-sheet" data-snap={snap}>`. The `data-snap` attribute is already set, so the CSS selector `[data-snap="92"]` will match at full height. ✅ No JSX change needed.

- [ ] **Step 4: Commit**

```bash
git add src/App.css
git commit -m "fix(mobile): add safe-area-inset-top padding when sheet is fully expanded"
```

---

### Task 2: Remove redundant header buttons on mobile (Bugs 3 + 4)

**Files:**
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/components/WorldSidebar.jsx`
- Modify: `src/App.jsx`

**Context:** On mobile the app has a bottom tab bar — Stats is in Profile tab, Friends in Social tab. The icon buttons in the sidebar header are redundant on mobile. The theme toggle will move to Settings (Task 3), so we remove it from the header on mobile here too. `isMobile` comes from `useDeviceType()` in App.jsx and must be passed as a prop to both sidebars.

- [ ] **Step 1: Add `isMobile` prop to Sidebar.jsx**

In `src/components/Sidebar.jsx`, add `isMobile` to the destructured props (line ~17):

```jsx
export default function Sidebar({
  // ... existing props ...
  isMobile,
}) {
```

Then wrap the three header icon buttons with `{!isMobile && ...}`:

```jsx
{/* Stats button — desktop only */}
{!isMobile && !readOnly && (
  <button className="header-icon-btn" onClick={() => setShowStats(true)} title="Statistics">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  </button>
)}

{/* Friends button — desktop only */}
{!isMobile && !readOnly && onOpenFriends && (
  <button className="header-icon-btn friends-header-btn" onClick={onOpenFriends} title="Friends">
    ...existing svg...
    {friendsPendingCount > 0 && (
      <span className="friends-badge">{friendsPendingCount}</span>
    )}
  </button>
)}

{/* Theme toggle — desktop only (moves to Settings on mobile) */}
{!isMobile && (
  <button
    className="theme-toggle"
    onClick={toggleTheme}
    title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
  >
    {dark ? '☀️' : '🌙'}
  </button>
)}
```

- [ ] **Step 2: Add `isMobile` prop to WorldSidebar.jsx**

In `src/components/WorldSidebar.jsx`, add `isMobile` to the destructured props (line ~49):

```jsx
export default function WorldSidebar({
  visited,
  onToggle,
  onExploreCountry,
  collapsed,
  onOpenFriends,
  friendsPendingCount,
  isMobile,
}) {
```

Wrap the friends button, stats button, and theme toggle with `{!isMobile && ...}`:

```jsx
{/* Friends button — desktop only */}
{!isMobile && onOpenFriends && (
  <button className="header-icon-btn friends-header-btn" onClick={onOpenFriends} title="Friends">
    ...existing svg...
  </button>
)}

{/* Stats button — desktop only */}
{!isMobile && (
  <button className="header-icon-btn" onClick={() => setShowStats(true)} title="Statistics">
    ...existing svg...
  </button>
)}

{/* Theme toggle — desktop only */}
{!isMobile && (
  <button className="theme-toggle" onClick={toggleTheme} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
    {dark ? '☀️' : '🌙'}
  </button>
)}
```

- [ ] **Step 3: Pass `isMobile` from App.jsx to both sidebars**

In `src/App.jsx`, find both `<Sidebar ... />` usages and `<WorldSidebar ... />` and add `isMobile={isMobile}`:

```jsx
<Sidebar
  ...existing props...
  isMobile={isMobile}
/>

<WorldSidebar
  ...existing props...
  isMobile={isMobile}
/>
```

`isMobile` is already available at line 320 of App.jsx via `const { isMobile, ... } = useDeviceType();`

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.jsx src/components/WorldSidebar.jsx src/App.jsx
git commit -m "fix(mobile): hide redundant stats/friends/theme buttons on mobile"
```

---

### Task 3: Fix floating map action buttons positioning (Bug 5)

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

**Context:** The games button (`.games-desktop-btn`, `top: 12px; right: 56px`) and map layer control (`.layer-control`, `top: 56px; right: 12px`) are independently positioned. They appear misaligned. Group them in a `.map-action-buttons` wrapper anchored `top: 12px; right: 12px`.

- [ ] **Step 1: Wrap buttons in App.jsx — world map view**

In `src/App.jsx` around line 612, find the world map view's games button and layer control. Wrap them:

```jsx
{/* Map action buttons — stacked top-right, desktop only */}
{!isMobile && !isShareMode && (
  <div className="map-action-buttons">
    <button
      className="map-action-btn"
      onClick={() => setGamesOpen(true)}
      title="Geography Games"
    >
      🎮
    </button>
    <MapLayerControl activeLayer={activeLayer} onLayerChange={setActiveLayer} />
  </div>
)}
```

Note: `MapLayerControl` is already rendered separately. Move it inside the wrapper and remove its standalone render. Check where `<MapLayerControl>` currently appears in the world map section and consolidate.

- [ ] **Step 2: Wrap buttons in App.jsx — country tracker view**

Find the country tracker section (around line 784) and do the same:

```jsx
{!isMobile && !isShareMode && (
  <div className="map-action-buttons">
    <button
      className="map-action-btn"
      onClick={() => setGamesOpen(true)}
      title="Geography Games"
    >
      🎮
    </button>
    <MapLayerControl activeLayer={activeLayer} onLayerChange={setActiveLayer} />
  </div>
)}
```

- [ ] **Step 3: Update CSS**

In `src/App.css`, replace `.games-desktop-btn` and its positioning with the new container. Add:

```css
/* Map action buttons — stacked top-right corner */
.map-action-buttons {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.map-action-btn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-specular), var(--glass-shadow);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  transition: all 0.25s;
}

.map-action-btn:hover {
  transform: scale(1.08);
  box-shadow: var(--glass-specular-strong), var(--glass-hover-glow);
}
```

Remove the old `.games-desktop-btn` and `.games-desktop-btn:hover` rules.

Update `.layer-control` to remove its absolute positioning (it will be positioned by the flex container):

```css
.layer-control {
  /* Remove: position: absolute; top: 56px; right: 12px; z-index: 1000; */
  position: relative;
}
```

- [ ] **Step 4: Adjust safe-area top for the new container**

In the `@supports` safe-area block, add:

```css
.map-action-buttons {
  top: calc(12px + env(safe-area-inset-top));
}
```

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.css
git commit -m "fix(map): group games + layer buttons into aligned top-right container"
```

---

## Chunk 2: Settings Panel (Bug 2)

### Task 4: Create SettingsPanel component

**Files:**
- Create: `src/components/SettingsPanel.jsx`
- Create: `src/components/SettingsPanel.css`

**Context:** iOS-style grouped sections: Appearance (dark mode toggle), Data (show onboarding, reset progress, reset everything), About (website, rate app, version). The component receives action callbacks as props. The `APP_VERSION` can be hardcoded as `'1.0.0'` for now.

- [ ] **Step 1: Create SettingsPanel.jsx**

```jsx
// src/components/SettingsPanel.jsx
import { useTheme } from '../context/ThemeContext';
import './SettingsPanel.css';

const APP_VERSION = '1.0.0';

export default function SettingsPanel({ onReset, onResetAll, onShowOnboarding }) {
  const { dark, toggle: toggleTheme } = useTheme();

  return (
    <div className="settings-panel">
      <div className="settings-section">
        <p className="settings-section-label">Appearance</p>
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-row-icon">🌙</span>
              <span className="settings-row-title">Dark Mode</span>
            </div>
            <button
              className={`settings-toggle ${dark ? 'on' : ''}`}
              onClick={toggleTheme}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="settings-toggle-thumb" />
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <p className="settings-section-label">Data</p>
        <div className="settings-group">
          <button className="settings-row settings-row-btn" onClick={onShowOnboarding}>
            <div className="settings-row-left">
              <span className="settings-row-icon">📖</span>
              <span className="settings-row-title">Show Onboarding</span>
            </div>
            <span className="settings-row-chevron">›</span>
          </button>
          <div className="settings-row-divider" />
          <button className="settings-row settings-row-btn settings-row-danger" onClick={onReset}>
            <div className="settings-row-left">
              <span className="settings-row-icon">🗑️</span>
              <span className="settings-row-title">Reset Current Tracker</span>
            </div>
            <span className="settings-row-chevron">›</span>
          </button>
          <div className="settings-row-divider" />
          <button className="settings-row settings-row-btn settings-row-danger" onClick={onResetAll}>
            <div className="settings-row-left">
              <span className="settings-row-icon">🗑️</span>
              <span className="settings-row-title">Reset Everything</span>
            </div>
            <span className="settings-row-chevron">›</span>
          </button>
        </div>
      </div>

      <div className="settings-section">
        <p className="settings-section-label">About</p>
        <div className="settings-group">
          <a
            className="settings-row settings-row-btn"
            href="https://rightworldtracker.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">🌐</span>
              <span className="settings-row-title">Website</span>
            </div>
            <span className="settings-row-chevron">›</span>
          </a>
          <div className="settings-row-divider" />
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-row-icon">ℹ️</span>
              <span className="settings-row-title">Version</span>
            </div>
            <span className="settings-row-value">{APP_VERSION}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SettingsPanel.css**

```css
/* src/components/SettingsPanel.css */

.settings-panel {
  padding: 8px 16px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section-label {
  margin: 0 0 6px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--text-tertiary);
  font-family: -apple-system, 'SF Pro Text', system-ui, sans-serif;
}

.settings-group {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-subtle);
  border-radius: 12px;
  overflow: hidden;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  min-height: 44px;
  gap: 8px;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  cursor: default;
  text-decoration: none;
  color: inherit;
}

.settings-row-btn {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: background 120ms ease;
}

.settings-row-btn:active {
  background: var(--hover-bg);
}

.settings-row-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.settings-row-icon {
  font-size: 16px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.settings-row-title {
  font-size: 15px;
  font-weight: 400;
  color: var(--text-primary);
  font-family: -apple-system, 'SF Pro Text', system-ui, sans-serif;
}

.settings-row-danger .settings-row-title {
  color: #e74c3c;
}

.settings-row-chevron {
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}

.settings-row-value {
  font-size: 13px;
  color: var(--text-muted);
  font-family: -apple-system, 'SF Pro Text', system-ui, sans-serif;
  flex-shrink: 0;
}

.settings-row-divider {
  height: 1px;
  background: var(--divider);
  margin-left: 44px;
}

/* iOS-style toggle switch */
.settings-toggle {
  position: relative;
  width: 51px;
  height: 31px;
  border-radius: 16px;
  border: none;
  background: var(--bar-track);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 200ms ease;
  -webkit-tap-highlight-color: transparent;
}

.settings-toggle.on {
  background: #c9a84c;
}

.settings-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.settings-toggle.on .settings-toggle-thumb {
  transform: translateX(20px);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPanel.jsx src/components/SettingsPanel.css
git commit -m "feat(settings): add SettingsPanel component — appearance/data/about"
```

---

### Task 5: Plug SettingsPanel into ProfileScreen (mobile)

**Files:**
- Modify: `src/components/ProfileScreen.jsx`

**Context:** Add a third "Settings" tab segment to the segmented control. When selected, render `<SettingsPanel>`. The `onReset`/`onResetAll` actions aren't directly available in ProfileScreen — pass them as props from App.jsx. `onShowOnboarding` resets the onboarding localStorage key and reloads.

- [ ] **Step 1: Add props to ProfileScreen**

```jsx
export default function ProfileScreen({ onReset, onResetAll }) {
```

- [ ] **Step 2: Add Settings tab to the segmented control**

```jsx
{[
  { id: 'profile', label: 'Profile' },
  { id: 'achievements', label: 'Badges' },
  { id: 'settings', label: 'Settings' },
].map(({ id, label }) => (
  <button
    key={id}
    role="tab"
    aria-selected={tab === id}
    className={`profile-seg-btn${tab === id ? ' active' : ''}`}
    onClick={() => setTab(id)}
  >
    {label}
  </button>
))}
```

- [ ] **Step 3: Render SettingsPanel in the tab body**

```jsx
import SettingsPanel from './SettingsPanel';

// in profile-tab-body:
{tab === 'settings' && (
  <SettingsPanel
    onReset={onReset}
    onResetAll={onResetAll}
    onShowOnboarding={() => {
      localStorage.removeItem('onboarding-dismissed');
      window.location.reload();
    }}
  />
)}
```

- [ ] **Step 4: Pass props from App.jsx to ProfileScreen**

In `src/App.jsx`, find the `<ProfileScreen />` render (around line 861) and add props:

```jsx
{isMobile && !isShareMode && activeTab === 'profile' && (
  <ProfileScreen onReset={handleReset} onResetAll={handleResetAll} />
)}
```

`handleReset` and `handleResetAll` already exist in App.jsx — find their actual names by searching for `onReset` prop passed to `<Sidebar>`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfileScreen.jsx src/App.jsx
git commit -m "feat(settings): add Settings tab to ProfileScreen with SettingsPanel"
```

---

### Task 6: Add SettingsPanel to desktop Sidebar

**Files:**
- Modify: `src/components/Sidebar.jsx`

**Context:** On desktop, replace the existing `.sidebar-footer` reset buttons and the theme toggle in the header with `<SettingsPanel>`. The reset callbacks (`onReset`, `onResetAll`) are already props of Sidebar. Add `onShowOnboarding` as a new prop.

- [ ] **Step 1: Import SettingsPanel and add prop**

```jsx
import SettingsPanel from './SettingsPanel';

export default function Sidebar({
  // ... existing props ...
  onShowOnboarding,
}) {
```

- [ ] **Step 2: Replace sidebar footer with SettingsPanel (desktop only)**

Remove the `.sidebar-footer` and `.sidebar-footer-secondary` blocks containing the reset buttons. Replace with:

```jsx
{!isMobile && !readOnly && (
  <SettingsPanel
    onReset={onReset}
    onResetAll={onResetAll}
    onShowOnboarding={onShowOnboarding}
  />
)}
```

- [ ] **Step 3: Pass onShowOnboarding from App.jsx**

In `src/App.jsx`, find `<Sidebar>` and add:

```jsx
<Sidebar
  ...existing props...
  onShowOnboarding={() => {
    localStorage.removeItem('onboarding-dismissed');
    window.location.reload();
  }}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.jsx src/App.jsx
git commit -m "feat(settings): add SettingsPanel to desktop Sidebar, replace footer buttons"
```

---

### Task 7: Final cleanup + push + PR

**Files:**
- Modify: `src/components/WorldSidebar.jsx` (remove standalone theme toggle, it's gone from header)
- Any remaining lint/visual issues

- [ ] **Step 1: Verify WorldSidebar no longer has a standalone theme toggle shown on mobile**

Read `src/components/WorldSidebar.jsx` header-actions block. Confirm it's wrapped in `{!isMobile && ...}` from Task 2. The WorldSidebar doesn't have reset actions, so we don't add SettingsPanel there — it's a world map sidebar, not a full profile screen.

- [ ] **Step 2: Manual visual check**

Run the dev server:
```bash
npm run dev
```

Check on mobile viewport (Chrome DevTools → iPhone 15 Pro):
- [ ] Sheet at full height: content not cut off by status bar
- [ ] Header only shows avatar + title (no stats/friends/theme buttons)
- [ ] Profile tab has 3 segments: Profile / Badges / Settings
- [ ] Settings → Appearance: dark mode toggle works
- [ ] Settings → Data: Reset buttons visible (with confirm dialogs)
- [ ] Settings → About: version shows, website link opens

Check on desktop:
- [ ] Sidebar footer shows SettingsPanel sections
- [ ] Games + layer buttons stack neatly top-right

- [ ] **Step 3: Commit any final fixes**

```bash
git add -p  # stage only relevant changes
git commit -m "fix(mobile): final cleanup and visual QA"
```

- [ ] **Step 4: Push and create PR**

```bash
git push origin HEAD
gh pr create --title "fix(mobile): bottom sheet, settings panel, redundant buttons, map controls" \
  --body "Fixes 5 mobile UI bugs:
- Bottom sheet no longer cuts off at top (safe-area-inset-top)
- New Settings panel: dark mode, reset, onboarding, about
- Stats/friends/theme buttons hidden on mobile (in tab bar already)
- Games + layer buttons grouped in aligned top-right container"
```
