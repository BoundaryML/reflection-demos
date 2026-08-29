import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    watch: null, // demos are run, not developed - no file watching (delete to restore HMR)
    port: 4411,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:4410",
    },
  },
  build: {
    outDir: "dist",
  },
});
