/**
 * 일반 궁합 (社會宮合) 엔진 — 무료
 *
 * 사회적 관계 호환성 (직장, 친구, 동업 등)
 * - 연지 합충 관계 (25%)
 * - 월주 조화 (25%)
 * - 오행 상생상극 시너지 (25%)
 * - 십성 사회적 역할 호환 (15%)
 * - 원진살 체크 (10%)
 */

import type { FourPillars, EarthlyBranch, Element } from './types';
import {
  BRANCH_SIX_HARMONIES, BRANCH_THREE_HARMONIES, BRANCH_CLASHES,
  STEM_COMBINATIONS,
  ELEMENT_GENERATES, ELEMENT_OVERCOMES,
  STEM_TO_ELEMENT, WONJIN_SAL,
} from './constants';
import { calculateElementScores } from './elements';
import { getTenGod, getTenGodGroup } from './tenGods';
import {
  getScoreBand5, getScoreBand3,
  GENERAL_SUMMARY, GENERAL_BREAKDOWN, GENERAL_OUTRO,
  type GeneralKey, type BreakdownExplanation,
} from './narratives';

// ============================================================
// 결과 타입
// ============================================================

export interface GeneralCompatibilityResult {
  totalScore: number;
  breakdown: {
    yearBranch: number;   // 연지 합충
    monthPillar: number;  // 월주 조화
    elements: number;     // 오행 시너지
    tenGods: number;      // 십성 역할
    wonJin: number;       // 원진살
  };
  /** 점수 구간(5단계) 기반 전체 서사 — 3-4문장 */
  summary: string;
  /** 점수 구간(5단계) 기반 마무리 조언 — 1-2문장 */
  outro: string;
  /** 항목별 점수 구간(3단계) 기반 해설 — title + explanation */
  explanations: Record<GeneralKey, BreakdownExplanation>;
  /** 동적 팩트 — 점수 가감 사유 한 줄씩 */
  factors: string[];
  /** @deprecated v3.x 부터는 summary 사용. 하위 호환용 별칭. */
  narrative: string;
}

// ============================================================
// 유틸리티
// ============================================================

function branchYukhap(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_SIX_HARMONIES.some(([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a));
}
function branchSamhap(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_THREE_HARMONIES.some(([b1, b2, b3]) => {
    const set = [b1, b2, b3];
    return set.includes(a) && set.includes(b);
  });
}
function branchChung(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_CLASHES.some(([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a));
}
function stemHap(a: string, b: string): boolean {
  return STEM_COMBINATIONS.some(([s1, s2]) => (s1 === a && s2 === b) || (s1 === b && s2 === a));
}
function isWonjin(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return WONJIN_SAL.some(([w1, w2]) => (w1 === a && w2 === b) || (w1 === b && w2 === a));
}

// ============================================================
// 메인 함수
// ============================================================

export function calculateGeneralCompatibility(
  sajuA: FourPillars,
  sajuB: FourPillars,
): GeneralCompatibilityResult {
  const factors: string[] = [];

  // ── 1. 연지 합충 (기본 50 + 가감) ──
  let yearBranchScore = 50;
  if (branchYukhap(sajuA.year.branch, sajuB.year.branch)) {
    yearBranchScore += 20;
    factors.push('연지 육합 — 기본 성향이 잘 맞는 관계');
  } else if (branchSamhap(sajuA.year.branch, sajuB.year.branch)) {
    yearBranchScore += 15;
    factors.push('연지 삼합 — 자연스러운 조화');
  }
  if (branchChung(sajuA.year.branch, sajuB.year.branch)) {
    yearBranchScore -= 15;
    factors.push('연지 충 — 기본 성향 충돌 가능');
  }
  yearBranchScore = clamp(yearBranchScore);

  // ── 2. 월주 조화 ──
  let monthScore = 50;
  if (stemHap(sajuA.month.stem, sajuB.month.stem)) {
    monthScore += 10;
    factors.push('월간 합 — 사회적 활동 스타일 조화');
  }
  if (branchYukhap(sajuA.month.branch, sajuB.month.branch)) {
    monthScore += 10;
    factors.push('월지 합 — 일하는 패턴이 호환');
  } else if (branchSamhap(sajuA.month.branch, sajuB.month.branch)) {
    monthScore += 7;
  }
  if (branchChung(sajuA.month.branch, sajuB.month.branch)) {
    monthScore -= 10;
    factors.push('월지 충 — 사회적 성향 차이');
  }
  monthScore = clamp(monthScore);

  // ── 3. 오행 시너지 ──
  let elementsScore = 50;
  const aScores = calculateElementScores(sajuA);
  const bScores = calculateElementScores(sajuB);
  const elements: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

  // 상생 흐름 체크
  const aDayEl = STEM_TO_ELEMENT[sajuA.day.stem];
  const bDayEl = STEM_TO_ELEMENT[sajuB.day.stem];
  if (ELEMENT_GENERATES[aDayEl] === bDayEl || ELEMENT_GENERATES[bDayEl] === aDayEl) {
    elementsScore += 15;
    factors.push('일간 오행 상생 — 에너지적 보완 관계');
  }

  // 합산 균형도
  const combined = elements.map(el => aScores[el] + bScores[el]);
  const mean = combined.reduce((a, b) => a + b, 0) / 5;
  const variance = combined.reduce((a, b) => a + (b - mean) ** 2, 0) / 5;
  const stddev = Math.sqrt(variance);
  const maxStddev = mean * 1.5;
  const balance = maxStddev > 0 ? 1 - stddev / maxStddev : 1;
  elementsScore += Math.round(Math.max(0, balance) * 10);

  // 상극 과다 체크
  let clashCount = 0;
  for (const el of elements) {
    if (ELEMENT_OVERCOMES[aDayEl] === bDayEl || ELEMENT_OVERCOMES[bDayEl] === aDayEl) {
      clashCount++;
    }
  }
  if (clashCount > 0) {
    elementsScore -= 10;
    factors.push('일간 오행 상극 — 에너지 충돌 가능');
  }
  elementsScore = clamp(elementsScore);

  // ── 4. 십성 사회적 역할 ──
  let tenGodsScore = 50;
  const tenGodAtoB = getTenGod(sajuA.day.stem, sajuB.day.stem);
  const tenGodBtoA = getTenGod(sajuB.day.stem, sajuA.day.stem);
  const groupA = getTenGodGroup(tenGodAtoB);
  const groupB = getTenGodGroup(tenGodBtoA);

  if ((groupA === 'siksang' && groupB === 'jaesung') || (groupB === 'siksang' && groupA === 'jaesung')) {
    tenGodsScore += 15;
    factors.push('식상+재성 조합 — 함께하면 생산적인 시너지');
  } else if ((groupA === 'gwansung' && groupB === 'insung') || (groupB === 'gwansung' && groupA === 'insung')) {
    tenGodsScore += 12;
    factors.push('관성+인성 조합 — 안정적이고 신뢰 가는 관계');
  } else if (groupA === 'bijob' && groupB === 'bijob') {
    tenGodsScore += 3;
    factors.push('비겁+비겁 — 경쟁적이지만 동기부여가 되는 관계');
  } else if ((groupA === 'siksang' || groupB === 'siksang') && (groupA === 'insung' || groupB === 'insung')) {
    tenGodsScore += 8;
  }
  tenGodsScore = clamp(tenGodsScore);

  // ── 5. 원진살 체크 ──
  let wonJinScore = 50;
  // 연지끼리
  if (isWonjin(sajuA.year.branch, sajuB.year.branch)) {
    wonJinScore -= 15;
    factors.push('연지 원진살 — 함께 있으면 다툼이 잦을 수 있음');
  } else {
    wonJinScore += 10; // 원진 없음 보너스
  }
  // 일지끼리도 체크
  if (isWonjin(sajuA.day.branch, sajuB.day.branch)) {
    wonJinScore -= 10;
    factors.push('일지 원진살 — 가까울수록 마찰 주의');
  } else {
    wonJinScore += 5;
  }
  wonJinScore = clamp(wonJinScore);

  // ── 가중 합산 ──
  const totalScore = Math.round(
    yearBranchScore * 0.25 +
    monthScore * 0.25 +
    elementsScore * 0.25 +
    tenGodsScore * 0.15 +
    wonJinScore * 0.10
  );

  // ── 서사 생성 (템플릿 기반) ──
  const totalBand = getScoreBand5(totalScore);
  const summary = GENERAL_SUMMARY[totalBand];
  const outro = GENERAL_OUTRO[totalBand];
  const explanations: Record<GeneralKey, BreakdownExplanation> = {
    yearBranch: GENERAL_BREAKDOWN.yearBranch[getScoreBand3(yearBranchScore)],
    monthPillar: GENERAL_BREAKDOWN.monthPillar[getScoreBand3(monthScore)],
    elements: GENERAL_BREAKDOWN.elements[getScoreBand3(elementsScore)],
    tenGods: GENERAL_BREAKDOWN.tenGods[getScoreBand3(tenGodsScore)],
    wonJin: GENERAL_BREAKDOWN.wonJin[getScoreBand3(wonJinScore)],
  };

  return {
    totalScore,
    breakdown: {
      yearBranch: yearBranchScore,
      monthPillar: monthScore,
      elements: elementsScore,
      tenGods: tenGodsScore,
      wonJin: wonJinScore,
    },
    summary,
    outro,
    explanations,
    factors,
    narrative: summary,
  };
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}
