import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@betterdata/contracts", "@betterdata/ui"],
};

export default nextConfig;
