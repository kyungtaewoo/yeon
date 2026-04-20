/**
 * 사주팔자 (四柱八字) 산출 모듈
 * lunar-javascript의 Solar.fromYmdHms()를 사용하여 연주/월주/일주/시주를 계산한다.
 */

// @ts-expect-error lunar-javascript has no type declarations
import { Solar, Lunar } from 'lunar-javascript';
import type { FourPillars, HeavenlyStem, EarthlyBranch, Pillar } from './types';
import { HEAVENLY_STEMS, EARTHLY_BRANCHES } from './constants';

/**
 * 간지 문자열("甲子")을 Pillar 객체로 변환
 */
function parseGanZhi(ganZhi: string): Pillar {
  const stem = ganZhi[0] as HeavenlyStem;
  const branch = ganZhi[1] as EarthlyBranch;
  return { stem, branch };
}

/**
 * 시간대 인덱스(0~11)를 실제 시각(홀수 시)으로 변환
 * 0=자시(1시), 1=축시(3시), ..., 11=해시(23시)
 */
function hourIndexToHms(hourIndex: number): number {
  return hourIndex * 2 + 1; // 0→1, 1→3, 2→5, ..., 11→23
}

export interface CalculatePillarsInput {
  year: number;
  month: number;
  day: number;
  hour?: number | null;        // 0~23 (실제 시각) 또는 null
  isLunar?: boolean;
}

/**
 * 사주팔자를 산출한다.
 * hour가 주어지면 Solar.fromYmdHms()로 시주까지 라이브러리가 자동 산출.
 */
export function calculatePillars(input: CalculatePillarsInput): FourPillars {
  const { year, month, day, hour, isLunar } = input;

  let solar;
  if (isLunar) {
    const lunar = Lunar.fromYmd(year, month, day);
    solar = lunar.getSolar();
  } else {
    if (hour != null) {
      solar = Solar.fromYmdHms(year, month, day, hour, 0, 0);
    } else {
      solar = Solar.fromYmd(year, month, day);
    }
  }

  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  const yearPillar = parseGanZhi(eightChar.getYear());
  const monthPillar = parseGanZhi(eightChar.getMonth());
  const dayPillar = parseGanZhi(eightChar.getDay());

  let hourPillar: Pillar | null = null;
  if (hour != null) {
    hourPillar = parseGanZhi(eightChar.getTime());
  }

  return {
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
  };
}

/**
 * 시간대 인덱스(0~11)로 사주팔자를 산출한다. (v2 전수 탐색용)
 */
export function calculatePillarsFromHourIndex(
  year: number, month: number, day: number, hourIndex: number
): FourPillars {
  const hms = hourIndexToHms(hourIndex);
  const solar = Solar.fromYmdHms(year, month, day, hms, 0, 0);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();

  return {
    year: parseGanZhi(eightChar.getYear()),
    month: parseGanZhi(eightChar.getMonth()),
    day: parseGanZhi(eightChar.getDay()),
    hour: parseGanZhi(eightChar.getTime()),
  };
}

/**
 * 60간지 인덱스로부터 Pillar 객체를 반환
 */
export function pillarFromIndex(index: number): Pillar {
  return {
    stem: HEAVENLY_STEMS[index % 10],
    branch: EARTHLY_BRANCHES[index % 12],
  };
}

/**
 * Pillar 객체에서 60간지 인덱스를 구한다 (0~59)
 */
export function pillarToIndex(pillar: Pillar): number {
  const stemIdx = HEAVENLY_STEMS.indexOf(pillar.stem);
  const branchIdx = EARTHLY_BRANCHES.indexOf(pillar.branch);

  for (let i = 0; i < 60; i++) {
    if (i % 10 === stemIdx && i % 12 === branchIdx) {
      return i;
    }
  }
  return 0;
}

/**
 * FourPillars를 문자열 키로 변환 ("甲子-丁卯-丙寅-庚寅")
 */
export function sajuToKey(pillars: FourPillars): string {
  const parts = [
    `${pillars.year.stem}${pillars.year.branch}`,
    `${pillars.month.stem}${pillars.month.branch}`,
    `${pillars.day.stem}${pillars.day.branch}`,
  ];
  if (pillars.hour) {
    parts.push(`${pillars.hour.stem}${pillars.hour.branch}`);
  }
  return parts.join('-');
}
