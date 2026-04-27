import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import type { IdealMatchProfileV2 } from '@/lib/saju/reverseMatch-v2';
import { ApiError } from '@/lib/api';
import {
  create as createSavedMatch,
  getMyList,
  remove as deleteSavedMatch,
  type SavedIdealTarget,
  type SavedIdealTargetMeta,
} from '@/lib/api/savedMatches';
import {
  SavedMatchesDuplicateError,
  SavedMatchesLimitExceededError,
  SavedMatchesNetworkError,
  SavedMatchesUnauthorizedError,
  SavedMatchesValidationError,
} from '@/lib/api/errors';
import { parseAgeRange } from '@/lib/parseAgeRange';

/**
 * 회원 등급별 매칭 대상 등록 가능 개수.
 * (백엔드 한도 enum 과 동일 — 정책 변경 시 양쪽 같이 수정)
 */
export const SAVED_MATCH_LIMITS = {
  free: 3,
  premium: 10,
} as const;

export function getSavedMatchLimit(isPremium: boolean): number {
  return isPremium ? SAVED_MATCH_LIMITS.premium : SAVED_MATCH_LIMITS.free;
}

export interface SavedMatch {
  /**
   * 비로그인: `${Date.now()}-${rank}` (현행 호환)
   * 로그인 옵티미스틱: `temp-${Date.now()}-${random}` → POST 응답 시 서버 UUID 로 swap
   * 로그인 정상: 서버 UUID
   */
  id: string;
  savedAt: number;
  status: 'searching' | 'matched' | 'archived';
  profile: IdealMatchProfileV2;
  /** 서버 동기화 대기 중 — UI 에서 spinner/dim 표시할 때 사용 */
  pending?: boolean;
}

export type SavedMatchesError =
  | SavedMatchesLimitExceededError
  | SavedMatchesDuplicateError
  | SavedMatchesValidationError
  | SavedMatchesUnauthorizedError
  | SavedMatchesNetworkError
  | ApiError;

export type AsyncResult =
  | { ok: true }
  | { ok: false; error: SavedMatchesError };

export interface MigrationResult {
  total: number;
  succeeded: number;
  duplicates: number;
  parseFailed: number;
  otherFailed: number;
  failedItems: Array<{ localId: string; reason: string }>;
}

interface SavedMatchesState {
  matches: SavedMatch[];
  meta: SavedIdealTargetMeta | null;
  syncStatus: 'idle' | 'hydrating' | 'syncing' | 'error';
  lastSyncedAt: number | null;
  lastError: { code: string; message: string } | null;

  /** 백엔드에서 saved 목록 + meta 를 받아 store 를 교체. 실패 시 기존 matches 유지(offline). */
  hydrate: (token: string) => Promise<void>;

  /**
   * 비로그인: 로컬에만 추가 (현행 동작).
   * 로그인: tempId 로 옵티미스틱 insert → POST → 성공 시 server id 로 swap, 실패 시 정확히 tempId 만 제거.
   */
  addOptimistic: (
    profile: IdealMatchProfileV2,
    token: string | null,
  ) => Promise<AsyncResult>;

  /**
   * 비로그인: 로컬에서만 제거.
   * 로그인: 옵티미스틱 제거 + 위치 기억 → DELETE → 실패 시 원래 index 에 splice 복구.
   */
  removeOptimistic: (
    id: string,
    token: string | null,
  ) => Promise<AsyncResult>;

  /**
   * localStorage 에 남아있는 비로그인 시절 매치를 백엔드로 이관.
   * - DUPLICATE: 카운트만 (서버에 이미 있음 → 폐기)
   * - LIMIT_EXCEEDED: 더 이상 진행 무의미 → 남은 항목 보존 후 break
   * - parse 실패: 살릴 수 없으니 폐기
   * - 기타 실패: 보존하여 다음 시도
   * 모두 처리되면 localStorage 키 삭제, 일부 보존 시 보존된 것만 다시 기록.
   * 토스트는 store 가 직접 호출 (UI 없는 백그라운드 흐름).
   */
  migrateLocalToBackend: (token: string) => Promise<MigrationResult>;

  clear: () => void;
}

const PERSIST_KEY = 'yeon-saved-matches';

/**
 * 비로그인용 로컬 SavedMatch 생성. id 형식은 PR 3.1 이전 동작과 동일하게 유지.
 */
function localOnlyMatch(profile: IdealMatchProfileV2): SavedMatch {
  return {
    id: `${Date.now()}-${profile.rank}`,
    savedAt: Date.now(),
    status: 'searching',
    profile,
  };
}

/**
 * 서버 SavedIdealTarget → 클라 SavedMatch.
 * profile JSONB 는 IdealMatchProfileV2 로 신뢰 cast (백엔드가 같은 타입으로 저장).
 */
export function serverToLocal(server: SavedIdealTarget): SavedMatch {
  return {
    id: server.id,
    savedAt: new Date(server.savedAt).getTime(),
    status: server.status,
    profile: server.profile as unknown as IdealMatchProfileV2,
    pending: false,
  };
}

function newTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function errCode(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e && typeof (e as { code?: unknown }).code === 'string') {
    return (e as { code: string }).code;
  }
  return 'UNKNOWN';
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export const useSavedMatchesStore = create<SavedMatchesState>()(
  persist(
    (set, get) => ({
      matches: [],
      meta: null,
      syncStatus: 'idle',
      lastSyncedAt: null,
      lastError: null,

      hydrate: async (token) => {
        set({ syncStatus: 'hydrating', lastError: null });
        try {
          const response = await getMyList(token);
          set({
            matches: response.items.map(serverToLocal),
            meta: response.meta,
            syncStatus: 'idle',
            lastSyncedAt: Date.now(),
            lastError: null,
          });
        } catch (e) {
          set({
            syncStatus: 'error',
            lastError: { code: errCode(e), message: errMessage(e) },
          });
        }
      },

      addOptimistic: async (profile, token) => {
        if (!token) {
          set({ matches: [localOnlyMatch(profile), ...get().matches] });
          return { ok: true };
        }

        const tempId = newTempId();
        const optimistic: SavedMatch = {
          id: tempId,
          savedAt: Date.now(),
          status: 'searching',
          profile,
          pending: true,
        };
        set({ matches: [optimistic, ...get().matches] });

        try {
          const range = parseAgeRange(profile.ageRange);
          if (!range) {
            throw new SavedMatchesValidationError('나이 정보가 올바르지 않습니다');
          }

          const serverMatch = await createSavedMatch(token, {
            dayStem: profile.pillars.day.stem,
            dayBranch: profile.pillars.day.branch,
            ageMin: range.ageMin,
            ageMax: range.ageMax,
            totalScore: profile.totalScore,
            profile: profile as unknown as Record<string, unknown>,
          });

          // tempId → server id 교체 (다른 항목 순서/내용 보존)
          set((s) => {
            const meta = s.meta;
            const nextCount = meta ? meta.count + 1 : null;
            return {
              matches: s.matches.map((m) =>
                m.id === tempId ? serverToLocal(serverMatch) : m,
              ),
              meta:
                meta && nextCount !== null
                  ? { ...meta, count: nextCount, canAddMore: nextCount < meta.limit }
                  : meta,
            };
          });
          return { ok: true };
        } catch (e) {
          // 정확히 tempId 항목만 제거 — 다른 옵티미스틱 entry 영향 X
          set((s) => ({ matches: s.matches.filter((m) => m.id !== tempId) }));
          return { ok: false, error: e as SavedMatchesError };
        }
      },

      removeOptimistic: async (id, token) => {
        if (!token) {
          set({ matches: get().matches.filter((m) => m.id !== id) });
          return { ok: true };
        }

        const before = get().matches;
        const index = before.findIndex((m) => m.id === id);
        if (index === -1) return { ok: true };

        const removed = before[index];
        set({ matches: before.filter((m) => m.id !== id) });

        try {
          await deleteSavedMatch(token, id);
          set((s) => ({
            meta: s.meta
              ? {
                  ...s.meta,
                  count: Math.max(0, s.meta.count - 1),
                  canAddMore: true,
                }
              : s.meta,
          }));
          return { ok: true };
        } catch (e) {
          // 원래 index 위치에 정확히 복구 (정렬 보존)
          set((s) => {
            const next = s.matches.slice();
            const insertAt = Math.min(index, next.length);
            next.splice(insertAt, 0, removed);
            return { matches: next };
          });
          return { ok: false, error: e as SavedMatchesError };
        }
      },

      migrateLocalToBackend: async (token) => {
        const result: MigrationResult = {
          total: 0,
          succeeded: 0,
          duplicates: 0,
          parseFailed: 0,
          otherFailed: 0,
          failedItems: [],
        };

        // 현재 store state 는 hydrate 로 덮였을 수 있으므로 localStorage 원본을 직접 읽음.
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PERSIST_KEY) : null;
        if (!raw) return result;

        let items: SavedMatch[] = [];
        let parsed: { state?: { matches?: SavedMatch[] } } = {};
        try {
          parsed = JSON.parse(raw);
          items = parsed.state?.matches ?? [];
        } catch {
          localStorage.removeItem(PERSIST_KEY);
          return result;
        }

        result.total = items.length;
        if (items.length === 0) {
          localStorage.removeItem(PERSIST_KEY);
          return result;
        }

        const remaining: SavedMatch[] = [];
        let limitHit = false;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];

          if (limitHit) {
            // LIMIT_EXCEEDED 이후 남은 항목 — 시도하지 않고 보존
            remaining.push(item);
            continue;
          }

          const range = parseAgeRange(item.profile?.ageRange);
          if (!range) {
            result.parseFailed++;
            console.warn('[migrate] parse failed', item.id, item.profile?.ageRange);
            continue;
          }

          try {
            await createSavedMatch(token, {
              dayStem: item.profile.pillars.day.stem,
              dayBranch: item.profile.pillars.day.branch,
              ageMin: range.ageMin,
              ageMax: range.ageMax,
              totalScore: item.profile.totalScore,
              profile: item.profile as unknown as Record<string, unknown>,
            });
            result.succeeded++;
          } catch (e) {
            if (e instanceof SavedMatchesDuplicateError) {
              result.duplicates++;
              // 서버에 이미 있음 — 로컬에서도 폐기
            } else if (e instanceof SavedMatchesLimitExceededError) {
              result.otherFailed++;
              result.failedItems.push({ localId: item.id, reason: 'LIMIT_EXCEEDED' });
              remaining.push(item);
              limitHit = true;
            } else {
              result.otherFailed++;
              result.failedItems.push({ localId: item.id, reason: errCode(e) });
              remaining.push(item);
            }
          }
        }

        if (remaining.length === 0) {
          localStorage.removeItem(PERSIST_KEY);
        } else {
          // 실패한 것만 남겨서 다음 시도 때 재시도 가능하게
          const next = { ...parsed, state: { ...(parsed.state ?? {}), matches: remaining } };
          localStorage.setItem(PERSIST_KEY, JSON.stringify(next));
        }

        if (result.succeeded > 0) {
          toast.success('이전에 저장한 인연을 가져왔어요');
        }
        if (result.otherFailed > 0) {
          console.warn('[migrate] some items failed', result.failedItems);
        }

        return result;
      },

      clear: () => {
        set({
          matches: [],
          meta: null,
          syncStatus: 'idle',
          lastSyncedAt: null,
          lastError: null,
        });
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(PERSIST_KEY);
        }
      },
    }),
    {
      name: PERSIST_KEY,
      // 휘발성 상태 (meta/sync) 는 persist 제외 — 새 세션에서 stale 로 살아나면 안 됨.
      partialize: (state) => ({ matches: state.matches }),
    },
  ),
);
