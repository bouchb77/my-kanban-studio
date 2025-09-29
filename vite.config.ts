import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  
  optimizeDeps: {
    // Maintenu pour le plugin Leaflet
    include: ['leaflet.heat'],
    // Maintenu pour le dédoublonnage des hooks (bonne pratique)
    dedupe: ['react', 'react-dom', 'react-leaflet', 'leaflet'],
  },

  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    // **CORRECTION FINALE:** Externaliser explicitement React et ReactDOM
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
}));