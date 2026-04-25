"use client";

import { useEffect } from "react";

/**
 * 서비스 워커 등록.
 *
 * Capacitor 환경에서도 일단 등록을 시도한다 — 새 sw.js 가 자기 자신을 unregister
 * + 모든 fetch 를 pass-through 하도록 작성돼 있기 때문. 등록을 건너뛰면 브라우저가
 * 새 sw.js 를 fetch 할 기회가 없어 이전 빌드의 유해한 SW 가 그대로 남아있음
 * (1.0(12) 에서 발견한 함정).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => reg.update().catch(() => undefined))
      .catch((err) => console.error("SW registration failed:", err));
  }, []);

  return null;
}
