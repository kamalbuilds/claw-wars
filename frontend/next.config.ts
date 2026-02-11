import type { NextConfig } from "next";

const ENGINE_URL = process.env.ENGINE_URL || "http://52.91.198.101:3001";
const WS_ENGINE_URL = process.env.WS_ENGINE_URL || "http://52.91.198.101:3002";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/engine/:path*",
        destination: `${ENGINE_URL}/:path*`,
      },
      {
        source: "/ws",
        destination: WS_ENGINE_URL,
      },
    ];
  },
};

export default nextConfig;
