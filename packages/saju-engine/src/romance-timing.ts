/**
 * 연애 시기 분석 모듈
 *
 * 대운 + 세운 + 신살을 조합해 연도별 연애운 점수를 산출한다.
 *
 * 스코어링 요약 (기준 50점):
 * - 세간이 배우자 십성(관성/재성) → +12
 * - 일간과 세간 합 → +15
 * - 일간과 세간 충 → -8
 * - 일지와 세지 육합 → +12
 * - 일지와 세지 삼합 → +8
 * - 일지와 세지 충 → -12
 * - 세지가 내 도화살 → +10
 * - 세지가 내 홍염살 → +8
 * - 세지가 내 천을귀인 → +5
 * - 현 대운 지지가 도화/홍염 → +5
 * - 세간이 배우자 십성 + 대운도 배우자성 → +3 (중첩 보너스)
 */

import type { FourPillars, Pillar, TenGod } from './types';
import { getTenGod } from './tenGods';
import { analyzeSeun, type SeunAnalysis } from './seun';
import { calculateDaeun, findDaeunForAge, type DaeunPillar, type DaeunResult } from './daeun';
import {
  isPeachBlossomBranch, isHongyeomBranch, isCheoneulBranch,
} from './sinsal';

const SPOUSE_TEN_GODS_BY_GENDER: Record<'male' | 'female', TenGod[]> = {
  male: ['정재', '편재'],
  female: ['정관', '편관'],
};

export interface RomanceYearAnalysis {
  year: number;
  age: number;
  seun: Pillar;
  daeun: DaeunPillar | null;
  score: number;           // 0~100 clamp
  factors: string[];       // 사람이 읽을 수 있는 사유 목록
  flags: {
    dayStemCombine: boolean;
    dayStemClash: boolean;
    dayBranchCombine: boolean;
    dayBranchTrine: boolean;
    dayBranchClash: boolean;
    peachBlossom: boolean;
    hongyeom: boolean;
    cheoneul: boolean;
    spouseStarYear: boolean;   // 세간이 배우자 십성
    spouseStarDaeun: boolean;  // 대운 천간이 배우자 십성
    sinsalDaeun: boolean;      // 대운 지지가 도화/홍염
  };
}

export interface RomanceTimingInput {
  saju: FourPillars;
  gender: 'male' | 'female';
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number | null;
  startYear?: number;   // default = 현재 연도
  endYear?: number;     // default = startYear + 10
}

export interface RomanceTimingResult {
  daeun: DaeunResult;
  years: RomanceYearAnalysis[];
  bestYear: RomanceYearAnalysis | null;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function analyzeRomanceTiming(input: RomanceTimingInput): RomanceTimingResult {
  const { saju, gender, birthYear, birthMonth, birthDay, birthHour } = input;
  const currentYear = new Date().getFullYear();
  const startYear = input.startYear ?? currentYear;
  const endYear = input.endYear ?? startYear + 10;

  const spouseGods = SPOUSE_TEN_GODS_BY_GENDER[gender];

  const daeun = calculateDaeun({
    birthYear, birthMonth, birthDay, birthHour,
    gender,
    yearPillar: saju.year,
    monthPillar: saju.month,
  });

  const dayStem = saju.day.stem;
  const dayBranch = saju.day.branch;

  const years: RomanceYearAnalysis[] = [];

  for (let y = startYear; y <= endYear; y++) {
    const age = y - birthYear;
    const seun: SeunAnalysis = analyzeSeun(saju, y);
    const daeunForYear = findDaeunForAge(daeun, age);

    const factors: string[] = [];
    let score = 50;

    const isSpouseYear = spouseGods.includes(seun.tenGodOfStem);
    if (isSpouseYear) {
      score += 12;
      factors.push(`세간 ${seun.pillar.stem}(${seun.tenGodOfStem}) — 배우자성 세운`);
    }

    if (seun.interactions.dayStemCombine) {
      score += 15;
      factors.push(`일간 ${dayStem}과 세간 ${seun.pillar.stem} 합 — 만남 성사 유리`);
    }
    if (seun.interactions.dayStemClash) {
      score -= 8;
      factors.push(`일간 충 — 감정 충돌 가능`);
    }
    if (seun.interactions.dayBranchCombine) {
      score += 12;
      factors.push(`일지 ${dayBranch}과 세지 ${seun.pillar.branch} 육합 — 정서적 결합 운`);
    }
    if (seun.interactions.dayBranchTrine) {
      score += 8;
      factors.push(`일지-세지 삼합`);
    }
    if (seun.interactions.dayBranchClash) {
      score -= 12;
      factors.push(`일지 충 — 배우자궁 불안`);
    }

    const isPeach = isPeachBlossomBranch(dayBranch, seun.pillar.branch);
    if (isPeach) {
      score += 10;
      factors.push(`세지 ${seun.pillar.branch} — 도화운 진입`);
    }
    const isHongyeom = isHongyeomBranch(dayStem, seun.pillar.branch);
    if (isHongyeom) {
      score += 8;
      factors.push(`세지 ${seun.pillar.branch} — 홍염운`);
    }
    const isCheoneul = isCheoneulBranch(dayStem, seun.pillar.branch);
    if (isCheoneul) {
      score += 5;
      factors.push(`세지 ${seun.pillar.branch} — 천을귀인 운`);
    }

    let spouseStarDaeun = false;
    let sinsalDaeun = false;
    if (daeunForYear) {
      const daeunStemGod = getTenGod(dayStem, daeunForYear.stem);
      spouseStarDaeun = spouseGods.includes(daeunStemGod);
      const daeunPeach = isPeachBlossomBranch(dayBranch, daeunForYear.branch);
      const daeunHongyeom = isHongyeomBranch(dayStem, daeunForYear.branch);
      sinsalDaeun = daeunPeach || daeunHongyeom;

      if (sinsalDaeun) {
        score += 5;
        factors.push(`현 대운 ${daeunForYear.stem}${daeunForYear.branch} — 이성운 활성화`);
      }
      if (spouseStarDaeun && isSpouseYear) {
        score += 3;
        factors.push(`대운·세운 모두 배우자성 — 인연 결실 시기`);
      }
    }

    years.push({
      year: y,
      age,
      seun: seun.pillar,
      daeun: daeunForYear,
      score: clamp(score),
      factors,
      flags: {
        dayStemCombine: seun.interactions.dayStemCombine,
        dayStemClash: seun.interactions.dayStemClash,
        dayBranchCombine: seun.interactions.dayBranchCombine,
        dayBranchTrine: seun.interactions.dayBranchTrine,
        dayBranchClash: seun.interactions.dayBranchClash,
        peachBlossom: isPeach,
        hongyeom: isHongyeom,
        cheoneul: isCheoneul,
        spouseStarYear: isSpouseYear,
        spouseStarDaeun,
        sinsalDaeun,
      },
    });
  }

  const bestYear = years.reduce<RomanceYearAnalysis | null>(
    (best, y) => (!best || y.score > best.score ? y : best),
    null,
  );

  return { daeun, years, bestYear };
}

/** 두 사람의 연애운 곡선을 겹쳐서 합산 점수 높은 연도 도출 */
export function findMutualRomanceYears(
  a: RomanceTimingInput,
  b: RomanceTimingInput,
): { year: number; scoreA: number; scoreB: number; combined: number }[] {
  const startYear = Math.max(a.startYear ?? new Date().getFullYear(), b.startYear ?? new Date().getFullYear());
  const endYear = Math.min(
    a.endYear ?? (a.startYear ?? new Date().getFullYear()) + 10,
    b.endYear ?? (b.startYear ?? new Date().getFullYear()) + 10,
  );

  const ra = analyzeRomanceTiming({ ...a, startYear, endYear });
  const rb = analyzeRomanceTiming({ ...b, startYear, endYear });

  const byYear = new Map<number, RomanceYearAnalysis>();
  for (const y of rb.years) byYear.set(y.year, y);

  return ra.years
    .map((ya) => {
      const yb = byYear.get(ya.year);
      if (!yb) return null;
      return {
        year: ya.year,
        scoreA: ya.score,
        scoreB: yb.score,
        combined: Math.round((ya.score + yb.score) / 2),
      };
    })
    .filter((x): x is { year: number; scoreA: number; scoreB: number; combined: number } => x !== null)
    .sort((x, y) => y.combined - x.combined);
}
