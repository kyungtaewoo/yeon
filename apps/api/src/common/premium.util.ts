import type { User } from '../users/entities/user.entity';

/** 프리미엄 플래그 + 만료일을 함께 확인 */
export function isPremiumUser(user: User | null | undefined): boolean {
  if (!user?.isPremium) return false;
  if (user.premiumExpiresAt && user.premiumExpiresAt.getTime() < Date.now()) return false;
  return true;
}
