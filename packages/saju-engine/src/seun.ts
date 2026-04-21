/**
 * 세운 (歲運) 모듈 — 해마다의 연주 간지 + 내 사주와의 상호작용
 */

import type {
  FourPillars, Pillar, HeavenlyStem, EarthlyBranch, TenGod,
} from './types';
import { calculatePillars } from './pillars';
import { getTenGod } from './tenGods';
import {
  STEM_COMBINATIONS, STEM_CLASHES,
  BRANCH_SIX_HARMONIES, BRANCH_CLASHES, BRANCH_THREE_HARMONIES,
} from './constants';

export interface SeunInteractions {
  dayStemCombine: boolean;    // 일간과 세간 합
  dayStemClash: boolean;      // 일간과 세간 충
  dayBranchCombine: boolean;  // 일지와 세지 육합
  dayBranchTrine: boolean;    // 일지와 세지 삼합
  dayBranchClash: boolean;    // 일지와 세지 충
}

export interface SeunAnalysis {
  year: number;
  pillar: Pillar;
  tenGodOfStem: TenGod;  // 일간 기준 세간의 십성
  interactions: SeunInteractions;
}

/** 특정 연도의 연주 간지 (입춘 이후 기준) */
export function calculateYearPillar(year: number): Pillar {
  // 2월 15일은 항상 입춘(2/3~5) 이후 — 그 해의 세운으로 확정
  const pillars = calculatePillars({ year, month: 2, day: 15 });
  return pillars.year;
}

function stemHap(a: HeavenlyStem, b: HeavenlyStem): boolean {
  return STEM_COMBINATIONS.some(
    ([s1, s2]) => (s1 === a && s2 === b) || (s1 === b && s2 === a),
  );
}
function stemChung(a: HeavenlyStem, b: HeavenlyStem): boolean {
  return STEM_CLASHES.some(
    ([s1, s2]) => (s1 === a && s2 === b) || (s1 === b && s2 === a),
  );
}
function branchYukhap(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_SIX_HARMONIES.some(
    ([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a),
  );
}
function branchChung(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_CLASHES.some(
    ([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a),
  );
}
function branchSamhap(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_THREE_HARMONIES.some(([b1, b2, b3]) => {
    const trine = [b1, b2, b3];
    return trine.includes(a) && trine.includes(b) && a !== b;
  });
}

/** 내 사주 일주 기준 세운 간지와의 상호작용 분석 */
export function analyzeSeun(saju: FourPillars, year: number): SeunAnalysis {
  const pillar = calculateYearPillar(year);
  const dayStem = saju.day.stem;
  const dayBranch = saju.day.branch;

  return {
    year,
    pillar,
    tenGodOfStem: getTenGod(dayStem, pillar.stem),
    interactions: {
      dayStemCombine: stemHap(dayStem, pillar.stem),
      dayStemClash: stemChung(dayStem, pillar.stem),
      dayBranchCombine: branchYukhap(dayBranch, pillar.branch),
      dayBranchTrine: branchSamhap(dayBranch, pillar.branch),
      dayBranchClash: branchChung(dayBranch, pillar.branch),
    },
  };
}

/** 여러 연도의 세운 배치 반환 */
export function analyzeSeunRange(
  saju: FourPillars,
  startYear: number,
  endYear: number,
): SeunAnalysis[] {
  const out: SeunAnalysis[] = [];
  for (let y = startYear; y <= endYear; y++) {
    out.push(analyzeSeun(saju, y));
  }
  return out;
}
