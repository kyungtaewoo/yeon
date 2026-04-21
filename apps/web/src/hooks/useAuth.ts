"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

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
    clearAuth();
  };

  return {
    user: token ? user : null,
    token: hydrated ? token : null,
    loading: !hydrated,
    signOut,
  };
}
