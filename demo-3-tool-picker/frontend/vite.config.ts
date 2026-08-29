import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  plugins: [react()],
  server: {
    watch: null, // demos are run, not developed - no file watching (delete to restore HMR)
    port: 4431,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:4430",
        changeOrigin: true,
      },
    },
  },
});
