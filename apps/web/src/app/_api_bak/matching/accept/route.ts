import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 매칭 수락/거절 API
 * POST body: { matchId: string, userId: string, decision: 'accepted' | 'rejected' }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { matchId, userId, decision } = body;

  if (!matchId || !userId || !decision) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
  }

  if (!['accepted', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'decision은 accepted 또는 rejected여야 합니다' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 매칭 조회
  const { data: match, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (error || !match) {
    return NextResponse.json({ error: '매칭을 찾을 수 없습니다' }, { status: 404 });
  }

  // 만료 체크
  if (match.expires_at && new Date(match.expires_at) < new Date()) {
    await supabase
      .from('matches')
      .update({ status: 'expired' })
      .eq('id', matchId);
    return NextResponse.json({ error: '매칭이 만료되었습니다' }, { status: 410 });
  }

  // 이미 완료/거절/만료된 매칭인지 확인
  if (['completed', 'rejected', 'expired'].includes(match.status)) {
    return NextResponse.json({ error: '이미 종료된 매칭입니다' }, { status: 409 });
  }

  // 사용자가 A인지 B인지 확인
  const isUserA = match.user_a_id === userId;
  const isUserB = match.user_b_id === userId;

  if (!isUserA && !isUserB) {
    return NextResponse.json({ error: '이 매칭의 당사자가 아닙니다' }, { status: 403 });
  }

  // 거절 처리
  if (decision === 'rejected') {
    await supabase
      .from('matches')
      .update({
        status: 'rejected',
        ...(isUserA ? { user_a_decision: 'rejected' } : { user_b_decision: 'rejected' }),
      })
      .eq('id', matchId);

    return NextResponse.json({ status: 'rejected', message: '매칭을 거절했습니다' });
  }

  // 수락 처리
  const updateData: Record<string, string> = {};

  if (isUserA) {
    updateData.user_a_decision = 'accepted';
    // 상대방도 이미 수락했는지 확인
    if (match.user_b_decision === 'accepted') {
      updateData.status = 'both_accepted';
    } else {
      updateData.status = 'a_accepted';
    }
  } else {
    updateData.user_b_decision = 'accepted';
    if (match.user_a_decision === 'accepted') {
      updateData.status = 'both_accepted';
    } else {
      updateData.status = 'b_accepted';
    }
  }

  const { data: updated } = await supabase
    .from('matches')
    .update(updateData)
    .eq('id', matchId)
    .select()
    .single();

  return NextResponse.json({
    status: updated?.status,
    message:
      updated?.status === 'both_accepted'
        ? '쌍방 수락! 결제를 진행해주세요'
        : '수락했습니다. 상대방의 응답을 기다리고 있습니다',
  });
}
