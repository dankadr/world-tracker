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
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'geo-world': ['./src/data/world.json'],
          'geo-ch': ['./src/data/cantons.json'],
          'geo-us': ['./src/data/usa.json'],
          'geo-usparks': ['./src/data/us-parks.json'],
          'geo-nyc': ['./src/data/nyc.json'],
          'geo-no': ['./src/data/norway.json'],
          'geo-ca': ['./src/data/canada.json'],
          'geo-capitals': ['./src/data/capitals.json'],
        },
      },
    },
  },
});
