"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { usePremium } from "@/hooks/usePremium";

interface PremiumGateProps {
  children: React.ReactNode;
  /** 무료 유저에게 보여줄 미리보기 (블러 처리 대상 위) */
  preview?: React.ReactNode;
  /** 잠금 메시지 */
  message?: string;
}

/**
 * 프리미엄 전용 콘텐츠를 감싸는 게이트 컴포넌트.
 * 프리미엄 유저에게는 children을, 무료 유저에게는 블러+CTA를 보여준다.
 */
export function PremiumGate({ children, preview, message }: PremiumGateProps) {
  const { isPremium } = usePremium();
  const router = useRouter();

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* 블러 처리된 미리보기 */}
      {preview && (
        <div className="blur-sm pointer-events-none select-none opacity-60">
          {preview}
        </div>
      )}

      {/* 잠금 오버레이 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
        <div className="text-center px-6">
          <div className="text-2xl mb-2">🔒</div>
          <p className="text-sm font-medium text-[var(--foreground)]">
            {message || "프리미엄 구독 시 열람 가능"}
          </p>
          <Button
            onClick={() => router.push("/premium")}
            className="mt-3 bg-[var(--brand-gold)] hover:bg-[var(--brand-gold)]/90 text-white text-sm"
          >
            프리미엄 시작하기
          </Button>
        </div>
      </div>
    </div>
  );
}
