import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';

const backend = process.env.BENCHSHIELD_API_URL || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'exclude-msw-worker-from-prod',
      apply: 'build',
      closeBundle() {
        const distWorker = path.resolve(import.meta.dirname, 'dist/mockServiceWorker.js');
        if (fs.existsSync(distWorker)) fs.unlinkSync(distWorker);
      },
    },
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  // Live mode: proxy API calls to the backend (scripts/dev_server.py) so no CORS setup is needed.
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/health': { target: backend, changeOrigin: true },
      '/dev': { target: backend, changeOrigin: true },
    },
  },
  // @ts-expect-error vitest config
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    env: { VITE_ENABLE_MSW: 'true' },
  },
});
