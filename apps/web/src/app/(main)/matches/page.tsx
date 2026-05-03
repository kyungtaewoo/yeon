"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/authStore";
import { apiClient, ApiError } from "@/lib/api";
import type { MatchEntity } from "@/lib/api/matching";

function formatRelative(when: number | string): string {
  const ms = typeof when === "string" ? new Date(when).getTime() : when;
  const diff = Date.now() - ms;
  const m = Math.floor(diff / (1000 * 60));
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

/** 매칭 출처 라벨 — 'discovery' / 'ideal_match' 분기 */
function sourceLabel(source: MatchEntity["source"]): { emoji: string; text: string } {
  if (source === "ideal_match") return { emoji: "🔮", text: "천생연분" };
  return { emoji: "✨", text: "탐색하기" };
}

function MatchRow({
  match,
  myId,
  variant,
  onClick,
}: {
  match: MatchEntity;
  myId: string;
  variant: "received" | "sent" | "matched";
  onClick: () => void;
}) {
  const score = match.compatibilityScore ?? match.idealMatchScore;
  const isProposer = match.userAId === myId;
  const counterpartLabel = isProposer ? "받는 사람" : "제안자";
  const dateIso = match.proposedAt ?? match.createdAt;
  const src = sourceLabel(match.source);

  let badgeText = "";
  let badgeVariant: "default" | "secondary" | "destructive" = "secondary";
  if (variant === "received") {
    badgeText = "응답 필요";
    badgeVariant = "default";
  } else if (variant === "sent") {
    badgeText = "응답 대기";
    badgeVariant = "secondary";
  } else {
    badgeText = "매칭 성사 🎉";
    badgeVariant = "default";
  }

  return (
    <Card
      className="border-none shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="py-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--brand-gold)]/10 px-2 py-0.5 text-[10px] text-[var(--brand-gold)]">
              {src.emoji} {src.text}
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">{counterpartLabel}</span>
            {score != null && (
              <span className="text-[var(--brand-gold)] font-bold text-sm">
                {Math.round(Number(score))}점
              </span>
            )}
          </div>
          {match.proposalMessage && (
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)] truncate">
              "{match.proposalMessage}"
            </p>
          )}
          <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
            {formatRelative(dateIso)}
          </p>
        </div>
        <Badge variant={badgeVariant}>{badgeText}</Badge>
      </CardContent>
    </Card>
  );
}

export default function MatchesPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user);
  const [matches, setMatches] = useState<MatchEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await apiClient<{ matches: MatchEntity[] }>("/matching", { token });
        setMatches(res.matches ?? []);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setErrorMsg("불러오지 못했어요");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, router]);

  if (!token) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-md space-y-6">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            매칭
          </h1>
          <Card className="border-dashed border border-[var(--muted-foreground)]/20 bg-transparent">
            <CardContent className="py-6 text-center text-xs text-[var(--muted-foreground)]">
              로그인 후 이용할 수 있어요
            </CardContent>
          </Card>
          <Button
            onClick={() => router.push("/login")}
            className="w-full bg-[#FEE500] text-[#191919] hover:bg-[#FDD835] font-bold"
          >
            카카오로 로그인
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-md text-center py-20 text-sm text-[var(--muted-foreground)]">
          불러오는 중...
        </div>
      </div>
    );
  }

  const myId = me?.id ?? "";
  const received = matches.filter((m) => m.status === "proposed" && m.userBId === myId);
  const sent = matches.filter((m) => m.status === "proposed" && m.userAId === myId);
  const accepted = matches.filter((m) => m.status === "accepted");

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-md space-y-6">
        <header>
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            매칭
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            제안 / 응답 / 성사된 인연을 한눈에
          </p>
        </header>

        {errorMsg && (
          <Card className="border-none shadow-sm">
            <CardContent className="py-4 text-center text-xs text-[var(--brand-red)]">
              {errorMsg}
            </CardContent>
          </Card>
        )}

        {/* 받은 제안 */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--foreground)]">
            받은 제안 ({received.length}개)
          </h2>
          {received.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="py-5 text-center text-xs text-[var(--muted-foreground)]">
                받은 제안이 없어요
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {received.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  myId={myId}
                  variant="received"
                  onClick={() => router.push(`/match-detail?id=${m.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 보낸 제안 */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--foreground)]">
            내가 보낸 제안 ({sent.length}개)
          </h2>
          {sent.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="py-5 text-center text-xs text-[var(--muted-foreground)]">
                보낸 제안이 없어요. <button type="button" onClick={() => router.push("/find")} className="text-[var(--brand-gold)] underline">인연 찾기</button> 에서 시작하세요
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sent.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  myId={myId}
                  variant="sent"
                  onClick={() => router.push(`/match-detail?id=${m.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 매칭됨 */}
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--foreground)]">
            매칭됨 ({accepted.length}개)
          </h2>
          {accepted.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="py-5 text-center text-xs text-[var(--muted-foreground)]">
                아직 매칭된 인연이 없어요
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {accepted.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  myId={myId}
                  variant="matched"
                  onClick={() => router.push(`/match-detail?id=${m.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
