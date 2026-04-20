/**
 * 궁합 (宮合) 점수 계산 모듈
 * DEV_PLAN의 항목별 계산 로직을 구현한다.
 */

import type {
  FourPillars,
  CompatibilityWeights,
  CompatibilityResult,
  CompatibilityBreakdown,
  ElementScores,
} from './types';
import {
  STEM_COMBINATIONS,
  STEM_CLASHES,
  BRANCH_SIX_HARMONIES,
  BRANCH_CLASHES,
  BRANCH_THREE_HARMONIES,
  BRANCH_PUNISHMENTS,
  BRANCH_DESTRUCTIONS,
  BRANCH_HARMS,
  PEACH_BLOSSOM,
  STEM_TO_ELEMENT,
  ELEMENT_NAMES,
} from './constants';
import type { HeavenlyStem, EarthlyBranch } from './types';
import { calculateElementScores, calculateElementComplementarity } from './elements';
import { getTenGod, getOfficialStarStability, getWealthStarStrength, getFoodGodScore } from './tenGods';

// ============================================================
// 유틸리티: 관계 체크
// ============================================================

function hasStemCombination(a: HeavenlyStem, b: HeavenlyStem): boolean {
  return STEM_COMBINATIONS.some(
    ([s1, s2]) => (s1 === a && s2 === b) || (s1 === b && s2 === a)
  );
}

function hasStemClash(a: HeavenlyStem, b: HeavenlyStem): boolean {
  return STEM_CLASHES.some(
    ([s1, s2]) => (s1 === a && s2 === b) || (s1 === b && s2 === a)
  );
}

function hasBranchHarmony(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_SIX_HARMONIES.some(
    ([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a)
  );
}

function hasBranchClash(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_CLASHES.some(
    ([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a)
  );
}

function hasBranchThreeHarmony(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_THREE_HARMONIES.some(
    ([b1, b2, b3]) => {
      const set = [b1, b2, b3];
      return set.includes(a) && set.includes(b);
    }
  );
}

function hasBranchPunishment(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_PUNISHMENTS.some(
    ([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a)
  );
}

function hasBranchHarm(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_HARMS.some(
    ([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a)
  );
}

function hasBranchDestruction(a: EarthlyBranch, b: EarthlyBranch): boolean {
  return BRANCH_DESTRUCTIONS.some(
    ([b1, b2]) => (b1 === a && b2 === b) || (b1 === b && b2 === a)
  );
}

function hasPeachBlossomRelation(branchA: EarthlyBranch, branchB: EarthlyBranch): boolean {
  return PEACH_BLOSSOM[branchA] === branchB || PEACH_BLOSSOM[branchB] === branchA;
}

// ============================================================
// 항목별 궁합 점수 (0~100)
// ============================================================

/**
 * [연애 궁합]
 * - 일간 합 → +30
 * - 일지 육합 → +20
 * - 도화살 상호 → +15
 * - 일간 충 → -20
 */
function calculateRomanceScore(a: FourPillars, b: FourPillars): number {
  let score = 35; // 기본점수

  if (hasStemCombination(a.day.stem, b.day.stem)) score += 30;
  if (hasBranchHarmony(a.day.branch, b.day.branch)) score += 20;
  if (hasPeachBlossomRelation(a.day.branch, b.day.branch)) score += 15;
  if (hasStemClash(a.day.stem, b.day.stem)) score -= 20;
  if (hasBranchClash(a.day.branch, b.day.branch)) score -= 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * [결혼 궁합]
 * - 배우자궁(일지) 합 → +25
 * - 관성 안정도 → +20
 * - 지지 삼합/방합 → +15
 * - 형·파·해 → 감점
 */
function calculateMarriageScore(a: FourPillars, b: FourPillars): number {
  let score = 30;

  if (hasBranchHarmony(a.day.branch, b.day.branch)) score += 25;
  if (hasBranchThreeHarmony(a.day.branch, b.day.branch)) score += 15;

  // 관성 안정도 평균
  const officialA = getOfficialStarStability(a);
  const officialB = getOfficialStarStability(b);
  score += Math.round((officialA + officialB) / 2 * 0.2);

  // 감점 요소
  if (hasBranchPunishment(a.day.branch, b.day.branch)) score -= 15;
  if (hasBranchDestruction(a.day.branch, b.day.branch)) score -= 10;
  if (hasBranchHarm(a.day.branch, b.day.branch)) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * [재물 궁합]
 * - 재성 상호 보완 → +25
 * - 오행 상생 흐름 → +20
 */
function calculateWealthScore(a: FourPillars, b: FourPillars): number {
  let score = 30;

  const wealthA = getWealthStarStrength(a);
  const wealthB = getWealthStarStrength(b);
  score += Math.round((wealthA + wealthB) / 2 * 0.25);

  // 일간 → 상대 재성 오행 상생 관계
  const aElement = STEM_TO_ELEMENT[a.day.stem];
  const bElement = STEM_TO_ELEMENT[b.day.stem];
  const tenGodAtoB = getTenGod(a.day.stem, b.day.stem);
  if (tenGodAtoB === '정재' || tenGodAtoB === '편재') score += 20;

  return Math.max(0, Math.min(100, score));
}

/**
 * [자녀 궁합]
 * - 식상 배치 호환 → +25
 * - 시주 합 → +20
 */
function calculateChildrenScore(a: FourPillars, b: FourPillars): number {
  let score = 35;

  const foodA = getFoodGodScore(a);
  const foodB = getFoodGodScore(b);
  score += Math.round((foodA + foodB) / 2 * 0.25);

  // 시주 합 관계
  if (a.hour && b.hour) {
    if (hasStemCombination(a.hour.stem, b.hour.stem)) score += 15;
    if (hasBranchHarmony(a.hour.branch, b.hour.branch)) score += 15;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * [건강 궁합]
 * - 오행 과불급 상호 보완도 → +30
 * - 상극 관계 최소화 → +20
 */
function calculateHealthScore(a: FourPillars, b: FourPillars): number {
  const scoresA = calculateElementScores(a);
  const scoresB = calculateElementScores(b);

  let score = 30;
  score += Math.round(calculateElementComplementarity(scoresA, scoresB) * 0.5);

  // 일간 상극이면 감점
  const aEl = STEM_TO_ELEMENT[a.day.stem];
  const bEl = STEM_TO_ELEMENT[b.day.stem];
  const tenGod = getTenGod(a.day.stem, b.day.stem);
  if (tenGod === '편관') score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * [성격 궁합]
 * - 십성 배치 상성 → +25
 * - 음양 밸런스 → +10
 */
function calculatePersonalityScore(a: FourPillars, b: FourPillars): number {
  let score = 35;

  // 일간 합이면 성격 궁합 좋음
  if (hasStemCombination(a.day.stem, b.day.stem)) score += 25;

  // 음양 밸런스
  const { STEM_POLARITY } = require('./constants');
  const polarityA = STEM_POLARITY[a.day.stem];
  const polarityB = STEM_POLARITY[b.day.stem];
  if (polarityA !== polarityB) score += 10; // 음양 조화

  // 월간 합
  if (hasStemCombination(a.month.stem, b.month.stem)) score += 15;

  // 월지 충이면 감점
  if (hasBranchClash(a.month.branch, b.month.branch)) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ============================================================
// 종합 궁합 계산
// ============================================================

/**
 * 두 사주의 궁합 점수를 계산한다 (가중치 적용)
 */
export function calculateCompatibility(
  a: FourPillars,
  b: FourPillars,
  weights: CompatibilityWeights
): CompatibilityResult {
  const breakdown: CompatibilityBreakdown = {
    romance: calculateRomanceScore(a, b),
    marriage: calculateMarriageScore(a, b),
    wealth: calculateWealthScore(a, b),
    children: calculateChildrenScore(a, b),
    health: calculateHealthScore(a, b),
    personality: calculatePersonalityScore(a, b),
  };

  // 가중 합산
  const totalWeight =
    weights.romance + weights.marriage + weights.wealth +
    weights.children + weights.health + weights.personality;

  const weightedSum =
    breakdown.romance * weights.romance +
    breakdown.marriage * weights.marriage +
    breakdown.wealth * weights.wealth +
    breakdown.children * weights.children +
    breakdown.health * weights.health +
    breakdown.personality * weights.personality;

  const totalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  // 시너지 & 주의사항 생성
  const synergies: string[] = [];
  const cautions: string[] = [];

  if (hasStemCombination(a.day.stem, b.day.stem)) {
    synergies.push('일간 천간합 — 자연스러운 끌림과 조화가 있는 관계입니다');
  }
  if (hasBranchHarmony(a.day.branch, b.day.branch)) {
    synergies.push('일지 육합 — 배우자궁이 합하여 결혼 궁합이 뛰어납니다');
  }
  if (breakdown.romance >= 70) {
    synergies.push('연애 궁합이 뛰어나 설레는 만남이 기대됩니다');
  }
  if (breakdown.health >= 70) {
    synergies.push('오행이 서로 보완되어 함께할수록 건강해지는 관계입니다');
  }

  if (hasStemClash(a.day.stem, b.day.stem)) {
    cautions.push('일간 충 — 서로 다른 가치관으로 갈등이 생길 수 있습니다');
  }
  if (hasBranchClash(a.day.branch, b.day.branch)) {
    cautions.push('일지 충 — 생활 습관 차이로 조율이 필요합니다');
  }
  if (hasBranchPunishment(a.day.branch, b.day.branch)) {
    cautions.push('지지 형 — 관계에서 예상치 못한 시련이 올 수 있습니다');
  }

  // 내러티브 생성
  const aElement = STEM_TO_ELEMENT[a.day.stem];
  const bElement = STEM_TO_ELEMENT[b.day.stem];
  const aName = ELEMENT_NAMES[aElement];
  const bName = ELEMENT_NAMES[bElement];

  let narrative = `${aName.hanja}(${aName.ko})의 기운을 가진 분과 ${bName.hanja}(${bName.ko})의 기운을 가진 분의 만남입니다. `;

  if (totalScore >= 80) {
    narrative += '천생연분이라 할 수 있을 만큼 뛰어난 궁합입니다. 함께하면 서로의 부족한 부분을 자연스럽게 채워주며 성장할 수 있습니다.';
  } else if (totalScore >= 60) {
    narrative += '좋은 궁합입니다. 서로의 장점을 살리며 함께 발전할 수 있는 관계입니다. 약간의 노력으로 더욱 깊은 인연이 될 수 있습니다.';
  } else if (totalScore >= 40) {
    narrative += '평범한 궁합이지만, 서로에 대한 이해와 배려가 있다면 충분히 좋은 관계를 만들 수 있습니다.';
  } else {
    narrative += '도전적인 궁합이지만, 서로 다른 점이 오히려 성장의 원동력이 될 수 있습니다. 인내와 소통이 중요합니다.';
  }

  return {
    totalScore,
    breakdown,
    narrative,
    synergies,
    cautions,
  };
}

/**
 * 가중치 없이 균등 비중으로 궁합을 계산
 */
export function calculateCompatibilitySimple(
  a: FourPillars,
  b: FourPillars
): CompatibilityResult {
  return calculateCompatibility(a, b, {
    romance: 50,
    marriage: 50,
    wealth: 50,
    children: 50,
    health: 50,
    personality: 50,
  });
}
