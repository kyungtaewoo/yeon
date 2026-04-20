"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMatchRealtime } from "@/hooks/useRealtime";

interface Match {
  id: string;
  user_a_id: string;
  user_b_id: string;
  compatibility_score: number;
  status: string;
  user_a_decision: string;
  user_b_decision: string;
  created_at: string;
  expires_at: string;
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
  const { user, loading: authLoading } = useAuth();
  const { newMatch } = useMatchRealtime(user?.id);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchMatches = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("matches")
        .select("*")
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (data) setMatches(data);
      setLoading(false);
    };

    fetchMatches();
  }, [user, authLoading, newMatch]);

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

  const getMyDecision = (match: Match) => {
    if (!user) return "pending";
    return match.user_a_id === user.id ? match.user_a_decision : match.user_b_decision;
  };

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const renderMatchCard = (match: Match) => {
    const config = STATUS_CONFIG[match.status] || STATUS_CONFIG.pending;
    const myDecision = getMyDecision(match);
    const daysLeft = match.expires_at ? getDaysLeft(match.expires_at) : null;

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
                {match.compatibility_score}
              </div>
              <div>
                <p className="text-sm font-medium">궁합 {match.compatibility_score}점</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {new Date(match.created_at).toLocaleDateString("ko-KR")}
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
