import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { confirmPayment, MATCH_PRICE } from '@/lib/payment/toss';

/**
 * 결제 승인 API
 * 토스 결제 위젯에서 결제 성공 후 호출된다.
 * POST body: { paymentKey: string, orderId: string, amount: number }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { paymentKey, orderId, amount } = body;

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
  }

  // 금액 검증
  if (Number(amount) !== MATCH_PRICE) {
    return NextResponse.json({ error: '결제 금액이 일치하지 않습니다' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 주문번호로 결제 레코드 조회
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*, matches(*)')
    .eq('order_id', orderId)
    .single();

  if (paymentError || !payment) {
    return NextResponse.json({ error: '결제 정보를 찾을 수 없습니다' }, { status: 404 });
  }

  if (payment.status === 'done') {
    return NextResponse.json({ error: '이미 승인된 결제입니다' }, { status: 409 });
  }

  // 토스페이먼츠 결제 승인 API 호출
  const result = await confirmPayment({
    paymentKey,
    orderId,
    amount: Number(amount),
  });

  if (!result.success) {
    // 결제 실패 처리
    await supabase
      .from('payments')
      .update({ status: 'failed' })
      .eq('order_id', orderId);

    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // 결제 성공 처리
  await supabase
    .from('payments')
    .update({
      status: 'done',
      payment_key: paymentKey,
      paid_at: new Date().toISOString(),
    })
    .eq('order_id', orderId);

  // 같은 매칭의 양쪽 모두 결제했는지 확인
  const matchId = payment.match_id;
  const { data: allPayments } = await supabase
    .from('payments')
    .select('user_id, status')
    .eq('match_id', matchId)
    .eq('status', 'done');

  // 매칭의 양쪽 사용자 확인
  const { data: match } = await supabase
    .from('matches')
    .select('user_a_id, user_b_id')
    .eq('id', matchId)
    .single();

  if (match && allPayments) {
    const paidUserIds = allPayments.map((p) => p.user_id);
    const bothPaid =
      paidUserIds.includes(match.user_a_id) &&
      paidUserIds.includes(match.user_b_id);

    if (bothPaid) {
      // 쌍방 결제 완료 → 매칭 완료
      await supabase
        .from('matches')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', matchId);
    }
  }

  return NextResponse.json({
    success: true,
    message: '결제가 완료되었습니다',
  });
}
