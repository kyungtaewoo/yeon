"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/lib/api";

/**
 * Capacitor 네이티브 브릿지.
 * - 카카오 OAuth 콜백이 `yeonapp://auth?token=...&isNew=...`로 앱을 깨우면
 *   토큰을 authStore(localStorage)에 저장하고 적절한 경로로 이동한다.
 * - `appUrlOpen` (warm start) 와 `App.getLaunchUrl()` (cold start) 둘 다 처리한다.
 * - 이미 authStore 에 토큰이 있으면 launch URL 은 재처리하지 않는다 —
 *   getLaunchUrl 은 앱 종료 전까지 같은 URL 을 반환하므로 매 페이지 마운트마다
 *   재처리하면 무한 루프.
 * - 라우팅은 next/navigation 의 router.replace 로 클라이언트 사이드 처리.
 *   window.location.href 로 하드 내비하면 Capacitor 의 CapacitorRouter 가
 *   확장자 없는 경로를 무조건 /index.html (랜딩) 로 라우팅하여 stuck 됨.
 * - 웹 환경에선 즉시 리턴.
 */
export function NativeBridge() {
  const router = useRouter();
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const isNative = cap?.isNativePlatform?.() ?? false;
    if (!isNative) return;

    let handle: { remove: () => void } | undefined;

    const handleUrl = async (rawUrl: string) => {
      try {
        const url = new URL(rawUrl);
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

        const target = isNew || !me.isOnboardingComplete ? "/saju-input" : "/home";
        router.replace(target);
      } catch (err) {
        console.error("[NativeBridge] handleUrl 실패:", err);
      }
    };

    (async () => {
      const { App } = await import("@capacitor/app");

      // Cold start: 이미 로그인 상태면 launch URL 은 이전에 처리된 것 → skip.
      const { token: existingToken } = useAuthStore.getState();
      if (!existingToken) {
        try {
          const launch = await App.getLaunchUrl();
          if (launch?.url) {
            await handleUrl(launch.url);
          }
        } catch {
          // getLaunchUrl 이 일부 플랫폼에서 실패할 수 있음 — 무시
        }
      }

      // Warm start: 앱이 이미 떠있는 상태에서 yeonapp:// 가 들어옴
      handle = await App.addListener("appUrlOpen", (data: { url: string }) => {
        void handleUrl(data.url);
      });
    })();

    return () => {
      handle?.remove();
    };
  }, [router]);

  return null;
}
