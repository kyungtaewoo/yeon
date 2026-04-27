/**
 * handleAddError / handleRemoveError 분기 검증.
 * sonner toast + next/navigation router 둘 다 mock.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import {
  SavedMatchesDuplicateError,
  SavedMatchesLimitExceededError,
  SavedMatchesNetworkError,
  SavedMatchesUnauthorizedError,
  SavedMatchesValidationError,
} from '@/lib/api/errors';
import { handleAddError, handleRemoveError } from './errorToasts';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

type Router = Parameters<typeof handleAddError>[1];
const mockRouter = { push: vi.fn() } as unknown as Router;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleAddError', () => {
  it('LIMIT_EXCEEDED + free → "프리미엄 알아보기" action + /premium navigate', () => {
    handleAddError(
      new SavedMatchesLimitExceededError('full', { current: 3, limit: 3, tier: 'free' }),
      mockRouter,
    );
    expect(toast.error).toHaveBeenCalledWith(
      '저장 가능한 인연이 가득 찼어요',
      expect.objectContaining({
        action: expect.objectContaining({ label: '프리미엄 알아보기' }),
      }),
    );
    // action onClick 호출 시 navigate 검증
    const call = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][1];
    call.action.onClick();
    expect(mockRouter.push).toHaveBeenCalledWith('/premium');
  });

  it('LIMIT_EXCEEDED + premium → "매칭 탭" action + /matches navigate', () => {
    handleAddError(
      new SavedMatchesLimitExceededError('full', { current: 10, limit: 10, tier: 'premium' }),
      mockRouter,
    );
    const call = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call.action.label).toBe('매칭 탭');
    call.action.onClick();
    expect(mockRouter.push).toHaveBeenCalledWith('/matches');
  });

  it('DUPLICATE → toast.info', () => {
    handleAddError(new SavedMatchesDuplicateError('dup'), mockRouter);
    expect(toast.info).toHaveBeenCalledWith('이미 담아둔 인연이에요');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('UNAUTHORIZED → "로그인" action + /login navigate', () => {
    handleAddError(new SavedMatchesUnauthorizedError('unauth'), mockRouter);
    const call = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call.action.label).toBe('로그인');
    call.action.onClick();
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });

  it('VALIDATION → "나이 정보가 올바르지 않아요"', () => {
    handleAddError(new SavedMatchesValidationError('bad'), mockRouter);
    expect(toast.error).toHaveBeenCalledWith('나이 정보가 올바르지 않아요');
  });

  it('NETWORK → "잠시 후 다시 시도해주세요"', () => {
    handleAddError(new SavedMatchesNetworkError('net'), mockRouter);
    expect(toast.error).toHaveBeenCalledWith('잠시 후 다시 시도해주세요');
  });

  it('매핑 안 된 ApiError → 일반 메시지 + console.error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    handleAddError(new ApiError(404, 'not found', 'USER_NOT_FOUND'), mockRouter);
    expect(toast.error).toHaveBeenCalledWith('잠시 후 다시 시도해주세요');
    expect(consoleSpy).toHaveBeenCalledWith('[savedMatch] unknown error', expect.any(ApiError));
    consoleSpy.mockRestore();
  });
});

describe('handleRemoveError', () => {
  it('NETWORK → "잠시 후 다시 시도해주세요"', () => {
    handleRemoveError(new SavedMatchesNetworkError('net'));
    expect(toast.error).toHaveBeenCalledWith('잠시 후 다시 시도해주세요');
  });

  it('기타 → "삭제에 실패했어요" + description', () => {
    handleRemoveError(new ApiError(500, 'oops'));
    expect(toast.error).toHaveBeenCalledWith(
      '삭제에 실패했어요',
      expect.objectContaining({ description: '잠시 후 다시 시도해주세요.' }),
    );
  });
});
