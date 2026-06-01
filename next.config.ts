import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    /** 배포 후 stale JS 청크(ChunkLoadError) 방지 — _next/static은 네트워크 우선 */
    runtimeCaching: [
      {
        urlPattern: /\/mascot\/.*\.glb$/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "mascot-glb",
          expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
          networkTimeoutSeconds: 12,
        },
      },
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "next-static-assets",
          expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 },
          networkTimeoutSeconds: 8,
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  /** Dev에서 effect 이중 실행·모달 언마운트로 점사 SSE가 끊겼다가 다시 도는 현상 방지(프로덕션과 동작 맞춤). */
  reactStrictMode: false,
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
      "https://www.googletagmanager.com",
    ].join(" ");

    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://www.fortune82.com https://*.fortune82.com",
      "worker-src 'self' blob:",
      "media-src 'self' blob:",
      "frame-src 'self' https://www.fortune82.com https://*.fortune82.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://www.fortune82.com https://*.fortune82.com",
      "frame-ancestors 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
