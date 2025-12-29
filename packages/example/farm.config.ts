import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@farmfe/core';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: ['@farmfe/plugin-react'],
  compilation: {
    input: {
      index: './index.html',
      peer: './peer.html',
    },
    resolve: {
      alias: {
        'react-p2p': resolve(__dirname, '../react-p2p/src'),
      },
    },
  },
});
