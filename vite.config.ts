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
    // Maintenu pour le plugin Leaflet
    include: ['leaflet.heat'],
    // Maintenu pour le dédoublonnage (si utile)
    dedupe: ['react', 'react-dom', 'react-leaflet', 'leaflet'],
  },

  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    
    // !!! BLOC ROLLUPOPTIONS RETIRÉ !!!
  },
}));