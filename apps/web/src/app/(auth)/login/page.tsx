"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const router = useRouter();

  const handleKakaoLogin = () => {
    // Capacitor 네이티브 앱이면 ?from=app 을 붙여 서버가 yeonapp:// 로 돌려보내도록 신호
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    const isNative = cap?.isNativePlatform?.() ?? false;
    const query = isNative ? "?from=app" : "";
    console.log("[Login] kakao redirect", { isNative, url: `${API_URL}/auth/kakao/redirect${query}` });
    window.location.href = `${API_URL}/auth/kakao/redirect${query}`;
  };

  const handleDemoMode = () => {
    router.push("/saju-input");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-sm border-none shadow-lg">
        <CardHeader className="text-center">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-sm text-[var(--muted-foreground)] mb-4 hover:text-[var(--foreground)]"
          >
            &larr; 홈으로
          </button>
          <h1 className="font-[family-name:var(--font-serif)] text-5xl text-[var(--brand-red)]">
            緣
          </h1>
          <CardTitle className="mt-2 text-lg text-[var(--muted-foreground)]">
            사주궁합 매칭 플랫폼
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            onClick={handleKakaoLogin}
            className="w-full bg-[#FEE500] text-[#191919] hover:bg-[#FDD835] font-medium text-base py-6"
          >
            카카오로 시작하기
          </Button>
          <Button
            type="button"
            onClick={handleDemoMode}
            variant="outline"
            className="w-full border-[var(--brand-gold)] text-[var(--brand-gold)] hover:bg-[var(--brand-gold)] hover:text-white font-medium text-base py-6"
          >
            로그인 없이 체험하기
          </Button>
          <p className="text-center text-sm text-[var(--muted-foreground)]">
            로그인 시{" "}
            <span className="underline cursor-pointer">이용약관</span> 및{" "}
            <span className="underline cursor-pointer">개인정보처리방침</span>에
            동의합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
