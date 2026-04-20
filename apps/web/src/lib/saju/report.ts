/**
 * 사주 리포트 생성 모듈
 * 사주팔자를 분석하여 십성 분포, 격국, 신살, 성격/연애/재물/건강 요약을 생성한다.
 */

import type { FourPillars, SajuReport, Element, GyeokGuk, ShinSal, TenGod } from './types';
import {
  STEM_TO_ELEMENT, ELEMENT_NAMES, BRANCH_KOREAN, STEM_KOREAN,
  PEACH_BLOSSOM, BRANCH_CLASHES, BRANCH_THREE_HARMONIES,
  BRANCH_HIDDEN_STEMS,
} from './constants';
import { calculateElementScores, getDominantElement, estimateYongshin } from './elements';
import { calculateTenGods, calculatePillarTenGods, calculateTenGodDistribution, getTenGod } from './tenGods';

// ============================================================
// 격국 판단 (간이)
// ============================================================
function determineGyeokGuk(pillars: FourPillars): GyeokGuk {
  const dayStem = pillars.day.stem;
  const monthBranchHidden = BRANCH_HIDDEN_STEMS[pillars.month.branch];
  const monthMainStem = monthBranchHidden[0];
  const monthTenGod = getTenGod(dayStem, monthMainStem);

  const gyeokMap: Record<TenGod, GyeokGuk> = {
    '비견': { name: '비견격', description: '자주적이고 독립심이 강합니다. 동업이나 협력보다 독자적인 길을 걸을 때 빛납니다.' },
    '겁재': { name: '겁재격', description: '경쟁심이 강하고 추진력이 있습니다. 승부사 기질이 있으나 재물 관리에 주의가 필요합니다.' },
    '식신': { name: '식신격', description: '온화하고 여유로운 성품입니다. 의식주가 풍족하고 예술적 감각이 뛰어납니다.' },
    '상관': { name: '상관격', description: '총명하고 재능이 다양합니다. 기존 질서에 도전하는 혁신가 기질이 있습니다.' },
    '편재': { name: '편재격', description: '사교적이고 재물 감각이 뛰어납니다. 큰 규모의 사업이나 투자에 인연이 있습니다.' },
    '정재': { name: '정재격', description: '성실하고 착실하게 재물을 모읍니다. 꾸준한 노력으로 안정적인 부를 쌓아갑니다.' },
    '편관': { name: '편관격(칠살격)', description: '강한 추진력과 카리스마가 있습니다. 권력이나 조직에서 두각을 나타내는 타입입니다.' },
    '정관': { name: '정관격', description: '원칙적이고 품행이 바릅니다. 공직이나 대기업 등 안정된 조직에서 능력을 발휘합니다.' },
    '편인': { name: '편인격', description: '독창적이고 학문적 탐구심이 강합니다. 특수 분야나 전문 기술에서 뛰어난 능력을 보입니다.' },
    '정인': { name: '정인격', description: '인자하고 학식이 풍부합니다. 교육, 연구, 학문 분야에서 좋은 성과를 냅니다.' },
  };

  return gyeokMap[monthTenGod];
}

// ============================================================
// 신살 감지
// ============================================================
function detectShinSal(pillars: FourPillars): ShinSal[] {
  const result: ShinSal[] = [];
  const dayBranch = pillars.day.branch;

  // 도화살 (桃花殺)
  const peachTarget = PEACH_BLOSSOM[dayBranch];
  const branches = [
    { branch: pillars.year.branch, loc: '연지' },
    { branch: pillars.month.branch, loc: '월지' },
    { branch: pillars.day.branch, loc: '일지' },
    ...(pillars.hour ? [{ branch: pillars.hour.branch, loc: '시지' }] : []),
  ];

  for (const { branch, loc } of branches) {
    if (branch === peachTarget) {
      result.push({
        name: '도화살(桃花殺)',
        description: '매력과 이성 인연이 강합니다. 대인관계에서 인기가 많으며, 예술적 감각이 뛰어납니다.',
        location: loc,
      });
    }
  }

  // 역마살 (驛馬殺) — 일지 기준
  const yeokmaMap: Record<string, string> = {
    '寅': '申', '申': '寅', '巳': '亥', '亥': '巳',
    '子': '午', '午': '子', '卯': '酉', '酉': '卯',
    '辰': '戌', '戌': '辰', '丑': '未', '未': '丑',
  };
  const yeokmaTarget = yeokmaMap[dayBranch];
  if (yeokmaTarget) {
    for (const { branch, loc } of branches) {
      if (branch === yeokmaTarget) {
        result.push({
          name: '역마살(驛馬殺)',
          description: '변화와 이동이 많은 운명입니다. 해외 인연이 있거나 여행을 좋아하며, 활동적인 직업에 유리합니다.',
          location: loc,
        });
      }
    }
  }

  // 화개살 (華蓋殺) — 일지 기준 삼합 마지막 글자
  const hwagaeMap: Record<string, string> = {
    '申': '辰', '子': '辰', '辰': '辰',
    '寅': '戌', '午': '戌', '戌': '戌',
    '巳': '丑', '酉': '丑', '丑': '丑',
    '亥': '未', '卯': '未', '未': '未',
  };
  const hwagaeTarget = hwagaeMap[dayBranch];
  if (hwagaeTarget) {
    for (const { branch, loc } of branches) {
      if (branch === hwagaeTarget && loc !== '일지') {
        result.push({
          name: '화개살(華蓋殺)',
          description: '예술적 감각과 종교/철학적 깊이가 있습니다. 내면의 세계가 풍부하며 학문에 뛰어난 재능을 보입니다.',
          location: loc,
        });
      }
    }
  }

  // 귀문관살 (鬼門關殺) — 일지와 충
  for (const [a, b] of BRANCH_CLASHES) {
    if (dayBranch === a || dayBranch === b) {
      const target = dayBranch === a ? b : a;
      for (const { branch, loc } of branches) {
        if (branch === target && loc !== '일지') {
          result.push({
            name: '충(沖)',
            description: `일지와 ${loc}이 충하여 변화와 갈등의 에너지가 있습니다. 때로는 큰 변환점이 됩니다.`,
            location: loc,
          });
          break;
        }
      }
    }
  }

  return result;
}

// ============================================================
// 텍스트 생성
// ============================================================
const PERSONALITY_BY_ELEMENT: Record<Element, string> = {
  wood: '목(木)의 기운이 강한 당신은 성장과 발전을 추구합니다. 인자하고 포용력이 넓으며, 새로운 것에 도전하는 것을 즐깁니다. 리더십이 있고 정의감이 강하지만, 때로는 고집이 센 면도 있습니다.',
  fire: '화(火)의 기운이 강한 당신은 열정적이고 밝은 에너지를 가졌습니다. 사교적이고 표현력이 뛰어나며, 주변에 활력을 불어넣는 존재입니다. 다만 급한 성격과 감정 기복에 주의가 필요합니다.',
  earth: '토(土)의 기운이 강한 당신은 안정적이고 신뢰감을 줍니다. 성실하고 책임감이 강하며, 주변 사람들을 편안하게 만드는 힘이 있습니다. 변화를 두려워하는 면이 있으므로 유연성을 기르면 좋겠습니다.',
  metal: '금(金)의 기운이 강한 당신은 결단력이 있고 원칙적입니다. 정리정돈을 잘하고 효율적으로 일하며, 정의로운 판단을 합니다. 다소 냉정하게 보일 수 있으므로 감정 표현을 더 해보세요.',
  water: '수(水)의 기운이 강한 당신은 지혜롭고 통찰력이 뛰어납니다. 유연하게 상황에 적응하고, 깊은 사고력을 가졌습니다. 우유부단해 보일 수 있으므로 확신을 가지고 결정하는 연습이 필요합니다.',
};

const ROMANCE_BY_ELEMENT: Record<Element, string> = {
  wood: '연애에서 따뜻하고 배려심 깊은 파트너입니다. 상대를 성장시키려는 본능이 있어 멘토 같은 연인이 될 수 있습니다.',
  fire: '연애에서 적극적이고 로맨틱한 타입입니다. 강렬한 감정을 표현하고 상대를 뜨겁게 사랑합니다.',
  earth: '연애에서 안정감과 든든함을 주는 타입입니다. 변하지 않는 진심으로 상대를 대하며, 장기적인 관계를 선호합니다.',
  metal: '연애에서 한결같고 책임감 있는 파트너입니다. 한번 마음을 주면 쉽게 변하지 않으며, 실질적인 사랑을 합니다.',
  water: '연애에서 감성적이고 상대의 마음을 잘 읽는 타입입니다. 깊은 교감을 중시하며, 상대에게 맞춰주는 포용력이 있습니다.',
};

const WEALTH_BY_ELEMENT: Record<Element, string> = {
  wood: '재물운은 꾸준한 성장형입니다. 시간을 두고 자산을 늘려가는 타입이며, 장기적인 안목이 뛰어납니다.',
  fire: '재물운은 역동적인 편입니다. 큰 기회를 포착하는 눈이 있으나, 충동적 지출에 주의가 필요합니다.',
  earth: '재물운은 안정적이고 꾸준합니다. 저축과 부동산에 인연이 있으며, 착실하게 재산을 모아가는 타입입니다.',
  metal: '재물운은 뚜렷한 편입니다. 목표를 정하면 효율적으로 자산을 관리하며, 전문 분야에서 높은 수입을 올립니다.',
  water: '재물운은 유동적입니다. 다양한 경로로 수입이 들어오며, 재테크 감각이 뛰어납니다.',
};

const HEALTH_BY_ELEMENT: Record<Element, string> = {
  wood: '간(肝)과 담(膽)에 주의가 필요합니다. 스트레스를 잘 관리하고, 눈 건강에 신경 쓰세요.',
  fire: '심장과 소장에 주의가 필요합니다. 과로와 수면 부족을 피하고, 규칙적인 운동으로 에너지를 조절하세요.',
  earth: '비위(脾胃) 건강에 주의가 필요합니다. 과식을 피하고 규칙적인 식사 습관을 유지하세요.',
  metal: '폐(肺)와 대장 건강에 주의가 필요합니다. 호흡기 관리에 신경 쓰고, 맑은 공기를 자주 마시세요.',
  water: '신장(腎臟)과 방광 건강에 주의가 필요합니다. 충분한 수분 섭취와 하체 운동이 중요합니다.',
};

/**
 * 사주 리포트를 생성한다.
 */
export function generateReport(pillars: FourPillars): SajuReport {
  const elementScores = calculateElementScores(pillars);
  const dominantElement = getDominantElement(elementScores);
  const yongshin = estimateYongshin(pillars, elementScores);
  const tenGods = calculateTenGods(pillars);
  const pillarTenGods = calculatePillarTenGods(pillars);
  const tenGodDistribution = calculateTenGodDistribution(pillars);
  const gyeokguk = determineGyeokGuk(pillars);
  const shinSalList = detectShinSal(pillars);

  const tenGodsRecord: Record<string, string> = {
    yearStem: tenGods.yearStem,
    monthStem: tenGods.monthStem,
  };
  if (tenGods.hourStem) {
    tenGodsRecord.hourStem = tenGods.hourStem;
  }

  return {
    pillars,
    elementScores,
    dominantElement,
    yongshin,
    tenGods: tenGodsRecord as Record<string, any>,
    pillarTenGods,
    tenGodDistribution,
    gyeokguk,
    shinSalList,
    personality: PERSONALITY_BY_ELEMENT[dominantElement],
    romance: ROMANCE_BY_ELEMENT[dominantElement],
    wealth: WEALTH_BY_ELEMENT[dominantElement],
    health: HEALTH_BY_ELEMENT[dominantElement],
  };
}
