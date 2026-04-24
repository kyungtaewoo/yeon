import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FourPillars, SajuReport, CompatibilityWeights } from '@/lib/saju/types';
import type { IdealMatchProfileV2 } from '@/lib/saju/reverseMatch-v2';

interface OnboardingState {
  // Step 1: 사주 입력
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthHour: number | null;
  isLunar: boolean;
  gender: 'male' | 'female' | null;

  // Step 2: 사주 리포트
  pillars: FourPillars | null;
  report: SajuReport | null;

  // Step 3: 궁합 선호도
  weights: CompatibilityWeights;
  preferredAgeMin: number;
  preferredAgeMax: number;

  // Step 4: 이상적 상대
  idealProfiles: IdealMatchProfileV2[];

  // Actions
  setBirthInfo: (info: {
    year: number;
    month: number;
    day: number;
    hour: number | null;
    isLunar: boolean;
    gender: 'male' | 'female';
  }) => void;
  setReport: (pillars: FourPillars, report: SajuReport) => void;
  setWeights: (weights: CompatibilityWeights) => void;
  setAgeRange: (min: number, max: number) => void;
  setIdealProfiles: (profiles: IdealMatchProfileV2[]) => void;
  reset: () => void;
}

const defaultWeights: CompatibilityWeights = {
  romance: 50,
  marriage: 50,
  wealth: 50,
  children: 50,
  health: 50,
  personality: 50,
};

// Capacitor 정적 빌드에선 화면 전환을 window.location.href 로 하드 내비로 처리하는데,
// 이때 메모리 스토어가 초기화되므로 idealProfiles 등이 날아감.
// localStorage 에 persist 해서 풀 리로드 후에도 결과가 유지되도록 함.
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      birthYear: null,
      birthMonth: null,
      birthDay: null,
      birthHour: null,
      isLunar: false,
      gender: null,
      pillars: null,
      report: null,
      weights: defaultWeights,
      preferredAgeMin: 25,
      preferredAgeMax: 35,
      idealProfiles: [],

      setBirthInfo: (info) =>
        set({
          birthYear: info.year,
          birthMonth: info.month,
          birthDay: info.day,
          birthHour: info.hour,
          isLunar: info.isLunar,
          gender: info.gender,
        }),

      setReport: (pillars, report) => set({ pillars, report }),
      setWeights: (weights) => set({ weights }),
      setAgeRange: (min, max) => set({ preferredAgeMin: min, preferredAgeMax: max }),
      setIdealProfiles: (profiles) => set({ idealProfiles: profiles }),
      reset: () =>
        set({
          birthYear: null,
          birthMonth: null,
          birthDay: null,
          birthHour: null,
          isLunar: false,
          gender: null,
          pillars: null,
          report: null,
          weights: defaultWeights,
          preferredAgeMin: 25,
          preferredAgeMax: 35,
          idealProfiles: [],
        }),
    }),
    { name: 'yeon-onboarding' },
  ),
);
