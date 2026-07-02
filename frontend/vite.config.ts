import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Service worker only in production builds; dev stays hot-reloadable.
      devOptions: { enabled: false },
      includeAssets: ["icons/icon.svg", "icons/icon-maskable.svg"],
      manifest: {
        name: "Casinha Virtual",
        short_name: "Casinha",
        description: "Explore uma ilha mágica com quem você ama 🌿",
        theme_color: "#1b1726",
        background_color: "#1b1726",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Pre-cache all built assets so the app shell loads offline.
        globPatterns: ["**/*.{js,css,html,svg,woff2,wasm}"],
        // Serve the app shell for any unmatched navigation (SPA).
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /^\/health/],
        runtimeCaching: [
          {
            // API and WebSocket handshake — never cache.
            urlPattern: /^https?:\/\/.*\/(api|ws|health)/,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
