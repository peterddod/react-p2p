import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-p2p': resolve(__dirname, '../react-p2p/src'),
    },
    dedupe: ['react'],
  },
  optimizeDeps: { exclude: ['react-p2p'] },
});
