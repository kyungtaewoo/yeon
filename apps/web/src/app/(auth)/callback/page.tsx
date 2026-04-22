"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const isNew = searchParams.get("isNew") === "true";
    const code = searchParams.get("code");

    console.log("[Callback] mount", { hasToken: !!token, isNew, hasCode: !!code });

    // 새 플로우: 백엔드가 ?token=&isNew= 로 리다이렉트한 경우
    if (token) {
      const handleTokenRedirect = async () => {
        try {
          console.log("[Callback] fetching /auth/me");
          const user = await apiClient<{
            id: string;
            nickname: string;
            gender: string;
            isOnboardingComplete: boolean;
            isPremium: boolean;
          }>('/auth/me', { token });
          console.log("[Callback] /auth/me ok", {
            id: user.id,
            isOnboardingComplete: user.isOnboardingComplete,
          });

          useAuthStore.getState().setAuth(token, user);
          console.log("[Callback] setAuth done, store token present:", !!useAuthStore.getState().token);

          const target = isNew || !user.isOnboardingComplete ? "/saju-input" : "/home";
          console.log("[Callback] routing to", target);
          router.replace(target);
        } catch (error) {
          console.error("[Callback] token flow error:", error);
          router.replace("/login");
        }
      };
      handleTokenRedirect();
      return;
    }

    // 구 플로우: ?code= 로 직접 도착한 경우 (프론트에서 code 교환)
    if (!code) {
      router.replace("/login");
      return;
    }

    const handleCallback = async () => {
      try {
        const redirectUri = `${window.location.origin}/callback`;

        const data = await apiClient<{
          accessToken: string;
          user: {
            id: string;
            nickname: string;
            gender: string;
            isOnboardingComplete: boolean;
            isPremium: boolean;
          };
          isNewUser: boolean;
        }>('/auth/kakao', {
          method: 'POST',
          body: { code, redirectUri },
        });

        useAuthStore.getState().setAuth(data.accessToken, data.user);

        if (data.isNewUser || !data.user.isOnboardingComplete) {
          router.replace("/saju-input");
        } else {
          router.replace("/home");
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        router.replace("/login");
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-serif)] text-4xl text-[var(--brand-red)] animate-pulse">
          緣
        </h1>
        <p className="mt-4 text-[var(--muted-foreground)]">로그인 처리 중...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-serif)] text-4xl text-[var(--brand-red)] animate-pulse">緣</h1>
          <p className="mt-4 text-[var(--muted-foreground)]">로딩 중...</p>
        </div>
      </div>
    }>
      <CallbackInner />
    </Suspense>
  );
}
