import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Dev에서 effect 이중 실행·모달 언마운트로 점사 SSE가 끊겼다가 다시 도는 현상 방지(프로덕션과 동작 맞춤). */
  reactStrictMode: false,
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
