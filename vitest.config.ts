import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

// Test runner for the existing *.test.ts files and the backup engine suite.
// jsdom provides the DOM that the password/UI tests expect; the backup engine
// tests run in plain Node and use node:sqlite for real database fixtures.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 60_000,
    pool: "forks",
  },
});
