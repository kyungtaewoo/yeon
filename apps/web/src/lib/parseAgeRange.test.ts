import { describe, it, expect } from 'vitest';
import { parseAgeRange } from './parseAgeRange';

describe('parseAgeRange', () => {
  // 1
  it('"만 25~35세" → { ageMin: 25, ageMax: 35 }', () => {
    expect(parseAgeRange('만 25~35세')).toEqual({ ageMin: 25, ageMax: 35 });
  });

  // 2
  it('"만 30세" → { ageMin: 30, ageMax: 30 }', () => {
    expect(parseAgeRange('만 30세')).toEqual({ ageMin: 30, ageMax: 30 });
  });

  // 3
  it('"25~35" (만/세 생략) → { ageMin: 25, ageMax: 35 }', () => {
    expect(parseAgeRange('25~35')).toEqual({ ageMin: 25, ageMax: 35 });
  });

  // 4
  it('"" → null', () => {
    expect(parseAgeRange('')).toBeNull();
  });

  // 5
  it('"abc" → null', () => {
    expect(parseAgeRange('abc')).toBeNull();
  });

  // 6 — 음수
  it('"만 -5~10세" → null', () => {
    expect(parseAgeRange('만 -5~10세')).toBeNull();
  });

  // 7 — 상한 초과
  it('"만 25~150세" → null (120 초과)', () => {
    expect(parseAgeRange('만 25~150세')).toBeNull();
  });

  // 8 — 역전
  it('"만 35~25세" → null (역전)', () => {
    expect(parseAgeRange('만 35~25세')).toBeNull();
  });

  // 9 — 변형 구분자
  it('"25-35" (하이픈) → { ageMin: 25, ageMax: 35 }', () => {
    expect(parseAgeRange('25-35')).toEqual({ ageMin: 25, ageMax: 35 });
  });
  it('"25 - 35" (공백 포함) → { ageMin: 25, ageMax: 35 }', () => {
    expect(parseAgeRange('25 - 35')).toEqual({ ageMin: 25, ageMax: 35 });
  });

  // 추가 엣지
  it('null/undefined → null', () => {
    expect(parseAgeRange(null)).toBeNull();
    expect(parseAgeRange(undefined)).toBeNull();
  });

  it('단일 숫자 "30" → { ageMin: 30, ageMax: 30 }', () => {
    expect(parseAgeRange('30')).toEqual({ ageMin: 30, ageMax: 30 });
  });

  it('경계값 "만 0~120세" → 통과', () => {
    expect(parseAgeRange('만 0~120세')).toEqual({ ageMin: 0, ageMax: 120 });
  });

  it('경계값 +1 "만 0~121세" → null', () => {
    expect(parseAgeRange('만 0~121세')).toBeNull();
  });
});
