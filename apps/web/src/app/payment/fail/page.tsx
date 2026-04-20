"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PaymentFailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted-foreground)]">로딩 중...</p>
      </div>
    }>
      <PaymentFailContent />
    </Suspense>
  );
}

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const errorCode = searchParams.get("code") || "UNKNOWN";
  const errorMessage = searchParams.get("message") || "결제에 실패했습니다";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-sm border-none shadow-lg">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--element-fire)]/10">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--element-fire)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h1 className="font-[family-name:var(--font-serif)] text-xl text-[var(--foreground)]">
            결제 실패
          </h1>

          <div className="bg-[var(--muted)] rounded-lg p-3">
            <p className="text-xs text-[var(--muted-foreground)]">오류 코드: {errorCode}</p>
            <p className="text-sm text-[var(--foreground)] mt-1">{errorMessage}</p>
          </div>

          <div className="space-y-2">
            <Button
              onClick={() => router.back()}
              className="w-full bg-[var(--brand-red)] text-white py-5"
            >
              다시 시도하기
            </Button>
            <Button
              onClick={() => router.push("/matches")}
              variant="outline"
              className="w-full py-5"
            >
              매칭으로 돌아가기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
