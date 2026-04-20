"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted-foreground)]">결제 확인 중...</p>
      </div>
    }>
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

    if (!paymentKey || !orderId || !amount) {
      setStatus("error");
      setErrorMessage("결제 정보가 올바르지 않습니다");
      return;
    }

    const confirm = async () => {
      const res = await fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount: Number(amount),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(data.error || "결제 승인에 실패했습니다");
      }
    };

    confirm();
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
              <p className="text-[var(--muted-foreground)]">결제 승인 중...</p>
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
                결제가 완료되었습니다!
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                매칭 상대의 프로필을 확인하실 수 있습니다
              </p>
              <Button
                onClick={() => router.push("/matches")}
                className="w-full bg-[var(--brand-red)] text-white py-5"
              >
                매칭 확인하기
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
                onClick={() => router.push("/matches")}
                variant="outline"
                className="w-full py-5"
              >
                매칭으로 돌아가기
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
