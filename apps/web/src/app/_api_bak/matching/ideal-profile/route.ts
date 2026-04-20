import { NextResponse } from 'next/server';
import { calculatePillars } from '@/lib/saju/pillars';
import { findIdealMatchesV2 } from '@/lib/saju/reverseMatch-v2';
import type { CompatibilityWeights } from '@/lib/saju/types';

export async function POST(request: Request) {
  const body = await request.json();
  const { year, month, day, hour, isLunar, gender, weights, ageRangeMin, ageRangeMax } = body;

  if (!year || !month || !day || !gender || !weights) {
    return NextResponse.json({ error: '필수 입력값이 누락되었습니다' }, { status: 400 });
  }

  const pillars = calculatePillars({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: hour != null ? Number(hour) : null,
    isLunar: Boolean(isLunar),
  });

  const results = findIdealMatchesV2({
    mySaju: pillars,
    weights: weights as CompatibilityWeights,
    ageRange: {
      min: ageRangeMin || 25,
      max: ageRangeMax || 35,
    },
    topN: 10,
  });

  return NextResponse.json({ profiles: results });
}
