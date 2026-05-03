"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import {
  useSavedMatchesStore,
  getSavedMatchLimit,
  type SavedMatch,
} from "@/stores/savedMatchesStore";
import { handleRemoveError } from "@/lib/savedMatches/errorToasts";
import { usePremium } from "@/hooks/usePremium";
import { STEM_TO_ELEMENT, ELEMENT_NAMES } from "@/lib/saju/constants";
import type { Element } from "@/lib/saju/types";

const ELEMENT_COLORS: Record<Element, string> = {
  wood: "var(--element-wood)",
  fire: "var(--element-fire)",
  earth: "var(--element-earth)",
  metal: "var(--element-metal)",
  water: "var(--element-water)",
};

function formatRelative(savedAt: number): string {
  const diff = Date.now() - savedAt;
  const m = Math.floor(diff / (1000 * 60));
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

function IdealTargetCard({
  match,
  onRemove,
}: {
  match: SavedMatch;
  onRemove: (id: string) => void | Promise<void>;
}) {
  const stemEl = STEM_TO_ELEMENT[match.profile.pillars.day.stem];
  const elName = ELEMENT_NAMES[stemEl];

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: ELEMENT_COLORS[stemEl] }} />
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-base"
              style={{ backgroundColor: ELEMENT_COLORS[stemEl] }}
            >
              {match.profile.totalScore}
            </div>
            <div>
              <p className="text-sm font-medium">
                {match.profile.pillars.day.stem}{match.profile.pillars.day.branch}
                <span className="ml-1 text-xs text-[var(--muted-foreground)]">일주</span>
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {elName.hanja}({elName.ko}) · {match.profile.ageRange}
              </p>
            </div>
          </div>
          <Badge variant="secondary">탐색 중</Badge>
        </div>

        {match.profile.matchingDates.length > 0 && (
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            예: {match.profile.matchingDates[0].date} ({match.profile.matchingDates[0].dayOfWeek}) {match.profile.matchingDates[0].hour}생
          </p>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
          <p className="text-[11px] text-[var(--muted-foreground)]">
            {formatRelative(match.savedAt)} 저장
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("이 매칭 대상을 삭제할까요?")) onRemove(match.id);
            }}
            className="text-[11px] text-[var(--muted-foreground)] underline"
          >
            삭제
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FindPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const { pillars } = useOnboardingStore();
  const { isPremium } = usePremium();

  const idealMatches = useSavedMatchesStore((s) => s.matches);
  const idealMeta = useSavedMatchesStore((s) => s.meta);
  const idealSyncStatus = useSavedMatchesStore((s) => s.syncStatus);
  const idealLimit = idealMeta?.limit ?? getSavedMatchLimit(isPremium);
  const idealLimitReached = idealMatches.length >= idealLimit;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useSavedMatchesStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useSavedMatchesStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  const handleRemoveIdeal = async (id: string) => {
    const result = await useSavedMatchesStore.getState().removeOptimistic(id, token);
    if (!result.ok) handleRemoveError(result.error);
  };

  const handleNewIdeal = () => {
    if (idealLimitReached) {
      router.push(isPremium ? "/find" : "/premium");
      return;
    }
    if (!pillars) {
      router.push("/saju-input");
      return;
    }
    router.push("/preferences");
  };

  if (!hydrated) {
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
        <header>
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            인연 찾기
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            천생연분 사주를 등록해 알림 받거나, 지금 가입한 사람 중 잘 맞는 후보를 둘러보세요
          </p>
        </header>

        {/* ─── 🔮 천생연분 찾기 ─── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-[var(--foreground)]">🔮 천생연분 찾기</h2>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                이상적 상대 사주를 등록 — 일치하는 사람이 가입하면 알림
              </p>
            </div>
            <Button
              type="button"
              onClick={handleNewIdeal}
              disabled={idealLimitReached}
              className="bg-[var(--brand-red)] hover:bg-[var(--brand-red)]/90 text-white text-xs px-3 py-1.5 disabled:opacity-50"
            >
              + 추가
            </Button>
          </div>

          {token && idealSyncStatus === "error" && idealMatches.length > 0 && (
            <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)]/40 rounded-md px-3 py-2">
              최신 데이터를 불러오지 못했어요. 새로고침 시 재시도됩니다.
            </div>
          )}

          <Card className="border-none shadow-sm bg-[var(--brand-gold)]/5">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    등록 한도{" "}
                    <span className="font-bold text-[var(--brand-gold)]">
                      {idealMatches.length} / {idealLimit}
                    </span>
                  </p>
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                    {isPremium ? "프리미엄 회원" : "일반 회원 — 프리미엄 시 최대 10개까지"}
                  </p>
                </div>
                {!isPremium && (
                  <button
                    type="button"
                    onClick={() => router.push("/premium")}
                    className="text-xs text-[var(--brand-gold)] underline"
                  >
                    업그레이드
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {idealMatches.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="py-8 text-center space-y-2">
                <p className="text-sm text-[var(--muted-foreground)]">
                  아직 등록된 매칭 대상이 없어요
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  '추가' 를 눌러 이상적인 상대 사주를 찾아보세요
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {idealMatches.map((m) => (
                <IdealTargetCard key={m.id} match={m} onRemove={handleRemoveIdeal} />
              ))}
            </div>
          )}
        </section>

        {/* ─── ✨ 탐색하기 ─── */}
        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-medium text-[var(--foreground)]">✨ 탐색하기</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              지금 가입한 사람 중 나와 잘 맞는 후보를 호환성 점수순으로 추천
            </p>
          </div>
          {token ? (
            <Card
              className="border-none shadow-sm cursor-pointer overflow-hidden bg-[var(--brand-gold)]/5 hover:shadow-md transition-shadow"
              onClick={() => router.push("/discover")}
            >
              <CardContent className="py-4 flex items-center justify-between">
                <p className="text-sm text-[var(--foreground)]">
                  당신과 잘 맞는 사람들 보기
                </p>
                <span className="text-[var(--brand-gold)]">→</span>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border border-[var(--muted-foreground)]/20 bg-transparent">
              <CardContent className="py-3 text-center text-xs text-[var(--muted-foreground)]">
                로그인 후 이용할 수 있어요
              </CardContent>
            </Card>
          )}
        </section>

        {/* 비로그인 CTA */}
        {!token && idealMatches.length > 0 && (
          <Card className="border border-dashed border-[var(--brand-gold)]/50 bg-[var(--brand-gold)]/5">
            <CardContent className="py-4 text-center space-y-2">
              <p className="text-sm text-[var(--foreground)]">
                로그인하면 다른 기기에서도 볼 수 있어요
              </p>
              <Button
                onClick={() => router.push("/login")}
                size="sm"
                className="bg-[#FEE500] text-[#191919] hover:bg-[#FDD835] text-xs font-bold"
              >
                카카오로 로그인
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
