import { NextResponse } from 'next/server';
import { calculatePillars } from '@/lib/saju/pillars';
import { generateReport } from '@/lib/saju/report';

export async function POST(request: Request) {
  const body = await request.json();
  const { year, month, day, hour, isLunar } = body;

  if (!year || !month || !day) {
    return NextResponse.json({ error: '생년월일은 필수입니다' }, { status: 400 });
  }

  const pillars = calculatePillars({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: hour != null ? Number(hour) : null,
    isLunar: Boolean(isLunar),
  });

  const report = generateReport(pillars);

  return NextResponse.json({ report });
}
