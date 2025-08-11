import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "react-p2p": resolve(__dirname, "../src")
    },
    dedupe: ["react"]
  },
  optimizeDeps: { exclude: ["react-p2p"] }
});