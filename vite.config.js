import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'geo-ch': ['./src/data/cantons.json'],
          'geo-us': ['./src/data/usa.json'],
          'geo-usparks': ['./src/data/us-parks.json'],
          'geo-nyc': ['./src/data/nyc.json'],
          'geo-no': ['./src/data/norway.json'],
          'geo-ca': ['./src/data/canada.json'],
        },
      },
    },
  },
});
