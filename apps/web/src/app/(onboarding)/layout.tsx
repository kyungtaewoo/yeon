"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// 주의: Capacitor 환경에서는 window.location.href 로 하드 내비하지 말 것.
// Capacitor 의 CapacitorRouter 가 확장자 없는 경로를 무조건 /index.html (랜딩) 로
// 라우팅함. 모든 in-app 이동은 next/navigation 의 router.push/replace 를 사용해
// 클라이언트 사이드 라우팅으로 처리해야 함.

/**
 * 온보딩 영역 인증 게이트.
 * 로그인하지 않은 상태로 /saju-input, /saju-report, /preferences, /ideal-match 접근 시
 * /login 으로 클라이언트 사이드 라우팅. 하이드레이션 이전에는 로딩 화면을 보여줘 깜빡임 방지.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!token) {
      toast.error("로그인이 필요해요", {
        description: "사주 온보딩을 진행하려면 먼저 로그인해주세요.",
      });
      router.replace("/login");
    }
  }, [loading, token, router]);

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
