import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Must be 127.0.0.1, not "localhost". Node 17+ resolves "localhost" to ::1
// (IPv6) first, while the Flask dev server binds IPv4 127.0.0.1 only — so a
// "localhost" target gets ECONNREFUSED and every proxied request silently
// returns nothing. Override with VITE_DEV_BACKEND if your API is elsewhere.
const DEV_BACKEND = process.env.VITE_DEV_BACKEND ?? "http://127.0.0.1:5000";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    // Lets the dev server talk to a locally running Flask backend without
    // CORS config or hardcoded absolute URLs in the client.
    proxy: {
      "/api": {
        target: DEV_BACKEND,
        changeOrigin: true,
      },
      "/socket.io": {
        target: DEV_BACKEND,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // `react/jsx-runtime` has to be listed explicitly. Left out, Rollup
          // parks it in whichever vendor chunk happens to reach it first — which
          // was vendor-motion, so *every* JSX-emitting chunk imported
          // framer-motion (37 kB gzipped) just to get the JSX factory.
          "vendor-react": [
            "react",
            "react/jsx-runtime",
            "react-dom",
            "react-router-dom",
          ],
          "vendor-motion": ["framer-motion"],
        },
      },
    },
  },
});
