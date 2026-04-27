"use client";

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSavedMatchesStore } from '@/stores/savedMatchesStore';

/**
 * 부팅 시 1회 실행되는 동기화 트리거.
 *
 * - 토큰 있으면 saved matches 를 백엔드에서 hydrate.
 * - 토큰 없으면 noop (persist 캐시 = 비로그인 동작 유지).
 * - 에러는 store 내부에서 lastError 에 보존하므로 throw 하지 않는다.
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

    const run = (token: string | null) => {
      if (!token) return;
      void useSavedMatchesStore.getState().hydrate(token);
    };

    if (useAuthStore.persist.hasHydrated()) {
      run(useAuthStore.getState().token);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      run(useAuthStore.getState().token);
    });
    return unsub;
  }, []);

  return null;
}
