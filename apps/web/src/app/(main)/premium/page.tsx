"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type BillingCycle = "monthly" | "yearly";

interface SubscriptionStatus {
  isPremium: boolean;
  plan: string;
  billingCycle: BillingCycle | null;
  expiresAt: string | null;
  remainingDays: number;
  isActive: boolean;
}

const PLANS: Array<{
  id: BillingCycle;
  name: string;
  priceLabel: string;
  period: string;
  features: string[];
  badge: string | null;
}> = [
  {
    id: "monthly",
    name: "월간 구독",
    priceLabel: "9,900",
    period: "월",
    features: [
      "이상적 상대 Top 30 확장",
      "매칭 우선 노출",
      "궁합 선호도 무제한 재설정",
      "상세 궁합 리포트 (연인/깊은 궁합 포함)",
    ],
    badge: null,
  },
  {
    id: "yearly",
    name: "연간 구독",
    priceLabel: "79,900",
    period: "년",
    features: [
      "월간 구독 혜택 전부 포함",
      "대운/세운 인연 알림",
      "프리미엄 콘텐츠 열람",
      "33% 할인 (월 6,658원)",
    ],
    badge: "BEST",
  },
];

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";

export default function PremiumPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<BillingCycle>("yearly");
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !token) {
      setStatusLoading(false);
      return;
    }
    apiClient<SubscriptionStatus>("/payment/subscription/status", { token })
      .then(setStatus)
      .catch((err) => console.error("구독 상태 조회 실패:", err))
      .finally(() => setStatusLoading(false));
  }, [token, authLoading]);

  const handleSubscribe = async () => {
    if (!token || !user) {
      router.push("/login");
      return;
    }
    if (!TOSS_CLIENT_KEY || TOSS_CLIENT_KEY.endsWith("placeholder")) {
      setError(
        "TOSS_CLIENT_KEY가 설정되지 않았습니다. developers.tosspayments.com에서 테스트 키를 발급받아 .env.local에 넣어주세요.",
      );
      return;
    }

    setSubscribing(true);
    setError(null);

    try {
      // 1. 백엔드에서 orderId + amount 받기
      const prep = await apiClient<{
        orderId: string;
        amount: number;
        billingCycle: BillingCycle;
      }>("/payment/prepare", {
        method: "POST",
        token,
        body: { billingCycle: selectedPlan },
      });

      // 2. 토스 SDK로 결제창 띄우기
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey: user.id || ANONYMOUS });

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: prep.amount },
        orderId: prep.orderId,
        orderName: `緣 프리미엄 ${selectedPlan === "yearly" ? "연간" : "월간"} 구독`,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: undefined,
        customerName: user.nickname,
      });
      // 토스가 successUrl로 리다이렉트 — 이 코드는 실행 안 됨
    } catch (err: any) {
      console.error("결제 요청 실패:", err);
      setError(err?.message ?? "결제 요청에 실패했습니다");
      setSubscribing(false);
    }
  };

  const handleCancel = async () => {
    if (!token) return;
    if (!confirm("구독을 해지하시겠습니까? 만기일까지는 계속 이용 가능합니다.")) return;
    try {
      await apiClient("/payment/subscription", { method: "DELETE", token });
      const next = await apiClient<SubscriptionStatus>("/payment/subscription/status", { token });
      setStatus(next);
    } catch (err: any) {
      alert(err?.message ?? "해지 실패");
    }
  };

  if (authLoading || statusLoading) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-md text-center py-20">
          <p className="text-[var(--muted-foreground)]">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 구독 중인 유저
  if (status?.isPremium) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-md space-y-6">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            프리미엄
          </h1>

          <Card className="border-none shadow-lg overflow-hidden">
            <div className="h-1 bg-[var(--brand-gold)]" />
            <CardContent className="pt-6 text-center space-y-3">
              <Badge className="bg-[var(--brand-gold)] text-white text-sm px-4 py-1">
                {status.billingCycle === "yearly" ? "연간" : "월간"} 구독 중
              </Badge>
              <p className="text-sm text-[var(--muted-foreground)]">
                만료일:{" "}
                {status.expiresAt
                  ? new Date(status.expiresAt).toLocaleDateString("ko-KR")
                  : "-"}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                남은 기간: {status.remainingDays}일 · {status.isActive ? "자동 갱신 예정" : "해지됨"}
              </p>

              <div className="text-left bg-[var(--muted)] rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">이용 중인 혜택</p>
                {PLANS[0].features.map((f) => (
                  <p key={f} className="text-sm text-[var(--muted-foreground)] flex items-center gap-2">
                    <span className="text-[var(--element-wood)]">✓</span> {f}
                  </p>
                ))}
              </div>

              <Button
                onClick={() => router.push("/home")}
                className="w-full bg-[var(--brand-red)] text-white py-5"
              >
                홈으로 돌아가기
              </Button>
              {status.isActive && (
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="w-full py-4 text-sm"
                >
                  구독 해지
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 미구독 유저
  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            프리미엄 구독
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            더 많은 인연을 만나보세요
          </p>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 text-center text-xs gap-2">
              <div />
              <p className="font-medium text-[var(--muted-foreground)]">무료</p>
              <p className="font-bold text-[var(--brand-gold)]">프리미엄</p>
              {[
                ["이상적 상대", "Top 3", "Top 30"],
                ["매칭 노출", "일반", "우선"],
                ["선호도 재설정", "월 1회", "무제한"],
                ["연인/깊은 궁합", "잠김", "열람"],
              ].map(([label, free, premium]) => (
                <div key={label} className="contents">
                  <p className="text-left text-[var(--muted-foreground)] py-1 border-t border-[var(--border)]">
                    {label}
                  </p>
                  <p className="py-1 border-t border-[var(--border)]">{free}</p>
                  <p className="py-1 border-t border-[var(--border)] font-medium text-[var(--brand-gold)]">
                    {premium}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {PLANS.map((p) => (
          <Card
            key={p.id}
            className={`border-2 shadow-sm cursor-pointer transition-all ${
              selectedPlan === p.id
                ? "border-[var(--brand-gold)] shadow-md"
                : "border-transparent"
            }`}
            onClick={() => setSelectedPlan(p.id)}
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[var(--foreground)]">{p.name}</p>
                    {p.badge && (
                      <Badge className="bg-[var(--brand-red)] text-white text-[10px]">
                        {p.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    {p.features[0]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-[var(--brand-gold)]">{p.priceLabel}원</p>
                  <p className="text-xs text-[var(--muted-foreground)]">/{p.period}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {error && (
          <p className="text-sm text-[var(--element-fire)] text-center">{error}</p>
        )}

        <Button
          onClick={handleSubscribe}
          disabled={subscribing || !token}
          className="w-full bg-[var(--brand-gold)] hover:bg-[var(--brand-gold)]/90 text-white py-6 text-base"
        >
          {subscribing
            ? "결제창 여는 중..."
            : !token
              ? "로그인이 필요합니다"
              : `${selectedPlan === "yearly" ? "연간" : "월간"} 구독 시작하기`}
        </Button>

        <p className="text-center text-xs text-[var(--muted-foreground)]">
          언제든지 해지할 수 있습니다
        </p>
      </div>
    </div>
  );
}
