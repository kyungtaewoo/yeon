/**
 * IdealMatchProfileV2.ageRange 문자열을 백엔드 DTO 의 (ageMin, ageMax) 정수쌍으로
 * 변환. 마이그레이션 best-effort 정책 — 파싱 실패 / 검증 실패는 모두 null.
 *
 * 지원 포맷 (대소문자 / 공백 관대):
 *   "만 25~35세"   → { ageMin: 25, ageMax: 35 }    // reverseMatch-v2.ts:238 출력
 *   "만 30세"      → { ageMin: 30, ageMax: 30 }
 *   "25~35"        → { ageMin: 25, ageMax: 35 }    // 만/세 생략
 *   "25-35"        → { ageMin: 25, ageMax: 35 }    // 하이픈 구분자
 *   "25 - 35"      → { ageMin: 25, ageMax: 35 }    // 공백 포함
 *   "30"           → { ageMin: 30, ageMax: 30 }    // 단일 숫자
 *
 * 검증 (DB CHECK 제약과 동일):
 *   ageMin >= 0 && ageMax <= 120 && ageMin <= ageMax
 */

export interface AgeRange {
  ageMin: number;
  ageMax: number;
}

const MIN_AGE = 0;
const MAX_AGE = 120;

export function parseAgeRange(input: string | null | undefined): AgeRange | null {
  if (input == null || typeof input !== 'string') return null;

  // "만 " prefix, "세" suffix 제거 후 공백 정리
  const cleaned = input.replace(/만/g, '').replace(/세/g, '').trim();
  if (!cleaned) return null;

  // 범위: "N~M" / "N-M" / "N - M" — 음수도 매치 (validate 가 거름)
  const rangeMatch = cleaned.match(/^(-?\d+)\s*[~\-]\s*(-?\d+)$/);
  if (rangeMatch) {
    return validate(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
  }

  // 단일: "N"
  const singleMatch = cleaned.match(/^(-?\d+)$/);
  if (singleMatch) {
    const age = parseInt(singleMatch[1], 10);
    return validate(age, age);
  }

  return null;
}

function validate(ageMin: number, ageMax: number): AgeRange | null {
  if (!Number.isFinite(ageMin) || !Number.isFinite(ageMax)) return null;
  if (ageMin < MIN_AGE) return null;
  if (ageMax > MAX_AGE) return null;
  if (ageMax < ageMin) return null;
  return { ageMin, ageMax };
}
