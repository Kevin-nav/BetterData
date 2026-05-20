import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

if (process.env.NODE_ENV !== "production") {
  loadEnvConfig(path.resolve(process.cwd(), "../.."), true, console, true);
}

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@betterdata/contracts", "@betterdata/ui"],
};

export default nextConfig;
