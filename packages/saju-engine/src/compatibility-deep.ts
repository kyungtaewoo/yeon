/**
 * 깊은 궁합 (深層宮合) 엔진
 *
 * 겉으로 드러나지 않는 내면/감정/본능적 차원의 호환성을 분석한다.
 * - 일지 지장간 상호 관계 (30%)
 * - 십이운성 목욕 관계 (20%)
 * - 도화살 심화 분석 (20%)
 * - 오행 과불급 내면 보완 (15%)
 * - 음양 심층 밸런스 (15%)
 */

import type { FourPillars, HeavenlyStem, EarthlyBranch, Element } from './types';
import {
  STEM_TO_ELEMENT, STEM_POLARITY, BRANCH_POLARITY,
  PEACH_BLOSSOM, BRANCH_SIX_HARMONIES,
  ELEMENT_NAMES,
} from './constants';
import { analyzeJijangGanCompatibility, JIJANG_GAN } from './jigangjang';
import { calculateElementScores, getDominantElement, getWeakestElement } from './elements';
import {
  getScoreBand5, getScoreBand3,
  DEEP_SUMMARY, DEEP_BREAKDOWN, DEEP_OUTRO,
  type DeepKey, type BreakdownExplanation,
} from './narratives';

// ============================================================
// 십이운성 (十二運星) — 일간 기준, 지지별 운성
// ============================================================

type TwelvePhase =
  | '장생' | '목욕' | '관대' | '건록' | '제왕'
  | '쇠' | '병' | '사' | '묘' | '절' | '태' | '양';

const TWELVE_PHASES: TwelvePhase[] = [
  '장생', '목욕', '관대', '건록', '제왕',
  '쇠', '병', '사', '묘', '절', '태', '양',
];

const BRANCHES_ORDER: EarthlyBranch[] = [
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
];

// 양간(甲丙戊庚壬) 장생 위치
const YANG_CHANGSHENG: Record<string, EarthlyBranch> = {
  wood: '亥',   // 甲
  fire: '寅',   // 丙
  earth: '寅',  // 戊
  metal: '巳',  // 庚
  water: '申',  // 壬
};

// 음간(乙丁己辛癸) 장생 위치 (역순)
const YIN_CHANGSHENG: Record<string, EarthlyBranch> = {
  wood: '午',   // 乙
  fire: '酉',   // 丁
  earth: '酉',  // 己
  metal: '子',  // 辛
  water: '卯',  // 癸
};

/**
 * 일간 기준 특정 지지의 십이운성을 구한다.
 */
export function getTwelvePhase(dayStem: HeavenlyStem, branch: EarthlyBranch): TwelvePhase {
  const element = STEM_TO_ELEMENT[dayStem];
  const polarity = STEM_POLARITY[dayStem];

  const startBranch = polarity === 'yang'
    ? YANG_CHANGSHENG[element]
    : YIN_CHANGSHENG[element];

  const startIdx = BRANCHES_ORDER.indexOf(startBranch);
  const branchIdx = BRANCHES_ORDER.indexOf(branch);

  if (polarity === 'yang') {
    // 양간: 순행
    const diff = (branchIdx - startIdx + 12) % 12;
    return TWELVE_PHASES[diff];
  } else {
    // 음간: 역행
    const diff = (startIdx - branchIdx + 12) % 12;
    return TWELVE_PHASES[diff];
  }
}

// ============================================================
// 깊은 궁합 결과 타입
// ============================================================

export interface DeepCompatibilityResult {
  totalScore: number;
  breakdown: {
    unconscious: number;     // 무의식 조화도 (지장간)
    emotional: number;       // 감정 교류도 (십이운성)
    attraction: number;      // 본능적 끌림 (도화살)
    innerComplement: number; // 내면 보완도 (오행)
    yinyangBalance: number;  // 음양 밸런스
  };
  /** 점수 구간(5단계) 기반 전체 서사 — 5-6문장 */
  summary: string;
  /** 점수 구간(5단계) 기반 마무리 조언 — 1-2문장 */
  outro: string;
  /** 항목별 점수 구간(3단계) 기반 해설 */
  explanations: Record<DeepKey, BreakdownExplanation>;
  factors: string[];
  /** @deprecated 하위 호환 — 프런트엔드 마이그레이션 후 제거 예정 */
  narrative: {
    summary: string;
    details: { label: string; score: number; description: string }[];
  };
}

// ============================================================
// 메인 함수
// ============================================================

export function calculateDeepCompatibility(
  sajuA: FourPillars,
  sajuB: FourPillars,
): DeepCompatibilityResult {
  const factors: string[] = [];

  // ── 1. 지장간 상호 관계 (30%) ──
  const jjgResult = analyzeJijangGanCompatibility(
    sajuA.day.branch, sajuB.day.branch,
    sajuA.day.stem, sajuB.day.stem,
  );
  const unconscious = jjgResult.score;
  factors.push(...jjgResult.factors);

  // ── 2. 십이운성 목욕 관계 (20%) ──
  const emotional = calcEmotionalExchange(sajuA, sajuB, factors);

  // ── 3. 도화살 심화 분석 (20%) ──
  const attraction = calcDeepAttraction(sajuA, sajuB, factors);

  // ── 4. 오행 내면 보완 (15%) ──
  const innerComplement = calcInnerComplement(sajuA, sajuB, factors);

  // ── 5. 음양 심층 밸런스 (15%) ──
  const yinyangBalance = calcYinyangBalance(sajuA, sajuB, factors);

  // 가중 합산
  const totalScore = Math.round(
    unconscious * 0.30 +
    emotional * 0.20 +
    attraction * 0.20 +
    innerComplement * 0.15 +
    yinyangBalance * 0.15
  );

  // 서사 생성 (템플릿 기반)
  const totalBand = getScoreBand5(totalScore);
  const summary = DEEP_SUMMARY[totalBand];
  const outro = DEEP_OUTRO[totalBand];
  const explanations: Record<DeepKey, BreakdownExplanation> = {
    unconscious: DEEP_BREAKDOWN.unconscious[getScoreBand3(unconscious)],
    emotional: DEEP_BREAKDOWN.emotional[getScoreBand3(emotional)],
    attraction: DEEP_BREAKDOWN.attraction[getScoreBand3(attraction)],
    innerComplement: DEEP_BREAKDOWN.innerComplement[getScoreBand3(innerComplement)],
    yinyangBalance: DEEP_BREAKDOWN.yinyangBalance[getScoreBand3(yinyangBalance)],
  };

  // 하위 호환 — 프런트엔드 마이그레이션 후 제거
  const narrative = buildNarrative(totalScore, {
    unconscious, emotional, attraction, innerComplement, yinyangBalance,
  }, sajuA, sajuB);

  return {
    totalScore,
    breakdown: { unconscious, emotional, attraction, innerComplement, yinyangBalance },
    summary,
    outro,
    explanations,
    factors,
    narrative,
  };
}

// ============================================================
// 하위 계산 함수들
// ============================================================

function calcEmotionalExchange(a: FourPillars, b: FourPillars, factors: string[]): number {
  let s = 50;

  const aPhase = getTwelvePhase(a.day.stem, a.day.branch);
  const bPhase = getTwelvePhase(b.day.stem, b.day.branch);

  const isMokyok = (phase: TwelvePhase) => phase === '목욕';
  const isMyo = (phase: TwelvePhase) => phase === '묘';

  if (isMokyok(aPhase) && isMokyok(bPhase)) {
    s += 15;
    factors.push('양쪽 모두 목욕(沐浴) — 감정 교류가 매우 활발');
  } else if (isMokyok(aPhase) || isMokyok(bPhase)) {
    s += 8;
    factors.push('한쪽 목욕(沐浴) — 감정 표현이 솔직한 관계');
  }

  if (isMyo(aPhase) && isMyo(bPhase)) {
    s -= 5;
    factors.push('양쪽 모두 묘(墓) — 감정 억제 경향');
  }

  // 제왕/건록은 주체적 감정 → 보너스
  const strong = ['제왕', '건록'] as TwelvePhase[];
  if (strong.includes(aPhase) || strong.includes(bPhase)) {
    s += 5;
  }

  return Math.max(0, Math.min(100, s));
}

function calcDeepAttraction(a: FourPillars, b: FourPillars, factors: string[]): number {
  let s = 50;

  const aBranches = [a.year.branch, a.month.branch, a.day.branch, ...(a.hour ? [a.hour.branch] : [])];
  const bBranches = [b.year.branch, b.month.branch, b.day.branch, ...(b.hour ? [b.hour.branch] : [])];

  const aPeach = PEACH_BLOSSOM[a.day.branch];
  const bPeach = PEACH_BLOSSOM[b.day.branch];

  // 상대 일지가 내 도화
  if (b.day.branch === aPeach) {
    s += 20;
    factors.push('상대 일지가 나의 도화 위치 — 강한 본능적 끌림');
  } else if (bBranches.includes(aPeach)) {
    s += 10;
    factors.push('상대 사주에 나의 도화살 — 자연스러운 매력');
  }

  if (a.day.branch === bPeach) {
    s += 20;
    factors.push('내 일지가 상대의 도화 위치 — 상호 끌림');
  } else if (aBranches.includes(bPeach)) {
    s += 10;
  }

  // 도화 + 육합 보너스
  const isYukhap = BRANCH_SIX_HARMONIES.some(([b1, b2]) =>
    (b1 === a.day.branch && b2 === b.day.branch) ||
    (b1 === b.day.branch && b2 === a.day.branch)
  );
  if ((b.day.branch === aPeach || a.day.branch === bPeach) && isYukhap) {
    s += 5;
    factors.push('도화 + 육합 — 운명적 끌림');
  }

  return Math.max(0, Math.min(100, s));
}

function calcInnerComplement(a: FourPillars, b: FourPillars, factors: string[]): number {
  const aScores = calculateElementScores(a);
  const bScores = calculateElementScores(b);
  const aWeak = getWeakestElement(aScores);
  const bWeak = getWeakestElement(bScores);

  // 상대의 지장간이 내 부족 오행을 보완하는지
  const bDayJjg = [JIJANG_GAN[b.day.branch].yeogi, JIJANG_GAN[b.day.branch].junggi, JIJANG_GAN[b.day.branch].jeonggi]
    .filter(Boolean) as HeavenlyStem[];
  const aDayJjg = [JIJANG_GAN[a.day.branch].yeogi, JIJANG_GAN[a.day.branch].junggi, JIJANG_GAN[a.day.branch].jeonggi]
    .filter(Boolean) as HeavenlyStem[];

  let s = 50;

  // 내 약한 오행을 상대 일지 지장간이 보완
  if (bDayJjg.some(stem => STEM_TO_ELEMENT[stem] === aWeak)) {
    s += 15;
    const elName = ELEMENT_NAMES[aWeak];
    factors.push(`상대 지장간이 나의 부족한 ${elName.hanja}(${elName.ko})를 보완 — 내면의 안정감`);
  } else {
    s += 4;
  }

  // 상대의 약한 오행을 내 일지 지장간이 보완
  if (aDayJjg.some(stem => STEM_TO_ELEMENT[stem] === bWeak)) {
    s += 15;
  } else {
    s += 4;
  }

  return Math.max(0, Math.min(100, s));
}

function calcYinyangBalance(a: FourPillars, b: FourPillars, factors: string[]): number {
  let s = 50;
  let harmonies = 0;

  // 레벨 1: 일간 음양
  if (STEM_POLARITY[a.day.stem] !== STEM_POLARITY[b.day.stem]) harmonies++;

  // 레벨 2: 일지 음양
  if (BRANCH_POLARITY[a.day.branch] !== BRANCH_POLARITY[b.day.branch]) harmonies++;

  // 레벨 3: 지장간 정기 음양
  const aJeonggi = JIJANG_GAN[a.day.branch].jeonggi;
  const bJeonggi = JIJANG_GAN[b.day.branch].jeonggi;
  if (STEM_POLARITY[aJeonggi] !== STEM_POLARITY[bJeonggi]) harmonies++;

  if (harmonies === 3) {
    s += 15;
    factors.push('3단계 음양 완전 조화 — 깊은 차원의 밸런스');
  } else if (harmonies === 2) {
    s += 8;
    factors.push('음양 부분 조화 — 대체로 균형 잡힌 관계');
  }

  return Math.max(0, Math.min(100, s));
}

// ============================================================
// 서사 생성
// ============================================================

function buildNarrative(
  total: number,
  breakdown: { unconscious: number; emotional: number; attraction: number; innerComplement: number; yinyangBalance: number },
  a: FourPillars,
  b: FourPillars,
): DeepCompatibilityResult['narrative'] {
  let summary: string;
  if (total >= 85) {
    summary = '겉으로 보이는 것 너머, 두 분의 내면은 깊은 곳에서 연결되어 있습니다. 알수록 빠져드는 운명적 인연입니다.';
  } else if (total >= 70) {
    summary = '내면의 조화가 좋은 관계입니다. 함께 시간을 보낼수록 편안함을 느끼게 됩니다.';
  } else if (total >= 55) {
    summary = '서로 다른 내면을 가졌지만, 그 차이가 성장의 원동력이 될 수 있는 관계입니다.';
  } else {
    summary = '내면의 파장이 다소 다르지만, 의식적인 소통으로 깊은 유대를 형성할 수 있습니다.';
  }

  const details: { label: string; score: number; description: string }[] = [
    {
      label: '무의식 조화도',
      score: breakdown.unconscious,
      description: breakdown.unconscious >= 70
        ? '일지 지장간이 서로 상생하는 관계로, 말하지 않아도 통하는 편안함을 느낄 수 있는 조합입니다.'
        : '내면의 파장이 다소 다르지만, 서로를 이해하려는 노력이 관계를 깊게 만듭니다.',
    },
    {
      label: '감정 교류도',
      score: breakdown.emotional,
      description: breakdown.emotional >= 70
        ? '감정 표현에 솔직한 사주 구조로, 깊은 대화와 정서적 교감이 자연스러운 관계입니다.'
        : '감정 표현 방식에 차이가 있을 수 있지만, 시간이 갈수록 서로의 방식에 익숙해집니다.',
    },
    {
      label: '본능적 끌림',
      score: breakdown.attraction,
      description: breakdown.attraction >= 70
        ? '만나면 자연스럽게 끌리는 강한 인력이 있습니다.'
        : '첫인상보다는 알아갈수록 매력을 발견하는 관계입니다.',
    },
    {
      label: '내면 보완도',
      score: breakdown.innerComplement,
      description: (() => {
        const aWeak = getWeakestElement(calculateElementScores(a));
        const elName = ELEMENT_NAMES[aWeak];
        return breakdown.innerComplement >= 70
          ? `나에게 부족한 ${elName.hanja} 기운을 상대가 채워주어, 함께 있으면 정서적으로 안정감을 느끼는 조합입니다.`
          : '오행적 보완이 크지 않지만, 다른 차원에서 서로를 보완합니다.';
      })(),
    },
  ];

  return { summary, details };
}
