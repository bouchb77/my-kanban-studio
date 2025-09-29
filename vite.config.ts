import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
    include: ['leaflet.heat'],
  },

  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions: {
      // Ajout d'une configuration pour la résolution des importations
      // Note : C'est un contournement pour les modules CJS mal structurés.
      external: [],
      plugins: [
        // C'est une vérification ou une étape supplémentaire pour les modules CJS
      ],
    },
    // Option pour forcer le traitement des importations non-ESM
    // Si le plugin n'a pas de point d'entrée ES, nous le traitons comme une ressource
    // que Rollup devrait ignorer lors de l'analyse, mais inclure dans le bundle.
    // Cependant, l'approche la plus courante est de s'assurer que le CJS est résolu.
    // Si la dépendance n'est pas essentielle au *build* mais est un effet secondaire (ce qui est le cas ici),
    // nous pouvons modifier le composant React pour utiliser l'importation dynamique (`import()`).
  },
}));