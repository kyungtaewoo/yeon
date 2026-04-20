/**
 * 십성 (十星/十神) 계산 모듈
 * 일간(日干)을 기준으로 다른 천간의 십성을 판별한다.
 */

import type { HeavenlyStem, TenGod, FourPillars, Element, PillarTenGods, TenGodDistribution, TenGodGroup } from './types';
import { STEM_TO_ELEMENT, STEM_POLARITY, ELEMENT_GENERATES, ELEMENT_OVERCOMES, BRANCH_HIDDEN_STEMS } from './constants';

/**
 * 일간을 기준으로 특정 천간의 십성을 구한다.
 *
 * 십성 판별 규칙:
 * - 같은 오행, 같은 음양 → 비견
 * - 같은 오행, 다른 음양 → 겁재
 * - 내가 생하는 오행, 같은 음양 → 식신
 * - 내가 생하는 오행, 다른 음양 → 상관
 * - 내가 극하는 오행, 같은 음양 → 편재
 * - 내가 극하는 오행, 다른 음양 → 정재
 * - 나를 극하는 오행, 같은 음양 → 편관(칠살)
 * - 나를 극하는 오행, 다른 음양 → 정관
 * - 나를 생하는 오행, 같은 음양 → 편인
 * - 나를 생하는 오행, 다른 음양 → 정인
 */
export function getTenGod(dayStem: HeavenlyStem, targetStem: HeavenlyStem): TenGod {
  const dayElement = STEM_TO_ELEMENT[dayStem];
  const targetElement = STEM_TO_ELEMENT[targetStem];
  const samePolarity = STEM_POLARITY[dayStem] === STEM_POLARITY[targetStem];

  // 같은 오행
  if (dayElement === targetElement) {
    return samePolarity ? '비견' : '겁재';
  }

  // 내가 생하는 오행 (식상)
  if (ELEMENT_GENERATES[dayElement] === targetElement) {
    return samePolarity ? '식신' : '상관';
  }

  // 내가 극하는 오행 (재성)
  if (ELEMENT_OVERCOMES[dayElement] === targetElement) {
    return samePolarity ? '편재' : '정재';
  }

  // 나를 극하는 오행 (관성)
  if (ELEMENT_OVERCOMES[targetElement] === dayElement) {
    return samePolarity ? '편관' : '정관';
  }

  // 나를 생하는 오행 (인성)
  return samePolarity ? '편인' : '정인';
}

/**
 * 사주 전체의 십성 배치를 구한다.
 */
export function calculateTenGods(pillars: FourPillars): {
  yearStem: TenGod;
  monthStem: TenGod;
  hourStem: TenGod | null;
} {
  const dayStem = pillars.day.stem;

  return {
    yearStem: getTenGod(dayStem, pillars.year.stem),
    monthStem: getTenGod(dayStem, pillars.month.stem),
    hourStem: pillars.hour ? getTenGod(dayStem, pillars.hour.stem) : null,
  };
}

/**
 * 일간 기준으로 특정 십성에 해당하는 오행을 반환
 */
export function getElementForTenGod(dayStem: HeavenlyStem, tenGod: TenGod): Element {
  const dayElement = STEM_TO_ELEMENT[dayStem];
  const elements: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

  switch (tenGod) {
    case '비견':
    case '겁재':
      return dayElement;
    case '식신':
    case '상관':
      return ELEMENT_GENERATES[dayElement];
    case '편재':
    case '정재':
      return ELEMENT_OVERCOMES[dayElement];
    case '편관':
    case '정관':
      return elements.find(el => ELEMENT_OVERCOMES[el] === dayElement)!;
    case '편인':
    case '정인':
      return elements.find(el => ELEMENT_GENERATES[el] === dayElement)!;
  }
}

/**
 * 관성(官星) 안정도 계산 (0~100)
 * 정관이 있으면 높고, 편관만 있으면 중간, 없으면 낮음
 */
export function getOfficialStarStability(pillars: FourPillars): number {
  const tenGods = calculateTenGods(pillars);
  const all = [tenGods.yearStem, tenGods.monthStem, tenGods.hourStem].filter(Boolean) as TenGod[];

  if (all.includes('정관')) return 80;
  if (all.includes('편관')) return 50;
  return 20;
}

/**
 * 재성(財星) 강도 계산 (0~100)
 */
export function getWealthStarStrength(pillars: FourPillars): number {
  const tenGods = calculateTenGods(pillars);
  const all = [tenGods.yearStem, tenGods.monthStem, tenGods.hourStem].filter(Boolean) as TenGod[];

  let score = 0;
  for (const tg of all) {
    if (tg === '정재') score += 30;
    if (tg === '편재') score += 25;
  }
  return Math.min(100, score + 20);
}

/**
 * 식상(食傷) 배치 점수 (0~100)
 */
export function getFoodGodScore(pillars: FourPillars): number {
  const tenGods = calculateTenGods(pillars);
  const all = [tenGods.yearStem, tenGods.monthStem, tenGods.hourStem].filter(Boolean) as TenGod[];

  let score = 0;
  for (const tg of all) {
    if (tg === '식신') score += 30;
    if (tg === '상관') score += 20;
  }
  return Math.min(100, score + 20);
}

/**
 * 십성을 5대 그룹으로 분류
 */
export function getTenGodGroup(tg: TenGod): TenGodGroup {
  switch (tg) {
    case '비견': case '겁재': return 'bijob';
    case '식신': case '상관': return 'siksang';
    case '편재': case '정재': return 'jaesung';
    case '편관': case '정관': return 'gwansung';
    case '편인': case '정인': return 'insung';
  }
}

/**
 * 지지 장간의 십성 배열을 구한다.
 */
function getBranchTenGods(dayStem: HeavenlyStem, branch: import('./types').EarthlyBranch): TenGod[] {
  const hiddenStems = BRANCH_HIDDEN_STEMS[branch];
  return hiddenStems.map(hs => getTenGod(dayStem, hs));
}

/**
 * 사주 전체의 기둥별 십성 상세를 구한다 (천간 + 지지 장간).
 */
export function calculatePillarTenGods(pillars: FourPillars): PillarTenGods {
  const ds = pillars.day.stem;

  return {
    yearStem: getTenGod(ds, pillars.year.stem),
    yearBranch: getBranchTenGods(ds, pillars.year.branch),
    monthStem: getTenGod(ds, pillars.month.stem),
    monthBranch: getBranchTenGods(ds, pillars.month.branch),
    dayStem: '일간(나)',
    dayBranch: getBranchTenGods(ds, pillars.day.branch),
    hourStem: pillars.hour ? getTenGod(ds, pillars.hour.stem) : null,
    hourBranch: pillars.hour ? getBranchTenGods(ds, pillars.hour.branch) : null,
  };
}

/**
 * 사주 전체의 십성 분포를 계산한다 (5대 그룹별 점수).
 * 천간 = 1점, 지지 본기(장간[0]) = 1점, 중기/여기 = 0.5점
 */
export function calculateTenGodDistribution(pillars: FourPillars): TenGodDistribution {
  const dist: TenGodDistribution = { bijob: 0, siksang: 0, jaesung: 0, gwansung: 0, insung: 0 };
  const ds = pillars.day.stem;

  const allPillars = [pillars.year, pillars.month, pillars.day, pillars.hour];

  for (const pillar of allPillars) {
    if (!pillar) continue;

    // 일간은 비견으로 카운트
    if (pillar === pillars.day) {
      dist.bijob += 1;
    } else {
      const stemTg = getTenGod(ds, pillar.stem);
      dist[getTenGodGroup(stemTg)] += 1;
    }

    // 지지 장간 십성
    const hiddenStems = BRANCH_HIDDEN_STEMS[pillar.branch];
    hiddenStems.forEach((hs, i) => {
      const tg = getTenGod(ds, hs);
      const weight = i === 0 ? 1 : 0.5;
      dist[getTenGodGroup(tg)] += weight;
    });
  }

  return dist;
}
