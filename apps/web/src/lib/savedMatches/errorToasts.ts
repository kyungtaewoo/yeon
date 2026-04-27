import type { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  SavedMatchesDuplicateError,
  SavedMatchesLimitExceededError,
  SavedMatchesNetworkError,
  SavedMatchesUnauthorizedError,
  SavedMatchesValidationError,
} from '@/lib/api/errors';
import type { SavedMatchesError } from '@/stores/savedMatchesStore';

/**
 * SavedMatch 도메인 에러 → 토스트 매핑.
 *
 * 호출부:
 *  - ideal-match handleSelect → handleAddError
 *  - matches handleRemove → handleRemoveError
 *
 * 워딩 변경 시 이 파일 한 곳만 수정.
 */

type Router = ReturnType<typeof useRouter>;

export function handleAddError(error: SavedMatchesError, router: Router): void {
  if (error instanceof SavedMatchesLimitExceededError) {
    const isFree = error.details.tier === 'free';
    toast.error('저장 가능한 인연이 가득 찼어요', {
      description: isFree
        ? `현재 ${error.details.current}/${error.details.limit} · 프리미엄 시 최대 10개까지 저장 가능해요.`
        : `현재 ${error.details.current}/${error.details.limit} · 기존 인연을 삭제한 뒤 다시 시도해주세요.`,
      action: isFree
        ? { label: '프리미엄 알아보기', onClick: () => router.push('/premium') }
        : { label: '매칭 탭', onClick: () => router.push('/matches') },
    });
    return;
  }

  if (error instanceof SavedMatchesDuplicateError) {
    toast.info('이미 담아둔 인연이에요');
    return;
  }

  if (error instanceof SavedMatchesUnauthorizedError) {
    toast.error('다시 로그인이 필요해요', {
      action: { label: '로그인', onClick: () => router.push('/login') },
    });
    return;
  }

  if (error instanceof SavedMatchesValidationError) {
    toast.error('나이 정보가 올바르지 않아요');
    return;
  }

  if (error instanceof SavedMatchesNetworkError) {
    toast.error('잠시 후 다시 시도해주세요');
    return;
  }

  // 기타 매핑 안 된 ApiError (USER_NOT_FOUND, TARGET_NOT_FOUND 등) — 사용자에겐 일반 메시지, 콘솔에 상세.
  toast.error('잠시 후 다시 시도해주세요');
  console.error('[savedMatch] unknown error', error);
}

export function handleRemoveError(error: SavedMatchesError): void {
  if (error instanceof SavedMatchesNetworkError) {
    toast.error('잠시 후 다시 시도해주세요');
    return;
  }
  toast.error('삭제에 실패했어요', { description: '잠시 후 다시 시도해주세요.' });
}
