"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

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
    if (authLoading || !user || !token) return;

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

  const handleSignOut = () => {
    signOut();
    router.replace("/login");
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

        <p className="text-center text-xs text-[var(--muted-foreground)]">
          緣 (연) v1.0.0
        </p>
      </div>
    </div>
  );
}
