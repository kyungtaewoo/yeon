/**
 * 네이티브 진입 URL 파싱 + cold-start 가드.
 * NativeBridge.tsx 가 이 헬퍼를 사용 — UI/플랫폼 의존성 없이 단위 테스트 가능.
 */

export type DeepLinkAction =
  | { type: 'auth'; token: string; isNew: boolean }
  | { type: 'invite'; code: string };

const APP_HOST = 'yeonapp.com';
const APP_SCHEME = 'yeonapp:';

/** 라우터 진입 URL 을 의미 단위로 파싱. 알 수 없는 URL 은 null. */
export function parseDeepLinkUrl(rawUrl: string): DeepLinkAction | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Universal Link: https://yeonapp.com/invite/CODE
  if (url.protocol === 'https:' && url.hostname === APP_HOST) {
    if (url.pathname.startsWith('/invite/')) {
      const code = url.pathname.split('/invite/')[1]?.split('/')[0] ?? '';
      return code ? { type: 'invite', code } : null;
    }
    return null;
  }

  if (url.protocol !== APP_SCHEME) return null;

  // Custom scheme 초대: yeonapp://invite?code=CODE
  if (url.hostname === 'invite') {
    const code = url.searchParams.get('code') ?? '';
    return code ? { type: 'invite', code } : null;
  }

  // OAuth callback: yeonapp://auth?token=...&isNew=...
  if (url.hostname === 'auth') {
    const token = url.searchParams.get('token');
    if (!token) return null;
    return {
      type: 'auth',
      token,
      isNew: url.searchParams.get('isNew') === 'true',
    };
  }

  return null;
}

/**
 * Cold-start 시 launch URL 을 처리할지 결정.
 *
 * - auth URL + 토큰 있음 → false (이미 처리된 OAuth 콜백 재처리 방지)
 * - auth URL + 토큰 없음 → true (정상 OAuth flow)
 * - invite URL → true (토큰 무관, 메인 시나리오)
 * - 알 수 없는 URL → false
 *
 * `App.getLaunchUrl()` 은 앱 종료 전까지 같은 URL 반환 → auth 는 한 번만 처리해야 함.
 * invite 는 매번 새 액션이라 cold-start 마다 처리 필요.
 */
export function shouldProcessLaunchUrl(
  rawUrl: string,
  hasExistingToken: boolean,
): boolean {
  const action = parseDeepLinkUrl(rawUrl);
  if (!action) return false;
  if (action.type === 'auth' && hasExistingToken) return false;
  return true;
}
