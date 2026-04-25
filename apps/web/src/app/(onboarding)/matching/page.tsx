"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CompassMotif } from "@/components/onboarding/CompassMotif";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { findIdealMatchesV2 } from "@/lib/saju/reverseMatch-v2";

// 주의: Capacitor 환경에서는 window.location.href 로 하드 내비하지 말 것.
// Capacitor 의 CapacitorRouter 가 확장자 없는 경로를 무조건 /index.html (랜딩) 로
// 라우팅함. 모든 in-app 이동은 next/navigation 의 router.push/replace 를 사용해
// 클라이언트 사이드 라우팅으로 처리해야 함.

/** 최소 노출 시간 (ms) — 계산이 아무리 빨라도 이만큼은 보여줘야 분위기가 살음. */
const MIN_EXPOSURE_MS = 8_000;

/** 프로그레스 바의 100% 기준 시간. 이보다 오래 걸리면 100% 로 고정. */
const PROGRESS_FULL_MS = 35_000;

interface Stage {
  /** 이 시각(초) 미만일 때 보여줄 텍스트. */
  until: number;
  text: string;
}

const STAGES: Stage[] = [
  { until: 5, text: "당신의 사주를 분석하는 중..." },
  { until: 15, text: "선호도에 맞는 조합을 탐색하는 중..." },
  { until: 25, text: "43,200개 사주 조합을 검토하는 중..." },
  { until: 35, text: "최적의 인연을 선별하는 중..." },
  { until: Number.POSITIVE_INFINITY, text: "결과를 준비하고 있어요..." },
];

function pickStage(elapsedMs: number): Stage {
  const sec = elapsedMs / 1000;
  return STAGES.find((s) => sec < s.until) ?? STAGES[STAGES.length - 1];
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function MatchingPage() {
  const router = useRouter();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const startedRef = useRef(false);

  // 하드 내비 직후엔 store 가 아직 localStorage 에서 복원되기 전일 수 있음.
  // weights/ageRange 기본값으로 API 호출하지 않도록 hydration 을 대기.
  useEffect(() => {
    if (useOnboardingStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useOnboardingStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // StrictMode 이중 마운트 방어 (프로덕션에선 영향 없음).
    if (startedRef.current) return;
    startedRef.current = true;

    const startTime = Date.now();
    let cancelled = false;

    const tick = setInterval(() => {
      if (cancelled) return;
      setElapsedMs(Date.now() - startTime);
    }, 200);

    const waitMinimum = () => {
      const elapsed = Date.now() - startTime;
      return Math.max(MIN_EXPOSURE_MS - elapsed, 0);
    };

    const run = async () => {
      const { weights, preferredAgeMin, preferredAgeMax, pillars } =
        useOnboardingStore.getState();

      // 사주 미입력 — 입력 페이지로 복귀
      if (!pillars) {
        setTimeout(() => {
          if (cancelled) return;
          toast.error("사주 정보가 필요해요", {
            description: "먼저 사주를 입력해주세요.",
          });
          router.replace("/saju-input");
        }, waitMinimum());
        return;
      }

      // 로그인 상태면 백엔드에 선호 나이대 동기화 (실 매칭 트리거용). fire-and-forget.
      const token = useAuthStore.getState().token;
      if (token) {
        apiClient("/users/me", {
          method: "PATCH",
          token,
          body: { preferredAgeMin, preferredAgeMax },
        }).catch((err) => console.warn("[Matching] 선호 동기화 실패:", err));
      }

      // 무거운 계산 — 첫 페인트와 프로그레스 바 시작을 보장하기 위해 다음 tick 으로 미룸
      await new Promise((r) => setTimeout(r, 0));

      try {
        const profiles = findIdealMatchesV2({
          mySaju: pillars,
          weights,
          ageRange: { min: preferredAgeMin, max: preferredAgeMax },
          topN: 10,
        });

        if (cancelled) return;
        useOnboardingStore.getState().setIdealProfiles(profiles);

        setTimeout(() => {
          if (cancelled) return;
          router.replace("/ideal-match");
        }, waitMinimum());
      } catch (e) {
        console.error("[Matching] 이상형 계산 에러:", e);
        if (cancelled) return;

        setTimeout(() => {
          if (cancelled) return;
          const msg = e instanceof Error ? e.message : "알 수 없는 오류";
          toast.error("이상형 탐색에 실패했어요", {
            description: `잠시 후 다시 시도해주세요. (${msg})`,
          });
          router.replace("/preferences");
        }, waitMinimum());
      }
    };

    run();

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [hydrated, router]);

  const stage = pickStage(elapsedMs);
  const progressPct = Math.min((elapsedMs / PROGRESS_FULL_MS) * 100, 100);
  const isOvertime = elapsedMs >= PROGRESS_FULL_MS;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-6 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-10">
        {/* 제목 */}
        <div className="text-center">
          <p className="text-xs tracking-[0.3em] text-[var(--brand-gold)]">
            緣 · 인연 탐색
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-serif)] text-xl text-[var(--foreground)]">
            당신과 맞닿을 사주를 찾는 중입니다
          </h1>
        </div>

        {/* 나침반 모티프 */}
        <CompassMotif size={280} />

        {/* 스테이지 텍스트 */}
        <div className="min-h-[3rem] text-center" key={stage.text}>
          <p className="matching-stage-text text-base text-[var(--foreground)] font-medium">
            {stage.text}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            잠시만 기다려주세요 — 결과를 정성껏 준비하고 있어요.
          </p>
        </div>

        {/* 프로그레스 + 경과 시간 */}
        <div className="w-full max-w-xs">
          <div
            className={`h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)] ${
              isOvertime ? "matching-progress-pulse" : ""
            }`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{
                width: `${progressPct}%`,
                background:
                  "linear-gradient(90deg, var(--brand-purple) 0%, var(--brand-gold) 100%)",
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
            <span>경과 {formatElapsed(elapsedMs)}</span>
            <span>
              {isOvertime ? "마무리 단계" : `${Math.round(progressPct)}%`}
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .matching-stage-text {
          animation: stage-fade 0.6s ease-out;
        }
        .matching-progress-pulse {
          animation: progress-breathe 2.2s ease-in-out infinite;
        }
        @keyframes stage-fade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes progress-breathe {
          0%,
          100% {
            opacity: 0.9;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
