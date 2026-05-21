import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

if (process.env.NODE_ENV !== "production") {
  loadEnvConfig(path.resolve(process.cwd(), "../.."), true, console, true);
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CONVEX_URL:
      process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "",
  },
  transpilePackages: ["@betterdata/contracts", "@betterdata/ui"]
};

export default nextConfig;
