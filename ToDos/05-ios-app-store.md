# ToDo: iOS App Store — Publish as Native iOS App

**Date:** 2026-02-24
**Status:** Planned — mobile UX groundwork is shipped, but no Capacitor/iOS project exists yet
**Priority:** Medium
**Scope:** Wrap the web app in a native iOS shell and publish to the Apple App Store

---

## Overview

Package the existing React web app as an iOS app using Capacitor (Ionic's native bridge). This avoids a full rewrite while providing native app store presence, home screen icon, push notifications, and native APIs (haptics, status bar, splash screen). The app already uses Leaflet for maps (runs in WebView), glassmorphism CSS (works in Safari WebView), and localStorage (persisted in Capacitor).

## Reality Check (2026-03-25)

- The app already has strong mobile-specific UI work: tab bar navigation, push-style screens, touch feedback, pull-to-refresh, and safe-area handling
- PWA/install support is present, which reduces the urgency of an app-store wrapper
- There is no `capacitor.config.*`, no `ios/` project, and no native plugin integration in the repo

## Approach Options

| Option | Effort | Native Feel | Code Reuse |
|--------|--------|-------------|------------|
| **Capacitor (recommended)** | Low | Good | 95%+ |
| React Native | High | Excellent | 30-40% (rewrite maps, styles) |
| PWA only | Minimal | Limited | 100% |
| Swift native | Very High | Perfect | 0% (full rewrite) |

**Decision: Capacitor** — wraps the existing web app in a native WKWebView with access to native plugins. Minimal code changes needed.

## Prerequisites

- [ ] Apple Developer Account ($99/year) — https://developer.apple.com
- [ ] macOS with Xcode 15+ installed
- [ ] App icons & screenshots designed (see `02-icons-and-logos.md`)
- [ ] Privacy policy page (required for App Store)
- [ ] Mobile UI/UX improvements (see `01-mobile-uiux.md`) — should be done first

## Implementation Plan

### Phase 1: Capacitor Setup

#### Install Dependencies
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "World Tracker" "com.worldtracker.app" --web-dir dist
npm install @capacitor/ios
npx cap add ios
```

#### Configure `capacitor.config.ts`
```typescript
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.worldtracker.app',
  appName: 'World Tracker',
  webDir: 'dist',
  server: {
    // For development — point to Vite dev server
    // url: 'http://localhost:5173',
    // For production — use bundled assets
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#f5e6d0',  // match app background
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#f5e6d0',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#f5e6d0',
    },
  },
};

export default config;
```

#### Build & Sync
```bash
npm run build          # Vite production build
npx cap sync ios       # Copy web assets + install native plugins
npx cap open ios       # Open in Xcode
```

### Phase 2: Native Plugins

#### Status Bar
```bash
npm install @capacitor/status-bar
```
```javascript
import { StatusBar, Style } from '@capacitor/status-bar';
StatusBar.setStyle({ style: Style.Dark });
StatusBar.setBackgroundColor({ color: '#f5e6d0' });
```

#### Haptics
```bash
npm install @capacitor/haptics
```
```javascript
import { Haptics, ImpactStyle } from '@capacitor/haptics';
// On visit toggle:
Haptics.impact({ style: ImpactStyle.Light });
// On achievement unlock:
Haptics.notification({ type: 'success' });
```

#### Splash Screen
```bash
npm install @capacitor/splash-screen
```

#### Keyboard (prevent layout shifts)
```bash
npm install @capacitor/keyboard
```
```javascript
import { Keyboard } from '@capacitor/keyboard';
Keyboard.setResizeMode({ mode: 'none' });
Keyboard.setScroll({ isDisabled: true });
```

#### Push Notifications (future — integrates with `07-email-system.md`)
```bash
npm install @capacitor/push-notifications
```

### Phase 3: App Store Assets

#### Required Icons
| Size | Use |
|------|-----|
| 1024×1024 | App Store listing |
| 180×180 | iPhone @3x |
| 120×120 | iPhone @2x |
| 167×167 | iPad Pro |
| 152×152 | iPad |
| 76×76 | iPad @1x |
| 40×40 | Spotlight |
| 60×60 | iPhone notification |
| 20×20 | Settings |

Use the logo from `02-icons-and-logos.md` and generate all sizes.

#### Required Screenshots (6.7" iPhone, 12.9" iPad minimum)
| Screen | Content |
|--------|---------|
| 1 | World Map with visited countries highlighted |
| 2 | Region detail (Switzerland with cantons) |
| 3 | Achievements panel with unlocked badges |
| 4 | Avatar editor with customization |
| 5 | Friends comparison view |
| 6 | Year in Review cards |

#### App Store Metadata
```
Name: World Tracker — Travel Map
Subtitle: Track countries, unlock achievements
Category: Travel
Age Rating: 4+
Price: Free
Keywords: travel tracker, countries visited, world map, travel achievements,
          bucket list, travel challenges, avatar, friends
Description: Track every country, state, canton, and neighborhood you've visited
across the world. Mark regions on interactive maps, unlock 80+ achievements,
customize your pixel art avatar, challenge friends, plan your bucket list,
and review your year in travel with beautiful story cards.
```

#### Privacy Policy Requirements
Apple requires a privacy policy URL. The app collects:
- Google account info (name, email, profile picture) — for authentication
- Visited regions data — synced to server
- Friend connections — friend codes and friend list
- No location tracking, no contacts access, no health data

### Phase 4: Xcode Configuration

- Set deployment target: iOS 15.0+
- Enable WKWebView
- Configure signing with Apple Developer certificate
- Set up App Groups for data sharing (if needed)
- Add `NSAppTransportSecurity` exception for API server (if using HTTP in dev)
- Test on physical device (not just simulator)

### Phase 5: Web App Adjustments for Capacitor

#### Detect Capacitor Environment
```javascript
import { Capacitor } from '@capacitor/core';
const isNative = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform(); // 'ios', 'android', 'web'
```

#### Adjustments Needed
- Hide browser-specific UI (e.g., "Add to Home Screen" prompt)
- Use Capacitor haptics instead of Vibration API
- Adjust safe area handling (Capacitor manages safe areas)
- Handle deep links for share URLs
- Handle app backgrounding/foregrounding (re-sync data)

### Phase 6: Testing & Submission

#### Testing Checklist
- [ ] App launches with splash screen
- [ ] All maps render correctly in WKWebView
- [ ] Touch interactions work (tap, swipe, pinch-to-zoom on map)
- [ ] Authentication flow works (Google Sign-In in WebView)
- [ ] Data persists between app launches
- [ ] Dark mode works
- [ ] Orientation changes handled
- [ ] Memory usage acceptable (Leaflet + GeoJSON can be memory-heavy)
- [ ] No console errors or crashes in Safari WebView
- [ ] All modals/sheets dismiss correctly
- [ ] Share URLs open correctly (universal links)
- [ ] App works offline (localStorage fallback)

#### Submission
1. Archive build in Xcode → Upload to App Store Connect
2. Fill out app metadata, screenshots, privacy policy
3. Submit for App Review (typically 24-48 hours)
4. Address any review feedback

## Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| Leaflet map performance in WebView | Test on older iPhones (SE, XR), optimize GeoJSON size |
| Google Sign-In rejection | Apple may require "Sign in with Apple" as alternative — add as backup |
| Large bundle size | Code-split, lazy-load tracker GeoJSON files |
| WKWebView memory limits | Monitor memory, unload inactive tracker data |
| App Review rejection | Pre-check all Apple guidelines, add "Sign in with Apple" |

## Files to Create
| File | Purpose |
|------|---------|
| `capacitor.config.ts` | Capacitor configuration |
| `ios/` (directory) | Xcode project (generated by `npx cap add ios`) |
| `src/utils/native.js` | Capacitor platform detection & native API wrappers |
| `PRIVACY_POLICY.md` | Privacy policy for App Store |

## Files to Modify
| File | Change |
|------|--------|
| `package.json` | Add Capacitor dependencies and scripts |
| `vite.config.js` | Ensure `base: './'` for Capacitor file:// loading |
| `index.html` | Add apple-touch-icon, viewport meta adjustments |
| `src/App.jsx` | Integrate Capacitor haptics, status bar, keyboard handling |
| `src/context/AuthContext.jsx` | Handle Google Sign-In in WebView context |

## Estimated Effort
- Capacitor setup & configuration: ~3-4 hours
- Native plugin integration: ~4-5 hours
- App Store asset creation: ~3-4 hours
- Testing on device: ~4-6 hours
- App Store submission & review: ~2-3 hours
- **Total: ~16-22 hours**
