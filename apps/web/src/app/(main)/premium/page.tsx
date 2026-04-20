"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePremiumStore } from "@/stores/premiumStore";

const PLANS = [
  {
    id: "monthly" as const,
    name: "월간 구독",
    price: "9,900",
    period: "월",
    features: [
      "이상적 상대 Top 30 확장",
      "매칭 우선 노출",
      "궁합 선호도 무제한 재설정",
      "상세 궁합 리포트",
    ],
    badge: null,
  },
  {
    id: "yearly" as const,
    name: "연간 구독",
    price: "79,900",
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

export default function PremiumPage() {
  const router = useRouter();
  const { isPremium, plan, expiresAt, setPremium } = usePremiumStore();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    // 데모 모드: 바로 프리미엄 활성화
    setPremium(selectedPlan);
    setLoading(false);
  };

  if (isPremium) {
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
                {plan === "yearly" ? "연간" : "월간"} 구독 중
              </Badge>
              <p className="text-sm text-[var(--muted-foreground)]">
                만료일: {expiresAt ? new Date(expiresAt).toLocaleDateString("ko-KR") : "-"}
              </p>

              <div className="text-left bg-[var(--muted)] rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">이용 중인 혜택</p>
                {["이상적 상대 Top 30 확장", "매칭 우선 노출", "궁합 선호도 무제한 재설정", "상세 궁합 리포트"].map((f) => (
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
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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

        {/* 무료 vs 프리미엄 비교 */}
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
                ["궁합 리포트", "기본", "상세"],
              ].map(([label, free, premium]) => (
                <>
                  <p key={label} className="text-left text-[var(--muted-foreground)] py-1 border-t border-[var(--border)]">{label}</p>
                  <p key={`${label}-f`} className="py-1 border-t border-[var(--border)]">{free}</p>
                  <p key={`${label}-p`} className="py-1 border-t border-[var(--border)] font-medium text-[var(--brand-gold)]">{premium}</p>
                </>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 요금제 선택 */}
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
                      <Badge className="bg-[var(--brand-red)] text-white text-[10px]">{p.badge}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    {p.features[0]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-[var(--brand-gold)]">{p.price}원</p>
                  <p className="text-xs text-[var(--muted-foreground)]">/{p.period}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full bg-[var(--brand-gold)] hover:bg-[var(--brand-gold)]/90 text-white py-6 text-base"
        >
          {loading ? "처리 중..." : `${selectedPlan === "yearly" ? "연간" : "월간"} 구독 시작하기`}
        </Button>

        <p className="text-center text-xs text-[var(--muted-foreground)]">
          언제든지 해지할 수 있습니다
        </p>
      </div>
    </div>
  );
}
