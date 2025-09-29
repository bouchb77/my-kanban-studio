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
  
// --- CORRECTION ROLLUP/VITE POUR LES DÉPENDANCES NON-ESM ---
  optimizeDeps: {
    // Force Vite à pré-construire ce module pendant la phase de développement
    // et à le résoudre correctement pour le build.
    include: ['leaflet.heat'],
  },
  build: {
    // Cette option peut aider Rollup à traiter les dépendances CommonJS (CJS)
    // comme leaflet.heat si nécessaire, mais optimizeDeps est généralement suffisant.
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
// -------------------------------------------------------------
}));