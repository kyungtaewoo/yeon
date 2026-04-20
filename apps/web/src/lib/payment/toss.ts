/**
 * 토스페이먼츠 서버사이드 유틸리티
 * 결제 승인 API 호출, 주문번호 생성 등
 */

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

/**
 * 토스페이먼츠 결제 승인 API 호출
 */
export async function confirmPayment(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return { success: false, error: 'TOSS_SECRET_KEY가 설정되지 않았습니다' };
  }

  const authorization = Buffer.from(`${secretKey}:`).toString('base64');

  const response = await fetch(`${TOSS_API_URL}/payments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      paymentKey: params.paymentKey,
      orderId: params.orderId,
      amount: params.amount,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.message || '결제 승인에 실패했습니다',
    };
  }

  return { success: true, data };
}

/**
 * 토스페이먼츠 결제 조회 API
 */
export async function getPayment(paymentKey: string): Promise<Record<string, unknown> | null> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) return null;

  const authorization = Buffer.from(`${secretKey}:`).toString('base64');

  const response = await fetch(`${TOSS_API_URL}/payments/${paymentKey}`, {
    headers: {
      Authorization: `Basic ${authorization}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

/**
 * 토스페이먼츠 결제 취소 API
 */
export async function cancelPayment(params: {
  paymentKey: string;
  cancelReason: string;
}): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return { success: false, error: 'TOSS_SECRET_KEY가 설정되지 않았습니다' };
  }

  const authorization = Buffer.from(`${secretKey}:`).toString('base64');

  const response = await fetch(`${TOSS_API_URL}/payments/${params.paymentKey}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cancelReason: params.cancelReason,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    return { success: false, error: data.message || '결제 취소에 실패했습니다' };
  }

  return { success: true };
}

/**
 * 주문번호 생성 (yeon-{matchId}-{timestamp}-{random})
 */
export function generateOrderId(matchId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `yeon-${matchId.substring(0, 8)}-${timestamp}-${random}`;
}

/**
 * 매칭 결제 금액 (원)
 */
export const MATCH_PRICE = 9900;
