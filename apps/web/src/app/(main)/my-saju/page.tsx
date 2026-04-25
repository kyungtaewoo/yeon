"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingStore } from "@/stores/onboardingStore";
import {
  STEM_KOREAN, BRANCH_KOREAN, ELEMENT_NAMES, STEM_TO_ELEMENT, BRANCH_TO_ELEMENT,
} from "@/lib/saju/constants";
import type { Element, HeavenlyStem, EarthlyBranch } from "@/lib/saju/types";

const ELEMENT_COLORS: Record<Element, string> = {
  wood: "var(--element-wood)",
  fire: "var(--element-fire)",
  earth: "var(--element-earth)",
  metal: "var(--element-metal)",
  water: "var(--element-water)",
};

const HOUR_LABELS: Record<number, string> = {
  0: "자시 (23:00~01:00)",
  2: "축시 (01:00~03:00)",
  4: "인시 (03:00~05:00)",
  6: "묘시 (05:00~07:00)",
  8: "진시 (07:00~09:00)",
  10: "사시 (09:00~11:00)",
  12: "오시 (11:00~13:00)",
  14: "미시 (13:00~15:00)",
  16: "신시 (15:00~17:00)",
  18: "유시 (17:00~19:00)",
  20: "술시 (19:00~21:00)",
  22: "해시 (21:00~23:00)",
};

// 서버가 반환하는 raw 사주 프로필. yongshin 은 한글 문자열 ('목' 등) 로
// 저장돼 있어 Element 타입과 별개. dominantElement 도 안전하게 string 로 받음.
interface RawSajuProfile {
  yearStem: HeavenlyStem;
  yearBranch: EarthlyBranch;
  monthStem: HeavenlyStem;
  monthBranch: EarthlyBranch;
  dayStem: HeavenlyStem;
  dayBranch: EarthlyBranch;
  hourStem: HeavenlyStem | null;
  hourBranch: EarthlyBranch | null;
  dominantElement: string | null;
  yongshin: string | null;
  elementScores: Record<Element, number> | null;
  reportData: Record<string, string> | null;
}

// 정규화 후 화면에서 쓰는 형태
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
  profile: RawSajuProfile;
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

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0">
      <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
      <span className="text-sm font-medium text-[var(--foreground)]">
        {value ?? <span className="text-[var(--muted-foreground)]">미입력</span>}
      </span>
    </div>
  );
}

export default function MySajuPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const {
    birthYear, birthMonth, birthDay, birthHour,
    isLunar, gender,
    pillars: storePillars,
    report: storeReport,
  } = useOnboardingStore();

  const [serverSaju, setServerSaju] = useState<RawSajuProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !token) {
      setLoading(false);
      return;
    }

    const fetchSaju = async () => {
      try {
        const res = await apiClient<SajuReportResponse | null>('/saju/report', { token });
        if (res?.profile) setServerSaju(res.profile);
      } catch (err) {
        console.error("사주 조회 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSaju();
  }, [user, token, authLoading]);

  // 서버는 yongshin 을 한글 ('목', '화'...) 로, store 는 Element ('wood'...) 로
  // 저장하는 미스매치가 있어 정규화. 알 수 없는 값이면 null.
  const normalizeElement = (v: unknown): Element | null => {
    if (!v || typeof v !== "string") return null;
    if (v in ELEMENT_NAMES) return v as Element;
    const koToEl = Object.entries(ELEMENT_NAMES).find(([, n]) => n.ko === v || n.hanja === v);
    return koToEl ? (koToEl[0] as Element) : null;
  };

  // 사주 4기둥/리포트 — 서버 우선, 없으면 데모 store
  const saju = useMemo<SajuProfile | null>(() => {
    if (serverSaju) {
      return {
        ...serverSaju,
        dominantElement: normalizeElement(serverSaju.dominantElement),
        yongshin: normalizeElement(serverSaju.yongshin),
      };
    }
    if (!storePillars) return null;
    const r = storeReport;
    return {
      yearStem: storePillars.year.stem,
      yearBranch: storePillars.year.branch,
      monthStem: storePillars.month.stem,
      monthBranch: storePillars.month.branch,
      dayStem: storePillars.day.stem,
      dayBranch: storePillars.day.branch,
      hourStem: storePillars.hour?.stem ?? null,
      hourBranch: storePillars.hour?.branch ?? null,
      dominantElement: normalizeElement(r?.dominantElement),
      yongshin: normalizeElement(r?.yongshin),
      elementScores: r?.elementScores ?? null,
      reportData: r
        ? {
            personality: r.personality,
            romance: r.romance,
            wealth: r.wealth,
            health: r.health,
          }
        : null,
    };
  }, [serverSaju, storePillars, storeReport]);

  const hasBirthInfo = !!(birthYear && birthMonth && birthDay);
  const editButtonLabel = hasBirthInfo ? "사주 정보 수정" : "사주 입력하기";

  if (authLoading || loading) {
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
        <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
          내 사주
        </h1>

        {/* 기본 정보 */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <h2 className="text-sm font-medium text-[var(--muted-foreground)] mb-2">기본 정보</h2>
            <div>
              <InfoRow
                label="생년월일"
                value={hasBirthInfo ? `${birthYear}년 ${birthMonth}월 ${birthDay}일` : null}
              />
              <InfoRow label="달력" value={hasBirthInfo ? (isLunar ? "음력" : "양력") : null} />
              <InfoRow label="성별" value={gender ? (gender === "male" ? "남성" : "여성") : null} />
              <InfoRow
                label="출생 시간"
                value={
                  hasBirthInfo
                    ? birthHour !== null && birthHour !== undefined
                      ? HOUR_LABELS[birthHour] ?? "—"
                      : "모름"
                    : null
                }
              />
            </div>
            <Button
              type="button"
              onClick={() => router.push("/saju-input")}
              variant="outline"
              className="mt-4 w-full border-[var(--brand-gold)] text-[var(--brand-gold)] hover:bg-[var(--brand-gold)]/5"
            >
              {editButtonLabel}
            </Button>
          </CardContent>
        </Card>

        {/* 사주 데이터 미입력 시엔 여기서 끝 */}
        {!saju ? (
          <p className="text-center text-sm text-[var(--muted-foreground)] py-4">
            사주를 입력하면 사주팔자 분석이 표시돼요
          </p>
        ) : (
          <>
            {/* 사주 4기둥 */}
            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                <h2 className="text-sm font-medium text-[var(--muted-foreground)] mb-3">사주 사기둥</h2>
                <div className="grid grid-cols-4 gap-3">
                  <PillarCard label="시주" stem={saju.hourStem} branch={saju.hourBranch} />
                  <PillarCard label="일주" stem={saju.dayStem} branch={saju.dayBranch} />
                  <PillarCard label="월주" stem={saju.monthStem} branch={saju.monthBranch} />
                  <PillarCard label="연주" stem={saju.yearStem} branch={saju.yearBranch} />
                </div>
              </CardContent>
            </Card>

            {/* 오행 밸런스 */}
            {saju.elementScores && (() => {
              const elements: Element[] = ["wood", "fire", "earth", "metal", "water"];
              const scores = saju.elementScores;
              const maxScore = Math.max(...elements.map((e) => scores[e] || 0));
              return (
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
                            style={{
                              width: `${maxScore > 0 ? ((scores[el] || 0) / maxScore) * 100 : 0}%`,
                              backgroundColor: ELEMENT_COLORS[el],
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs text-[var(--muted-foreground)]">{scores[el] || 0}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })()}

            {/* 용신 & 주요 오행 */}
            {(saju.dominantElement || saju.yongshin) && (
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
            )}

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
                  if (!info || !content || typeof content !== "string") return null;
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
          </>
        )}
      </div>
    </div>
  );
}
