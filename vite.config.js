import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defineConfig } from 'vite';

function copyLegacyAssets() {
  const files = [
    ['js/GlidePath.js', 'js/GlidePath.js'],
  ];

  return {
    name: 'copy-legacy-assets',
    closeBundle() {
      for (const [src, dest] of files) {
        const target = join('dist', dest);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(src, target);
      }
    },
  };
}

export default defineConfig({
  plugins: [copyLegacyAssets()],
  server: {
    headers: {
      // Required for AudioWorklet SharedArrayBuffer in some environments
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
