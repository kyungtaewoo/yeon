"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useMatchRealtime } from "@/hooks/useRealtime";

interface Match {
  id: string;
  userAId: string;
  userBId: string;
  idealMatchScore: number | null;
  compatibilityScore: number | null;
  status: string;
  userADecision: string | null;
  userBDecision: string | null;
  createdAt: string;
  expiresAt: string | null;
}

const STATUS_CONFIG: Record<string, { text: string; variant: "default" | "secondary" | "destructive"; color: string }> = {
  pending: { text: "대기 중", variant: "secondary", color: "var(--muted-foreground)" },
  notified: { text: "새 매칭", variant: "default", color: "var(--brand-red)" },
  a_accepted: { text: "수락 대기", variant: "secondary", color: "var(--brand-gold)" },
  b_accepted: { text: "수락 대기", variant: "secondary", color: "var(--brand-gold)" },
  both_accepted: { text: "쌍방 수락", variant: "default", color: "var(--element-wood)" },
  payment_pending: { text: "결제 대기", variant: "default", color: "var(--brand-gold)" },
  completed: { text: "완료", variant: "default", color: "var(--element-wood)" },
  rejected: { text: "거절됨", variant: "destructive", color: "var(--element-fire)" },
  expired: { text: "만료", variant: "destructive", color: "var(--muted-foreground)" },
};

export default function MatchesPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const { newMatch } = useMatchRealtime(user?.id);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    // 비로그인 — API 호출 없이 빈 상태로
    if (!user || !token) {
      setLoading(false);
      return;
    }

    const fetchMatches = async () => {
      try {
        const res = await apiClient<{ matches: Match[] }>('/matching', { token });
        setMatches(res.matches);
      } catch (err) {
        console.error("매칭 조회 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [user, token, authLoading, newMatch]);

  if (authLoading || loading) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-md">
          <p className="text-center text-[var(--muted-foreground)]">로딩 중...</p>
        </div>
      </div>
    );
  }

  const activeMatches = matches.filter((m) =>
    ["notified", "a_accepted", "b_accepted", "both_accepted", "payment_pending"].includes(m.status)
  );
  const completedMatches = matches.filter((m) =>
    ["completed", "rejected", "expired"].includes(m.status)
  );

  const getMyDecision = (match: Match): string => {
    if (!user) return "pending";
    const decision = match.userAId === user.id ? match.userADecision : match.userBDecision;
    return decision ?? "pending";
  };

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const renderMatchCard = (match: Match) => {
    const config = STATUS_CONFIG[match.status] || STATUS_CONFIG.pending;
    const myDecision = getMyDecision(match);
    const daysLeft = match.expiresAt ? getDaysLeft(match.expiresAt) : null;

    return (
      <Card
        key={match.id}
        className="border-none shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => router.push(`/matches/${match.id}`)}
      >
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: "var(--brand-gold)" }}
              >
                {match.compatibilityScore ?? match.idealMatchScore ?? "-"}
              </div>
              <div>
                <p className="text-sm font-medium">
                  궁합 {match.compatibilityScore ?? match.idealMatchScore ?? "-"}점
                  {match.compatibilityScore == null && match.idealMatchScore != null && (
                    <span className="ml-1 text-[10px] text-[var(--muted-foreground)]">(예상)</span>
                  )}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {new Date(match.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant={config.variant}>{config.text}</Badge>
              {daysLeft !== null && daysLeft > 0 && daysLeft <= 7 && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  {daysLeft}일 남음
                </p>
              )}
            </div>
          </div>
          {myDecision === "pending" && match.status === "notified" && (
            <p className="text-xs text-[var(--brand-red)] font-medium">
              수락 또는 거절을 선택해주세요
            </p>
          )}
          {myDecision === "accepted" && ["a_accepted", "b_accepted"].includes(match.status) && (
            <p className="text-xs text-[var(--brand-gold)]">
              상대방의 응답을 기다리고 있습니다
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
          매칭
        </h1>

        <Tabs defaultValue="active">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              진행 중 ({activeMatches.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              히스토리 ({completedMatches.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3 mt-4">
            {activeMatches.length === 0 ? (
              <Card className="border-none shadow-sm">
                <CardContent className="py-8 text-center">
                  <p className="text-[var(--muted-foreground)]">
                    아직 진행 중인 매칭이 없습니다
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    운명의 상대를 탐색 중입니다...
                  </p>
                </CardContent>
              </Card>
            ) : (
              activeMatches.map(renderMatchCard)
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {completedMatches.length === 0 ? (
              <Card className="border-none shadow-sm">
                <CardContent className="py-8 text-center">
                  <p className="text-[var(--muted-foreground)]">
                    매칭 히스토리가 없습니다
                  </p>
                </CardContent>
              </Card>
            ) : (
              completedMatches.map(renderMatchCard)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
