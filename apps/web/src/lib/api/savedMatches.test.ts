import { describe, it, expect } from 'vitest';
import { ApiError } from '.';
import {
  mapSavedMatchesError,
  SavedMatchesDuplicateError,
  SavedMatchesLimitExceededError,
  SavedMatchesNetworkError,
  SavedMatchesUnauthorizedError,
  SavedMatchesValidationError,
} from './savedMatches';

const callMap = (err: unknown): unknown => {
  try {
    mapSavedMatchesError(err);
  } catch (e) {
    return e;
  }
  return null;
};

describe('mapSavedMatchesError — ApiError code 분기', () => {
  it('401 → SavedMatchesUnauthorizedError (code 없어도)', () => {
    const result = callMap(new ApiError(401, 'Unauthorized'));
    expect(result).toBeInstanceOf(SavedMatchesUnauthorizedError);
  });

  it('409 LIMIT_EXCEEDED + details → LimitExceededError 에 details 보존', () => {
    const result = callMap(
      new ApiError(409, '저장 가능한 인연이 가득 찼어요', 'LIMIT_EXCEEDED', {
        current: 3,
        limit: 3,
        tier: 'free',
      }),
    );
    expect(result).toBeInstanceOf(SavedMatchesLimitExceededError);
    const e = result as SavedMatchesLimitExceededError;
    expect(e.details).toEqual({ current: 3, limit: 3, tier: 'free' });
  });

  it('409 LIMIT_EXCEEDED + details premium → tier 그대로 보존', () => {
    const result = callMap(
      new ApiError(409, 'full', 'LIMIT_EXCEEDED', {
        current: 10,
        limit: 10,
        tier: 'premium',
      }),
    );
    expect(result).toBeInstanceOf(SavedMatchesLimitExceededError);
    expect((result as SavedMatchesLimitExceededError).details.tier).toBe('premium');
  });

  it('409 LIMIT_EXCEEDED + details 누락 → free 가정 기본값', () => {
    const result = callMap(new ApiError(409, 'full', 'LIMIT_EXCEEDED'));
    expect(result).toBeInstanceOf(SavedMatchesLimitExceededError);
    expect((result as SavedMatchesLimitExceededError).details).toEqual({
      current: 0,
      limit: 3,
      tier: 'free',
    });
  });

  it('409 DUPLICATE → DuplicateError (details 없음)', () => {
    const result = callMap(new ApiError(409, '이미 담아둔 인연이에요', 'DUPLICATE'));
    expect(result).toBeInstanceOf(SavedMatchesDuplicateError);
  });

  it('400 INVALID_AGE_RANGE → ValidationError', () => {
    const result = callMap(new ApiError(400, 'ageMax < ageMin', 'INVALID_AGE_RANGE'));
    expect(result).toBeInstanceOf(SavedMatchesValidationError);
  });

  it('5xx → NetworkError', () => {
    const result = callMap(new ApiError(500, 'Internal Server Error'));
    expect(result).toBeInstanceOf(SavedMatchesNetworkError);
  });

  it('status=0 (timeout) → NetworkError', () => {
    const result = callMap(new ApiError(0, '응답 없음'));
    expect(result).toBeInstanceOf(SavedMatchesNetworkError);
  });

  it('404 USER_NOT_FOUND → ApiError 그대로 (도메인 에러로 안 감쌈)', () => {
    const orig = new ApiError(404, '사용자 없음', 'USER_NOT_FOUND');
    const result = callMap(orig);
    expect(result).toBe(orig);
  });

  it('알 수 없는 4xx code → ApiError 그대로', () => {
    const orig = new ApiError(403, 'Forbidden', 'FORBIDDEN');
    const result = callMap(orig);
    expect(result).toBe(orig);
  });

  it('일반 Error (fetch fail) → NetworkError', () => {
    const result = callMap(new TypeError('Failed to fetch'));
    expect(result).toBeInstanceOf(SavedMatchesNetworkError);
  });

  it('Error 가 아닌 throw (string 등) → NetworkError', () => {
    const result = callMap('something weird');
    expect(result).toBeInstanceOf(SavedMatchesNetworkError);
  });
});
