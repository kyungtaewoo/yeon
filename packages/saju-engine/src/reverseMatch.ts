/**
 * 역산출 알고리즘 (Reverse Match)
 *
 * 내 사주 + 선호 가중치 → 이상적 상대의 사주 프로파일 Top 10 도출
 *
 * 알고리즘:
 * 1. 60간지 일주 후보 각각에 대해 궁합 점수 계산
 * 2. 가중치 적용 총점 기준 Top 10 선정
 * 3. 각 일주에 대해 연령 범위 내 실제 날짜 역변환
 */

// @ts-expect-error lunar-javascript has no type declarations
import { Solar } from 'lunar-javascript';
import type {
  FourPillars,
  CompatibilityWeights,
  IdealSajuProfile,
  Pillar,
  CompatibilityBreakdown,
} from './types';
import { SIXTY_JIAZI, STEM_TO_ELEMENT, ELEMENT_NAMES, STEM_KOREAN, BRANCH_KOREAN } from './constants';
import { calculateCompatibility } from './compatibility';
import { calculatePillars } from './pillars';

interface ReverseMatchInput {
  myPillars: FourPillars;
  weights: CompatibilityWeights;
  gender: 'male' | 'female';
  ageRangeMin: number;   // 최소 나이 (만 나이)
  ageRangeMax: number;   // 최대 나이 (만 나이)
  topN?: number;         // 기본 10
}

/**
 * 이상적 상대 사주 프로파일을 역산출한다.
 */
export function reverseMatch(input: ReverseMatchInput): IdealSajuProfile[] {
  const { myPillars, weights, ageRangeMin, ageRangeMax, topN = 10 } = input;

  // 현재 연도 기준 출생 연도 범위 계산
  const currentYear = new Date().getFullYear();
  const birthYearMax = currentYear - ageRangeMin;
  const birthYearMin = currentYear - ageRangeMax;

  // 1. 60간지 일주 후보별 궁합 점수 계산
  const candidates: Array<{
    dayPillar: Pillar;
    index: number;
    score: number;
    breakdown: CompatibilityBreakdown;
  }> = [];

  for (let i = 0; i < 60; i++) {
    const candidateDayPillar = SIXTY_JIAZI[i];

    // 가상 사주 구성 (일주만으로 간이 평가)
    // 월주는 일주와 같은 오행 계열로 가정, 연주는 범위 중앙값
    const mockPillars: FourPillars = {
      year: { stem: '甲', branch: '子' },   // placeholder
      month: { stem: '甲', branch: '寅' },  // placeholder
      day: candidateDayPillar,
      hour: null,
    };

    const result = calculateCompatibility(myPillars, mockPillars, weights);

    candidates.push({
      dayPillar: candidateDayPillar,
      index: i,
      score: result.totalScore,
      breakdown: result.breakdown,
    });
  }

  // 2. 총점 기준 정렬 → Top N
  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, topN);

  // 3. 각 후보에 대해 실제 출생 연도 범위에서 해당 일주가 존재하는 날짜 찾기
  const results: IdealSajuProfile[] = topCandidates.map((candidate, idx) => {
    const { dayPillar, score, breakdown } = candidate;
    const stemElement = STEM_TO_ELEMENT[dayPillar.stem];
    const elementName = ELEMENT_NAMES[stemElement];
    const stemKo = STEM_KOREAN[dayPillar.stem];
    const branchKo = BRANCH_KOREAN[dayPillar.branch];

    // 설명 텍스트 생성
    const description = generateDescription(dayPillar, breakdown, score);

    return {
      rank: idx + 1,
      pillars: {
        day: dayPillar,
      },
      compatibilityScore: score,
      scoreBreakdown: breakdown,
      birthYearRange: [birthYearMin, birthYearMax] as [number, number],
      description,
    };
  });

  return results;
}

/**
 * 이상적 상대 프로파일 설명 텍스트 생성
 */
function generateDescription(
  dayPillar: Pillar,
  breakdown: CompatibilityBreakdown,
  totalScore: number
): string {
  const stemElement = STEM_TO_ELEMENT[dayPillar.stem];
  const elementName = ELEMENT_NAMES[stemElement];
  const stemKo = STEM_KOREAN[dayPillar.stem];
  const branchKo = BRANCH_KOREAN[dayPillar.branch];

  // 가장 높은 궁합 항목 찾기
  const entries = Object.entries(breakdown) as Array<[keyof CompatibilityBreakdown, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const topCategory = entries[0][0];

  const categoryNames: Record<keyof CompatibilityBreakdown, string> = {
    romance: '연애',
    marriage: '결혼',
    wealth: '재물',
    children: '자녀',
    health: '건강',
    personality: '성격',
  };

  const elementTraits: Record<string, string> = {
    wood: '성장지향적이고 인자한',
    fire: '열정적이고 따뜻한',
    earth: '안정적이고 신뢰감 있는',
    metal: '결단력 있고 원칙적인',
    water: '지혜롭고 유연한',
  };

  const trait = elementTraits[stemElement] || '';

  return `${elementName.hanja}(${elementName.ko}) ${stemKo}${branchKo}일주 — ${trait} 상대. ${categoryNames[topCategory]} 궁합이 특히 좋습니다.`;
}

/**
 * 특정 일주(日柱)가 특정 연도 범위 내에서 나타나는 날짜들을 찾는다.
 * (매칭 시 사용)
 */
export function findDatesForDayPillar(
  dayPillar: Pillar,
  startYear: number,
  endYear: number,
  maxResults = 5
): Array<{ year: number; month: number; day: number }> {
  const results: Array<{ year: number; month: number; day: number }> = [];

  // 각 연도의 1월 1일부터 탐색 (샘플링)
  for (let year = startYear; year <= endYear && results.length < maxResults; year++) {
    // 1월 1일의 일주를 구해서 목표 일주까지의 차이 계산
    const jan1Pillars = calculatePillars({ year, month: 1, day: 1 });
    const jan1DayStemIdx = SIXTY_JIAZI.findIndex(
      j => j.stem === jan1Pillars.day.stem && j.branch === jan1Pillars.day.branch
    );
    const targetIdx = SIXTY_JIAZI.findIndex(
      j => j.stem === dayPillar.stem && j.branch === dayPillar.branch
    );

    let diff = targetIdx - jan1DayStemIdx;
    if (diff < 0) diff += 60;

    // 해당 연도 내에서 60일 간격으로 등장
    for (let dayOffset = diff; dayOffset < 366; dayOffset += 60) {
      const date = new Date(year, 0, 1 + dayOffset);
      if (date.getFullYear() !== year) break;

      results.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
      });

      if (results.length >= maxResults) break;
    }
  }

  return results;
}
