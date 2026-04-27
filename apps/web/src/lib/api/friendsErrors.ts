/**
 * 백엔드 ApiException 의 `code` 필드 분기 → 도메인 에러 클래스.
 *
 * ⚠️  이 enum 은 백엔드의 다음 파일과 동일하게 유지해야 합니다:
 *     apps/api/src/friends/error-codes.ts
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

export class FriendInviteNotFoundError extends Error {
  readonly code = FRIEND_ERROR_CODES.INVITE_NOT_FOUND;
  constructor(message: string) {
    super(message);
    this.name = 'FriendInviteNotFoundError';
  }
}

export class FriendInviteGenerationFailedError extends Error {
  readonly code = FRIEND_ERROR_CODES.INVITE_GENERATION_FAILED;
  constructor(message: string) {
    super(message);
    this.name = 'FriendInviteGenerationFailedError';
  }
}

export class FriendSelfInviteError extends Error {
  readonly code = FRIEND_ERROR_CODES.SELF_INVITE;
  constructor(message: string) {
    super(message);
    this.name = 'FriendSelfInviteError';
  }
}

export class FriendInviteExpiredError extends Error {
  readonly code = FRIEND_ERROR_CODES.INVITE_EXPIRED;
  constructor(message: string) {
    super(message);
    this.name = 'FriendInviteExpiredError';
  }
}

export class FriendInviteAlreadyAcceptedError extends Error {
  readonly code = FRIEND_ERROR_CODES.INVITE_ALREADY_ACCEPTED;
  constructor(message: string) {
    super(message);
    this.name = 'FriendInviteAlreadyAcceptedError';
  }
}

export class FriendInviteForbiddenError extends Error {
  readonly code = FRIEND_ERROR_CODES.INVITE_FORBIDDEN;
  constructor(message: string) {
    super(message);
    this.name = 'FriendInviteForbiddenError';
  }
}

export class FriendUnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED' as const;
  constructor(message: string) {
    super(message);
    this.name = 'FriendUnauthorizedError';
  }
}

export class FriendNetworkError extends Error {
  readonly code = 'NETWORK' as const;
  constructor(message: string) {
    super(message);
    this.name = 'FriendNetworkError';
  }
}
