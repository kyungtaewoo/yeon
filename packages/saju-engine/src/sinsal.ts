/**
 * 신살 (神煞) 판별 모듈
 *
 * 도화살 / 홍염살 / 천을귀인을 판별한다.
 * - 도화살: 일지 기준 룩업 (PEACH_BLOSSOM)
 * - 홍염살: 일간 기준 룩업 (HONGYEOM_SAL)
 * - 천을귀인: 일간 기준 룩업 (CHEONEUL_GWIIN, 두 지지 중 어느 것이든)
 */

import type { FourPillars, HeavenlyStem, EarthlyBranch } from './types';
import { PEACH_BLOSSOM, HONGYEOM_SAL, CHEONEUL_GWIIN } from './constants';

export type PillarLocation = 'year' | 'month' | 'day' | 'hour';

export interface SinsalHit {
  location: PillarLocation;
  branch: EarthlyBranch;
}

export interface SinsalAnalysis {
  peachBlossom: SinsalHit[];
  hongyeom: SinsalHit[];
  cheoneulGwiin: SinsalHit[];
}

function allBranchPillars(saju: FourPillars): SinsalHit[] {
  const items: SinsalHit[] = [
    { location: 'year', branch: saju.year.branch },
    { location: 'month', branch: saju.month.branch },
    { location: 'day', branch: saju.day.branch },
  ];
  if (saju.hour) items.push({ location: 'hour', branch: saju.hour.branch });
  return items;
}

/** 사주 내 도화살 위치 (일지 기준) */
export function findPeachBlossom(saju: FourPillars): SinsalHit[] {
  const target = PEACH_BLOSSOM[saju.day.branch];
  return allBranchPillars(saju).filter((p) => p.branch === target);
}

/** 사주 내 홍염살 위치 (일간 기준) */
export function findHongyeomSal(saju: FourPillars): SinsalHit[] {
  const target = HONGYEOM_SAL[saju.day.stem];
  return allBranchPillars(saju).filter((p) => p.branch === target);
}

/** 사주 내 천을귀인 위치 (일간 기준) */
export function findCheoneulGwiin(saju: FourPillars): SinsalHit[] {
  const [t1, t2] = CHEONEUL_GWIIN[saju.day.stem];
  return allBranchPillars(saju).filter((p) => p.branch === t1 || p.branch === t2);
}

export function analyzeAllSinsal(saju: FourPillars): SinsalAnalysis {
  return {
    peachBlossom: findPeachBlossom(saju),
    hongyeom: findHongyeomSal(saju),
    cheoneulGwiin: findCheoneulGwiin(saju),
  };
}

/** 외부 지지가 내 도화살인지 (대운/세운 체크용) */
export function isPeachBlossomBranch(dayBranch: EarthlyBranch, target: EarthlyBranch): boolean {
  return PEACH_BLOSSOM[dayBranch] === target;
}

/** 외부 지지가 내 홍염살인지 */
export function isHongyeomBranch(dayStem: HeavenlyStem, target: EarthlyBranch): boolean {
  return HONGYEOM_SAL[dayStem] === target;
}

/** 외부 지지가 내 천을귀인인지 */
export function isCheoneulBranch(dayStem: HeavenlyStem, target: EarthlyBranch): boolean {
  const pair = CHEONEUL_GWIIN[dayStem];
  return pair[0] === target || pair[1] === target;
}
