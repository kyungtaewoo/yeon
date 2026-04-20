# 緣(연) — 역방향 매칭 엔진 고도화
## Full Four-Pillar Reverse Matching v2.0

---

## 1. 기존 vs 고도화 비교

| 항목 | v1 (기존) | v2 (고도화) |
|------|-----------|-------------|
| 매칭 기준 | 일주(日柱) 60가지만 비교 | **전체 사주팔자(4기둥 8글자)** 완전 비교 |
| 나이 범위 | 없음 (전체 대상) | **유저 설정 나이대** (예: 27~33세) |
| 탐색 방식 | 60간지 추상 조합 → 역변환 | **실제 날짜 전수 탐색** → 사주 산출 → 궁합 |
| 궁합 정밀도 | 일간 합충 + 오행 기초 | **연주·월주·일주·시주 모든 간지 간 상호작용** |
| 결과 형태 | "이상적 일주 Top 10" | **"이상적 생년월일시 Top N" (실제 날짜)** |
| 연산량 | 60회 | ~43,800회 (10년 × 365일 × 12시) |
| 소요 시간 | <10ms | **<500ms** (충분히 실시간) |

---

## 2. 핵심 인사이트: 왜 전수 탐색이 가능한가

### 사주는 날짜+시간의 함수

```
f(양력 날짜, 출생 시간) → 사주팔자(연주, 월주, 일주, 시주)
```

이 함수는 **결정론적(deterministic)**입니다.
- 연주: 입춘 기준 60갑자 순환 (연도로 결정)
- 월주: 절기 기준 + 연간(年干)으로 결정
- 일주: 만세력 일진표로 결정 (60일 주기)
- 시주: 출생 시간 + 일간(日干)으로 결정

따라서 **나이 범위 내의 모든 날짜 × 12시간대를 열거**하면,
가능한 모든 사주 조합을 빠짐없이 탐색할 수 있습니다.

### 연산량 계산

```
나이 범위 10년 기준:
  날짜 수: 10 × 365.25 = 3,652일
  시간대: 12 (자·축·인·묘·진·사·오·미·신·유·술·해)
  총 조합: 3,652 × 12 = 43,824
  
  각 조합당 궁합 계산: O(1) — 룩업 테이블 기반
  총 연산: ~44,000 × O(1) = 수십 ms

  ∴ 클라이언트 사이드에서도 충분히 실시간 가능
```

---

## 3. 알고리즘 설계

### 3.1 전체 흐름

```
Input:
  - mySaju: FourPillars          (내 사주)
  - myGender: 'male' | 'female'  (내 성별)
  - weights: CompatibilityWeights (궁합 선호 가중치)
  - ageRange: { min: number, max: number }  (상대 나이 범위, 만 나이)
  - topN: number                 (결과 수, 기본 10)

Process:
  1. 나이 범위 → 출생연도 범위 변환
     - 현재 2026년 기준, 만 27~33세 → 1993~1999년생
     
  2. 출생연도 범위 내 모든 날짜 열거
     - startDate: 1993-01-01
     - endDate:   1999-12-31
     - 총 ~2,557일
  
  3. 각 날짜 × 12시간대에 대해:
     a. manseryeok 라이브러리로 사주팔자 산출
     b. 내 사주와의 전체 궁합 점수 계산 (v2 알고리즘)
     c. 가중치 적용 총점 산출
     d. 힙(heap)에 Top N 유지
  
  4. Top N 결과를 점수 내림차순 정렬
  
  5. 동일/유사 사주 그룹핑
     - 같은 일주+시주를 가진 날짜들을 묶어서 표시
     - "이 사주를 가진 생일: 1993.03.15, 1993.05.14, 1995.07.23..."

Output:
  IdealMatchProfile[] — Top N개의 이상적 상대 프로파일
```

### 3.2 궁합 점수 계산 v2 (Full Four-Pillar)

```typescript
// lib/saju/compatibility-v2.ts

interface FullCompatibilityInput {
  sajuA: FourPillars;   // 나
  sajuB: FourPillars;   // 상대
  genderA: Gender;
  genderB: Gender;
  weights: CompatibilityWeights;
}

interface FullCompatibilityResult {
  totalScore: number;          // 0~100 가중 합산
  breakdown: {
    romance: number;           // 연애 궁합
    marriage: number;          // 결혼 궁합
    wealth: number;            // 재물 궁합
    children: number;          // 자녀 궁합
    health: number;            // 건강 궁합
    personality: number;       // 성격 궁합
  };
  detailFactors: DetailFactor[];  // 점수에 기여한 세부 요인들
}
```

### 3.3 궁합 항목별 v2 계산 (4기둥 전체 활용)

```
══════════════════════════════════════════════════════════════
[연애 궁합] — 감정적 교류, 끌림, 연애 호환성
══════════════════════════════════════════════════════════════

● 일간(日干) 합(合) — 가장 중요한 궁합 지표           +25점
  甲己合(토), 乙庚合(금), 丙辛合(수), 丁壬合(목), 戊癸合(화)
  → 내 일간과 상대 일간이 합이면 최고의 끌림

● 일지(日支) 육합(六合)                               +15점
  子丑合, 寅亥合, 卯戌合, 辰酉合, 巳申合, 午未合
  → 배우자궁끼리의 합 = 정서적 결합

● 일지 삼합(三合) — 같은 삼합 국에 속하는지            +10점
  申子辰(수), 寅午戌(화), 巳酉丑(금), 亥卯未(목)

● 연지(年支) 합 관계                                   +8점
  → 집안/가문 차원의 조화

● 월지(月支) 합 관계                                   +8점
  → 사회적 성향의 조화

● 도화살(桃花殺) 상호 관계                             +7점
  일지 기준 도화: 子→酉, 丑→午, 寅→卯, 卯→子...
  → 상대 사주에 내 도화가 있으면 본능적 끌림

● 일간 충(沖) — 감점 요소                             -15점
  甲庚沖, 乙辛沖, 丙壬沖, 丁癸沖
  → 근본적 성향 충돌

● 일지 충(沖)                                         -12점
  子午沖, 丑未沖, 寅申沖, 卯酉沖, 辰戌沖, 巳亥沖
  → 배우자궁 충돌 = 가정 불안

● 일지 형(刑)                                         -8점
  자형(自刑), 무은지형, 무례지형, 형벌지형

기본점수 50점 + 가감 = 최종 연애 궁합 (0~100 클램프)


══════════════════════════════════════════════════════════════
[결혼 궁합] — 장기 안정성, 가정 구성, 배우자운
══════════════════════════════════════════════════════════════

● 일지(배우자궁) 합                                    +20점
  → 육합 +20, 삼합 +12, 방합 +10

● 관성(官星) 안정도                                    +15점
  여: 상대 일간이 내 정관(正官)이면 +15, 편관 +8
  남: 상대 일간이 내 정재(正財)이면 +15, 편재 +8
  → 전통 명리학에서 가장 중요한 배우자 지표

● 연주(年柱) 상호 합                                   +12점
  연간 합 +7, 연지 합 +5
  → 가문/환경적 조화

● 월주(月柱) 상호 합                                   +10점
  월간 합 +5, 월지 합 +5
  → 사회적 지위/생활 패턴 조화

● 사주 전체 지지 삼합/방합 형성                         +10점
  내 사주 지지 + 상대 사주 지지에서 삼합/방합이 완성되면 가산

● 형충파해(刑沖破害) 감점
  일지 충 -15, 연지 충 -8, 월지 충 -5
  형(刑) -10, 파(破) -5, 해(害) -5

기본점수 50점 + 가감


══════════════════════════════════════════════════════════════
[재물 궁합] — 경제적 시너지
══════════════════════════════════════════════════════════════

● 재성(財星) 상호 보완                                  +20점
  내 사주에 재성 약 + 상대가 재성 강 (또는 반대) → 보완
  양쪽 모두 재성 강 → +15 (시너지)

● 오행 상생 흐름 (재물 방향)                            +15점
  내 일간 → 상대 재성까지 상생 흐름이 이어지면 가산
  예: 내가 木일간, 상대 사주에 火→土(재성) 흐름 = 상생

● 식상생재(食傷生財) 구조                               +12점
  합쳐서 식상 → 재성 흐름이 완성되면 함께 돈을 벌 구조

● 재성 충극 관계                                       -12점
  내 재성을 상대의 비겁이 극하면 감점 (재물 소모)

기본점수 50점 + 가감


══════════════════════════════════════════════════════════════
[자녀 궁합] — 자녀운 호환, 양육 조화
══════════════════════════════════════════════════════════════

● 시주(時柱) 합 관계                                    +20점
  시간 합 +10, 시지 합 +10
  → 시주 = 자녀궁, 합이면 자녀운 호환

● 식상(食傷) 배치 호환                                  +15점
  양쪽 식상이 균형 있게 분포 → 양육 스타일 조화

● 시주 충(沖)                                          -15점
  자녀궁 충돌 = 자녀 관련 갈등

● 시주와 일주의 관계                                    +10점
  상대 시주가 내 일주와 상생 관계면 가산

기본점수 50점 + 가감


══════════════════════════════════════════════════════════════
[건강 궁합] — 오행 밸런스 상호 보완
══════════════════════════════════════════════════════════════

● 오행 과불급 보완도                                    +25점
  내 사주에서 부족한 오행을 상대가 보충해주는 정도
  계산: 양쪽 오행 분포를 합산했을 때 균형도 측정
  균형도 = 1 - (표준편차 / 최대 표준편차)
  균형도 × 25 = 점수

● 오행 상극 최소화                                      +15점
  합친 사주에서 상극 관계가 적을수록 가산

● 용신(用神) 상호 보완                                  +10점
  내 용신 오행을 상대가 많이 보유 (또는 반대)

기본점수 50점 + 가감


══════════════════════════════════════════════════════════════
[성격 궁합] — 소통, 가치관, 일상 호환
══════════════════════════════════════════════════════════════

● 십성(十星) 배치 상성                                  +20점
  내 일간 기준 상대 사주 글자들의 십성 분포 분석
  정관+정인 많으면 안정적 관계 +15
  식신+정재 많으면 실용적 관계 +12
  편관+편인 많으면 역동적 관계 +10
  상관+겁재 많으면 도전적 관계 +5 (갈등 가능)

● 격국(格局) 호환성                                     +15점
  상호 보완적 격국 조합에 가산
  예: 식신격 + 정관격 = 조화로운 관계 (+15)
      편관격 + 편관격 = 충돌 가능 (+3)

● 음양 밸런스                                           +8점
  일간 음양이 반대면 +8 (甲♀ + 乙♂ 등)
  → 음양 조화가 관계의 기본

● 월지(月支) — 사회적 성향 비교                         +7점
  같은 계절 → +3 (비슷한 성향)
  상생 계절 → +7 (보완적 성향)
  상극 계절 → +0

기본점수 50점 + 가감
```

---

## 4. 데이터 구조 & 타입 (v2)

```typescript
// lib/saju/types-v2.ts

// 나이 범위 설정
interface AgeRange {
  min: number;    // 최소 만 나이 (예: 25)
  max: number;    // 최대 만 나이 (예: 35)
}

// 전수 탐색 결과 단일 항목
interface DateSajuScore {
  date: string;              // "1995-03-15"
  hour: number;              // 0~11 (자시~해시)
  hourLabel: string;         // "묘시(05~07시)"
  pillars: FourPillars;      // 해당 날짜+시간의 사주
  totalScore: number;        // 가중 합산 궁합 점수
  breakdown: CompatibilityBreakdown;
}

// 그룹핑된 결과 (같은 사주를 가진 날짜들을 묶음)
interface IdealMatchProfileV2 {
  rank: number;
  
  // 사주 프로파일
  pillars: FourPillars;       // 완전한 사주팔자 (4기둥 8글자)
  pillarLabels: {
    year: string;             // "갑술(甲戌)"
    month: string;            // "정묘(丁卯)"
    day: string;              // "병인(丙寅)"
    hour: string;             // "경인(庚寅)"
  };
  
  // 궁합 점수
  totalScore: number;
  breakdown: CompatibilityBreakdown;
  
  // 이 사주를 가진 실제 생년월일시 목록
  matchingDates: {
    date: string;             // "1995-03-15"
    dayOfWeek: string;        // "수요일"
    hour: string;             // "인시(03~05시)"
    lunarDate?: string;       // "음력 2월 15일"
  }[];
  
  // 나이 (현재 기준)
  ageRange: string;           // "만 27~29세"
  
  // 상대 사주 특성 요약
  description: {
    dominantElement: Element;     // 주요 오행
    elementBalance: ElementScore; // 오행 분포
    personality: string;          // "화(火)가 강한 식신격 — 표현력이 풍부하고..."
    yongshin: string;             // 용신
    gyeokguk: string;             // 격국
  };
  
  // 궁합 스토리텔링
  narrative: {
    summary: string;              // "두 분은 천생연분 급의 궁합입니다"
    synergies: string[];          // ["일간 합(甲己合)으로 자연스러운 끌림", ...]
    cautions: string[];           // ["월지 충이 있어 사회활동에서 의견 충돌 가능", ...]
    advice: string;               // "서로의 다른 점을 존중하면..."
  };
  
  // 매칭 가능 여부
  hasExistingUser: boolean;       // 이 사주를 가진 가입자 존재 여부
  waitingCount: number;           // 대기 중인 유저 수
}

// 오행 점수
interface ElementScore {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
}
```

---

## 5. 구현 코드 (핵심)

### 5.1 전수 탐색 엔진

```typescript
// lib/saju/reverseMatch-v2.ts

import { Solar } from 'lunar-javascript';

interface ReverseMatchInput {
  mySaju: FourPillars;
  myGender: Gender;
  targetGender: Gender;
  weights: CompatibilityWeights;
  ageRange: AgeRange;
  topN: number;
}

export function findIdealMatches(input: ReverseMatchInput): IdealMatchProfileV2[] {
  const { mySaju, myGender, targetGender, weights, ageRange, topN } = input;
  
  // 1. 나이 범위 → 출생연도 범위
  const currentYear = new Date().getFullYear(); // 2026
  const birthYearStart = currentYear - ageRange.max; // 예: 2026 - 33 = 1993
  const birthYearEnd = currentYear - ageRange.min;   // 예: 2026 - 27 = 1999
  
  // 2. MinHeap으로 Top N 유지 (메모리 효율)
  const heap = new MinHeap<DateSajuScore>(topN, (a, b) => a.totalScore - b.totalScore);
  
  // 3. 전수 탐색
  for (let year = birthYearStart; year <= birthYearEnd; year++) {
    for (let month = 1; month <= 12; month++) {
      const daysInMonth = new Date(year, month, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        for (let hour = 0; hour < 12; hour++) {
          // 3a. 만세력으로 사주 산출
          const solar = Solar.fromYmdHms(year, month, day, hour * 2 + 1, 0, 0);
          const lunar = solar.getLunar();
          const bazi = lunar.getEightChar(); // 八字 = 사주팔자
          
          const targetSaju: FourPillars = {
            year:  { stem: bazi.getYearGan(), branch: bazi.getYearZhi() },
            month: { stem: bazi.getMonthGan(), branch: bazi.getMonthZhi() },
            day:   { stem: bazi.getDayGan(), branch: bazi.getDayZhi() },
            hour:  { stem: bazi.getTimeGan(), branch: bazi.getTimeZhi() },
          };
          
          // 3b. 전체 궁합 점수 계산
          const result = calculateFullCompatibility({
            sajuA: mySaju,
            sajuB: targetSaju,
            genderA: myGender,
            genderB: targetGender,
            weights,
          });
          
          // 3c. Top N 힙에 삽입
          heap.pushOrReplace({
            date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
            hour,
            hourLabel: HOUR_LABELS[hour],
            pillars: targetSaju,
            totalScore: result.totalScore,
            breakdown: result.breakdown,
          });
        }
      }
    }
  }
  
  // 4. 결과 추출 & 그룹핑
  const rawResults = heap.extractAll().sort((a, b) => b.totalScore - a.totalScore);
  return groupBySaju(rawResults, mySaju);
}

// 같은 사주(4기둥 동일)를 가진 날짜들을 그룹핑
function groupBySaju(results: DateSajuScore[], mySaju: FourPillars): IdealMatchProfileV2[] {
  const groups = new Map<string, DateSajuScore[]>();
  
  for (const r of results) {
    const key = sajuToKey(r.pillars); // "甲子-丁卯-丙寅-庚寅"
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  
  return Array.from(groups.entries())
    .map(([key, items], idx) => ({
      rank: idx + 1,
      pillars: items[0].pillars,
      totalScore: items[0].totalScore,
      breakdown: items[0].breakdown,
      matchingDates: items.map(i => ({
        date: i.date,
        dayOfWeek: getDayOfWeek(i.date),
        hour: i.hourLabel,
      })),
      // ... description, narrative 생성
    }))
    .slice(0, 10);
}
```

### 5.2 성능 최적화 전략

```typescript
// lib/saju/optimization.ts

/**
 * 최적화 1: 일주 사전 필터링 (Early Pruning)
 * 
 * 일간(日干) 합/충 관계로 먼저 필터링하면 탐색 공간을 줄일 수 있음.
 * 예: 내 일간이 甲이면, 己(합)인 일주가 포함된 날짜를 우선 탐색.
 * 
 * 하지만 44,000회는 이미 충분히 빠르므로,
 * MVP에서는 전수 탐색 → Phase 2에서 캐싱 최적화 권장.
 */

/**
 * 최적화 2: 사주 테이블 사전 계산 (Pre-computation)
 * 
 * 서버 시작 시 또는 빌드 타임에:
 * 1970~2010년의 모든 날짜에 대한 사주를 미리 계산하여 Map에 저장.
 * 
 * Map<"YYYY-MM-DD", { yearPillar, monthPillar, dayPillar }>
 * 
 * 시주만 런타임에 12개 계산하면 됨.
 * → 탐색 시간 70% 감소
 */
export function precomputeSajuTable(startYear: number, endYear: number) {
  const table = new Map<string, Omit<FourPillars, 'hour'>>();
  
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const days = new Date(year, month, 0).getDate();
      for (let day = 1; day <= days; day++) {
        const solar = Solar.fromYmd(year, month, day);
        const lunar = solar.getLunar();
        const bazi = lunar.getEightChar();
        
        table.set(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`, {
          year: { stem: bazi.getYearGan(), branch: bazi.getYearZhi() },
          month: { stem: bazi.getMonthGan(), branch: bazi.getMonthZhi() },
          day: { stem: bazi.getDayGan(), branch: bazi.getDayZhi() },
        });
      }
    }
  }
  
  return table; // ~14,600 entries for 40 years
}

/**
 * 최적화 3: 궁합 점수 캐싱
 * 
 * 같은 일주를 가진 날짜들은 일주 관련 점수가 동일하므로,
 * 일주별 부분 점수를 캐싱하면 중복 계산을 줄일 수 있음.
 * 
 * 60일 주기이므로, 7년 범위 내 같은 일주가 ~42회 반복.
 * → 캐싱으로 ~40배 연산 절감 (일주 관련 항목에 한해)
 */
const dayPillarScoreCache = new Map<string, Partial<CompatibilityBreakdown>>();


/**
 * 최적화 4: Web Worker (프론트엔드)
 * 
 * 44,000회 연산이 메인 스레드를 블로킹하지 않도록
 * Web Worker에서 실행.
 * 
 * 진행률을 postMessage로 UI에 전달 → "운명의 실을 풀어보는 중... 47%"
 */
```

### 5.3 가중 합산 총점 계산

```typescript
// lib/saju/compatibility-v2.ts

function calculateWeightedTotal(
  breakdown: CompatibilityBreakdown,
  weights: CompatibilityWeights
): number {
  // 가중치 정규화 (합이 1이 되도록)
  const totalWeight = 
    weights.romance + weights.marriage + weights.wealth +
    weights.children + weights.health + weights.personality;
  
  if (totalWeight === 0) return 50; // 모든 가중치가 0이면 기본점수
  
  const normalized = {
    romance: weights.romance / totalWeight,
    marriage: weights.marriage / totalWeight,
    wealth: weights.wealth / totalWeight,
    children: weights.children / totalWeight,
    health: weights.health / totalWeight,
    personality: weights.personality / totalWeight,
  };
  
  return Math.round(
    breakdown.romance * normalized.romance +
    breakdown.marriage * normalized.marriage +
    breakdown.wealth * normalized.wealth +
    breakdown.children * normalized.children +
    breakdown.health * normalized.health +
    breakdown.personality * normalized.personality
  );
}
```

---

## 6. DB 스키마 변경

```sql
-- ============================================================
-- 003_ideal_saju_v2.sql
-- ============================================================

-- 기존 ideal_saju_profiles 테이블을 v2로 대체

-- v2: 전체 사주 + 실제 생년월일시 + 나이 범위
ALTER TABLE ideal_saju_profiles 
  ADD COLUMN IF NOT EXISTS target_year_stem_v2 TEXT,
  ADD COLUMN IF NOT EXISTS target_year_branch_v2 TEXT,
  ADD COLUMN IF NOT EXISTS target_month_stem_v2 TEXT,
  ADD COLUMN IF NOT EXISTS target_month_branch_v2 TEXT,
  ADD COLUMN IF NOT EXISTS target_hour_stem_v2 TEXT,
  ADD COLUMN IF NOT EXISTS target_hour_branch_v2 TEXT,
  ADD COLUMN IF NOT EXISTS matching_dates JSONB,          -- 이 사주를 가진 실제 날짜 목록
  ADD COLUMN IF NOT EXISTS age_range_min INT,
  ADD COLUMN IF NOT EXISTS age_range_max INT,
  ADD COLUMN IF NOT EXISTS target_description JSONB,      -- 상대 사주 특성 요약
  ADD COLUMN IF NOT EXISTS narrative JSONB,                -- 궁합 스토리텔링
  ADD COLUMN IF NOT EXISTS algorithm_version TEXT DEFAULT 'v2';

-- 나이 범위 설정 (profiles 테이블에 추가)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_age_min INT DEFAULT 25,
  ADD COLUMN IF NOT EXISTS preferred_age_max INT DEFAULT 35;

-- 매칭 탐색 인덱스: 전체 사주 기준
CREATE INDEX IF NOT EXISTS idx_saju_full_v2 ON saju_profiles(
  day_stem, day_branch, 
  month_stem, month_branch,
  year_stem, year_branch,
  hour_stem, hour_branch
);

-- 프로필 나이 범위 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_birth ON profiles(birth_date);
```

---

## 7. 매칭 트리거 로직 v2

```typescript
// 신규 가입자의 사주가 기존 유저의 ideal_saju_profiles에 매칭되는지 확인

async function checkMatchOnNewUser(newUserSaju: SajuProfile) {
  // 새 유저의 전체 사주로 기존 ideal 프로파일 검색
  const { data: potentialMatches } = await supabase
    .from('ideal_saju_profiles')
    .select('*, profiles!user_id(*)')
    .eq('target_day_stem', newUserSaju.day_stem)
    .eq('target_day_branch', newUserSaju.day_branch)
    .eq('target_month_stem_v2', newUserSaju.month_stem)
    .eq('target_month_branch_v2', newUserSaju.month_branch)
    // 연주는 나이 범위 내에서 여러 개가 가능하므로 별도 체크
    .eq('is_matched', false)
    .eq('algorithm_version', 'v2');

  for (const ideal of potentialMatches || []) {
    // 연주/시주까지 정확히 매칭되는지 확인
    const isFullMatch = 
      ideal.target_year_stem_v2 === newUserSaju.year_stem &&
      ideal.target_year_branch_v2 === newUserSaju.year_branch &&
      (ideal.target_hour_stem_v2 === newUserSaju.hour_stem || !newUserSaju.hour_stem);

    if (isFullMatch) {
      // 나이 범위 체크
      const birthYear = new Date(ideal.profiles.birth_date).getFullYear();
      if (birthYear >= ideal.age_range_min_year && birthYear <= ideal.age_range_max_year) {
        await createMatch(ideal.user_id, newUserSaju.user_id, ideal.id);
      }
    }
  }
}
```

---

## 8. UI 변경사항

### 온보딩 — 나이 범위 설정 (신규 화면)

궁합 선호도 설정 화면에 **나이 범위 슬라이더** 추가:

```
┌─────────────────────────────────────┐
│                                     │
│  상대방 나이 범위                    │
│                                     │
│  ○────────●━━━━━━━━━●────────○      │
│  20      27         33       40     │
│                                     │
│  27세 ~ 33세 (1993 ~ 1999년생)      │
│                                     │
└─────────────────────────────────────┘
```

### 이상적 상대 사주 결과 (개선)

```
┌─────────────────────────────────────┐
│  🥇 1위 — 궁합 96점                 │
│                                     │
│  ┌──────┬──────┬──────┬──────┐     │
│  │ 시주 │ 일주 │ 월주 │ 연주 │     │
│  │ 庚寅 │ 丙寅 │ 丁卯 │ 甲戌 │     │
│  │ 경인 │ 병인 │ 정묘 │ 갑술 │     │
│  └──────┴──────┴──────┴──────┘     │
│                                     │
│  🔥 화(火)가 강한 식신격             │
│  표현력이 풍부하고 따뜻한 성향       │
│                                     │
│  📅 이 사주의 생일:                  │
│     1994.03.15 (만 32세)            │
│     1995.07.23 (만 31세)            │
│                                     │
│  💫 궁합 포인트:                     │
│  • 일간 합(甲己合) — 천생연분급 끌림  │
│  • 오행이 서로 완벽히 보완           │
│  • 자녀궁 삼합 형성                  │
│                                     │
│  👥 현재 1명 대기 중                 │
│                                     │
│  [상세 궁합 리포트 보기]             │
│                                     │
└─────────────────────────────────────┘
```

---

## 9. 사용 라이브러리

### `lunar-javascript` (npm)

이 라이브러리가 사주팔자(八字) 계산을 완벽하게 지원합니다:

```typescript
import { Solar } from 'lunar-javascript';

// 양력 → 사주팔자
const solar = Solar.fromYmdHms(1995, 3, 15, 5, 0, 0);
const lunar = solar.getLunar();
const bazi = lunar.getEightChar();

console.log(`년주: ${bazi.getYear()}`);    // "乙亥"
console.log(`월주: ${bazi.getMonth()}`);   // "己卯"  (절기 기준 자동 적용)
console.log(`일주: ${bazi.getDay()}`);     // "丙寅"
console.log(`시주: ${bazi.getTime()}`);    // "辛卯"

// 개별 천간/지지
console.log(`일간: ${bazi.getDayGan()}`);  // "丙"
console.log(`일지: ${bazi.getDayZhi()}`);  // "寅"
```

**지원 기능:**
- 절기(24절기) 기준 월주 자동 산출
- 입춘 기준 연주 자동 전환
- 경도 보정 (동경 127.5도)
- 1000~2100년 범위 지원
- 오행, 십신, 납음 등 부가 정보

### `@fullstackfamily/manseryeok` (npm)

한국어 특화 만세력 라이브러리 (대안):

```typescript
import { calculateSaju } from '@fullstackfamily/manseryeok';

const saju = calculateSaju(1995, 3, 15, 5, 0, {
  longitude: 127, // 서울 경도
  applyTimeCorrection: true,
});

console.log(`년주: ${saju.yearPillar}`);
console.log(`월주: ${saju.monthPillar}`);
console.log(`일주: ${saju.dayPillar}`);
console.log(`시주: ${saju.hourPillar}`);
```

**권장:** `lunar-javascript`를 메인으로 사용 (안정성·범위 우수), `manseryeok`로 교차 검증.

---

## 10. Cursor 실행 가이드

### Step 1: 라이브러리 교체
```
lunar-javascript 패키지를 설치하고,
기존 lib/saju/manseryeok.ts를 lunar-javascript 기반으로 리팩토링해줘.
Solar.fromYmdHms()로 사주팔자를 산출하도록 변경.
```

### Step 2: 궁합 엔진 v2
```
@FEATURE_REVERSE_MATCH_V2.md의 3.3번 궁합 항목별 계산 로직을 참고해서
lib/saju/compatibility-v2.ts를 새로 구현해줘.
6개 항목 각각에 대해 4기둥 전체를 활용하는 점수 계산 함수를 만들어.
합충형파해 관계 룩업 테이블도 constants.ts에 추가해줘.
```

### Step 3: 전수 탐색 엔진
```
@FEATURE_REVERSE_MATCH_V2.md의 5.1번 코드를 참고해서
lib/saju/reverseMatch-v2.ts를 구현해줘.
나이 범위 내 모든 날짜 × 12시간대를 전수 탐색하고 Top N을 반환.
MinHeap과 결과 그룹핑 로직 포함.
```

### Step 4: 나이 범위 UI
```
온보딩 선호도 페이지에 나이 범위 레인지 슬라이더를 추가해줘.
shadcn/ui Slider를 듀얼 핸들로 사용하고,
선택된 범위에 해당하는 출생연도를 하단에 표시.
profiles 테이블의 preferred_age_min/max에 저장.
```

### Step 5: 결과 페이지 개선
```
이상적 상대 사주 도출 결과 페이지를
@FEATURE_REVERSE_MATCH_V2.md 8번 UI대로 개선해줘.
전체 4기둥 표시, 해당 사주의 실제 생년월일 목록, 궁합 포인트를 카드로 보여줘.
```

### Step 6: DB 마이그레이션 & API 연결
```
@FEATURE_REVERSE_MATCH_V2.md 6번 DB 스키마 변경사항을
supabase/migrations/003_ideal_saju_v2.sql로 생성하고,
API Route도 v2 엔진을 호출하도록 업데이트해줘.
```