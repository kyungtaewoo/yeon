"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");

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
