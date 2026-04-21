"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useOnboardingStore } from "@/stores/onboardingStore";
import type { CompatibilityWeights } from "@/lib/saju/types";
import { calculatePillars } from "@/lib/saju/pillars";
import { findIdealMatchesV2 } from "@/lib/saju/reverseMatch-v2";
import type { IdealMatchProfileV2 } from "@/lib/saju/reverseMatch-v2";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

const CATEGORIES: Array<{
  key: keyof CompatibilityWeights;
  label: string;
  description: string;
  icon: string;
}> = [
  { key: "romance", label: "연애 궁합", description: "설렘, 끌림, 연애 호감도", icon: "💕" },
  { key: "marriage", label: "결혼 궁합", description: "가정 안정, 배우자 인연", icon: "💍" },
  { key: "wealth", label: "재물 궁합", description: "경제력, 재물 시너지", icon: "💰" },
  { key: "children", label: "자녀 궁합", description: "자녀 인연, 양육 조화", icon: "👶" },
  { key: "health", label: "건강 궁합", description: "오행 보완, 상호 건강 영향", icon: "🏥" },
  { key: "personality", label: "성격 궁합", description: "가치관, 생활 습관 조화", icon: "🧠" },
];

const PRESETS: Array<{ label: string; weights: CompatibilityWeights }> = [
  { label: "연애 중심", weights: { romance: 90, marriage: 40, wealth: 30, children: 20, health: 40, personality: 70 } },
  { label: "결혼 중심", weights: { romance: 50, marriage: 90, wealth: 60, children: 70, health: 60, personality: 70 } },
  { label: "재물 중심", weights: { romance: 40, marriage: 60, wealth: 90, children: 40, health: 50, personality: 50 } },
  { label: "균등", weights: { romance: 50, marriage: 50, wealth: 50, children: 50, health: 50, personality: 50 } },
];

export default function PreferencesPage() {
  const router = useRouter();
  const {
    weights: storedWeights, setWeights, setAgeRange,
    birthYear, birthMonth, birthDay, birthHour, isLunar, gender,
    preferredAgeMin, preferredAgeMax,
  } = useOnboardingStore();
  const [weights, setLocalWeights] = useState<CompatibilityWeights>(storedWeights);
  const [ageRange, setLocalAgeRange] = useState<[number, number]>([preferredAgeMin, preferredAgeMax]);
  const [loading, setLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  const updateWeight = (key: keyof CompatibilityWeights, value: number) => {
    setLocalWeights((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: CompatibilityWeights) => {
    setLocalWeights(preset);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setWeights(weights);
    setAgeRange(ageRange[0], ageRange[1]);

    try {
      const token = useAuthStore.getState().token;

      if (token) {
        // 로그인 상태: 백엔드가 이상형 탐색 + 저장 + 매칭 스캔까지 수행
        await apiClient('/users/me', {
          method: 'PATCH',
          token,
          body: { preferredAgeMin: ageRange[0], preferredAgeMax: ageRange[1] },
        });

        const res = await apiClient<{ profiles: { profile: IdealMatchProfileV2 }[] }>(
          '/matching/find-ideal',
          { method: 'POST', token, body: { weights, topN: 10 } },
        );
        useOnboardingStore.getState().setIdealProfiles(res.profiles.map((p) => p.profile));
      } else {
        // 데모 모드: 로컬 계산
        const pillars = calculatePillars({
          year: Number(birthYear),
          month: Number(birthMonth),
          day: Number(birthDay),
          hour: birthHour,
          isLunar,
        });
        const results = findIdealMatchesV2({
          mySaju: pillars,
          weights,
          ageRange: { min: ageRange[0], max: ageRange[1] },
          topN: 10,
        });
        useOnboardingStore.getState().setIdealProfiles(results);
      }

      router.push("/ideal-match");
    } catch (e) {
      console.error("이상적 상대 탐색 에러:", e);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8">
      <div className="mx-auto max-w-md space-y-6">
        {/* 뒤로가기 */}
        <button onClick={() => router.back()} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          &larr; 뒤로
        </button>

        <div className="text-center">
          <p className="text-sm text-[var(--brand-gold)] font-medium">Step 3 / 4</p>
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)] mt-1">
            궁합 선호도 설정
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            중요하게 생각하는 항목에 더 높은 가중치를 주세요
          </p>
        </div>

        {/* 프리셋 */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset.weights)}
              className="shrink-0 rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:border-[var(--brand-gold)] hover:text-[var(--brand-gold)] transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* 나이 범위 설정 */}
        <Card className="border-none shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span>🎂</span>
              <span className="text-sm font-medium">상대방 나이 범위</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Slider
              value={ageRange}
              onValueChange={(val) => setLocalAgeRange(val as [number, number])}
              min={18}
              max={80}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
              <span>18세</span>
              <span className="text-sm font-bold text-[var(--brand-gold)]">
                {ageRange[0]}세 ~ {ageRange[1]}세
              </span>
              <span>80세</span>
            </div>
            <p className="text-center text-xs text-[var(--muted-foreground)]">
              {currentYear - ageRange[1]}년 ~ {currentYear - ageRange[0]}년생
            </p>
          </CardContent>
        </Card>

        {/* 궁합 가중치 슬라이더 */}
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6 space-y-6">
            {CATEGORIES.map((cat) => (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span className="text-sm font-medium">{cat.label}</span>
                  </div>
                  <span className="text-sm text-[var(--brand-gold)] font-bold">
                    {weights[cat.key]}
                  </span>
                </div>
                <Slider
                  value={[weights[cat.key]]}
                  onValueChange={(val) => updateWeight(cat.key, Array.isArray(val) ? val[0] : val)}
                  max={100}
                  min={0}
                  step={10}
                  className="w-full"
                />
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  {cat.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red)]/90 text-white py-6 text-base"
        >
          {loading ? "이상적 상대 찾는 중..." : "이상적 상대 사주 찾기"}
        </Button>
      </div>
    </div>
  );
}
