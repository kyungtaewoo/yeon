import type { NextConfig } from "next";

// CAPACITOR_BUILD=1 일 때만 정적 export 모드 (Capacitor 가 out/ 을 요구).
// Vercel 빌드는 이 변수 없이 돌아서 서버 렌더 모드로 가고, 따로 수정한 설정을 그대로 쓴다.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1';

const nextConfig: NextConfig = {
  ...(isCapacitorBuild ? { output: 'export' as const } : {}),

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
    ];
  },
};

export default nextConfig;
