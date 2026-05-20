import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/worker.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  noExternal: [
    "@betterdata/app-api",
    "@betterdata/config",
    "@betterdata/contracts",
    "@betterdata/database"
  ]
});
