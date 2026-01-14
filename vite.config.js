import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/app-gasolineras/",
  plugins: [react()],
  server: {
    proxy: {
      "/api-carburantes": {
        target: "https://sedeaplicaciones.minetur.gob.es",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api-carburantes/, ""),
      },
    },
     
  },
});

