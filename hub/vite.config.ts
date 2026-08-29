import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Hub has no backend of its own — it only polls each demo's backend
// /api/health directly (cross-origin, no-cors) — see src/useHealth.ts.
export default defineConfig({
  plugins: [react()],
  server: {
    watch: null, // demos are run, not developed - no file watching (delete to restore HMR)
    port: 4400,
    strictPort: true,
  },
  preview: {
    port: 4400,
    strictPort: true,
  },
});
