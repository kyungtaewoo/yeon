"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// Capacitor 정적 빌드는 trailingSlash:true → /path/index.html.
// window.location.href 로 하드 내비할 때 iOS 에서는 trailing slash 가 필요.
function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() ?? false;
}

function navigateHard(path: string) {
  const withSlash = isCapacitor() && !path.endsWith("/") ? `${path}/` : path;
  window.location.href = withSlash;
}

/**
 * 온보딩 영역 인증 게이트.
 * 로그인하지 않은 상태로 /saju-input, /saju-report, /preferences, /ideal-match 접근 시
 * /login 으로 하드 리다이렉트. 하이드레이션 이전에는 로딩 화면을 보여줘 깜빡임 방지.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!token) {
      toast.error("로그인이 필요해요", {
        description: "사주 온보딩을 진행하려면 먼저 로그인해주세요.",
      });
      navigateHard("/login");
    }
  }, [loading, token]);

  if (loading || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-serif)] text-4xl text-[var(--brand-red)] animate-pulse">
            緣
          </h1>
          <p className="mt-4 text-[var(--muted-foreground)]">로그인 확인 중...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
