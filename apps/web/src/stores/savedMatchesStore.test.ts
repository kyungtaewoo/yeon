/**
 * savedMatchesStore — 옵티미스틱 / 마이그레이션 / 동기화 동작 검증.
 *
 * 환경: vitest (node) — jsdom 미사용. localStorage / toast 는 직접 stub.
 * 결정:
 *  - 각 it 블록 사이에 store 상태 + localStorage + 모든 mock 을 reset (전역 싱글톤이라 leak 방지)
 *  - 도메인 에러 throw 는 실제 errors.ts 모듈 사용 (mock 안 함) — 호출부의 instanceof 분기를 그대로 검증
 *  - API 함수 (getMyList/create/remove) 만 mock
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import * as savedMatchesApi from '@/lib/api/savedMatches';
import {
  SavedMatchesDuplicateError,
  SavedMatchesLimitExceededError,
  SavedMatchesNetworkError,
} from '@/lib/api/errors';
import { ApiError } from '@/lib/api';
import type { IdealMatchProfileV2 } from '@/lib/saju/reverseMatch-v2';
import {
  serverToLocal,
  useSavedMatchesStore,
  type SavedMatch,
} from './savedMatchesStore';
import type {
  SavedIdealTarget,
  SavedIdealTargetListResponse,
} from '@/lib/api/savedMatches';

// ─── mocks ────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/api/savedMatches', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/savedMatches')>(
    '@/lib/api/savedMatches',
  );
  return {
    ...actual,
    getMyList: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  };
});

const mockedApi = savedMatchesApi as unknown as {
  getMyList: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

// localStorage 는 vitest.setup.ts 에서 글로벌 stub 설치됨 — 테스트는 그대로 사용.

// ─── fixtures ─────────────────────────────────────────────────────────────

const fakeProfile = (overrides: Partial<IdealMatchProfileV2> = {}): IdealMatchProfileV2 =>
  ({
    rank: 1,
    pillars: {
      year: { stem: '갑', branch: '자' },
      month: { stem: '을', branch: '축' },
      day: { stem: '병', branch: '인' },
      hour: { stem: '정', branch: '묘' },
    },
    pillarLabels: { year: '', month: '', day: '', hour: '' },
    totalScore: 80,
    breakdown: {
      romance: 80,
      marriage: 80,
      wealth: 80,
      children: 80,
      health: 80,
      personality: 80,
    },
    matchingDates: [],
    ageRange: '만 25~35세',
    description: {
      dominantElement: 'fire',
      personality: '',
      yongshin: '',
      gyeokguk: '',
    },
    narrative: { summary: '', synergies: [], cautions: [] },
    ...overrides,
  }) as IdealMatchProfileV2;

const fakeServerTarget = (overrides: Partial<SavedIdealTarget> = {}): SavedIdealTarget => ({
  id: 'srv-uuid-1',
  userId: 'user-1',
  dayStem: '병',
  dayBranch: '인',
  ageMin: 25,
  ageMax: 35,
  totalScore: 80,
  profile: fakeProfile() as unknown as Record<string, unknown>,
  status: 'searching',
  savedAt: '2026-04-26T00:00:00.000Z',
  updatedAt: '2026-04-26T00:00:00.000Z',
  ...overrides,
});

// ─── lifecycle ────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  // store 싱글톤 reset
  useSavedMatchesStore.setState({
    matches: [],
    meta: null,
    syncStatus: 'idle',
    lastSyncedAt: null,
    lastError: null,
  });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── tests ────────────────────────────────────────────────────────────────

describe('hydrate(token)', () => {
  it('성공: matches/meta 갱신 + syncStatus idle + lastSyncedAt 세팅', async () => {
    const response: SavedIdealTargetListResponse = {
      items: [fakeServerTarget({ id: 'srv-1' }), fakeServerTarget({ id: 'srv-2' })],
      meta: { count: 2, limit: 3, tier: 'free', canAddMore: true },
    };
    mockedApi.getMyList.mockResolvedValue(response);

    const before = Date.now();
    await useSavedMatchesStore.getState().hydrate('token');
    const after = Date.now();

    const s = useSavedMatchesStore.getState();
    expect(s.matches.map((m) => m.id)).toEqual(['srv-1', 'srv-2']);
    expect(s.meta).toEqual(response.meta);
    expect(s.syncStatus).toBe('idle');
    expect(s.lastSyncedAt).toBeGreaterThanOrEqual(before);
    expect(s.lastSyncedAt).toBeLessThanOrEqual(after);
    expect(s.lastError).toBeNull();
  });

  it('실패: 기존 matches 보존 + lastError 설정 + syncStatus error', async () => {
    // 사전 상태 — persist 폴백 시뮬레이션
    const persisted: SavedMatch = {
      id: 'local-1',
      savedAt: 1000,
      status: 'searching',
      profile: fakeProfile(),
    };
    useSavedMatchesStore.setState({ matches: [persisted] });

    mockedApi.getMyList.mockRejectedValue(new SavedMatchesNetworkError('offline'));

    await useSavedMatchesStore.getState().hydrate('token');

    const s = useSavedMatchesStore.getState();
    expect(s.matches).toEqual([persisted]); // 폴백 보존
    expect(s.syncStatus).toBe('error');
    expect(s.lastError).toEqual({ code: 'NETWORK', message: 'offline' });
    expect(s.lastSyncedAt).toBeNull();
  });
});

describe('addOptimistic(profile, token)', () => {
  it('비로그인: localStorage 만 갱신, API 호출 없음', async () => {
    const profile = fakeProfile({ rank: 7 });

    const result = await useSavedMatchesStore.getState().addOptimistic(profile, null);

    expect(result).toEqual({ ok: true });
    expect(mockedApi.create).not.toHaveBeenCalled();

    const s = useSavedMatchesStore.getState();
    expect(s.matches).toHaveLength(1);
    expect(s.matches[0].id).toMatch(/^\d+-7$/); // localOnlyMatch 형식
    expect(s.matches[0].pending).toBeUndefined();
  });

  it('로그인 성공: tempId 잠시 → server id 로 swap, meta count 증가', async () => {
    useSavedMatchesStore.setState({
      meta: { count: 1, limit: 3, tier: 'free', canAddMore: true },
    });
    const server = fakeServerTarget({ id: 'srv-99' });
    mockedApi.create.mockResolvedValue(server);

    const profile = fakeProfile();
    const result = await useSavedMatchesStore.getState().addOptimistic(profile, 'token');

    expect(result).toEqual({ ok: true });
    const s = useSavedMatchesStore.getState();
    expect(s.matches).toHaveLength(1);
    expect(s.matches[0].id).toBe('srv-99');
    expect(s.matches[0].pending).toBe(false);
    expect(s.meta).toEqual({ count: 2, limit: 3, tier: 'free', canAddMore: true });
    expect(mockedApi.create).toHaveBeenCalledWith('token', {
      dayStem: '병',
      dayBranch: '인',
      ageMin: 25,
      ageMax: 35,
      totalScore: 80,
      profile,
    });
  });

  it('로그인 LIMIT_EXCEEDED: tempId 정확히 제거, 다른 옵티미스틱 entry 보존', async () => {
    // 동시에 다른 진행 중 항목이 있다고 가정
    useSavedMatchesStore.setState({
      matches: [
        {
          id: 'temp-other-xyz',
          savedAt: 1,
          status: 'searching',
          profile: fakeProfile({ rank: 2 }),
          pending: true,
        },
      ],
      meta: { count: 3, limit: 3, tier: 'free', canAddMore: false },
    });
    mockedApi.create.mockRejectedValue(
      new SavedMatchesLimitExceededError('full', { current: 3, limit: 3, tier: 'free' }),
    );

    const result = await useSavedMatchesStore.getState().addOptimistic(fakeProfile(), 'token');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(SavedMatchesLimitExceededError);
    }
    const s = useSavedMatchesStore.getState();
    expect(s.matches.map((m) => m.id)).toEqual(['temp-other-xyz']);
    // meta 는 변경 없음
    expect(s.meta?.count).toBe(3);
  });

  it('로그인 DUPLICATE: tempId 제거 + DuplicateError 반환', async () => {
    mockedApi.create.mockRejectedValue(new SavedMatchesDuplicateError('이미 담아둔 인연'));

    const result = await useSavedMatchesStore.getState().addOptimistic(fakeProfile(), 'token');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(SavedMatchesDuplicateError);
    }
    expect(useSavedMatchesStore.getState().matches).toHaveLength(0);
  });
});

describe('removeOptimistic(id, token)', () => {
  it('비로그인: 로컬에서만 제거', async () => {
    useSavedMatchesStore.setState({
      matches: [
        { id: 'a', savedAt: 1, status: 'searching', profile: fakeProfile() },
        { id: 'b', savedAt: 2, status: 'searching', profile: fakeProfile() },
      ],
    });

    const result = await useSavedMatchesStore.getState().removeOptimistic('a', null);

    expect(result).toEqual({ ok: true });
    expect(mockedApi.remove).not.toHaveBeenCalled();
    expect(useSavedMatchesStore.getState().matches.map((m) => m.id)).toEqual(['b']);
  });

  it('로그인 성공: 즉시 제거 + meta count 감소 + canAddMore=true', async () => {
    useSavedMatchesStore.setState({
      matches: [
        { id: 'srv-1', savedAt: 1, status: 'searching', profile: fakeProfile() },
        { id: 'srv-2', savedAt: 2, status: 'searching', profile: fakeProfile() },
      ],
      meta: { count: 2, limit: 3, tier: 'free', canAddMore: true },
    });
    mockedApi.remove.mockResolvedValue(undefined);

    const result = await useSavedMatchesStore.getState().removeOptimistic('srv-1', 'token');

    expect(result).toEqual({ ok: true });
    const s = useSavedMatchesStore.getState();
    expect(s.matches.map((m) => m.id)).toEqual(['srv-2']);
    expect(s.meta).toEqual({ count: 1, limit: 3, tier: 'free', canAddMore: true });
    expect(mockedApi.remove).toHaveBeenCalledWith('token', 'srv-1');
  });

  it('로그인 실패: 원래 index 위치에 정확히 splice 복구 (정렬 보존)', async () => {
    const items: SavedMatch[] = [
      { id: 'a', savedAt: 1, status: 'searching', profile: fakeProfile() },
      { id: 'b', savedAt: 2, status: 'searching', profile: fakeProfile() }, // index 1
      { id: 'c', savedAt: 3, status: 'searching', profile: fakeProfile() },
    ];
    useSavedMatchesStore.setState({ matches: items });
    mockedApi.remove.mockRejectedValue(new SavedMatchesNetworkError('offline'));

    const result = await useSavedMatchesStore.getState().removeOptimistic('b', 'token');

    expect(result.ok).toBe(false);
    expect(useSavedMatchesStore.getState().matches.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('로그인: 존재하지 않는 id → ok 즉시 (no-op, API 호출 없음)', async () => {
    useSavedMatchesStore.setState({
      matches: [{ id: 'a', savedAt: 1, status: 'searching', profile: fakeProfile() }],
    });

    const result = await useSavedMatchesStore.getState().removeOptimistic('nope', 'token');

    expect(result).toEqual({ ok: true });
    expect(mockedApi.remove).not.toHaveBeenCalled();
  });
});

describe('migrateLocalToBackend(token)', () => {
  function seedLocalStorage(items: SavedMatch[]) {
    localStorage.setItem(
      'yeon-saved-matches',
      JSON.stringify({ state: { matches: items }, version: 0 }),
    );
  }

  it('전부 성공: localStorage 키 삭제 + success 토스트', async () => {
    seedLocalStorage([
      { id: 'l1', savedAt: 1, status: 'searching', profile: fakeProfile({ rank: 1 }) },
      { id: 'l2', savedAt: 2, status: 'searching', profile: fakeProfile({ rank: 2 }) },
    ]);
    mockedApi.create
      .mockResolvedValueOnce(fakeServerTarget({ id: 's1' }))
      .mockResolvedValueOnce(fakeServerTarget({ id: 's2' }));

    const result = await useSavedMatchesStore.getState().migrateLocalToBackend('token');

    expect(result).toEqual({
      total: 2,
      succeeded: 2,
      duplicates: 0,
      parseFailed: 0,
      otherFailed: 0,
      failedItems: [],
    });
    expect(localStorage.getItem('yeon-saved-matches')).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('이전에 저장한 인연을 가져왔어요');
  });

  it('일부 DUPLICATE: 카운트 + 모두 처리되었으니 LS 삭제', async () => {
    seedLocalStorage([
      { id: 'l1', savedAt: 1, status: 'searching', profile: fakeProfile() },
      { id: 'l2', savedAt: 2, status: 'searching', profile: fakeProfile() },
    ]);
    mockedApi.create
      .mockResolvedValueOnce(fakeServerTarget({ id: 's1' }))
      .mockRejectedValueOnce(new SavedMatchesDuplicateError('dup'));

    const result = await useSavedMatchesStore.getState().migrateLocalToBackend('token');

    expect(result.succeeded).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.otherFailed).toBe(0);
    expect(localStorage.getItem('yeon-saved-matches')).toBeNull();
    expect(toast.success).toHaveBeenCalled();
  });

  it('parse 실패: parseFailed 카운트 + 폐기, 나머지 진행', async () => {
    seedLocalStorage([
      {
        id: 'l-bad',
        savedAt: 1,
        status: 'searching',
        profile: fakeProfile({ ageRange: 'garbage' }),
      },
      { id: 'l-ok', savedAt: 2, status: 'searching', profile: fakeProfile() },
    ]);
    mockedApi.create.mockResolvedValueOnce(fakeServerTarget({ id: 's-ok' }));

    const result = await useSavedMatchesStore.getState().migrateLocalToBackend('token');

    expect(result.parseFailed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(mockedApi.create).toHaveBeenCalledTimes(1); // bad 항목은 시도조차 안 함
    expect(localStorage.getItem('yeon-saved-matches')).toBeNull();
  });

  it('LIMIT_EXCEEDED: 즉시 break + 남은 항목 보존, success 토스트 없음', async () => {
    seedLocalStorage([
      { id: 'l1', savedAt: 1, status: 'searching', profile: fakeProfile({ rank: 1 }) },
      { id: 'l2', savedAt: 2, status: 'searching', profile: fakeProfile({ rank: 2 }) },
      { id: 'l3', savedAt: 3, status: 'searching', profile: fakeProfile({ rank: 3 }) },
    ]);
    mockedApi.create.mockRejectedValueOnce(
      new SavedMatchesLimitExceededError('full', { current: 3, limit: 3, tier: 'free' }),
    );

    const result = await useSavedMatchesStore.getState().migrateLocalToBackend('token');

    expect(result.succeeded).toBe(0);
    expect(result.otherFailed).toBe(1);
    expect(result.failedItems).toEqual([{ localId: 'l1', reason: 'LIMIT_EXCEEDED' }]);
    expect(mockedApi.create).toHaveBeenCalledTimes(1); // l2, l3 시도 안 함

    // localStorage 에는 모든 미처리 항목 (l1 포함) 보존
    const raw = localStorage.getItem('yeon-saved-matches');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.matches.map((m: SavedMatch) => m.id)).toEqual(['l1', 'l2', 'l3']);

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('빈 localStorage: total=0, no-op, 토스트 없음', async () => {
    const result = await useSavedMatchesStore.getState().migrateLocalToBackend('token');

    expect(result.total).toBe(0);
    expect(mockedApi.create).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('clear()', () => {
  it('모든 상태 reset + localStorage 키 삭제', () => {
    useSavedMatchesStore.setState({
      matches: [{ id: 'x', savedAt: 1, status: 'searching', profile: fakeProfile() }],
      meta: { count: 1, limit: 3, tier: 'free', canAddMore: true },
      lastSyncedAt: 999,
      lastError: { code: 'X', message: 'y' },
    });
    localStorage.setItem('yeon-saved-matches', '{"state":{"matches":[]}}');
    const removeSpy = vi.spyOn(localStorage, 'removeItem');

    useSavedMatchesStore.getState().clear();

    const s = useSavedMatchesStore.getState();
    expect(s.matches).toEqual([]);
    expect(s.meta).toBeNull();
    expect(s.lastSyncedAt).toBeNull();
    expect(s.lastError).toBeNull();
    expect(s.syncStatus).toBe('idle');
    expect(removeSpy).toHaveBeenCalledWith('yeon-saved-matches');
    expect(localStorage.getItem('yeon-saved-matches')).toBeNull();
  });
});

describe('serverToLocal mapper', () => {
  it('SavedIdealTarget → SavedMatch (ISO → ms, pending=false)', () => {
    const target = fakeServerTarget({
      id: 'srv-1',
      savedAt: '2026-04-26T12:00:00.000Z',
    });
    const local = serverToLocal(target);
    expect(local.id).toBe('srv-1');
    expect(local.savedAt).toBe(new Date('2026-04-26T12:00:00.000Z').getTime());
    expect(local.pending).toBe(false);
    expect(local.status).toBe('searching');
  });
});
