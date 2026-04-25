"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useSavedMatchesStore, type SavedMatch } from "@/stores/savedMatchesStore";
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

function MatchCard({
  match,
  onRemove,
}: {
  match: SavedMatch;
  onRemove: (id: string) => void;
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

export default function MatchesPage() {
  const router = useRouter();
  const { matches, remove } = useSavedMatchesStore();
  const { pillars } = useOnboardingStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useSavedMatchesStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useSavedMatchesStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  const handleNewMatch = () => {
    // 사주 미입력이면 saju-input 부터, 있으면 바로 preferences 로
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
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            매칭
          </h1>
          <Button
            type="button"
            onClick={handleNewMatch}
            className="bg-[var(--brand-red)] hover:bg-[var(--brand-red)]/90 text-white text-sm px-4 py-2"
          >
            매칭하기
          </Button>
        </div>

        <div>
          <p className="text-sm text-[var(--muted-foreground)] mb-3">
            탐색 중인 매칭 대상 ({matches.length})
          </p>

          {matches.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="py-10 text-center space-y-2">
                <p className="text-[var(--muted-foreground)]">
                  아직 등록된 매칭 대상이 없어요
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  '매칭하기' 를 눌러 이상적인 상대 사주를 찾아보세요
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {matches.map((m) => (
                <MatchCard key={m.id} match={m} onRemove={remove} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
