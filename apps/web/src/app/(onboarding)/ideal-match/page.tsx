"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useSavedMatchesStore } from "@/stores/savedMatchesStore";
import { STEM_TO_ELEMENT, ELEMENT_NAMES, STEM_KOREAN, BRANCH_KOREAN } from "@/lib/saju/constants";
import type { IdealMatchProfileV2 } from "@/lib/saju/reverseMatch-v2";
import type { Element } from "@/lib/saju/types";

const ELEMENT_COLORS: Record<Element, string> = {
  wood: "var(--element-wood)",
  fire: "var(--element-fire)",
  earth: "var(--element-earth)",
  metal: "var(--element-metal)",
  water: "var(--element-water)",
};

const CATEGORY_LABELS: Record<string, string> = {
  romance: "연애",
  marriage: "결혼",
  wealth: "재물",
  children: "자녀",
  health: "건강",
  personality: "성격",
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-xs text-[var(--muted-foreground)]">{label}</span>
      <div className="flex-1 h-2 bg-[var(--muted)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--brand-gold)] transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-medium">{score}</span>
    </div>
  );
}

function PillarCell({ label, hanja }: { label: string; hanja: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-[family-name:var(--font-serif)] font-bold">{hanja}</p>
      <p className="text-[10px] text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}

function ProfileCard({
  profile,
  onSelect,
  alreadySaved,
}: {
  profile: IdealMatchProfileV2;
  onSelect: (profile: IdealMatchProfileV2) => void;
  alreadySaved: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const stemElement = STEM_TO_ELEMENT[profile.pillars.day.stem];
  const elementName = ELEMENT_NAMES[stemElement];

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <div
        className="h-2"
        style={{ backgroundColor: ELEMENT_COLORS[stemElement] }}
      />
      <CardContent className="pt-4 space-y-4">
        {/* 헤더: 순위 + 점수 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white font-bold text-sm"
              style={{ backgroundColor: ELEMENT_COLORS[stemElement] }}
            >
              {profile.rank}
            </div>
            <div>
              <Badge
                variant="secondary"
                className="text-xs"
                style={{ color: ELEMENT_COLORS[stemElement] }}
              >
                {elementName.hanja}({elementName.ko})
              </Badge>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {profile.ageRange}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[var(--brand-gold)]">
              {profile.totalScore}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">궁합 점수</p>
          </div>
        </div>

        {/* 사주 4기둥 표시 */}
        <div className="grid grid-cols-4 gap-2 py-3 px-2 bg-[var(--muted)]/30 rounded-lg">
          <div className="text-center">
            <p className="text-[10px] text-[var(--muted-foreground)] mb-1">시주</p>
            <PillarCell
              hanja={profile.pillars.hour ? `${profile.pillars.hour.stem}${profile.pillars.hour.branch}` : '??'}
              label={profile.pillarLabels.hour}
            />
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[var(--muted-foreground)] mb-1">일주</p>
            <PillarCell
              hanja={`${profile.pillars.day.stem}${profile.pillars.day.branch}`}
              label={profile.pillarLabels.day}
            />
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[var(--muted-foreground)] mb-1">월주</p>
            <PillarCell
              hanja={`${profile.pillars.month.stem}${profile.pillars.month.branch}`}
              label={profile.pillarLabels.month}
            />
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[var(--muted-foreground)] mb-1">연주</p>
            <PillarCell
              hanja={`${profile.pillars.year.stem}${profile.pillars.year.branch}`}
              label={profile.pillarLabels.year}
            />
          </div>
        </div>

        {/* 대표 생년월일시 — 이 사주에 해당하는 실제 생일 예시 */}
        {profile.matchingDates.length > 0 && (
          <div className="text-center text-xs text-[var(--muted-foreground)] -mt-1">
            예: <span className="font-medium text-[var(--foreground)]">
              {profile.matchingDates[0].date}
            </span> ({profile.matchingDates[0].dayOfWeek}){" "}
            {profile.matchingDates[0].hour}생 · 만 {profile.matchingDates[0].age}세
          </div>
        )}

        {/* 성향 요약 */}
        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
          {profile.description.personality}
        </p>

        {/* 궁합 포인트 */}
        {profile.narrative.synergies.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--foreground)]">궁합 포인트</p>
            {profile.narrative.synergies.map((s, i) => (
              <p key={i} className="text-xs text-[var(--muted-foreground)] pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-[var(--brand-gold)]">
                {s}
              </p>
            ))}
          </div>
        )}

        {/* 주의사항 */}
        {profile.narrative.cautions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--foreground)]">참고사항</p>
            {profile.narrative.cautions.map((c, i) => (
              <p key={i} className="text-xs text-[var(--muted-foreground)] pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-[var(--muted-foreground)]">
                {c}
              </p>
            ))}
          </div>
        )}

        {/* 항목별 점수 바 */}
        <div className="space-y-2">
          {Object.entries(profile.breakdown).map(([key, score]) => (
            <ScoreBar
              key={key}
              label={CATEGORY_LABELS[key] || key}
              score={score as number}
            />
          ))}
        </div>

        {/* 매칭 날짜 (토글) */}
        {profile.matchingDates.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-[var(--brand-gold)] font-medium hover:underline"
            >
              {expanded ? "접기" : `이 사주의 생일 ${profile.matchingDates.length}개 보기`}
            </button>
            {expanded && (
              <div className="mt-2 space-y-1 pl-2 border-l-2 border-[var(--brand-gold)]/30">
                {profile.matchingDates.map((d, i) => (
                  <p key={i} className="text-xs text-[var(--muted-foreground)]">
                    {d.date} ({d.dayOfWeek}) {d.hour} — 만 {d.age}세
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 종합 서사 */}
        <p className="text-xs text-center text-[var(--muted-foreground)] italic border-t border-[var(--border)] pt-3">
          {profile.narrative.summary}
        </p>

        {/* 매칭 등록 CTA */}
        <Button
          type="button"
          onClick={() => onSelect(profile)}
          disabled={alreadySaved}
          className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red)]/90 text-white py-5 text-sm disabled:opacity-50"
        >
          {alreadySaved ? "이미 매칭 대상에 등록됨" : "이 사주로 매칭"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function IdealMatchPage() {
  const router = useRouter();
  const { idealProfiles } = useOnboardingStore();
  const { matches: savedMatches, add: addSavedMatch } = useSavedMatchesStore();
  const [showAll, setShowAll] = useState(false);

  // zustand persist hydration race 방어 — 하드 내비로 들어온 직후 첫 렌더 시
  // localStorage 로부터 복원 전이라 idealProfiles 가 잠시 [] 일 수 있음.
  // hasHydrated() 가 true 되기 전엔 빈 화면 분기를 타지 않도록 대기. (SSR 미스매치
  // 방지를 위해 초기값은 false 로 고정하고 useEffect 안에서만 갱신.)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (
      useOnboardingStore.persist.hasHydrated() &&
      useSavedMatchesStore.persist.hasHydrated()
    ) {
      setHydrated(true);
      return;
    }
    const unsubA = useOnboardingStore.persist.onFinishHydration(() => {
      if (useSavedMatchesStore.persist.hasHydrated()) setHydrated(true);
    });
    const unsubB = useSavedMatchesStore.persist.onFinishHydration(() => {
      if (useOnboardingStore.persist.hasHydrated()) setHydrated(true);
    });
    return () => {
      unsubA();
      unsubB();
    };
  }, []);

  // 같은 사주(일주 + 시주 + 월주 + 연주)가 이미 저장됐는지 판별
  const matchKey = (p: IdealMatchProfileV2) =>
    `${p.pillars.year.stem}${p.pillars.year.branch}` +
    `-${p.pillars.month.stem}${p.pillars.month.branch}` +
    `-${p.pillars.day.stem}${p.pillars.day.branch}` +
    `-${p.pillars.hour ? `${p.pillars.hour.stem}${p.pillars.hour.branch}` : "??"}`;
  const savedKeys = new Set(savedMatches.map((m) => matchKey(m.profile)));

  const handleSelect = (profile: IdealMatchProfileV2) => {
    addSavedMatch(profile);
    toast.success("매칭 대상에 등록되었어요", {
      description: "매칭 탭에서 확인할 수 있어요.",
    });
    router.push("/matches");
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-serif)] text-4xl text-[var(--brand-red)] animate-pulse">
            緣
          </h1>
          <p className="mt-4 text-[var(--muted-foreground)]">결과 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (idealProfiles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <p className="text-[var(--muted-foreground)]">이상적 상대 정보가 없습니다</p>
          <Button
            onClick={() => router.push("/saju-input")}
            className="mt-4 bg-[var(--brand-red)] text-white"
          >
            처음부터 시작하기
          </Button>
        </div>
      </div>
    );
  }

  const displayProfiles = showAll ? idealProfiles : idealProfiles.slice(0, 3);

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8">
      <div className="mx-auto max-w-md space-y-6">
        {/* 뒤로가기 */}
        <button onClick={() => router.back()} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          &larr; 뒤로
        </button>

        <div className="text-center">
          <p className="text-sm text-[var(--brand-gold)] font-medium">Step 4 / 4</p>
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)] mt-1">
            이상적 상대 사주
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            당신과 가장 잘 맞는 사주 {showAll ? `Top ${idealProfiles.length}` : "Top 3"}
          </p>
        </div>

        {/* 프로파일 카드 */}
        {displayProfiles.map((profile) => (
          <ProfileCard
            key={profile.rank}
            profile={profile}
            onSelect={handleSelect}
            alreadySaved={savedKeys.has(matchKey(profile))}
          />
        ))}

        {/* 프리미엄 유도 — Top 10 보기 */}
        {!showAll && idealProfiles.length > 3 && (
          <Card className="border border-dashed border-[var(--brand-gold)] bg-[var(--brand-gold)]/5">
            <CardContent className="py-6 text-center">
              <p className="font-[family-name:var(--font-serif)] text-lg text-[var(--brand-gold)]">
                나머지 {idealProfiles.length - 3}개 결과 더 보기
              </p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                더 많은 이상적 상대를 확인하세요
              </p>
              <Button
                onClick={() => setShowAll(true)}
                className="mt-4 bg-[var(--brand-gold)] hover:bg-[var(--brand-gold)]/90 text-white"
              >
                Top {idealProfiles.length} 전체 보기
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 매칭 탭으로 가기 (이미 등록된 항목 확인용) */}
        {savedMatches.length > 0 && (
          <Button
            onClick={() => router.push("/matches")}
            variant="outline"
            className="w-full border-[var(--brand-gold)] text-[var(--brand-gold)] py-5 text-sm"
          >
            매칭 탭에서 등록된 대상 보기 ({savedMatches.length})
          </Button>
        )}
      </div>
    </div>
  );
}
