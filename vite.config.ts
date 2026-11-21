import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Installable, offline-capable app. Updates wait for the user to tap
    // "Update" (never swapped mid-session) — see src/components/app/PwaUpdater.tsx.
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.ico", "icons/icon.svg", "icons/apple-touch-icon-180x180.png"],
      manifest: {
        id: "/",
        name: "TELOS",
        short_name: "TELOS",
        description: "Goals, habits, training and relationships — one daily plan.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#F6F6F9",
        theme_color: "#F6F6F9",
        categories: ["productivity", "health", "fitness", "lifestyle"],
        icons: [
          { src: "/icons/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Today", url: "/", icons: [{ src: "/icons/pwa-192x192.png", sizes: "192x192" }] },
          { name: "Start workout", url: "/gym", icons: [{ src: "/icons/pwa-192x192.png", sizes: "192x192" }] },
          { name: "Plan my day", url: "/plan", icons: [{ src: "/icons/pwa-192x192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"],
        // Only precache the Latin font files; other scripts load on demand.
        globIgnores: ["**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2", "**/placeholder.svg"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
