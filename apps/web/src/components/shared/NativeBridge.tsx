"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/lib/api";

/**
 * Capacitor 네이티브 브릿지.
 * - 카카오 OAuth 콜백이 `yeonapp://auth?token=...&isNew=...`로 앱을 깨우면
 *   토큰을 authStore에 저장하고 적절한 온보딩/홈 경로로 이동한다.
 * - 웹 환경에선 즉시 리턴.
 */
export function NativeBridge() {
  const router = useRouter();

  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    let handle: { remove: () => void } | undefined;

    (async () => {
      const { App } = await import("@capacitor/app");
      handle = await App.addListener("appUrlOpen", async (data: { url: string }) => {
        try {
          const url = new URL(data.url);
          if (url.protocol !== "yeonapp:") return;
          if (url.hostname !== "auth") return;

          const token = url.searchParams.get("token");
          const isNew = url.searchParams.get("isNew") === "true";
          if (!token) return;

          const me = await apiClient<{
            id: string;
            nickname: string;
            gender: string;
            isOnboardingComplete: boolean;
            isPremium: boolean;
          }>("/auth/me", { token });

          useAuthStore.getState().setAuth(token, {
            id: me.id,
            nickname: me.nickname,
            gender: me.gender,
            isOnboardingComplete: me.isOnboardingComplete,
            isPremium: me.isPremium,
          });

          router.replace(isNew || !me.isOnboardingComplete ? "/saju-input" : "/home");
        } catch (err) {
          console.error("appUrlOpen 처리 실패:", err);
        }
      });
    })();

    return () => {
      handle?.remove();
    };
  }, [router]);

  return null;
}
