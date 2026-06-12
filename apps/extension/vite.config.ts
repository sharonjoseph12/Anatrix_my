import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { resolve } from "node:path";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
  envDir: resolve(__dirname, "../.."),
  plugins: [crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: process.env.NODE_ENV === "production",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
  },
});
