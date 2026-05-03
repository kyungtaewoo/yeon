"use client";

import { useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSavedMatchesStore } from '@/stores/savedMatchesStore';

/**
 * 부팅 시 1회 실행되는 동기화 트리거.
 *
 * - 토큰 있으면 /auth/me refetch (DB-backed isPremium / nickname 등 최신화) +
 *   saved matches hydrate.
 * - 토큰 없으면 noop (persist 캐시 = 비로그인 동작 유지).
 * - 에러는 silent — 토큰 만료면 다음 보호 호출에서 재로그인 유도.
 *
 * /auth/me refetch 가 필요한 이유:
 *  - authStore.user 는 로그인 시점 스냅샷이라 그 후 백엔드 변경 (isPremium 토글,
 *    nickname 변경 등) 이 클라이언트에 반영 안 됨. 앱 부팅마다 한 번 sync.
 *
 * StrictMode 대응:
 *  - dev 의 useEffect 이중 실행으로 hydrate 가 두 번 발사되는 걸 useRef 로 차단.
 *    hydrate 자체는 idempotent 라 정확성 문제는 없지만 네트워크 비용 절감 목적.
 *
 * authStore persist hydration race 대응:
 *  - 마운트 직후엔 zustand persist 가 localStorage 에서 token 을 복원하기 전이라
 *    token 이 null 로 보일 수 있다. onFinishHydration 까지 기다렸다가 hydrate 호출.
 */
export function AppHydrator() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const run = async (token: string | null) => {
      if (!token) return;

      // /auth/me 로 user 최신값 (특히 isPremium) 동기화. 401 등은 silent.
      try {
        const me = await apiClient<{
          id: string;
          nickname: string;
          gender: string;
          isOnboardingComplete: boolean;
          isPremium: boolean;
        }>('/auth/me', { token });
        useAuthStore.getState().updateUser({
          id: me.id,
          nickname: me.nickname,
          gender: me.gender,
          isOnboardingComplete: me.isOnboardingComplete,
          isPremium: me.isPremium,
        });
      } catch (e) {
        console.warn('[AppHydrator] /auth/me refetch failed', e);
      }

      void useSavedMatchesStore.getState().hydrate(token);
    };

    if (useAuthStore.persist.hasHydrated()) {
      void run(useAuthStore.getState().token);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      void run(useAuthStore.getState().token);
    });
    return unsub;
  }, []);

  return null;
}
