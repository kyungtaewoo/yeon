"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PremiumBanner() {
  const router = useRouter();

  return (
    <Card className="border border-[var(--brand-gold)]/30 bg-gradient-to-r from-[var(--brand-gold)]/5 to-[var(--brand-gold)]/10">
      <CardContent className="py-4 flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-bold text-[var(--foreground)]">
            프리미엄으로 업그레이드
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            연인 궁합 + 깊은 궁합 + 이상적 상대 3명
          </p>
        </div>
        <Button
          onClick={() => router.push("/premium")}
          size="sm"
          className="bg-[var(--brand-gold)] hover:bg-[var(--brand-gold)]/90 text-white text-xs shrink-0"
        >
          월 9,900원
        </Button>
      </CardContent>
    </Card>
  );
}
