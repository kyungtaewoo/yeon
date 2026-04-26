import { apiClient, ApiError } from '.';

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

// ---------------------------------------------------------------------------
// 도메인 에러 — 토스트 톤 가이드대로 호출부에서 분기 처리.
// ---------------------------------------------------------------------------

export class SavedMatchesLimitExceededError extends Error {
  readonly code = 'LIMIT_EXCEEDED' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SavedMatchesLimitExceededError';
  }
}

export class SavedMatchesDuplicateError extends Error {
  readonly code = 'DUPLICATE' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SavedMatchesDuplicateError';
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

/**
 * ApiError → 도메인 에러 매핑.
 *
 * 백엔드 (apps/api/src/matching/saved-ideal-targets/saved-ideal-targets.service.ts)
 * 가 던지는 두 종류의 409 를 메시지 prefix 로 구분한다:
 *   - "매칭 대상은 최대 N개까지 등록 가능합니다" → LIMIT_EXCEEDED
 *   - "이미 같은 후보가 저장되어 있습니다"      → DUPLICATE
 *
 * 메시지 변경 시 이 함수도 같이 업데이트할 것 (백엔드 코드에 i18n 키 도입하면 견고).
 */
export function mapSavedMatchesError(err: unknown): never {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      throw new SavedMatchesUnauthorizedError(err.message || '로그인이 필요해요');
    }
    if (err.status === 409) {
      const msg = err.message || '';
      if (msg.includes('이미') || msg.includes('같은 후보')) {
        throw new SavedMatchesDuplicateError(msg);
      }
      // 나머지 409 는 limit 으로 본다 (현재 백엔드 기준)
      throw new SavedMatchesLimitExceededError(msg);
    }
    if (err.status === 0 || err.status >= 500) {
      throw new SavedMatchesNetworkError(err.message);
    }
    // 400/404 등은 그대로 노출 (호출부가 ApiError 로 처리)
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
