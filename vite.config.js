import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['@elemaudio/core', '@elemaudio/web-renderer'],
  },
  server: {
    headers: {
      // Required for AudioWorklet SharedArrayBuffer in some environments
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
