"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";
import {
  acceptInvite,
  verifyInvite,
  type VerifyInviteResponse,
  FriendInviteAlreadyAcceptedError,
  FriendInviteExpiredError,
  FriendInviteForbiddenError,
  FriendInviteNotFoundError,
  FriendSelfInviteError,
  FriendUnauthorizedError,
} from "@/lib/api/friends";
import { consumeAutoAcceptCode, setPendingInviteCode } from "@/lib/auth/postLoginRedirect";

/**
 * 친구 초대 환영 페이지 — 인증 불필요. yeonapp.com/invite/[code] 직접 진입 가능.
 *
 * 흐름:
 *  1) verifyInvite 로 코드 검증 — 만료/없음/유효 판정
 *  2) 비로그인 → setPendingInviteCode + /login (콜백이 본 페이지로 복귀)
 *  3) 로그인 → acceptInvite. 성공 시 /friends/[inviteId] 상세로.
 *  4) 자기 초대/이미 다른 친구 수락/만료 등은 backend 에러 코드로 분기 토스트.
 *
 * - 자기 자신인지(SELF_INVITE)는 verifyInvite 응답에 inviterId 가 없어 판단 불가 →
 *   accept 시도 후 백엔드 reject 로 판정. UX 비용 작음.
 * - 백엔드 acceptInvite 는 동일 userId 가 다시 수락해도 idempotent (inviteeId 재할당
 *   후 tryComputeCompatibility) → 이미 내가 수락한 초대 다시 클릭해도 안전.
 */

export default function InviteWelcomePage() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code ?? "");
  const token = useAuthStore((s) => s.token);

  const [verifying, setVerifying] = useState(true);
  const [verify, setVerify] = useState<VerifyInviteResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!code) {
      setErrorMessage("초대 코드가 없어요");
      setVerifying(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setVerifying(true);
      setErrorMessage(null);
      try {
        const res = await verifyInvite(code);
        if (!cancelled) setVerify(res);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof FriendInviteNotFoundError) {
          setErrorMessage("초대 코드를 찾을 수 없어요");
        } else {
          setErrorMessage(e instanceof Error ? e.message : "초대를 확인하지 못했어요");
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleLogin = () => {
    setPendingInviteCode(code);
    router.push("/login");
  };

  const handleAccept = useCallback(async () => {
    if (!token || accepting) return;
    setAccepting(true);
    try {
      const invite = await acceptInvite(token, code);
      toast.success("친구가 됐어요!", {
        description: "양쪽 사주가 모이면 궁합이 자동 계산돼요",
      });
      router.replace(`/friends/${invite.id}`);
    } catch (e) {
      if (e instanceof FriendUnauthorizedError) {
        // 토큰 만료 — 다시 로그인 후 복귀.
        setPendingInviteCode(code);
        router.replace("/login");
        return;
      }
      if (e instanceof FriendSelfInviteError) {
        toast.error("본인이 만든 초대는 수락할 수 없어요");
      } else if (e instanceof FriendInviteExpiredError) {
        toast.error("만료된 초대예요", {
          description: "친구에게 다시 초대해 달라고 해주세요",
        });
      } else if (e instanceof FriendInviteAlreadyAcceptedError) {
        toast.error("이미 다른 친구가 수락한 초대예요");
      } else if (e instanceof FriendInviteForbiddenError) {
        toast.error("이 초대를 수락할 권한이 없어요");
      } else if (e instanceof FriendInviteNotFoundError) {
        toast.error("초대를 찾을 수 없어요");
      } else {
        toast.error(e instanceof Error ? e.message : "초대를 수락하지 못했어요");
      }
    } finally {
      setAccepting(false);
    }
  }, [token, code, accepting, router]);

  // 사용자가 명시적으로 "로그인하고 친구되기" 누르고 OAuth 끝나서 돌아왔을 때 자동 수락.
  // consumeAutoAcceptCode 가 true 면 플래그가 본 code 를 위해 세팅된 상태였다는 의미 →
  // 한 번만 자동 수락. 직접 URL 접근(=플래그 없음)에는 작동 X.
  useEffect(() => {
    if (!verify?.valid || !token || accepting) return;
    if (consumeAutoAcceptCode(code)) {
      void handleAccept();
    }
  }, [verify, token, code, accepting, handleAccept]);

  // ---- Render branches ----

  // 1) Loading
  if (verifying) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-serif)] text-4xl text-[var(--brand-red)] animate-pulse">
            緣
          </h1>
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">초대 확인 중...</p>
        </div>
      </div>
    );
  }

  // 2) Error / Invalid code
  if (errorMessage || !verify) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-none shadow-md">
          <CardContent className="py-8 text-center space-y-4">
            <h1 className="font-[family-name:var(--font-serif)] text-3xl text-[var(--brand-red)]">
              緣
            </h1>
            <p className="font-medium text-[var(--foreground)]">
              {errorMessage ?? "초대를 확인하지 못했어요"}
            </p>
            <Button onClick={() => router.replace("/")} className="w-full">
              메인으로
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3) Expired
  if (verify.status === "expired" || !verify.valid) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-none shadow-md">
          <CardContent className="py-8 text-center space-y-4">
            <h1 className="font-[family-name:var(--font-serif)] text-3xl text-[var(--brand-red)]">
              緣
            </h1>
            <p className="font-medium text-[var(--foreground)]">만료된 초대예요</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              <span className="font-bold">{verify.inviter.nickname}</span>님께 다시 초대해
              달라고 요청해주세요
            </p>
            <Button onClick={() => router.replace("/")} className="w-full">
              메인으로
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4) Valid — show invitation
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4 py-10">
      <Card className="max-w-md w-full border-none shadow-md">
        <CardContent className="py-10 text-center space-y-6">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-5xl text-[var(--brand-red)]">
              緣
            </h1>
            <p className="text-xs text-[var(--muted-foreground)] mt-2">사주로 보는 인연</p>
          </div>

          <div className="space-y-2">
            <p className="text-2xl font-[family-name:var(--font-serif)] text-[var(--foreground)] leading-snug">
              <span className="font-bold text-[var(--brand-red)]">
                {verify.inviter.nickname}
              </span>
              님이
              <br />
              당신을 초대했어요
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              두 사람의 사주로 빚어진 궁합이 기다려요
            </p>
          </div>

          {/* 호기심 티저 — 점수는 수락 후 계산되므로 실제 숫자 X, 가벼운 카피만 */}
          <div className="rounded-lg bg-[var(--brand-red)]/5 px-4 py-3 text-xs text-[var(--muted-foreground)]">
            ✨ 일반 · 연인 · 깊은 궁합 — 세 가지 시선으로 풀어드려요
          </div>

          {!token ? (
            <div className="space-y-3">
              <Button
                onClick={handleLogin}
                className="w-full bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#3C1E1E] font-bold"
              >
                카카오로 시작하기
              </Button>
              <p className="text-xs text-[var(--muted-foreground)]">
                이미 緣을 쓰고 있다면 같은 카카오 계정으로 로그인해요.
                <br />
                새로 시작이라면 사주 입력 후 자동으로 친구가 돼요.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full bg-[var(--brand-red)] hover:bg-[var(--brand-red)]/90"
              >
                {accepting ? "수락 중..." : "친구 수락하기"}
              </Button>
              <p className="text-xs text-[var(--muted-foreground)]">
                수락하면 양쪽 사주가 모이는 즉시 궁합이 계산돼요
              </p>
            </div>
          )}

          <PlatformHint />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 비-iOS 사용자에게 보조 안내. App Store 정식 출시 전이라 다운로드 링크 대신
 * "iOS 우선 출시" 정도만 보여줌. 정식 출시 후 App Store URL 로 교체.
 */
function detectPlatform(): "ios" | "android" | "desktop" | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function PlatformHint() {
  // 서버 렌더에는 null 로, 마운트 후에 UA 읽음 — hydration mismatch 회피.
  // (lint react-hooks/set-state-in-effect 가 이 SSR 패턴을 이해 못 함 — 수동 disable)
  const [hint, setHint] = useState<"ios" | "android" | "desktop" | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHint(detectPlatform());
  }, []);

  if (!hint) return null;

  if (hint === "ios") {
    // 앱 설치된 경우 Universal Link 자동 처리됨. 미설치 시에만 이 카드 의미 있음.
    return (
      <p className="text-xs text-[var(--muted-foreground)] pt-2">
        iOS 앱은 곧 App Store 출시 예정 — 그때까지는 웹으로도 모든 기능 이용 가능
      </p>
    );
  }
  if (hint === "android") {
    return (
      <p className="text-xs text-[var(--muted-foreground)] pt-2">
        Android 앱은 준비 중이에요. 그동안 웹으로 모든 기능 이용 가능
      </p>
    );
  }
  return (
    <p className="text-xs text-[var(--muted-foreground)] pt-2">
      모바일에서 같은 링크를 열면 더 편하게 진행할 수 있어요
    </p>
  );
}
