import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": rootDir,
      "@betterdata/app-api": fileURLToPath(
        new URL("../../packages/app-api/src/index.ts", import.meta.url),
      ),
      "@betterdata/api-client": fileURLToPath(
        new URL("../../packages/api-client/src/index.ts", import.meta.url),
      ),
      "@betterdata/config": fileURLToPath(
        new URL("../../packages/config/src/index.ts", import.meta.url),
      ),
      "@betterdata/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
