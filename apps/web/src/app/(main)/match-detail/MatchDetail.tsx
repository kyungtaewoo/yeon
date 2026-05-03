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
  respondToProposal,
  type MatchDetailResponse,
  type MatchStatus,
} from "@/lib/api/matching";

const STATUS_LABEL: Record<MatchStatus, { text: string; tone: "default" | "secondary" | "destructive" }> = {
  proposed: { text: "응답 대기", tone: "secondary" },
  accepted: { text: "매칭 성사 🎉", tone: "default" },
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
  const [responseKakaoId, setResponseKakaoId] = useState("");
  const [showKakaoIdInput, setShowKakaoIdInput] = useState(false);

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
      const apiDecision = decision === "accept" ? "accepted" : "rejected";
      await respondToProposal(token, matchId, apiDecision, {
        kakaoTalkIdResponse: decision === "accept" && responseKakaoId.trim()
          ? responseKakaoId.trim()
          : null,
      });
      toast.success(decision === "accept" ? "수락했어요 🎉" : "거절했어요");
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "처리 실패";
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
            <Button onClick={() => router.replace("/matches")}>매칭으로</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const { match, counterpart, counterpartSaju, isProposer, isReceiver } = detail;
  const status = STATUS_LABEL[match.status] ?? STATUS_LABEL.proposed;
  const score = match.compatibilityScore ?? match.idealMatchScore;
  const dayPillar = counterpartSaju ? `${counterpartSaju.dayStem}${counterpartSaju.dayBranch}` : null;

  const canRespond = isReceiver && match.status === "proposed";

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">
        <button
          type="button"
          onClick={() => router.replace("/matches")}
          className="text-sm text-[var(--muted-foreground)]"
        >
          ← 매칭
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
              {isProposer && match.status === "proposed" && " · 응답 대기 중"}
              {isReceiver && match.status === "proposed" && "님이 인연을 제안했어요"}
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

        {/* 제안 메시지 */}
        {match.proposalMessage && (
          <Card className="border-none shadow-sm bg-[var(--brand-gold)]/5">
            <CardContent className="py-4">
              <p className="text-[11px] text-[var(--muted-foreground)] mb-1">제안 메시지</p>
              <p className="text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
                {match.proposalMessage}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 연락 방법 안내 (proposed 단계 — 받는쪽에 미리 표시) */}
        {match.status === "proposed" && match.contactMethods && (
          <Card className="border-none shadow-sm">
            <CardContent className="py-4 space-y-2">
              <p className="text-xs font-medium text-[var(--foreground)]">연락 방법</p>
              <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
                {match.contactMethods.kakaoId && <li>📱 카카오톡 ID 공유 (수락 시 공개)</li>}
                {match.contactMethods.openChat && <li>💬 오픈채팅방 (수락 시 링크/비번 공개)</li>}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 매칭 성사 — 연락 정보 공개 */}
        {match.status === "accepted" && (
          <AcceptedContactPanel
            kakaoTalkIdShared={match.kakaoTalkIdShared}
            kakaoTalkIdResponse={match.kakaoTalkIdResponse}
            openChatRoomUrl={match.openChatRoomUrl}
            openChatPassword={match.openChatPassword}
            isProposer={isProposer}
          />
        )}

        {/* 액션 — 받는쪽 수락/거절 */}
        {canRespond && (
          <div className="space-y-3 pt-2">
            <Card className="border-none shadow-sm">
              <CardContent className="py-3">
                <button
                  type="button"
                  onClick={() => setShowKakaoIdInput((v) => !v)}
                  className="text-xs text-[var(--brand-gold)] underline"
                >
                  {showKakaoIdInput ? "카카오톡 ID 입력 닫기" : "내 카카오톡 ID 도 함께 공유 (옵션)"}
                </button>
                {showKakaoIdInput && (
                  <input
                    type="text"
                    value={responseKakaoId}
                    onChange={(e) => setResponseKakaoId(e.target.value)}
                    placeholder="내 카카오톡 ID"
                    className="mt-2 w-full rounded border border-[var(--muted-foreground)]/20 px-2 py-1.5 text-sm"
                  />
                )}
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-3">
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
            <p className="text-[10px] text-center text-[var(--muted-foreground)]">
              7일 내 응답 안 하면 자동 만료돼요
            </p>
          </div>
        )}

        {/* 상태 안내 */}
        {!canRespond && match.status === "proposed" && isProposer && (
          <Card className="border-dashed border-2 border-[var(--muted-foreground)]/20 shadow-none bg-transparent">
            <CardContent className="py-4 text-center">
              <p className="text-xs text-[var(--muted-foreground)]">
                상대방의 응답을 기다리고 있어요 (7일 후 자동 만료)
              </p>
            </CardContent>
          </Card>
        )}
        {match.status === "rejected" && (
          <Card className="border-dashed border-2 border-[var(--muted-foreground)]/20 shadow-none bg-transparent">
            <CardContent className="py-4 text-center">
              <p className="text-xs text-[var(--muted-foreground)]">
                {isProposer ? "거절된 제안이에요. 다른 인연을 찾아보세요" : "거절한 제안이에요"}
              </p>
            </CardContent>
          </Card>
        )}
        {match.status === "expired" && (
          <Card className="border-dashed border-2 border-[var(--muted-foreground)]/20 shadow-none bg-transparent">
            <CardContent className="py-4 text-center">
              <p className="text-xs text-[var(--muted-foreground)]">7일 무응답으로 만료된 제안이에요</p>
            </CardContent>
          </Card>
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

function AcceptedContactPanel({
  kakaoTalkIdShared,
  kakaoTalkIdResponse,
  openChatRoomUrl,
  openChatPassword,
  isProposer,
}: {
  kakaoTalkIdShared: string | null;
  kakaoTalkIdResponse: string | null;
  openChatRoomUrl: string | null;
  openChatPassword: string | null;
  isProposer: boolean;
}) {
  // 본인이 제안자라면 받은 카톡 ID 는 받는쪽이 추가 공유한 것
  const otherKakaoId = isProposer ? kakaoTalkIdResponse : kakaoTalkIdShared;
  const myKakaoId = isProposer ? kakaoTalkIdShared : kakaoTalkIdResponse;

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} 복사됨`);
    } catch {
      toast.error("복사 실패");
    }
  };

  return (
    <Card className="border-none shadow-sm bg-[var(--brand-gold)]/5">
      <CardContent className="py-4 space-y-3">
        <p className="text-sm font-medium text-[var(--foreground)]">🎉 매칭 성사 — 연락처</p>

        {otherKakaoId && (
          <div className="rounded border border-[var(--brand-gold)]/30 bg-white px-3 py-2">
            <p className="text-[10px] text-[var(--muted-foreground)]">상대 카카오톡 ID</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm font-bold text-[var(--foreground)]">{otherKakaoId}</p>
              <button
                type="button"
                onClick={() => copyText(otherKakaoId, "ID")}
                className="text-[11px] text-[var(--brand-gold)] underline"
              >
                복사
              </button>
            </div>
          </div>
        )}

        {myKakaoId && (
          <div className="rounded bg-[var(--muted-foreground)]/5 px-3 py-2">
            <p className="text-[10px] text-[var(--muted-foreground)]">내 카카오톡 ID (공유됨)</p>
            <p className="text-sm text-[var(--foreground)] mt-1">{myKakaoId}</p>
          </div>
        )}

        {openChatRoomUrl && (
          <div className="rounded border border-[var(--brand-gold)]/30 bg-white px-3 py-3 space-y-2">
            <p className="text-[10px] text-[var(--muted-foreground)]">오픈채팅방</p>
            {openChatPassword && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--muted-foreground)]">비밀번호</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-widest text-[var(--foreground)]">
                    {openChatPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(openChatPassword, "비밀번호")}
                    className="text-[11px] text-[var(--brand-gold)] underline"
                  >
                    복사
                  </button>
                </div>
              </div>
            )}
            <a
              href={openChatRoomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded bg-[var(--brand-red)] px-3 py-2 text-center text-sm font-medium text-white"
            >
              오픈채팅 입장
            </a>
          </div>
        )}

        {!otherKakaoId && !openChatRoomUrl && (
          <p className="text-xs text-[var(--muted-foreground)]">
            연락 정보가 아직 등록되지 않았어요
          </p>
        )}
      </CardContent>
    </Card>
  );
}
