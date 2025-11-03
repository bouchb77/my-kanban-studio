// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///home/project/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "/home/project";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  optimizeDeps: {
    // Maintenu pour le plugin Leaflet
    include: ["leaflet.heat"],
    // Maintenu pour le dédoublonnage (si utile)
    dedupe: ["react", "react-dom", "react-leaflet", "leaflet"]
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/]
    }
    // !!! BLOC ROLLUPOPTIONS RETIRÉ !!!
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcblx1MDBBMCBzZXJ2ZXI6IHtcblx1MDBBMCBcdTAwQTAgaG9zdDogXCI6OlwiLFxuXHUwMEEwIFx1MDBBMCBwb3J0OiA4MDgwLFxuXHUwMEEwIH0sXG5cdTAwQTAgcGx1Z2luczogW3JlYWN0KCksIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBjb21wb25lbnRUYWdnZXIoKV0uZmlsdGVyKEJvb2xlYW4pLFxuXHUwMEEwIHJlc29sdmU6IHtcblx1MDBBMCBcdTAwQTAgYWxpYXM6IHtcblx1MDBBMCBcdTAwQTAgXHUwMEEwIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuXHUwMEEwIFx1MDBBMCB9LFxuXHUwMEEwIH0sXG5cdTAwQTBcdTAwQTBcblx1MDBBMCBvcHRpbWl6ZURlcHM6IHtcblx1MDBBMCBcdTAwQTAgLy8gTWFpbnRlbnUgcG91ciBsZSBwbHVnaW4gTGVhZmxldFxuXHUwMEEwIFx1MDBBMCBpbmNsdWRlOiBbJ2xlYWZsZXQuaGVhdCddLFxuXHUwMEEwIFx1MDBBMCAvLyBNYWludGVudSBwb3VyIGxlIGRcdTAwRTlkb3VibG9ubmFnZSAoc2kgdXRpbGUpXG5cdTAwQTAgXHUwMEEwIGRlZHVwZTogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3QtbGVhZmxldCcsICdsZWFmbGV0J10sXG5cdTAwQTAgfSxcblxuXHUwMEEwIGJ1aWxkOiB7XG5cdTAwQTAgXHUwMEEwIGNvbW1vbmpzT3B0aW9uczoge1xuXHUwMEEwIFx1MDBBMCBcdTAwQTAgaW5jbHVkZTogWy9ub2RlX21vZHVsZXMvXSxcblx1MDBBMCBcdTAwQTAgfSxcblx1MDBBMCBcdTAwQTAgXG5cdTAwQTAgXHUwMEEwIC8vICEhISBCTE9DIFJPTExVUE9QVElPTlMgUkVUSVJcdTAwQzkgISEhXG5cdTAwQTAgfSxcbn0pKTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFIaEMsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsU0FBUyxDQUFDLE1BQU0sR0FBRyxTQUFTLGlCQUFpQixnQkFBZ0IsQ0FBQyxFQUFFLE9BQU8sT0FBTztBQUFBLEVBQzlFLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFBQSxFQUVBLGNBQWM7QUFBQTtBQUFBLElBRVosU0FBUyxDQUFDLGNBQWM7QUFBQTtBQUFBLElBRXhCLFFBQVEsQ0FBQyxTQUFTLGFBQWEsaUJBQWlCLFNBQVM7QUFBQSxFQUMzRDtBQUFBLEVBRUEsT0FBTztBQUFBLElBQ0wsaUJBQWlCO0FBQUEsTUFDZixTQUFTLENBQUMsY0FBYztBQUFBLElBQzFCO0FBQUE7QUFBQSxFQUdGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
