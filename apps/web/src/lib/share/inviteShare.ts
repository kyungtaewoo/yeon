/**
 * 친구 초대 공유 — Capacitor Share API + Web Share + clipboard fallback.
 *
 * URL 형식: https://yeonapp.com/invite/${code} (Universal Link).
 * iOS Associated Domains 가 깔린 빌드에서는 시스템이 직접 앱으로 라우팅,
 * 미설치 사용자는 같은 URL 의 웹 환영 페이지(/invite/[code]) 로 fallback.
 *
 * 책임 분리: 본 헬퍼는 공유 시도만 하고 토스트는 띄우지 않는다.
 * 호출부가 결과를 보고 성공/복사 토스트를 결정.
 */

import { Share } from '@capacitor/share';

export type ShareInviteResult = 'shared' | 'cancelled' | 'fallback-copied';

export interface ShareInviteOptions {
  inviteCode: string;
  inviterNickname: string;
}

const APP_ORIGIN = 'https://yeonapp.com';

interface CapacitorWindow {
  Capacitor?: { isNativePlatform?: () => boolean };
}

function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as CapacitorWindow).Capacitor;
  return cap?.isNativePlatform?.() ?? false;
}

function isCancelError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return true;
  const msg = err.message.toLowerCase();
  return msg.includes('cancel') || msg.includes('abort') || msg.includes('dismiss');
}

export function buildInviteUrl(code: string): string {
  return `${APP_ORIGIN}/invite/${encodeURIComponent(code)}`;
}

export async function shareInvite({
  inviteCode,
  inviterNickname,
}: ShareInviteOptions): Promise<ShareInviteResult> {
  const url = buildInviteUrl(inviteCode);
  const text = `${inviterNickname}님이 사주 궁합 보러 오라고 초대했어요`;
  const title = '緣 — 친구 사주 궁합';

  // 1) Native (iOS/Android via Capacitor) — 시스템 share sheet
  if (isNativePlatform()) {
    try {
      await Share.share({ title, text, url, dialogTitle: '친구에게 초대 보내기' });
      return 'shared';
    } catch (err) {
      if (isCancelError(err)) return 'cancelled';
      throw err;
    }
  }

  // 2) Web Share API (모바일 Safari/Chrome 대부분 지원)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (isCancelError(err)) return 'cancelled';
      // share 실패 시 clipboard 로 fall-through
    }
  }

  // 3) Clipboard fallback (데스크톱 웹)
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return 'fallback-copied';
  }

  // 어떤 공유 수단도 없을 때 — 호출부가 안내 토스트 띄울 수 있게 throw.
  throw new Error('공유 기능을 사용할 수 없어요');
}
