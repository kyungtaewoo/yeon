/**
 * 역방향 매칭 엔진 v2 — Full Four-Pillar 전수 탐색
 *
 * 나이 범위 내 모든 날짜 × 12시간대를 전수 탐색하여
 * 가장 궁합이 좋은 사주 Top N을 도출한다.
 */

import type {
  FourPillars, CompatibilityWeights, CompatibilityBreakdown,
  Element, ElementScores,
} from './types';
import { calculatePillarsFromHourIndex, sajuToKey } from './pillars';
import { calculateFullCompatibility, type DetailFactor } from './compatibility-v2';
import { calculateElementScores, getDominantElement, estimateYongshin } from './elements';
import { STEM_TO_ELEMENT, ELEMENT_NAMES, STEM_KOREAN, BRANCH_KOREAN } from './constants';
import { generateReport } from './report';

// ============================================================
// MinHeap — Top N 유지용
// ============================================================

class MinHeap<T> {
  private heap: T[] = [];
  constructor(private maxSize: number, private comparator: (a: T, b: T) => number) {}

  push(item: T) {
    if (this.heap.length < this.maxSize) {
      this.heap.push(item);
      this.bubbleUp(this.heap.length - 1);
    } else if (this.comparator(item, this.heap[0]) > 0) {
      this.heap[0] = item;
      this.sinkDown(0);
    }
  }

  extractAll(): T[] {
    return [...this.heap];
  }

  private bubbleUp(idx: number) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.comparator(this.heap[idx], this.heap[parent]) < 0) {
        [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
        idx = parent;
      } else break;
    }
  }

  private sinkDown(idx: number) {
    const len = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < len && this.comparator(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < len && this.comparator(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest !== idx) {
        [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
        idx = smallest;
      } else break;
    }
  }
}

// ============================================================
// 시간대 라벨
// ============================================================

const HOUR_LABELS = [
  '자시(23~01시)', '축시(01~03시)', '인시(03~05시)', '묘시(05~07시)',
  '진시(07~09시)', '사시(09~11시)', '오시(11~13시)', '미시(13~15시)',
  '신시(15~17시)', '유시(17~19시)', '술시(19~21시)', '해시(21~23시)',
];

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// ============================================================
// 타입 정의
// ============================================================

interface DateSajuScore {
  date: string;
  hour: number;
  hourLabel: string;
  pillars: FourPillars;
  totalScore: number;
  breakdown: CompatibilityBreakdown;
  detailFactors: DetailFactor[];
}

export interface IdealMatchProfileV2 {
  rank: number;
  pillars: FourPillars;
  pillarLabels: { year: string; month: string; day: string; hour: string };
  totalScore: number;
  breakdown: CompatibilityBreakdown;
  matchingDates: { date: string; dayOfWeek: string; hour: string; age: number }[];
  ageRange: string;
  description: {
    dominantElement: Element;
    personality: string;
    yongshin: string;
    gyeokguk: string;
  };
  narrative: {
    summary: string;
    synergies: string[];
    cautions: string[];
  };
}

// ============================================================
// 메인 함수
// ============================================================

export interface ReverseMatchV2Input {
  mySaju: FourPillars;
  weights: CompatibilityWeights;
  ageRange: { min: number; max: number };
  topN?: number;
}

export function findIdealMatchesV2(input: ReverseMatchV2Input): IdealMatchProfileV2[] {
  const { mySaju, weights, ageRange, topN = 10 } = input;

  const currentYear = new Date().getFullYear();
  const birthYearStart = currentYear - ageRange.max;
  const birthYearEnd = currentYear - ageRange.min;

  // MinHeap으로 Top N*3 유지 (그룹핑 후 N개 남기기 위해 여유)
  const heapSize = topN * 5;
  const heap = new MinHeap<DateSajuScore>(heapSize, (a, b) => a.totalScore - b.totalScore);

  // 일주별 부분 점수 캐싱
  const dayPillarCache = new Map<string, { score: number; breakdown: CompatibilityBreakdown; factors: DetailFactor[] }>();

  // 전수 탐색
  for (let year = birthYearStart; year <= birthYearEnd; year++) {
    for (let month = 1; month <= 12; month++) {
      const daysInMonth = new Date(year, month, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        for (let hourIdx = 0; hourIdx < 12; hourIdx++) {
          const targetSaju = calculatePillarsFromHourIndex(year, month, day, hourIdx);

          const result = calculateFullCompatibility({
            sajuA: mySaju,
            sajuB: targetSaju,
            weights,
          });

          heap.push({
            date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            hour: hourIdx,
            hourLabel: HOUR_LABELS[hourIdx],
            pillars: targetSaju,
            totalScore: result.totalScore,
            breakdown: result.breakdown,
            detailFactors: result.detailFactors,
          });
        }
      }
    }
  }

  // 결과 추출 & 그룹핑
  const rawResults = heap.extractAll().sort((a, b) => b.totalScore - a.totalScore);
  return groupAndEnrich(rawResults, mySaju, currentYear, topN);
}

// ============================================================
// 그룹핑 & 결과 생성
// ============================================================

function groupAndEnrich(
  results: DateSajuScore[],
  mySaju: FourPillars,
  currentYear: number,
  topN: number
): IdealMatchProfileV2[] {
  const groups = new Map<string, DateSajuScore[]>();

  for (const r of results) {
    const key = sajuToKey(r.pillars);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const profiles: IdealMatchProfileV2[] = [];
  let rank = 1;

  for (const [, items] of groups) {
    if (rank > topN) break;

    const best = items[0];
    const p = best.pillars;

    // 상대 사주 분석
    const report = generateReport(p);
    const elScores = calculateElementScores(p);
    const dominant = getDominantElement(elScores);
    const yongshin = estimateYongshin(p, elScores);

    // 나이 계산
    const ages = items.map(i => currentYear - parseInt(i.date.substring(0, 4)));
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);

    // 시너지 / 주의사항
    const synergies = best.detailFactors.filter(f => f.score > 0).map(f => f.description);
    const cautions = best.detailFactors.filter(f => f.score < 0).map(f => f.description);

    // 종합 서사
    let summary = '';
    if (best.totalScore >= 85) summary = '천생연분이라 할 수 있는 최상의 궁합입니다.';
    else if (best.totalScore >= 70) summary = '매우 좋은 궁합입니다. 서로의 장점을 살리며 함께 성장할 수 있습니다.';
    else if (best.totalScore >= 55) summary = '좋은 궁합입니다. 약간의 노력으로 더욱 깊은 인연이 될 수 있습니다.';
    else summary = '보완적인 궁합입니다. 서로 다른 점이 성장의 원동력이 됩니다.';

    profiles.push({
      rank: rank++,
      pillars: p,
      pillarLabels: {
        year: `${STEM_KOREAN[p.year.stem]}${BRANCH_KOREAN[p.year.branch]}(${p.year.stem}${p.year.branch})`,
        month: `${STEM_KOREAN[p.month.stem]}${BRANCH_KOREAN[p.month.branch]}(${p.month.stem}${p.month.branch})`,
        day: `${STEM_KOREAN[p.day.stem]}${BRANCH_KOREAN[p.day.branch]}(${p.day.stem}${p.day.branch})`,
        hour: p.hour ? `${STEM_KOREAN[p.hour.stem]}${BRANCH_KOREAN[p.hour.branch]}(${p.hour.stem}${p.hour.branch})` : '미상',
      },
      totalScore: best.totalScore,
      breakdown: best.breakdown,
      matchingDates: items.slice(0, 5).map(i => ({
        date: i.date,
        dayOfWeek: DAY_NAMES[new Date(i.date).getDay()],
        hour: i.hourLabel,
        age: currentYear - parseInt(i.date.substring(0, 4)),
      })),
      ageRange: minAge === maxAge ? `만 ${minAge}세` : `만 ${minAge}~${maxAge}세`,
      description: {
        dominantElement: dominant,
        personality: report.personality.substring(0, 60) + '...',
        yongshin: `${ELEMENT_NAMES[yongshin].hanja}(${ELEMENT_NAMES[yongshin].ko})`,
        gyeokguk: report.gyeokguk.name,
      },
      narrative: {
        summary,
        synergies: [...new Set(synergies)].slice(0, 5),
        cautions: [...new Set(cautions)].slice(0, 3),
      },
    });
  }

  return profiles;
}
