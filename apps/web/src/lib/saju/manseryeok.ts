/**
 * 만세력 변환 모듈
 * lunar-javascript 라이브러리를 활용하여 양력 날짜 → 음력/간지 변환
 */

// @ts-expect-error lunar-javascript has no type declarations
import { Solar, Lunar } from 'lunar-javascript';

export interface LunarDate {
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
  yearGanZhi: string;  // 연주 간지
  monthGanZhi: string; // 월주 간지
  dayGanZhi: string;   // 일주 간지
}

/**
 * 양력 → 음력 변환
 */
export function solarToLunar(year: number, month: number, day: number): LunarDate {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();

  return {
    year: lunar.getYear(),
    month: lunar.getMonth(),
    day: lunar.getDay(),
    isLeapMonth: lunar.isLeap(),
    yearGanZhi: lunar.getYearInGanZhi(),
    monthGanZhi: lunar.getMonthInGanZhi(),
    dayGanZhi: lunar.getDayInGanZhi(),
  };
}

/**
 * 음력 → 양력 변환
 */
export function lunarToSolar(
  year: number,
  month: number,
  day: number,
  isLeapMonth = false
): { year: number; month: number; day: number } {
  const lunar = Lunar.fromYmd(year, month, day);
  if (isLeapMonth) {
    // lunar-javascript는 윤달 처리를 자동으로 함
  }
  const solar = lunar.getSolar();
  return {
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
  };
}

/**
 * 특정 양력 날짜의 간지 정보 반환
 */
export function getGanZhi(year: number, month: number, day: number) {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  return {
    yearGanZhi: lunar.getYearInGanZhi(),
    monthGanZhi: lunar.getMonthInGanZhi(),
    dayGanZhi: lunar.getDayInGanZhi(),
  };
}
