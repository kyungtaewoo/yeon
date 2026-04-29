import type { NextConfig } from "next";

// CAPACITOR_BUILD=1 일 때만 정적 export 모드 (Capacitor 가 out/ 을 요구).
// Vercel 빌드는 이 변수 없이 돌아서 서버 렌더 모드로 가고, 따로 수정한 설정을 그대로 쓴다.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1';

const nextConfig: NextConfig = {
  // Capacitor: trailingSlash 를 켜서 /route/index.html 형태로 export →
  // WKWebView 가 directory 요청을 index.html 로 자연스럽게 resolve.
  // Vercel 빌드는 이 옵션 없이 서버 렌더 유지.
  ...(isCapacitorBuild ? { output: 'export' as const, trailingSlash: true } : {}),

  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        // Apple Universal Links — iOS 가 fetch 하는 AASA 파일.
        // 확장자가 없어서 Vercel 이 octet-stream 으로 서빙 → application/json 으로 강제.
        source: "/.well-known/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default nextConfig;
