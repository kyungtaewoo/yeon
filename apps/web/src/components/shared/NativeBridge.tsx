"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { apiClient } from "@/lib/api";
import { postLoginSync } from "@/lib/auth/postLoginSync";
import { resolvePostLoginTarget } from "@/lib/auth/postLoginRedirect";
import {
  parseDeepLinkUrl,
  shouldProcessLaunchUrl,
} from "@/lib/nativeBridge/parseDeepLink";

/**
 * Capacitor 네이티브 브릿지.
 * 처리하는 URL 종류:
 *   1) yeonapp://auth?token=...&isNew=...  카카오 OAuth 콜백
 *   2) https://yeonapp.com/invite/CODE     친구 초대 Universal Link
 *   3) yeonapp://invite?code=CODE          (예비) 커스텀 스킴 초대
 *
 * - `appUrlOpen` (warm start) 와 `App.getLaunchUrl()` (cold start) 둘 다 처리.
 * - auth 분기는 토큰 이미 있으면 launch URL 재처리 X (getLaunchUrl 은 앱 종료
 *   전까지 같은 URL 을 반환 → 매 페이지 마운트마다 재처리하면 무한 루프).
 * - invite 분기는 비로그인이어도 /invite/[code] 환영 페이지로 보냄 (그 페이지에서
 *   자체적으로 로그인 유도).
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
        const action = parseDeepLinkUrl(rawUrl);
        if (!action) return;

        if (action.type === "invite") {
          router.replace(`/invite/${encodeURIComponent(action.code)}`);
          return;
        }

        // action.type === "auth"
        const { token } = action;

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

        // 로컬 saved matches 를 백엔드로 마이그레이션 + 권위 데이터 hydrate.
        // 실패해도 로그인 자체는 성공이므로 사용자 차단 X.
        try {
          await postLoginSync(token);
        } catch (e) {
          console.warn("[postLoginSync] failed", e);
        }

        // 데모 모드에서 사주 이미 입력했으면 백엔드에 동기화 + onboarding 완료 처리.
        // 다시 saju-input 으로 보내지 않도록.
        let onboardingComplete = me.isOnboardingComplete;
        if (!onboardingComplete) {
          const { birthYear, birthMonth, birthDay, birthHour, isLunar } =
            useOnboardingStore.getState();
          if (birthYear && birthMonth && birthDay) {
            try {
              await apiClient("/saju/calculate-and-save", {
                method: "POST",
                token,
                body: {
                  year: birthYear,
                  month: birthMonth,
                  day: birthDay,
                  hour: birthHour,
                  isLunar,
                },
              });
              onboardingComplete = true;
            } catch (syncErr) {
              console.warn("[NativeBridge] 데모 사주 동기화 실패:", syncErr);
            }
          }
        }

        const defaultTarget = onboardingComplete ? "/home" : "/saju-input";
        // 비로그인 상태로 /invite/[code] 들어왔다가 로그인하고 돌아오면 그쪽으로 복귀.
        // 단 onboarding 미완 사용자는 사주 먼저 — invite 페이지가 사주 요구하므로
        // 정합성 위해 기본 라우팅이 우선.
        const target = onboardingComplete
          ? resolvePostLoginTarget(defaultTarget)
          : defaultTarget;
        router.replace(target);
      } catch (err) {
        console.error("[NativeBridge] handleUrl 실패:", err);
      }
    };

    (async () => {
      const { App } = await import("@capacitor/app");

      // Cold start: shouldProcessLaunchUrl 가 auth/invite 케이스별 가드 결정.
      // 자세한 분기 규칙은 parseDeepLink.ts 단위 테스트 참조.
      try {
        const launch = await App.getLaunchUrl();
        if (launch?.url) {
          const { token: existingToken } = useAuthStore.getState();
          if (shouldProcessLaunchUrl(launch.url, !!existingToken)) {
            await handleUrl(launch.url);
          }
        }
      } catch {
        // getLaunchUrl 이 일부 플랫폼에서 실패할 수 있음 — 무시
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
