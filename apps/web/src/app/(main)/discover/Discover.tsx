"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";
import { ApiError } from "@/lib/api";
import {
  getDiscovery,
  expressInterest,
  type DiscoveryCandidate,
  type DiscoveryTier,
} from "@/lib/api/matching";

const TIER_LABEL: Record<DiscoveryTier, string> = {
  general: "일반 (사회)",
  romantic: "연인",
  deep: "깊은",
};

export function Discover() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // 관심 표시한 후보 id 집합 — 카드 비활성화/메시지 변경용 (재로드 없이 즉시 반영)
  const [interested, setInterested] = useState<Set<string>>(new Set());
  const [actingId, setActingId] = useState<string | null>(null);

  // 필터 — 적용 시점에 fetch (debounce 대신 명시적 "적용" 버튼)
  const [tier, setTier] = useState<DiscoveryTier>("romantic");
  const [ageMin, setAgeMin] = useState<number>(25);
  const [ageMax, setAgeMax] = useState<number>(45);
  const [minScore, setMinScore] = useState<number>(50);
  const [showFilter, setShowFilter] = useState<boolean>(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getDiscovery(token, { tier, ageMin, ageMax, minScore });
      setCandidates(res.candidates);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          router.replace("/login");
          return;
        }
        setErrorMsg(e.message);
      } else {
        setErrorMsg("불러오지 못했어요");
      }
    } finally {
      setLoading(false);
    }
  }, [token, router, tier, ageMin, ageMax, minScore]);

  // 첫 로드만 자동 — 이후엔 사용자가 "적용" 클릭 시 갱신
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleInterest = async (candidateId: string) => {
    if (!token || actingId) return;
    setActingId(candidateId);
    try {
      await expressInterest(token, candidateId);
      setInterested((prev) => new Set(prev).add(candidateId));
      toast.success("관심을 표시했어요");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "처리에 실패했어요";
      toast.error(msg);
    } finally {
      setActingId(null);
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

        <header className="space-y-1">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            당신과 잘 맞는 사람들
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            {TIER_LABEL[tier]} 호환성 점수 {minScore}점 이상 · 만 {ageMin}~{ageMax}세
          </p>
        </header>

        {/* 필터 토글 + 패널 */}
        <div>
          <button
            type="button"
            onClick={() => setShowFilter((v) => !v)}
            className="text-xs text-[var(--brand-gold)] underline"
          >
            {showFilter ? "필터 닫기" : "맞춤 설정"}
          </button>
          {showFilter && (
            <Card className="mt-2 border-none shadow-sm">
              <CardContent className="py-4 space-y-4">
                {/* tier 선택 */}
                <div>
                  <p className="text-xs text-[var(--muted-foreground)] mb-2">호환성 종류</p>
                  <div className="flex gap-2">
                    {(["general", "romantic", "deep"] as DiscoveryTier[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTier(t)}
                        className={`flex-1 rounded border px-2 py-1.5 text-xs ${
                          tier === t
                            ? "border-[var(--brand-gold)] bg-[var(--brand-gold)]/10 text-[var(--foreground)] font-medium"
                            : "border-[var(--muted-foreground)]/20 text-[var(--muted-foreground)]"
                        }`}
                      >
                        {TIER_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 나이 범위 */}
                <div>
                  <p className="text-xs text-[var(--muted-foreground)] mb-2">
                    나이 <span className="text-[var(--foreground)] font-medium">만 {ageMin}~{ageMax}세</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={20}
                      max={ageMax}
                      value={ageMin}
                      onChange={(e) => setAgeMin(Number(e.target.value))}
                      className="w-16 rounded border border-[var(--muted-foreground)]/20 px-2 py-1 text-xs"
                    />
                    <span className="text-xs text-[var(--muted-foreground)]">~</span>
                    <input
                      type="number"
                      min={ageMin}
                      max={80}
                      value={ageMax}
                      onChange={(e) => setAgeMax(Number(e.target.value))}
                      className="w-16 rounded border border-[var(--muted-foreground)]/20 px-2 py-1 text-xs"
                    />
                  </div>
                </div>

                {/* 최소 점수 */}
                <div>
                  <p className="text-xs text-[var(--muted-foreground)] mb-2">
                    최소 호환성 점수 <span className="text-[var(--foreground)] font-medium">{minScore}점</span>
                  </p>
                  <input
                    type="range"
                    min={50}
                    max={95}
                    step={5}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    void load();
                    setShowFilter(false);
                  }}
                  className="w-full bg-[var(--brand-red)] text-white"
                >
                  적용
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {loading ? (
          <p className="mt-12 text-center text-sm text-[var(--muted-foreground)]">
            불러오는 중...
          </p>
        ) : errorMsg ? (
          <Card className="border-none shadow-sm">
            <CardContent className="py-8 text-center space-y-3">
              <p className="text-sm text-[var(--brand-red)]">{errorMsg}</p>
              <Button variant="outline" onClick={load}>다시 시도</Button>
            </CardContent>
          </Card>
        ) : candidates.length === 0 ? (
          <Card className="border-none shadow-sm">
            <CardContent className="py-10 text-center space-y-2">
              <p className="text-sm text-[var(--muted-foreground)]">
                지금은 추천할 후보가 없어요
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                새로운 사용자가 가입하면 다시 표시됩니다
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <DiscoveryCard
                key={c.id}
                candidate={c}
                isInterested={interested.has(c.id)}
                isActing={actingId === c.id}
                onInterest={() => handleInterest(c.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DiscoveryCard({
  candidate,
  isInterested,
  isActing,
  onInterest,
}: {
  candidate: DiscoveryCandidate;
  isInterested: boolean;
  isActing: boolean;
  onInterest: () => void;
}) {
  return (
    <Card
      className={`border-none shadow-sm overflow-hidden transition-opacity ${
        isInterested ? "opacity-60" : ""
      }`}
    >
      <div className="h-1 bg-[var(--brand-gold)]" />
      <CardContent className="py-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="font-[family-name:var(--font-serif)] text-lg text-[var(--foreground)]">
            {candidate.nickname}
          </p>
          <span className="text-xs text-[var(--muted-foreground)]">
            {candidate.ageRange}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[var(--brand-gold)]">
            {candidate.score}점
          </span>
          <span className="text-sm">{candidate.emoji}</span>
          <span className="text-xs text-[var(--muted-foreground)]">{candidate.label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span>일주</span>
          <span className="font-bold text-[var(--foreground)]">{candidate.dayPillar}</span>
        </div>
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          {candidate.summaryOneLiner}
        </p>
        <Button
          type="button"
          onClick={onInterest}
          disabled={isInterested || isActing}
          className={`w-full ${
            isInterested
              ? "bg-[var(--muted-foreground)]/20 text-[var(--muted-foreground)]"
              : "bg-[var(--brand-red)] text-white"
          }`}
        >
          {isInterested ? "관심 표시함" : isActing ? "처리 중..." : "관심 표시"}
        </Button>
      </CardContent>
    </Card>
  );
}
