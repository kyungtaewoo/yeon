"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { STEM_KOREAN, BRANCH_KOREAN, ELEMENT_NAMES, STEM_TO_ELEMENT, BRANCH_TO_ELEMENT } from "@/lib/saju/constants";
import type { Element, HeavenlyStem, EarthlyBranch } from "@/lib/saju/types";

const ELEMENT_COLORS: Record<Element, string> = {
  wood: "var(--element-wood)",
  fire: "var(--element-fire)",
  earth: "var(--element-earth)",
  metal: "var(--element-metal)",
  water: "var(--element-water)",
};

interface SajuProfile {
  yearStem: HeavenlyStem;
  yearBranch: EarthlyBranch;
  monthStem: HeavenlyStem;
  monthBranch: EarthlyBranch;
  dayStem: HeavenlyStem;
  dayBranch: EarthlyBranch;
  hourStem: HeavenlyStem | null;
  hourBranch: EarthlyBranch | null;
  dominantElement: Element | null;
  yongshin: Element | null;
  elementScores: Record<Element, number> | null;
  reportData: Record<string, string> | null;
}

interface SajuReportResponse {
  profile: SajuProfile;
}

function PillarCard({ label, stem, branch }: { label: string; stem: HeavenlyStem | null; branch: EarthlyBranch | null }) {
  if (!stem || !branch) {
    return (
      <div className="text-center">
        <p className="text-xs text-[var(--muted-foreground)] mb-2">{label}</p>
        <div className="rounded-lg bg-[var(--muted)] p-3">
          <p className="text-lg text-[var(--muted-foreground)]">?</p>
          <p className="text-lg text-[var(--muted-foreground)]">?</p>
        </div>
      </div>
    );
  }

  const stemEl = STEM_TO_ELEMENT[stem];
  const branchEl = BRANCH_TO_ELEMENT[branch];

  return (
    <div className="text-center">
      <p className="text-xs text-[var(--muted-foreground)] mb-2">{label}</p>
      <div className="rounded-lg bg-white p-3 shadow-sm space-y-1">
        <p className="text-2xl font-bold font-[family-name:var(--font-serif)]" style={{ color: ELEMENT_COLORS[stemEl] }}>
          {stem}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">{STEM_KOREAN[stem]}</p>
        <div className="h-px bg-[var(--border)]" />
        <p className="text-2xl font-bold font-[family-name:var(--font-serif)]" style={{ color: ELEMENT_COLORS[branchEl] }}>
          {branch}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">{BRANCH_KOREAN[branch]}</p>
      </div>
    </div>
  );
}

export default function MySajuPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const [saju, setSaju] = useState<SajuProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    // 비로그인 — API 호출 없이 빈 상태로 (사주 입력 안내 화면 보여주기)
    if (!user || !token) {
      setLoading(false);
      return;
    }

    const fetchSaju = async () => {
      try {
        const res = await apiClient<SajuReportResponse | null>('/saju/report', { token });
        if (res?.profile) setSaju(res.profile);
      } catch (err) {
        console.error("사주 조회 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSaju();
  }, [user, token, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-md text-center">
          <p className="text-[var(--muted-foreground)]">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!saju) {
    return (
      <div className="px-4 py-6">
        <div className="mx-auto max-w-md text-center space-y-4">
          <p className="text-[var(--muted-foreground)]">사주 정보가 없습니다</p>
          <Button onClick={() => router.push("/saju-input")} className="bg-[var(--brand-red)] text-white">
            사주 입력하기
          </Button>
        </div>
      </div>
    );
  }

  const elements: Element[] = ["wood", "fire", "earth", "metal", "water"];
  const scores = saju.elementScores || { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const maxScore = Math.max(...elements.map((e) => scores[e] || 0));

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
          내 사주
        </h1>

        {/* 사주 4기둥 */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="grid grid-cols-4 gap-3">
              <PillarCard label="시주" stem={saju.hourStem} branch={saju.hourBranch} />
              <PillarCard label="일주" stem={saju.dayStem} branch={saju.dayBranch} />
              <PillarCard label="월주" stem={saju.monthStem} branch={saju.monthBranch} />
              <PillarCard label="연주" stem={saju.yearStem} branch={saju.yearBranch} />
            </div>
          </CardContent>
        </Card>

        {/* 오행 밸런스 */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6 space-y-3">
            <h2 className="font-[family-name:var(--font-serif)] text-lg font-bold mb-2">오행 밸런스</h2>
            {elements.map((el) => (
              <div key={el} className="flex items-center gap-2">
                <span className="w-8 text-center text-sm font-bold font-[family-name:var(--font-serif)]" style={{ color: ELEMENT_COLORS[el] }}>
                  {ELEMENT_NAMES[el].hanja}
                </span>
                <div className="flex-1 h-3 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${maxScore > 0 ? ((scores[el] || 0) / maxScore) * 100 : 0}%`, backgroundColor: ELEMENT_COLORS[el] }}
                  />
                </div>
                <span className="w-8 text-right text-xs text-[var(--muted-foreground)]">{scores[el] || 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 용신 & 주요 오행 */}
        <div className="grid grid-cols-2 gap-3">
          {saju.dominantElement && (
            <Card className="border-none shadow-sm">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-[var(--muted-foreground)]">주요 오행</p>
                <p className="text-2xl font-bold font-[family-name:var(--font-serif)] mt-1" style={{ color: ELEMENT_COLORS[saju.dominantElement] }}>
                  {ELEMENT_NAMES[saju.dominantElement].hanja}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">{ELEMENT_NAMES[saju.dominantElement].ko}</p>
              </CardContent>
            </Card>
          )}
          {saju.yongshin && (
            <Card className="border-none shadow-sm">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-[var(--muted-foreground)]">용신</p>
                <p className="text-2xl font-bold font-[family-name:var(--font-serif)] mt-1" style={{ color: ELEMENT_COLORS[saju.yongshin] }}>
                  {ELEMENT_NAMES[saju.yongshin].hanja}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">{ELEMENT_NAMES[saju.yongshin].ko}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 리포트 요약 */}
        {saju.reportData && (
          <>
            {["personality", "romance", "wealth", "health"].map((key) => {
              const labels: Record<string, { title: string; icon: string }> = {
                personality: { title: "성격", icon: "🧠" },
                romance: { title: "연애", icon: "💕" },
                wealth: { title: "재물", icon: "💰" },
                health: { title: "건강", icon: "🏥" },
              };
              const info = labels[key];
              const content = saju.reportData?.[key];
              if (!info || !content) return null;
              return (
                <Card key={key} className="border-none shadow-sm">
                  <CardContent className="pt-4">
                    <h3 className="font-[family-name:var(--font-serif)] text-base font-bold mb-1">
                      {info.icon} {info.title}
                    </h3>
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{content}</p>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
