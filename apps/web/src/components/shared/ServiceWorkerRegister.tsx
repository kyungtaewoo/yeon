"use client";

import { useEffect } from "react";

/**
 * 서비스 워커 등록.
 *
 * 중요: Capacitor 네이티브 환경에서는 SW 를 등록하지 않는다.
 * WKWebView 가 capacitor://localhost 스킴을 자체 핸들러로 파일을 서빙하는데,
 * SW 가 fetch 를 가로채면 응답이 비정상으로 처리되어 navigate 요청이 잘못된
 * fallback (랜딩 페이지) 으로 빠지는 현상이 관찰됨. 또한 이미 등록된 이전 빌드의
 * SW 는 명시적으로 unregister 해서 현재 세션부터 영향이 없도록 함.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const isNative = cap?.isNativePlatform?.() ?? false;

    if (isNative) {
      // 이전 빌드에서 등록된 SW 가 있으면 정리
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) r.unregister();
      });
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.error("SW registration failed:", err));
  }, []);

  return null;
}
