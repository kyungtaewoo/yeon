/**
 * 지장간 (支藏干) 모듈
 * 지지 속에 숨어 있는 천간(여기, 중기, 정기)을 관리하고
 * 지장간 간의 합/상생/상극 관계를 분석한다.
 */

import type { HeavenlyStem, EarthlyBranch, Element } from './types';
import {
  STEM_TO_ELEMENT, STEM_COMBINATIONS, ELEMENT_GENERATES, ELEMENT_OVERCOMES,
} from './constants';
import { getTenGod } from './tenGods';

// ============================================================
// 지장간 테이블 (여기, 중기, 정기 순)
// ============================================================

export interface JijangGan {
  yeogi: HeavenlyStem;        // 여기 (잔기)
  junggi?: HeavenlyStem;      // 중기
  jeonggi: HeavenlyStem;      // 정기 (본기)
}

export const JIJANG_GAN: Record<EarthlyBranch, JijangGan> = {
  '子': { yeogi: '壬', jeonggi: '癸' },
  '丑': { yeogi: '癸', junggi: '辛', jeonggi: '己' },
  '寅': { yeogi: '戊', junggi: '丙', jeonggi: '甲' },
  '卯': { yeogi: '甲', jeonggi: '乙' },
  '辰': { yeogi: '乙', junggi: '癸', jeonggi: '戊' },
  '巳': { yeogi: '戊', junggi: '庚', jeonggi: '丙' },
  '午': { yeogi: '丙', junggi: '己', jeonggi: '丁' },
  '未': { yeogi: '丁', junggi: '乙', jeonggi: '己' },
  '申': { yeogi: '己', junggi: '壬', jeonggi: '庚' },
  '酉': { yeogi: '庚', jeonggi: '辛' },
  '戌': { yeogi: '辛', junggi: '丁', jeonggi: '戊' },
  '亥': { yeogi: '戊', junggi: '甲', jeonggi: '壬' },
};

// ============================================================
// 유틸리티
// ============================================================

/** 지장간의 모든 천간을 배열로 반환 */
export function getJijangStems(branch: EarthlyBranch): HeavenlyStem[] {
  const jjg = JIJANG_GAN[branch];
  return [jjg.yeogi, ...(jjg.junggi ? [jjg.junggi] : []), jjg.jeonggi];
}

/** 천간합 체크 */
function isStemHap(a: HeavenlyStem, b: HeavenlyStem): boolean {
  return STEM_COMBINATIONS.some(([s1, s2]) => (s1 === a && s2 === b) || (s1 === b && s2 === a));
}

/** 상생 체크 (a가 b를 생) */
function isSheng(a: HeavenlyStem, b: HeavenlyStem): boolean {
  return ELEMENT_GENERATES[STEM_TO_ELEMENT[a]] === STEM_TO_ELEMENT[b];
}

/** 상극 체크 (a가 b를 극) */
function isKe(a: HeavenlyStem, b: HeavenlyStem): boolean {
  return ELEMENT_OVERCOMES[STEM_TO_ELEMENT[a]] === STEM_TO_ELEMENT[b];
}

// ============================================================
// 지장간 궁합 분석
// ============================================================

export interface JijangGanAnalysis {
  score: number;
  factors: string[];
}

/**
 * 두 일지의 지장간 상호 관계를 분석한다.
 * 깊은 궁합(속궁합)의 핵심 지표.
 */
export function analyzeJijangGanCompatibility(
  branchA: EarthlyBranch,
  branchB: EarthlyBranch,
  dayStemA: HeavenlyStem,
  dayStemB: HeavenlyStem,
): JijangGanAnalysis {
  const stemsA = getJijangStems(branchA);
  const stemsB = getJijangStems(branchB);

  let score = 50;
  const factors: string[] = [];

  // 지장간끼리의 합/상생/상극
  for (const sA of stemsA) {
    for (const sB of stemsB) {
      if (isStemHap(sA, sB)) {
        score += 15;
        factors.push(`지장간 합(${sA}${sB}合) — 무의식 차원의 끌림`);
      }
      if (isSheng(sA, sB) || isSheng(sB, sA)) {
        score += 5;
        factors.push(`지장간 상생(${sA}→${sB}) — 내면적 보완`);
      }
      if (isKe(sA, sB) || isKe(sB, sA)) {
        score -= 5;
        factors.push(`지장간 상극(${sA}↔${sB}) — 내면적 긴장`);
      }
    }
  }

  // 지장간 정기가 상대 일간과 맺는 십성 관계
  const jeongiA = JIJANG_GAN[branchA].jeonggi;
  const jeongiB = JIJANG_GAN[branchB].jeonggi;

  const tenGodAtoB = getTenGod(dayStemB, jeongiA);
  const tenGodBtoA = getTenGod(dayStemA, jeongiB);

  const bonusMap: Record<string, number> = {
    '정관': 8, '정인': 8, '식신': 7, '편관': 5, '편인': 5,
    '정재': 6, '편재': 4, '상관': 2, '비견': 1, '겁재': 0,
  };
  score += (bonusMap[tenGodAtoB] ?? 0);
  score += (bonusMap[tenGodBtoA] ?? 0);

  if (bonusMap[tenGodAtoB]! >= 7) {
    factors.push(`상대 일지 정기가 나의 ${tenGodAtoB} — 내면의 안정감`);
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}
