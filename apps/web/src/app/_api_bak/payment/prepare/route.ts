import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateOrderId, MATCH_PRICE } from '@/lib/payment/toss';

/**
 * 결제 준비 API
 * 쌍방 수락된 매칭에 대해 결제를 준비한다.
 * POST body: { matchId: string, userId: string }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { matchId, userId } = body;

  if (!matchId || !userId) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 매칭 확인
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: '매칭을 찾을 수 없습니다' }, { status: 404 });
  }

  // 쌍방 수락 또는 결제 대기 상태인지 확인
  if (!['both_accepted', 'payment_pending'].includes(match.status)) {
    return NextResponse.json(
      { error: '쌍방 수락이 완료된 매칭만 결제할 수 있습니다' },
      { status: 400 }
    );
  }

  // 이 사용자가 이미 결제했는지 확인
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, status')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .single();

  if (existingPayment?.status === 'done') {
    return NextResponse.json({ error: '이미 결제가 완료되었습니다' }, { status: 409 });
  }

  const orderId = generateOrderId(matchId);

  // 기존 미결제 레코드가 있으면 업데이트, 없으면 새로 생성
  if (existingPayment) {
    await supabase
      .from('payments')
      .update({ order_id: orderId, status: 'ready' })
      .eq('id', existingPayment.id);
  } else {
    await supabase.from('payments').insert({
      match_id: matchId,
      user_id: userId,
      amount: MATCH_PRICE,
      order_id: orderId,
      status: 'ready',
    });
  }

  // 매칭 상태를 payment_pending으로 업데이트
  if (match.status === 'both_accepted') {
    await supabase
      .from('matches')
      .update({ status: 'payment_pending' })
      .eq('id', matchId);
  }

  return NextResponse.json({
    orderId,
    amount: MATCH_PRICE,
    orderName: '緣 매칭 프로필 열람권',
    clientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
  });
}
