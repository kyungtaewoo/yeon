/**
 * 프리미엄 구독 상태 훅
 * premiumStore를 기반으로 프리미엄 여부 및 만료 체크를 제공한다.
 */

import { usePremiumStore } from '@/stores/premiumStore';

export function usePremium() {
  const { isPremium, plan, expiresAt, setPremium, clearPremium } = usePremiumStore();

  // 만료 체크
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const isActive = isPremium && !isExpired;

  // 만료까지 남은 일수
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    isPremium: isActive,
    plan: isActive ? plan : 'free' as const,
    expiresAt,
    daysRemaining,
    isExpired,
    setPremium,
    clearPremium,
  };
}
