import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@betterdata/contracts", "@betterdata/ui"]
};

export default nextConfig;
