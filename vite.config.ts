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
  
  // 1. Maintien de l'optimisation pour le dev (si nécessaire, mais souvent ignoré au build)
  optimizeDeps: {
    include: ['leaflet.heat'],
  },

  // 2. CORRECTION DÉFINITIVE POUR LE BUILD: Configuration Rollup
  build: {
    // Rollup utilise le plugin CommonJS pour traiter ce type de dépendance
    commonjsOptions: {
      include: [/node_modules/],
    },
    
    // C'est l'étape la plus critique pour les dépendances non-ESM
    rollupOptions: {
      external: [], // Assurez-vous que leaflet.heat n'est PAS ici
      plugins: [
        // Si le simple commonjsOptions ne suffit pas, l'ajout manuel du plugin CommonJS pourrait être requis.
        // Cependant, essayez d'abord sans importation supplémentaire.
      ],
    },
  },
}));