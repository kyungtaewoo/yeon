import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 토스페이먼츠 웹훅 수신 API
 * 결제 상태 변경 시 토스에서 호출한다.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { eventType, data } = body;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  switch (eventType) {
    case 'PAYMENT_STATUS_CHANGED': {
      const { paymentKey, status, orderId } = data;

      if (status === 'CANCELED' || status === 'EXPIRED' || status === 'ABORTED') {
        // 결제 취소/만료 처리
        await supabase
          .from('payments')
          .update({ status: status === 'CANCELED' ? 'canceled' : 'failed' })
          .eq('order_id', orderId);
      }

      break;
    }

    case 'DEPOSIT_CALLBACK': {
      // 가상계좌 입금 확인
      const { paymentKey, orderId, status } = data;

      if (status === 'DONE') {
        await supabase
          .from('payments')
          .update({
            status: 'done',
            payment_key: paymentKey,
            paid_at: new Date().toISOString(),
          })
          .eq('order_id', orderId);
      }

      break;
    }
  }

  // 웹훅은 항상 200 응답
  return NextResponse.json({ success: true });
}
