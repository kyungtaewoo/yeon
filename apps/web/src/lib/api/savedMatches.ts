import { apiClient, ApiError } from '.';
import {
  LimitExceededDetails,
  SAVED_MATCHES_ERROR_CODES,
  SavedMatchesDuplicateError,
  SavedMatchesLimitExceededError,
  SavedMatchesNetworkError,
  SavedMatchesUnauthorizedError,
  SavedMatchesValidationError,
} from './errors';

export type SavedIdealTargetStatus = 'searching' | 'matched' | 'archived';

export interface SavedIdealTarget {
  id: string;
  userId: string;
  dayStem: string;
  dayBranch: string;
  ageMin: number;
  ageMax: number;
  totalScore: number;
  profile: Record<string, unknown>;
  status: SavedIdealTargetStatus;
  savedAt: string;
  updatedAt: string;
}

export interface SavedIdealTargetMeta {
  count: number;
  limit: number;
  tier: 'free' | 'premium';
  canAddMore: boolean;
}

export interface SavedIdealTargetListResponse {
  items: SavedIdealTarget[];
  meta: SavedIdealTargetMeta;
}

export interface CreateSavedIdealTargetPayload {
  dayStem: string;
  dayBranch: string;
  ageMin: number;
  ageMax: number;
  totalScore: number;
  profile: Record<string, unknown>;
}

/**
 * ApiError → 도메인 에러 매핑.
 *
 * 백엔드 ApiException 의 `code` 필드 기준으로 분기 — 메시지 prefix 매칭에서 졸업.
 * 백엔드 코드 enum 변경 시 errors.ts 의 SAVED_MATCHES_ERROR_CODES 도 함께 수정.
 */
export function mapSavedMatchesError(err: unknown): never {
  if (err instanceof ApiError) {
    // 401: code 가 없을 수도 있음 (Passport 기본 응답)
    if (err.status === 401) {
      throw new SavedMatchesUnauthorizedError(err.message || '다시 로그인이 필요해요');
    }

    switch (err.code) {
      case SAVED_MATCHES_ERROR_CODES.LIMIT_EXCEEDED: {
        const details = err.details as LimitExceededDetails | undefined;
        if (!details) {
          // 방어적 기본값 — 백엔드 누락 시 free 가정
          throw new SavedMatchesLimitExceededError(err.message, {
            current: 0,
            limit: 3,
            tier: 'free',
          });
        }
        throw new SavedMatchesLimitExceededError(err.message, details);
      }
      case SAVED_MATCHES_ERROR_CODES.DUPLICATE:
        throw new SavedMatchesDuplicateError(err.message);
      case SAVED_MATCHES_ERROR_CODES.INVALID_AGE_RANGE:
        throw new SavedMatchesValidationError(err.message);
    }

    if (err.status === 0 || err.status >= 500) {
      throw new SavedMatchesNetworkError(err.message);
    }
    // USER_NOT_FOUND / TARGET_NOT_FOUND / 기타 4xx — 그대로 노출
    throw err;
  }
  if (err instanceof Error) {
    throw new SavedMatchesNetworkError(err.message);
  }
  throw new SavedMatchesNetworkError('알 수 없는 오류');
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export async function getMyList(token: string): Promise<SavedIdealTargetListResponse> {
  try {
    return await apiClient<SavedIdealTargetListResponse>('/matches/saved', { token });
  } catch (err) {
    mapSavedMatchesError(err);
  }
}

export async function create(
  token: string,
  payload: CreateSavedIdealTargetPayload,
): Promise<SavedIdealTarget> {
  try {
    return await apiClient<SavedIdealTarget>('/matches/saved', {
      method: 'POST',
      token,
      body: payload,
    });
  } catch (err) {
    mapSavedMatchesError(err);
  }
}

export async function remove(token: string, id: string): Promise<void> {
  try {
    await apiClient<void>(`/matches/saved/${id}`, { method: 'DELETE', token });
  } catch (err) {
    mapSavedMatchesError(err);
  }
}

// 에러 클래스 re-export — 호출부가 한 모듈에서 모두 import 가능하도록.
export {
  SAVED_MATCHES_ERROR_CODES,
  SavedMatchesDuplicateError,
  SavedMatchesLimitExceededError,
  SavedMatchesNetworkError,
  SavedMatchesUnauthorizedError,
  SavedMatchesValidationError,
} from './errors';
export type { LimitExceededDetails, SavedMatchesErrorCode } from './errors';
