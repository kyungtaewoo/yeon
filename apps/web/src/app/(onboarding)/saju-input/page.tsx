"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { calculatePillars } from "@/lib/saju/pillars";
import { generateReport } from "@/lib/saju/report";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

const HOUR_OPTIONS = [
  { label: "자시 (23:00~01:00)", value: 0 },
  { label: "축시 (01:00~03:00)", value: 2 },
  { label: "인시 (03:00~05:00)", value: 4 },
  { label: "묘시 (05:00~07:00)", value: 6 },
  { label: "진시 (07:00~09:00)", value: 8 },
  { label: "사시 (09:00~11:00)", value: 10 },
  { label: "오시 (11:00~13:00)", value: 12 },
  { label: "미시 (13:00~15:00)", value: 14 },
  { label: "신시 (15:00~17:00)", value: 16 },
  { label: "유시 (17:00~19:00)", value: 18 },
  { label: "술시 (19:00~21:00)", value: 20 },
  { label: "해시 (21:00~23:00)", value: 22 },
];

export default function SajuInputPage() {
  const router = useRouter();
  const { setBirthInfo, gender: storedGender } = useOnboardingStore();

  const [year, setYear] = useState("1995");
  const [month, setMonth] = useState("3");
  const [day, setDay] = useState("15");
  const [hour, setHour] = useState<number | null>(null);
  const [isLunar, setIsLunar] = useState(false);
  const [gender, setGender] = useState<"male" | "female" | "">(storedGender || "");
  const [loading, setLoading] = useState(false);

  const isValid = year && month && day && gender;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);

    setBirthInfo({
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour,
      isLunar,
      gender: gender as "male" | "female",
    });

    try {
      const pillars = calculatePillars({
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour,
        isLunar,
      });
      const report = generateReport(pillars);
      useOnboardingStore.getState().setReport(pillars, report);

      // 로그인 상태면 백엔드에도 저장 (Match 자동 스캔도 트리거됨)
      const token = useAuthStore.getState().token;
      if (token) {
        try {
          await apiClient('/saju/calculate-and-save', {
            method: 'POST',
            token,
            body: {
              year: Number(year),
              month: Number(month),
              day: Number(day),
              hour,
              isLunar,
            },
          });
        } catch (apiErr) {
          console.warn("백엔드 사주 저장 실패 — 로컬 결과는 유지됩니다:", apiErr);
        }
      }

      router.push("/saju-report");
    } catch (e) {
      console.error("사주 분석 에러:", e);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 pt-12 pb-8 flex justify-center">
      <Card className="w-full max-w-md border-none shadow-lg">
        <CardContent className="pt-6 space-y-5">
          {/* 뒤로가기 */}
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-[var(--muted-foreground)]"
          >
            &larr; 뒤로
          </button>

          {/* 헤더 */}
          <div className="text-center">
            <p className="text-sm text-[var(--brand-gold)] font-medium">Step 1 / 4</p>
            <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)] mt-1">
              생년월일시 입력
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              정확한 사주 분석을 위해 정보를 입력해주세요
            </p>
          </div>

          {/* 양력/음력 토글 */}
          <div className="flex rounded-lg bg-[var(--muted)] p-1">
            <button
              type="button"
              onClick={() => setIsLunar(false)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                !isLunar
                  ? "bg-white text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              양력
            </button>
            <button
              type="button"
              onClick={() => setIsLunar(true)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                isLunar
                  ? "bg-white text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              음력
            </button>
          </div>

          {/* 생년월일 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">년</label>
              <input
                type="text"
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="1995"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-gold)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">월</label>
              <input
                type="text"
                inputMode="numeric"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="3"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-gold)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-foreground)] mb-1">일</label>
              <input
                type="text"
                inputMode="numeric"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                placeholder="15"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-gold)]"
              />
            </div>
          </div>

          {/* 성별 */}
          <div>
            <label className="block text-sm font-medium mb-2">성별</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGender("male")}
                className={`py-3 rounded-lg text-sm font-medium border transition-colors ${
                  gender === "male"
                    ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--foreground)]"
                }`}
              >
                남성
              </button>
              <button
                type="button"
                onClick={() => setGender("female")}
                className={`py-3 rounded-lg text-sm font-medium border transition-colors ${
                  gender === "female"
                    ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white"
                    : "border-[var(--border)] bg-white text-[var(--foreground)]"
                }`}
              >
                여성
              </button>
            </div>
          </div>

          {/* 출생 시간 */}
          <div>
            <label className="block text-sm font-medium mb-2">출생 시간</label>
            <select
              value={hour ?? "unknown"}
              onChange={(e) => setHour(e.target.value === "unknown" ? null : Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[var(--brand-gold)]"
            >
              <option value="unknown">모름</option>
              {HOUR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              시간을 모르면 시주 없이 분석합니다
            </p>
          </div>

          {/* 제출 버튼 */}
          <Button
            type="button"
            disabled={!isValid || loading}
            onClick={handleSubmit}
            className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red)]/90 text-white py-6 text-base"
          >
            {loading ? "사주 분석 중..." : "내 사주 분석하기"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
