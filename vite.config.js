import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('leaflet') || id.includes('react-leaflet')) {
              return 'vendor-leaflet';
            }
            if (id.includes('@sentry/react')) {
              return 'vendor-sentry';
            }
          }
          if (id.includes('src/data/world.json')) return 'geo-world';
          if (id.includes('src/data/cantons.json')) return 'geo-ch';
          if (id.includes('src/data/usa.json')) return 'geo-us';
          if (id.includes('src/data/us-parks.json')) return 'geo-usparks';
          if (id.includes('src/data/nyc.json')) return 'geo-nyc';
          if (id.includes('src/data/norway.json')) return 'geo-no';
          if (id.includes('src/data/canada.json')) return 'geo-ca';
          if (id.includes('src/data/capitals.json')) return 'geo-capitals';
          if (id.includes('src/data/japan.json')) return 'geo-jp';
          if (id.includes('src/data/australia.json')) return 'geo-au';
        },
      },
    },
  },
});
