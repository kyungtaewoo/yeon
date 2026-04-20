// 천간 (10개)
export type HeavenlyStem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';

// 지지 (12개)
export type EarthlyBranch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';

// 오행
export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

// 십성
export type TenGod = '비견' | '겁재' | '식신' | '상관' | '편재' | '정재' | '편관' | '정관' | '편인' | '정인';

// 기둥 하나
export interface Pillar {
  stem: HeavenlyStem;
  branch: EarthlyBranch;
}

// 사주팔자
export interface FourPillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar | null;
}

// 궁합 선호도 벡터
export interface CompatibilityWeights {
  romance: number;      // 0~100
  marriage: number;
  wealth: number;
  children: number;
  health: number;
  personality: number;
}

// 궁합 항목별 점수
export interface CompatibilityBreakdown {
  romance: number;
  marriage: number;
  wealth: number;
  children: number;
  health: number;
  personality: number;
}

// 궁합 결과
export interface CompatibilityResult {
  totalScore: number;
  breakdown: CompatibilityBreakdown;
  narrative: string;
  synergies: string[];
  cautions: string[];
}

// 이상적 상대 사주 프로파일
export interface IdealSajuProfile {
  rank: number;
  pillars: Partial<FourPillars> & { day: Pillar };
  compatibilityScore: number;
  scoreBreakdown: CompatibilityBreakdown;
  birthYearRange: [number, number];
  description: string;
}

// 오행 점수 맵
export interface ElementScores {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
}

// 십성 그룹 (비겁/식상/재성/관성/인성)
export type TenGodGroup = 'bijob' | 'siksang' | 'jaesung' | 'gwansung' | 'insung';

// 십성 분포
export interface TenGodDistribution {
  bijob: number;    // 비겁 (비견+겁재)
  siksang: number;  // 식상 (식신+상관)
  jaesung: number;  // 재성 (편재+정재)
  gwansung: number; // 관성 (편관+정관)
  insung: number;   // 인성 (편인+정인)
}

// 기둥별 십성 상세
export interface PillarTenGods {
  yearStem: TenGod;
  yearBranch: TenGod[];   // 장간 십성들
  monthStem: TenGod;
  monthBranch: TenGod[];
  dayStem: string;         // 일간은 "나" (본인)
  dayBranch: TenGod[];
  hourStem: TenGod | null;
  hourBranch: TenGod[] | null;
}

// 신살 정보
export interface ShinSal {
  name: string;
  description: string;
  location: string;  // 어느 기둥에 있는지
}

// 격국 정보
export interface GyeokGuk {
  name: string;
  description: string;
}

// 사주 리포트 데이터
export interface SajuReport {
  pillars: FourPillars;
  elementScores: ElementScores;
  dominantElement: Element;
  yongshin: Element;
  tenGods: Record<string, TenGod>;
  pillarTenGods: PillarTenGods;
  tenGodDistribution: TenGodDistribution;
  gyeokguk: GyeokGuk;
  shinSalList: ShinSal[];
  personality: string;
  romance: string;
  wealth: string;
  health: string;
}
