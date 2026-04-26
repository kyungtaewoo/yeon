/**
 * ⚠️  이 enum 은 클라이언트의 다음 파일과 동일하게 유지해야 합니다:
 *     apps/web/src/lib/api/errors.ts
 *
 * 추가/제거/이름 변경 시 양쪽을 같은 PR 안에서 수정하세요.
 * (친구 궁합 PR 시점에 packages/shared 로 정식 추출 검토 예정.)
 */
export const SAVED_IDEAL_TARGET_ERROR_CODES = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  DUPLICATE: 'DUPLICATE',
  INVALID_AGE_RANGE: 'INVALID_AGE_RANGE',
} as const;

export type SavedIdealTargetErrorCode =
  (typeof SAVED_IDEAL_TARGET_ERROR_CODES)[keyof typeof SAVED_IDEAL_TARGET_ERROR_CODES];
