"use client";

import { useEffect } from "react";

/**
 * Kakao JavaScript SDK 로드 + Kakao.init 부트스트랩.
 *
 * 카카오톡 공유(KakaoLink) 만 사용. 로그인은 서버 OAuth 흐름이라 SDK 의존 X.
 * SDK 미로드/init 실패 시 silent — 호출부(kakaoShare.ts)가 fallback 처리.
 *
 * 도메인 검증: SDK 자체는 init 시 origin 안 봄. 실제 호출(Share.sendDefault)에서
 * 카카오 서버가 referer 검사 → 등록된 사이트 도메인(yeonapp.com) 과 매칭 필요.
 * Capacitor WebView origin (capacitor://localhost) 은 콘솔 등록 가능 여부에 따라
 * 동작 갈림 → 실패 시 호출부가 Capacitor Share fallback.
 */
const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
const KAKAO_SDK_INTEGRITY =
  "sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nka";

interface KakaoLike {
  init?: (key: string) => void;
  isInitialized?: () => boolean;
}

export function KakaoSdkLoader() {
  useEffect(() => {
    const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!jsKey) return;
    if (typeof window === "undefined") return;

    const w = window as unknown as { Kakao?: KakaoLike };

    const init = () => {
      try {
        if (w.Kakao?.isInitialized && !w.Kakao.isInitialized()) {
          w.Kakao.init?.(jsKey);
        }
      } catch {
        // ignore — fallback path will handle share
      }
    };

    if (w.Kakao) {
      init();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${KAKAO_SDK_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", init, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = KAKAO_SDK_URL;
    script.integrity = KAKAO_SDK_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.async = true;
    script.addEventListener("load", init, { once: true });
    document.head.appendChild(script);
  }, []);

  return null;
}
