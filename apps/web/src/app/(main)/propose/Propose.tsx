"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";
import { ApiError } from "@/lib/api";
import {
  proposeMatch,
  getProposalQuota,
  setMyKakaoTalkId,
  type ContactMethods,
  type ProposalQuota,
} from "@/lib/api/matching";

const MESSAGE_PLACEHOLDER = "예: 사주 보니 좋은 인연 같아서 연락드려요";
const MESSAGE_MAX = 500;

export function Propose() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = useAuthStore((s) => s.token);

  const targetId = sp.get("targetId") ?? "";
  const nickname = sp.get("nickname") ?? "";
  const score = sp.get("score") ?? "";
  const dayPillar = sp.get("dayPillar") ?? "";
  const ageRange = sp.get("ageRange") ?? "";

  const [methods, setMethods] = useState<ContactMethods>({ kakaoId: false, openChat: false });
  const [kakaoTalkId, setKakaoTalkId] = useState("");
  const [openChatUrl, setOpenChatUrl] = useState("");
  const [openChatPwd, setOpenChatPwd] = useState("");
  const [message, setMessage] = useState("");
  const [showOpenChatGuide, setShowOpenChatGuide] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quota, setQuota] = useState<ProposalQuota | null>(null);

  useEffect(() => {
    if (!token) return;
    void getProposalQuota(token).then(setQuota).catch(() => {
      // ignore — 표시만 못 함
    });
  }, [token]);

  if (!token) {
    return (
      <Centered>
        <p className="text-sm text-[var(--muted-foreground)]">로그인이 필요해요</p>
        <Button onClick={() => router.replace("/login")}>로그인하기</Button>
      </Centered>
    );
  }

  if (!targetId || !nickname) {
    return (
      <Centered>
        <p className="text-sm text-[var(--muted-foreground)]">잘못된 접근이에요</p>
        <Button onClick={() => router.replace("/discover")}>탐색으로</Button>
      </Centered>
    );
  }

  const remainingText = quota
    ? quota.isPremium
      ? "프리미엄 — 무제한"
      : `남은 제안 횟수: ${Math.max(quota.limit - quota.used, 0)}/${quota.limit} (오늘)`
    : "";

  const onSubmit = async () => {
    if (!methods.kakaoId && !methods.openChat) {
      toast.error("연락 방법을 1개 이상 선택해 주세요");
      return;
    }
    if (methods.kakaoId && !kakaoTalkId.trim()) {
      toast.error("카카오톡 ID 를 입력해 주세요");
      return;
    }
    if (methods.openChat) {
      if (!openChatUrl.trim()) return toast.error("오픈채팅 링크를 입력해 주세요");
      if (!/^[0-9]{4}$/.test(openChatPwd.trim())) {
        return toast.error("비밀번호는 4자리 숫자로 설정해 주세요");
      }
    }
    if (message.length > MESSAGE_MAX) {
      return toast.error(`메시지는 ${MESSAGE_MAX}자 이내여야 해요`);
    }

    setSubmitting(true);
    try {
      // 본인 카톡 ID 프로필에 저장 (다음 제안 prefill)
      if (methods.kakaoId && kakaoTalkId.trim()) {
        try {
          await setMyKakaoTalkId(token, kakaoTalkId.trim());
        } catch {
          // ignore — 저장 실패해도 제안 자체는 시도
        }
      }
      await proposeMatch(token, {
        targetId,
        contactMethods: methods,
        message: message.trim() || null,
        kakaoTalkIdShared: methods.kakaoId ? kakaoTalkId.trim() : null,
        openChatRoomUrl: methods.openChat ? openChatUrl.trim() : null,
        openChatPassword: methods.openChat ? openChatPwd.trim() : null,
      });
      toast.success(`${nickname}님께 제안을 보냈어요`);
      router.replace("/matches");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "전송 실패";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const recommendedRoomName = `緣 ${nickname} × 나`;

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-[var(--muted-foreground)]"
        >
          ← 뒤로
        </button>

        <header className="space-y-1">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl text-[var(--foreground)]">
            {nickname}님께 인연을 제안하시겠어요?
          </h1>
          {(score || dayPillar || ageRange) && (
            <p className="text-xs text-[var(--muted-foreground)]">
              {score && <span className="text-[var(--brand-gold)] font-bold">{score}점</span>}
              {dayPillar && <span> · 일주 {dayPillar}</span>}
              {ageRange && <span> · {ageRange}</span>}
            </p>
          )}
        </header>

        <Card className="border-none shadow-sm">
          <CardContent className="py-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">연락 방법 (1개 이상)</p>

              {/* 카카오톡 ID */}
              <label className="flex items-start gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={!!methods.kakaoId}
                  onChange={(e) => setMethods((m) => ({ ...m, kakaoId: e.target.checked }))}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm">📱 카카오톡 ID 공유</p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    수락 시 양쪽에 공개돼요
                  </p>
                  {methods.kakaoId && (
                    <input
                      type="text"
                      value={kakaoTalkId}
                      onChange={(e) => setKakaoTalkId(e.target.value)}
                      placeholder="내 카카오톡 ID"
                      className="mt-2 w-full rounded border border-[var(--muted-foreground)]/20 px-2 py-1.5 text-sm"
                    />
                  )}
                </div>
              </label>

              {/* 오픈채팅 */}
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={!!methods.openChat}
                  onChange={(e) => setMethods((m) => ({ ...m, openChat: e.target.checked }))}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm">💬 오픈채팅방 만들기</p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    1:1 비밀번호 보호 방을 직접 만들어요
                  </p>
                  {methods.openChat && (
                    <div className="mt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowOpenChatGuide((v) => !v)}
                        className="text-[11px] text-[var(--brand-gold)] underline"
                      >
                        {showOpenChatGuide ? "가이드 닫기" : "만드는 방법 보기"}
                      </button>
                      {showOpenChatGuide && (
                        <div className="rounded bg-[var(--brand-gold)]/5 p-3 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                          <p>1️⃣ 카카오톡 → 채팅 → ⚙️ → 오픈채팅 만들기</p>
                          <p>2️⃣ 1:1 채팅 모드 선택</p>
                          <p>3️⃣ 방 이름 권장: <span className="font-medium text-[var(--foreground)]">{recommendedRoomName}</span></p>
                          <p>4️⃣ 비밀번호 4자리 숫자 설정</p>
                          <p>5️⃣ 만든 후 링크 복사 → 아래 붙여넣기</p>
                        </div>
                      )}
                      <input
                        type="url"
                        value={openChatUrl}
                        onChange={(e) => setOpenChatUrl(e.target.value)}
                        placeholder="https://open.kakao.com/o/..."
                        className="w-full rounded border border-[var(--muted-foreground)]/20 px-2 py-1.5 text-sm"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={openChatPwd}
                        onChange={(e) => setOpenChatPwd(e.target.value.replace(/\D/g, ""))}
                        placeholder="4자리 비밀번호"
                        className="w-full rounded border border-[var(--muted-foreground)]/20 px-2 py-1.5 text-sm tracking-widest"
                      />
                    </div>
                  )}
                </div>
              </label>
            </div>

            {/* 메시지 */}
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">
                메시지 <span className="text-[10px] text-[var(--muted-foreground)]">(선택)</span>
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                placeholder={MESSAGE_PLACEHOLDER}
                rows={4}
                className="w-full rounded border border-[var(--muted-foreground)]/20 px-2 py-2 text-sm resize-none"
              />
              <p className="text-[10px] text-right text-[var(--muted-foreground)] mt-1">
                {message.length}/{MESSAGE_MAX}
              </p>
            </div>

            {/* 한도 표시 */}
            {remainingText && (
              <p className="text-[11px] text-[var(--muted-foreground)] text-center">
                {remainingText}
              </p>
            )}

            {/* 제안 안내 */}
            <p className="text-[11px] text-[var(--muted-foreground)] text-center">
              7일 내 응답이 없으면 자동 만료돼요
            </p>

            <Button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="w-full bg-[var(--brand-red)] text-white"
            >
              {submitting ? "전송 중..." : "제안 보내기"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-6">
      <div className="mx-auto max-w-md text-center mt-12 space-y-4">{children}</div>
    </div>
  );
}
