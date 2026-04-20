"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { STEM_KOREAN, BRANCH_KOREAN, ELEMENT_NAMES, STEM_TO_ELEMENT, BRANCH_TO_ELEMENT } from "@/lib/saju/constants";
import type { Pillar, Element, TenGod, TenGodGroup, TenGodDistribution, PillarTenGods } from "@/lib/saju/types";
import { SajuCard } from "@/components/saju/SajuCard";

const ELEMENT_COLORS: Record<Element, string> = {
  wood: "var(--element-wood)",
  fire: "var(--element-fire)",
  earth: "var(--element-earth)",
  metal: "var(--element-metal)",
  water: "var(--element-water)",
};

const TEN_GOD_GROUP_INFO: Record<TenGodGroup, { label: string; hanja: string; color: string; desc: string }> = {
  bijob:    { label: "비겁", hanja: "比劫", color: "#6366f1", desc: "자아, 주체성, 형제" },
  siksang:  { label: "식상", hanja: "食傷", color: "#f59e0b", desc: "표현, 재능, 자녀" },
  jaesung:  { label: "재성", hanja: "財星", color: "#10b981", desc: "재물, 아버지, 현실" },
  gwansung: { label: "관성", hanja: "官星", color: "#ef4444", desc: "직장, 명예, 남편" },
  insung:   { label: "인성", hanja: "印星", color: "#3b82f6", desc: "학문, 어머니, 보호" },
};

const TEN_GOD_COLORS: Record<string, string> = {
  "비견": "#6366f1", "겁재": "#818cf8",
  "식신": "#f59e0b", "상관": "#fbbf24",
  "편재": "#10b981", "정재": "#34d399",
  "편관": "#ef4444", "정관": "#f87171",
  "편인": "#3b82f6", "정인": "#60a5fa",
};

// ============================================================
// 4기둥 + 십성 표시 컴포넌트
// ============================================================
function PillarWithTenGod({
  label,
  pillar,
  stemTenGod,
  branchTenGods,
}: {
  label: string;
  pillar: Pillar | null;
  stemTenGod: string;
  branchTenGods: TenGod[] | null;
}) {
  if (!pillar) {
    return (
      <div className="text-center">
        <p className="text-[10px] text-[var(--muted-foreground)] mb-1">{label}</p>
        <div className="rounded-lg bg-[var(--muted)] p-2">
          <p className="text-sm text-[var(--muted-foreground)]">?</p>
          <p className="text-sm text-[var(--muted-foreground)]">?</p>
        </div>
      </div>
    );
  }

  const stemEl = STEM_TO_ELEMENT[pillar.stem];
  const branchEl = BRANCH_TO_ELEMENT[pillar.branch];

  return (
    <div className="text-center">
      <p className="text-[10px] text-[var(--muted-foreground)] mb-1">{label}</p>
      <div className="rounded-lg bg-white p-2 shadow-sm">
        {/* 천간 십성 */}
        <p className="text-[10px] font-medium" style={{ color: TEN_GOD_COLORS[stemTenGod] || "#888" }}>
          {stemTenGod}
        </p>
        {/* 천간 */}
        <p className="text-xl font-bold font-[family-name:var(--font-serif)]" style={{ color: ELEMENT_COLORS[stemEl] }}>
          {pillar.stem}
        </p>
        <p className="text-[10px] text-[var(--muted-foreground)]">
          {STEM_KOREAN[pillar.stem]}({ELEMENT_NAMES[stemEl].hanja})
        </p>

        <div className="h-px bg-[var(--border)] my-1" />

        {/* 지지 */}
        <p className="text-xl font-bold font-[family-name:var(--font-serif)]" style={{ color: ELEMENT_COLORS[branchEl] }}>
          {pillar.branch}
        </p>
        <p className="text-[10px] text-[var(--muted-foreground)]">
          {BRANCH_KOREAN[pillar.branch]}({ELEMENT_NAMES[branchEl].hanja})
        </p>

        {/* 장간 십성 */}
        {branchTenGods && branchTenGods.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-center gap-0.5">
            {branchTenGods.map((tg, i) => (
              <span
                key={i}
                className="text-[9px] px-1 rounded"
                style={{ color: TEN_GOD_COLORS[tg], backgroundColor: `${TEN_GOD_COLORS[tg]}15` }}
              >
                {tg}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 십성 분포 바 차트
// ============================================================
function TenGodDistChart({ dist }: { dist: TenGodDistribution }) {
  const groups: TenGodGroup[] = ["bijob", "siksang", "jaesung", "gwansung", "insung"];
  const maxVal = Math.max(...groups.map(g => dist[g]), 1);

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const info = TEN_GOD_GROUP_INFO[g];
        const pct = (dist[g] / maxVal) * 100;
        return (
          <div key={g}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold" style={{ color: info.color }}>{info.label}</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">{info.hanja}</span>
              </div>
              <span className="text-xs font-medium">{dist[g].toFixed(1)}</span>
            </div>
            <div className="h-3 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: info.color }}
              />
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{info.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 오행 바 차트
// ============================================================
function ElementBar({ element, score, maxScore }: { element: Element; score: number; maxScore: number }) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-center text-sm font-bold font-[family-name:var(--font-serif)]" style={{ color: ELEMENT_COLORS[element] }}>
        {ELEMENT_NAMES[element].hanja}
      </span>
      <div className="flex-1 h-3 bg-[var(--muted)] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: ELEMENT_COLORS[element] }} />
      </div>
      <span className="w-8 text-right text-xs text-[var(--muted-foreground)]">{score}</span>
    </div>
  );
}

// ============================================================
// 메인 페이지
// ============================================================
export default function SajuReportPage() {
  const router = useRouter();
  const { report, pillars } = useOnboardingStore();

  if (!report || !pillars) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <p className="text-[var(--muted-foreground)]">사주 정보가 없습니다</p>
          <Button onClick={() => router.push("/saju-input")} className="mt-4 bg-[var(--brand-red)] text-white">
            사주 입력하기
          </Button>
        </div>
      </div>
    );
  }

  const elements: Element[] = ["wood", "fire", "earth", "metal", "water"];
  const maxElementScore = Math.max(...elements.map((e) => report.elementScores[e]));
  const ptg = report.pillarTenGods;

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8">
      <div className="mx-auto max-w-md space-y-6">
        {/* 뒤로가기 */}
        <button onClick={() => router.back()} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          &larr; 뒤로
        </button>

        {/* 헤더 */}
        <div className="text-center">
          <p className="text-sm text-[var(--brand-gold)] font-medium">Step 2 / 4</p>
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)] mt-1">
            나의 사주 리포트
          </h1>
        </div>

        {/* 사주팔자 4기둥 + 십성 */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <h2 className="font-[family-name:var(--font-serif)] text-base font-bold mb-4 text-center">
              사주팔자 (四柱八字)
            </h2>
            <div className="grid grid-cols-4 gap-2">
              <PillarWithTenGod
                label="시주(時)"
                pillar={pillars.hour}
                stemTenGod={ptg?.hourStem || "?"}
                branchTenGods={ptg?.hourBranch || null}
              />
              <PillarWithTenGod
                label="일주(日)"
                pillar={pillars.day}
                stemTenGod="일간(나)"
                branchTenGods={ptg?.dayBranch || null}
              />
              <PillarWithTenGod
                label="월주(月)"
                pillar={pillars.month}
                stemTenGod={ptg?.monthStem || ""}
                branchTenGods={ptg?.monthBranch || null}
              />
              <PillarWithTenGod
                label="연주(年)"
                pillar={pillars.year}
                stemTenGod={ptg?.yearStem || ""}
                branchTenGods={ptg?.yearBranch || null}
              />
            </div>
          </CardContent>
        </Card>

        {/* 십성 분포 */}
        {report.tenGodDistribution && (
          <Card className="border-none shadow-lg">
            <CardContent className="pt-6">
              <h2 className="font-[family-name:var(--font-serif)] text-lg font-bold mb-4">
                십성 분포 (十星)
              </h2>
              <TenGodDistChart dist={report.tenGodDistribution} />
            </CardContent>
          </Card>
        )}

        {/* 격국 */}
        {report.gyeokguk && (
          <Card className="border-none shadow-lg">
            <CardContent className="pt-6">
              <h2 className="font-[family-name:var(--font-serif)] text-lg font-bold mb-2">
                격국 (格局)
              </h2>
              <Badge className="bg-[var(--brand-gold)]/10 text-[var(--brand-gold)] border-[var(--brand-gold)]/30 text-sm px-3 py-1">
                {report.gyeokguk.name}
              </Badge>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mt-3">
                {report.gyeokguk.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 오행 밸런스 */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6 space-y-3">
            <h2 className="font-[family-name:var(--font-serif)] text-lg font-bold mb-4">
              오행 밸런스 (五行)
            </h2>
            {elements.map((el) => (
              <ElementBar key={el} element={el} score={report.elementScores[el]} maxScore={maxElementScore} />
            ))}
          </CardContent>
        </Card>

        {/* 용신 */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <h2 className="font-[family-name:var(--font-serif)] text-lg font-bold mb-2">
              용신 (用神)
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              당신에게 필요한 오행은{" "}
              <span className="font-bold" style={{ color: ELEMENT_COLORS[report.yongshin] }}>
                {ELEMENT_NAMES[report.yongshin].hanja}({ELEMENT_NAMES[report.yongshin].ko})
              </span>
              입니다
            </p>
          </CardContent>
        </Card>

        {/* 신살 */}
        {report.shinSalList && report.shinSalList.length > 0 && (
          <Card className="border-none shadow-lg">
            <CardContent className="pt-6">
              <h2 className="font-[family-name:var(--font-serif)] text-lg font-bold mb-3">
                신살 (神殺)
              </h2>
              <div className="space-y-3">
                {report.shinSalList.map((ss, i) => (
                  <div key={i} className="border-l-2 border-[var(--brand-gold)] pl-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--foreground)]">{ss.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{ss.location}</Badge>
                    </div>
                    <p className="text-sm text-[var(--muted-foreground)] mt-1 leading-relaxed">{ss.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 성격 / 연애 / 재물 / 건강 */}
        {[
          { title: "성격", content: report.personality, icon: "🧠" },
          { title: "연애", content: report.romance, icon: "💕" },
          { title: "재물", content: report.wealth, icon: "💰" },
          { title: "건강", content: report.health, icon: "🏥" },
        ].map((section) => (
          <Card key={section.title} className="border-none shadow-lg">
            <CardContent className="pt-6">
              <h2 className="font-[family-name:var(--font-serif)] text-lg font-bold mb-2">
                {section.icon} {section.title}
              </h2>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{section.content}</p>
            </CardContent>
          </Card>
        ))}

        {/* 사주 카드 공유 */}
        <SajuCard
          pillars={pillars}
          elementScores={report.elementScores}
          dominantElement={report.dominantElement}
        />

        {/* CTA */}
        <Button
          onClick={() => router.push("/preferences")}
          className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red)]/90 text-white py-6 text-base"
        >
          다음: 궁합 선호도 설정
        </Button>
      </div>
    </div>
  );
}
