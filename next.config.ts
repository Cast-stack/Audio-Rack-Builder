import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // The research routes call out to the Anthropic API and can run long.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
