import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The Pages deployment lives at /<repo>/, so the base path is injected by CI.
 * Local dev and any self-hosted deployment default to the root.
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Charts are the heavy import and only two screens need them, so they
        // get a chunk of their own that loads on demand and caches separately.
        manualChunks: { charts: ['recharts'] }
      }
    }
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] }
  }
});
