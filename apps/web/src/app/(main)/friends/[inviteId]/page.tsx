"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePremium } from "@/hooks/usePremium";
import { useAuthStore } from "@/stores/authStore";
import {
  getFriendDetail,
  recomputeCompatibility,
  type FriendDetailResponse,
  type FriendCompatibilityRow,
  type GeneralBreakdown,
  type RomanticBreakdown,
  type DeepBreakdown,
  FriendInviteForbiddenError,
  FriendInviteNotFoundError,
  FriendNetworkError,
  FriendUnauthorizedError,
} from "@/lib/api/friends";

const GENERAL_LABEL: Record<keyof GeneralBreakdown["breakdown"], string> = {
  yearBranch: "연지 합충",
  monthPillar: "월주 조화",
  elements: "오행 시너지",
  tenGods: "십성 역할",
  wonJin: "원진살",
};

const ROMANTIC_LABEL: Record<keyof RomanticBreakdown["breakdown"], string> = {
  dayGan: "일간 합",
  dayJi: "일지 배우자궁",
  officialStar: "관성·재성",
  yearMonth: "연주+월주",
  peachBlossom: "도화살",
};

const DEEP_LABEL: Record<keyof DeepBreakdown["breakdown"], string> = {
  unconscious: "무의식 조화도",
  emotional: "감정 교류도",
  attraction: "본능적 끌림",
  innerComplement: "내면 보완",
  yinyangBalance: "음양 밸런스",
};

function counterpartName(
  detail: FriendDetailResponse,
  myUserId: string,
): string {
  const inv = detail.invite;
  if (inv.inviterId === myUserId) return inv.invitee?.nickname ?? "이름 미상";
  return inv.inviter?.nickname ?? "이름 미상";
}

/**
 * 점수 → 이모지 + 짧은 라벨. v2 MVP 는 tier 무관 단일 매핑.
 * (tier 별 변형은 v3 시점에 검토 — 사전 합의된 5단계 enum.)
 */
function scoreFlavor(score: number | null): { emoji: string; label: string } {
  if (score == null) return { emoji: "—", label: "" };
  const n = Number(score);
  if (n >= 95) return { emoji: "🌟", label: "환상적" };
  if (n >= 85) return { emoji: "💛", label: "마음 통함" };
  if (n >= 70) return { emoji: "🤝", label: "안정적" };
  if (n >= 55) return { emoji: "⚡", label: "다름이 매력" };
  return { emoji: "🌪️", label: "노력 필요" };
}

/**
 * tier 별 active 카드 액센트.
 * Tailwind JIT 가 정확히 인식하도록 정적 record 로 둔다 (동적 문자열 결합 X).
 */
const TIER_ACCENT: Record<TierKey, string> = {
  general: "border-[var(--brand-gold)] bg-[var(--brand-gold)]/10",
  romantic: "border-[var(--brand-red)] bg-[var(--brand-red)]/10",
  deep: "border-[var(--brand-purple)] bg-[var(--brand-purple)]/10",
};

function ScoreCard({
  tier,
  label,
  score,
  locked,
  onClick,
  active,
  fading,
}: {
  tier: TierKey;
  label: string;
  score: number | null;
  locked: boolean;
  onClick: () => void;
  active: boolean;
  fading: boolean;
}) {
  const flavor = scoreFlavor(score);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border p-3 text-center transition ${
        active ? TIER_ACCENT[tier] : "border-[var(--muted-foreground)]/15 bg-white"
      }`}
    >
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold transition-opacity duration-500 ${
          fading ? "opacity-30" : "opacity-100"
        } ${locked ? "text-[var(--brand-gold)]" : "text-[var(--foreground)]"}`}
      >
        {locked
          ? "🔒"
          : score != null
            ? `${Math.round(Number(score))} ${flavor.emoji}`
            : "—"}
      </p>
      {!locked && flavor.label && (
        <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
          {flavor.label}
        </p>
      )}
    </button>
  );
}

function BreakdownGrid<K extends string>({
  values,
  labels,
}: {
  values: Record<K, number>;
  labels: Record<K, string>;
}) {
  const keys = Object.keys(labels) as K[];
  return (
    <div className="space-y-2">
      {keys.map((k) => (
        <div key={k} className="flex items-center justify-between text-xs">
          <span className="text-[var(--muted-foreground)]">{labels[k]}</span>
          <span className="font-medium text-[var(--foreground)]">
            {Math.round(values[k])}점
          </span>
        </div>
      ))}
    </div>
  );
}

function FactorList({ factors }: { factors: string[] }) {
  if (!factors.length) return null;
  return (
    <ul className="mt-3 space-y-1">
      {factors.map((f, i) => (
        <li
          key={i}
          className="text-xs text-[var(--muted-foreground)] before:mr-1.5 before:content-['•']"
        >
          {f}
        </li>
      ))}
    </ul>
  );
}

type TierKey = "general" | "romantic" | "deep";

const RECOMPUTE_COOLDOWN_MS = 60_000;

export default function FriendDetailPage() {
  const router = useRouter();
  const params = useParams<{ inviteId: string }>();
  const inviteId = params?.inviteId;

  const { isPremium } = usePremium();
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user);

  const [detail, setDetail] = useState<FriendDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<
    "not_found" | "forbidden" | "network" | "other" | null
  >(null);
  const [activeTier, setActiveTier] = useState<TierKey>("general");
  const [recomputing, setRecomputing] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // 쿨다운 동안 매초 now 갱신 → 버튼 라벨 카운트다운.
  useEffect(() => {
    if (cooldownUntil == null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= cooldownUntil) setCooldownUntil(null);
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooldownRemaining =
    cooldownUntil != null ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;

  const load = useCallback(async () => {
    if (!token || !inviteId) return;
    setLoading(true);
    setErrorKind(null);
    try {
      const res = await getFriendDetail(token, inviteId);
      setDetail(res);
    } catch (e) {
      if (e instanceof FriendUnauthorizedError) {
        router.replace("/login");
        return;
      }
      if (e instanceof FriendInviteNotFoundError) setErrorKind("not_found");
      else if (e instanceof FriendInviteForbiddenError) setErrorKind("forbidden");
      else if (e instanceof FriendNetworkError) setErrorKind("network");
      else setErrorKind("other");
    } finally {
      setLoading(false);
    }
  }, [token, inviteId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRecompute = async () => {
    if (!token || !inviteId || recomputing) return;
    if (cooldownRemaining > 0) return;
    setRecomputing(true);
    try {
      await recomputeCompatibility(token, inviteId);
      // 0.5초 페이드 인 효과 — UX 부드럽게
      const fresh = await getFriendDetail(token, inviteId);
      setDetail(fresh);
      toast.success("다시 계산했어요");
      // 60초 쿨다운 — 사주 자체가 자주 바뀌지 않으니 연타 방지 + 백엔드 부하 차단.
      setCooldownUntil(Date.now() + RECOMPUTE_COOLDOWN_MS);
    } catch (e) {
      if (e instanceof FriendUnauthorizedError) {
        router.replace("/login");
        return;
      }
      const msg =
        e instanceof Error ? e.message : "재계산에 실패했어요";
      toast.error(msg);
    } finally {
      setRecomputing(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-6">
        <div className="mx-auto max-w-md text-center mt-12 space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            로그인이 필요해요
          </p>
          <Button onClick={() => router.replace("/login")}>로그인하기</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-6">
        <div className="mx-auto max-w-md text-center mt-12 text-sm text-[var(--muted-foreground)]">
          불러오는 중...
        </div>
      </div>
    );
  }

  if (errorKind) {
    const message =
      errorKind === "not_found"
        ? "친구 정보를 찾을 수 없어요"
        : errorKind === "forbidden"
          ? "이 친구 정보를 볼 수 없어요"
          : errorKind === "network"
            ? "잠시 후 다시 시도해주세요"
            : "친구 정보를 불러오지 못했어요";
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-6">
        <div className="mx-auto max-w-md mt-12 space-y-4 text-center">
          <p className="text-sm text-[var(--brand-red)]">{message}</p>
          <div className="flex flex-col gap-2">
            {errorKind === "network" && (
              <Button variant="outline" onClick={load}>
                다시 시도
              </Button>
            )}
            <Button onClick={() => router.replace("/friends")}>
              친구 목록으로
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!detail || !me) return null;

  const compat = detail.compatibility;
  const name = counterpartName(detail, me.id);
  const status = detail.invite.status;

  // calculated 가 아니거나 compatibility 가 없으면 안내 화면
  if (!compat || status !== "calculated") {
    const subText =
      status === "pending"
        ? "친구가 아직 초대를 수락하지 않았어요"
        : status === "joined"
          ? "친구의 사주 입력을 기다리고 있어요"
          : status === "saju_complete"
            ? "양쪽 사주가 모였어요. 잠시 후 계산돼요"
            : "초대가 만료되었어요";
    return (
      <div className="min-h-screen bg-[var(--background)] px-4 py-6">
        <div className="mx-auto max-w-md space-y-5">
          <button
            type="button"
            onClick={() => router.replace("/friends")}
            className="text-sm text-[var(--muted-foreground)]"
          >
            ← 친구 목록
          </button>
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            {name}
          </h1>
          <Card className="border-none shadow-sm">
            <CardContent className="py-6 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">{subText}</p>
              {status === "saju_complete" && (
                <Button
                  className="mt-4"
                  onClick={handleRecompute}
                  disabled={recomputing}
                >
                  {recomputing ? "계산 중..." : "지금 계산하기"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // calculated — 정상 화면
  const tierData: Record<TierKey, { score: number | null; locked: boolean }> = {
    general: { score: compat.generalScore, locked: false },
    romantic: { score: compat.romanticScore, locked: !isPremium },
    deep: { score: compat.deepScore, locked: !isPremium },
  };

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">
        <button
          type="button"
          onClick={() => router.replace("/friends")}
          className="text-sm text-[var(--muted-foreground)]"
        >
          ← 친구 목록
        </button>

        <header className="space-y-1">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            {name}
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            친구 등록 · {new Date(detail.invite.createdAt).toLocaleDateString("ko-KR")}
          </p>
        </header>

        {/* 3종 점수 카드 */}
        <div className="flex gap-2">
          <ScoreCard
            tier="general"
            label="일반"
            score={tierData.general.score}
            locked={tierData.general.locked}
            onClick={() => setActiveTier("general")}
            active={activeTier === "general"}
            fading={recomputing}
          />
          <ScoreCard
            tier="romantic"
            label="연인"
            score={tierData.romantic.score}
            locked={tierData.romantic.locked}
            onClick={() => setActiveTier("romantic")}
            active={activeTier === "romantic"}
            fading={recomputing}
          />
          <ScoreCard
            tier="deep"
            label="깊은"
            score={tierData.deep.score}
            locked={tierData.deep.locked}
            onClick={() => setActiveTier("deep")}
            active={activeTier === "deep"}
            fading={recomputing}
          />
        </div>

        {/* 활성 tier 디테일 */}
        <ActiveTierDetail
          tier={activeTier}
          compat={compat}
          isPremium={isPremium}
        />

        {/* Recompute */}
        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleRecompute}
            disabled={recomputing || cooldownRemaining > 0}
          >
            {recomputing
              ? "계산 중..."
              : cooldownRemaining > 0
                ? `${cooldownRemaining}초 후 다시 시도`
                : "다시 계산하기"}
          </Button>
          <p className="mt-1.5 text-center text-[10px] text-[var(--muted-foreground)]">
            사주 정보를 수정한 후 누르면 점수를 다시 계산해요
          </p>
        </div>
      </div>
    </div>
  );
}

function ActiveTierDetail({
  tier,
  compat,
  isPremium,
}: {
  tier: TierKey;
  compat: FriendCompatibilityRow;
  isPremium: boolean;
}) {
  if (tier === "general") {
    const b = compat.generalBreakdown;
    if (!b) return <EmptyTier />;
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="py-4 space-y-3">
          <p className="text-sm text-[var(--foreground)]">{b.narrative}</p>
          <div className="border-t border-[var(--muted-foreground)]/10 pt-3">
            <BreakdownGrid values={b.breakdown} labels={GENERAL_LABEL} />
          </div>
          <FactorList factors={b.factors} />
        </CardContent>
      </Card>
    );
  }

  if (tier === "romantic") {
    if (!isPremium) return <PremiumLock label="연인 궁합" />;
    const b = compat.romanticBreakdown;
    if (!b) return <EmptyTier />;
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="py-4 space-y-3">
          <p className="text-sm text-[var(--foreground)]">{b.narrative}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-[var(--muted-foreground)]/5 p-2 text-center">
              <span className="text-[var(--muted-foreground)]">결혼 적합</span>
              <p className="font-medium">{Math.round(b.marriageScore)}점</p>
            </div>
            <div className="rounded bg-[var(--muted-foreground)]/5 p-2 text-center">
              <span className="text-[var(--muted-foreground)]">연애 스타일</span>
              <p className="font-medium">{Math.round(b.styleScore)}점</p>
            </div>
          </div>
          <div className="border-t border-[var(--muted-foreground)]/10 pt-3">
            <BreakdownGrid values={b.breakdown} labels={ROMANTIC_LABEL} />
          </div>
          <FactorList factors={b.factors} />
        </CardContent>
      </Card>
    );
  }

  // deep
  if (!isPremium) return <PremiumLock label="깊은 궁합" />;
  const b = compat.deepBreakdown;
  if (!b) return <EmptyTier />;
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="py-4 space-y-3">
        <p className="text-sm text-[var(--foreground)]">{b.narrative.summary}</p>
        <div className="border-t border-[var(--muted-foreground)]/10 pt-3">
          <BreakdownGrid values={b.breakdown} labels={DEEP_LABEL} />
        </div>
        {b.narrative.details.length > 0 && (
          <div className="border-t border-[var(--muted-foreground)]/10 pt-3 space-y-2">
            {b.narrative.details.map((d, i) => (
              <div key={i}>
                <p className="text-xs font-medium text-[var(--foreground)]">
                  {d.label}{" "}
                  <span className="text-[var(--muted-foreground)]">
                    {Math.round(d.score)}점
                  </span>
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {d.description}
                </p>
              </div>
            ))}
          </div>
        )}
        <FactorList factors={b.factors} />
      </CardContent>
    </Card>
  );
}

function PremiumLock({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Card className="border-none bg-[var(--brand-gold)]/5 shadow-sm">
      <CardContent className="py-6 text-center space-y-3">
        <p className="text-sm font-medium text-[var(--foreground)]">
          🔒 {label} 분석은 프리미엄 전용이에요
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          업그레이드하면 모든 친구의 연인·깊은 궁합까지 볼 수 있어요
        </p>
        <Button onClick={() => router.push("/premium")}>업그레이드</Button>
      </CardContent>
    </Card>
  );
}

function EmptyTier() {
  return (
    <Card className="border-dashed border-2 border-[var(--muted-foreground)]/20 shadow-none bg-transparent">
      <CardContent className="py-6 text-center">
        <p className="text-xs text-[var(--muted-foreground)]">
          아직 분석 데이터가 없어요
        </p>
      </CardContent>
    </Card>
  );
}
