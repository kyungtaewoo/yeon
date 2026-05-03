/**
 * 프리미엄 구독 상태 훅.
 *
 * Source of truth: 백엔드 users.isPremium (authStore.user.isPremium 으로 노출).
 * AppHydrator 가 부팅 시 /auth/me refetch → DB 변경 자동 반영.
 *
 * premiumStore 는 결제 직후 optimistic update 용 — reload 전까지 즉시 잠금 해제
 * 위해 유지. 둘 중 하나라도 활성이면 premium.
 *
 * 만료 처리:
 *  - 백엔드 isPremium 은 서버가 만료 후 false 로 토글하는 것에 의존 (DB 권위).
 *  - premiumStore.expiresAt 은 클라이언트 측 optimistic 만료 — 결제 직후 잠시
 *    동안만 의미 있음.
 */

import { useAuthStore } from '@/stores/authStore';
import { usePremiumStore } from '@/stores/premiumStore';

export function usePremium() {
  const userIsPremium = useAuthStore((s) => s.user?.isPremium ?? false);
  const { isPremium: storePremium, plan, expiresAt, setPremium, clearPremium } =
    usePremiumStore();

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const isStoreActive = storePremium && !isExpired;

  const isActive = userIsPremium || isStoreActive;

  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    isPremium: isActive,
    plan: isActive ? plan : ('free' as const),
    expiresAt,
    daysRemaining,
    isExpired,
    setPremium,
    clearPremium,
  };
}
