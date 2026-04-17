import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = {
  "/api": {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ""),
  },
  "/media": {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    /** Escuchar en todas las interfaces (accesible por IP de LAN o pública). */
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    proxy: apiProxy,
  },
  /** Sin esto, `vite preview` no reenvía `/api` y los fetch fallan ("Failed to fetch" / 404). */
  preview: {
    host: "0.0.0.0",
    proxy: apiProxy,
  },
});
