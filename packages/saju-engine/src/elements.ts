/**
 * 오행 (五行) 분석 모듈
 * 사주팔자의 오행 분포를 분석하고 용신(用神)을 추정한다.
 */

import type { FourPillars, Element, ElementScores } from './types';
import {
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
  BRANCH_HIDDEN_STEMS,
  ELEMENT_GENERATES,
  ELEMENT_OVERCOMES,
} from './constants';

/**
 * 사주팔자에서 오행 점수를 계산한다.
 * 천간 = 10점, 지지 본기 = 7점, 지지 장간(중기/여기) = 3점
 */
export function calculateElementScores(pillars: FourPillars): ElementScores {
  const scores: ElementScores = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };

  const allPillars = [pillars.year, pillars.month, pillars.day, pillars.hour];

  for (const pillar of allPillars) {
    if (!pillar) continue;

    // 천간 오행 +10
    const stemElement = STEM_TO_ELEMENT[pillar.stem];
    scores[stemElement] += 10;

    // 지지 장간 — 본기(첫번째) +7, 중기/여기 +3
    const hiddenStems = BRANCH_HIDDEN_STEMS[pillar.branch];
    hiddenStems.forEach((hs, i) => {
      const el = STEM_TO_ELEMENT[hs];
      scores[el] += i === 0 ? 7 : 3;
    });
  }

  return scores;
}

/**
 * 오행 점수에서 가장 강한 오행을 반환
 */
export function getDominantElement(scores: ElementScores): Element {
  let max: Element = 'wood';
  let maxVal = 0;
  for (const [el, val] of Object.entries(scores)) {
    if (val > maxVal) {
      maxVal = val;
      max = el as Element;
    }
  }
  return max;
}

/**
 * 오행 점수에서 가장 약한 오행을 반환
 */
export function getWeakestElement(scores: ElementScores): Element {
  let min: Element = 'wood';
  let minVal = Infinity;
  for (const [el, val] of Object.entries(scores)) {
    if (val < minVal) {
      minVal = val;
      min = el as Element;
    }
  }
  return min;
}

/**
 * 간이 용신(用神) 추정
 * MVP 단계에서는 일간 오행이 강하면 설기(泄氣)/극하는 오행,
 * 약하면 생해주는 오행을 용신으로 추정한다.
 */
export function estimateYongshin(pillars: FourPillars, scores: ElementScores): Element {
  const dayStemElement = STEM_TO_ELEMENT[pillars.day.stem];
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const dayElementRatio = scores[dayStemElement] / total;

  if (dayElementRatio > 0.3) {
    // 일간이 강함 → 설기하는 오행(식상) 또는 극하는 오행을 용신
    return ELEMENT_OVERCOMES[dayStemElement];
  } else {
    // 일간이 약함 → 생해주는 오행(인성)을 용신
    // 나를 생하는 오행 찾기
    const elements: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];
    const generator = elements.find(el => ELEMENT_GENERATES[el] === dayStemElement);
    return generator ?? dayStemElement;
  }
}

/**
 * 두 오행 간의 관계를 판단한다.
 */
export function getElementRelation(
  from: Element,
  to: Element
): 'same' | 'generates' | 'generated_by' | 'overcomes' | 'overcome_by' {
  if (from === to) return 'same';
  if (ELEMENT_GENERATES[from] === to) return 'generates';
  if (ELEMENT_GENERATES[to] === from) return 'generated_by';
  if (ELEMENT_OVERCOMES[from] === to) return 'overcomes';
  return 'overcome_by';
}

/**
 * 두 사주의 오행 보완도를 계산한다 (0~100)
 * 서로의 약한 오행을 보완해주는 정도
 */
export function calculateElementComplementarity(
  scoresA: ElementScores,
  scoresB: ElementScores
): number {
  const elements: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];
  const totalA = Object.values(scoresA).reduce((a, b) => a + b, 0);
  const totalB = Object.values(scoresB).reduce((a, b) => a + b, 0);

  let complementScore = 0;

  for (const el of elements) {
    const ratioA = scoresA[el] / totalA;
    const ratioB = scoresB[el] / totalB;
    const ideal = 0.2; // 균등 분배 기준

    // A가 부족한 오행을 B가 보충해주는지
    if (ratioA < ideal && ratioB > ideal) {
      complementScore += 20;
    }
    // B가 부족한 오행을 A가 보충해주는지
    if (ratioB < ideal && ratioA > ideal) {
      complementScore += 20;
    }
  }

  return Math.min(100, complementScore);
}
