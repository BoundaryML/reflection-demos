import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  server: {
    watch: null, // demos are run, not developed - no file watching (delete to restore HMR)
    port: 4451,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4450',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
