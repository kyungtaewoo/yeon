/**
 * 연인 궁합 (戀人宮合) 엔진 — 프리미엄
 *
 * 연애/결혼 호환성 분석
 * - 일간 합 (30%)
 * - 일지 배우자궁 합충 (25%)
 * - 관성/재성 배치 (20%)
 * - 연주+월주 종합 합 (15%)
 * - 도화살 상호 관계 (10%)
 */

import type { FourPillars, HeavenlyStem, EarthlyBranch } from './types';
import {
  STEM_COMBINATIONS, STEM_CLASHES,
  BRANCH_SIX_HARMONIES, BRANCH_THREE_HARMONIES, BRANCH_DIRECTIONAL_HARMONIES,
  BRANCH_CLASHES, BRANCH_PUNISHMENTS, BRANCH_HARMS,
  PEACH_BLOSSOM, STEM_TO_ELEMENT, ELEMENT_GENERATES, ELEMENT_OVERCOMES,
} from './constants';
import { getTenGod } from './tenGods';
import {
  getScoreBand5, getScoreBand3,
  ROMANTIC_SUMMARY, ROMANTIC_BREAKDOWN, ROMANTIC_OUTRO,
  type RomanticKey, type BreakdownExplanation,
} from './narratives';

// ============================================================
// 결과 타입
// ============================================================

export interface RomanticCompatibilityResult {
  totalScore: number;
  marriageScore: number;
  styleScore: number;
  breakdown: {
    dayGan: number;       // 일간 합
    dayJi: number;        // 일지 배우자궁
    officialStar: number; // 관성/재성
    yearMonth: number;    // 연주+월주
    peachBlossom: number; // 도화살
  };
  /** 점수 구간(5단계) 기반 전체 서사 — 4-5문장 */
  summary: string;
  /** 점수 구간(5단계) 기반 마무리 조언 — 1-2문장 */
  outro: string;
  /** 항목별 점수 구간(3단계) 기반 해설 */
  explanations: Record<RomanticKey, BreakdownExplanation>;
  factors: string[];
  /** @deprecated summary 사용. 하위 호환 별칭. */
  narrative: string;
  preview: { dayGanMatch: number }; // 무료 유저용 미리보기 (5점 만점)
}

// ============================================================
// 유틸리티
// ============================================================

function stemHap(a: HeavenlyStem, b: HeavenlyStem): boolean {
  return STEM_COMBINATIONS.some(([s1, s2]) => (s1 === a && s2 === b) || (s1 === b && s2 === a));
}
function stemChung(a: HeavenlyStem, b: HeavenlyStem): boolean {
  return STEM_CLASHES.some(([s1, s2]) => (s1 === a && s2 === b) || (s1 === b && s2 === a));
}
function branchYukhap(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_SIX_HARMONIES.some(([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a));
}
function branchSamhap(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_THREE_HARMONIES.some(([b1, b2, b3]) => {
    const set = [b1, b2, b3]; return set.includes(a) && set.includes(b);
  });
}
function branchBanghap(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_DIRECTIONAL_HARMONIES.some(([b1, b2, b3]) => {
    const set = [b1, b2, b3]; return set.includes(a) && set.includes(b);
  });
}
function branchChung(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_CLASHES.some(([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a));
}
function branchHyung(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_PUNISHMENTS.some(([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a));
}
function branchHae(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_HARMS.some(([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a));
}

function clamp(v: number, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }

// ============================================================
// 메인 함수
// ============================================================

export function calculateRomanticCompatibility(
  sajuA: FourPillars,
  sajuB: FourPillars,
): RomanticCompatibilityResult {
  const factors: string[] = [];

  // ── 1. 일간 합 (30%) ──
  let dayGanScore = 50;
  if (stemHap(sajuA.day.stem, sajuB.day.stem)) {
    dayGanScore += 30;
    factors.push(`일간 합(${sajuA.day.stem}${sajuB.day.stem}合) — 만나면 자연스럽게 끌리는 사이`);
  }
  if (stemChung(sajuA.day.stem, sajuB.day.stem)) {
    dayGanScore -= 20;
    factors.push('일간 충 — 근본적 성향 차이');
  }
  const aDayEl = STEM_TO_ELEMENT[sajuA.day.stem];
  const bDayEl = STEM_TO_ELEMENT[sajuB.day.stem];
  if (ELEMENT_GENERATES[aDayEl] === bDayEl || ELEMENT_GENERATES[bDayEl] === aDayEl) {
    dayGanScore += 12;
    factors.push('일간 상생 — 자연스러운 배려');
  }
  if (ELEMENT_OVERCOMES[aDayEl] === bDayEl || ELEMENT_OVERCOMES[bDayEl] === aDayEl) {
    dayGanScore -= 8;
  }
  dayGanScore = clamp(dayGanScore);

  // 미리보기 (5점 만점)
  const dayGanMatch = Math.round(dayGanScore / 20);

  // ── 2. 일지 배우자궁 합충 (25%) ──
  let dayJiScore = 50;
  if (branchYukhap(sajuA.day.branch, sajuB.day.branch)) {
    dayJiScore += 25;
    factors.push('일지 육합 — 배우자궁끼리 합, 가정 안정');
  } else if (branchSamhap(sajuA.day.branch, sajuB.day.branch)) {
    dayJiScore += 15;
    factors.push('일지 삼합 — 배우자궁 조화');
  } else if (branchBanghap(sajuA.day.branch, sajuB.day.branch)) {
    dayJiScore += 10;
  }
  if (branchChung(sajuA.day.branch, sajuB.day.branch)) {
    dayJiScore -= 20;
    factors.push('일지 충 — 배우자궁 충돌, 가정 불안 가능');
  }
  if (branchHyung(sajuA.day.branch, sajuB.day.branch)) {
    dayJiScore -= 10;
    factors.push('일지 형 — 관계 시련');
  }
  if (branchHae(sajuA.day.branch, sajuB.day.branch)) {
    dayJiScore -= 5;
  }
  dayJiScore = clamp(dayJiScore);

  // ── 3. 관성/재성 배치 (20%) ──
  let officialStarScore = 50;
  const tenGodAtoB = getTenGod(sajuA.day.stem, sajuB.day.stem);
  const tenGodBtoA = getTenGod(sajuB.day.stem, sajuA.day.stem);

  for (const tg of [tenGodAtoB, tenGodBtoA]) {
    if (tg === '정관') { officialStarScore += 20; factors.push(`상대가 나의 정관 — 이상적 배우자 지표`); }
    else if (tg === '정재') { officialStarScore += 20; factors.push(`상대가 나의 정재 — 이상적 배우자 지표`); }
    else if (tg === '편관') { officialStarScore += 10; }
    else if (tg === '편재') { officialStarScore += 10; }
  }
  officialStarScore = clamp(officialStarScore);

  // ── 4. 연주+월주 합 (15%) ──
  let yearMonthScore = 50;
  if (stemHap(sajuA.year.stem, sajuB.year.stem)) { yearMonthScore += 5; }
  if (branchYukhap(sajuA.year.branch, sajuB.year.branch)) { yearMonthScore += 5; factors.push('연지 합 — 가문/환경 조화'); }
  if (stemHap(sajuA.month.stem, sajuB.month.stem)) { yearMonthScore += 5; }
  if (branchYukhap(sajuA.month.branch, sajuB.month.branch)) { yearMonthScore += 5; factors.push('월지 합 — 생활 패턴 조화'); }
  if (branchChung(sajuA.year.branch, sajuB.year.branch)) { yearMonthScore -= 5; }
  if (branchChung(sajuA.month.branch, sajuB.month.branch)) { yearMonthScore -= 5; }
  yearMonthScore = clamp(yearMonthScore);

  // ── 5. 도화살 (10%) ──
  let peachScore = 50;
  const aPeach = PEACH_BLOSSOM[sajuA.day.branch];
  const bPeach = PEACH_BLOSSOM[sajuB.day.branch];
  const bBranches = [sajuB.year.branch, sajuB.month.branch, sajuB.day.branch, ...(sajuB.hour ? [sajuB.hour.branch] : [])];
  const aBranches = [sajuA.year.branch, sajuA.month.branch, sajuA.day.branch, ...(sajuA.hour ? [sajuA.hour.branch] : [])];

  if (bBranches.includes(aPeach)) {
    peachScore += 10;
    factors.push('상대 사주에 나의 도화살 — 본능적 끌림');
  }
  if (aBranches.includes(bPeach)) {
    peachScore += 10;
  }
  peachScore = clamp(peachScore);

  // ── 가중 합산 ──
  const totalScore = Math.round(
    dayGanScore * 0.30 +
    dayJiScore * 0.25 +
    officialStarScore * 0.20 +
    yearMonthScore * 0.15 +
    peachScore * 0.10
  );

  // 결혼 적합도 (배우자궁 + 관성 위주)
  const marriageScore = Math.round(dayJiScore * 0.4 + officialStarScore * 0.35 + yearMonthScore * 0.25);

  // 연애 스타일 호환도 (끌림 + 도화 위주)
  const styleScore = Math.round(dayGanScore * 0.4 + peachScore * 0.3 + dayJiScore * 0.3);

  // 서사 (템플릿 기반)
  const totalBand = getScoreBand5(totalScore);
  const summary = ROMANTIC_SUMMARY[totalBand];
  const outro = ROMANTIC_OUTRO[totalBand];
  const explanations: Record<RomanticKey, BreakdownExplanation> = {
    dayGan: ROMANTIC_BREAKDOWN.dayGan[getScoreBand3(dayGanScore)],
    dayJi: ROMANTIC_BREAKDOWN.dayJi[getScoreBand3(dayJiScore)],
    officialStar: ROMANTIC_BREAKDOWN.officialStar[getScoreBand3(officialStarScore)],
    yearMonth: ROMANTIC_BREAKDOWN.yearMonth[getScoreBand3(yearMonthScore)],
    peachBlossom: ROMANTIC_BREAKDOWN.peachBlossom[getScoreBand3(peachScore)],
  };

  return {
    totalScore,
    marriageScore,
    styleScore,
    breakdown: {
      dayGan: dayGanScore,
      dayJi: dayJiScore,
      officialStar: officialStarScore,
      yearMonth: yearMonthScore,
      peachBlossom: peachScore,
    },
    summary,
    outro,
    explanations,
    factors,
    narrative: summary,
    preview: { dayGanMatch },
  };
}
