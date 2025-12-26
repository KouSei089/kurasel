/** @type {import('next').NextConfig} */
const nextConfig = {
  // 実験的な機能：許可するオリジンを設定
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '192.168.11.62:3000'] // あなたのPCのIPアドレス
    }
  },
  // APIへのCORS許可（必要に応じて）
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;