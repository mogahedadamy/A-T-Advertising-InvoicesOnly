import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import fs from "fs";
import path from "path";

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "./package.json"), "utf8")
) as { version?: string };

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version ?? "0.0.0"),
  },
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("invoiceImagesBase64")) return "invoice-images";
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("html2canvas") || id.includes("jspdf")) return "vendor-pdf";
          if (id.includes("@tanstack")) return "vendor-tanstack";
          if (id.includes("@radix-ui") || id.includes("lucide-react")) return "vendor-ui";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
