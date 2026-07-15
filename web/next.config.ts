import type { NextConfig } from "next";

// 服务端 rewrite 优先使用专用变量；未设置时复用浏览器公开的后端地址。
// 这样只配置 NEXT_PUBLIC_BASE_URL 也不会回退到本地 gateway。
const gateway =
  process.env.GATEWAY_ORIGIN?.trim() ||
  process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
  "http://127.0.0.1:3000";

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
