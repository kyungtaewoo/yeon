import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IdealMatchProfileV2 } from '@/lib/saju/reverseMatch-v2';

/**
 * 사용자가 ideal-match 화면에서 "이 사주로 매칭" 누른 사주 후보들.
 * MVP 단계엔 실제 유저 간 매칭이 없어서 wish-list 형태로 로컬 저장.
 * 추후 실제 매칭 도입 시 백엔드 saved_ideal_targets 테이블로 마이그레이션 예정.
 */
export interface SavedMatch {
  /** 클라이언트 생성 ID — UUID 대신 timestamp + rank 조합 */
  id: string;
  /** 저장된 시각 (ms epoch) */
  savedAt: number;
  /** 저장 시점의 status — MVP 엔 'searching' 만 사용 */
  status: 'searching';
  /** ideal-match 에서 선택한 후보 프로파일 전체 */
  profile: IdealMatchProfileV2;
}

interface SavedMatchesState {
  matches: SavedMatch[];
  add: (profile: IdealMatchProfileV2) => SavedMatch;
  remove: (id: string) => void;
  clear: () => void;
}

export const useSavedMatchesStore = create<SavedMatchesState>()(
  persist(
    (set, get) => ({
      matches: [],
      add: (profile) => {
        const entry: SavedMatch = {
          id: `${Date.now()}-${profile.rank}`,
          savedAt: Date.now(),
          status: 'searching',
          profile,
        };
        set({ matches: [entry, ...get().matches] });
        return entry;
      },
      remove: (id) => set({ matches: get().matches.filter((m) => m.id !== id) }),
      clear: () => set({ matches: [] }),
    }),
    { name: 'yeon-saved-matches' },
  ),
);
