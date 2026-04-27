"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { postLoginSync } from "@/lib/auth/postLoginSync";
import { ELEMENT_NAMES } from "@/lib/saju/constants";
import type { Element } from "@/lib/saju/types";

interface MatchSummary {
  id: string;
  status: string;
  idealMatchScore: number | null;
  compatibilityScore: number | null;
  createdAt: string;
}

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, loading: authLoading } = useAuth();
  const { idealProfiles, report } = useOnboardingStore();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [ingestingToken, setIngestingToken] = useState(false);

  const isDemo = !user;
  // dev StrictMode useEffect 이중 실행 방지 — 토큰 ingest 두 번 막음.
  const ingestRanRef = useRef(false);

  // URL에 ?token=이 오면 authStore(localStorage)에 저장하고 URL에서 제거
  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (!urlToken) return;
    if (ingestRanRef.current) return;
    ingestRanRef.current = true;

    setIngestingToken(true);
    (async () => {
      try {
        const me = await apiClient<{
          id: string;
          nickname: string;
          gender: string;
          isOnboardingComplete: boolean;
          isPremium: boolean;
        }>('/auth/me', { token: urlToken });
        useAuthStore.getState().setAuth(urlToken, me);

        try {
          await postLoginSync(urlToken);
        } catch (e) {
          console.warn("[postLoginSync] failed", e);
        }
      } catch (err) {
        console.error("토큰 인증 실패:", err);
      } finally {
        router.replace("/home");
        setIngestingToken(false);
      }
    })();
  }, [searchParams, router]);

  useEffect(() => {
    if (authLoading || ingestingToken) return;

    if (!user || !token) {
      // 데모 모드 — DB 조회 없이 표시
      setLoading(false);
      return;
    }

    const fetchMatches = async () => {
      try {
        const res = await apiClient<{ matches: MatchSummary[] }>('/matching', { token });
        const recent = res.matches.slice(0, 5);
        setMatches(recent);
        setPendingCount(
          recent.filter((m) =>
            ["notified", "a_accepted", "b_accepted"].includes(m.status),
          ).length,
        );
      } catch (err) {
        console.error("매칭 조회 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [user, token, authLoading, ingestingToken, router]);

  const statusLabels: Record<string, { text: string; variant: "default" | "secondary" | "destructive" }> = {
    pending: { text: "탐색 중", variant: "secondary" },
    notified: { text: "새 매칭!", variant: "default" },
    a_accepted: { text: "수락 대기", variant: "secondary" },
    b_accepted: { text: "수락 대기", variant: "secondary" },
    both_accepted: { text: "쌍방 수락", variant: "default" },
    completed: { text: "완료", variant: "default" },
    rejected: { text: "거절됨", variant: "destructive" },
    expired: { text: "만료", variant: "destructive" },
  };

  if (authLoading || ingestingToken || loading) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-md text-center py-20">
          <p className="text-[var(--muted-foreground)]">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-md space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div
            className="cursor-pointer"
            onClick={() => router.push("/")}
          >
            <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
              緣
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">매칭 현황</p>
          </div>
          {isDemo && (
            <Button
              onClick={() => router.push("/login")}
              size="sm"
              className="bg-[#FEE500] text-[#191919] hover:bg-[#FDD835] text-xs font-bold"
            >
              카카오 가입
            </Button>
          )}
        </div>

        {/* 매칭 현황 카드 */}
        <Card className="border-none shadow-lg overflow-hidden">
          <div className="h-1 bg-[var(--brand-gold)]" />
          <CardContent className="pt-6 text-center">
            {!isDemo && pendingCount > 0 ? (
              <>
                <p className="font-[family-name:var(--font-serif)] text-xl text-[var(--brand-red)]">
                  새로운 매칭이 있어요!
                </p>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {pendingCount}개의 매칭이 당신을 기다리고 있습니다
                </p>
                <Button
                  onClick={() => router.push("/matches")}
                  className="mt-4 bg-[var(--brand-red)] text-white"
                >
                  매칭 확인하기
                </Button>
              </>
            ) : (
              <>
                <div className="inline-block animate-pulse">
                  <p className="font-[family-name:var(--font-serif)] text-xl text-[var(--brand-gold)]">
                    운명의 상대 탐색 중...
                  </p>
                </div>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {isDemo
                    ? "회원가입 후 실제 매칭을 시작할 수 있습니다"
                    : "당신의 이상적 사주와 맞는 상대를 찾고 있습니다"}
                </p>
                {isDemo && (
                  <Button
                    onClick={() => router.push("/login")}
                    className="mt-4 bg-[#FEE500] text-[#191919] hover:bg-[#FDD835] font-bold w-full py-5"
                  >
                    카카오로 가입하고 매칭 시작하기
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 데모 모드: 분석 결과 요약 */}
        {isDemo && report && (
          <Card className="border-none shadow-lg">
            <CardContent className="pt-6">
              <h2 className="font-medium text-[var(--foreground)] mb-3">내 분석 결과</h2>
              <div className="space-y-2">
                <p className="text-sm text-[var(--muted-foreground)]">
                  일주: <span className="font-bold text-[var(--foreground)]">
                    {report.pillars.day.stem}{report.pillars.day.branch}
                  </span>
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  주요 오행: <span className="font-bold text-[var(--foreground)]">
                    {ELEMENT_NAMES[report.dominantElement as Element]?.hanja}({ELEMENT_NAMES[report.dominantElement as Element]?.ko})
                  </span>
                </p>
                {idealProfiles.length > 0 && (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    이상적 상대 1순위: <span className="font-bold text-[var(--foreground)]">
                      {idealProfiles[0].pillars.day.stem}{idealProfiles[0].pillars.day.branch}일주
                    </span>
                    {" "}(궁합 {idealProfiles[0].totalScore}점)
                  </p>
                )}
              </div>
              <Button
                onClick={() => router.push("/saju-input")}
                variant="outline"
                className="mt-4 w-full border-[var(--brand-gold)] text-[var(--brand-gold)]"
              >
                다시 분석하기
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 데모 모드: 둘러보기 */}
        {isDemo && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-none shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push("/content")}>
              <CardContent className="py-4 text-center">
                <p className="text-2xl mb-1">📖</p>
                <p className="text-sm font-medium">궁합 콘텐츠</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push("/premium")}>
              <CardContent className="py-4 text-center">
                <p className="text-2xl mb-1">👑</p>
                <p className="text-sm font-medium">프리미엄</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 실제 매칭 리스트 (로그인 시) */}
        {!isDemo && matches.length > 0 && (
          <div>
            <h2 className="font-medium text-[var(--foreground)] mb-3">최근 매칭</h2>
            <div className="space-y-3">
              {matches.map((match) => {
                const status = statusLabels[match.status] || statusLabels.pending;
                return (
                  <Card
                    key={match.id}
                    className="border-none shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/matches/${match.id}`)}
                  >
                    <CardContent className="py-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          궁합 점수:{" "}
                          <span className="text-[var(--brand-gold)] font-bold">
                            {match.compatibilityScore ?? match.idealMatchScore ?? "-"}점
                          </span>
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {new Date(match.createdAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      <Badge variant={status.variant}>{status.text}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* 오늘의 궁합 팁 */}
        <Card className="border-none shadow-sm bg-[var(--card)]">
          <CardContent className="pt-6">
            <h3 className="font-[family-name:var(--font-serif)] text-base font-bold mb-2">
              오늘의 궁합 팁
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              일간 천간합(天干合)은 두 사람 사이의 자연스러운 끌림을 나타냅니다.
              甲己, 乙庚, 丙辛, 丁壬, 戊癸 — 이 다섯 쌍은 음양이 만나 새로운
              오행을 만들어내는 특별한 관계입니다.
            </p>
            <Button
              onClick={() => router.push("/content/chungan-hap")}
              variant="outline"
              className="mt-3 text-xs"
            >
              자세히 보기
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-6">
          <div className="mx-auto max-w-md text-center py-20">
            <p className="text-[var(--muted-foreground)]">로딩 중...</p>
          </div>
        </div>
      }
    >
      <HomeInner />
    </Suspense>
  );
}
