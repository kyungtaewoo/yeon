/**
 * 대운 (大運) 산출 모듈
 *
 * 규칙:
 * - 방향: 양년생 남자 / 음년생 여자 → 순행, 그 외 → 역행
 * - 대운수: 순행이면 다음 절(節)까지의 일수, 역행이면 이전 절까지의 일수, ÷3
 * - 배열: 월주에서 시작해 60갑자 순환을 1칸씩 순/역행
 */

// @ts-expect-error lunar-javascript has no type declarations
import { Solar } from 'lunar-javascript';
import type { Pillar, HeavenlyStem, EarthlyBranch } from './types';
import { STEM_POLARITY } from './constants';
import { pillarToIndex, pillarFromIndex } from './pillars';

export interface DaeunPillar {
  order: number;      // 1부터
  startAge: number;   // 이 대운 시작 만 나이
  endAge: number;     // 이 대운 종료 만 나이 (다음 대운 시작 - 1)
  stem: HeavenlyStem;
  branch: EarthlyBranch;
}

export interface DaeunResult {
  forward: boolean;       // 순행 여부
  startAge: number;       // 첫 대운 시작 나이 (대운수)
  pillars: DaeunPillar[];
}

export interface CalculateDaeunInput {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number | null;
  gender: 'male' | 'female';
  yearPillar: Pillar;
  monthPillar: Pillar;
  count?: number;  // default 8 (약 80세까지)
}

/** 대운 계산 */
export function calculateDaeun(input: CalculateDaeunInput): DaeunResult {
  const {
    birthYear, birthMonth, birthDay, birthHour,
    gender, yearPillar, monthPillar, count = 8,
  } = input;

  // 1. 방향 판정
  const yearPolarity = STEM_POLARITY[yearPillar.stem];
  const forward =
    (yearPolarity === 'yang' && gender === 'male') ||
    (yearPolarity === 'yin' && gender === 'female');

  // 2. 대운수 (생일 ↔ 절기 일수 ÷ 3)
  const solar =
    birthHour != null
      ? Solar.fromYmdHms(birthYear, birthMonth, birthDay, birthHour, 0, 0)
      : Solar.fromYmd(birthYear, birthMonth, birthDay);

  const lunar = solar.getLunar();
  const jieQi = forward ? lunar.getNextJie(true) : lunar.getPrevJie(true);

  let daysToJie = 15; // fallback
  if (jieQi && typeof jieQi.getSolar === 'function') {
    const jieSolar = jieQi.getSolar();
    // solar.subtract(other) = days(solar - other)
    daysToJie = forward
      ? Math.abs(jieSolar.subtract(solar))
      : Math.abs(solar.subtract(jieSolar));
  }

  // 3일 = 1년, 1일 = 4개월 — 여기선 연 단위로 반올림
  const startAge = Math.max(1, Math.round(daysToJie / 3));

  // 3. 60갑자 순/역행으로 대운 간지 산출
  const monthIdx = pillarToIndex(monthPillar);
  const pillars: DaeunPillar[] = [];

  for (let i = 0; i < count; i++) {
    const step = forward ? i + 1 : -(i + 1);
    const idx = ((monthIdx + step) % 60 + 60) % 60;
    const p = pillarFromIndex(idx);
    pillars.push({
      order: i + 1,
      startAge: startAge + i * 10,
      endAge: startAge + (i + 1) * 10 - 1,
      stem: p.stem,
      branch: p.branch,
    });
  }

  return { forward, startAge, pillars };
}

/** 특정 만 나이에 해당하는 대운 선택 (대운수 이전이면 null) */
export function findDaeunForAge(result: DaeunResult, age: number): DaeunPillar | null {
  if (age < result.startAge) return null;
  for (const p of result.pillars) {
    if (age >= p.startAge && age <= p.endAge) return p;
  }
  // 대운 배열 끝 이후
  return result.pillars[result.pillars.length - 1] ?? null;
}
