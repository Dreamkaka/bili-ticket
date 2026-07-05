import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // 将前端 /api/:path* 代理到后端的 3000 端口
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*', 
      },
      {
        // 将前端 WebSocket 请求代理到后端的 3000 端口
        source: '/ws/:path*',
        destination: 'http://localhost:3000/ws/:path*',
      }
    ];
  },
};

module.exports = nextConfig;

export default nextConfig;
