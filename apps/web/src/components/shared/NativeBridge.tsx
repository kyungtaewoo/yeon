"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/lib/api";

/**
 * Capacitor 네이티브 브릿지.
 * - 카카오 OAuth 콜백이 `yeonapp://auth?token=...&isNew=...`로 앱을 깨우면
 *   토큰을 authStore(localStorage)에 저장하고 적절한 경로로 이동한다.
 * - `appUrlOpen` (warm start) 와 `App.getLaunchUrl()` (cold start) 둘 다 처리한다.
 * - 라우팅은 `window.location.href` 로 하드 내비 — Next.js static export 환경에서
 *   client-side router.replace() 가 실패하는 케이스를 회피.
 * - 웹 환경에선 즉시 리턴.
 */
export function NativeBridge() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const isNative = cap?.isNativePlatform?.() ?? false;
    console.log("[NativeBridge] mount", { hasCapacitor: !!cap, isNative });
    if (!isNative) return;

    let handle: { remove: () => void } | undefined;
    let consumed = false; // cold-start URL 과 warm-start 이벤트가 중복 처리되는 걸 방지

    const handleUrl = async (rawUrl: string, source: "launch" | "event") => {
      if (consumed) {
        console.log("[NativeBridge] already consumed, skip", { source });
        return;
      }
      console.log("[NativeBridge] handleUrl", { source, rawUrl });
      try {
        const url = new URL(rawUrl);
        console.log("[NativeBridge] parsed", {
          protocol: url.protocol,
          hostname: url.hostname,
          search: url.search,
        });
        if (url.protocol !== "yeonapp:") {
          console.log("[NativeBridge] skip — protocol mismatch");
          return;
        }
        if (url.hostname !== "auth") {
          console.log("[NativeBridge] skip — hostname mismatch");
          return;
        }

        const token = url.searchParams.get("token");
        const isNew = url.searchParams.get("isNew") === "true";
        console.log("[NativeBridge] params", { hasToken: !!token, isNew });
        if (!token) {
          console.warn("[NativeBridge] no token in URL — abort");
          return;
        }

        consumed = true;

        console.log("[NativeBridge] fetching /auth/me");
        const me = await apiClient<{
          id: string;
          nickname: string;
          gender: string;
          isOnboardingComplete: boolean;
          isPremium: boolean;
        }>("/auth/me", { token });
        console.log("[NativeBridge] /auth/me ok", {
          id: me.id,
          isOnboardingComplete: me.isOnboardingComplete,
        });

        useAuthStore.getState().setAuth(token, {
          id: me.id,
          nickname: me.nickname,
          gender: me.gender,
          isOnboardingComplete: me.isOnboardingComplete,
          isPremium: me.isPremium,
        });
        console.log("[NativeBridge] setAuth done, store token present:", !!useAuthStore.getState().token);

        const target = isNew || !me.isOnboardingComplete ? "/saju-input" : "/home";
        console.log("[NativeBridge] hard-nav to", target);
        // Next.js router.replace 대신 window.location.href — static export 에서 안정적
        window.location.href = target;
      } catch (err) {
        console.error("[NativeBridge] handleUrl 실패:", err);
        consumed = false; // 실패하면 재시도 허용
      }
    };

    (async () => {
      const { App } = await import("@capacitor/app");

      // 1) Cold start: 앱이 yeonapp:// 로 처음 열린 경우
      try {
        const launch = await App.getLaunchUrl();
        console.log("[NativeBridge] launchUrl", launch);
        if (launch?.url) {
          await handleUrl(launch.url, "launch");
        }
      } catch (err) {
        console.warn("[NativeBridge] getLaunchUrl 실패:", err);
      }

      // 2) Warm start: 앱이 이미 떠있는 상태에서 yeonapp:// 가 들어오는 경우
      console.log("[NativeBridge] registering appUrlOpen listener");
      handle = await App.addListener("appUrlOpen", (data: { url: string }) => {
        consumed = false; // 매 event 마다 새 처리 허용
        void handleUrl(data.url, "event");
      });
      console.log("[NativeBridge] listener registered");
    })();

    return () => {
      console.log("[NativeBridge] unmounting, removing listener");
      handle?.remove();
    };
  }, []);

  return null;
}
