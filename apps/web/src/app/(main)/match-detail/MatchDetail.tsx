"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/authStore";
import { ApiError } from "@/lib/api";
import {
  getMatchDetail,
  acceptMatch,
  rejectMatch,
  type MatchDetailResponse,
  type MatchStatus,
} from "@/lib/api/matching";

const STATUS_LABEL: Record<MatchStatus, { text: string; tone: "default" | "secondary" | "destructive" }> = {
  pending: { text: "탐색 중", tone: "secondary" },
  notified: { text: "새 매칭!", tone: "default" },
  a_accepted: { text: "수락 대기", tone: "secondary" },
  b_accepted: { text: "수락 대기", tone: "secondary" },
  both_accepted: { text: "쌍방 수락", tone: "default" },
  payment_pending: { text: "결제 대기", tone: "secondary" },
  completed: { text: "완료", tone: "default" },
  rejected: { text: "거절됨", tone: "destructive" },
  expired: { text: "만료", tone: "destructive" },
};

export function MatchDetail() {
  const router = useRouter();
  const search = useSearchParams();
  const matchId = search.get("id") ?? "";
  const token = useAuthStore((s) => s.token);

  const [detail, setDetail] = useState<MatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<"not_found" | "forbidden" | "network" | "other" | null>(null);
  const [acting, setActing] = useState<"accept" | "reject" | null>(null);

  const load = useCallback(async () => {
    if (!token || !matchId) return;
    setLoading(true);
    setErrorKind(null);
    try {
      const res = await getMatchDetail(token, matchId);
      setDetail(res);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          router.replace("/login");
          return;
        }
        if (e.status === 404) setErrorKind("not_found");
        else if (e.status === 403) setErrorKind("forbidden");
        else if (e.status === 0 || e.status >= 500) setErrorKind("network");
        else setErrorKind("other");
      } else {
        setErrorKind("other");
      }
    } finally {
      setLoading(false);
    }
  }, [token, matchId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDecide = async (decision: "accept" | "reject") => {
    if (!token || !matchId || acting) return;
    setActing(decision);
    try {
      if (decision === "accept") {
        await acceptMatch(token, matchId);
        toast.success("수락했어요");
      } else {
        await rejectMatch(token, matchId);
        toast.success("거절했어요");
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "처리에 실패했어요";
      toast.error(msg);
    } finally {
      setActing(null);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-6">
        <div className="mx-auto max-w-md text-center mt-12 space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">로그인이 필요해요</p>
          <Button onClick={() => router.replace("/login")}>로그인하기</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-6">
        <div className="mx-auto max-w-md text-center mt-12 text-sm text-[var(--muted-foreground)]">
          불러오는 중...
        </div>
      </div>
    );
  }

  if (errorKind) {
    const message =
      errorKind === "not_found"
        ? "매칭을 찾을 수 없어요"
        : errorKind === "forbidden"
          ? "이 매칭을 볼 수 없어요"
          : errorKind === "network"
            ? "잠시 후 다시 시도해주세요"
            : "매칭 정보를 불러오지 못했어요";
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-6">
        <div className="mx-auto max-w-md mt-12 space-y-4 text-center">
          <p className="text-sm text-[var(--brand-red)]">{message}</p>
          <div className="flex flex-col gap-2">
            {errorKind === "network" && (
              <Button variant="outline" onClick={load}>다시 시도</Button>
            )}
            <Button onClick={() => router.replace("/home")}>홈으로</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const { match, myDecision, counterpart, counterpartSaju } = detail;
  const status = STATUS_LABEL[match.status] ?? STATUS_LABEL.pending;
  const score = match.compatibilityScore ?? match.idealMatchScore;
  const dayPillar = counterpartSaju ? `${counterpartSaju.dayStem}${counterpartSaju.dayBranch}` : null;

  // 의사결정 버튼 노출 조건: 내가 아직 결정 안 했고, 종결 상태 아님.
  const canDecide =
    myDecision !== "accepted" &&
    myDecision !== "rejected" &&
    !["completed", "rejected", "expired", "both_accepted"].includes(match.status);

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">
        <button
          type="button"
          onClick={() => router.replace("/home")}
          className="text-sm text-[var(--muted-foreground)]"
        >
          ← 홈으로
        </button>

        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
              {counterpart?.nickname ?? "이름 미상"}
            </h1>
            <Badge variant={status.tone}>{status.text}</Badge>
          </div>
          {counterpart && (
            <p className="text-xs text-[var(--muted-foreground)]">
              {counterpart.gender === "male" ? "남성" : "여성"}
              {counterpart.age != null ? ` · 만 ${counterpart.age}세` : ""}
            </p>
          )}
        </header>

        {/* 점수 카드 */}
        <Card className="border-none shadow-sm">
          <CardContent className="py-5 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">궁합 점수</p>
            <p className="mt-1 text-4xl font-bold text-[var(--brand-gold)]">
              {score != null ? `${Math.round(Number(score))}점` : "—"}
            </p>
            {match.idealMatchScore != null && match.compatibilityScore == null && (
              <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
                * 이상형 매칭 점수 기준 (정밀 궁합은 계산 후 표시)
              </p>
            )}
          </CardContent>
        </Card>

        {/* 사주 카드 */}
        {counterpartSaju && (
          <Card className="border-none shadow-sm">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-medium text-[var(--foreground)]">상대방 사주</p>
                {dayPillar && (
                  <span className="text-xs text-[var(--muted-foreground)]">
                    일주 <span className="font-bold text-[var(--foreground)]">{dayPillar}</span>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <SajuPillar label="시" stem={counterpartSaju.hourStem} branch={counterpartSaju.hourBranch} />
                <SajuPillar label="일" stem={counterpartSaju.dayStem} branch={counterpartSaju.dayBranch} highlight />
                <SajuPillar label="월" stem={counterpartSaju.monthStem} branch={counterpartSaju.monthBranch} />
                <SajuPillar label="년" stem={counterpartSaju.yearStem} branch={counterpartSaju.yearBranch} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 액션 영역 */}
        {canDecide ? (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDecide("reject")}
              disabled={acting !== null}
            >
              {acting === "reject" ? "처리 중..." : "거절"}
            </Button>
            <Button
              type="button"
              onClick={() => handleDecide("accept")}
              disabled={acting !== null}
              className="bg-[var(--brand-red)] text-white"
            >
              {acting === "accept" ? "처리 중..." : "수락"}
            </Button>
          </div>
        ) : (
          <DecisionStatus status={match.status} myDecision={myDecision} />
        )}
      </div>
    </div>
  );
}

function SajuPillar({
  label,
  stem,
  branch,
  highlight,
}: {
  label: string;
  stem: string | null;
  branch: string | null;
  highlight?: boolean;
}) {
  if (!stem || !branch) {
    return (
      <div className="rounded bg-[var(--muted-foreground)]/5 py-2">
        <p className="text-[10px] text-[var(--muted-foreground)]">{label}</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">—</p>
      </div>
    );
  }
  return (
    <div
      className={`rounded py-2 ${
        highlight ? "bg-[var(--brand-gold)]/10" : "bg-[var(--muted-foreground)]/5"
      }`}
    >
      <p className="text-[10px] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[var(--foreground)]">{stem}{branch}</p>
    </div>
  );
}

function DecisionStatus({
  status,
  myDecision,
}: {
  status: MatchStatus;
  myDecision: string | null;
}) {
  let text = "";
  if (myDecision === "accepted" && status !== "both_accepted") {
    text = "수락했어요. 상대방의 응답을 기다리고 있습니다";
  } else if (myDecision === "rejected") {
    text = "거절한 매칭이에요";
  } else if (status === "both_accepted") {
    text = "쌍방 수락했어요 🎉";
  } else if (status === "completed") {
    text = "이미 완료된 매칭이에요";
  } else if (status === "expired") {
    text = "만료된 매칭이에요";
  } else if (status === "rejected") {
    text = "거절된 매칭이에요";
  }
  if (!text) return null;
  return (
    <Card className="border-dashed border-2 border-[var(--muted-foreground)]/20 shadow-none bg-transparent">
      <CardContent className="py-4 text-center">
        <p className="text-xs text-[var(--muted-foreground)]">{text}</p>
      </CardContent>
    </Card>
  );
}
