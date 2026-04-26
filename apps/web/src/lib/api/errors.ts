/**
 * 백엔드 ApiException 의 `code` 필드 분기 → 도메인 에러 클래스.
 *
 * ⚠️  이 enum 은 백엔드의 다음 파일과 동일하게 유지해야 합니다:
 *     apps/api/src/matching/saved-ideal-targets/error-codes.ts
 *
 * 추가/제거/이름 변경 시 양쪽을 같은 PR 안에서 수정하세요.
 * (친구 궁합 PR 시점에 packages/shared 로 정식 추출 검토 예정.)
 */
export const SAVED_MATCHES_ERROR_CODES = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  DUPLICATE: 'DUPLICATE',
  INVALID_AGE_RANGE: 'INVALID_AGE_RANGE',
} as const;

export type SavedMatchesErrorCode =
  (typeof SAVED_MATCHES_ERROR_CODES)[keyof typeof SAVED_MATCHES_ERROR_CODES];

// ---------------------------------------------------------------------------
// LIMIT_EXCEEDED 의 details — UI 토스트에서 "n/m 사용 중", tier 별 액션 분기.
// 백엔드 saved-ideal-targets.service.ts 의 throw site 에서 정확히 이 3개 필드를 보냄.
// ---------------------------------------------------------------------------

export interface LimitExceededDetails {
  current: number;
  limit: number;
  tier: 'free' | 'premium';
}

// ---------------------------------------------------------------------------
// 도메인 에러 클래스 — 호출부에서 instanceof 분기.
// `code` 는 readonly 리터럴 union 이라 좁힌 타입에서 자동 추론 가능.
// ---------------------------------------------------------------------------

export class SavedMatchesLimitExceededError extends Error {
  readonly code = SAVED_MATCHES_ERROR_CODES.LIMIT_EXCEEDED;
  constructor(message: string, public details: LimitExceededDetails) {
    super(message);
    this.name = 'SavedMatchesLimitExceededError';
  }
}

export class SavedMatchesDuplicateError extends Error {
  readonly code = SAVED_MATCHES_ERROR_CODES.DUPLICATE;
  constructor(message: string) {
    super(message);
    this.name = 'SavedMatchesDuplicateError';
  }
}

export class SavedMatchesValidationError extends Error {
  readonly code = SAVED_MATCHES_ERROR_CODES.INVALID_AGE_RANGE;
  constructor(message: string) {
    super(message);
    this.name = 'SavedMatchesValidationError';
  }
}

export class SavedMatchesUnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SavedMatchesUnauthorizedError';
  }
}

export class SavedMatchesNetworkError extends Error {
  readonly code = 'NETWORK' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SavedMatchesNetworkError';
  }
}
