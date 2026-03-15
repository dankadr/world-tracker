import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    process.env.ANALYZE && visualizer({ open: true, gzipSize: true, filename: 'dist/stats.html' }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      manifest: false, // We provide our own public/manifest.json
      workbox: {
        // Only pre-cache app shell files — exclude large PNGs (logo.png is 16 MB)
        globPatterns: ['**/*.{js,css,html,ico,svg}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // cover the 17 MB JS bundle
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(a|b|c)\.(tile\.openstreetmap|basemaps\.cartocdn)\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
        ],
      },
    }),
  ],
  define: {
    // Expose GOOGLE_CLIENT_ID as VITE_GOOGLE_CLIENT_ID for the frontend
    // so it works on Vercel without needing a separate VITE_ env var
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(
      process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || ''
    ),
    'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(
      process.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN || ''
    ),
  },
  esbuild: {
    // Keep esbuild from folding independent declarations into a single
    // minified statement. Firefox is stricter about TDZ reads in that form.
    minifySyntax: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 2000,
    // Use Terser instead of esbuild for minification.
    // esbuild's minifier can produce `const` bindings in an order that
    // triggers Firefox's strict TDZ check ("can't access lexical declaration
    // before initialization"). Terser emits `var` for module-level bindings
    // and does not have this problem.
    minify: 'terser',
    terserOptions: {
      // Disable compression transforms — only mangle names.
      // Compression passes (inline, sequences, etc.) can introduce TDZ by
      // reordering `const` declarations in ways Firefox rejects.
      compress: false,
    },
    rollupOptions: {
      output: {
        // Also keep Rollup-generated bindings as `var` (belt-and-suspenders).
        generatedCode: { constBindings: false },
      },
    },
  },
});
