"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { usePremiumStore } from "@/stores/premiumStore";

interface Profile {
  nickname: string;
  gender: string;
  birthDate: string | null;
  avatarUrl: string | null;
  isOnboardingComplete: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    // 비로그인 — API 호출 없이 빈 상태로
    if (!user || !token) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const me = await apiClient<Profile>('/users/me', { token });
        setProfile(me);
      } catch (err) {
        console.error("프로필 조회 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, token, authLoading]);

  const [withdrawing, setWithdrawing] = useState(false);

  const handleSignOut = () => {
    signOut();
    router.replace("/");
  };

  const handleWithdraw = async () => {
    if (!token) return;
    const ok = window.confirm(
      "정말 탈퇴하시겠어요?\n\n" +
        "회원 정보, 사주 결과, 매칭 기록, 친구 궁합, 결제 내역까지 모두 영구 삭제되며 복구할 수 없습니다.",
    );
    if (!ok) return;

    setWithdrawing(true);
    try {
      await apiClient("/auth/me", { method: "DELETE", token });
      // 로컬 데이터까지 모두 정리
      signOut();
      useOnboardingStore.getState().reset();
      usePremiumStore.getState().clearPremium();
      toast.success("탈퇴 완료", { description: "이용해주셔서 감사했습니다." });
      router.replace("/");
    } catch (err) {
      console.error("탈퇴 실패:", err);
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      toast.error("탈퇴 실패", { description: `잠시 후 다시 시도해주세요. (${msg})` });
    } finally {
      setWithdrawing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-md text-center">
          <p className="text-[var(--muted-foreground)]">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
          프로필
        </h1>

        {/* 프로필 카드 */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-[var(--brand-gold)]/20 flex items-center justify-center">
                <span className="font-[family-name:var(--font-serif)] text-2xl text-[var(--brand-gold)]">
                  {profile?.nickname?.[0] || "?"}
                </span>
              </div>
              <div>
                <p className="text-lg font-bold">{profile?.nickname || "이름 없음"}</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {profile?.gender === "male" ? "남성" : "여성"}
                  {profile?.birthDate ? ` · ${profile.birthDate.split('T')[0]}` : ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 메뉴 */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-0">
            {[
              { label: "프리미엄 구독", href: "/premium" },
              { label: "내 사주 정보", href: "/my-saju" },
              { label: "궁합 선호도 재설정", href: "/preferences" },
              { label: "알림 설정", href: "#" },
            ].map((item, i) => (
              <button
                key={item.label}
                onClick={() => item.href !== "#" && router.push(item.href)}
                className={`w-full flex items-center justify-between px-4 py-4 text-sm text-left hover:bg-[var(--muted)]/50 transition-colors ${
                  i > 0 ? "border-t border-[var(--border)]" : ""
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[var(--muted-foreground)]">&rsaquo;</span>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* 로그아웃 */}
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full border-[var(--border)] text-[var(--muted-foreground)]"
        >
          로그아웃
        </Button>

        {/* 탈퇴하기 — 로그인 상태에서만 노출 */}
        {token && (
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="w-full text-center text-xs text-[var(--muted-foreground)] underline disabled:opacity-50"
          >
            {withdrawing ? "탈퇴 처리 중..." : "회원 탈퇴"}
          </button>
        )}

        <p className="text-center text-xs text-[var(--muted-foreground)]">
          緣 (연) v1.0.0
        </p>
      </div>
    </div>
  );
}
