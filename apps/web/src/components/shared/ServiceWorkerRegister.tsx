"use client";

import { useEffect } from "react";

/**
 * 서비스 워커 등록.
 *
 * Capacitor 정책:
 * - 기존에 등록된 SW 가 있으면 → 새 sw.js 를 register 해서 v3 (self-destructing)
 *   로 교체하도록 트리거. v3 가 활성화되면 자기 자신 unregister + clients reload.
 * - 기존 등록이 없으면 → register 하지 않음. (register 했다가 v3 가 unregister 후
 *   reload, 그 reload 에서 또 register, 또 unregister... 무한 루프 발생.)
 *
 * 결과: 1.0(12) 이전 빌드에서 v1 SW 가 남아있던 사용자는 1.0(13) 첫 실행 시 한
 * 번의 cleanup reload 후 SW 가 영구 제거. 신규 설치자는 SW 등록 자체 없음.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const isNative = cap?.isNativePlatform?.() ?? false;

    if (isNative) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          if (regs.length === 0) return; // 정리됨 — register 호출하면 무한 루프
          // 기존 SW 가 있음 → 새 v3 로 교체 트리거
          return navigator.serviceWorker
            .register("/sw.js", { scope: "/" })
            .catch(() => undefined);
        })
        .catch(() => undefined);
      return;
    }

    // 웹 (브라우저): 평소대로 등록
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.error("SW registration failed:", err));
  }, []);

  return null;
}
