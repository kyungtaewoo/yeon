"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
          <p className="text-[var(--muted-foreground)]">결제 확인 중...</p>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");
    const token = useAuthStore.getState().token;

    if (!paymentKey || !orderId || !amount) {
      setStatus("error");
      setErrorMessage("결제 정보가 올바르지 않습니다");
      return;
    }
    if (!token) {
      setStatus("error");
      setErrorMessage("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
      return;
    }

    const run = async () => {
      try {
        // 1. 토스 결제 승인
        await apiClient("/payment/confirm", {
          method: "POST",
          token,
          body: { paymentKey, orderId, amount: Number(amount) },
        });
        // 2. 구독 활성화 (User.isPremium=true)
        await apiClient("/payment/subscription", {
          method: "POST",
          token,
          body: { orderId },
        });
        setStatus("success");
      } catch (err: any) {
        console.error("결제 후처리 실패:", err);
        setStatus("error");
        setErrorMessage(err?.message ?? "결제 처리에 실패했습니다");
      }
    };
    run();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-sm border-none shadow-lg">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          {status === "loading" && (
            <>
              <div className="animate-pulse">
                <p className="font-[family-name:var(--font-serif)] text-4xl text-[var(--brand-gold)]">
                  緣
                </p>
              </div>
              <p className="text-[var(--muted-foreground)]">결제 승인 + 구독 활성화 중...</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--element-wood)]/10">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--element-wood)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="font-[family-name:var(--font-serif)] text-xl text-[var(--foreground)]">
                프리미엄 구독이 활성화되었습니다!
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                이제 모든 궁합 리포트와 Top 30 이상형을 확인하실 수 있습니다
              </p>
              <Button
                onClick={() => router.push("/premium")}
                className="w-full bg-[var(--brand-red)] text-white py-5"
              >
                구독 현황 보기
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--element-fire)]/10">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--element-fire)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <h1 className="font-[family-name:var(--font-serif)] text-xl text-[var(--foreground)]">
                결제 승인 실패
              </h1>
              <p className="text-sm text-[var(--element-fire)]">{errorMessage}</p>
              <Button
                onClick={() => router.push("/premium")}
                variant="outline"
                className="w-full py-5"
              >
                프리미엄 페이지로
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
