import type { NextConfig } from 'next';

// /api 配下はアプリ自身が同一オリジンから呼ぶだけなので、CORSは開けない。
// 開けると他サイトのブラウザから /api/analyze-receipt を叩かれ、
// サーバー側に置いたGeminiのキーと無料枠を第三者に使われる。
const nextConfig: NextConfig = {};

export default nextConfig;
