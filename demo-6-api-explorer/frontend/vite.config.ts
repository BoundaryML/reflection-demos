import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: null, // demos are run, not developed - no file watching (delete to restore HMR)
    port: 4461,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:4460",
        changeOrigin: true,
      },
    },
  },
});
