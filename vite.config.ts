import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare({ viteEnvironment: { name: "worker" } })],
  resolve: {
    alias: {
      "@": path.resolve(root, "src/client"),
    },
  },
  environments: {
    worker: { build: { sourcemap: true } },
  },
});
