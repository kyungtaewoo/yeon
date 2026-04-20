/**
 * 궁합 엔진 v2 — Full Four-Pillar 궁합 계산
 * 4기둥 전체의 간지 간 상호작용을 분석한다.
 */

import type {
  FourPillars, HeavenlyStem, EarthlyBranch, Element,
  CompatibilityWeights, CompatibilityBreakdown,
} from './types';
import {
  STEM_COMBINATIONS, STEM_CLASHES,
  BRANCH_SIX_HARMONIES, BRANCH_CLASHES, BRANCH_THREE_HARMONIES,
  BRANCH_DIRECTIONAL_HARMONIES, BRANCH_PUNISHMENTS, BRANCH_DESTRUCTIONS, BRANCH_HARMS,
  PEACH_BLOSSOM,
  STEM_TO_ELEMENT, STEM_POLARITY, ELEMENT_NAMES,
  ELEMENT_GENERATES, ELEMENT_OVERCOMES,
  BRANCH_HIDDEN_STEMS,
} from './constants';
import { calculateElementScores, getDominantElement, estimateYongshin } from './elements';
import { getTenGod, getTenGodGroup } from './tenGods';

// ============================================================
// 관계 체크 유틸리티
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
function branchChung(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_CLASHES.some(([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a));
}
function branchSamhap(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_THREE_HARMONIES.some(([b1, b2, b3]) => {
    const set = [b1, b2, b3];
    return set.includes(a) && set.includes(b);
  });
}
function branchBanghap(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_DIRECTIONAL_HARMONIES.some(([b1, b2, b3]) => {
    const set = [b1, b2, b3];
    return set.includes(a) && set.includes(b);
  });
}
function branchHyung(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_PUNISHMENTS.some(([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a));
}
function branchPa(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_DESTRUCTIONS.some(([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a));
}
function branchHae(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_HARMS.some(([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a));
}
function hasPeachBlossom(dayBranch: EarthlyBranch, target: EarthlyBranch): boolean {
  return PEACH_BLOSSOM[dayBranch] === target;
}

// ============================================================
// 세부 요인 기록
// ============================================================

export interface DetailFactor {
  category: keyof CompatibilityBreakdown;
  description: string;
  score: number;
}

// ============================================================
// 항목별 궁합 v2
// ============================================================

function romanceScore(a: FourPillars, b: FourPillars, factors: DetailFactor[]): number {
  let s = 50;

  // 일간 합
  if (stemHap(a.day.stem, b.day.stem)) { s += 25; factors.push({ category: 'romance', description: `일간 합(${a.day.stem}${b.day.stem}合) — 천생연분급 끌림`, score: 25 }); }
  // 일지 육합
  if (branchYukhap(a.day.branch, b.day.branch)) { s += 15; factors.push({ category: 'romance', description: `일지 육합(${a.day.branch}${b.day.branch}合) — 깊은 정서적 결합`, score: 15 }); }
  // 일지 삼합
  if (branchSamhap(a.day.branch, b.day.branch)) { s += 10; factors.push({ category: 'romance', description: '일지 삼합 — 자연스러운 조화', score: 10 }); }
  // 연지 합
  if (branchYukhap(a.year.branch, b.year.branch)) { s += 8; factors.push({ category: 'romance', description: '연지 합 — 가문/환경 조화', score: 8 }); }
  // 월지 합
  if (branchYukhap(a.month.branch, b.month.branch)) { s += 8; factors.push({ category: 'romance', description: '월지 합 — 사회적 성향 조화', score: 8 }); }
  // 도화살 상호
  const aBranches = [a.year.branch, a.month.branch, a.day.branch, ...(a.hour ? [a.hour.branch] : [])];
  const bBranches = [b.year.branch, b.month.branch, b.day.branch, ...(b.hour ? [b.hour.branch] : [])];
  if (bBranches.some(br => hasPeachBlossom(a.day.branch, br)) || aBranches.some(br => hasPeachBlossom(b.day.branch, br))) {
    s += 7; factors.push({ category: 'romance', description: '도화살 상호 — 본능적 끌림', score: 7 });
  }
  // 감점: 일간 충
  if (stemChung(a.day.stem, b.day.stem)) { s -= 15; factors.push({ category: 'romance', description: '일간 충 — 근본적 성향 충돌', score: -15 }); }
  // 일지 충
  if (branchChung(a.day.branch, b.day.branch)) { s -= 12; factors.push({ category: 'romance', description: '일지 충 — 배우자궁 충돌', score: -12 }); }
  // 일지 형
  if (branchHyung(a.day.branch, b.day.branch)) { s -= 8; factors.push({ category: 'romance', description: '일지 형 — 관계 시련', score: -8 }); }

  return Math.max(0, Math.min(100, s));
}

function marriageScore(a: FourPillars, b: FourPillars, factors: DetailFactor[]): number {
  let s = 50;

  // 일지(배우자궁) 합
  if (branchYukhap(a.day.branch, b.day.branch)) { s += 20; factors.push({ category: 'marriage', description: '배우자궁 육합 — 가정 안정', score: 20 }); }
  else if (branchSamhap(a.day.branch, b.day.branch)) { s += 12; factors.push({ category: 'marriage', description: '배우자궁 삼합 — 조화로운 가정', score: 12 }); }
  else if (branchBanghap(a.day.branch, b.day.branch)) { s += 10; factors.push({ category: 'marriage', description: '배우자궁 방합', score: 10 }); }

  // 관성 안정도 (성별 고려 간이)
  const tenGodAtoB = getTenGod(a.day.stem, b.day.stem);
  if (tenGodAtoB === '정관' || tenGodAtoB === '정재') { s += 15; factors.push({ category: 'marriage', description: `상대가 나의 ${tenGodAtoB} — 이상적 배우자`, score: 15 }); }
  else if (tenGodAtoB === '편관' || tenGodAtoB === '편재') { s += 8; factors.push({ category: 'marriage', description: `상대가 나의 ${tenGodAtoB}`, score: 8 }); }

  // 연주 합
  if (stemHap(a.year.stem, b.year.stem)) { s += 7; factors.push({ category: 'marriage', description: '연간 합 — 가문 조화', score: 7 }); }
  if (branchYukhap(a.year.branch, b.year.branch)) { s += 5; factors.push({ category: 'marriage', description: '연지 합', score: 5 }); }
  // 월주 합
  if (stemHap(a.month.stem, b.month.stem)) { s += 5; factors.push({ category: 'marriage', description: '월간 합', score: 5 }); }
  if (branchYukhap(a.month.branch, b.month.branch)) { s += 5; factors.push({ category: 'marriage', description: '월지 합', score: 5 }); }

  // 감점
  if (branchChung(a.day.branch, b.day.branch)) { s -= 15; factors.push({ category: 'marriage', description: '배우자궁 충 — 가정 불안', score: -15 }); }
  if (branchChung(a.year.branch, b.year.branch)) { s -= 8; }
  if (branchChung(a.month.branch, b.month.branch)) { s -= 5; }
  if (branchHyung(a.day.branch, b.day.branch)) { s -= 10; }
  if (branchPa(a.day.branch, b.day.branch)) { s -= 5; }
  if (branchHae(a.day.branch, b.day.branch)) { s -= 5; }

  return Math.max(0, Math.min(100, s));
}

function wealthScore(a: FourPillars, b: FourPillars, factors: DetailFactor[]): number {
  let s = 50;

  // 재성 상호 보완
  const aEl = calculateElementScores(a);
  const bEl = calculateElementScores(b);
  const aWealth = ELEMENT_OVERCOMES[STEM_TO_ELEMENT[a.day.stem]];
  const bWealth = ELEMENT_OVERCOMES[STEM_TO_ELEMENT[b.day.stem]];

  const aWealthScore = aEl[aWealth];
  const bWealthScore = bEl[bWealth];
  const totalA = Object.values(aEl).reduce((x, y) => x + y, 0);
  const totalB = Object.values(bEl).reduce((x, y) => x + y, 0);
  const aWealthRatio = aWealthScore / totalA;
  const bWealthRatio = bWealthScore / totalB;

  // 상호 보완 (한쪽 약 + 한쪽 강) 또는 시너지 (양쪽 강)
  if ((aWealthRatio < 0.15 && bWealthRatio > 0.2) || (bWealthRatio < 0.15 && aWealthRatio > 0.2)) {
    s += 20; factors.push({ category: 'wealth', description: '재성 상호 보완 — 경제적 균형', score: 20 });
  } else if (aWealthRatio > 0.2 && bWealthRatio > 0.2) {
    s += 15; factors.push({ category: 'wealth', description: '양쪽 재성 강 — 재물 시너지', score: 15 });
  }

  // 식상생재 구조: 내 식상 → 상대 재성 상생 흐름
  const aFood = ELEMENT_GENERATES[STEM_TO_ELEMENT[a.day.stem]];
  if (ELEMENT_GENERATES[aFood] === bWealth) {
    s += 12; factors.push({ category: 'wealth', description: '식상생재 흐름 — 함께 부를 창출', score: 12 });
  }

  // 오행 상생 흐름
  const aDayEl = STEM_TO_ELEMENT[a.day.stem];
  const bDayEl = STEM_TO_ELEMENT[b.day.stem];
  if (ELEMENT_GENERATES[aDayEl] === bDayEl || ELEMENT_GENERATES[bDayEl] === aDayEl) {
    s += 10; factors.push({ category: 'wealth', description: '일간 오행 상생 — 재물 흐름', score: 10 });
  }

  // 감점: 비겁이 재성 극
  const tenGod = getTenGod(a.day.stem, b.day.stem);
  if (tenGod === '비견' || tenGod === '겁재') { s -= 8; }

  return Math.max(0, Math.min(100, s));
}

function childrenScore(a: FourPillars, b: FourPillars, factors: DetailFactor[]): number {
  let s = 50;

  // 시주 합
  if (a.hour && b.hour) {
    if (stemHap(a.hour.stem, b.hour.stem)) { s += 10; factors.push({ category: 'children', description: '시간 합 — 자녀궁 조화', score: 10 }); }
    if (branchYukhap(a.hour.branch, b.hour.branch)) { s += 10; factors.push({ category: 'children', description: '시지 합 — 자녀운 호환', score: 10 }); }
    if (branchChung(a.hour.branch, b.hour.branch)) { s -= 15; factors.push({ category: 'children', description: '시주 충 — 자녀궁 충돌', score: -15 }); }

    // 시주와 일주 상생
    const hourEl = STEM_TO_ELEMENT[b.hour.stem];
    const dayEl = STEM_TO_ELEMENT[a.day.stem];
    if (ELEMENT_GENERATES[hourEl] === dayEl || ELEMENT_GENERATES[dayEl] === hourEl) {
      s += 8; factors.push({ category: 'children', description: '시주-일주 상생', score: 8 });
    }
  }

  // 식상 배치 호환
  const aFood = getTenGodGroup(getTenGod(a.day.stem, a.month.stem));
  const bFood = getTenGodGroup(getTenGod(b.day.stem, b.month.stem));
  if (aFood === 'siksang' || bFood === 'siksang') {
    s += 10; factors.push({ category: 'children', description: '식상 배치 — 양육 조화', score: 10 });
  }

  return Math.max(0, Math.min(100, s));
}

function healthScore(a: FourPillars, b: FourPillars, factors: DetailFactor[]): number {
  let s = 50;

  const aScores = calculateElementScores(a);
  const bScores = calculateElementScores(b);
  const elements: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

  // 오행 과불급 보완도 (표준편차 기반)
  const combined = elements.map(el => aScores[el] + bScores[el]);
  const mean = combined.reduce((x, y) => x + y, 0) / 5;
  const variance = combined.reduce((x, y) => x + (y - mean) ** 2, 0) / 5;
  const stddev = Math.sqrt(variance);
  const maxStddev = mean * 2; // 이론적 최대
  const balance = maxStddev > 0 ? 1 - stddev / maxStddev : 1;
  const balanceScore = Math.round(Math.max(0, balance) * 25);
  s += balanceScore;
  if (balanceScore >= 15) factors.push({ category: 'health', description: '오행 보완 — 건강 밸런스 우수', score: balanceScore });

  // 상극 최소화
  let clashCount = 0;
  for (const el of elements) {
    const target = ELEMENT_OVERCOMES[el];
    if (aScores[el] > mean && bScores[target] > mean) clashCount++;
  }
  const clashPenalty = clashCount * -5;
  s += clashPenalty + 15; // 기본 15 + 감점

  // 용신 보완
  const aYongshin = estimateYongshin(a, aScores);
  const bYongshin = estimateYongshin(b, bScores);
  if (bScores[aYongshin] > mean || aScores[bYongshin] > mean) {
    s += 10; factors.push({ category: 'health', description: '용신 상호 보완', score: 10 });
  }

  return Math.max(0, Math.min(100, s));
}

function personalityScore(a: FourPillars, b: FourPillars, factors: DetailFactor[]): number {
  let s = 50;

  // 십성 배치 상성
  const allBStems = [b.year.stem, b.month.stem, ...(b.hour ? [b.hour.stem] : [])];
  const tenGods = allBStems.map(stem => getTenGod(a.day.stem, stem));
  const groups = tenGods.map(getTenGodGroup);

  if (groups.includes('gwansung') && groups.includes('insung')) {
    s += 15; factors.push({ category: 'personality', description: '관인상생 — 안정적 관계', score: 15 });
  } else if (groups.includes('siksang') && groups.includes('jaesung')) {
    s += 12; factors.push({ category: 'personality', description: '식상생재 — 실용적 관계', score: 12 });
  } else if (groups.filter(g => g === 'gwansung').length >= 2) {
    s += 3;
  }

  // 음양 밸런스
  if (STEM_POLARITY[a.day.stem] !== STEM_POLARITY[b.day.stem]) {
    s += 8; factors.push({ category: 'personality', description: '음양 조화 — 상호 보완적 성향', score: 8 });
  }

  // 월지 계절 비교
  const seasonMap: Record<EarthlyBranch, string> = {
    '寅': 'spring', '卯': 'spring', '辰': 'spring',
    '巳': 'summer', '午': 'summer', '未': 'summer',
    '申': 'autumn', '酉': 'autumn', '戌': 'autumn',
    '亥': 'winter', '子': 'winter', '丑': 'winter',
  };
  const aSeason = seasonMap[a.month.branch];
  const bSeason = seasonMap[b.month.branch];
  const seasonGenerates: Record<string, string> = { spring: 'summer', summer: 'autumn', autumn: 'winter', winter: 'spring' };
  if (seasonGenerates[aSeason] === bSeason || seasonGenerates[bSeason] === aSeason) {
    s += 7; factors.push({ category: 'personality', description: '월지 상생 계절 — 보완적 성향', score: 7 });
  } else if (aSeason === bSeason) {
    s += 3;
  }

  // 일간 합
  if (stemHap(a.day.stem, b.day.stem)) { s += 12; }
  // 월지 충 감점
  if (branchChung(a.month.branch, b.month.branch)) { s -= 8; }

  return Math.max(0, Math.min(100, s));
}

// ============================================================
// 종합 궁합 v2
// ============================================================

export interface FullCompatibilityResult {
  totalScore: number;
  breakdown: CompatibilityBreakdown;
  detailFactors: DetailFactor[];
}

export function calculateFullCompatibility(input: {
  sajuA: FourPillars;
  sajuB: FourPillars;
  weights: CompatibilityWeights;
}): FullCompatibilityResult {
  const { sajuA, sajuB, weights } = input;
  const factors: DetailFactor[] = [];

  const breakdown: CompatibilityBreakdown = {
    romance: romanceScore(sajuA, sajuB, factors),
    marriage: marriageScore(sajuA, sajuB, factors),
    wealth: wealthScore(sajuA, sajuB, factors),
    children: childrenScore(sajuA, sajuB, factors),
    health: healthScore(sajuA, sajuB, factors),
    personality: personalityScore(sajuA, sajuB, factors),
  };

  // 가중 합산
  const totalWeight =
    weights.romance + weights.marriage + weights.wealth +
    weights.children + weights.health + weights.personality;

  const totalScore = totalWeight > 0
    ? Math.round(
        (breakdown.romance * weights.romance +
         breakdown.marriage * weights.marriage +
         breakdown.wealth * weights.wealth +
         breakdown.children * weights.children +
         breakdown.health * weights.health +
         breakdown.personality * weights.personality) / totalWeight
      )
    : 50;

  return { totalScore, breakdown, detailFactors: factors };
}
