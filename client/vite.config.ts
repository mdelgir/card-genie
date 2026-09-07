import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@games": fileURLToPath(new URL("../games", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: [".."],
    },
  },
  preview: {
    // Hosted preview/proxy health checks use provider-assigned Host headers.
    // This preview server is only used for Phase 1 hosted validation.
    allowedHosts: true,
  },
});
