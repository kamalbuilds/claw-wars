import type { NextConfig } from "next";

const ENGINE_URL = process.env.ENGINE_URL || "http://52.91.198.101:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/engine/:path*",
        destination: `${ENGINE_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
