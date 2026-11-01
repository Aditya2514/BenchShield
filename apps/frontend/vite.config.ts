import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'exclude-msw-worker-from-prod',
      apply: 'build',
      closeBundle() {
        const distWorker = path.resolve(import.meta.dirname, 'dist/mockServiceWorker.js');
        if (fs.existsSync(distWorker)) {
          fs.unlinkSync(distWorker);
          console.log('[build] Removed mockServiceWorker.js from production dist');
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // @ts-expect-error vitest config
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});

