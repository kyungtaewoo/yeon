import { NextResponse } from 'next/server';
import { calculatePillars } from '@/lib/saju/pillars';
import { calculateGeneralCompatibility } from '@/lib/saju/compatibility-general';
import { calculateRomanticCompatibility } from '@/lib/saju/compatibility-romantic';
import { calculateDeepCompatibility } from '@/lib/saju/compatibility-deep';
import type { FourPillars } from '@/lib/saju/types';

interface CalculateRequest {
  // 유저 A (나) 사주 입력
  userA: { year: number; month: number; day: number; hour?: number | null; isLunar?: boolean };
  // 유저 B (친구) 사주 입력
  userB: { year: number; month: number; day: number; hour?: number | null; isLunar?: boolean };
  // 프리미엄 여부
  isPremium: boolean;
}

export async function POST(request: Request) {
  const body: CalculateRequest = await request.json();
  const { userA, userB, isPremium } = body;

  if (!userA || !userB) {
    return NextResponse.json({ error: '양쪽 사주 정보가 필요합니다' }, { status: 400 });
  }

  const pillarsA = calculatePillars({
    year: userA.year, month: userA.month, day: userA.day,
    hour: userA.hour, isLunar: userA.isLunar,
  });
  const pillarsB = calculatePillars({
    year: userB.year, month: userB.month, day: userB.day,
    hour: userB.hour, isLunar: userB.isLunar,
  });

  // 1단계: 일반 궁합 (항상 반환)
  const general = calculateGeneralCompatibility(pillarsA, pillarsB);

  // 2단계: 연인 궁합
  const romanticFull = calculateRomanticCompatibility(pillarsA, pillarsB);

  // 3단계: 깊은 궁합
  const deepFull = calculateDeepCompatibility(pillarsA, pillarsB);

  return NextResponse.json({
    general: {
      score: general.totalScore,
      breakdown: general.breakdown,
      narrative: general.narrative,
      factors: general.factors,
    },
    romantic: {
      score: romanticFull.totalScore,
      isLocked: !isPremium,
      breakdown: isPremium ? romanticFull.breakdown : null,
      narrative: isPremium ? romanticFull.narrative : null,
      marriageScore: isPremium ? romanticFull.marriageScore : null,
      styleScore: isPremium ? romanticFull.styleScore : null,
      factors: isPremium ? romanticFull.factors : null,
      preview: { dayGanMatch: romanticFull.preview.dayGanMatch },
    },
    deep: {
      score: deepFull.totalScore,
      isLocked: !isPremium,
      breakdown: isPremium ? deepFull.breakdown : null,
      narrative: isPremium ? deepFull.narrative : null,
      factors: isPremium ? deepFull.factors : null,
      preview: {
        innerHarmony: Math.round(deepFull.breakdown.unconscious / 20),
      },
    },
  });
}
