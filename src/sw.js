import { clientsClaim } from 'workbox-core';
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Injected by VitePWA at build time — do not remove
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /^\/auth\//, /^\/admin\//],
  })
);

// OSM map tiles
registerRoute(
  /^https:\/\/(a|b|c)\.tile\.openstreetmap\.org\/.*/,
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// OpenTopoMap tiles
registerRoute(
  /^https:\/\/[a-z]\.tile\.opentopomap\.org\/.*/,
  new CacheFirst({
    cacheName: 'opentopomap-tiles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Carto map tiles
registerRoute(
  /^https:\/\/(a|b|c|d)\.basemaps\.cartocdn\.com\/.*/,
  new CacheFirst({
    cacheName: 'carto-tiles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// ArcGIS satellite tiles
registerRoute(
  /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/.*/,
  new CacheFirst({
    cacheName: 'arcgis-tiles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// API routes — NetworkFirst with per-user cache key
// Note: localStorage is NOT available in SW scope.
// We decode the user ID from the JWT in the Authorization header.
// Match function: same-origin /api/* only — works on any hostname
// (production, preview deployments, local dev) without hard-coding a domain.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 }), // 5 min (was 24h)
      // Only cache successful responses — never cache 401/403/500 errors
      new CacheableResponsePlugin({ statuses: [200] }),
      {
        // Skip caching unauthenticated responses — prevents guest data
        // from entering the cache and bleeding to authenticated users.
        cacheWillUpdate: async ({ request, response }) => {
          if (!request.headers.get('Authorization')) return null;
          return response;
        },
        // Append user ID from JWT sub claim to cache key so user A's
        // cached API responses never bleed to user B on a shared device.
        cacheKeyWillBeUsed: async ({ request }) => {
          const auth = request.headers.get('Authorization') ?? '';
          try {
            const token = auth.replace('Bearer ', '');
            const payload = JSON.parse(atob(token.split('.')[1]));
            const uid = payload.sub ?? payload.id ?? payload.user_id;
            if (!uid) return request;
            const url = new URL(request.url);
            url.searchParams.set('_sw_uid', String(uid));
            return url.toString();
          } catch {
            return request;
          }
        },
      },
    ],
  })
);

// Google Fonts
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/,
  new StaleWhileRevalidate({ cacheName: 'google-fonts' })
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/,
  new CacheFirst({
    cacheName: 'google-font-files',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

async function notifyClientsToFlushQueue() {
  const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windowClients.forEach((client) => client.postMessage({ type: 'FLUSH_BATCH_QUEUE' }));
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'world-tracker-sync') {
    event.waitUntil(notifyClientsToFlushQueue());
  }
});
