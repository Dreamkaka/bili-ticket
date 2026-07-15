import type { NextConfig } from "next";

const gateway =
  process.env.GATEWAY_ORIGIN?.trim() || "http://127.0.0.1:3000";

const nextConfig: NextConfig = {
  async rewrites() {
    const base = gateway.replace(/\/$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${base}/api/:path*`,
      },
      {
        source: "/ws/:path*",
        destination: `${base}/ws/:path*`,
      },
    ];
  },
};

export default nextConfig;
