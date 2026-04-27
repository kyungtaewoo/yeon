/**
 * ⚠️  이 enum 은 클라이언트의 다음 파일과 동일하게 유지해야 합니다:
 *     apps/web/src/lib/api/friendsErrors.ts
 *
 * 추가/제거/이름 변경 시 양쪽을 같은 PR 안에서 수정하세요.
 * (packages/shared 추출은 PR 4 시점에 검토.)
 */
export const FRIEND_ERROR_CODES = {
  INVITE_NOT_FOUND: 'INVITE_NOT_FOUND',
  INVITE_GENERATION_FAILED: 'INVITE_GENERATION_FAILED',
  SELF_INVITE: 'SELF_INVITE',
  INVITE_EXPIRED: 'INVITE_EXPIRED',
  INVITE_ALREADY_ACCEPTED: 'INVITE_ALREADY_ACCEPTED',
  INVITE_FORBIDDEN: 'INVITE_FORBIDDEN',
} as const;

export type FriendErrorCode =
  (typeof FRIEND_ERROR_CODES)[keyof typeof FRIEND_ERROR_CODES];
