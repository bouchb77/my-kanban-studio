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
  
  // CORRECTION FINALE : Gestion des dépendances pour résoudre le TypeError d'exécution
  optimizeDeps: {
    // Maintien de l'inclusion pour garantir le chargement du plugin
    include: ['leaflet.heat'],
    
    // DÉDUPLICATION CRITIQUE pour les hooks React de react-leaflet
    // Force l'utilisation d'une seule version de ces modules si plusieurs copies existent.
    dedupe: ['react', 'react-dom', 'react-leaflet', 'leaflet'],
  },

  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    // Suppression du bloc rollupOptions vide ou redondant
  },
}));