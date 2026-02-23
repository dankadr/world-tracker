# ToDo: Android App — Publish on Google Play Store

**Date:** 2026-02-24
**Status:** Not Started
**Priority:** Medium
**Scope:** Wrap the web app in a native Android shell using Capacitor and publish to Google Play Store

---

## Overview

Using the same Capacitor infrastructure as the iOS app (`05-ios-app-store.md`), add Android platform support and publish to Google Play Store. Capacitor shares the same web codebase for both platforms, so most work is Android-specific configuration, testing, and Play Store submission.

## Prerequisites

- [ ] Capacitor already set up for iOS (see `05-ios-app-store.md`)
- [ ] Google Play Developer account ($25 one-time fee) — https://play.google.com/console
- [ ] Android Studio installed
- [ ] App icons designed (see `02-icons-and-logos.md`)
- [ ] Privacy policy page

## Implementation Plan

### Phase 1: Add Android Platform

```bash
npm install @capacitor/android
npx cap add android
npx cap sync android
npx cap open android    # Opens in Android Studio
```

### Phase 2: Android-Specific Configuration

#### `capacitor.config.ts` additions
```typescript
const config: CapacitorConfig = {
  // ... existing config from iOS setup
  android: {
    backgroundColor: '#f5e6d0',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // set true for dev
  },
};
```

#### Android Manifest adjustments (`android/app/src/main/AndroidManifest.xml`)
```xml
<!-- Internet permission (usually default) -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Prevent screenshot in sensitive areas (optional) -->
<activity
    android:name=".MainActivity"
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
    android:launchMode="singleTask"
    android:windowSoftInputMode="adjustResize">
    <!-- Deep link intent filter for share URLs -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="https" android:host="worldtracker.app" />
    </intent-filter>
</activity>
```

### Phase 3: Android-Specific Adjustments

#### Back Button Handling
Android hardware/gesture back button needs explicit handling:
```javascript
import { App as CapApp } from '@capacitor/app';

CapApp.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) {
    window.history.back();
  } else {
    // If navigation stack has screens, pop
    // Otherwise, minimize app (don't exit)
    CapApp.minimizeApp();
  }
});
```

#### Notch & Cutout Support
```css
/* Already using safe-area-inset from iOS plan, works on Android too */
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

#### Edge-to-Edge Display (Android 15+)
```java
// In MainActivity.java
getWindow().setDecorFitsSystemWindows(false);
```

#### Material Design Adaptations
While keeping the glassmorphism design, adjust for Android conventions:
- Use system navigation bar (gesture or 3-button) — set transparent
- Ripple effect on tappable elements (Android users expect it)
- Toast notifications instead of iOS-style banners

```javascript
// Add Android ripple feedback
import { Capacitor } from '@capacitor/core';
if (Capacitor.getPlatform() === 'android') {
  document.documentElement.classList.add('platform-android');
}
```

```css
.platform-android .tappable {
  position: relative;
  overflow: hidden;
}
.platform-android .tappable::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(0,0,0,0.1) 10%, transparent 10%);
  transform: scale(10);
  opacity: 0;
  transition: transform 0.3s, opacity 0.5s;
}
.platform-android .tappable:active::after {
  transform: scale(0);
  opacity: 1;
  transition: 0s;
}
```

### Phase 4: Google Play Store Assets

#### Required Icons
| Size | Use |
|------|-----|
| 512×512 | Play Store listing (high-res icon) |
| 48×48 mdpi | Launcher icon |
| 72×72 hdpi | Launcher icon |
| 96×96 xhdpi | Launcher icon |
| 144×144 xxhdpi | Launcher icon |
| 192×192 xxxhdpi | Launcher icon |

Use Adaptive Icons (foreground + background layers) for Android 8.0+.

#### Feature Graphic
- 1024×500 banner image for Play Store listing
- Show the world map with visited countries, the app name, and warm amber branding

#### Screenshots
| Screen | Content |
|--------|---------|
| 1 | World Map with visited countries |
| 2 | Region tracker detail |
| 3 | Achievements panel |
| 4 | Avatar editor |
| 5 | Friends & challenges |
| 6 | Year in Review |
| 7 | Bucket list |
| 8 | UNESCO sites |

Minimum 2 screenshots, recommended 8. Phone (16:9) and tablet (16:10) sets.

#### Play Store Metadata
```
App name: World Tracker — Travel Map
Short description (80 chars): Track countries you've visited, unlock achievements, challenge friends.
Full description (4000 chars):
  World Tracker lets you mark every country, state, canton, and neighborhood
  you've ever visited on beautiful interactive maps. With 10 regional trackers
  covering Switzerland, the USA, Norway, Canada, Japan, Australia, NYC, and more,
  plus a world map with 238 countries and 192 capitals — your travel journey
  has never been so visual.

  Features:
  • 80+ achievements to unlock as you explore
  • Customizable pixel art avatar with level progression
  • Travel challenges with friends (collaborative or race mode)
  • Bucket list planner with priorities and target dates
  • Year in Review — Spotify Wrapped-style travel cards
  • UNESCO World Heritage Sites (1,199 sites) tracking
  • Friend comparison view — see who's traveled more
  • Leaderboard — compete with friends globally
  • Dark mode with warm amber glassmorphism design
  • Share your travel map with a link

Category: Travel & Local
Content rating: Everyone
Price: Free
```

### Phase 5: Signing & Release

#### Generate Signing Key
```bash
keytool -genkey -v -keystore world-tracker.keystore \
  -alias world-tracker -keyalg RSA -keysize 2048 -validity 10000
```

#### Build Release APK / AAB
```bash
npm run build
npx cap sync android
cd android
./gradlew bundleRelease    # Generates AAB for Play Store
# Or for APK:
./gradlew assembleRelease
```

#### Play Console Submission
1. Create new app in Play Console
2. Upload AAB to internal testing track first
3. Test on multiple devices (phone, tablet, foldable)
4. Promote to production track
5. Review typically takes 1-3 days (first submission may take longer)

### Phase 6: Testing Checklist
- [ ] App launches with splash screen on Android
- [ ] Maps render in WebView (Chrome-based)
- [ ] Touch interactions: tap, long-press, pinch-zoom, swipe
- [ ] Back button navigates correctly (pop screen / minimize)
- [ ] Data persists between app launches
- [ ] Google Sign-In works (native intent flow)
- [ ] Dark mode follows system preference
- [ ] Notifications work (if implemented)
- [ ] Orientation changes handled
- [ ] Performance on mid-range devices (e.g., Pixel 6a, Samsung A54)
- [ ] Split-screen / multi-window mode works
- [ ] No WebView console errors
- [ ] Share URLs open the app (deep linking)
- [ ] Keyboard doesn't push layout incorrectly
- [ ] Status bar and navigation bar colors match app theme

## Differences from iOS Build

| Aspect | iOS | Android |
|--------|-----|---------|
| WebView engine | WKWebView (Safari) | Chrome WebView |
| Back navigation | Left-edge swipe | System back button/gesture |
| App review | 24-48 hours | 1-3 days (first time longer) |
| Developer fee | $99/year | $25 one-time |
| Signing | Xcode certificates | Keystore file |
| Deep links | Universal Links | App Links + intent filters |
| Haptics | UIFeedbackGenerator | VibrationEffect |
| Status bar | iOS safe area | Android insets + edge-to-edge |

## Files to Create
| File | Purpose |
|------|---------|
| `android/` (directory) | Android project (generated by `npx cap add android`) |
| `android/app/src/main/res/` | App icons (adaptive icon layers) |

## Files to Modify
| File | Change |
|------|--------|
| `capacitor.config.ts` | Add Android-specific configuration |
| `package.json` | Add Android build scripts |
| `src/utils/native.js` | Add Android back button handler |
| `src/App.css` | Add `.platform-android` style overrides |
| `src/App.jsx` | Initialize Android-specific listeners |

## Estimated Effort
- Android platform setup: ~2-3 hours
- Android-specific code: ~3-4 hours
- Play Store asset creation: ~3-4 hours
- Testing on devices: ~4-6 hours
- Play Store submission: ~2-3 hours
- **Total: ~14-20 hours** (faster than iOS since Capacitor is already set up)
