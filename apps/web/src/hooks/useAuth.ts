"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useSavedMatchesStore } from "@/stores/savedMatchesStore";

/**
 * 클라이언트 사이드 인증 훅.
 * Zustand persist에서 JWT를 꺼내오며, 하이드레이션 완료까지 loading=true를 유지한다.
 */
export function useAuth() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  const signOut = () => {
    // clearAuth 보다 먼저 — token 변경을 다른 컴포넌트가 감지하기 전에 매칭 store 비움.
    // 누락 시 공용 PC 시나리오에서 다음 사용자 로그인 직후 hydrate 완료 전에
    // 이전 사용자의 매칭이 잠깐 노출 (개인정보 사고).
    useSavedMatchesStore.getState().clear();
    clearAuth();
  };

  return {
    user: token ? user : null,
    token: hydrated ? token : null,
    loading: !hydrated,
    signOut,
  };
}
