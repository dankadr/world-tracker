# ToDo: PWA & Offline Support

**Date:** 2026-02-24
**Status:** Partially complete — manifest, PWA plugin, install prompt, offline UI, and cache/queue infrastructure are in place
**Priority:** Medium-High
**Scope:** Make the app a Progressive Web App with offline support, home screen install, and background sync

---

## Overview

The app now has the first layer of PWA support — a manifest, service worker wiring through Vite PWA, install prompts, and offline/cache helpers — but it is not yet mature enough to call the experience fully offline-ready. Finishing this work enables "Add to Home Screen", stronger offline map viewing, and a near-native experience without app store submission.

## Current State

- **Manifest shipped:** `public/manifest.json` is present and linked from `index.html`
- **PWA build integration shipped:** `vite-plugin-pwa` is configured in `vite.config.js`
- **Install UX shipped:** `src/components/InstallPrompt.jsx` handles Android install events and iOS manual install guidance
- **Offline UX shipped:** `src/components/OfflineIndicator.jsx` exists
- **Offline infra partially shipped:** `src/utils/syncQueue.js`, `src/utils/cache.js`, and runtime tile/API caching are present
- **Data storage:** localStorage / secureStorage for guest mode and offline-friendly fallbacks, API sync for authenticated users
- **GeoJSON files:** Large JSON files in `src/data/` remain bundled into the app
- **Still missing:** strong end-to-end offline verification, richer background sync behavior, and polished install/offline assets

## Implementation Plan

### Phase 1: Web App Manifest

#### Create `public/manifest.json`
```json
{
  "name": "World Tracker — Travel Map",
  "short_name": "World Tracker",
  "description": "Track countries, unlock achievements, challenge friends",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#c07a30",
  "background_color": "#f5e6d0",
  "icons": [
    { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "categories": ["travel", "lifestyle"],
  "shortcuts": [
    {
      "name": "World Map",
      "url": "/?view=world",
      "icon": "/icons/shortcut-world.png"
    },
    {
      "name": "Achievements",
      "url": "/?view=achievements",
      "icon": "/icons/shortcut-achievements.png"
    }
  ]
}
```

#### Update `index.html`
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#c07a30" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="World Tracker" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

### Phase 2: Service Worker

#### Vite PWA Plugin Setup
```bash
npm install vite-plugin-pwa -D
```

#### `vite.config.js` update
```javascript
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB (GeoJSON files are large)
        runtimeCaching: [
          {
            // Cache map tiles with network-first strategy
            urlPattern: /^https:\/\/(a|b|c)\.(tile\.openstreetmap|basemaps\.cartocdn)\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: {
                maxEntries: 5000,         // ~50MB of tiles
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache API responses with network-first (stale-while-revalidate)
            urlPattern: /^https:\/\/.*\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60, // 24 hours
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
            },
          },
        ],
      },
      manifest: false, // We provide our own manifest.json
    }),
  ],
});
```

### Phase 3: Offline Mode

#### Strategy Overview
```
┌─────────────────────────────────────────┐
│              Network Available?          │
│                                         │
│  YES → Normal operation                 │
│    - Fetch from API                     │
│    - Sync changes to server             │
│    - Cache responses for later          │
│                                         │
│  NO → Offline mode                      │
│    - Show cached data                   │
│    - Allow marking regions (localStorage)│
│    - Queue API calls for later          │
│    - Show offline indicator             │
│    - Map tiles from cache               │
└─────────────────────────────────────────┘
```

#### Offline Data Access
The app already stores all visited data in localStorage (guest mode uses it exclusively). For authenticated users:
- Cache the last-fetched visited data in localStorage as a fallback
- On offline, use localStorage data (read-only for server-synced data, or queue writes)
- GeoJSON map data is bundled into the JS — always available offline after first load

#### Offline Indicator Component
```jsx
// src/components/OfflineIndicator.jsx
import { useState, useEffect } from 'react';

function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="offline-indicator">
      <span>📡 Offline — changes will sync when connected</span>
    </div>
  );
}
```

#### Background Sync Queue
```javascript
// src/utils/syncQueue.js
const QUEUE_KEY = 'sync_queue';

export function queueApiCall(method, url, body) {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push({ method, url, body, timestamp: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function processQueue() {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  if (queue.length === 0) return;

  const remaining = [];
  for (const item of queue) {
    try {
      await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });
    } catch {
      remaining.push(item); // Keep failed items for retry
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

// Process queue when coming back online
window.addEventListener('online', processQueue);
```

### Phase 4: Install Prompt

#### Custom Install Banner
```jsx
// src/components/InstallPrompt.jsx
function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after user has interacted with 5+ regions
      const visitCount = Object.keys(localStorage).filter(k => k.startsWith('visited-')).length;
      if (visitCount >= 5) {
        setShowPrompt(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="install-prompt">
      <p>Add World Tracker to your home screen for quick access!</p>
      <button onClick={handleInstall}>Install</button>
      <button onClick={() => setShowPrompt(false)}>Not now</button>
    </div>
  );
}
```

### Phase 5: Map Tile Caching Strategy

Map tiles are the largest offline concern. Strategy:
1. **Auto-cache viewed tiles:** Any tile the user has seen gets cached (CacheFirst strategy)
2. **Pre-cache region tiles:** When a user marks a region as bucket list, pre-cache the tiles for that area
3. **Tile cache limit:** 5,000 tiles (~50MB) with LRU eviction
4. **Offline tile fallback:** Show a "map unavailable offline" placeholder for uncached areas
5. **Tile quality:** Cache at the user's most common zoom levels

## Files to Create

| File | Purpose |
|------|---------|
| `public/manifest.json` | PWA manifest |
| `public/icons/` | PWA icons at all required sizes |
| `src/components/OfflineIndicator.jsx` | Offline status banner |
| `src/components/InstallPrompt.jsx` | Home screen install prompt |
| `src/utils/syncQueue.js` | Offline action queue + background sync |

## Files to Modify

| File | Change |
|------|--------|
| `index.html` | Add manifest link, theme-color, apple-mobile-web-app meta tags |
| `vite.config.js` | Add `vite-plugin-pwa` with workbox config |
| `package.json` | Add `vite-plugin-pwa` dev dependency |
| `src/App.jsx` | Add `<OfflineIndicator />` and `<InstallPrompt />` |
| `src/utils/api.js` (or equivalent) | Wrap API calls to queue when offline |
| `vercel.json` | Add cache headers for static assets |

## Testing Checklist

- [ ] `manifest.json` is served correctly (check in DevTools → Application → Manifest)
- [ ] Service worker registers and activates
- [ ] App is installable (Chrome shows install icon in address bar)
- [ ] "Add to Home Screen" works on iOS Safari and Android Chrome
- [ ] App shell loads offline (after first visit)
- [ ] Map tiles cached and display offline for previously viewed areas
- [ ] GeoJSON data available offline (bundled in JS)
- [ ] Visited data accessible offline (localStorage)
- [ ] Offline indicator appears when network is disconnected
- [ ] Queued actions sync when coming back online
- [ ] Service worker updates without breaking the app
- [ ] Lighthouse PWA audit passes (target 90+)
- [ ] iOS standalone mode works (no Safari chrome)
- [ ] Android standalone mode works (no Chrome chrome)

## Estimated Effort

- Manifest + icons: ~2-3 hours
- Service worker (Vite PWA plugin): ~3-4 hours
- Offline mode + sync queue: ~4-5 hours
- Install prompt: ~1-2 hours
- Testing & edge cases: ~3-4 hours
- **Total: ~13-18 hours**
